#!/usr/bin/env python3
"""
DDLJ Trading System — WebSocket Endpoint
==========================================

Real-time WebSocket endpoint for streaming engine status updates
to the frontend dashboard.

HOW IT WORKS:
  1. Frontend connects to ws://backend-url/ws/status
  2. Backend sends status updates every N seconds
  3. Frontend can also send commands (start, stop, etc.)

WHY WEBSOCKET?
  REST API requires the frontend to POLL for updates (repeated GET requests).
  WebSocket pushes updates instantly — no polling needed. This means:
  - Real-time trade notifications on the dashboard
  - Live capital/P&L updates
  - Instant bias change alerts

Author: DDLJ Strategy Team
Version: 10.0.0
"""

import asyncio
import logging
from datetime import datetime

import pytz
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request

IST = pytz.timezone("Asia/Kolkata")
log = logging.getLogger("ddlj_backend")

ws_router = APIRouter()


def _get_engine_manager():
    """Get EngineManager from app.state — avoids circular import from main."""
    # Import the app instance lazily to avoid circular imports
    from main import app
    return app.state.engine_manager


@ws_router.websocket("/status")
async def websocket_status(websocket: WebSocket):
    """
    WebSocket endpoint for real-time status updates.

    The backend pushes status updates every 2 seconds while the
    engine is running. The frontend can also send commands:

    Commands (send as JSON):
      {"action": "start", "config": {...}}  — Start engine
      {"action": "stop"}                     — Stop engine
      {"action": "status"}                   — Request immediate status

    Responses (received as JSON):
      {"type": "status", "data": {...}}      — Engine status
      {"type": "trade", "data": {...}}       — Trade notification
      {"type": "error", "message": "..."}    — Error notification
    """
    await websocket.accept()
    log.info("WebSocket client connected")

    try:
        # Send initial status via app.state (no circular import)
        engine_manager = _get_engine_manager()
        status = engine_manager.get_status()
        await websocket.send_json({"type": "status", "data": status})

        # Start background task for periodic updates
        async def send_periodic_updates():
            """Send status updates every 2 seconds."""
            while True:
                try:
                    await asyncio.sleep(2)
                    status = engine_manager.get_status()
                    await websocket.send_json({"type": "status", "data": status})
                except Exception as e:
                    log.debug("WebSocket update error: %s", e)
                    break

        update_task = asyncio.create_task(send_periodic_updates())

        # Listen for client commands
        while True:
            try:
                data = await websocket.receive_json()

                action = data.get("action", "")
                if action == "start":
                    config = data.get("config", {})
                    try:
                        result = engine_manager.start_engine(config_override=config)
                        await websocket.send_json({"type": "result", "data": result})
                    except Exception as e:
                        await websocket.send_json({"type": "error", "message": str(e)})

                elif action == "stop":
                    result = engine_manager.stop_engine()
                    await websocket.send_json({"type": "result", "data": result})

                elif action == "status":
                    status = engine_manager.get_status()
                    await websocket.send_json({"type": "status", "data": status})

                else:
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Unknown action: {action}"
                    })

            except WebSocketDisconnect:
                break
            except Exception as e:
                log.warning("WebSocket command error: %s", e)
                try:
                    await websocket.send_json({"type": "error", "message": str(e)})
                except Exception:
                    break

    except WebSocketDisconnect:
        log.info("WebSocket client disconnected")
    except Exception as e:
        log.error("WebSocket error: %s", e)
    finally:
        # Clean up the update task
        try:
            update_task.cancel()
        except Exception:
            pass
        log.info("WebSocket connection closed")
