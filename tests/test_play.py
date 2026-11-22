"""Traffic presets, trip estimates, route options and the rules behind the map screen."""
import numpy as np
import pytest

from core import cost_function as cf
from core.cost_function import CostParams
from core.estimation import estimate, explain
from core.places import cached_places, fetch_places, select_places
from core.map_loader import MapArea
from core.routing_engine import DISTANCE, MASAR, RoutingEngine
from core.traffic_manager import PRESETS, TrafficManager
from core.vehicle_simulator import ReroutePolicy, VehicleSimulator
from tests.conftest import make_diamond, make_grid
from ui.play_controller import PlayController


def controller(net=None):
    net = net or make_grid(6)
    return PlayController(net, TrafficManager(net), CostParams(), ReroutePolicy(), "test")


def set_pins(c, a, b):
    c.origin, c.dest = a, b
    c.compute_routes()


def batch(c, *events):
    seq = c.acked
    payload = []
    for ev in events:
        seq += 1
        payload.append({"seq": seq, **ev})
    c.handle_batch({"cid": c.client_id or "client", "events": payload})


# ---------------------------------------------------------------- bands
@pytest.mark.parametrize("ratio,band", [(0, "low"), (.49, "low"), (.5, "moderate"), (.79, "moderate"),
                                        (.8, "heavy"), (.99, "heavy"), (1.0, "very_heavy"), (3, "very_heavy")])
def test_traffic_bands(ratio, band):
    assert cf.traffic_band(ratio) == band


# ------------------------------------------------------------- traffic
def test_many_drivers_counts_reach_the_map_and_can_be_undone():
    c = controller()
    eid = next(iter(c.traffic.state))
    c.traffic.set_vehicles(eid, 2)
    c.show_vehicle_counts({eid: 9}, "added")
    assert c.traffic.state[eid].vehicles == 9 and c.traffic.state[eid].vehicles_source == "simulated"
    assert c.notices[-1]["undo"] and not c.fresh
    batch(c, {"type": "undo"})
    assert c.traffic.state[eid].vehicles == 2


def test_set_total_shares_exactly_by_capacity():
    tr = TrafficManager(make_diamond())
    ids = ["A-B", "A-C"]
    tr.set_total(ids, 37)
    assert sum(tr.state[e].vehicles for e in ids) == 37
    assert tr.state["A-C"].vehicles > tr.state["A-B"].vehicles


def test_set_load_rejects_bad_values():
    tr = TrafficManager(make_diamond())
    with pytest.raises(ValueError):
        tr.set_load(["A-B"], -1)


@pytest.mark.parametrize("name", [n for n in PRESETS if n != "empty"])
def test_presets_are_reproducible_and_labelled_simulated(name):
    a, b = TrafficManager(make_grid(6)), TrafficManager(make_grid(6))
    a.apply_preset(name)
    b.apply_preset(name)
    assert [t.vehicles for t in a.state.values()] == [t.vehicles for t in b.state.values()]
    assert {t.vehicles_source for t in a.state.values()} == {"simulated"}


def test_unknown_preset_is_rejected():
    with pytest.raises(ValueError):
        TrafficManager(make_diamond()).apply_preset("nope")


def test_pulse_stays_around_base_and_leaves_empty_roads_alone():
    tr = TrafficManager(make_grid(5))
    ids = list(tr.state)
    tr.set_vehicles(ids[0], 100)
    base = {e: t.vehicles for e, t in tr.state.items()}
    rng = np.random.default_rng(1)
    seen = []
    for _ in range(200):
        tr.pulse(rng, base)
        seen.append(tr.state[ids[0]].vehicles)
        assert tr.state[ids[1]].vehicles == 0
    assert 80 < float(np.mean(seen)) < 120  # no random-walk drift


# -------------------------------------------------------------- options
def test_options_are_distinct_real_paths_best_first():
    net = make_grid(6)
    tr = TrafficManager(net)
    tr.apply_random_scenario(3)
    eng = RoutingEngine(net, tr)
    routes = eng.options((0, 0), (5, 5))
    assert len(routes) >= 2
    assert routes[0].mode == MASAR
    assert len({tuple(r.nodes) for r in routes}) == len(routes)
    assert routes[0].est_time_s == min(r.est_time_s for r in routes)
    for r in routes:
        assert all(net.G.has_edge(u, v) for u, v in zip(r.nodes, r.nodes[1:]))
        assert r.nodes[0] == (0, 0) and r.nodes[-1] == (5, 5)


def test_option_scores_exclude_search_penalty():
    net = make_grid(5)
    eng = RoutingEngine(net, TrafficManager(net))
    for r in eng.options((0, 0), (4, 4)):
        assert r.est_time_s == pytest.approx(eng.evaluate(r.nodes).est_time_s)


def test_estimate_definitions():
    net = make_diamond()
    tr = TrafficManager(net)
    tr.set_load(["A-B", "B-D"], 1.0)
    eng = RoutingEngine(net, tr)
    slow, fast = eng.evaluate(["A", "B", "D"], DISTANCE), eng.evaluate(["A", "C", "D"], MASAR)
    e = estimate(slow, [fast])
    assert e.delay_s == pytest.approx(slow.est_time_s - slow.free_time_s)
    assert e.efficiency_pct == pytest.approx(100 / 3)  # factor at full capacity is 1 + 2 = 3
    assert e.band == "very_heavy" and e.heavy_m == pytest.approx(1000)
    assert estimate(fast, [slow]).saved_s == pytest.approx(slow.est_time_s - fast.est_time_s)
    assert e.saved_s == 0


def test_explanation_never_claims_a_saving_that_does_not_exist():
    net = make_diamond()
    tr = TrafficManager(net)
    eng = RoutingEngine(net, tr)
    route = eng.evaluate(["A", "B", "D"], MASAR)
    assert "faster" not in explain(route, [])
    assert "faster" not in explain(route, [eng.evaluate(["A", "B", "D"], DISTANCE)])
    tr.set_load(["A-B", "B-D"], 1.2)
    longer = eng.evaluate(["A", "C", "D"], MASAR)
    text = explain(longer, [eng.evaluate(["A", "B", "D"], DISTANCE)])
    assert "faster" in text and "400 m longer" in text


# --------------------------------------------------------------- places
def test_select_places_limits_and_filters():
    rows = [{"name": f"Clinic {i}", "category": "hospital", "lat": 0, "lng": 0} for i in range(9)]
    rows += [{"name": "Big Hospital", "category": "hospital", "lat": 0, "lng": 0},
             {"name": "Event Hall", "category": "townhall", "lat": 0, "lng": 0},
             {"name": "City Municipality", "category": "townhall", "lat": 0, "lng": 0}]
    names = [p["name"] for p in select_places(rows)]
    assert names[0] == "City Municipality" and "Event Hall" not in names
    assert names[1] == "Big Hospital" and len(names) == 5


def test_places_failure_is_harmless_and_success_is_cached(tmp_path):
    area = MapArea("x", 1.0, 2.0, 100)

    def offline(*_):
        raise OSError("no internet")

    assert fetch_places(area, tmp_path, offline) == [] and cached_places(area, tmp_path) == []
    row = {"name": "Square One", "category": "square", "lat": 1.0, "lng": 2.0}
    fetch_places(area, tmp_path, lambda *_: [row])
    assert cached_places(area, tmp_path)[0]["name"] == "Square One"


# ------------------------------------------------------------- controller
def test_demo_pins_differ_when_only_one_landmark_is_near_the_centre():
    c = controller()
    lat, lng = c.network.center()
    c.set_places([{"name": "Near", "lat": lat, "lng": lng}])
    a, b = c._far_apart_nodes()
    assert a != b
    c.places = [{"name": "Near", "lat": lat, "lng": lng}, {"name": "Far", "lat": lat + 0.05, "lng": lng + 0.05}]
    a, b = c._far_apart_nodes()
    assert a != b


def test_click_far_from_any_road_is_refused():
    c = controller()
    batch(c, {"type": "set_pin", "which": "a", "lat": 40.0, "lng": 40.0})
    assert c.origin is None and "too far" in c.notices[-1]["text"]


def test_pins_snap_to_a_node_everything_can_be_reached_from():
    net = make_diamond()  # B is reachable, so all four are one connected loop except where one-way breaks it
    c = controller(net)
    batch(c, {"type": "set_pin", "which": "a", "lat": 31.90, "lng": 35.20},
          {"type": "set_pin", "which": "b", "lat": 31.90, "lng": 35.2085})
    assert c.origin == "A" and c.dest == "D"
    assert c.options and c.route_error is None


def test_same_spot_and_unreachable_give_clear_messages():
    c = controller()
    set_pins(c, (0, 0), (0, 0))
    assert "same spot" in c.route_error and not c.options
    batch(c, {"type": "clear_pins"})
    net = make_diamond()
    c = controller(net)
    closed = [c.index["A-B"], c.index["A-C"]]
    set_pins(c, "A", "D")
    batch(c, {"type": "set_closed", "edges": closed, "closed": True})
    assert not c.options and "No drivable route" in c.route_error


def test_traffic_edit_changes_recommended_route():
    c = controller(make_diamond())
    set_pins(c, "A", "D")
    assert c.options[0].nodes == ["A", "B", "D"]
    batch(c, {"type": "set_load", "edges": [c.index["A-B"], c.index["B-D"]], "ratio": 1.2})
    assert c.options[0].nodes == ["A", "C", "D"]
    assert "better route" in c.notices[-1]["text"]


def test_jam_then_undo_restores_everything():
    c = controller()
    set_pins(c, (0, 0), (5, 5))
    first = c.options[0].nodes
    batch(c, {"type": "jam_route", "id": MASAR})
    assert c.options[0].nodes != first
    batch(c, {"type": "undo"})
    assert c.options[0].nodes == first and sum(t.vehicles for t in c.traffic.state.values()) == 0


def test_duplicate_and_old_events_are_ignored():
    c = controller()
    edge = 0
    batch(c, {"type": "set_load", "edges": [edge], "ratio": 1.0})
    vehicles = c.traffic.state[c.edge_ids[edge]].vehicles
    c.handle_batch({"cid": "client", "events": [{"seq": 1, "type": "set_load", "edges": [edge], "ratio": 0.0}]})
    assert c.traffic.state[c.edge_ids[edge]].vehicles == vehicles
    c.handle_batch({"cid": "new", "events": [{"seq": 1, "type": "clear_traffic"}]})  # re-created component
    assert c.traffic.state[c.edge_ids[edge]].vehicles == 0
    c.handle_batch({"cid": "client", "events": [{"seq": 9, "type": "set_load", "edges": [edge], "ratio": 1.0}]})
    assert c.traffic.state[c.edge_ids[edge]].vehicles == 0  # the old component is retired


def test_bad_event_reports_an_error_and_does_not_raise():
    c = controller()
    batch(c, {"type": "set_load", "edges": [0], "ratio": -5})
    assert c.notices[-1]["kind"] == "error"


def car(c, route, idx=0, elapsed=0.0):
    return {"id": route.mode, "idx": idx, "offset": 0.0, "elapsed": elapsed, "travelled": 0.0, "done": False,
            "edges": [c.index[e] for e in route.edges]}


def test_simulation_cycle_keeps_the_users_traffic():
    c = controller()
    c.traffic.apply_preset("busy")
    set_pins(c, (0, 0), (5, 5))
    before = {e: t.vehicles for e, t in c.traffic.state.items()}
    batch(c, {"type": "sim_start"})
    assert c.sim["status"] == "running" and len(c.sim["cars"]) == len(c.options)
    batch(c, {"type": "sim_tick", "cars": [car(c, c.options[0], elapsed=31.0)]})
    assert {e: t.vehicles for e, t in c.traffic.state.items()} != before  # simulated swing happened
    batch(c, {"type": "sim_pause"})
    assert c.sim["status"] == "paused"
    batch(c, {"type": "preset", "name": "calm"})  # setup changes are refused during a drive
    assert "Reset the drive" in c.notices[-1]["text"]
    batch(c, {"type": "sim_resume"})
    assert c.sim["status"] == "running"
    batch(c, {"type": "sim_reset"})
    assert c.sim is None and {e: t.vehicles for e, t in c.traffic.state.items()} == before


def test_edit_during_drive_survives_the_end_but_temporary_closure_does_not():
    c = controller()
    set_pins(c, (0, 0), (5, 5))
    batch(c, {"type": "sim_start"})
    batch(c, {"type": "set_load", "edges": [0], "ratio": 1.0},
          {"type": "set_closed", "edges": [1], "closed": True, "temporary": True})
    assert c.traffic.state[c.edge_ids[1]].closed
    batch(c, {"type": "sim_finish", "cars": [dict(car(c, c.options[0]), elapsed=100.0, done=True)]})
    assert c.sim["status"] == "finished" and c.sim["results"]["winner"] == MASAR
    assert c.traffic.state[c.edge_ids[0]].vehicles > 0
    assert not c.traffic.state[c.edge_ids[1]].closed


def test_closure_ahead_produces_a_connected_new_plan_from_the_cars_position():
    c = controller()
    set_pins(c, (0, 0), (5, 5))
    route = c.options[0]
    batch(c, {"type": "sim_start"})
    ahead = c.index[route.edges[3]]
    batch(c, {"type": "set_closed", "edges": [ahead], "closed": True, "temporary": True},
          {"type": "sim_tick", "cars": [car(c, route, idx=1)]})
    prop = c.proposals[-1]
    assert prop["car"] == MASAR and prop["closed"] and prop["from_idx"] == 1
    assert prop["edges"][:2] == [c.index[e] for e in route.edges[:2]]  # no teleport: the driven part is untouched
    assert ahead not in prop["edges"]
    nodes = [c.network.edge(c.edge_ids[i]) for i in prop["edges"]]
    assert all(a[1] == b[0] for a, b in zip(nodes, nodes[1:]))
    assert nodes[-1][1] == (5, 5)


def test_pin_cannot_change_during_drive_and_new_pins_replace_finished_drive():
    c = controller()
    set_pins(c, (0, 0), (5, 5))
    batch(c, {"type": "sim_start"})
    lat, lng = c.network.node_latlon((3, 3))
    batch(c, {"type": "set_pin", "which": "a", "lat": lat, "lng": lng})
    assert c.origin == (0, 0) and "Reset the drive" in c.notices[-1]["text"]
    batch(c, {"type": "sim_finish", "cars": [dict(car(c, c.options[0]), elapsed=100.0, done=True)]})
    assert c.sim["status"] == "finished"
    batch(c, {"type": "set_pin", "which": "a", "lat": lat, "lng": lng})
    assert c.origin == (3, 3) and c.sim is None
    batch(c, {"type": "sim_start"})
    first = c.network.edge(c.edge_ids[c.sim["cars"][0]["edges"][0]])[0]
    assert first == (3, 3)  # the new drive leaves from the new pin


def test_rebuild_from_browser_matches_python_simulator_rule():
    """Browser and server move cars by one rule: segment length / model speed, summed along the plan."""
    net = make_grid(5)
    tr = TrafficManager(net)
    tr.apply_preset("busy")
    eng = RoutingEngine(net, tr)
    route = eng.route((0, 0), (4, 4))
    sim = VehicleSimulator(eng, ReroutePolicy(enabled=False))
    sim.start((0, 0), (4, 4), MASAR, nodes=route.nodes)
    sim.run_to_completion(dt=0.5)
    speeds = [cf.kph_to_mps(tr.speed_kph(e, eng.params)) for e in route.edges]
    browser_rule = sum(net.edge_data(e)["length"] / s for e, s in zip(route.edges, speeds))
    assert sim.vehicle.elapsed_s == pytest.approx(browser_rule, abs=1e-6)
    assert route.est_time_s == pytest.approx(browser_rule, abs=1e-6)


def test_restore_brings_setup_back_only_once():
    c = controller()
    c.traffic.set_load([c.edge_ids[0]], 1.0)
    set_pins(c, (0, 0), (5, 5))
    saved = {"traffic": c.view()["saved_traffic"], "a": c.origin, "b": c.dest, "selected": MASAR}
    fresh = controller()
    assert fresh.view()["fresh"]
    batch(fresh, {"type": "restore", "saved": saved})
    assert not fresh.fresh and fresh.origin == (0, 0) and fresh.options
    assert fresh.traffic.state[fresh.edge_ids[0]].vehicles == c.traffic.state[c.edge_ids[0]].vehicles
    batch(fresh, {"type": "clear_traffic"}, {"type": "restore", "saved": saved})
    assert fresh.traffic.state[fresh.edge_ids[0]].vehicles == 0


def test_view_is_json_serialisable_and_counts_each_road_once():
    import json

    c = controller(make_diamond())
    set_pins(c, "A", "D")
    view = c.view()
    json.dumps(view)
    assert view["dash"]["roads"] == 5 and view["roads"]["edges"]
    c.on_roads_ok({"key": "test"})
    assert c.view()["roads"] is None
