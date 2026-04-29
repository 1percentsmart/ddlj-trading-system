#!/usr/bin/env python3
"""DDLJ Trading System — FastAPI Main Application."""

import os
import sys
import signal
import asyncio
from contextlib import asynccontextmanager

from dotenv import load_dotenv

load_dotenv()

from core.logging_config import setup_logging, get_logger
from core.config import LOG_LEVEL, IS_PRODUCTION, CORS_ORIGINS

setup_logging(log_level=LOG_LEVEL, json_logs=IS_PRODUCTION)
log = get_logger("main")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router
from api.routes_live_safety import router as live_safety_router
from api.websocket import ws_router
from services.engine_manager import EngineManager
from services.market_hours import MarketHoursGuard
from services.session_recovery import SessionRecovery
from services.telegram_notifier import TelegramNotifier
from services.token_refresh import TokenRefreshService
from services.health_monitor import HealthMonitor
from database.connection import init_db, close_db
from core.config import (
    validate_config, ensure_directories, get_config_summary,
    ENABLE_MARKET_HOURS_GUARD, ENABLE_SESSION_RECOVERY,
    ENABLE_TELEGRAM, ENABLE_TOKEN_AUTO_REFRESH, ENABLE_WEBSOCKET,
    TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
)

engine_manager = EngineManager()
market_guard = MarketHoursGuard() if ENABLE_MARKET_HOURS_GUARD else None
session_recovery = SessionRecovery() if ENABLE_SESSION_RECOVERY else None
telegram_notifier = TelegramNotifier(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID) if ENABLE_TELEGRAM else None
token_service = TokenRefreshService() if ENABLE_TOKEN_AUTO_REFRESH else None
health_monitor = HealthMonitor()


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("=" * 65)
    log.info("DDLJ Backend — Starting up")
    log.info("=" * 65)

    try:
        warnings = validate_config()
        for w in warnings:
            log.warning("CONFIG WARNING: %s", w)
    except RuntimeError as e:
        log.critical("CONFIG ERROR: %s", e)

    ensure_directories()

    try:
        await init_db()
        log.info("Database initialized")
    except Exception as e:
        log.error("Database initialization failed: %s — continuing without DB", e)

    try:
        engine_manager.initialize()
        log.info("Engine manager initialized")
    except Exception as e:
        log.error("Engine manager initialization failed: %s", e)

    if session_recovery:
        try:
            if session_recovery.has_recoverable_session():
                recovered = session_recovery.recover_session()
                if recovered:
                    log.info("Session recovered: %d open positions restored", recovered.get("open_positions_count", 0))
        except Exception as e:
            log.error("Session recovery failed: %s", e)

    if telegram_notifier:
        try:
            await telegram_notifier.send_system_alert("Backend Started", "DDLJ backend is online and ready")
        except Exception as e:
            log.warning("Telegram test message failed: %s — notifications disabled", e)

    if token_service:
        try:
            token_service.start()
        except Exception as e:
            log.error("Token refresh service failed to start: %s", e)

    if market_guard:
        try:
            market_guard.on_market_open(lambda: _on_market_open())
            market_guard.on_market_close(lambda: _on_market_close())
            market_guard.start()
        except Exception as e:
            log.error("Market hours guard failed to start: %s", e)

    try:
        health_monitor.set_engine_manager(engine_manager)
        log.info("Health monitor initialized")
    except Exception as e:
        log.error("Health monitor initialization failed: %s", e)

    try:
        def handle_shutdown(signum, frame):
            log.info("Received signal %s — initiating graceful shutdown", signum)
            _graceful_shutdown()
            sys.exit(0)

        signal.signal(signal.SIGTERM, handle_shutdown)
        signal.signal(signal.SIGINT, handle_shutdown)
    except (ValueError, RuntimeError) as e:
        log.debug("Signal handlers not registered: %s", e)

    log.info("DDLJ Backend — READY")
    yield

    log.info("Server shutting down...")
    _graceful_shutdown()


def _on_market_open():
    log.info("Market OPEN — starting trading engine")
    try:
        if not engine_manager._running:
            engine_manager.start_engine()
    except Exception as e:
        log.error("Failed to auto-start engine on market open: %s", e)


def _on_market_close():
    log.info("Market CLOSE — stopping trading engine")
    try:
        if engine_manager._running:
            engine_manager.stop_engine()
    except Exception as e:
        log.error("Failed to auto-stop engine on market close: %s", e)


def _graceful_shutdown():
    if market_guard:
        try:
            market_guard.stop()
        except Exception as e:
            log.error("Error stopping market guard: %s", e)

    if token_service:
        try:
            token_service.stop()
        except Exception as e:
            log.error("Error stopping token service: %s", e)

    try:
        engine_manager.graceful_shutdown()
    except Exception as e:
        log.error("Error shutting down engine: %s", e)

    try:
        asyncio.ensure_future(close_db())
    except Exception as e:
        log.error("Error closing database: %s", e)


app = FastAPI(
    title="DDLJ Trading System",
    description="DDLJ live paper-trading backend with guarded live-readiness endpoints.",
    version="10.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.state.engine_manager = engine_manager
app.state.market_guard = market_guard
app.state.session_recovery = session_recovery
app.state.telegram_notifier = telegram_notifier
app.state.token_service = token_service
app.state.health_monitor = health_monitor

valid_origins = [o for o in CORS_ORIGINS if o]
app.add_middleware(
    CORSMiddleware,
    allow_origins=valid_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1", tags=["Trading Engine"])
app.include_router(live_safety_router, prefix="/api/v1")

if ENABLE_WEBSOCKET:
    app.include_router(ws_router, prefix="/ws", tags=["WebSocket"])


@app.get("/", tags=["Root"])
async def root():
    return {
        "name": "DDLJ Trading System",
        "version": "10.1.0",
        "status": "running",
        "docs": "/docs",
        "websocket": "/ws/status" if ENABLE_WEBSOCKET else "disabled",
        "config": get_config_summary(),
    }
