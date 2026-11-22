"""
Experiment mode: compare three routing strategies under IDENTICAL conditions.

  A. Shortest distance            - plans once, never re-routes
  B. Fastest, free-flow           - plans once on free-flow time, never re-routes
  C. MASAR traffic-aware          - plans on congested time, re-routes per policy

Each strategy gets its own copy of the same starting traffic state and the
same origin/destination. If dynamic traffic is enabled, every copy evolves
with the SAME random seed at the SAME simulated times, and any scripted
incident hits the SAME segments at the SAME time - traffic evolution does not
depend on which strategy is driving, so the comparison is fair.

All outputs are SIMULATED ESTIMATES produced by MASAR's own traffic model and
user-defined/simulated inputs. They are not measurements of real traffic.
"""
from __future__ import annotations

from dataclasses import dataclass, field, replace

import numpy as np
import pandas as pd

from .cost_function import CostParams
from .graph_manager import RoadNetwork
from .i18n import tx
from .routing_engine import DISTANCE, FASTEST, MASAR, RoutingEngine
from .traffic_manager import TrafficManager
from .vehicle_simulator import ReroutePolicy, VehicleSimulator

STRATEGIES = [
    ("A", DISTANCE, False, "A. Shortest distance"),
    ("B", FASTEST, False, "B. Fastest (no congestion awareness)"),
    ("C", MASAR, True, "C. MASAR traffic-aware"),
]


@dataclass
class DynamicTraffic:
    enabled: bool = False
    seed: int = 7
    interval_s: float = 30.0
    volatility: float = 0.15
    incident_enabled: bool = False
    incident_time_s: float = 60.0
    incident_ratio: float = 1.5           # incident sets vehicles = ratio x capacity
    incident_edges: list = field(default_factory=list)


def run_experiment(network: RoadNetwork, base_traffic: TrafficManager, params: CostParams,
                   origin, destination, policy: ReroutePolicy | None = None,
                   dynamic: DynamicTraffic | None = None, dt: float = 1.0,
                   max_time_s: float = 4 * 3600) -> pd.DataFrame:
    policy = policy or ReroutePolicy()
    dynamic = dynamic or DynamicTraffic()
    rows = []
    for key, mode, reroute, label in STRATEGIES:
        traffic = base_traffic.clone()
        engine = RoutingEngine(network, traffic, params)
        sim = VehicleSimulator(engine, replace(policy, enabled=reroute))
        v = sim.start(origin, destination, mode)
        rng = np.random.default_rng(dynamic.seed)
        next_fluct = dynamic.interval_s
        incident_done = False
        while not v.finished and v.elapsed_s < max_time_s:
            t = v.elapsed_s
            if dynamic.enabled and dynamic.interval_s > 0:
                while t >= next_fluct:
                    traffic.fluctuate(rng, dynamic.volatility)
                    next_fluct += dynamic.interval_s
            if dynamic.incident_enabled and not incident_done and t >= dynamic.incident_time_s:
                for eid in dynamic.incident_edges:
                    if eid in traffic.state:
                        cap = traffic.state[eid].capacity
                        traffic.set_vehicles(eid, int(round(dynamic.incident_ratio * max(cap, 1))), "simulated")
                incident_done = True
            sim.step(dt)
        rows.append({
            "key": key,
            "strategy": label,
            "mode": mode,
            "arrived": v.finished,
            "distance_m": v.travelled_m,
            "initial_est_time_s": v.initial_est_time_s,
            "final_time_s": v.elapsed_s,
            "congestion_exposure_pct": 100.0 * v.exposure_ratio_m / v.travelled_m if v.travelled_m else 0.0,
            "time_in_heavy_congestion_s": v.high_congestion_s,
            "route_changes": v.route_changes,
            "segments_driven": len(v.traversed_edges),
            "events": v.events,
        })
    return pd.DataFrame(rows)


def verdict(df: pd.DataFrame) -> str:
    """Plain-language, data-driven conclusion. Never claims an improvement the data does not show."""
    c = df[df["key"] == "C"].iloc[0]
    others = df[df["key"] != "C"]
    best_other = others.loc[others["final_time_s"].idxmin()]
    diff = best_other["final_time_s"] - c["final_time_s"]
    if not c["arrived"]:
        return tx("The MASAR vehicle did not reach the destination within the time limit.")
    if abs(diff) < 1.0:
        return tx("No meaningful difference: MASAR's simulated travel time ({time} s) equals the "
                  "best baseline ({name}). With these inputs, traffic-awareness gave no advantage.",
                  time=f"{c['final_time_s']:.0f}", name=tx(best_other["strategy"]))
    pct = 100 * diff / best_other["final_time_s"]
    if diff > 0:
        return tx("In this simulated scenario MASAR finished in {time} s, "
                  "{diff} s ({pct}%) faster than the best baseline ({name}). "
                  "This is a model estimate under simulated traffic, not a real-world measurement.",
                  time=f"{c['final_time_s']:.0f}", diff=f"{diff:.0f}", pct=f"{pct:.1f}", name=tx(best_other["strategy"]))
    return tx("In this simulated scenario MASAR was {diff} s ({pct}%) SLOWER than "
              "{name}. Traffic changed after the decision was made, so the choice that "
              "looked best at the time did not pay off. This is an honest result of the simulation.",
              diff=f"{-diff:.0f}", pct=f"{-pct:.1f}", name=tx(best_other["strategy"]))
