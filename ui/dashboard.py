"""MASAR Streamlit dashboard: layout, state and interaction wiring."""
from __future__ import annotations

import time
from pathlib import Path

import pandas as pd
import streamlit as st
import streamlit.components.v1 as components

from core import cost_function as cf
from core.experiment import DynamicTraffic, run_experiment, verdict
from core import many_drivers as md
from core.i18n import AR, language, set_language, tx, tx_event
from core.map_loader import DEFAULT_AREA, GOVERNORATE_AREA, MapArea, MapLoadError, cache_paths, geocode_online, load_network
from core.places import cached_places, fetch_places_in_background
from core.routing_engine import DISTANCE, MASAR, NoRouteError
from core.traffic_manager import CapacityParams, TrafficManager
from core.vehicle_simulator import ReroutePolicy
from ui import statistics, traffic_controls
from ui.play_controller import PlayController
from ui.statistics import fmt_time

ss = st.session_state

PLAY, TABLE, DRIVERS, EXPERIMENT, MODEL = "Play", "Traffic table", "Many drivers", "Experiment", "Model & data"

AREA_PRESETS = {
    "Central Ramallah": (DEFAULT_AREA, "About 3 × 3 km around Al-Manara. The default map."),
    "Compact centre": (MapArea("Central Ramallah compact", 31.9038, 35.2042, 1000), "About 2 × 2 km. Quick and close-up."),
    "Ramallah & Al-Bireh": (MapArea("Ramallah & Al-Bireh", 31.9060, 35.2110, 3000), "About 6 × 6 km. The widest view."),
    "Ramallah villages": (GOVERNORATE_AREA, "The whole governorate with its villages. The biggest map, so it is slower."),
}

_map_component = components.declare_component("masar_map", path=str(Path(__file__).parent / "masar_map"))

CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Shrikhand&family=Lalezar&family=Space+Grotesk:wght@400;500;700&family=Baloo+Bhaijaan+2:wght@400;500;700&display=swap');

:root {
  --ink:#1d0f3a; --paper:#fffaf0; --cream:#fff4d9; --butter:#ffe3a3; --muted:#51416f;
  --pink:#ff3d8b; --orange:#ff8a3c; --yellow:#ffd21f; --teal:#19d3b4; --lilac:#c9a6ff; --violet:#5a2be0;
  --r:20px 7px 20px 7px; --r-sm:12px 5px 12px 5px; --pop:4px 4px 0 var(--ink);
  --sans:'Space Grotesk','Baloo Bhaijaan 2',system-ui,-apple-system,'Segoe UI',sans-serif;
  --display:Shrikhand,Lalezar,Georgia,serif;
}

/* ---------- typography (icons are left untouched) ---------- */
html, body, .stApp, [data-testid="stAppViewContainer"], [data-testid="stSidebar"],
p, label, li, input, textarea, button, select, table, td, th,
[data-testid="stMarkdownContainer"], [data-testid="stCaptionContainer"], [data-testid="stWidgetLabel"] {
  font-family: var(--sans) !important;
}
.stApp {background: repeating-conic-gradient(from 0deg at 50% -8%, var(--cream) 0 7deg, #ffeec4 7deg 14deg);}
h1, h2, h3, h4 {font-family: var(--display) !important; font-weight:400 !important; color:var(--violet);}
[data-testid="stMarkdownContainer"] h4 {font-size:1.7rem; margin:.3rem 0 .4rem 0; text-shadow:2px 2px 0 var(--yellow);}
.block-container {padding: .55rem 1rem .5rem 1rem !important; max-width: 100%;}
header[data-testid="stHeader"] {background:transparent; height:0;}
/* its toolbar overlays the top menu, and Streamlit turns it back on for itself when the sidebar is collapsed */
header[data-testid="stHeader"], header[data-testid="stHeader"] div {pointer-events:none !important;}
header[data-testid="stHeader"] button, header[data-testid="stHeader"] a {pointer-events:auto !important;}
[data-testid="stStatusWidget"], [data-testid="stDecoration"] {display:none;}
/* frequent map updates must not dim the screen */
[data-stale="true"] {opacity:1 !important;}
[data-testid="stElementContainer"]:has(iframe) {margin-bottom:0;}
[data-testid="stVerticalBlock"] {gap:.55rem;}

/* ---------- sidebar ---------- */
[data-testid="stSidebar"] {background:var(--butter); border-right:3px solid var(--ink);}
[data-testid="stSidebar"] h3 {font-size:1.25rem !important; color:var(--violet) !important; margin-top:1.2rem !important;
  padding-bottom:.3rem; margin-bottom:.6rem !important; border-bottom:3px dashed var(--ink);}
[data-testid="stSidebar"] label p {color:var(--ink); font-size:.82rem; font-weight:500;}

/* ---------- header ---------- */
.masar-brand {display:flex; align-items:center; gap:12px; min-height:46px; padding-left:34px;} /* clear of the sidebar button */
.masar-logo {font-family:var(--display); font-size:38px; line-height:1; color:var(--pink); text-shadow:2px 2px 0 var(--ink), 4px 4px 0 var(--yellow);}
.masar-logo span {color:var(--teal);}
.masar-ar {font-family:'Lalezar',serif; font-size:22px; line-height:1; padding:5px 10px 3px; color:var(--ink); background:var(--yellow);
  border:3px solid var(--ink); border-radius:var(--r-sm); box-shadow:2px 2px 0 var(--ink); transform:rotate(-5deg);}
.masar-sub {color:var(--ink); font-size:12px; font-weight:700;}
@media (max-width:760px) {.masar-sub {display:none;}}
[data-testid="stButtonGroup"] > div {flex-wrap:wrap;}
[data-testid="stButtonGroup"] button {background:var(--paper) !important; color:var(--ink) !important; border:2.5px solid var(--ink) !important;
  border-radius:var(--r-sm) !important; margin-right:6px; box-shadow:2px 2px 0 var(--ink); transition:transform .1s ease, background .12s ease;}
[data-testid="stButtonGroup"] button:hover {background:var(--yellow) !important; transform:translate(-1px,-1px) rotate(-1deg);}
[data-testid="stButtonGroup"] button[aria-checked="true"] {background:var(--pink) !important;}
[data-testid="stButtonGroup"] button p {color:var(--ink) !important; font-weight:700 !important;}

/* ---------- cards / panels ---------- */
.masar-note {background:var(--paper); border:3px solid var(--ink); box-shadow:var(--pop);
  padding:12px 16px; border-radius:var(--r); font-size:13.5px; line-height:1.6; margin:4px 4px 16px 0;}
.masar-note b {color:var(--violet);}
.masar-reco {background:var(--teal); border:3px solid var(--ink); box-shadow:var(--pop);
  padding:12px 16px; border-radius:var(--r); color:var(--ink); margin:10px 4px 16px 0; line-height:1.6;}
[data-testid="stMetric"] {background:var(--yellow); border:3px solid var(--ink); border-radius:var(--r-sm); box-shadow:var(--pop); padding:10px 14px;}
[data-testid="column"]:nth-child(2n) [data-testid="stMetric"], [data-testid="stColumn"]:nth-child(2n) [data-testid="stMetric"] {background:var(--lilac);}
[data-testid="stColumn"]:nth-child(3n) [data-testid="stMetric"] {background:var(--teal);}
[data-testid="stMetricLabel"] p {font-size:.72rem !important; font-weight:700; color:var(--ink) !important;}
[data-testid="stMetricValue"], [data-testid="stMetricValue"] * {font-family:var(--display) !important; font-size:1.35rem !important; color:var(--ink);}
[data-testid="stExpander"] details {border:3px solid var(--ink) !important; border-radius:var(--r-sm) !important; background:var(--paper);}
[data-testid="stDataFrame"], [data-testid="stDataEditor"] {border:3px solid var(--ink); border-radius:var(--r-sm); overflow:hidden;}
[data-testid="stForm"] {border:3px solid var(--ink) !important; border-radius:var(--r) !important; background:var(--paper); box-shadow:var(--pop);}
[data-testid="stCode"] {border:3px solid var(--ink); border-radius:var(--r-sm); overflow:hidden;}

/* ---------- buttons & inputs ---------- */
.stButton button, .stDownloadButton button, [data-testid="stFormSubmitButton"] button {
  border-radius:var(--r-sm) !important; border:2.5px solid var(--ink) !important; background:var(--paper) !important; color:var(--ink) !important;
  font-weight:700; box-shadow:3px 3px 0 var(--ink); transition: transform .1s ease, box-shadow .1s ease, background .12s ease;}
.stButton button:hover, .stDownloadButton button:hover, [data-testid="stFormSubmitButton"] button:hover {
  background:var(--yellow) !important; transform:translate(-1px,-1px) rotate(-.6deg); box-shadow:4px 4px 0 var(--ink);}
.stButton button:active, .stDownloadButton button:active, [data-testid="stFormSubmitButton"] button:active {
  transform:translate(3px,3px); box-shadow:none;}
button[kind="primary"], button[kind="primaryFormSubmit"], [data-testid="stBaseButton-primary"],
[data-testid="stBaseButton-primaryFormSubmit"] {background:var(--pink) !important;}
button[kind="primary"]:hover, button[kind="primaryFormSubmit"]:hover, [data-testid="stBaseButton-primary"]:hover,
[data-testid="stBaseButton-primaryFormSubmit"]:hover {background:var(--orange) !important;}
[data-baseweb="select"] > div, [data-baseweb="input"] > div, .stTextInput input, .stNumberInput input {
  border-radius:var(--r-sm) !important; background:var(--paper) !important;}
[data-baseweb="select"] > div, [data-baseweb="input"] {border:2.5px solid var(--ink) !important; border-radius:var(--r-sm) !important;}
</style>
"""

# Arabic runs right to left. Tables, charts, sliders and code keep their own direction.
CSS_ARABIC = """
<style>
:root {--sans:'Baloo Bhaijaan 2','Space Grotesk',system-ui,-apple-system,'Segoe UI',sans-serif; --display:Lalezar,Shrikhand,Georgia,serif;}
[data-testid="stMain"] .block-container, [data-testid="stSidebarContent"] {direction:rtl;}
[data-testid="stDataFrame"], [data-testid="stDataEditor"], [data-testid="stCode"], [data-testid="stVegaLiteChart"],
[data-testid="stSlider"] > div:last-child, [data-testid="stJson"], pre, code {direction:ltr; text-align:left;}
[data-testid="stMarkdownContainer"] h4 {font-size:1.9rem; line-height:1.4;}
[data-testid="stMarkdownContainer"] ul {padding:0 1.1rem 0 0;}
[data-testid="stMarkdownContainer"] li {margin:0;}
.masar-brand {padding-left:0; padding-right:0;}
.masar-logo {letter-spacing:0;}
</style>
"""


# ----------------------------------------------------------------- helpers
@st.cache_resource(show_spinner=False)
def _load_cached(area: MapArea):
    return load_network(area)


def _apply_language() -> None:
    set_language(st.query_params.get("lang", "en"))


def _switch_language() -> None:
    st.query_params["lang"] = "en" if st.query_params.get("lang") == AR else AR


def _node_label(node) -> str:
    return ss.ctl._place_label(node) if node is not None else "—"


def _area_options() -> list[dict]:
    custom = ss.get("custom_area")
    areas = dict(AREA_PRESETS)
    if custom:
        areas["Custom area"] = (custom, tx("Your own area, half-width {dist} m.", dist=custom.dist_m))
    return [{"key": a.cache_key(), "label": tx(name), "desc": tx(desc), "cached": cache_paths(a)[0].exists(),
             "default": a == DEFAULT_AREA} for name, (a, desc) in areas.items()]


def _area_by_key(key: str) -> MapArea | None:
    custom = ss.get("custom_area")
    for area in [a for a, _ in AREA_PRESETS.values()] + ([custom] if custom else []):
        if area.cache_key() == key:
            return area
    return None


def _init_state(area: MapArea, network) -> None:
    net_key = (area.cache_key(), network.meta.get("downloaded_at"))
    if ss.get("net_key") == net_key:
        return
    ss.net_key = net_key
    ss.network = network
    ss.traffic = TrafficManager(network, CapacityParams())
    ss.ctl = PlayController(network, ss.traffic, ss.params, ss.policy, area.cache_key(), _area_options(),
                            cached_places(area), geocode_online)
    fetch_places_in_background(area)
    ss.experiment = None
    ss.drivers_run = None


# ----------------------------------------------------------------- sidebar
def _sidebar() -> None:
    sb = st.sidebar
    sb.markdown(f"### {tx('Custom map')}")
    with sb.form("custom_area"):
        lat = st.number_input(tx("Centre latitude"), value=31.9038, format="%.5f")
        lon = st.number_input(tx("Centre longitude"), value=35.2042, format="%.5f")
        dist = st.slider(tx("Half-width (m)"), 300, 5000, 1500, 100)
        if st.form_submit_button(tx("Load area"), help=tx("Needs internet the first time an area is used")):
            ss.custom_area = MapArea("Custom area", round(lat, 5), round(lon, 5), int(dist))
            ss.area = ss.custom_area
    if sb.button(tx("Re-download from OpenStreetMap"), help=tx("Ignore the local cache and fetch fresh OSM data")):
        ss.force_refresh = True

    sb.markdown(f"### {tx('Cost model')}")
    alpha = sb.slider(tx("Congestion penalty α"), 0.0, 10.0, 2.0, 0.1, key="sb_alpha",
                      help="factor = 1 + α·(vehicles/capacity)^β")
    beta = sb.slider(tx("Penalty steepness β"), 1.0, 8.0, 4.0, 0.5, key="sb_beta")
    maxf = sb.slider(tx("Max slowdown factor"), 2.0, 50.0, 20.0, 1.0, key="sb_maxf")
    spacing = sb.slider(tx("Capacity: metres per vehicle per lane"), 6.0, 50.0, 20.0, 1.0, key="sb_spacing",
                        help=tx("Estimated capacity = lanes × length / this value (unless overridden)"))
    ss.params = cf.CostParams(alpha=alpha, beta=beta, max_factor=maxf).validated()
    ss.spacing = spacing

    sb.markdown(f"### {tx('Re-routing (MASAR vehicle)')}")
    ss.policy = ReroutePolicy(
        enabled=sb.checkbox(tx("Enable dynamic re-routing"), value=True, key="sb_reroute"),
        min_improvement_pct=sb.slider(tx("Min improvement (%)"), 0.0, 50.0, 10.0, 1.0, key="sb_min_pct"),
        min_improvement_s=sb.slider(tx("Min improvement (s)"), 0.0, 120.0, 10.0, 1.0, key="sb_min_s"),
        check_interval_s=sb.slider(tx("Periodic check every (simulated s)"), 5.0, 120.0, 15.0, 5.0, key="sb_check"),
        check_on_traffic_change=sb.checkbox(tx("Check immediately when traffic changes"), value=True, key="sb_on_change"),
    )
    sb.caption(tx("A new route is adopted only if it saves at least max(min %, min s) of the remaining time. "
                  "The vehicle always finishes its current segment first."))


# ------------------------------------------------------------ play screen
@st.fragment
def _play_screen():
    _apply_language()  # a fragment run does not pass through main()
    ctl = ss.ctl
    ctl.handle_batch(ss.get("masar_play"))
    if not ctl.places:  # a background download may have finished
        ctl.set_places(cached_places(ss.area))
    if ctl.want_area:
        area = _area_by_key(ctl.want_area)
        ctl.want_area = None
        if area is not None:
            ss.area = area
            st.rerun(scope="app")
    _map_component(view=ctl.view(), key="masar_play", default=None)


# -------------------------------------------------------------- experiment
def _experiment_tab():
    ctl = ss.ctl
    note = tx("Experiment mode drives three simulated vehicles from the same origin to "
              "the same destination under identical traffic: <b>A</b> shortest distance, <b>B</b> fastest "
              "free-flow (no congestion awareness), <b>C</b> MASAR traffic-aware with re-routing. Results are "
              "<b>simulated estimates</b> from MASAR's traffic model and the current (simulated / user-defined) "
              "inputs — not real-world measurements.")
    st.markdown(f'<div class="masar-note">{note}</div>', unsafe_allow_html=True)
    if ctl.origin is None or ctl.dest is None or ctl.origin == ctl.dest:
        st.info(tx("Place A and B on two different roads in the {screen} screen first.", screen=tx(PLAY)))
        return
    st.caption(f"A · {_node_label(ctl.origin)}  ·  B · {_node_label(ctl.dest)}")
    with st.form("exp_form"):
        a, b, c, d = st.columns(4)
        dyn = a.checkbox(tx("Traffic changes during the trip"), value=True,
                         help=tx("Seeded random walk applied identically for every strategy"))
        seed = b.number_input(tx("Random seed"), value=7, step=1)
        interval = c.number_input(tx("Change every (sim s)"), value=30, min_value=5, step=5)
        vol = d.slider(tx("Volatility"), 0.0, 0.6, 0.15, 0.05)
        a, b, c, d = st.columns(4)
        inc = a.checkbox(tx("Scripted incident"), value=False,
                         help=tx("At a set time, the chosen segments jump to a high load. Same for all strategies."))
        inc_t = b.number_input(tx("Incident at (sim s)"), value=60, min_value=0, step=10)
        inc_ratio = c.slider(tx("Incident load (× capacity)"), 0.5, 5.0, 1.5, 0.1)
        target = d.selectbox(tx("Incident location"), ["Middle of initial MASAR route", "Middle of shortest-distance route",
                                                       "A named street"], format_func=tx)
        street = st.selectbox(tx("Street (if 'A named street')"), ss.network.street_names() or [""])
        dt = st.select_slider(tx("Simulation step (s)"), [0.5, 1.0, 2.0, 5.0], value=1.0)
        go = st.form_submit_button(tx("Run experiment"), type="primary")
    if go:
        eng = ctl.engine()
        try:
            routes = eng.compare(ctl.origin, ctl.dest)
        except NoRouteError as exc:
            st.error(str(exc))
            return
        edges = []
        if inc:
            if target.startswith("A named"):
                edges = ss.network.edges_of_street(street)
            else:
                r = routes[MASAR] if "MASAR" in target else routes[DISTANCE]
                n = len(r.edges)
                edges = r.edges[n // 3: max(n // 3 + 1, 2 * n // 3)]
        spec = DynamicTraffic(enabled=dyn, seed=int(seed), interval_s=float(interval), volatility=vol,
                              incident_enabled=inc, incident_time_s=float(inc_t), incident_ratio=inc_ratio,
                              incident_edges=edges)
        with st.spinner(tx("Simulating three vehicles…")):
            t0 = time.time()
            df = run_experiment(ss.network, ss.traffic, ss.params, ctl.origin, ctl.dest, ss.policy, spec, dt)
            ss.experiment = (df, spec, time.time() - t0)
    if ss.experiment:
        df, spec, took = ss.experiment
        st.markdown(f'<div class="masar-reco">{verdict(df)}</div>', unsafe_allow_html=True)
        statistics.render_experiment_results(df)
        with st.expander(tx("Event log per strategy")):
            for _, row in df.iterrows():
                st.markdown(f"**{tx(row['strategy'])}**")
                st.text("\n".join(f"[{fmt_time(t)}] {tx_event(m)}" for t, m in row["events"]))
        st.caption(tx("Computed in {took} s. Inputs: seed={seed}, dynamic={dynamic}, incident={incident} on {n} segments.",
                      took=f"{took:.1f}", seed=spec.seed, dynamic=spec.enabled, incident=spec.incident_enabled,
                      n=len(spec.incident_edges)))


# ------------------------------------------------------------ many drivers
def _show_drivers_on_map(loads: dict, text: str) -> None:
    ss.ctl.show_vehicle_counts(loads, text)
    ss.screen = PLAY


def _advice_colors() -> list[str]:
    """Violet for the shared advice and pink for the live one. Chart series are in sorted name order."""
    same, live = tx("Same advice"), tx("Sees other drivers")
    return ["#5a2be0", "#ff3d8b"] if same < live else ["#ff3d8b", "#5a2be0"]


def _drivers_key() -> tuple:
    return ss.traffic.version, tuple(ss.params.to_dict().values())


def _drivers_tab():
    note = tx("What if many people used MASAR at once? This adds a wave of simulated drivers, "
              "all on the road together, on top of the current traffic. <b>Habit drivers</b> take the route that is "
              "fastest on empty roads. <b>MASAR users</b> avoid traffic, either all from <b>the same advice</b>, based on "
              "the traffic before this wave, or from <b>advice that sees other drivers</b>. Results are "
              "<b>simulated estimates</b> from MASAR's traffic model, not real-world measurements.")
    st.markdown(f'<div class="masar-note">{note}</div>', unsafe_allow_html=True)
    with st.form("drivers_form"):
        a, b = st.columns([3, 1])
        drivers = a.slider(tx("Drivers on the road"), 100, 10000, 1000, 100,
                           help=tx("{n} sampled trips stand for all of them, so bigger numbers take no longer", n=md.MAX_SAMPLED_TRIPS))
        seed = b.number_input(tx("Random seed"), value=7, step=1, help=tx("The same seed gives the same trips"))
        go = st.form_submit_button(tx("Run many drivers"), type="primary")
    if go:
        bar = st.progress(0.0, tx("Sending drivers onto the roads…"))
        try:
            trips = md.sample_trips(ss.network, ss.traffic, ss.params, min(drivers, md.MAX_SAMPLED_TRIPS), int(seed))
            result = md.run_many_drivers(ss.network, ss.traffic, ss.params, trips, drivers,
                                         progress=lambda f: bar.progress(f, tx("Sending drivers onto the roads…")))
        except NoRouteError as exc:
            st.error(str(exc))
            return
        finally:
            bar.empty()
        ss.drivers_run = (result, _drivers_key())
    if not ss.get("drivers_run"):
        return
    result, key = ss.drivers_run
    if key != _drivers_key():
        st.warning(tx("Traffic or the cost model changed after this run. Run it again to see up-to-date results."))
        return
    table = result.table
    st.markdown(f'<div class="masar-reco">{md.verdict(table)}</div>', unsafe_allow_html=True)

    def lines(column):  # same order and colours in either language: the shared advice, then the live one
        same, live = tx("Same advice"), tx("Sees other drivers")
        return (table.assign(advice=table["advice"].map({md.SHARED: same, md.LIVE: live}))
                .pivot(index="share_pct", columns="advice", values=column)[sorted([same, live])])

    left, right = st.columns(2)
    left.markdown(f"**{tx('Average trip, all drivers (min)')}**")
    left.line_chart(lines("avg_time_s") / 60, color=_advice_colors(), x_label=tx("MASAR users (%)"), y_label=tx("Minutes"))
    right.markdown(f"**{tx('Congested roads (80% of capacity or more)')}**")
    right.line_chart(lines("congested_roads"), color=_advice_colors(), x_label=tx("MASAR users (%)"), y_label=tx("Road segments"))
    right.caption(tx("Spreading drivers out can raise this count while trips still get faster: "
                     "more roads are busy, but fewer are badly jammed."))

    st.markdown(f"#### {tx('Look closer')}")
    a, b = st.columns(2)
    share = a.select_slider(tx("MASAR users (%)"), sorted(table["share_pct"].unique()), value=50, key="drivers_share")
    advice = b.radio(tx("Advice"), [md.LIVE, md.SHARED], format_func=lambda a: tx(md.ADVICE_LABELS[a]), horizontal=True, key="drivers_advice")
    row = table[(table["advice"] == advice) & (table["share_pct"] == share)].iloc[0]
    base = table[(table["advice"] == advice) & (table["share_pct"] == 0)].iloc[0]
    c = st.columns(4)
    c[0].metric(tx("Average trip"), fmt_time(row["avg_time_s"]), tx("{d} min vs 0%", d=f"{(row['avg_time_s'] - base['avg_time_s']) / 60:+.1f}"),
                delta_color="inverse")
    c[1].metric(tx("{n} MASAR users", n=f"{row['users']:,}"), "—" if pd.isna(row["avg_users_s"]) else fmt_time(row["avg_users_s"]))
    c[2].metric(tx("{n} habit drivers", n=f"{result.drivers - row['users']:,}"),
                "—" if pd.isna(row["avg_others_s"]) else fmt_time(row["avg_others_s"]))
    c[3].metric(tx("Lost to traffic"), tx("{h} h", h=f"{row['delay_hours']:,.0f}"), tx("{d} h vs 0%", d=f"{row['delay_hours'] - base['delay_hours']:+,.0f}"),
                delta_color="inverse")
    loads = result.loads[(advice, share)]
    st.markdown(f"**{tx('Streets that gained the most vehicles')}**")
    st.dataframe(md.busiest_roads(ss.network, ss.traffic, loads), hide_index=True, width="stretch")
    st.button(tx("Show this on the Play map"), type="primary", on_click=_show_drivers_on_map,
              args=(loads, tx("{n} simulated drivers added, {share}% on MASAR.", n=f"{result.drivers:,}", share=share)),
              help=tx("Replaces the vehicle counts on the map. Undo on the Play screen brings them back"))
    st.caption(tx("{n} drivers, {trips} sampled trips. Nobody re-routes during the trip, and queues do not spill between roads.",
                  n=f"{result.drivers:,}", trips=min(result.drivers, md.MAX_SAMPLED_TRIPS)))


# ------------------------------------------------------------------- about
def _about_tab():
    p = ss.params
    about = """
#### How MASAR picks a route
For every directed road segment MASAR computes an estimated travel time:

```
congestion_ratio  = vehicles / max(capacity, 1)
congestion_factor = min(1 + α · ratio^β, max_factor)        α={alpha}, β={beta}, max={max_factor}
free_flow_time    = length / free_flow_speed
edge_cost         = free_flow_time × congestion_factor      (speed never below {min_speed} km/h)
```

* **Distance route** – Dijkstra on segment length.
* **Fastest route** – Dijkstra on free-flow time (ignores vehicles).
* **MASAR route** – A* on `edge_cost`, with an admissible straight-line heuristic, so it is exactly optimal for the model.
  It will choose a longer road whenever that road's estimated time is lower.
* **Alternatives** – found by making roads already used more expensive and searching again; the penalty is used only in
  that search, and every route is then scored under the same true traffic.

Only segments that exist in the directed OSM graph are used, so one-way streets are respected; closed segments are excluded.

#### What the trip numbers mean
* **Delay** – estimated time minus the time on empty roads.
* **Traffic density** – vehicles ÷ capacity, averaged along the route by length.
* **Efficiency** – time on empty roads ÷ estimated time. 100% means traffic adds no delay.
* **Time saved** – compared with the slowest route offered, or measured in the drive when one has finished.

These come from the model above. Traffic signals, turn delays and queues are not modelled, so they are not predictions of real trips.

#### Data provenance
* **Roads** – real OpenStreetMap data (© OpenStreetMap contributors, ODbL) downloaded with OSMnx and cached locally.
* **Landmarks** – named places from OpenStreetMap, cached locally.
* **Vehicle counts** – simulated / user-defined inputs. No live traffic feed is connected.
* **Capacity** – estimated as lanes × length / {spacing} m unless overridden.
* **Free-flow speed** – OSM `maxspeed` where tagged, otherwise a default for the road type (an assumption).
"""
    if language() == AR:
        about = tx("__ABOUT__")
    st.markdown(about.format(alpha=f"{p.alpha:g}", beta=f"{p.beta:g}", max_factor=f"{p.max_factor:g}",
                             min_speed=f"{p.min_speed_kph:g}", spacing=f"{ss.spacing:g}"))
    ratios = [i / 20 for i in range(0, 41)]
    st.markdown(f"**{tx('Congestion factor vs. load (current parameters)')}**")
    st.line_chart(pd.DataFrame({tx("load (vehicles / capacity)"): ratios,
                                tx("slowdown factor"): [cf.congestion_factor(r, p) for r in ratios]})
                  .set_index(tx("load (vehicles / capacity)")), color="#ff3d8b")
    meta = ss.network.meta
    st.markdown(f"#### {tx('Loaded network')}")
    st.json({**ss.network.summary(), "source": meta.get("source"), "downloaded_at": meta.get("downloaded_at"),
             "area": meta.get("area")}, expanded=False)


# -------------------------------------------------------------------- main
def _load_area(area: MapArea, force: bool):
    with st.spinner(tx("Loading the OpenStreetMap road network for {area}… "
                       "(first download can take a minute; it is cached afterwards)", area=tx(area.label))):
        if force:
            _load_cached.clear()
            return load_network(area, force_refresh=True)
        return _load_cached(area)


def main():
    _apply_language()
    st.markdown(CSS, unsafe_allow_html=True)
    if language() == AR:
        st.markdown(CSS_ARABIC, unsafe_allow_html=True)
    brand, nav, switch = st.columns([1, 1.45, .25], vertical_alignment="center")
    brand.markdown(
        '<div class="masar-brand"><div class="masar-logo">MAS<span>A</span>R</div><div class="masar-ar">مسار</div>'
        f'<div class="masar-sub">{tx("Traffic routing playground")}</div></div>', unsafe_allow_html=True)
    view = nav.segmented_control("Screen", [PLAY, TABLE, DRIVERS, EXPERIMENT, MODEL], default=PLAY, key="screen",
                                 format_func=tx, label_visibility="collapsed") or PLAY
    switch.button("English" if language() == AR else "العربية", key="language_switch", on_click=_switch_language,
                  width="stretch")

    _sidebar()
    area = ss.setdefault("area", DEFAULT_AREA)

    force = ss.pop("force_refresh", False)
    try:
        res = _load_area(area, force)
    except MapLoadError as exc:
        previous = ss.get("ctl")
        if previous is not None and previous.area_key != area.cache_key():
            # Stay on the map that works and say why, so the current setup is not lost.
            ss.area = _area_by_key(previous.area_key) or DEFAULT_AREA
            previous.notify(tx("That map could not be downloaded. Check your internet connection and try again."), "error")
            st.rerun()
        st.error(tx("**Could not load the road network.** {error}", error=exc))
        st.markdown(tx("MASAR needs a one-time internet connection to download the OpenStreetMap data for an area. "
                       "After that it works offline from `data/cache/`."))
        if st.button(tx("Retry")):
            _load_cached.clear()
            st.rerun()
        return

    _init_state(area, res.network)
    ss.traffic.set_vehicle_spacing(ss.spacing)
    ctl = ss.ctl
    ctl.params, ctl.policy, ctl.areas = ss.params, ss.policy, _area_options()
    if ctl.sim and view != PLAY:
        ctl.on_sim_reset({})  # the animation lives on the map screen, so leaving it ends the drive
    s = ss.network.summary()
    st.sidebar.caption(f"{res.message}  \n" + tx("{i} intersections · {s} directed segments · {k} km · {o} one-way · {n} named streets",
                                                  i=s["intersections"], s=s["segments"], k=f"{s['total_km']:.0f}",
                                                  o=s["one_way_segments"], n=s["streets"]))

    if flash := ss.pop("flash", None):
        st.success(flash)

    if view == PLAY:
        _play_screen()
        return
    ctl.client_roads = None  # the map is rebuilt on return
    if view == TABLE:
        traffic_controls.render(ss.network, ss.traffic, ss.params)
    elif view == DRIVERS:
        _drivers_tab()
    elif view == EXPERIMENT:
        _experiment_tab()
    else:
        _about_tab()
