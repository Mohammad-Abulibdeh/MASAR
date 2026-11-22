"""Route statistics, comparison table and experiment charts."""
from __future__ import annotations

import pandas as pd
import streamlit as st

from core.i18n import tx


def fmt_time(seconds: float) -> str:
    seconds = max(0, int(round(seconds)))
    m, s = divmod(seconds, 60)
    h, m = divmod(m, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def fmt_km(m: float) -> str:
    return tx("{x} km", x=f"{m / 1000:.2f}")


def render_experiment_results(df: pd.DataFrame) -> None:
    show = pd.DataFrame({
        tx("Strategy"): df["strategy"].map(tx),
        tx("Arrived"): df["arrived"].map({True: tx("yes"), False: tx("no")}),
        tx("Total distance"): df["distance_m"].map(fmt_km),
        tx("Estimated time at departure"): df["initial_est_time_s"].map(fmt_time),
        tx("Final simulated travel time"): df["final_time_s"].map(fmt_time),
        tx("Congestion exposure"): df["congestion_exposure_pct"].map(lambda x: f"{x:.0f}%"),
        tx("Time in heavy congestion"): df["time_in_heavy_congestion_s"].map(lambda x: tx("{s} s", s=f"{x:.0f}")),
        tx("Route changes"): df["route_changes"],
    })
    st.dataframe(show, hide_index=True, width="stretch")

    chart = df.assign(strategy=df["strategy"].map(tx)).set_index("strategy")
    c1, c2 = st.columns(2)
    with c1:
        st.markdown(f"**{tx('Final simulated travel time (min)')}**")
        st.bar_chart((chart["final_time_s"] / 60).rename(tx("minutes")), color="#ff3d8b", horizontal=True)
        st.markdown(f"**{tx('Total distance (km)')}**")
        st.bar_chart((chart["distance_m"] / 1000).rename(tx("km")), color="#5a2be0", horizontal=True)
    with c2:
        st.markdown(f"**{tx('Congestion exposure (length-weighted mean load, %)')}**")
        st.bar_chart(chart["congestion_exposure_pct"].rename("%"), color="#ff8a3c", horizontal=True)
        st.markdown(f"**{tx('Estimated time at departure vs final time (min)')}**")
        st.bar_chart(pd.DataFrame({tx("estimated at departure"): chart["initial_est_time_s"] / 60,
                                   tx("final simulated"): chart["final_time_s"] / 60}),
                     color=["#19d3b4", "#ff3d8b"], horizontal=True, stack=False)
