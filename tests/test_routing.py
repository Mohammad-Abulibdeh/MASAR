import itertools

import networkx as nx
import numpy as np
import pytest

from core.cost_function import CostParams
from core.routing_engine import (DISTANCE, FASTEST, MASAR, NoRouteError, RoutingEngine, recommend)
from core.traffic_manager import TrafficManager
from tests.conftest import make_diamond, make_grid


# ----------------------------------------------------------- shortest path
def test_shortest_distance_route(diamond):
    net, tm, eng = diamond
    r = eng.route("A", "D", DISTANCE)
    assert r.nodes == ["A", "B", "D"]
    assert r.distance_m == pytest.approx(1000.0)
    assert r.segments == 2


def test_shortest_path_matches_brute_force_on_grid(grid):
    net, tm, eng = grid
    G = net.G
    src, dst = (0, 0), (3, 4)
    best = min(
        (sum(G[u][v]["length"] for u, v in zip(p[:-1], p[1:])), p)
        for p in nx.all_simple_paths(G, src, dst, cutoff=9)
    )
    r = eng.route(src, dst, DISTANCE)
    assert r.distance_m == pytest.approx(best[0])


def test_astar_equals_dijkstra_under_random_traffic():
    net = make_grid(n=7, seed=3)
    tm = TrafficManager(net)
    tm.apply_random_scenario(seed=11, mean_load=0.7, spread=0.5)
    eng = RoutingEngine(net, tm, CostParams())
    nodes = list(net.G.nodes)
    rng = np.random.default_rng(1)
    for _ in range(25):
        a, b = (nodes[i] for i in rng.choice(len(nodes), 2, replace=False))
        t_astar = eng.evaluate(eng.shortest_path(a, b, MASAR, "astar")).est_time_s
        t_dijk = eng.evaluate(eng.shortest_path(a, b, MASAR, "dijkstra")).est_time_s
        assert t_astar == pytest.approx(t_dijk, rel=1e-9)


# ------------------------------------------------- DETERMINISTIC SCENARIO
def test_masar_picks_longer_route_when_shortest_is_congested(diamond):
    """
    Short Street (A->B->D, 1000 m) is heavily congested: 60 vehicles on a
    50-vehicle segment. Long Avenue (A->C->D, 1400 m) is empty.

      short: A->B  500 m, ratio 1.2 -> factor 1 + 2*1.2^4 = 5.147 -> 185.3 s
             B->D  500 m, empty                                   ->  36.0 s
             total                                                   221.3 s
      long : 1400 m at 50 km/h                                    -> 100.8 s

    Distance routing must still choose the short road; MASAR must choose the
    longer road because its estimated travel time is lower.
    """
    net, tm, eng = diamond
    tm.set_vehicles("A-B", 60)

    routes = eng.compare("A", "D")
    assert routes[DISTANCE].nodes == ["A", "B", "D"]
    assert routes[FASTEST].nodes == ["A", "B", "D"]      # free-flow time ignores congestion
    assert routes[MASAR].nodes == ["A", "C", "D"]

    assert routes[MASAR].distance_m > routes[DISTANCE].distance_m
    assert routes[DISTANCE].est_time_s == pytest.approx(500 / (50 / 3.6) * (1 + 2 * 1.2 ** 4) + 36.0, rel=1e-3)
    assert routes[MASAR].est_time_s == pytest.approx(1400 / (50 / 3.6), rel=1e-6)
    assert routes[MASAR].est_time_s < routes[DISTANCE].est_time_s
    assert routes[DISTANCE].congestion_cost_s > 100 and routes[MASAR].congestion_cost_s == pytest.approx(0)

    mode, reason = recommend(routes)
    assert mode == MASAR and "longer" in reason


def test_masar_keeps_short_route_when_congestion_is_mild(diamond):
    net, tm, eng = diamond
    tm.set_vehicles("A-B", 20)      # ratio 0.4 -> factor 1.05: not worth a 400 m detour
    assert eng.route("A", "D", MASAR).nodes == ["A", "B", "D"]


def test_route_flips_at_the_break_even_point(diamond):
    """Find the vehicle count where MASAR switches; it must equal the point where times cross."""
    net, tm, eng = diamond
    switch = None
    for n in range(0, 120):
        tm.set_vehicles("A-B", n)
        if eng.route("A", "D", MASAR).nodes == ["A", "C", "D"]:
            switch = n
            break
    assert switch is not None
    tm.set_vehicles("A-B", switch)
    short_t = eng.evaluate(["A", "B", "D"]).est_time_s
    long_t = eng.evaluate(["A", "C", "D"]).est_time_s
    assert long_t < short_t
    tm.set_vehicles("A-B", switch - 1)
    assert eng.evaluate(["A", "B", "D"]).est_time_s <= eng.evaluate(["A", "C", "D"]).est_time_s


# ----------------------------------------------------------- one-way roads
def test_one_way_shortcut_is_not_used_against_its_direction(diamond):
    net, tm, eng = diamond
    # D->A exists (850 m) but A->D does not; A->D must go via B or C.
    assert not net.G.has_edge("A", "D")
    for mode in (DISTANCE, FASTEST, MASAR):
        assert eng.route("A", "D", mode).nodes != ["A", "D"]


def test_one_way_shortcut_is_used_in_its_direction(diamond):
    net, tm, eng = diamond
    assert eng.route("D", "A", DISTANCE).nodes == ["D", "A"]


def test_every_route_edge_exists_in_directed_graph(grid):
    net, tm, eng = grid
    tm.apply_random_scenario(seed=2)
    r = eng.route((0, 0), (5, 5), MASAR)
    for u, v in zip(r.nodes[:-1], r.nodes[1:]):
        assert net.G.has_edge(u, v)


# --------------------------------------------------------- unreachability
def test_unreachable_destination_raises(diamond):
    net, tm, eng = diamond
    # B's only exit is B->D; closing it makes every other node unreachable from B.
    tm.set_closed("B-D", True)
    with pytest.raises(NoRouteError):
        eng.route("B", "C", MASAR)


def test_isolated_node_unreachable():
    nodes = {"X": (31.9, 35.2), "Y": (31.901, 35.2), "Z": (31.95, 35.25)}
    net = make_diamond().__class__.from_edge_list(nodes, [("X", "Y", dict(length=120, speed_kph=30))])
    eng = RoutingEngine(net, TrafficManager(net))
    with pytest.raises(NoRouteError):
        eng.route("Y", "X")
    with pytest.raises(NoRouteError):
        eng.route("X", "Z")


def test_unknown_node_raises(diamond):
    net, tm, eng = diamond
    with pytest.raises(NoRouteError):
        eng.route("A", "nowhere")


def test_same_origin_destination(diamond):
    net, tm, eng = diamond
    assert eng.shortest_path("A", "A") == ["A"]


# --------------------------------------------------------- recommendation
def test_recommend_when_all_agree(diamond):
    net, tm, eng = diamond
    mode, reason = recommend(eng.compare("A", "D"))
    assert mode == MASAR and "same path" in reason
