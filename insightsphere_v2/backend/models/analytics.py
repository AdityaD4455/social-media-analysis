"""
models/analytics.py — Pydantic request/response models
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    conversation_history: Optional[List[Dict[str, str]]] = None


class ForecastRequest(BaseModel):
    platform: str = "all"
    metric: str = "reach"
    horizon_days: int = Field(default=30, ge=7, le=90)
    model: str = "holt_winters"
