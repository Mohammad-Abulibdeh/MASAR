"""
Export the simulation's road network and traffic presets for the Android app.

Writes www/data/network.js (loaded by the app) and tools/golden_routes.json (answers from the
Python routing engine, which tools/test_routes.html compares against the app's JavaScript router).

Run from the MASAR folder:  .venv\\Scripts\\python MASAR_App\\tools\\export_network.py
"""
import json
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import networkx as nx  # noqa: E402

from core.graph_manager import RoadNetwork  # noqa: E402
from core.map_loader import GOVERNORATE_AREA  # noqa: E402
from core.routing_engine import MODES, NoRouteError, RoutingEngine  # noqa: E402
from core.traffic_manager import TrafficManager  # noqa: E402

AREA = GOVERNORATE_AREA.cache_key()
PRESETS = ("calm", "busy", "rush_hour")
SEED = 42
HIGHWAY_RANK = {"trunk": 3, "primary": 3, "secondary": 2, "tertiary": 1}
APP = ROOT / "MASAR_App"

# Arabic names for the OSM landmarks, most of which are tagged in English only.
PLACE_AR = {
    "Al Manara Square": "دوار المنارة",
    "Ramallah Bus And Taxi Center Station": "مجمع الباصات والتكسيات",
    "Um Al-Sharayet taxes station": "موقف تكسيات أم الشرايط",
    "Ramallah Municipality": "بلدية رام الله",
    "Al-bireh municipality": "بلدية البيرة",
    "Al-Razi Eyes' Hospital": "مستشفى الرازي للعيون",
    "Palestine Red Crescent Hospital Al Bireh": "مستشفى الهلال الأحمر - البيرة",
    "Al Mustakbal Hospital": "مستشفى المستقبل",
    "Al Re'ayeh Hospital (Arab Care)": "مستشفى الرعاية العربية",
    "Al Quds Open University": "جامعة القدس المفتوحة",
    "Modern University College-MUC": "الكلية الجامعية الحديثة",
    "Al-Bireh College": "كلية البيرة",
    "Women Society College": "كلية مجتمع المرأة",
    "Ramallah Museum": "متحف رام الله",
    "Dar Zahran Heritage Building": "دار زهران التراثية",
    "Noora Heritage House": "بيت نورا التراثي",
    "Shuqba": "شقبا",
    "Rantis": "رنتيس",
    "Kharbatha al-Misbah": "خربثا المصباح",
}
# Settlements that OSM tags as villages or towns with an Arabic name. Their roads stay on the map.
SETTLEMENTS_AR = {"موديعين عيليت", "بيت إيل", "عوفرا", "بسغوت", "رامونيم", "نحليئيل", "نيلي", "حشمونائيم",
                  "كوخاف هشاحر", "نڨي تسوف", "أحيا", "عدي عاد", "عميحاي", "كِرِم رِعِيم", "ملأَخي هشالوم"}
SAME_LETTERS = str.maketrans({"ة": "ه", "أ": "ا", "إ": "ا", "آ": "ا", "ى": "ي"})
PLACE_EN = {"موقف سيارات ام الشرايط": "Um Al-Sharayet Car Park"}


def build_places() -> list:
    raw = json.loads((ROOT / "data" / "cache" / f"places_{AREA}.json").read_text(encoding="utf-8"))
    out, seen = [], set()
    for p in raw:
        name = p["name"]
        tagged = p.get("name_ar", "").replace("‎", "").replace("‏", "").strip()
        ar = PLACE_AR.get(name) or tagged
        en = PLACE_EN.get(name, name)
        # OSM also tags settlements as villages. Those left without an Arabic name are not listed.
        if not ar and p["category"] in ("city", "town", "village"):
            continue
        ar = ar or name
        key = ar.translate(SAME_LETTERS)
        if key in seen or ar in SETTLEMENTS_AR:
            continue
        seen.add(key)
        out.append({"ar": ar, "en": en, "cat": p["category"], "lat": p["lat"], "lng": p["lng"]})
    return out


def main() -> None:
    net = RoadNetwork.load(ROOT / "data" / "cache" / f"{AREA}.json")
    G = net.G
    node_ids = list(G.nodes)
    node_index = {n: i for i, n in enumerate(node_ids)}
    largest = max(nx.strongly_connected_components(G), key=len)

    names, name_index, edges, edge_ids = [], {}, [], []
    for u, v, d in G.edges(data=True):
        ar, en = d.get("name_ar") or d.get("name") or "", d.get("name_en") or ""
        key = (ar, en)
        if not (ar or en):
            name = -1
        else:
            if key not in name_index:
                name_index[key] = len(names)
                names.append([ar, en])
            name = name_index[key]
        coords = [[round(a, 6), round(b, 6)] for a, b in d.get("coords", [])[1:-1]]
        edges.append([node_index[u], node_index[v], round(d["length"], 2), round(d["speed_kph"], 1),
                      name, HIGHWAY_RANK.get(d.get("highway"), 0), coords])
        edge_ids.append(d["edge_id"])

    traffic = {}
    capacity = None
    managers = {}
    for preset in PRESETS:
        tm = TrafficManager(net)
        tm.apply_preset(preset, seed=SEED)
        managers[preset] = tm
        traffic[preset] = [int(tm.state[e].vehicles) for e in edge_ids]
        if capacity is None:
            capacity = [round(tm.state[e].capacity, 2) for e in edge_ids]

    data = {
        "source": "© OpenStreetMap contributors (ODbL)",
        "lat": [round(G.nodes[n]["y"], 6) for n in node_ids],
        "lng": [round(G.nodes[n]["x"], 6) for n in node_ids],
        "snap": [1 if n in largest else 0 for n in node_ids],
        "names": names,
        "edges": edges,
        "capacity": capacity,
        "traffic": traffic,
        "places": build_places(),
    }
    out = APP / "www" / "data" / "network.js"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("window.MASAR_NET=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";",
                   encoding="utf-8")

    rng = random.Random(SEED)
    candidates = [n for n in node_ids if n in largest]
    golden = []
    for preset in PRESETS:
        engine = RoutingEngine(net, managers[preset])
        for _ in range(40):
            a, b = rng.sample(candidates, 2)
            try:
                routes = engine.compare(a, b)
            except NoRouteError:
                continue
            golden.append({"preset": preset, "from": node_index[a], "to": node_index[b],
                           "routes": {m: {"distance": routes[m].distance_m, "free": routes[m].free_time_s, "time": routes[m].est_time_s}
                                      for m in MODES}})
    (APP / "tools" / "golden_routes.json").write_text(json.dumps(golden), encoding="utf-8")
    print(f"nodes={len(node_ids)} snap={len(largest)} edges={len(edges)} names={len(names)} "
          f"size={out.stat().st_size / 1024:.0f} KB golden={len(golden)}")


if __name__ == "__main__":
    main()
