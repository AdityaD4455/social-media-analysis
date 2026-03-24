"""
main.py — InsightSphere AI Pro · FastAPI Application Entry Point
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from contextlib import asynccontextmanager
import uvicorn

from core.config import settings
from core.data_engine import generate_dataset
from api.routes import analytics, ai, forecast, data
from api.websocket import ws_live_feed
import state


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 InsightSphere AI Pro starting...")
    print(f"   Anthropic AI : {'✅ configured' if settings.has_anthropic else '⚠️  not configured (using local AI)'}")
    state.ACTIVE_DF = generate_dataset(days=90, rows_per_platform_per_day=3)
    print(f"   Dataset      : {len(state.ACTIVE_DF):,} records loaded")
    print(f"   Server       : http://localhost:{settings.port}")
    print(f"   Open browser : http://127.0.0.1:{settings.port}")
    yield
    print("🛑 InsightSphere shutting down.")


app = FastAPI(
    title="InsightSphere AI Pro",
    description="Real-time social media analytics with AI predictions",
    version="3.0.0",
    lifespan=lifespan,
)

# ── CORS — allow everything (dev mode) ───────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,   # Must be False when allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API routes ────────────────────────────────────────────────────
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(ai.router,        prefix="/api/v1")
app.include_router(forecast.router,  prefix="/api/v1")
app.include_router(data.router,      prefix="/api/v1")

# ── WebSocket — bypass origin check entirely ─────────────────────
@app.websocket("/ws/live")
async def websocket_live(websocket: WebSocket):
    # Manually accept without origin validation
    await ws_live_feed(websocket)

# ── Health ────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "version": "3.0.0",
        "records": len(state.ACTIVE_DF) if state.ACTIVE_DF is not None else 0,
        "ai_enabled": settings.has_anthropic,
    }

# ── Serve Frontend ────────────────────────────────────────────────
_this_file    = Path(__file__).resolve()
_backend_dir  = _this_file.parent
_project_dir  = _backend_dir.parent
frontend_path = _project_dir / "frontend"

if not frontend_path.exists():
    for candidate in [
        _backend_dir / "frontend",
        Path.cwd() / "frontend",
        Path.cwd().parent / "frontend",
    ]:
        if (candidate / "index.html").exists():
            frontend_path = candidate
            break

print(f"   Frontend     : {frontend_path}  —  exists={frontend_path.exists()}")

if frontend_path.exists() and (frontend_path / "index.html").exists():
    assets_path = frontend_path / "assets"
    if assets_path.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_path)), name="assets")

    @app.get("/")
    async def serve_frontend():
        return FileResponse(str(frontend_path / "index.html"))

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith(("api/", "ws/", "health")):
            return JSONResponse({"error": "not found"}, status_code=404)
        p = frontend_path / full_path
        if p.exists() and p.is_file():
            return FileResponse(str(p))
        return FileResponse(str(frontend_path / "index.html"))
else:
    print("   ❌ Frontend not found!")

    @app.get("/")
    async def no_frontend():
        return {"error": "Frontend not found", "api_docs": "/docs"}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=settings.port,
        reload=False,
        log_level="info",
        ws_ping_interval=20,
        ws_ping_timeout=10,
    )
