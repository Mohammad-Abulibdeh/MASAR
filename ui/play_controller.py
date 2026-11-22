"""
State and rules behind the guided map screen. Contains no Streamlit code, so it can be
tested directly: the browser sends events to `handle`, and `view` returns what it draws.

The browser animates vehicles between server calls, using the per-segment speeds sent here
and the same movement rule as core/vehicle_simulator.py. It reports vehicle positions, and
this class decides re-routes with the real VehicleSimulator policy.
"""
from __future__ import annotations

import copy
import re

import networkx as nx
import numpy as np

from core import cost_function as cf
from core.estimation import estimate, explain, fmt_duration
from core.graph_manager import RoadNetwork, haversine_m
from core.i18n import language, tx
from core.routing_engine import DISTANCE, FASTEST, MASAR, MODES, NoRouteError, Route, RoutingEngine
from core.traffic_manager import PRESETS, MAJOR_ROADS, TrafficManager
from core.vehicle_simulator import ReroutePolicy, VehicleSimulator

MAX_SNAP_M = 300            # a click further than this from any road is not a valid location
SNAP_NOTICE_M = 60          # a pin moved further than this is worth mentioning
PULSE_EVERY_SIM_S = 30.0
UNDO_LIMIT = 20
ROUTE_LABELS = {MASAR: "MASAR route", DISTANCE: "Shortest distance", FASTEST: "Fastest on empty roads"}
SIM_SEED = 7


def _short_name(d: dict) -> str:
    """One readable name per language. OSM may list several, e.g. 'شارع حيفا;Al Quds Open / Haifa'."""
    names = []
    for raw in (d.get("name"), d.get("name_en")):
        name = re.split(r";| / ", raw or "")[0].strip()
        if name and name not in names:
            names.append(name)
    return " | ".join(names)


class PlayController:
    def __init__(self, network: RoadNetwork, traffic: TrafficManager, params: cf.CostParams,
                 policy: ReroutePolicy | None = None, area_key: str = "", areas: list | None = None,
                 places: list | None = None, geocoder=None):
        self.network, self.traffic, self.params = network, traffic, params
        self.policy = policy or ReroutePolicy()
        self.area_key, self.areas, self.geocoder = area_key, areas or [], geocoder
        self.edge_ids = network.edge_ids()
        self.index = {e: i for i, e in enumerate(self.edge_ids)}
        self.acked = 0
        self.client_id = None
        self.retired_clients: set = set()
        self.fresh = True           # no user action yet: the browser may offer to restore a saved setup
        self.want_area = None
        self.origin = self.dest = None
        self.options: list[Route] = []
        self.selected = MASAR
        self.route_error = None
        self.explanation = ""
        self.routes_rev = 0
        self.routes_key = None
        self.proposal_rev = 0
        self.proposals: list = []
        self.undo_stack: list = []
        self.notices: list = []
        self.notice_id = 0
        self.sim = None
        self.sim_run = 0
        self.client_roads = None    # which map's geometry the browser already holds
        pairs = {frozenset(network.edge(e)): network.edge_data(e)["length"] for e in self.edge_ids}
        self.road_km = sum(pairs.values()) / 1000
        scc = max(nx.strongly_connected_components(network.G), key=len) if network.G else set()
        self._main_nodes = [n for n in network.G.nodes if n in scc]
        self._main_lat = np.array([network.G.nodes[n]["y"] for n in self._main_nodes], dtype=float)
        self._main_lon = np.array([network.G.nodes[n]["x"] for n in self._main_nodes], dtype=float)
        self.set_places(places or [])

    def set_places(self, places: list) -> None:
        self.places = self._snap_places(places)

    # --------------------------------------------------------------- helpers
    def engine(self) -> RoutingEngine:
        return RoutingEngine(self.network, self.traffic, self.params)

    def notify(self, text: str, kind: str = "info", undo: bool = False) -> None:
        self.notice_id += 1
        self.notices = (self.notices + [{"id": self.notice_id, "text": text, "kind": kind, "undo": undo}])[-5:]

    def _ids(self, indexes) -> list[str]:
        return [self.edge_ids[int(i)] for i in indexes if 0 <= int(i) < len(self.edge_ids)]

    def _snap(self, lat: float, lng: float):
        """Nearest intersection from which the rest of the network can be reached, with its distance."""
        if not self._main_nodes:
            return None, float("inf")
        dist = haversine_m(lat, lng, self._main_lat, self._main_lon)
        i = int(np.argmin(dist))
        return self._main_nodes[i], float(dist[i])

    def _snap_places(self, places: list) -> list:
        out = []
        for p in places:
            node, dist = self._snap(p["lat"], p["lng"])
            if node is not None and dist <= MAX_SNAP_M:
                out.append({"name": p["name"], "label": p.get("label", ""), "lat": p["lat"], "lng": p["lng"]})
        return out

    def _place_label(self, node) -> str:
        lat, lng = self.network.node_latlon(node)
        best, best_d = None, 90.0
        for p in self.places:
            d = float(haversine_m(lat, lng, p["lat"], p["lng"]))
            if d < best_d:
                best, best_d = p["name"], d
        if best:
            return tx("Near {name}", name=best)
        G = self.network.G
        for _, _, d in list(G.out_edges(node, data=True)) + list(G.in_edges(node, data=True)):
            if d.get("name"):
                return _short_name(d)
        return tx("Unnamed road")

    def _pin(self, node):
        if node is None:
            return None
        lat, lng = self.network.node_latlon(node)
        return {"node": node, "lat": lat, "lng": lng, "label": self._place_label(node)}

    def _push_undo(self) -> None:
        self.undo_stack = (self.undo_stack + [self.traffic.snapshot()])[-UNDO_LIMIT:]

    @property
    def live(self) -> bool:
        return self.sim is not None and self.sim["status"] in ("running", "paused")

    def _edit(self, ids: list[str], change) -> None:
        """Apply a user edit. During a drive it also changes what traffic returns to at the end."""
        self._push_undo()
        change()
        if self.live:
            for eid in ids:
                t = self.traffic.state[eid]
                self.sim["base"][eid] = copy.copy(t)
                self.sim["base_counts"][eid] = t.vehicles

    # --------------------------------------------------------------- routing
    def compute_routes(self) -> None:
        previous = self.options[0].nodes if self.options else None
        self.options, self.route_error, self.explanation = [], None, ""
        self.routes_rev += 1
        self.routes_key = self._routes_key()
        if self.origin is None or self.dest is None:
            return
        if self.origin == self.dest:
            self.route_error = tx("A and B are at the same spot. Move one of them to another road.")
            return
        try:
            self.options = self.engine().options(self.origin, self.dest)
        except NoRouteError:
            self.route_error = tx("No drivable route connects A and B right now. A closed road or a one-way street "
                                  "may be blocking the way. Reopen a road or move a pin.")
            return
        self.explanation = explain(self.options[0], self.options[1:])
        if self.selected not in [r.mode for r in self.options]:
            self.selected = MASAR
        if previous is not None and previous != self.options[0].nodes:
            self.selected = MASAR
            self.notify(tx("Traffic changed, so MASAR found a better route."), "success")

    def _routes_key(self):
        return self.traffic.version, tuple(self.params.to_dict().values()), self.origin, self.dest, language()

    def refresh(self) -> None:
        """Keep routes in step with edits made anywhere, including the advanced screens."""
        if not self.live and self.routes_key != self._routes_key() and (self.options or self.route_error):
            self.compute_routes()

    # ---------------------------------------------------------------- events
    def handle_batch(self, payload) -> None:
        if not isinstance(payload, dict):
            return
        cid = payload.get("cid")
        if cid in self.retired_clients:
            return
        if cid != self.client_id:  # the map component was re-created (screen change or reload)
            if self.client_id is not None:
                self.retired_clients.add(self.client_id)
            self.client_id, self.acked = cid, 0
        for ev in payload.get("events", []):
            if ev.get("seq", 0) <= self.acked:
                continue
            self.acked = ev["seq"]
            handler = getattr(self, f"on_{ev.get('type')}", None)
            if handler is None:
                continue
            try:
                handler(ev)
            except (ValueError, KeyError, TypeError, IndexError) as exc:
                self.notify(tx("That change could not be applied: {error}", error=exc), "error")

    def _changes_setup(self, ev) -> bool:
        self.fresh = False
        if self.live:
            self.notify(tx("Reset the drive first to change this."), "warn")
            return False
        self.sim = None  # results of a finished drive don't describe the new setup
        return True

    # traffic -----------------------------------------------------------------
    def on_set_load(self, ev):
        self.fresh = False
        ids = self._ids(ev["edges"])
        self._edit(ids, lambda: self.traffic.set_load(ids, ev["ratio"]))
        self.refresh()

    def on_set_total(self, ev):
        self.fresh = False
        ids = self._ids(ev["edges"])
        self._edit(ids, lambda: self.traffic.set_total(ids, ev["total"]))
        self.refresh()

    def on_set_closed(self, ev):
        self.fresh = False
        ids = self._ids(ev["edges"])

        def change():
            for eid in ids:
                self.traffic.set_closed(eid, bool(ev["closed"]))
        if ev.get("temporary") and self.live:  # lasts until the drive ends; not part of the user's setup
            change()
        else:
            self._edit(ids, change)
        self.refresh()

    def on_preset(self, ev):
        if self._changes_setup(ev):
            self._push_undo()
            self.traffic.apply_preset(ev["name"])
            self.notify(tx("{name} applied. These are simulated vehicle counts.", name=tx(PRESETS[ev["name"]]["label"])), "success", True)
            self.refresh()

    def show_vehicle_counts(self, counts: dict[str, int], text: str) -> None:
        """Put counts worked out on another screen onto the map. Undo brings the old traffic back."""
        self.fresh = False
        self.sim = None
        self._push_undo()
        for eid, n in counts.items():
            if self.traffic.state[eid].vehicles != n:
                self.traffic.set_vehicles(eid, n, "simulated")
        self.notify(text, "success", True)
        self.refresh()

    def on_clear_traffic(self, ev):
        if self._changes_setup(ev):
            self._push_undo()
            self.traffic.reset_all()
            self.notify(tx("Traffic cleared."), "info", True)
            self.refresh()

    def on_undo(self, ev):
        if self._changes_setup(ev) and self.undo_stack:
            self.traffic.restore(self.undo_stack.pop())
            self.notify(tx("Change undone."))
            self.refresh()

    def on_jam_route(self, ev):
        if not self._changes_setup(ev):
            return
        route = next((r for r in self.options if r.mode == ev["id"]), None)
        if route is None:
            return
        self._push_undo()
        self.traffic.set_load(route.edges, 1.2)
        before = route.est_time_s
        self.refresh()
        after = self.engine().evaluate(route.nodes).est_time_s
        self.notify(tx("Jammed that route: its estimate went from {before} to {after}.",
                       before=fmt_duration(before), after=fmt_duration(after)), "info", True)

    # pins --------------------------------------------------------------------
    def on_set_pin(self, ev):
        if not self._changes_setup(ev):
            return
        node, dist = self._snap(float(ev["lat"]), float(ev["lng"]))
        if node is None or dist > MAX_SNAP_M:
            self.notify(tx("That spot is too far from any road on this map. Click closer to a road."), "warn")
            self.routes_rev += 1  # puts a dragged pin back where it was
            return
        if dist > SNAP_NOTICE_M:
            self.notify(tx("Trips start and end at junctions, so that pin moved {dist} m to the nearest one.", dist=f"{dist:.0f}"))
        self._set_pin(ev["which"], node)

    def _set_pin(self, which: str, node) -> None:
        if which == "a":
            self.origin = node
        else:
            self.dest = node
        self.compute_routes()

    def on_swap_pins(self, ev):
        if self._changes_setup(ev):
            self.origin, self.dest = self.dest, self.origin
            self.compute_routes()

    def on_clear_pins(self, ev):
        if self._changes_setup(ev):
            self.origin = self.dest = None
            self.compute_routes()

    def on_geocode(self, ev):
        if not self._changes_setup(ev):
            return
        spot = self.geocoder(ev["query"]) if self.geocoder else None
        if spot is None:
            self.notify(tx("Nothing found online for that search. Try the street list or click the map."), "warn")
            return
        node, dist = self._snap(*spot)
        if dist > MAX_SNAP_M:
            self.notify(tx("That place is outside the loaded map area."), "warn")
            return
        self._set_pin(ev["which"], node)

    def on_calc(self, ev):
        self.fresh = False
        if not self.live:
            self.compute_routes()

    def on_select_route(self, ev):
        if not self.live and ev["id"] in [r.mode for r in self.options]:
            self.selected = ev["id"]
            self.routes_rev += 1

    def on_demo(self, ev):
        if not self._changes_setup(ev):
            return
        self._push_undo()
        self.traffic.apply_preset("rush_hour")
        self.origin, self.dest = self._far_apart_nodes()
        self.compute_routes()
        self.notify(tx("Demo ready: simulated rush hour with A and B already placed."), "success", True)

    def _far_apart_nodes(self):
        spots = [(p["lat"], p["lng"]) for p in self.places]
        s, w, n, e = self.network.bounds()
        clat, clon = self.network.center()
        if len(set(spots)) < 2:
            spots = [(s + (n - s) * .2, w + (e - w) * .2), (n - (n - s) * .2, e - (e - w) * .2)]
        # The closest ring around the centre that holds two spots: big maps can have few near it.
        for radius in (1200, 2400, 4800, 9600):
            near = [p for p in spots if float(haversine_m(p[0], p[1], clat, clon)) < radius]
            if len(set(near)) >= 2:
                spots = near
                break
        pair = max(((a, b) for a in spots for b in spots),
                   key=lambda ab: float(haversine_m(ab[0][0], ab[0][1], ab[1][0], ab[1][1])))
        return self._snap(*pair[0])[0], self._snap(*pair[1])[0]

    # maps --------------------------------------------------------------------
    def on_set_area(self, ev):
        self.fresh = False
        self.want_area = ev["key"]

    def on_restore(self, ev):
        """Bring back the setup the browser saved before a reload."""
        if not self.fresh:
            return
        self.fresh = False
        saved = ev.get("saved") or {}
        for row in saved.get("traffic", []):
            eid = self.edge_ids[int(row[0])]
            self.traffic.update_edge(eid, vehicles=row[1], capacity=row[2], free_speed_kph=row[3], closed=bool(row[4]))
            self.traffic.state[eid].vehicles_source = row[5]
            self.traffic.state[eid].capacity_source = row[6]
            self.traffic.state[eid].speed_source = row[7]
        for which, attr in (("a", "origin"), ("b", "dest")):
            node = saved.get(which)
            if node in self.network.G:
                setattr(self, attr, node)
        self.selected = saved.get("selected") or MASAR
        if self.origin is not None and self.dest is not None:
            self.compute_routes()

    def on_dismiss_restore(self, ev):
        self.fresh = False

    # simulation --------------------------------------------------------------
    def on_sim_start(self, ev):
        if self.live:
            return
        if self.sim is not None:
            self._end_sim()
        self.refresh()
        if not self.options:
            self.notify(tx("Calculate a route before starting."), "warn")
            return
        hero = next((r for r in self.options if r.mode == self.selected), self.options[0])
        self.sim_run += 1
        self.sim = {
            "status": "running", "run": self.sim_run, "hero": hero.mode, "live": bool(ev.get("live", True)),
            "base": self.traffic.snapshot(), "base_counts": {e: t.vehicles for e, t in self.traffic.state.items()},
            "rng": np.random.default_rng(SIM_SEED), "last_pulse": 0.0, "results": None,
            "cars": [{"id": r.mode, "edges": [self.index[e] for e in r.edges]} for r in self.options],
        }

    def on_sim_pause(self, ev):
        if self.live:
            self.sim["status"] = "paused"

    def on_sim_resume(self, ev):
        if self.live:
            self.sim["status"] = "running"

    def on_sim_live(self, ev):
        if self.sim:
            self.sim["live"] = bool(ev["live"])
            if not self.sim["live"] and self.live:
                self._restore_counts()
                self.on_sim_tick(ev)

    def _restore_counts(self) -> None:
        for eid, t in self.sim["base"].items():
            self.traffic.state[eid].vehicles = t.vehicles
            self.traffic.state[eid].vehicles_source = t.vehicles_source
        self.traffic.version += 1

    def on_sim_tick(self, ev):
        """Vehicles report in: let traffic move and let them re-plan under the new conditions."""
        if not self.live:
            return
        cars = ev.get("cars") or []
        elapsed = max((c.get("elapsed", 0.0) for c in cars), default=0.0)
        if self.sim["status"] == "running" and self.sim["live"] and elapsed - self.sim["last_pulse"] >= PULSE_EVERY_SIM_S:
            self.traffic.pulse(self.sim["rng"], self.sim["base_counts"])
            self.sim["last_pulse"] = elapsed
        for car in cars:
            if not car.get("done"):
                self._consider_reroute(car)

    def _consider_reroute(self, car: dict) -> None:
        ids = self._ids(car["edges"])
        if not ids:
            return
        nodes = [self.network.edge(ids[0])[0]] + [self.network.edge(e)[1] for e in ids]
        adaptive = car["id"] == MASAR
        sim = VehicleSimulator(self.engine(), ReroutePolicy(**{**self.policy.__dict__, "enabled": self.policy.enabled and adaptive}))
        mode = car["id"] if car["id"] in MODES else DISTANCE
        v = sim.resume_from(self.dest, mode, nodes, car["idx"], car.get("offset", 0.0), car.get("elapsed", 0.0))
        if not sim.consider_reroute():
            return
        self.proposal_rev += 1
        reason = v.events[-1][1] if v.events else ""
        self.proposals = (self.proposals + [{
            "rev": self.proposal_rev, "car": car["id"], "from_idx": v.idx,
            "edges": [self.index[e] for e in sim.engine.path_edges(v.nodes)],
            "closed": "closed" in reason,
            "time_s": sim.engine.evaluate(v.nodes[v.idx:]).est_time_s,
        }])[-6:]

    def on_sim_finish(self, ev):
        if not self.live:
            return
        rows = sorted(ev.get("cars", []), key=lambda c: (not c.get("done"), c.get("elapsed", 0.0)))
        labels = self._route_labels()
        results = [{"id": r["id"], "label": labels.get(r["id"], r["id"]), "elapsed": r["elapsed"], "arrived": bool(r.get("done")),
                    "distance": r.get("travelled", 0.0), "changes": r.get("changes", 0)} for r in rows]
        self.sim["results"] = {"rows": results, "hero": self.sim["hero"],
                               "winner": rows[0]["id"] if rows and rows[0].get("done") else None}
        self._end_sim()
        self.sim["status"] = "finished"

    def on_sim_reset(self, ev):
        if self.sim:
            self._end_sim()
            self.sim = None

    def _end_sim(self) -> None:
        """Remove the simulated traffic swings; the user's own setup is untouched."""
        if self.sim.get("base"):
            self.traffic.restore(self.sim["base"])
            self.sim["base"] = None

    # ------------------------------------------------------------------ view
    def _route_labels(self) -> dict:
        labels = {}
        n = 0
        for r in self.options:
            if r.mode in ROUTE_LABELS:
                labels[r.mode] = tx(ROUTE_LABELS[r.mode])
            else:
                n += 1
                labels[r.mode] = tx("Alternative {n}", n=n)
        return labels

    def _route_view(self, r: Route, others: list[Route], label: str) -> dict:
        e = estimate(r, others)
        best_time = min(o.est_time_s for o in [r] + others)
        return {
            "id": r.mode, "label": label, "edges": [self.index[x] for x in r.edges],
            "time_s": e.time_s, "distance_m": e.distance_m, "free_time_s": e.free_time_s, "delay_s": e.delay_s,
            "density_pct": e.density_pct, "band": e.band, "efficiency_pct": e.efficiency_pct,
            "extra_vs_best_s": max(r.est_time_s - best_time, 0.0), "saved_s": e.saved_s,
            "heavy_m": e.heavy_m, "vehicles": e.vehicles,
        }

    def roads_payload(self) -> dict:
        """Geometry sent once per map: each road segment with its twin in the opposite direction."""
        G = self.network.G
        rows = []
        for eid in self.edge_ids:
            u, v = self.network.edge(eid)
            d = G[u][v]
            rows.append({
                "c": [round(x, 5) for pt in d["coords"] for x in pt],
                "l": round(d["length"], 1),
                "n": _short_name(d),
                "s": d.get("name") or "",
                "m": 1 if d.get("highway", "").split("_")[0] in MAJOR_ROADS else 0,
                "t": self.index.get(f"{v}-{u}", -1),
                "u": u, "h": d.get("highway", "road").replace("_", " "),
            })
        s, w, n, e = self.network.bounds()
        return {"key": self.area_key, "edges": rows, "bounds": [[s, w], [n, e]]}

    def traffic_view(self) -> dict:
        st = self.traffic.state
        rows = [st[e] for e in self.edge_ids]
        return {
            "rev": self.traffic.version,
            "veh": [t.vehicles for t in rows],
            "cap": [t.capacity for t in rows],
            "closed": [i for i, t in enumerate(rows) if t.closed],
            "mps": [round(cf.kph_to_mps(cf.estimated_speed_kph(t.free_speed_kph, t.vehicles, t.capacity, self.params)), 3)
                    for t in rows],
        }

    def _saved_traffic(self) -> list:
        """Only what differs from the defaults, so the browser can store it compactly."""
        base = self.sim["base"] if self.live and self.sim.get("base") else self.traffic.state
        out = []
        for i, eid in enumerate(self.edge_ids):
            t = base[eid]
            if t.vehicles or t.closed or t.capacity_source != "estimated" or t.speed_source == "user":
                out.append([i, t.vehicles, t.capacity, t.free_speed_kph, int(t.closed), t.vehicles_source,
                            t.capacity_source, t.speed_source])
        return out

    def dashboard(self) -> dict:
        st = self.traffic.state
        seen, bands, congested = set(), dict.fromkeys(cf.BANDS, 0), 0
        for i, eid in enumerate(self.edge_ids):
            u, v = self.network.edge(eid)
            key = (u, v) if str(u) <= str(v) else (v, u)
            if key in seen:
                continue
            seen.add(key)
            twin = st.get(f"{v}-{u}")
            ratio = max(cf.congestion_ratio(st[eid].vehicles, st[eid].capacity),
                        cf.congestion_ratio(twin.vehicles, twin.capacity) if twin else 0.0)
            bands[cf.traffic_band(ratio)] += 1
            congested += ratio >= cf.MODERATE_MAX
        times = [r.est_time_s for r in self.options]
        return {
            "vehicles": sum(t.vehicles for t in st.values()),
            "congested": congested, "roads": len(seen), "bands": bands,
            "closed": sum(1 for t in st.values() if t.closed),
            "avg_time_s": sum(times) / len(times) if times else None, "route_count": len(times),
        }

    def on_need_roads(self, ev):
        self.client_roads = None

    def on_roads_ok(self, ev):
        self.client_roads = ev["key"]

    def view(self) -> dict:
        self.refresh()
        labels = self._route_labels()
        routes = []
        for r in self.options:
            others = [o for o in self.options if o is not r]
            routes.append(self._route_view(r, others, labels[r.mode]))
        sim = None
        if self.sim:
            sim = {k: self.sim[k] for k in ("status", "run", "hero", "live", "cars", "results")}
        summary = self.network.summary()
        return {
            "lang": language(), "acked": self.acked, "cid": self.client_id, "fresh": self.fresh, "area_key": self.area_key,
            "roads": self.roads_payload() if self.client_roads != self.area_key else None,
            "traffic": self.traffic_view(), "saved_traffic": None if self.live else self._saved_traffic(),
            "a": self._pin(self.origin), "b": self._pin(self.dest),
            "routes": routes, "routes_rev": self.routes_rev, "selected": self.selected,
            "explanation": self.explanation, "route_error": self.route_error,
            "dash": self.dashboard(), "sim": sim, "proposals": self.proposals,
            "notices": self.notices, "can_undo": bool(self.undo_stack),
            "areas": self.areas, "places": [{**p, "label": tx(p["label"])} for p in self.places],
            "presets": [{"id": k, "label": tx(v["label"]), "hint": tx(v["hint"])} for k, v in PRESETS.items()],
            "stats": {"intersections": summary["intersections"], "km": round(self.road_km),
                      "streets": summary["streets"]},
        }
