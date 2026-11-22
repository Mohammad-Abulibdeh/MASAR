import pytest

from core.cost_function import CostParams
from core.experiment import DynamicTraffic, run_experiment, verdict
from core.graph_manager import haversine_m
from core.routing_engine import DISTANCE, MASAR, RoutingEngine
from core.traffic_manager import TrafficManager
from core.vehicle_simulator import ReroutePolicy, VehicleSimulator
from tests.conftest import make_diamond, make_grid


def _sim(diamond, **policy):
    net, tm, eng = diamond
    return net, tm, eng, VehicleSimulator(eng, ReroutePolicy(**policy))


def test_vehicle_moves_along_connected_segments():
    net = make_grid(n=6, seed=4)
    tm = TrafficManager(net)
    tm.apply_random_scenario(seed=9)
    eng = RoutingEngine(net, tm, CostParams())
    sim = VehicleSimulator(eng)
    v = sim.start((0, 0), (5, 5), MASAR)
    while not v.finished:
        sim.step(2.0)
    # consecutive traversed edges share a node and every edge exists in the directed graph
    pairs = [net.edge(e) for e in v.traversed_edges]
    assert pairs[0][0] == (0, 0) and pairs[-1][1] == (5, 5)
    for (u1, v1), (u2, v2) in zip(pairs, pairs[1:]):
        assert v1 == u2
    for u, w in pairs:
        assert net.G.has_edge(u, w)


def test_vehicle_never_teleports(diamond):
    net, tm, eng, sim = _sim(diamond)
    sim.start("A", "D", MASAR)
    prev = sim.position()
    max_speed = 50 / 3.6
    while not sim.vehicle.finished:
        sim.step(1.0)
        cur = sim.position()
        jump = float(haversine_m(prev[0], prev[1], cur[0], cur[1]))
        assert jump <= max_speed * 1.0 + 1.0       # straight-line jump bounded by speed * dt
        prev = cur


def test_static_trip_time_matches_route_estimate(diamond):
    net, tm, eng, sim = _sim(diamond)
    tm.set_vehicles("A-B", 30)
    v = sim.start("A", "D", DISTANCE)
    sim.run_to_completion(dt=0.5)
    assert v.finished
    assert v.elapsed_s == pytest.approx(eng.evaluate(["A", "B", "D"]).est_time_s, rel=1e-6)
    assert v.travelled_m == pytest.approx(1000.0)


def test_progress_and_remaining_time(diamond):
    net, tm, eng, sim = _sim(diamond)
    sim.start("A", "D", DISTANCE)
    s0 = sim.status()
    sim.step(36.0)                       # exactly one 500 m segment at 50 km/h
    s1 = sim.status()
    assert s0["progress_pct"] == pytest.approx(0.0)
    assert s1["progress_pct"] == pytest.approx(50.0, abs=0.1)
    assert s1["remaining_time_s"] == pytest.approx(36.0, abs=0.1)
    assert s1["current_segment"] == "Short Street"


def test_reroute_preserves_position_and_changes_only_remaining_route():
    """The vehicle is mid-segment when everything ahead of it jams. It must keep its current
    segment and position (no teleport) and only replace the not-yet-driven remainder."""
    net = make_grid(n=5, seed=1)
    tm = TrafficManager(net)
    eng = RoutingEngine(net, tm, CostParams())
    sim = VehicleSimulator(eng, ReroutePolicy(min_improvement_pct=5, min_improvement_s=1))
    v = sim.start((0, 0), (0, 4), MASAR)            # straight along row 0
    original = list(v.nodes)
    sim.step(5.0)
    pos_before = sim.position()
    driven_prefix = v.nodes[:v.idx + 2]
    # jam the rest of the planned route ahead (beyond the current segment)
    for e in eng.path_edges(v.nodes[v.idx + 1:]):
        tm.update_edge(e, vehicles=10 * tm.get(e).capacity)
    sim.step(0.0001)                                # triggers check on traffic change
    assert v.route_changes == 1
    assert v.nodes[:v.idx + 2] == driven_prefix     # current segment kept
    assert v.nodes != original
    pos_after = sim.position()
    assert float(haversine_m(*pos_before, *pos_after)) < 0.1
    sim.run_to_completion()
    assert v.finished and v.traversed_edges[-1].endswith("0_4")


def test_insignificant_improvement_does_not_reroute():
    net = make_grid(n=5, seed=1)
    tm = TrafficManager(net)
    eng = RoutingEngine(net, tm, CostParams())
    sim = VehicleSimulator(eng, ReroutePolicy(min_improvement_pct=50, min_improvement_s=600))
    v = sim.start((0, 0), (0, 4), MASAR)
    sim.step(5.0)
    for e in eng.path_edges(v.nodes[v.idx + 1:]):
        tm.update_edge(e, vehicles=tm.get(e).capacity)   # ratio 1.0: some delay, small gain
    sim.run_to_completion()
    assert v.route_changes == 0


def test_rerouting_can_be_disabled():
    net = make_grid(n=5, seed=1)
    tm = TrafficManager(net)
    eng = RoutingEngine(net, tm, CostParams())
    sim = VehicleSimulator(eng, ReroutePolicy(enabled=False))
    v = sim.start((0, 0), (0, 4), MASAR)
    sim.step(5.0)
    for e in eng.path_edges(v.nodes[v.idx + 1:]):
        tm.update_edge(e, vehicles=10 * tm.get(e).capacity)
    sim.run_to_completion()
    assert v.route_changes == 0


def test_closed_segment_ahead_forces_replan_even_for_distance_mode():
    net = make_grid(n=5, seed=1)
    tm = TrafficManager(net)
    eng = RoutingEngine(net, tm, CostParams())
    sim = VehicleSimulator(eng, ReroutePolicy(enabled=False))
    v = sim.start((0, 0), (0, 4), DISTANCE)
    sim.step(1.0)
    ahead = eng.path_edges(v.nodes[v.idx + 1:])
    tm.set_closed(ahead[0], True)
    sim.run_to_completion()
    assert v.route_changes == 1 and ahead[0] not in v.traversed_edges


# --------------------------------------------------------------- experiment
def test_experiment_identical_conditions_and_masar_wins_on_congested_shortest():
    net = make_diamond()
    tm = TrafficManager(net)
    for e in tm.state:
        tm.set_capacity(e, 50)
    tm.set_vehicles("A-B", 60)
    df = run_experiment(net, tm, CostParams(), "A", "D")
    a, b, c = (df[df.key == k].iloc[0] for k in "ABC")
    assert a.distance_m == pytest.approx(1000) and c.distance_m == pytest.approx(1400)
    assert c.final_time_s < a.final_time_s and c.final_time_s < b.final_time_s
    assert c.congestion_exposure_pct < a.congestion_exposure_pct
    assert "faster" in verdict(df)
    assert tm.get("A-B").vehicles == 60          # base traffic untouched


def test_experiment_reports_no_advantage_honestly():
    net = make_diamond()
    tm = TrafficManager(net)
    df = run_experiment(net, tm, CostParams(), "A", "D")
    assert df.final_time_s.nunique() == 1
    assert "No meaningful difference" in verdict(df)


def test_experiment_incident_triggers_masar_reroute_and_is_deterministic():
    net = make_grid(n=6, seed=2)
    tm = TrafficManager(net)
    tm.apply_random_scenario(seed=3, mean_load=0.3, spread=0.1)
    eng = RoutingEngine(net, tm, CostParams())
    masar_route = eng.route((0, 0), (5, 5), MASAR)
    dyn = DynamicTraffic(enabled=True, seed=1, interval_s=20, volatility=0.1, incident_enabled=True,
                         incident_time_s=5, incident_ratio=3.0, incident_edges=masar_route.edges[2:])
    df1 = run_experiment(net, tm, CostParams(), (0, 0), (5, 5), dynamic=dyn)
    df2 = run_experiment(net, tm, CostParams(), (0, 0), (5, 5), dynamic=dyn)
    c = df1[df1.key == "C"].iloc[0]
    assert c.route_changes >= 1
    assert list(df1.final_time_s) == list(df2.final_time_s)
    assert (df1[df1.key != "C"].route_changes == 0).all()
