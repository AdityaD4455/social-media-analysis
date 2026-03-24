"""
api/dependencies.py — Shared FastAPI dependency injections
"""
import pandas as pd
import state


def get_dataframe() -> pd.DataFrame:
    """Return the active DataFrame (demo or uploaded)."""
    if state.ACTIVE_DF is None or state.ACTIVE_DF.empty:
        from core.data_engine import generate_dataset
        state.ACTIVE_DF = generate_dataset()
    return state.ACTIVE_DF
