"""
Many drivers mode: what happens to the whole city when a share of drivers use MASAR?

A seeded set of trips (random origin/destination pairs) is added on top of the
current traffic inputs. Every share of MASAR users is tested on the SAME trips:

  habit drivers : take the free-flow fastest path, whatever the traffic is doing
  MASAR users   : take the congestion-aware path, with one of two kinds of advice
      shared    : everyone is advised from the traffic as it was before these drivers,
                  so users with similar trips can all pile onto the same "empty" road
      live      : each user is advised in turn and sees the drivers already assigned,
                  so later users spread away from roads that earlier ones filled

All the drivers are on the road at the same time. A driver is one vehicle in one
place, so each trip adds to a segment the share of its trip spent there (a segment
taking 10 % of the trip gains 0.1 vehicles). Finding a path for thousands of drivers
would be slow, so a sample of trips is searched and each stands for several drivers.
Every driver's time is then scored under the final traffic. This is a static
assignment: nobody re-routes, and queues do not spill between segments.

All outputs are SIMULATED ESTIMATES from MASAR's own traffic model and
user-defined/simulated inputs. They are not measurements of real traffic.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import numpy as np
import pandas as pd

from . import cost_function as cf
from .cost_function import CostParams
from .graph_manager import RoadNetwork
from .i18n import tx
from .routing_engine import FASTEST, MASAR, NoRouteError, RoutingEngine
from .traffic_manager import TrafficManager

SHARED, LIVE = "shared", "live"
ADVICE_LABELS = {SHARED: "Same advice for everyone", LIVE: "Advice that sees other drivers"}
DEFAULT_SHARES = (0, 25, 50, 75, 100)
MIN_TRIP_M = 300.0
MAX_SAMPLED_TRIPS = 200
MEANINGFUL_PCT = 1.0


@dataclass
class Trip:
    origin: object
    destination: object
    habit_edges: list[str]


@dataclass
class DriversResult:
    table: pd.DataFrame
    loads: dict                 # (advice, share_pct) -> {edge_id: whole vehicles with these drivers added}
    drivers: int


def sample_trips(network: RoadNetwork, traffic: TrafficManager, params: CostParams, count: int,
                 seed: int = 7, min_distance_m: float = MIN_TRIP_M) -> list[Trip]:
    """Random drivable trips. May return fewer than asked for if few pairs are connected."""
    if count < 1:
        raise ValueError("The number of trips must be at least 1")
    engine = RoutingEngine(network, traffic, params)
    nodes = sorted(network.G.nodes, key=str)
    if len(nodes) < 2:
        raise NoRouteError(tx("The road network is too small for trips."))
    rng = np.random.default_rng(seed)
    trips: list[Trip] = []
    for _ in range(count * 20):
        if len(trips) == count:
            break
        a, b = rng.choice(len(nodes), size=2, replace=False)
        origin, destination = nodes[int(a)], nodes[int(b)]
        if network.straight_distance_m(origin, destination) < min_distance_m:
            continue
        try:
            path = engine.shortest_path(origin, destination, FASTEST)
        except NoRouteError:
            continue
        trips.append(Trip(origin, destination, engine.path_edges(path)))
    if not trips:
        raise NoRouteError(tx("No drivable trips could be found. Too many roads may be closed."))
    return trips


def _add(traffic: TrafficManager, params: CostParams, edges: list[str], drivers: float) -> None:
    free = [traffic.free_time(eid, params) for eid in edges]
    total = max(sum(free), 1e-9)
    for eid, seconds in zip(edges, free):
        traffic.state[eid].vehicles += drivers * seconds / total


def _whole_vehicles(traffic: TrafficManager) -> dict[str, int]:
    """Round to whole vehicles, carrying the remainder along so the total is kept. Untouched roads stay as they are."""
    counts, carry = {}, 0.0
    for eid, t in traffic.state.items():
        if abs(t.vehicles - round(t.vehicles)) < 1e-9:
            counts[eid] = int(round(t.vehicles))
            continue
        exact = t.vehicles + carry
        counts[eid] = max(int(round(exact)), 0)
        carry = exact - counts[eid]
    return counts


def _score(network: RoadNetwork, traffic: TrafficManager, params: CostParams, advice: str, share: float,
           paths: list[list[str]], user_trips: int, per_trip: float) -> dict:
    times: dict[str, float] = {}

    def trip_time(edges: list[str]) -> float:
        total = 0.0
        for eid in edges:
            if eid not in times:
                t = traffic.state[eid]
                times[eid] = cf.edge_travel_time(network.edge_data(eid)["length"], t.free_speed_kph,
                                                 t.vehicles, t.capacity, params)
            total += times[eid]
        return total

    each = [trip_time(p) for p in paths]
    free = sum(traffic.free_time(eid, params) for p in paths for eid in p)
    open_ratios = [cf.congestion_ratio(t.vehicles, t.capacity) for t in traffic.state.values() if not t.closed]
    return {
        "advice": advice,
        "share_pct": share,
        "users": int(round(user_trips * per_trip)),
        "avg_time_s": float(np.mean(each)),
        "avg_users_s": float(np.mean(each[:user_trips])) if user_trips else None,
        "avg_others_s": float(np.mean(each[user_trips:])) if user_trips < len(each) else None,
        "avg_distance_m": float(np.mean([sum(network.edge_data(e)["length"] for e in p) for p in paths])),
        "delay_hours": (sum(each) - free) * per_trip / 3600.0,
        "congested_roads": sum(r >= cf.MODERATE_MAX for r in open_ratios),
        "jammed_roads": sum(r >= cf.HEAVY_MAX for r in open_ratios),
    }


def run_many_drivers(network: RoadNetwork, base_traffic: TrafficManager, params: CostParams, trips: list[Trip],
                     drivers: int | None = None, shares=DEFAULT_SHARES,
                     progress: Callable[[float], None] | None = None) -> DriversResult:
    """Test each share of MASAR users on the same trips. The first trips in the list are the users,
    so a bigger share only adds users. The base traffic is never changed."""
    if not trips:
        raise ValueError("At least one trip is needed")
    drivers = len(trips) if drivers is None else drivers
    if drivers < 1:
        raise ValueError("The number of drivers must be at least 1")
    shares = sorted(set(shares))
    if any(s < 0 or s > 100 for s in shares):
        raise ValueError("A share of drivers must be between 0 and 100")
    per_trip = drivers / len(trips)
    base_engine = RoutingEngine(network, base_traffic, params)
    advised = None  # the shared advice, found once because it comes from the same traffic every time
    rows, loads = [], {}
    runs = [(a, s) for a in (SHARED, LIVE) for s in shares]
    for n, (advice, share) in enumerate(runs):
        users = int(round(len(trips) * share / 100))  # in sampled trips
        traffic = base_traffic.clone()
        for trip in trips[users:]:
            _add(traffic, params, trip.habit_edges, per_trip)
        paths = []
        if advice == SHARED:
            if advised is None:
                advised = [base_engine.path_edges(base_engine.shortest_path(t.origin, t.destination, MASAR))
                           for t in trips]
            paths = advised[:users]
            for edges in paths:
                _add(traffic, params, edges, per_trip)
        else:
            engine = RoutingEngine(network, traffic, params)
            for trip in trips[:users]:
                edges = engine.path_edges(engine.shortest_path(trip.origin, trip.destination, MASAR))
                _add(traffic, params, edges, per_trip)
                paths.append(edges)
        paths = paths + [t.habit_edges for t in trips[users:]]
        rows.append(_score(network, traffic, params, advice, share, paths, users, per_trip))
        loads[(advice, share)] = _whole_vehicles(traffic)
        if progress:
            progress((n + 1) / len(runs))
    return DriversResult(pd.DataFrame(rows), loads, drivers)


def busiest_roads(network: RoadNetwork, base_traffic: TrafficManager, loads: dict, limit: int = 5) -> pd.DataFrame:
    """The named streets that gained the most vehicles, by their busiest segment."""
    best: dict[str, tuple] = {}
    for eid, vehicles in loads.items():
        d = network.edge_data(eid)
        t = base_traffic.state[eid]
        added = vehicles - t.vehicles
        name = network.display_name(d)
        if added > 0 and d.get("name") and (name not in best or added > best[name][0]):
            best[name] = (added, 100.0 * cf.congestion_ratio(vehicles, t.capacity))
    top = sorted(best.items(), key=lambda kv: kv[1][0], reverse=True)[:limit]
    return pd.DataFrame([{tx("Street"): n, tx("Vehicles added"): a, tx("Load"): f"{r:.0f}%"} for n, (a, r) in top],
                        columns=[tx("Street"), tx("Vehicles added"), tx("Load")])


def verdict(table: pd.DataFrame) -> str:
    """Plain-language conclusion. Never claims an improvement the data does not show."""
    note = " " + tx("These are model estimates, not real-world measurements.")
    base = table[table["share_pct"] == table["share_pct"].min()].iloc[0]
    if base["share_pct"] != 0 or table["share_pct"].nunique() < 2:
        return tx("Test 0% and at least one other share to compare.") + note

    def best_of(advice):
        rows = table[table["advice"] == advice]
        return rows.loc[rows["avg_time_s"].idxmin()]

    def gain(row):
        return 100.0 * (base["avg_time_s"] - row["avg_time_s"]) / max(base["avg_time_s"], 1e-9)

    live, shared = best_of(LIVE), best_of(SHARED)
    if gain(live) < MEANINGFUL_PCT and gain(shared) < MEANINGFUL_PCT:
        return tx("No meaningful gain: with these inputs, MASAR users did not lower the average trip by at least {pct}%.",
                  pct=f"{MEANINGFUL_PCT:.0f}") + note
    top = live if gain(live) >= gain(shared) else shared
    advice = tx(ADVICE_LABELS[top["advice"]])
    text = tx("The average trip fell from {before} s to {after} s ({pct}% less) with {share}% of drivers on MASAR, using {advice}.",
              before=f"{base['avg_time_s']:.0f}", after=f"{top['avg_time_s']:.0f}", pct=f"{gain(top):.0f}",
              share=f"{top['share_pct']:.0f}", advice=advice.lower())
    rows = table[table["advice"] == SHARED]
    most = rows.loc[rows["share_pct"].idxmax()]
    if most["avg_time_s"] > base["avg_time_s"] * (1 + MEANINGFUL_PCT / 100):
        text += " " + tx("Be careful with one shared plan: at {share}% users it made the average trip {time} s, "
                         "worse than having no MASAR users at all.", share=f"{most['share_pct']:.0f}", time=f"{most['avg_time_s']:.0f}")
    elif most["avg_time_s"] > shared["avg_time_s"] * (1 + MEANINGFUL_PCT / 100):
        text += " " + tx("With one shared plan the gain shrinks at high use: {time} s at {share}% users, but {most_time} s at {most_share}%.",
                         time=f"{shared['avg_time_s']:.0f}", share=f"{shared['share_pct']:.0f}",
                         most_time=f"{most['avg_time_s']:.0f}", most_share=f"{most['share_pct']:.0f}")
    return text + note
