"""
Named landmarks from OpenStreetMap, so people can pick "Ramallah Museum" and not a node.

Fetched once per map area in the background and cached in data/cache/. The app never waits
for them: a failed or slow download only means that area has no landmark list yet.
"""
from __future__ import annotations

import json
import threading
from pathlib import Path

from .map_loader import CACHE_DIR, MapArea, _configure_osmnx

TAGS = {
    "place": ["square", "city", "town", "village"],
    "amenity": ["hospital", "university", "college", "townhall", "bus_station"],
    "tourism": ["museum"],
}
# (category, label, how many to keep)
CATEGORIES = [("square", "Square", 4), ("bus_station", "Transport", 3), ("townhall", "City hall", 2),
              ("hospital", "Hospital", 4), ("university", "University", 3), ("college", "College", 2),
              ("museum", "Museum", 3), ("city", "City", 10), ("town", "Town", 60), ("village", "Village", 300)]

_started: set = set()


def _text(value) -> str:
    return value.strip() if isinstance(value, str) else ""


def _category(row) -> str | None:
    for column in ("place", "amenity", "tourism"):
        value = _text(row.get(column))
        if value in {c for c, _, _ in CATEGORIES}:
            return value
    return None


def select_places(rows: list[dict]) -> list[dict]:
    """Keep a short, de-duplicated list per category. Hospitals named as such come first."""
    out, seen = [], set()
    for category, label, limit in CATEGORIES:
        group = [r for r in rows if r["category"] == category and r["name"].lower() not in seen]
        if category == "hospital":
            group.sort(key=lambda r: "hospital" not in r["name"].lower())
        if category == "townhall":
            group = [r for r in group if "municipal" in r["name"].lower()]
        for r in group[:limit]:
            seen.add(r["name"].lower())
            out.append({**r, "label": label})
    return out


def _download(area: MapArea, cache_dir: Path) -> list[dict]:
    import osmnx as ox

    _configure_osmnx(ox, Path(cache_dir))
    ox.settings.overpass_rate_limit = False
    if area.place:
        # Overpass refuses a query carrying the whole boundary: ask by its box, then cut to it.
        boundary = ox.geocode_to_gdf(area.place).geometry.iloc[0]
        gdf = ox.features_from_bbox(boundary.bounds, TAGS)
        gdf = gdf[gdf.geometry.centroid.within(boundary)]
    else:
        gdf = ox.features_from_point((area.center_lat, area.center_lon), TAGS, dist=area.dist_m)
    rows = []
    for _, row in gdf.iterrows():
        name = _text(row.get("name:en")) or _text(row.get("name"))
        category = _category(row)
        if name and category:
            c = row.geometry.centroid
            rows.append({"name": name, "name_ar": _text(row.get("name:ar")), "category": category,
                         "lat": round(float(c.y), 6), "lng": round(float(c.x), 6)})
    return rows


def _path(area: MapArea, cache_dir: Path) -> Path:
    return Path(cache_dir) / f"places_{area.cache_key()}.json"


def cached_places(area: MapArea, cache_dir: Path = CACHE_DIR) -> list[dict]:
    try:
        return json.loads(_path(area, cache_dir).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []


def fetch_places(area: MapArea, cache_dir: Path = CACHE_DIR, downloader=_download) -> list[dict]:
    """Download and cache landmarks. Returns [] on any failure: they are optional."""
    try:
        places = select_places(downloader(area, cache_dir))
    except Exception:  # offline, Overpass busy, OSMnx missing
        return []
    path = _path(area, cache_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(places, ensure_ascii=False, indent=0), encoding="utf-8")
    return places


def fetch_places_in_background(area: MapArea, cache_dir: Path = CACHE_DIR) -> None:
    key = area.cache_key()
    if key in _started or _path(area, cache_dir).exists():
        return
    _started.add(key)
    threading.Thread(target=fetch_places, args=(area, cache_dir), daemon=True).start()
