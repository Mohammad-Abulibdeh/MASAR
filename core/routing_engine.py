"""
MASAR routing engine: three strategies on the same directed road graph.

  distance : minimise total length (Dijkstra, weight = metres)
  fastest  : minimise FREE-FLOW travel time, ignoring congestion
             (Dijkstra, weight = length / free-flow speed)
  masar    : minimise CONGESTION-AWARE travel time
             (A*, weight = cost_function.edge_travel_time, admissible
              heuristic = straight-line distance / fastest speed in network)

Every route - whichever strategy found it - is then *evaluated* under the
same current traffic, so the comparison table is apples-to-apples. Closed
segments are excluded by all strategies. Only edges that exist in the
directed graph are used, so one-way streets are always respected.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import networkx as nx

from . import cost_function as cf
from .graph_manager import RoadNetwork, haversine_m
from .i18n import tx
from .traffic_manager import TrafficManager

DISTANCE, FASTEST, MASAR = "distance", "fastest", "masar"
MODES = (DISTANCE, FASTEST, MASAR)
MODE_LABELS = {DISTANCE: "Distance Route", FASTEST: "Fastest Route", MASAR: "MASAR Route"}


class NoRouteError(Exception):
    pass


@dataclass
class Route:
    mode: str
    nodes: list
    edges: list[str]
    distance_m: float
    free_time_s: float          # if roads were empty
    est_time_s: float           # under current (simulated) traffic
    congestion_cost_s: float    # est_time - free_time = delay caused by congestion
    mean_congestion: float      # length-weighted mean vehicles/capacity
    max_congestion: float
    vehicles_total: int
    segments: int
    high_congestion_m: float    # metres driven on segments >= 80 % of capacity
    algorithm: str = "dijkstra"
    segment_lengths: list[float] = field(default_factory=list)

    @property
    def level(self) -> str:
        return cf.congestion_level(self.mean_congestion)


class RoutingEngine:
    def __init__(self, network: RoadNetwork, traffic: TrafficManager, params: cf.CostParams | None = None):
        self.network = network
        self.traffic = traffic
        self.params = (params or cf.CostParams()).validated()

    # --------------------------------------------------------------- weights
    def weight_fn(self, mode: str):
        st = self.traffic.state
        p = self.params

        if mode == DISTANCE:
            def w(u, v, d):
                return None if st[d["edge_id"]].closed else d["length"]
        elif mode == FASTEST:
            def w(u, v, d):
                t = st[d["edge_id"]]
                return None if t.closed else cf.free_flow_time(d["length"], t.free_speed_kph, p)
        elif mode == MASAR:
            def w(u, v, d):
                t = st[d["edge_id"]]
                if t.closed:
                    return None
                return cf.edge_travel_time(d["length"], t.free_speed_kph, t.vehicles, t.capacity, p)
        else:
            raise ValueError(f"Unknown routing mode {mode!r}")
        return w

    def _heuristic(self, mode: str, target):
        G = self.network.G
        tlat, tlon = G.nodes[target]["y"], G.nodes[target]["x"]
        max_speed = max(max((t.free_speed_kph for t in self.traffic.state.values()), default=1.0),
                        self.params.min_speed_kph, 1.0)
        vmax = cf.kph_to_mps(max_speed)

        def h(a, b):
            dist = float(haversine_m(G.nodes[a]["y"], G.nodes[a]["x"], tlat, tlon)) * 0.999
            return dist if mode == DISTANCE else dist / vmax
        return h

    # ------------------------------------------------------------ path search
    def shortest_path(self, origin, destination, mode: str = MASAR, algorithm: str | None = None) -> list:
        G = self.network.G
        if origin not in G or destination not in G:
            raise NoRouteError(tx("Origin or destination is not on the road network"))
        if origin == destination:
            return [origin]
        algorithm = algorithm or ("astar" if mode == MASAR else "dijkstra")
        w = self.weight_fn(mode)
        try:
            if algorithm == "astar":
                return nx.astar_path(G, origin, destination, heuristic=self._heuristic(mode, destination), weight=w)
            return nx.dijkstra_path(G, origin, destination, weight=w)
        except nx.NetworkXNoPath:
            raise NoRouteError(tx("No drivable route exists between these points "
                                  "(one-way streets, closures or a disconnected area)."))
        except nx.NodeNotFound as exc:
            raise NoRouteError(str(exc))

    def path_edges(self, nodes: list) -> list[str]:
        G = self.network.G
        return [G[u][v]["edge_id"] for u, v in zip(nodes[:-1], nodes[1:])]

    def evaluate(self, nodes: list, mode: str = MASAR, algorithm: str = "") -> Route:
        """Score any node path under the *current* traffic state."""
        edges = self.path_edges(nodes)
        dist = free = est = 0.0
        weighted_ratio = 0.0
        max_r = 0.0
        vehicles = 0
        high_m = 0.0
        for eid in edges:
            d = self.network.edge_data(eid)
            t = self.traffic.state[eid]
            r = cf.congestion_ratio(t.vehicles, t.capacity)
            dist += d["length"]
            free += cf.free_flow_time(d["length"], t.free_speed_kph, self.params)
            est += cf.edge_travel_time(d["length"], t.free_speed_kph, t.vehicles, t.capacity, self.params)
            weighted_ratio += r * d["length"]
            max_r = max(max_r, r)
            vehicles += t.vehicles
            if r >= cf.MODERATE_MAX:
                high_m += d["length"]
        return Route(mode=mode, nodes=list(nodes), edges=edges, distance_m=dist, free_time_s=free,
                     est_time_s=est, congestion_cost_s=est - free,
                     mean_congestion=(weighted_ratio / dist) if dist > 0 else 0.0,
                     max_congestion=max_r, vehicles_total=vehicles, segments=len(edges),
                     high_congestion_m=high_m, algorithm=algorithm,
                     segment_lengths=[self.network.edge_data(e)["length"] for e in edges])

    def route(self, origin, destination, mode: str = MASAR, algorithm: str | None = None) -> Route:
        algorithm = algorithm or ("astar" if mode == MASAR else "dijkstra")
        nodes = self.shortest_path(origin, destination, mode, algorithm)
        return self.evaluate(nodes, mode, algorithm)

    def compare(self, origin, destination) -> dict[str, Route]:
        """All three strategies; raises NoRouteError if the destination is unreachable."""
        return {m: self.route(origin, destination, m) for m in MODES}

    def options(self, origin, destination, max_routes: int = 3, overlap_limit: float = 0.8,
                detour_limit: float = 2.0) -> list[Route]:
        """Distinct real road paths to choose from, best (MASAR) first.

        The three strategies often agree, so further paths are found by making the roads
        already used more expensive and searching again. Every path is still scored under
        the same true traffic, and the search penalty never reaches the reported numbers.
        """
        routes = self.compare(origin, destination)
        best = routes[MASAR]
        found = [best]
        for mode in (DISTANCE, FASTEST):
            if routes[mode].nodes not in [r.nodes for r in found] and len(found) < max_routes:
                found.append(routes[mode])
        used = {e: 1 for r in found for e in r.edges}
        base = self.weight_fn(MASAR)

        def penalised(u, v, d):
            w = base(u, v, d)
            return None if w is None else w * (1.0 + 0.6 * used.get(d["edge_id"], 0))

        for attempt in range(6):
            if len(found) >= max_routes or len(best.edges) == 0:
                break
            try:
                nodes = nx.dijkstra_path(self.network.G, origin, destination, weight=penalised)
            except nx.NetworkXNoPath:
                break
            route = self.evaluate(nodes, f"alt{attempt + 1}", "penalty search")
            for e in route.edges:
                used[e] = used.get(e, 0) + 1
            if any(_overlap(route, r) > overlap_limit for r in found):
                continue
            if route.est_time_s <= detour_limit * max(best.est_time_s, 1.0):
                found.append(route)
        return found

    def remaining_time(self, nodes: list) -> float:
        return self.evaluate(nodes).est_time_s if len(nodes) > 1 else 0.0


def _overlap(a: Route, b: Route) -> float:
    """Share of a's distance that is also on b."""
    if a.distance_m <= 0:
        return 1.0
    other = set(b.edges)
    return sum(m for e, m in zip(a.edges, a.segment_lengths) if e in other) / a.distance_m


def recommend(routes: dict[str, Route]) -> tuple[str, str]:
    """Return (recommended_mode, plain-language reason)."""
    m = routes[MASAR]
    d = routes[DISTANCE]
    f = routes[FASTEST]
    best_other = min((d, f), key=lambda r: r.est_time_s)
    if m.nodes == d.nodes == f.nodes:
        return MASAR, ("All three strategies agree on the same path: with the current traffic inputs "
                       "the shortest road is also the quickest.")
    saving = best_other.est_time_s - m.est_time_s
    if saving <= 0.5:
        return MASAR, ("The MASAR route has the same estimated travel time as the best alternative "
                       f"({MODE_LABELS[best_other.mode]}); congestion does not change the choice here.")
    pct = 100 * saving / best_other.est_time_s if best_other.est_time_s > 0 else 0
    longer = m.distance_m - d.distance_m
    reason = (f"MASAR is estimated {saving:.0f} s ({pct:.0f}%) faster than the "
              f"{MODE_LABELS[best_other.mode]} under the current traffic inputs")
    if longer > 1:
        reason += (f", even though it is {longer:.0f} m longer than the shortest-distance route, "
                   f"because it avoids {max(d.high_congestion_m - m.high_congestion_m, 0):.0f} m of heavily "
                   f"congested road")
    return MASAR, reason + "."
