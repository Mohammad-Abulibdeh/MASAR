"""Many drivers mode, on small synthetic graphs whose answers can be worked out by hand."""
import pandas as pd
import pytest

from core.cost_function import CostParams
from core.many_drivers import LIVE, SHARED, Trip, busiest_roads, run_many_drivers, sample_trips, verdict
from core.routing_engine import FASTEST, RoutingEngine, NoRouteError
from core.traffic_manager import TrafficManager
from tests.conftest import make_diamond, make_grid

PARAMS = CostParams()


def _diamond_trips(net, traffic, n):
    engine = RoutingEngine(net, traffic, PARAMS)
    habit = engine.path_edges(engine.shortest_path("A", "D", FASTEST))
    return [Trip("A", "D", list(habit)) for _ in range(n)]


def _row(table, advice, share):
    return table[(table["advice"] == advice) & (table["share_pct"] == share)].iloc[0]


def _pairs(trips):
    return [(t.origin, t.destination) for t in trips]


def test_trips_are_seeded_and_drivable(grid):
    net, traffic, _ = grid
    first = sample_trips(net, traffic, PARAMS, 20, seed=3)
    assert len(first) == 20
    assert _pairs(first) == _pairs(sample_trips(net, traffic, PARAMS, 20, seed=3))
    assert _pairs(first) != _pairs(sample_trips(net, traffic, PARAMS, 20, seed=4))
    for t in first:
        assert t.origin != t.destination and net.straight_distance_m(t.origin, t.destination) >= 300


def test_bad_inputs_are_refused(diamond):
    net, traffic, _ = diamond
    with pytest.raises(ValueError):
        sample_trips(net, traffic, PARAMS, 0)
    with pytest.raises(ValueError):
        run_many_drivers(net, traffic, PARAMS, [])
    with pytest.raises(ValueError):
        run_many_drivers(net, traffic, PARAMS, _diamond_trips(net, traffic, 2), shares=(0, 120))
    with pytest.raises(ValueError):
        run_many_drivers(net, traffic, PARAMS, _diamond_trips(net, traffic, 2), drivers=0)


def test_no_trips_when_every_road_is_closed(diamond):
    net, traffic, _ = diamond
    for eid in traffic.state:
        traffic.set_closed(eid, True)
    with pytest.raises(NoRouteError):
        sample_trips(net, traffic, PARAMS, 5)


def test_base_traffic_is_never_changed(diamond):
    net, traffic, _ = diamond
    traffic.set_load(list(traffic.state), 0.3)
    before, version = {e: t.vehicles for e, t in traffic.state.items()}, traffic.version
    run_many_drivers(net, traffic, PARAMS, _diamond_trips(net, traffic, 40))
    assert {e: t.vehicles for e, t in traffic.state.items()} == before and traffic.version == version


def test_zero_share_is_the_same_under_both_kinds_of_advice(diamond):
    net, traffic, _ = diamond
    res = run_many_drivers(net, traffic, PARAMS, _diamond_trips(net, traffic, 60))
    assert _row(res.table, SHARED, 0)["avg_time_s"] == pytest.approx(_row(res.table, LIVE, 0)["avg_time_s"])
    assert _row(res.table, SHARED, 0)["users"] == 0


def test_each_driver_is_one_vehicle_spread_along_the_trip(diamond):
    net, traffic, _ = diamond
    res = run_many_drivers(net, traffic, PARAMS, _diamond_trips(net, traffic, 30), shares=(0, 50, 100))
    for loads in res.loads.values():
        assert sum(loads.values()) == pytest.approx(30, abs=2)  # rounding per segment
    assert res.loads[(SHARED, 0)][net.G["A"]["B"]["edge_id"]] == 15


def test_rounding_to_whole_vehicles_keeps_the_total():
    net = make_grid()
    traffic = TrafficManager(net)
    trips = sample_trips(net, traffic, PARAMS, 30, seed=2)
    res = run_many_drivers(net, traffic, PARAMS, trips, drivers=500, shares=(0, 100))
    for loads in res.loads.values():
        assert sum(loads.values()) == pytest.approx(500, abs=1)


def test_a_sampled_trip_stands_for_several_drivers(diamond):
    net, traffic, _ = diamond
    res = run_many_drivers(net, traffic, PARAMS, _diamond_trips(net, traffic, 10), drivers=100, shares=(0, 50))
    assert res.drivers == 100 and _row(res.table, SHARED, 50)["users"] == 50
    assert res.loads[(SHARED, 0)][net.G["A"]["B"]["edge_id"]] == 50
    single = run_many_drivers(net, traffic, PARAMS, _diamond_trips(net, traffic, 100), shares=(0,))
    assert _row(res.table, SHARED, 0)["avg_time_s"] == pytest.approx(_row(single.table, SHARED, 0)["avg_time_s"])
    assert _row(res.table, SHARED, 0)["delay_hours"] == pytest.approx(_row(single.table, SHARED, 0)["delay_hours"])


def test_shared_advice_piles_up_and_live_advice_spreads(diamond):
    """120 drivers, roads of capacity 50. One plan fills the short road to 120 %; seeing others splits them."""
    net, traffic, _ = diamond
    res = run_many_drivers(net, traffic, PARAMS, _diamond_trips(net, traffic, 120), shares=(0, 100))
    short = net.G["A"]["B"]["edge_id"]
    long_way = net.G["A"]["C"]["edge_id"]
    assert res.loads[(SHARED, 100)][short] == 60 and res.loads[(SHARED, 100)][long_way] == 0
    assert res.loads[(LIVE, 100)][short] > 0 and res.loads[(LIVE, 100)][long_way] > 0
    assert _row(res.table, LIVE, 100)["avg_time_s"] < _row(res.table, SHARED, 100)["avg_time_s"]
    assert "fell from" in verdict(res.table)


def test_some_users_help_the_drivers_who_stay_on_the_jam(diamond):
    net, traffic, _ = diamond
    res = run_many_drivers(net, traffic, PARAMS, _diamond_trips(net, traffic, 120), shares=(0, 50))
    row = _row(res.table, LIVE, 50)
    assert row["users"] == 60
    assert row["avg_others_s"] < _row(res.table, LIVE, 0)["avg_others_s"]


def test_closed_road_is_never_advised(diamond):
    net, traffic, _ = diamond
    short = net.G["A"]["B"]["edge_id"]
    traffic.set_closed(short, True)
    res = run_many_drivers(net, traffic, PARAMS, _diamond_trips(net, traffic, 20))
    assert all(loads[short] == 0 for loads in res.loads.values())


def test_verdict_admits_when_there_is_no_gain(diamond):
    net, traffic, _ = diamond
    for eid in traffic.state:
        traffic.set_capacity(eid, 100000)
    res = run_many_drivers(net, traffic, PARAMS, _diamond_trips(net, traffic, 5))
    assert verdict(res.table).startswith("No meaningful gain")


def test_verdict_warns_when_one_shared_plan_makes_things_worse():
    table = pd.DataFrame([
        {"advice": SHARED, "share_pct": 0, "avg_time_s": 300.0}, {"advice": SHARED, "share_pct": 100, "avg_time_s": 400.0},
        {"advice": LIVE, "share_pct": 0, "avg_time_s": 300.0}, {"advice": LIVE, "share_pct": 100, "avg_time_s": 240.0}])
    text = verdict(table)
    assert "300 s to 240 s" in text and "worse than having no MASAR users" in text


def test_grid_run_is_deterministic():
    net = make_grid()
    traffic = TrafficManager(net)
    trips = sample_trips(net, traffic, PARAMS, 40, seed=1)
    a, b = (run_many_drivers(net, traffic, PARAMS, trips, shares=(0, 50)) for _ in range(2))
    pd.testing.assert_frame_equal(a.table, b.table)
    assert a.drivers == 40


def test_busiest_roads_lists_named_streets_by_vehicles_added():
    net = make_diamond()
    traffic = TrafficManager(net)
    res = run_many_drivers(net, traffic, PARAMS, _diamond_trips(net, traffic, 10), shares=(0,))
    top = busiest_roads(net, traffic, res.loads[(SHARED, 0)])
    assert top.iloc[0]["Street"] == "Short Street" and top.iloc[0]["Vehicles added"] == 5
