"""Map loading, OSMnx conversion and offline/failure handling (no internet needed)."""
import builtins

import networkx as nx
import pytest

from core import map_loader
from core.graph_manager import RoadNetwork
from core.map_loader import MapArea, MapLoadError, load_network


class FakeLine:
    def __init__(self, coords):
        self.coords = coords


def fake_osmnx_graph():
    """A MultiDiGraph shaped like OSMnx output (lon/lat, OSM tags), incl. tricky values."""
    MG = nx.MultiDiGraph()
    MG.add_node(1, x=35.2000, y=31.9000, street_count=3)
    MG.add_node(2, x=35.2010, y=31.9000, street_count=3)
    MG.add_node(3, x=35.2010, y=31.9010, street_count=2)
    # two-way street: both directions, 2 lanes total -> 1 per direction
    for u, v in ((1, 2), (2, 1)):
        MG.add_edge(u, v, 0, osmid=100, name="شارع الإرسال", **{"name:en": "Al-Irsal Street"},
                    highway="primary", oneway=False, lanes="2", maxspeed="50", length=95.0)
    # parallel longer edge 1->2 (must be dropped)
    MG.add_edge(1, 2, 1, osmid=101, name="Service road", highway="service", oneway=True, length=140.0)
    # one-way, merged names list, mph speed, curved geometry
    MG.add_edge(2, 3, 0, osmid=[200, 201], name=["Main St", "Main St", "Side St"], highway=["tertiary", "residential"],
                oneway=True, maxspeed="20 mph", length=120.0,
                geometry=FakeLine([(35.2010, 31.9000), (35.2012, 31.9005), (35.2010, 31.9010)]))
    return MG


def test_from_osmnx_preserves_direction_names_and_attributes():
    net = RoadNetwork.from_osmnx(fake_osmnx_graph())
    G = net.G
    assert G.has_edge(1, 2) and G.has_edge(2, 1)
    assert G.has_edge(2, 3) and not G.has_edge(3, 2)          # one-way preserved
    e12 = G[1][2]
    assert e12["length"] == 95.0                              # shortest parallel edge kept
    assert e12["name"] == "شارع الإرسال" and e12["name_en"] == "Al-Irsal Street"
    assert e12["lanes"] == 1 and e12["speed_kph"] == 50 and "maxspeed" in e12["speed_source"]
    e23 = G[2][3]
    assert e23["name"] == "Main St / Side St"
    assert e23["speed_kph"] == pytest.approx(32.19, abs=0.01)
    assert len(e23["coords"]) == 3 and e23["coords"][0] == (31.9, 35.201)   # (lat, lon)
    assert "Al-Irsal" in net.display_name(e12)


def test_search_and_nearest_node():
    net = RoadNetwork.from_osmnx(fake_osmnx_graph())
    assert set(net.search_edges("irsal")) == {"1-2", "2-1"}
    assert set(net.search_edges("الإرسال")) == {"1-2", "2-1"}
    assert net.nearest_node(31.90095, 35.20102) == 3


def test_cache_roundtrip(tmp_path):
    net = RoadNetwork.from_osmnx(fake_osmnx_graph(), {"area": {"label": "t"}})
    p = tmp_path / "n.json"
    net.save(p)
    back = RoadNetwork.load(p)
    assert back.G.number_of_edges() == net.G.number_of_edges()
    assert back.edge_data("2-3")["coords"] == net.edge_data("2-3")["coords"]
    assert back.edge_data("1-2")["name"] == "شارع الإرسال"


def test_load_uses_cache_without_internet(tmp_path, monkeypatch):
    area = MapArea(label="t", center_lat=31.9, center_lon=35.2, dist_m=300)
    json_path, _ = map_loader.cache_paths(area, tmp_path)
    RoadNetwork.from_osmnx(fake_osmnx_graph()).save(json_path)

    def boom(*a, **k):
        raise AssertionError("should not download when cached")
    monkeypatch.setattr(map_loader, "download_network", boom)
    res = load_network(area, tmp_path)
    assert res.source == "cache" and res.network.G.number_of_edges() == 3


def test_missing_osmnx_and_no_cache_fails_gracefully(tmp_path, monkeypatch):
    real_import = builtins.__import__

    def fake_import(name, *a, **k):
        if name == "osmnx":
            raise ImportError("no osmnx")
        return real_import(name, *a, **k)
    monkeypatch.setattr(builtins, "__import__", fake_import)
    with pytest.raises(MapLoadError, match="OSMnx is not installed"):
        load_network(MapArea(dist_m=123), tmp_path)


def test_download_failure_falls_back_to_old_cache(tmp_path, monkeypatch):
    area = MapArea(dist_m=400)
    json_path, _ = map_loader.cache_paths(area, tmp_path)
    RoadNetwork.from_osmnx(fake_osmnx_graph()).save(json_path)

    def offline(*a, **k):
        raise MapLoadError("Could not download (offline)")
    monkeypatch.setattr(map_loader, "download_network", offline)
    res = load_network(area, tmp_path, force_refresh=True)
    assert res.source == "cache" and "Refresh failed" in res.message
