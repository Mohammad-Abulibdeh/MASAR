"""
Download, cache and load the real OpenStreetMap drivable road network.

* Data source: OpenStreetMap via OSMnx (Overpass API).
* Area: a square around a centre point (default: Al-Manara Square, central
  Ramallah) with a configurable half-width `dist_m`. Change or expand it from
  the dashboard sidebar or by editing DEFAULT_AREA.
* Cache: each area is stored in data/cache/ as
    <key>.graphml  - raw OSMnx graph (re-processable, full OSM attributes)
    <key>.json     - MASAR's processed RoadNetwork (fast load)
  Once cached, the app works fully offline for that area.
* Failures (no internet, Overpass down, OSMnx not installed) raise
  MapLoadError with a human-readable message; they never crash the app.
"""
from __future__ import annotations

import json
import time
from dataclasses import dataclass, asdict
from pathlib import Path

from .graph_manager import RoadNetwork

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = PROJECT_ROOT / "data" / "cache"


@dataclass(frozen=True)
class MapArea:
    label: str = "Central Ramallah"
    center_lat: float = 31.9038   # Al-Manara Square (approx.)
    center_lon: float = 35.2042
    dist_m: int = 1500            # half-width of the square download area
    network_type: str = "drive"
    place: str = ""               # OSM boundary to cut to; empty means the whole square

    def cache_key(self) -> str:
        return (f"osm_{self.network_type}_{self.center_lat:.5f}_{self.center_lon:.5f}_{int(self.dist_m)}m"
                .replace(".", "p").replace("-", "m"))

    def to_dict(self) -> dict:
        return asdict(self)


DEFAULT_AREA = MapArea()
# The whole governorate with its towns and villages, cut to its OpenStreetMap boundary.
GOVERNORATE_AREA = MapArea("Ramallah & Al-Bireh Governorate", 31.957, 35.204, 25000,
                           place="Ramallah and al-Bireh Governorate")


class MapLoadError(RuntimeError):
    pass


@dataclass
class LoadResult:
    network: RoadNetwork
    source: str        # "cache" or "download"
    message: str
    cache_path: Path


def cache_paths(area: MapArea, cache_dir: Path = CACHE_DIR) -> tuple[Path, Path]:
    key = area.cache_key()
    return cache_dir / f"{key}.json", cache_dir / f"{key}.graphml"


def list_cached_areas(cache_dir: Path = CACHE_DIR) -> list[dict]:
    out = []
    for p in sorted(Path(cache_dir).glob("osm_*.json")):
        try:
            with p.open(encoding="utf-8") as f:
                meta = json.load(f).get("meta", {})
            out.append({"path": str(p), **meta.get("area", {}), "downloaded_at": meta.get("downloaded_at")})
        except Exception:
            continue
    return out


def _configure_osmnx(ox, cache_dir: Path) -> None:
    ox.settings.use_cache = True
    ox.settings.cache_folder = str(cache_dir / "osmnx_http")
    ox.settings.log_console = False
    ox.settings.requests_timeout = 300
    tags = list(ox.settings.useful_tags_way)
    for t in ("name", "name:ar", "name:en", "ref", "maxspeed", "lanes", "oneway"):
        if t not in tags:
            tags.append(t)
    ox.settings.useful_tags_way = tags


def download_network(area: MapArea, cache_dir: Path = CACHE_DIR) -> RoadNetwork:
    try:
        import osmnx as ox
    except ImportError as exc:
        raise MapLoadError(
            "OSMnx is not installed in this Python environment. Run run.bat "
            "(or `pip install -r requirements.txt`) and try again."
        ) from exc

    cache_dir.mkdir(parents=True, exist_ok=True)
    _configure_osmnx(ox, cache_dir)
    try:
        if area.place:
            MG = ox.graph_from_place(area.place, network_type=area.network_type, simplify=True,
                                     truncate_by_edge=True)
        else:
            MG = ox.graph_from_point(
                (area.center_lat, area.center_lon),
                dist=area.dist_m,
                dist_type="bbox",
                network_type=area.network_type,
                simplify=True,
                truncate_by_edge=True,
            )
    except Exception as exc:  # network errors, Overpass errors, empty area...
        raise MapLoadError(
            "Could not download the road network from OpenStreetMap "
            f"({type(exc).__name__}: {exc}). Check your internet connection, "
            "or try again later if the Overpass API is busy."
        ) from exc

    if MG.number_of_edges() == 0:
        raise MapLoadError("OpenStreetMap returned no drivable roads for this area.")

    _, graphml_path = cache_paths(area, cache_dir)
    try:
        ox.save_graphml(MG, filepath=graphml_path)
    except Exception:
        pass  # raw copy is optional; processed JSON is what the app needs

    meta = {
        "source": "OpenStreetMap contributors, via OSMnx",
        "osmnx_version": getattr(ox, "__version__", "?"),
        "area": area.to_dict(),
        "downloaded_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "license": "ODbL - (c) OpenStreetMap contributors",
    }
    return RoadNetwork.from_osmnx(MG, meta)


def load_network(area: MapArea = DEFAULT_AREA, cache_dir: Path = CACHE_DIR,
                 force_refresh: bool = False) -> LoadResult:
    json_path, graphml_path = cache_paths(area, cache_dir)

    if json_path.exists() and not force_refresh:
        try:
            net = RoadNetwork.load(json_path)
            return LoadResult(net, "cache", f"Loaded cached OSM network ({json_path.name}).", json_path)
        except Exception:
            pass  # corrupted cache -> try rebuilding

    # Raw graphml present but processed JSON missing/corrupt -> rebuild offline
    if graphml_path.exists() and not force_refresh:
        try:
            import osmnx as ox
            MG = ox.load_graphml(graphml_path)
            net = RoadNetwork.from_osmnx(MG, {"source": "OpenStreetMap contributors, via OSMnx",
                                              "area": area.to_dict(), "downloaded_at": "from graphml cache"})
            net.save(json_path)
            return LoadResult(net, "cache", "Rebuilt network from cached GraphML.", json_path)
        except Exception:
            pass

    try:
        net = download_network(area, cache_dir)
    except MapLoadError as exc:
        cached = list_cached_areas(cache_dir)
        hint = ""
        if cached:
            hint = (" Cached areas available offline: " +
                    "; ".join(f"{c.get('label', '?')} ({c.get('dist_m', '?')} m)" for c in cached))
        if json_path.exists():  # refresh failed but an old copy exists
            net = RoadNetwork.load(json_path)
            return LoadResult(net, "cache", f"Refresh failed, using cached copy. {exc}", json_path)
        raise MapLoadError(str(exc) + hint) from exc

    net.save(json_path)
    return LoadResult(net, "download", f"Downloaded {net.G.number_of_edges()} road segments from OpenStreetMap.",
                      json_path)


def geocode_online(query: str, context: str = "Ramallah, Palestine") -> tuple[float, float] | None:
    """Optional Nominatim lookup (needs internet). Returns (lat, lon) or None."""
    try:
        import osmnx as ox
        lat, lon = ox.geocode(f"{query}, {context}")
        return float(lat), float(lon)
    except Exception:
        return None
