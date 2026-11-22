import math

import pytest

from core import cost_function as cf


def test_congestion_ratio_basic():
    assert cf.congestion_ratio(45, 60) == pytest.approx(0.75)
    assert cf.congestion_ratio(0, 60) == 0.0


def test_zero_capacity_never_divides_by_zero():
    assert cf.congestion_ratio(10, 0) == 10.0          # max(capacity, 1)
    assert cf.congestion_ratio(10, -5) == 10.0
    t = cf.edge_travel_time(100, 50, 10, 0)
    assert math.isfinite(t) and t > 0


@pytest.mark.parametrize("bad", [-5, float("nan"), float("inf"), None, "abc"])
def test_invalid_vehicle_counts_are_sanitised(bad):
    r = cf.congestion_ratio(bad, 50)
    assert r == 0.0 or (bad == float("inf") and r == 0.0)


def test_congestion_factor_monotonic_and_capped():
    p = cf.CostParams(alpha=2, beta=4, max_factor=20)
    values = [cf.congestion_factor(r, p) for r in (0, 0.25, 0.5, 0.8, 1.0, 1.5, 3.0, 10.0)]
    assert values[0] == 1.0
    assert all(b >= a for a, b in zip(values, values[1:]))
    assert values[-1] == 20.0
    assert cf.congestion_factor(1.0, p) == pytest.approx(3.0)   # 1 + 2 * 1^4


def test_free_flow_time():
    # 1000 m at 36 km/h (10 m/s) = 100 s
    assert cf.free_flow_time(1000, 36) == pytest.approx(100.0)


def test_edge_cost_equals_free_time_times_factor():
    p = cf.CostParams()
    length, speed, veh, cap = 500, 50, 45, 60
    expected = cf.free_flow_time(length, speed, p) * cf.congestion_factor(veh / cap, p)
    assert cf.edge_travel_time(length, speed, veh, cap, p) == pytest.approx(expected)


def test_empty_road_cost_is_free_flow_time():
    assert cf.edge_travel_time(500, 50, 0, 60) == pytest.approx(cf.free_flow_time(500, 50))


def test_min_speed_floor():
    p = cf.CostParams(alpha=1000, beta=1, max_factor=1e9, min_speed_kph=5)
    assert cf.estimated_speed_kph(50, 1000, 10, p) == pytest.approx(5.0)


def test_cost_increases_with_vehicles():
    times = [cf.edge_travel_time(400, 40, v, 40) for v in range(0, 80, 5)]
    assert all(b >= a for a, b in zip(times, times[1:]))
    assert times[-1] > times[0]


def test_levels():
    assert cf.congestion_level(0.2) == "low"
    assert cf.congestion_level(0.6) == "moderate"
    assert cf.congestion_level(0.9) == "high"


def test_invalid_params_are_validated():
    p = cf.CostParams(alpha=-1, beta=float("nan"), max_factor=0, min_speed_kph=-3).validated()
    assert p.alpha == 0 and p.beta == 4.0 and p.max_factor == 1.0 and p.min_speed_kph > 0
