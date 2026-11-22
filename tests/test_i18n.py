"""The Arabic mode: nothing shown through tx() may lack a translation, and values must survive it."""
import ast
import re
from pathlib import Path

import pytest

from core.cost_function import CostParams
from core.experiment import STRATEGIES, verdict as experiment_verdict
from core.i18n import AR, ARABIC, EN, language, set_language, tx, tx_event
from core.many_drivers import ADVICE_LABELS
from core.places import CATEGORIES
from core.traffic_manager import PRESETS, TrafficManager
from core.vehicle_simulator import ReroutePolicy
from tests.conftest import make_grid
from ui.play_controller import PlayController, ROUTE_LABELS

ROOT = Path(__file__).resolve().parent.parent
FIELD = re.compile(r"\{(\w*)")


@pytest.fixture(autouse=True)
def back_to_english():
    yield
    set_language(EN)


def _python_keys():
    keys = set()
    for path in [*(ROOT / "core").glob("*.py"), *(ROOT / "ui").glob("*.py")]:
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            if isinstance(node, ast.Call) and getattr(node.func, "id", "") == "tx" and node.args:
                arg = node.args[0]
                if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                    keys.add(arg.value)
    return keys


def _js():
    return (ROOT / "ui" / "masar_map" / "app.js").read_text(encoding="utf-8")


def _js_arabic():
    source = (ROOT / "ui" / "masar_map" / "i18n.js").read_text(encoding="utf-8")
    pairs = re.findall(r"""(?:'((?:[^'\\]|\\.)*)'|"([^"]*)"): '((?:[^'\\]|\\.)*)'""", source)
    return {a or b: text for a, b, text in pairs}


def _js_keys():
    code = _js()
    keys = {a or b for a, b in re.findall(r"""\btx\(\s*(?:'((?:[^'\\]|\\.)*)'|"([^"]*)")""", code)}
    for pair in re.findall(r"""\btx\([^()]*?\?\s*'([^']*)'\s*:\s*'([^']*)'""", code):  # tx(a ? 'x' : 'y')
        keys.update(pair)
    keys.update(re.findall(r"label: '([^']+)'", code))         # traffic levels
    keys.update(re.findall(r"range: '([^']+)'", code))
    keys.update(re.findall(r"'([^']+)'", re.search(r"const STEPS = \[(.*?)\]", code).group(1)))
    keys.update(re.findall(r"(\w+): 'tiles", code) + ["Streets"])
    keys.update(re.findall(r"\w+: '([^']+)'", re.search(r"tx\(\{(setup:.*?)\}\[status\]", code).group(1)))
    keys.update(["Where do you start?", "Where are you going?", "Start", "Destination", "Results", "The drive"])
    return keys


def test_every_server_text_has_arabic():
    assert sorted(k for k in _python_keys() if k not in ARABIC) == []


def test_every_table_of_labels_has_arabic():
    labels = [*ROUTE_LABELS.values(), *ADVICE_LABELS.values(), *(s[3] for s in STRATEGIES), *(c[1] for c in CATEGORIES)]
    for preset in PRESETS.values():
        labels += [preset["label"], preset["hint"]]
    assert sorted(k for k in labels if k not in ARABIC) == []


def test_every_map_screen_text_has_arabic():
    table = _js_arabic()
    assert len(table) > 150
    assert sorted(k for k in _js_keys() if k not in table) == []


@pytest.mark.parametrize("key,text", sorted(ARABIC.items()))
def test_python_translation_keeps_the_same_values(key, text):
    if key != "__ABOUT__":
        assert set(FIELD.findall(key)) == set(FIELD.findall(text))


def test_map_translation_keeps_the_same_values():
    for key, text in _js_arabic().items():
        if " closed direction" in key or " route (model)" in key or " car set off" in key:  # the singular says "one" in words
            continue
        assert set(FIELD.findall(key)) == set(FIELD.findall(text)), key


def test_english_stays_the_default_and_values_fill_in():
    assert language() == EN
    assert tx("{s} s", s=5) == "5 s"
    set_language(AR)
    assert tx("{s} s", s=5) == "5 ث"
    assert tx("A text with no translation") == "A text with no translation"
    set_language("anything else")
    assert language() == EN


def test_event_log_lines_translate_with_their_numbers():
    set_language(AR)
    assert tx_event("Arrived at destination") == ARABIC["Arrived at destination"]
    line = tx_event("Re-routed from node 7: saves 12 s (threshold 10 s)")
    assert "7" in line and "12" in line and "10" in line and "saves" not in line
    assert "(" not in tx_event("Departed on masar route, estimated 90 s").split("90")[0] and "masar" not in tx_event("Departed on masar route, estimated 90 s")


def test_switching_language_translates_the_view_and_keeps_the_setup():
    net = make_grid(6)
    c = PlayController(net, TrafficManager(net), CostParams(), ReroutePolicy(), "test")
    nodes = list(net.G.nodes)
    c.origin, c.dest = nodes[0], nodes[-1]
    c.compute_routes()
    english = c.view()
    assert english["lang"] == EN and english["routes"][0]["label"] == "MASAR route"
    notices = len(c.notices)
    set_language(AR)
    arabic = c.view()
    assert arabic["lang"] == AR
    assert arabic["routes"][0]["label"] == ARABIC["MASAR route"]
    assert arabic["explanation"] != english["explanation"]
    assert [r["time_s"] for r in arabic["routes"]] == [r["time_s"] for r in english["routes"]]
    assert len(c.notices) == notices  # a language switch is not "traffic changed"


def test_a_reroute_for_a_closure_is_still_recognised_in_arabic():
    """The re-route logic reads the simulator's event text, so that text must stay English."""
    set_language(AR)
    net = make_grid(6)
    c = PlayController(net, TrafficManager(net), CostParams(), ReroutePolicy(), "test")
    nodes = list(net.G.nodes)
    c.origin, c.dest = nodes[0], nodes[-1]
    c.compute_routes()
    c.handle_batch({"cid": "x", "events": [{"seq": 1, "type": "sim_start", "live": False}]})
    car = c.sim["cars"][0]
    ahead = car["edges"][2]
    c.handle_batch({"cid": "x", "events": [
        {"seq": 2, "type": "set_closed", "edges": [ahead], "closed": True, "temporary": True},
        {"seq": 3, "type": "sim_tick", "cars": [{**car, "idx": 0, "offset": 0.0, "elapsed": 1.0}]}]})
    assert c.proposals and c.proposals[-1]["closed"]


def test_verdicts_come_out_in_arabic():
    import pandas as pd
    set_language(AR)
    df = pd.DataFrame([
        {"key": "A", "strategy": STRATEGIES[0][3], "final_time_s": 300.0, "arrived": True},
        {"key": "B", "strategy": STRATEGIES[1][3], "final_time_s": 320.0, "arrived": True},
        {"key": "C", "strategy": STRATEGIES[2][3], "final_time_s": 250.0, "arrived": True}])
    text = experiment_verdict(df)
    assert "250" in text and "simulated" not in text
