"""
MASAR edge cost function.

Every road segment (directed edge) gets a cost in *seconds* that the routing
engine minimises. The model is deliberately transparent:

    congestion_ratio  = vehicles / max(capacity, 1)
    congestion_factor = min(1 + alpha * ratio ** beta, max_factor)
    free_flow_time    = length_m / free_flow_speed_mps
    estimated_speed   = max(free_flow_speed / congestion_factor, min_speed)
    edge_cost         = length_m / estimated_speed
                      = free_flow_time * congestion_factor   (unless clipped by min_speed)

The congestion factor has the same shape as the classic BPR (Bureau of Public
Roads) volume-delay function. Here, though, the "volume" is the number of
vehicles currently on the segment (an occupancy), and the defaults
(alpha=2, beta=4) are stronger than the textbook BPR values (0.15, 4) so that
a full segment is clearly penalised. All parameters are configurable from
the dashboard and are *modelling assumptions*, not calibrated measurements.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, asdict


@dataclass
class CostParams:
    alpha: float = 2.0          # strength of congestion penalty
    beta: float = 4.0           # how sharply the penalty grows near/above capacity
    max_factor: float = 20.0    # cap on the slowdown multiplier
    min_speed_kph: float = 3.0  # vehicles never estimated slower than walking pace

    def validated(self) -> "CostParams":
        return CostParams(
            alpha=max(0.0, _finite(self.alpha, 2.0)),
            beta=max(0.0, _finite(self.beta, 4.0)),
            max_factor=max(1.0, _finite(self.max_factor, 20.0)),
            min_speed_kph=max(0.1, _finite(self.min_speed_kph, 3.0)),
        )

    def to_dict(self) -> dict:
        return asdict(self)


DEFAULT_PARAMS = CostParams()

# Congestion level thresholds (ratio of vehicles to capacity)
LOW_MAX = 0.5
MODERATE_MAX = 0.8


def _finite(x, default: float) -> float:
    try:
        x = float(x)
    except (TypeError, ValueError):
        return default
    if math.isnan(x) or math.isinf(x):
        return default
    return x


def sanitize_count(vehicles) -> float:
    """Invalid, negative or non-numeric vehicle counts are treated as 0."""
    v = _finite(vehicles, 0.0)
    return max(0.0, v)


def congestion_ratio(vehicles, capacity) -> float:
    """vehicles / max(capacity, 1). Never divides by zero, never negative."""
    v = sanitize_count(vehicles)
    c = max(_finite(capacity, 1.0), 1.0)
    return v / c


def congestion_factor(ratio: float, params: CostParams = DEFAULT_PARAMS) -> float:
    p = params.validated()
    r = max(0.0, _finite(ratio, 0.0))
    return min(1.0 + p.alpha * (r ** p.beta), p.max_factor)


def kph_to_mps(kph: float) -> float:
    return _finite(kph, 0.0) / 3.6


def free_flow_time(length_m, speed_kph, params: CostParams = DEFAULT_PARAMS) -> float:
    """Travel time (s) on an empty road."""
    p = params.validated()
    length = max(0.0, _finite(length_m, 0.0))
    speed = max(_finite(speed_kph, p.min_speed_kph), p.min_speed_kph)
    return length / kph_to_mps(speed)


def estimated_speed_kph(speed_kph, vehicles, capacity, params: CostParams = DEFAULT_PARAMS) -> float:
    p = params.validated()
    free = max(_finite(speed_kph, p.min_speed_kph), p.min_speed_kph)
    factor = congestion_factor(congestion_ratio(vehicles, capacity), p)
    return max(free / factor, p.min_speed_kph)


def edge_travel_time(length_m, speed_kph, vehicles, capacity,
                     params: CostParams = DEFAULT_PARAMS) -> float:
    """Congestion-aware travel time (s): the MASAR edge cost."""
    length = max(0.0, _finite(length_m, 0.0))
    speed = estimated_speed_kph(speed_kph, vehicles, capacity, params)
    return length / kph_to_mps(speed)


def congestion_level(ratio: float) -> str:
    r = max(0.0, _finite(ratio, 0.0))
    if r < LOW_MAX:
        return "low"
    if r < MODERATE_MAX:
        return "moderate"
    return "high"


LEVEL_COLORS = {"low": "#22c55e", "moderate": "#eab308", "high": "#ef4444"}

# Four display bands used by the map and dashboard. "high" above is split at full capacity.
BANDS = ("low", "moderate", "heavy", "very_heavy")
BAND_LABELS = {"low": "Low", "moderate": "Moderate", "heavy": "Heavy", "very_heavy": "Very heavy"}
HEAVY_MAX = 1.0


def traffic_band(ratio: float) -> str:
    """low < 50 % <= moderate < 80 % <= heavy < 100 % <= very_heavy (of capacity)."""
    level = congestion_level(ratio)
    if level != "high":
        return level
    return "heavy" if max(0.0, _finite(ratio, 0.0)) < HEAVY_MAX else "very_heavy"
