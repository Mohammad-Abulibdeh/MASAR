"""
Export named buildings and points of interest (schools, academies, shops, offices, mosques...)
in Ramallah & Al-Bireh Governorate for the app's search.

Writes www/data/pois.js. Run from the MASAR folder:
    .venv\\Scripts\\python MASAR_App\\tools\\export_pois.py
"""
import json
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from core.map_loader import CACHE_DIR, GOVERNORATE_AREA, _configure_osmnx  # noqa: E402

OUT = ROOT / "MASAR_App" / "www" / "data" / "pois.js"
SERVERS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]
KEYS = ["amenity", "shop", "office", "building", "tourism", "leisure", "healthcare", "craft",
        "club", "historic", "sport", "man_made", "government", "landuse"]
# Things people do not drive to by name, or that the app already lists as streets or villages.
SKIP = {("amenity", "parking_space"), ("amenity", "bench"), ("amenity", "waste_basket"), ("amenity", "toilets"),
        ("amenity", "drinking_water"), ("amenity", "vending_machine"), ("amenity", "atm"), ("man_made", "pipeline"),
        ("landuse", "farmland"), ("landuse", "meadow"), ("landuse", "orchard"), ("landuse", "grass")}
HEBREW = range(0x0590, 0x0600)


def kind(tags: dict) -> str:
    for key in KEYS:
        value = tags.get(key)
        if value and (key, value) not in SKIP:
            return value if key in ("amenity", "tourism", "leisure", "healthcare") else key
    return ""


def is_hebrew(text: str) -> bool:
    return any(ord(c) in HEBREW for c in text)


def query(bbox) -> list:
    s, w, n, e = bbox
    filters = "".join(f'nwr["name"]["{k}"]({s},{w},{n},{e});' for k in KEYS)
    body = f"[out:json][timeout:240];({filters});out center tags;"
    for attempt in range(6):
        url = SERVERS[attempt % len(SERVERS)]
        try:
            r = requests.post(url, data={"data": body}, timeout=300,
                              headers={"User-Agent": "MASAR-app-export/1.0"})
            if r.ok:
                return r.json()["elements"]
            print("overpass", r.status_code, url)
        except requests.RequestException as exc:
            print("overpass error", exc)
        time.sleep(10 * (attempt + 1))
    raise SystemExit("Overpass did not answer")


def main() -> None:
    import osmnx as ox
    from shapely.geometry import Point

    _configure_osmnx(ox, Path(CACHE_DIR))
    boundary = ox.geocode_to_gdf(GOVERNORATE_AREA.place).geometry.iloc[0]
    w, s, e, n = boundary.bounds
    elements = query((s, w, n, e))

    out, seen = [], set()
    for el in elements:
        tags = el.get("tags", {})
        lat = el.get("lat") or el.get("center", {}).get("lat")
        lng = el.get("lon") or el.get("center", {}).get("lon")
        if lat is None or not boundary.contains(Point(lng, lat)):
            continue
        name = tags.get("name", "").strip()
        ar = tags.get("name:ar", "").strip()
        en = tags.get("name:en", "").strip()
        if not ar and any("؀" <= c <= "ۿ" for c in name):
            ar = name
        if not en and name and not is_hebrew(name) and name != ar:
            en = name
        if not (ar or en) or is_hebrew(ar + en):
            continue
        k = kind(tags)
        if not k:
            continue
        key = ((ar or en).lower(), round(lat, 3), round(lng, 3))
        if key in seen:
            continue
        seen.add(key)
        out.append([ar, en, k, round(lat, 6), round(lng, 6)])

    OUT.write_text("window.MASAR_POIS=" + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";",
                   encoding="utf-8")
    print(f"pois={len(out)} size={OUT.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
