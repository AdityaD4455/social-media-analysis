"""
api/routes/forecast.py — ML forecast endpoints with AI narrative
"""
from fastapi import APIRouter, Depends, Query
from models.analytics import ForecastRequest
from core.forecast_engine import forecast, compute_platform_forecasts, forecast_with_ai_narrative
from api.dependencies import get_dataframe
from services.cache import get as cache_get, set as cache_set

router = APIRouter(prefix="/forecast", tags=["forecast"])


@router.post("/")
async def get_forecast(req: ForecastRequest, df=Depends(get_dataframe)):
    key = f"forecast_{req.platform}_{req.metric}_{req.horizon_days}_{req.model}"
    cached = cache_get(key)
    if cached:
        return cached
    result = forecast(df, req.horizon_days, req.platform, req.metric, req.model)
    cache_set(key, result)
    return result


@router.post("/ai-enhanced")
async def get_ai_forecast(req: ForecastRequest, df=Depends(get_dataframe)):
    """Forecast with AI-generated narrative insight."""
    key = f"ai_forecast_{req.platform}_{req.metric}_{req.horizon_days}"
    cached = cache_get(key)
    if cached:
        return cached
    result = await forecast_with_ai_narrative(df, req.horizon_days, req.platform, req.metric)
    cache_set(key, result, ttl=180)
    return result


@router.get("/all-platforms")
async def get_all_platform_forecasts(
    horizon: int = Query(default=30, ge=7, le=90),
    df=Depends(get_dataframe),
):
    key = f"all_forecasts_{horizon}"
    cached = cache_get(key)
    if cached:
        return cached
    result = compute_platform_forecasts(df, horizon)
    cache_set(key, result)
    return result
