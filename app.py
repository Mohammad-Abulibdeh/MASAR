"""MASAR Routing V1 - entry point.  Run with:  streamlit run app.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import streamlit as st  # noqa: E402

st.set_page_config(page_title="MASAR · Intelligent Urban Transportation Management",
                   page_icon="🛣️", layout="wide", initial_sidebar_state="collapsed")

from ui.dashboard import main  # noqa: E402

main()
