"""
api/routes/analytics.py — Core analytics endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
import json

from core.data_engine import (
    compute_summary, compute_platform_stats, compute_heatmap,
    compute_content_performance, compute_time_series, parse_uploaded_csv, PLATFORMS
)
from services.cache import get as cache_get, set as cache_set
from api.dependencies import get_dataframe

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary")
async def get_summary(df=Depends(get_dataframe)):
    key = "summary"
    cached = cache_get(key)
    if cached:
        return cached
    result = compute_summary(df)
    cache_set(key, result)
    return result


@router.get("/platforms")
async def get_platforms(df=Depends(get_dataframe)):
    key = "platforms"
    cached = cache_get(key)
    if cached:
        return cached
    result = compute_platform_stats(df)
    cache_set(key, result)
    return result


@router.get("/timeseries")
async def get_timeseries(
    platform: Optional[str] = Query(default="all"),
    df=Depends(get_dataframe),
):
    key = f"timeseries_{platform}"
    cached = cache_get(key)
    if cached:
        return cached
    result = compute_time_series(df, platform=platform)
    cache_set(key, result)
    return result


@router.get("/heatmap")
async def get_heatmap(df=Depends(get_dataframe)):
    key = "heatmap"
    cached = cache_get(key)
    if cached:
        return cached
    result = compute_heatmap(df)
    cache_set(key, result)
    return result


@router.get("/content")
async def get_content_performance(df=Depends(get_dataframe)):
    key = "content"
    cached = cache_get(key)
    if cached:
        return cached
    result = compute_content_performance(df)
    cache_set(key, result)
    return result


@router.get("/raw")
async def get_raw_data(
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0),
    platform: Optional[str] = Query(default=None),
    df=Depends(get_dataframe),
):
    if platform and platform != "all":
        df = df[df["platform"] == platform]

    total = len(df)
    slice_df = df.iloc[offset : offset + limit]

    records = []
    for _, row in slice_df.iterrows():
        records.append({
            "timestamp": str(row["timestamp"])[:19],
            "platform": row["platform"],
            "content_type": row["content_type"],
            "reach": int(row["reach"]),
            "impressions": int(row.get("impressions", 0)),
            "engagement": float(row["engagement"]),
            "likes": int(row.get("likes", 0)),
            "comments": int(row.get("comments", 0)),
            "shares": int(row.get("shares", 0)),
            "performance_score": float(row["performance_score"]),
            "viral": bool(row.get("viral", False)),
        })

    return {"total": total, "offset": offset, "limit": limit, "records": records}
