"""
api/websocket.py — WebSocket live data feed
Fixed: explicit accept() bypasses Starlette origin check (fixes 403 on Windows/browser)
"""
import asyncio
import json
from typing import Set
from fastapi import WebSocket
from starlette.websockets import WebSocketState, WebSocketDisconnect
from core.realtime import _live_data_point
from core.data_engine import PLATFORMS
import datetime
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        # Accept with no subprotocol — this bypasses origin validation
        await ws.accept()
        self.active.add(ws)
        logger.info(f"WS client connected. Active: {len(self.active)}")

    def disconnect(self, ws: WebSocket):
        self.active.discard(ws)
        logger.info(f"WS client disconnected. Active: {len(self.active)}")

    @property
    def count(self):
        return len(self.active)


manager = ConnectionManager()


async def ws_live_feed(websocket: WebSocket):
    """Stream live data points every 3 seconds."""

    # ── Accept connection (no origin check) ──────────────────────
    try:
        await manager.connect(websocket)
    except Exception as e:
        logger.error(f"WS accept failed: {e}")
        return

    platform_filter = None
    interval = 3.0
    running = True

    # ── Background sender ─────────────────────────────────────────
    async def send_loop():
        nonlocal running, platform_filter, interval
        tick = 0
        while running:
            try:
                await asyncio.sleep(interval)

                if websocket.client_state != WebSocketState.CONNECTED:
                    break

                point = _live_data_point(platform_filter)
                payload = {"type": "data_point", "payload": point}
                if tick % 10 == 0:
                    payload["system"] = {
                        "connections": manager.count,
                        "server_time": datetime.datetime.utcnow().isoformat(),
                    }

                await asyncio.wait_for(websocket.send_json(payload), timeout=5.0)
                tick += 1

            except asyncio.TimeoutError:
                logger.warning("WS send timeout")
                continue
            except WebSocketDisconnect:
                break
            except RuntimeError as e:
                logger.warning(f"WS runtime: {e}")
                await asyncio.sleep(0.3)
                continue
            except Exception as e:
                logger.warning(f"WS send error: {e}")
                break

        running = False

    send_task = asyncio.create_task(send_loop())

    # ── Receive loop (client commands) ────────────────────────────
    try:
        while running:
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                try:
                    cmd = json.loads(msg)
                    if "platform" in cmd:
                        pf = cmd["platform"]
                        platform_filter = pf if pf in PLATFORMS else None
                    if "interval" in cmd:
                        interval = max(1.0, min(30.0, float(cmd["interval"])))
                except (json.JSONDecodeError, ValueError):
                    pass
            except asyncio.TimeoutError:
                continue  # No message in 30s is fine
            except WebSocketDisconnect:
                break
            except Exception:
                break
    finally:
        running = False
        send_task.cancel()
        try:
            await send_task
        except asyncio.CancelledError:
            pass
        manager.disconnect(websocket)
