"""
Simulated vehicle that drives along the directed road graph.

Movement
  The vehicle sits on one directed edge at a time with an `offset_m` from the
  edge's start. Each `step(dt)` advances it by (current congested speed x dt),
  carrying any left-over time onto the next edges of its planned path. Its map
  position is interpolated along the real edge geometry (not straight lines
  between origin and destination). It can only ever move onto an edge that
  leaves the node it has just reached, so road direction and connectivity are
  always respected.

Re-routing (MASAR vehicles only, configurable via ReroutePolicy)
  A re-route check runs when (a) traffic inputs changed since the last check,
  or (b) `check_interval_s` of simulated time has passed. The vehicle is
  committed to the segment it is currently on (it cannot U-turn mid-block),
  so the new route is searched from the END of the current segment. The
  remaining plan is replaced only if the new one is faster by at least
  max(min_improvement_s, min_improvement_pct % of the remaining time). This
  hysteresis prevents flip-flopping for insignificant gains. The vehicle is
  never moved ("teleported"): only the not-yet-driven part of the plan changes.

  Any vehicle (whatever its mode) is forced to re-plan if a segment ahead of
  it becomes CLOSED, using its own strategy's criterion.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from . import cost_function as cf
from .graph_manager import haversine_m
from .routing_engine import MASAR, NoRouteError, RoutingEngine


@dataclass
class ReroutePolicy:
    enabled: bool = True
    min_improvement_pct: float = 10.0
    min_improvement_s: float = 10.0
    check_interval_s: float = 15.0
    check_on_traffic_change: bool = True


def _interpolate(coords, fraction: float) -> tuple[float, float]:
    if len(coords) == 1:
        return coords[0]
    fraction = min(max(fraction, 0.0), 1.0)
    seg = [float(haversine_m(a[0], a[1], b[0], b[1])) for a, b in zip(coords[:-1], coords[1:])]
    total = sum(seg)
    if total <= 0:
        return coords[0]
    target = fraction * total
    acc = 0.0
    for (a, b), s in zip(zip(coords[:-1], coords[1:]), seg):
        if acc + s >= target:
            f = (target - acc) / s if s > 0 else 0.0
            return a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])
        acc += s
    return coords[-1]


@dataclass
class Vehicle:
    mode: str
    origin: object
    destination: object
    nodes: list
    idx: int = 0
    offset_m: float = 0.0
    elapsed_s: float = 0.0
    travelled_m: float = 0.0
    finished: bool = False
    route_changes: int = 0
    exposure_ratio_m: float = 0.0      # sum(ratio * metres) at the time each metre was driven
    high_congestion_s: float = 0.0     # seconds spent on segments >= 80 % capacity
    initial_est_time_s: float = 0.0
    initial_nodes: list = field(default_factory=list)
    traversed_edges: list = field(default_factory=list)
    trail: list = field(default_factory=list)
    events: list = field(default_factory=list)


class VehicleSimulator:
    def __init__(self, engine: RoutingEngine, policy: ReroutePolicy | None = None):
        self.engine = engine
        self.policy = policy or ReroutePolicy()
        self.vehicle: Vehicle | None = None
        self._last_version = None
        self._last_check = 0.0

    # ----------------------------------------------------------------- setup
    def start(self, origin, destination, mode: str = MASAR, nodes: list | None = None) -> Vehicle:
        nodes = nodes or self.engine.shortest_path(origin, destination, mode)
        if len(nodes) < 2:
            raise NoRouteError("Origin and destination are the same intersection")
        est = self.engine.evaluate(nodes).est_time_s
        v = Vehicle(mode=mode, origin=origin, destination=destination, nodes=list(nodes),
                    initial_est_time_s=est, initial_nodes=list(nodes))
        v.trail.append(self.engine.network.node_latlon(origin))
        v.events.append((0.0, f"Departed on {mode} route, estimated {est:.0f} s"))
        self.vehicle = v
        self._last_version = self.engine.traffic.version
        self._last_check = 0.0
        return v

    def resume_from(self, destination, mode: str, nodes: list, idx: int, offset_m: float = 0.0,
                    elapsed_s: float = 0.0) -> Vehicle:
        """Put a vehicle part-way along `nodes`, e.g. one animated by the browser."""
        idx = min(max(int(idx), 0), max(len(nodes) - 2, 0))
        self.vehicle = Vehicle(mode=mode, origin=nodes[0], destination=destination, nodes=list(nodes), idx=idx,
                               offset_m=float(offset_m), elapsed_s=float(elapsed_s), initial_nodes=list(nodes))
        self._last_version = self.engine.traffic.version
        self._last_check = float(elapsed_s)
        return self.vehicle

    # --------------------------------------------------------------- helpers
    @property
    def current_edge_id(self) -> str | None:
        v = self.vehicle
        if v is None or v.finished:
            return None
        return self.engine.network.G[v.nodes[v.idx]][v.nodes[v.idx + 1]]["edge_id"]

    def _edge_len(self, eid: str) -> float:
        return self.engine.network.edge_data(eid)["length"]

    def _speed_mps(self, eid: str) -> float:
        return cf.kph_to_mps(self.engine.traffic.speed_kph(eid, self.engine.params))

    def remaining_plan(self) -> list:
        v = self.vehicle
        return v.nodes[v.idx + 1:] if v and not v.finished else []

    # ------------------------------------------------------------- re-routing
    def _plan_blocked(self, nodes: list) -> bool:
        st = self.engine.traffic.state
        return any(st[e].closed for e in self.engine.path_edges(nodes))

    def consider_reroute(self, force: bool = False) -> bool:
        """Returns True if the remaining route was changed."""
        v = self.vehicle
        if v is None or v.finished:
            return False
        rest = self.remaining_plan()
        if len(rest) < 2:
            return False  # already on the final segment
        blocked = self._plan_blocked(rest)
        if not blocked and not force and not (self.policy.enabled and v.mode == MASAR):
            return False
        search_mode = MASAR if v.mode == MASAR else v.mode
        try:
            best = self.engine.shortest_path(rest[0], v.destination, search_mode)
        except NoRouteError:
            msg = "Segment ahead closed and no alternative exists; continuing"
            if blocked and not (v.events and v.events[-1][1] == msg):  # checked repeatedly while blocked
                v.events.append((v.elapsed_s, msg))
            return False
        if best == rest:
            return False
        cur_time = math.inf if blocked else self.engine.evaluate(rest).est_time_s
        new_time = self.engine.evaluate(best).est_time_s
        gain = cur_time - new_time
        threshold = max(self.policy.min_improvement_s, self.policy.min_improvement_pct / 100.0 * cur_time) \
            if not blocked else 0.0
        if blocked or gain >= threshold:
            v.nodes = v.nodes[:v.idx + 1] + best
            v.route_changes += 1
            why = "segment ahead closed" if blocked else f"saves {gain:.0f} s (threshold {threshold:.0f} s)"
            v.events.append((v.elapsed_s, f"Re-routed from node {rest[0]}: {why}"))
            return True
        return False

    def _maybe_reroute(self) -> None:
        tr = self.engine.traffic
        changed = tr.version != self._last_version
        due = (self.vehicle.elapsed_s - self._last_check) >= self.policy.check_interval_s
        if due or (changed and self.policy.check_on_traffic_change):
            self.consider_reroute()
            self._last_check = self.vehicle.elapsed_s
        elif changed and self._plan_blocked(self.remaining_plan()):
            self.consider_reroute()
        self._last_version = tr.version

    # -------------------------------------------------------------- movement
    def step(self, dt: float) -> Vehicle:
        v = self.vehicle
        if v is None or v.finished or dt <= 0:
            return v
        self._maybe_reroute()
        left_dt = float(dt)
        while left_dt > 1e-9 and not v.finished:
            eid = self.current_edge_id
            length = self._edge_len(eid)
            speed = max(self._speed_mps(eid), 1e-3)
            ratio = self.engine.traffic.ratio(eid)
            left_m = max(length - v.offset_m, 0.0)
            need = left_m / speed
            if need <= left_dt:
                move, used = left_m, need
            else:
                move, used = speed * left_dt, left_dt
            v.offset_m += move
            v.travelled_m += move
            v.elapsed_s += used
            v.exposure_ratio_m += ratio * move
            if ratio >= cf.MODERATE_MAX:
                v.high_congestion_s += used
            left_dt -= used
            if v.offset_m >= length - 1e-9:
                v.traversed_edges.append(eid)
                v.idx += 1
                v.offset_m = 0.0
                v.trail.append(self.engine.network.node_latlon(v.nodes[v.idx]))
                if v.idx >= len(v.nodes) - 1:
                    v.finished = True
                    v.events.append((v.elapsed_s, "Arrived at destination"))
        if not v.finished:
            pos = self.position()
            if not v.trail or v.trail[-1] != pos:
                v.trail.append(pos)
            if len(v.trail) > 3000:
                v.trail = v.trail[::2]
        return v

    def run_to_completion(self, dt: float = 1.0, max_time_s: float = 6 * 3600, on_tick=None) -> Vehicle:
        while not self.vehicle.finished and self.vehicle.elapsed_s < max_time_s:
            if on_tick:
                on_tick(self.vehicle.elapsed_s)
            self.step(dt)
        return self.vehicle

    # --------------------------------------------------------------- status
    def position(self) -> tuple[float, float]:
        v = self.vehicle
        net = self.engine.network
        if v.finished:
            return net.node_latlon(v.destination)
        eid = self.current_edge_id
        d = net.edge_data(eid)
        frac = v.offset_m / d["length"] if d["length"] > 0 else 1.0
        return _interpolate(d["coords"], frac)

    def status(self) -> dict:
        v = self.vehicle
        net = self.engine.network
        if v.finished:
            return {"finished": True, "current_segment": "Arrived", "edge_id": None, "progress_pct": 100.0,
                    "remaining_time_s": 0.0, "remaining_m": 0.0, "elapsed_s": v.elapsed_s,
                    "travelled_m": v.travelled_m, "route_changes": v.route_changes,
                    "speed_kph": 0.0}
        eid = self.current_edge_id
        d = net.edge_data(eid)
        left_m = max(d["length"] - v.offset_m, 0.0)
        rest = self.remaining_plan()
        rest_route = self.engine.evaluate(rest) if len(rest) > 1 else None
        remaining_m = left_m + (rest_route.distance_m if rest_route else 0.0)
        remaining_t = left_m / max(self._speed_mps(eid), 1e-3) + (rest_route.est_time_s if rest_route else 0.0)
        total = v.travelled_m + remaining_m
        return {
            "finished": False,
            "current_segment": net.display_name(d),
            "edge_id": eid,
            "progress_pct": 100.0 * v.travelled_m / total if total > 0 else 0.0,
            "remaining_time_s": remaining_t,
            "remaining_m": remaining_m,
            "elapsed_s": v.elapsed_s,
            "travelled_m": v.travelled_m,
            "route_changes": v.route_changes,
            "speed_kph": self.engine.traffic.speed_kph(eid, self.engine.params),
        }
