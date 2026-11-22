import json
import math

import pytest

from core.cost_function import CostParams
from core.routing_engine import MASAR, RoutingEngine
from core.traffic_manager import CapacityParams, TrafficManager
from tests.conftest import make_diamond


@pytest.fixture
def tm():
    return TrafficManager(make_diamond())


def test_defaults_are_labelled_as_no_data(tm):
    t = tm.get("A-B")
    assert t.vehicles == 0 and t.vehicles_source == "none"
    assert t.capacity_source == "estimated"


def test_capacity_estimate():
    cp = CapacityParams(vehicle_spacing_m=20)
    assert cp.estimate(500, 1) == 25
    assert cp.estimate(500, 2) == 50
    assert cp.estimate(0, 1) == 1          # never zero


@pytest.mark.parametrize("bad", [-1, -100, 2.5, "ten", None, float("nan"), float("inf"), 10**9])
def test_invalid_vehicle_counts_rejected(tm, bad):
    before = tm.get("A-B").vehicles
    with pytest.raises(ValueError):
        tm.set_vehicles("A-B", bad)
    assert tm.get("A-B").vehicles == before


def test_numeric_strings_accepted(tm):
    tm.set_vehicles("A-B", "45")
    assert tm.get("A-B").vehicles == 45 and tm.get("A-B").vehicles_source == "user"


def test_unknown_edge(tm):
    with pytest.raises(KeyError):
        tm.set_vehicles("nope", 3)


def test_zero_capacity_road_is_finite_and_heavily_penalised(tm):
    p = CostParams()
    tm.set_capacity("A-B", 0)
    tm.set_vehicles("A-B", 5)
    t = tm.travel_time("A-B", p)
    assert math.isfinite(t)
    assert t > tm.free_time("A-B", p) * 5


def test_update_edge_is_atomic(tm):
    tm.set_vehicles("A-B", 10)
    with pytest.raises(ValueError):
        tm.update_edge("A-B", vehicles=20, free_speed_kph=-4)   # speed invalid -> nothing applied
    assert tm.get("A-B").vehicles == 10


def test_version_increments_on_change(tm):
    v = tm.version
    tm.set_vehicles("A-B", 3)
    tm.set_capacity("A-B", 30)
    tm.set_free_speed("A-B", 40)
    assert tm.version == v + 3


def test_changes_immediately_affect_metrics(tm):
    p = CostParams()
    m0 = tm.metrics("A-B", p)
    tm.update_edge("A-B", vehicles=45, capacity=60)
    m1 = tm.metrics("A-B", p)
    assert m1["congestion_pct"] == pytest.approx(75.0)
    assert m1["avg_speed_kph"] < m0["avg_speed_kph"]
    assert m1["travel_time_s"] > m0["travel_time_s"]


def test_reset(tm):
    tm.update_edge("A-B", vehicles=45, capacity=60, free_speed_kph=30, closed=True)
    tm.reset_edge("A-B")
    t = tm.get("A-B")
    assert (t.vehicles, t.closed, t.capacity_source) == (0, False, "estimated")
    tm.set_vehicles("C-D", 9)
    tm.reset_vehicles()
    assert tm.summary()["total_vehicles"] == 0


def test_scenario_roundtrip(tm, tmp_path):
    tm.update_edge("A-B", vehicles=45, capacity=60)
    tm.update_edge("C-D", vehicles=35, capacity=40, closed=True)
    path = tmp_path / "s.json"
    tm.save_scenario(path, "test")
    data = json.loads(path.read_text(encoding="utf-8"))
    assert set(data["edges"]) == {"A-B", "C-D"}       # only changed edges stored
    other = TrafficManager(make_diamond())
    applied, skipped = other.load_scenario_file(path)
    assert (applied, skipped) == (2, 0)
    assert other.get("A-B").vehicles == 45 and other.get("C-D").closed
    assert other.get("A-B").vehicles_source == "scenario"


def test_scenario_with_unknown_edges_is_skipped(tm):
    data = tm.to_scenario("x")
    data["edges"]["999-888"] = {"vehicles": 3}
    applied, skipped = tm.load_scenario(data)
    assert skipped == 1


def test_random_scenario_is_reproducible_and_labelled():
    a, b = TrafficManager(make_diamond()), TrafficManager(make_diamond())
    a.apply_random_scenario(seed=5)
    b.apply_random_scenario(seed=5)
    assert {k: v.vehicles for k, v in a.state.items()} == {k: v.vehicles for k, v in b.state.items()}
    assert all(t.vehicles_source == "simulated" for t in a.state.values())


def test_clone_is_independent(tm):
    c = tm.clone()
    c.set_vehicles("A-B", 50)
    assert tm.get("A-B").vehicles == 0


def test_closed_road_is_avoided():
    net = make_diamond()
    tm = TrafficManager(net)
    eng = RoutingEngine(net, tm, CostParams())
    assert eng.shortest_path("A", "D", MASAR) == ["A", "B", "D"]
    tm.set_closed("A-B", True)
    assert eng.shortest_path("A", "D", MASAR) == ["A", "C", "D"]
