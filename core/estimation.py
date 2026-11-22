"""
Plain-language trip estimates derived from routes scored by the routing engine.

Every figure comes from the cost model in cost_function.py applied to the current
simulated / user-defined vehicle counts. They are model estimates, not predictions
of real-world travel. Traffic signals, turn delays and queues are not modelled.
"""
from __future__ import annotations

from dataclasses import dataclass

from . import cost_function as cf
from .i18n import tx
from .routing_engine import Route


@dataclass
class TripEstimate:
    time_s: float
    distance_m: float
    free_time_s: float
    delay_s: float           # extra time caused by traffic
    density_pct: float       # length-weighted vehicles / capacity
    band: str
    efficiency_pct: float    # empty-road time / estimated time; 100 % = no traffic delay
    saved_s: float           # against the slowest other option; 0 if there is none
    heavy_m: float           # metres on segments at or above 80 % of capacity
    vehicles: int


def estimate(route: Route, others: list[Route] | None = None) -> TripEstimate:
    slowest = max((r.est_time_s for r in others or []), default=route.est_time_s)
    return TripEstimate(
        time_s=route.est_time_s,
        distance_m=route.distance_m,
        free_time_s=route.free_time_s,
        delay_s=max(route.est_time_s - route.free_time_s, 0.0),
        density_pct=100.0 * route.mean_congestion,
        band=cf.traffic_band(route.mean_congestion),
        efficiency_pct=100.0 * route.free_time_s / route.est_time_s if route.est_time_s > 0 else 100.0,
        saved_s=max(slowest - route.est_time_s, 0.0),
        heavy_m=route.high_congestion_m,
        vehicles=route.vehicles_total,
    )


def fmt_duration(seconds: float) -> str:
    seconds = max(0, int(round(seconds)))
    if seconds < 60:
        return tx("{s} s", s=seconds)
    m, s = divmod(seconds, 60)
    return tx("{m} min {s} s", m=m, s=s) if s else tx("{m} min", m=m)


def explain(best: Route, others: list[Route]) -> str:
    """Why the first option is recommended, stated only as far as the numbers support it."""
    if not best.edges:
        return tx("A and B are the same place, so there is nothing to drive.")
    if not others:
        if best.congestion_cost_s < 1:
            return tx("This is the only sensible route here, and the roads on it are clear.")
        return tx("This is the only sensible route here. Traffic adds about {time} to it.",
                  time=fmt_duration(best.congestion_cost_s))
    rival = min(others, key=lambda r: r.est_time_s)
    saving = rival.est_time_s - best.est_time_s
    if saving < 5:
        return tx("It is a close call: the next best route is only {time} slower. "
                  "Try jamming this route and see what changes.", time=fmt_duration(saving))
    text = tx("Estimated {time} faster than the next best route", time=fmt_duration(saving))
    longer = best.distance_m - rival.distance_m
    avoided = rival.high_congestion_m - best.high_congestion_m
    if longer > 10 and avoided > 10:
        text += tx(". It is {m} m longer, but it skips {heavy} m of heavy traffic", m=f"{longer:.0f}", heavy=f"{avoided:.0f}")
    elif longer > 10:
        text += tx(". It is {m} m longer, but its roads move faster", m=f"{longer:.0f}")
    elif avoided > 10:
        text += tx(", and it skips {heavy} m of heavy traffic", heavy=f"{avoided:.0f}")
    elif longer < -10:
        text += tx(", and it is {m} m shorter", m=f"{-longer:.0f}")
    return text + "."
