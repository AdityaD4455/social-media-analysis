"""
api/routes/data.py — CSV upload and data management endpoints
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from core.data_engine import parse_uploaded_csv, compute_summary
from services import cache
import state

router = APIRouter(prefix="/data", tags=["data"])


@router.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    """Accept a CSV upload and replace the active dataset."""
    if not file.filename.endswith((".csv", ".CSV")):
        raise HTTPException(400, "Only .csv files are accepted")

    content = await file.read()
    if len(content) > 20 * 1024 * 1024:  # 20 MB limit
        raise HTTPException(413, "File too large (max 20 MB)")

    try:
        df = parse_uploaded_csv(content)
    except Exception as e:
        raise HTTPException(422, f"CSV parsing failed: {str(e)}")

    if df.empty:
        raise HTTPException(422, "Uploaded file contains no valid records")

    # Store in app state and clear cache
    state.ACTIVE_DF = df
    cache.clear()

    summary = compute_summary(df)
    return {
        "success": True,
        "records": len(df),
        "platforms": df["platform"].unique().tolist(),
        "date_range": summary.get("date_range", {}),
        "message": f"Successfully loaded {len(df):,} records",
    }


@router.post("/reset")
async def reset_data():
    """Reset to generated demo dataset."""
    from core.data_engine import generate_dataset
    state.ACTIVE_DF = generate_dataset()
    cache.clear()
    return {"success": True, "message": "Reset to demo dataset"}


@router.get("/status")
async def data_status():
    """Return current dataset status."""
    df = state.ACTIVE_DF
    if df is None or df.empty:
        return {"loaded": False}
    return {
        "loaded": True,
        "records": len(df),
        "platforms": df["platform"].unique().tolist(),
        "columns": df.columns.tolist(),
    }
