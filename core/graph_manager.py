"""
RoadNetwork: MASAR's internal representation of a real road graph.

The OSMnx MultiDiGraph is converted to a NetworkX DiGraph:
  * one directed edge per (u, v): road direction is preserved exactly as in OSM
    (a one-way street has an edge in one direction only);
  * if OSM has several parallel edges between the same two intersections, the
    shortest one is kept (documented simplification);
  * each edge stores a stable string id "u-v", its geometry, length, names
    (default / Arabic / English), highway type, lanes and free-flow speed with
    the source of that speed (OSM maxspeed tag or a default by road type).
"""
from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Iterable

import networkx as nx
import numpy as np

EARTH_R = 6_371_008.8

# Default free-flow speeds (km/h) by OSM highway type, used ONLY when the
# segment has no usable `maxspeed` tag. These are assumptions for urban roads.
DEFAULT_SPEEDS_KPH = {
    "motorway": 90, "trunk": 70, "primary": 50, "secondary": 40,
    "tertiary": 35, "unclassified": 30, "residential": 25,
    "living_street": 15, "service": 15, "road": 25,
    "motorway_link": 50, "trunk_link": 40, "primary_link": 35,
    "secondary_link": 30, "tertiary_link": 30,
}
FALLBACK_SPEED_KPH = 25

# Default lanes per direction when OSM `lanes` is missing.
DEFAULT_LANES = {"motorway": 2, "trunk": 2, "primary": 2}


def haversine_m(lat1, lon1, lat2, lon2):
    lat1, lon1, lat2, lon2 = map(np.radians, (lat1, lon1, lat2, lon2))
    a = np.sin((lat2 - lat1) / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    return 2 * EARTH_R * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


def _first(value):
    if isinstance(value, (list, tuple)):
        return value[0] if value else None
    return value


def _join_names(value) -> str:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return ""
    if isinstance(value, (list, tuple)):
        seen = []
        for v in value:
            if v and str(v) not in seen:
                seen.append(str(v))
        return " / ".join(seen)
    return str(value)


def parse_maxspeed(value) -> float | None:
    """Parse OSM maxspeed ('50', '30 mph', ['40','50']) to km/h."""
    if value is None:
        return None
    values = value if isinstance(value, (list, tuple)) else [value]
    speeds = []
    for v in values:
        m = re.search(r"(\d+(?:\.\d+)?)", str(v))
        if not m:
            continue
        s = float(m.group(1))
        if "mph" in str(v).lower():
            s *= 1.609344
        if 3 <= s <= 150:
            speeds.append(s)
    return float(np.mean(speeds)) if speeds else None


def parse_lanes(value) -> int | None:
    values = value if isinstance(value, (list, tuple)) else [value]
    out = []
    for v in values:
        m = re.search(r"(\d+)", str(v)) if v is not None else None
        if m:
            out.append(int(m.group(1)))
    return max(out) if out else None


def _is_true(value) -> bool:
    v = _first(value)
    return str(v).lower() in ("true", "yes", "1", "-1")


class RoadNetwork:
    """Directed road graph with per-edge metadata. `self.G` is an nx.DiGraph."""

    def __init__(self, G: nx.DiGraph, meta: dict | None = None):
        self.G = G
        self.meta = meta or {}
        self._edge_index = {d["edge_id"]: (u, v) for u, v, d in G.edges(data=True)}
        self._node_ids = list(G.nodes())
        self._node_lat = np.array([G.nodes[n]["y"] for n in self._node_ids], dtype=float)
        self._node_lon = np.array([G.nodes[n]["x"] for n in self._node_ids], dtype=float)
        self.max_speed_kph = max((d["speed_kph"] for _, _, d in G.edges(data=True)), default=FALLBACK_SPEED_KPH)

    # ------------------------------------------------------------------ build
    @classmethod
    def from_osmnx(cls, MG, meta: dict | None = None) -> "RoadNetwork":
        """Convert an OSMnx MultiDiGraph (lat/lon, unprojected) to a RoadNetwork."""
        G = nx.DiGraph()
        for n, d in MG.nodes(data=True):
            G.add_node(n, x=float(d["x"]), y=float(d["y"]),
                       street_count=int(d.get("street_count", 0) or 0))
        for u, v, k, d in MG.edges(keys=True, data=True):
            length = float(d.get("length", 0.0) or 0.0)
            if G.has_edge(u, v) and G[u][v]["length"] <= length:
                continue  # keep shortest parallel edge
            highway = _first(d.get("highway")) or "road"
            oneway = _is_true(d.get("oneway", False))
            maxspeed = parse_maxspeed(d.get("maxspeed"))
            if maxspeed is not None:
                speed, speed_src = maxspeed, "OSM maxspeed tag"
            else:
                speed = DEFAULT_SPEEDS_KPH.get(highway, FALLBACK_SPEED_KPH)
                speed_src = f"default for '{highway}' (assumption)"
            lanes_total = parse_lanes(d.get("lanes"))
            if lanes_total:
                lanes = lanes_total if oneway else max(1, lanes_total // 2)
                lanes_src = "OSM lanes tag"
            else:
                lanes = DEFAULT_LANES.get(highway, 1)
                lanes_src = "default (assumption)"
            geom = d.get("geometry")
            if geom is not None:
                coords = [(float(y), float(x)) for x, y in geom.coords]
            else:
                coords = [(MG.nodes[u]["y"], MG.nodes[u]["x"]), (MG.nodes[v]["y"], MG.nodes[v]["x"])]
            osmid = d.get("osmid")
            G.add_edge(
                u, v,
                edge_id=f"{u}-{v}",
                osmid=[int(x) for x in osmid] if isinstance(osmid, list) else (int(osmid) if osmid is not None else None),
                name=_join_names(d.get("name")),
                name_ar=_join_names(d.get("name:ar")),
                name_en=_join_names(d.get("name:en")),
                ref=_join_names(d.get("ref")),
                highway=str(highway),
                oneway=bool(oneway),
                length=length,
                lanes=int(lanes), lanes_source=lanes_src,
                speed_kph=float(speed), speed_source=speed_src,
                coords=[(round(a, 7), round(b, 7)) for a, b in coords],
            )
        return cls(G, meta)

    @classmethod
    def from_edge_list(cls, nodes: dict, edges: Iterable, meta: dict | None = None) -> "RoadNetwork":
        """Build a network from explicit data (used by tests).

        nodes: {node_id: (lat, lon)}
        edges: iterable of (u, v, attrs) with at least `length` and `speed_kph`.
        """
        G = nx.DiGraph()
        for n, (lat, lon) in nodes.items():
            G.add_node(n, x=float(lon), y=float(lat), street_count=0)
        for u, v, a in edges:
            a = dict(a)
            a.setdefault("edge_id", f"{u}-{v}")
            a.setdefault("name", a["edge_id"])
            a.setdefault("name_ar", "")
            a.setdefault("name_en", "")
            a.setdefault("ref", "")
            a.setdefault("osmid", None)
            a.setdefault("highway", "residential")
            a.setdefault("oneway", True)
            a.setdefault("lanes", 1)
            a.setdefault("lanes_source", "test")
            a.setdefault("speed_source", "test")
            a.setdefault("coords", [nodes[u], nodes[v]])
            G.add_edge(u, v, **a)
        return cls(G, meta or {"source": "synthetic test graph"})

    # -------------------------------------------------------------- serialise
    def to_dict(self) -> dict:
        return {
            "meta": self.meta,
            "nodes": [[n, d["y"], d["x"], d.get("street_count", 0)] for n, d in self.G.nodes(data=True)],
            "edges": [[u, v, d] for u, v, d in self.G.edges(data=True)],
        }

    @classmethod
    def from_dict(cls, data: dict) -> "RoadNetwork":
        G = nx.DiGraph()
        for n, lat, lon, sc in data["nodes"]:
            G.add_node(n, x=lon, y=lat, street_count=sc)
        for u, v, d in data["edges"]:
            d["coords"] = [tuple(c) for c in d["coords"]]
            G.add_edge(u, v, **d)
        return cls(G, data.get("meta", {}))

    def save(self, path: Path) -> None:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.to_dict(), ensure_ascii=False), encoding="utf-8")
        tmp.replace(path)

    @classmethod
    def load(cls, path: Path) -> "RoadNetwork":
        return cls.from_dict(json.loads(Path(path).read_text(encoding="utf-8")))

    # ---------------------------------------------------------------- queries
    def edge(self, edge_id: str) -> tuple:
        return self._edge_index[edge_id]

    def edge_data(self, edge_id: str) -> dict:
        u, v = self._edge_index[edge_id]
        return self.G[u][v]

    def edge_ids(self) -> list[str]:
        return list(self._edge_index)

    def has_edge_id(self, edge_id: str) -> bool:
        return edge_id in self._edge_index

    def display_name(self, d: dict) -> str:
        parts = [d.get("name") or ""]
        for extra in (d.get("name_ar"), d.get("name_en")):
            if extra and extra not in parts[0]:
                parts.append(extra)
        label = " | ".join(p for p in parts if p)
        return label or (f"Unnamed {d.get('highway', 'road')}")

    def node_latlon(self, n) -> tuple[float, float]:
        d = self.G.nodes[n]
        return d["y"], d["x"]

    def nearest_node(self, lat: float, lon: float):
        dist = haversine_m(lat, lon, self._node_lat, self._node_lon)
        return self._node_ids[int(np.argmin(dist))]

    def straight_distance_m(self, a, b) -> float:
        la, oa = self.node_latlon(a)
        lb, ob = self.node_latlon(b)
        return float(haversine_m(la, oa, lb, ob))

    def distance_to_node(self, lat: float, lon: float, node) -> float:
        nlat, nlon = self.node_latlon(node)
        return float(haversine_m(lat, lon, nlat, nlon))

    def bounds(self) -> tuple[float, float, float, float]:
        return (float(self._node_lat.min()), float(self._node_lon.min()),
                float(self._node_lat.max()), float(self._node_lon.max()))

    def center(self) -> tuple[float, float]:
        s, w, n, e = self.bounds()
        return (s + n) / 2, (w + e) / 2

    def search_edges(self, query: str, limit: int | None = None) -> list[str]:
        """Case-insensitive search over default/Arabic/English names, ref and edge id."""
        q = (query or "").strip().lower()
        out = []
        for eid, (u, v) in self._edge_index.items():
            d = self.G[u][v]
            hay = " ".join([eid, d.get("name", ""), d.get("name_ar", ""), d.get("name_en", ""),
                            d.get("ref", ""), str(d.get("osmid", ""))]).lower()
            if not q or q in hay:
                out.append(eid)
                if limit and len(out) >= limit:
                    break
        return out

    def street_names(self) -> list[str]:
        names = {d["name"] for _, _, d in self.G.edges(data=True) if d.get("name")}
        return sorted(names)

    def edges_of_street(self, name: str) -> list[str]:
        return [d["edge_id"] for _, _, d in self.G.edges(data=True) if d.get("name") == name]

    def summary(self) -> dict:
        named = sum(1 for _, _, d in self.G.edges(data=True) if d.get("name"))
        oneway = sum(1 for _, _, d in self.G.edges(data=True) if d.get("oneway"))
        return {
            "intersections": self.G.number_of_nodes(),
            "segments": self.G.number_of_edges(),
            "named_segments": named,
            "one_way_segments": oneway,
            "total_km": sum(d["length"] for _, _, d in self.G.edges(data=True)) / 1000,
            "streets": len(self.street_names()),
        }
