"""
api/routes/ai.py — AI chat, insights, and report endpoints
"""
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from models.analytics import ChatRequest
from core.ai_engine import chat_stream, generate_report, generate_insights
from core.data_engine import compute_summary, compute_platform_stats
from api.dependencies import get_dataframe
import json

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/chat/stream")
async def ai_chat_stream(req: ChatRequest, df=Depends(get_dataframe)):
    """Stream AI response token-by-token using SSE."""
    summary = compute_summary(df)
    platform_stats = compute_platform_stats(df)

    async def event_generator():
        async for token in chat_stream(
            req.query,
            summary,
            platform_stats,
            req.conversation_history,
        ):
            # Server-sent events format
            yield f"data: {json.dumps({'token': token})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/chat")
async def ai_chat(req: ChatRequest, df=Depends(get_dataframe)):
    """Non-streaming AI chat (collects full response)."""
    summary = compute_summary(df)
    platform_stats = compute_platform_stats(df)
    tokens = []
    async for token in chat_stream(req.query, summary, platform_stats, req.conversation_history):
        tokens.append(token)
    return {"response": "".join(tokens)}


@router.get("/insights")
async def ai_insights(df=Depends(get_dataframe)):
    """Return 6 auto-generated AI insights."""
    summary = compute_summary(df)
    platform_stats = compute_platform_stats(df)
    insights = await generate_insights(summary, platform_stats)
    return {"insights": insights}


@router.get("/report")
async def ai_report(df=Depends(get_dataframe)):
    """Generate full strategic report."""
    summary = compute_summary(df)
    platform_stats = compute_platform_stats(df)
    report = await generate_report(summary, platform_stats)
    return {"report": report}
