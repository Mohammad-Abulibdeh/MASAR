"""Manual traffic management panel."""
from __future__ import annotations

import json
import re
from pathlib import Path

import pandas as pd
import streamlit as st

from core import cost_function as cf
from core.graph_manager import RoadNetwork
from core.i18n import language, tx
from core.traffic_manager import TrafficManager

SCENARIO_DIR = Path(__file__).resolve().parent.parent / "data" / "scenarios"
MAX_EDITOR_ROWS = 400
EDITABLE = ["vehicles", "capacity", "free_speed_kph", "closed"]


def _segment_label(network: RoadNetwork, eid: str) -> str:
    d = network.edge_data(eid)
    arrow = "→" if d.get("oneway") else "⇄"
    return f"{network.display_name(d)}  ·  {eid}  {arrow}  {d['length']:.0f} m"


def render(network: RoadNetwork, traffic: TrafficManager, params: cf.CostParams) -> None:
    note = tx("No live traffic feed is connected. Every vehicle count below is a "
              "<b>simulated, user-defined input</b>. Capacity is <b>estimated</b> from lanes × length unless you "
              "override it; free-flow speed comes from the OSM <code>maxspeed</code> tag or a default for the road type. "
              "The <i>source</i> columns show where each value came from.")
    st.markdown(f'<div class="masar-note">{note}</div>', unsafe_allow_html=True)

    s = traffic.summary()
    c = st.columns(6)
    c[0].metric(tx("Segments"), s["segments"])
    c[1].metric(tx("With input"), s["segments_with_input"])
    c[2].metric(tx("Vehicles (input)"), s["total_vehicles"])
    c[3].metric(tx("Moderate"), s["moderate"])
    c[4].metric(tx("High"), s["high"])
    c[5].metric(tx("Closed"), s["closed"])

    q_col, f_col, o_col = st.columns([2.2, 1.4, 1])
    query = q_col.text_input(tx("Search street (Arabic or English), ref or segment ID"), key="tc_query",
                             placeholder=tx("e.g. الإرسال, Irsal, Main, 12345-67890"))
    levels = f_col.multiselect(tx("Congestion level"), ["low", "moderate", "high"], key="tc_levels", format_func=tx, placeholder=tx("Choose levels"))
    only_input = o_col.checkbox(tx("Only segments with input"), key="tc_only_input")

    ids = network.search_edges(query)
    df = traffic.dataframe(params, ids) if ids else pd.DataFrame()
    if not df.empty:
        if levels:
            df = df[df["level"].isin(levels)]
        if only_input:
            df = df[df["vehicles_source"] != "none"]
    st.caption(tx("{n} matching segments", n=len(df)) + (tx(" (showing first {n})", n=MAX_EDITOR_ROWS) if len(df) > MAX_EDITOR_ROWS else ""))

    tab_table, tab_street, tab_segment, tab_scen = st.tabs(
        [tx("Segment table (editable)"), tx("Whole street"), tx("Single segment"), tx("Scenarios & reset")])

    with tab_table:
        _render_editor(traffic, df.head(MAX_EDITOR_ROWS), query, levels, only_input)
    with tab_street:
        _render_street_form(network, traffic, query)
    with tab_segment:
        _render_segment_form(network, traffic, params, list(df["edge_id"]) if not df.empty else [])
    with tab_scen:
        _render_scenarios(traffic)


def _render_editor(traffic: TrafficManager, df: pd.DataFrame, query, levels, only_input) -> None:
    if df.empty:
        st.info(tx("No segments match the search."))
        return
    view = df[["edge_id", "name", "highway", "oneway", "length_m", "vehicles", "capacity", "free_speed_kph",
               "closed", "congestion_pct", "avg_speed_kph", "travel_time_s", "vehicles_source",
               "capacity_source", "speed_source"]].reset_index(drop=True)
    if language() != "en":  # shown text only; edits are matched to segments by edge_id
        view["highway"] = view["highway"].map(lambda h: tx(h.replace("_", " ")))
        view["name"] = view["name"].map(lambda n: tx("Unnamed road") if n.startswith("Unnamed ") else n)
        for column in ("vehicles_source", "capacity_source", "speed_source"):
            view[column] = view[column].map(tx)
    key = f"editor_{hash((query, tuple(levels or []), only_input))}_{traffic.version}_{language()}"
    edited = st.data_editor(
        view, key=key, hide_index=True, width="stretch", height=430,
        disabled=[c for c in view.columns if c not in EDITABLE],
        column_config={
            "edge_id": st.column_config.TextColumn(tx("Road ID")),
            "name": st.column_config.TextColumn(tx("Road name"), width="medium"),
            "highway": st.column_config.TextColumn(tx("Type")),
            "oneway": st.column_config.CheckboxColumn(tx("One-way")),
            "length_m": st.column_config.NumberColumn(tx("Length (m)"), format="%.0f"),
            "vehicles": st.column_config.NumberColumn(tx("Vehicles ✎"), min_value=0, max_value=100000, step=1, format="%d"),
            "capacity": st.column_config.NumberColumn(tx("Capacity ✎"), min_value=0, max_value=100000, step=1, format="%d"),
            "free_speed_kph": st.column_config.NumberColumn(tx("Free-flow km/h ✎"), min_value=1, max_value=150, step=1, format="%.0f"),
            "closed": st.column_config.CheckboxColumn(tx("Closed ✎")),
            "congestion_pct": st.column_config.ProgressColumn(tx("Congestion"), min_value=0, max_value=150, format="%.0f%%"),
            "avg_speed_kph": st.column_config.NumberColumn(tx("Avg speed km/h"), format="%.1f"),
            "travel_time_s": st.column_config.NumberColumn(tx("Travel time (s)"), format="%.1f"),
            "vehicles_source": st.column_config.TextColumn(tx("Vehicles source")),
            "capacity_source": st.column_config.TextColumn(tx("Capacity source")),
            "speed_source": st.column_config.TextColumn(tx("Speed source")),
        })
    changes, errors = 0, []
    for _, row in edited.iterrows():
        eid = row["edge_id"]
        t = traffic.get(eid)
        upd = {}
        if pd.notna(row["vehicles"]) and int(row["vehicles"]) != t.vehicles:
            upd["vehicles"] = row["vehicles"]
        if pd.notna(row["capacity"]) and int(row["capacity"]) != t.capacity:
            upd["capacity"] = row["capacity"]
        if pd.notna(row["free_speed_kph"]) and abs(float(row["free_speed_kph"]) - t.free_speed_kph) > 1e-9:
            upd["free_speed_kph"] = row["free_speed_kph"]
        if bool(row["closed"]) != t.closed:
            upd["closed"] = bool(row["closed"])
        if upd:
            try:
                traffic.update_edge(eid, **upd)
                changes += 1
            except ValueError as exc:
                errors.append(f"{eid}: {exc}")
    for e in errors:
        st.error(e)
    if changes:
        st.toast(tx("Updated {n} segment(s). Congestion and routes recalculated.", n=changes))
        st.rerun()


def _render_street_form(network: RoadNetwork, traffic: TrafficManager, query: str) -> None:
    names = network.street_names()
    if query:
        names = [n for n in names if query.lower() in n.lower()] or names
    if not names:
        st.info(tx("This area has no named streets."))
        return
    with st.form("street_form"):
        street = st.selectbox(tx("Street"), names, key="tc_street")
        mode = st.radio(tx("Set traffic as"), ["% of each segment's capacity", "Vehicles per segment"], horizontal=True, format_func=tx)
        value = st.number_input(tx("Value"), min_value=0.0, max_value=100000.0, value=80.0, step=5.0)
        cap = st.number_input(tx("Override capacity per segment (0 = keep current)"), min_value=0, value=0, step=1)
        closed = st.checkbox(tx("Mark street as closed"))
        ok = st.form_submit_button(tx("Apply to whole street (both directions)"), type="primary")
    if ok:
        edges = network.edges_of_street(street)
        try:
            for eid in edges:
                if cap > 0:
                    traffic.set_capacity(eid, cap)
                c = traffic.get(eid).capacity
                veh = round(value / 100.0 * max(c, 1)) if mode.startswith("%") else value
                traffic.update_edge(eid, vehicles=int(veh), closed=closed)
        except ValueError as exc:
            st.error(str(exc))
            return
        st.toast(tx("Applied to {n} segments of {street}.", n=len(edges), street=street))
        st.rerun()


def _render_segment_form(network: RoadNetwork, traffic: TrafficManager, params: cf.CostParams, ids: list) -> None:
    if not ids:
        st.info(tx("Search for a street above to choose a segment."))
        return
    preselect = st.session_state.get("tc_selected_edge")
    index = ids.index(preselect) if preselect in ids else 0
    eid = st.selectbox(tx("Road segment"), ids[:2000], index=min(index, len(ids[:2000]) - 1),
                       format_func=lambda e: _segment_label(network, e), key="tc_segment")
    m = traffic.metrics(eid, params)
    c = st.columns(5)
    c[0].metric(tx("Vehicles"), m["vehicles"], help=tx("source: {source}", source=tx(m["vehicles_source"])))
    c[1].metric(tx("Capacity"), m["capacity"], help=tx("source: {source}", source=tx(m["capacity_source"])))
    c[2].metric(tx("Congestion"), f"{m['congestion_pct']:.0f}%", tx(m["level"]), delta_color="off")
    c[3].metric(tx("Avg speed"), tx("{x} km/h", x=f"{m['avg_speed_kph']:.1f}"), help=tx("free-flow source: {source}", source=tx(m["speed_source"])))
    c[4].metric(tx("Travel time"), tx("{s} s", s=f"{m['travel_time_s']:.1f}"))
    t = traffic.get(eid)
    with st.form(f"seg_form_{eid}"):
        a, b, cc, d = st.columns(4)
        veh = a.number_input(tx("Vehicles"), min_value=0, max_value=100000, value=int(t.vehicles), step=1)
        cap = b.number_input(tx("Capacity"), min_value=0, max_value=100000, value=int(t.capacity), step=1)
        spd = cc.number_input(tx("Free-flow speed (km/h)"), min_value=1.0, max_value=150.0, value=float(t.free_speed_kph), step=1.0)
        closed = d.checkbox(tx("Closed"), value=t.closed)
        x, y = st.columns(2)
        apply = x.form_submit_button(tx("Apply"), type="primary")
        reset = y.form_submit_button(tx("Reset this segment"))
    if apply:
        try:
            traffic.update_edge(eid, vehicles=veh, capacity=cap, free_speed_kph=spd, closed=closed)
            st.session_state["tc_selected_edge"] = eid
            st.rerun()
        except ValueError as exc:
            st.error(str(exc))
    if reset:
        traffic.reset_edge(eid)
        st.rerun()


def _render_scenarios(traffic: TrafficManager) -> None:
    SCENARIO_DIR.mkdir(parents=True, exist_ok=True)
    st.markdown(tx("**Generate a synthetic scenario** — fills every segment with random but reproducible "
                   "vehicle counts (labelled *simulated*). Useful for demos; not real traffic."))
    a, b, c, d = st.columns(4)
    seed = a.number_input(tx("Seed"), value=42, step=1)
    mean = b.slider(tx("Mean load"), 0.0, 1.5, 0.45, 0.05)
    spread = c.slider(tx("Spread"), 0.0, 1.0, 0.35, 0.05)
    if d.button(tx("Generate simulated traffic"), width="stretch"):
        traffic.apply_random_scenario(int(seed), mean, spread)
        st.rerun()

    st.divider()
    a, b = st.columns(2)
    if a.button(tx("Reset all vehicle counts to 0"), width="stretch"):
        traffic.reset_vehicles()
        st.rerun()
    if b.button(tx("Reset ALL traffic data (counts, capacities, speeds, closures)"), width="stretch"):
        traffic.reset_all()
        st.rerun()

    st.divider()
    st.markdown(tx("**Save / load scenarios** (stored in `data/scenarios/`)"))
    a, b = st.columns(2)
    with a:
        name = st.text_input(tx("Scenario name"), value="my_scenario")
        if st.button(tx("Save current traffic as scenario"), width="stretch"):
            safe = re.sub(r"[^\w\-]+", "_", name).strip("_") or "scenario"
            traffic.save_scenario(SCENARIO_DIR / f"{safe}.json", name)
            st.success(tx("Saved data/scenarios/{name}.json", name=safe))
        st.download_button(tx("Download scenario JSON"), json.dumps(traffic.to_scenario(name), ensure_ascii=False, indent=1),
                           file_name="masar_scenario.json", mime="application/json", width="stretch")
    with b:
        files = sorted(p.name for p in SCENARIO_DIR.glob("*.json"))
        pick = st.selectbox(tx("Saved scenarios"), files) if files else None
        if pick and st.button(tx("Load selected scenario"), width="stretch"):
            _load(traffic, json.loads((SCENARIO_DIR / pick).read_text(encoding="utf-8")))
        up = st.file_uploader(tx("…or upload a scenario JSON"), type="json")
        if up is not None and st.button(tx("Load uploaded scenario"), width="stretch"):
            _load(traffic, json.loads(up.getvalue().decode("utf-8")))


def _load(traffic: TrafficManager, data: dict) -> None:
    try:
        applied, skipped = traffic.load_scenario(data)
    except ValueError as exc:
        st.error(str(exc))
        return
    st.session_state["flash"] = (tx("Scenario loaded: {n} segments applied", n=applied)
                                 + (tx(", {n} skipped (not in this map area)", n=skipped) if skipped else ""))
    st.rerun()
