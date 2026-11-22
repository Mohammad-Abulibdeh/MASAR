"""
Shared fixtures. These are SMALL SYNTHETIC GRAPHS built only to test the
routing logic deterministically. They are not presented as Ramallah roads.
"""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.cost_function import CostParams  # noqa: E402
from core.graph_manager import RoadNetwork, haversine_m  # noqa: E402
from core.routing_engine import RoutingEngine  # noqa: E402
from core.traffic_manager import TrafficManager  # noqa: E402

LAT0, LON0 = 31.90, 35.20


def make_diamond() -> RoadNetwork:
    """
            C (north)
          /    \\           A->C->D : 700 m + 700 m = 1400 m  (long, normally empty)
        A        D          A->B->D : 500 m + 500 m = 1000 m  (short)
          \\    /           D->A    : 850 m ONE-WAY shortcut (only usable from D to A)
            B
    All speeds 50 km/h, all edges one-directional as listed.
    """
    nodes = {
        "A": (LAT0, LON0),
        "B": (LAT0 - 0.0010, LON0 + 0.00425),
        "C": (LAT0 + 0.0045, LON0 + 0.00425),
        "D": (LAT0, LON0 + 0.0085),
    }
    edges = [
        ("A", "B", dict(length=500.0, speed_kph=50.0, name="Short Street")),
        ("B", "D", dict(length=500.0, speed_kph=50.0, name="Short Street")),
        ("A", "C", dict(length=700.0, speed_kph=50.0, name="Long Avenue")),
        ("C", "D", dict(length=700.0, speed_kph=50.0, name="Long Avenue")),
        ("D", "A", dict(length=850.0, speed_kph=50.0, name="One-way Shortcut")),
    ]
    return RoadNetwork.from_edge_list(nodes, edges)


def make_grid(n=6, seed=0) -> RoadNetwork:
    """n x n two-way grid, ~200 m blocks, lengths slightly above straight-line distance."""
    rng = np.random.default_rng(seed)
    nodes = {}
    for i in range(n):
        for j in range(n):
            nodes[(i, j)] = (LAT0 + i * 0.0018, LON0 + j * 0.0021)
    edges = []
    for (i, j), (la, lo) in nodes.items():
        for di, dj in ((1, 0), (0, 1), (-1, 0), (0, -1)):
            k = (i + di, j + dj)
            if k in nodes:
                lb, ob = nodes[k]
                straight = float(haversine_m(la, lo, lb, ob))
                edges.append(((i, j), k, dict(length=straight * float(rng.uniform(1.0, 1.3)),
                                              speed_kph=float(rng.choice([25, 35, 50])),
                                              edge_id=f"{i}_{j}-{k[0]}_{k[1]}")))
    return RoadNetwork.from_edge_list(nodes, edges)


@pytest.fixture
def diamond():
    net = make_diamond()
    traffic = TrafficManager(net)
    for eid in traffic.state:
        traffic.set_capacity(eid, 50)
    return net, traffic, RoutingEngine(net, traffic, CostParams())


@pytest.fixture
def grid():
    net = make_grid()
    traffic = TrafficManager(net)
    return net, traffic, RoutingEngine(net, traffic, CostParams())
