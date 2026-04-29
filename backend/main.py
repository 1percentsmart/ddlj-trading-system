#!/usr/bin/env python3
"""
DDLJ Trading System — FastAPI Main Application
=================================================

The entry point for the DDLJ backend server. This creates the FastAPI
app, registers all routes, sets up middleware, initializes all services,
and manages the trading engine lifecycle.

HOW IT WORKS:
  1. FastAPI starts and serves REST API endpoints
  2. The trading engine runs as a background thread (via EngineManager)
  3. API endpoints control the engine (start, stop, config, status)
  4. WebSocket endpoint streams real-time updates to the dashboard
  5. Market Hours Guard auto-starts/stops engine at 9:15/3:30 IST
  6. Token Refresh Service monitors Kite token validity
  7. Telegram Notifier sends trade alerts to your phone
  8. Session Recovery saves state for resume after crash
  9. Health Monitor tracks system health for Railway
  10. Database Layer persists trades/positions/sessions to Supabase/SQLite

SERVICE LIFECYCLE:
  Startup:  core config → logging → database → engine manager →
            market hours guard → token refresh → health monitor →
            session recovery → telegram → ready
  Shutdown: engine stop → session save → database close →
            services stop → exit

RUNNING LOCALLY:
    cd /home/z/my-project/backend
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload

RUNNING IN PRODUCTION (Railway):
    uvicorn main:app --host 0.0.0.0 --port $PORT

Author: DDLJ Strategy Team
Version: 10.1.0 (Production — Cloud Deployable)
"""

import os
import sys
import signal
import asyncio
import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv

# ── Load environment variables BEFORE any other imports ──
# This MUST happen before engine imports that read config from env vars
load_dotenv()

# ── Initialize structured logging FIRST ──
# All subsequent loggers inherit this configuration
from core.logging_config import setup_logging, get_logger
from core.config import LOG_LEVEL, IS_PRODUCTION, CORS_ORIGINS

setup_logging(
    log_level=LOG_LEVEL,
    json_logs=IS_PRODUCTION,  # JSON in production, console in dev
)

log = get_logger("main")

# ── Now import FastAPI and the rest ──
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import router
from api.routes_live_safety import router as live_safety_router
from api.websocket import ws_router

# ── Import services ──
from services.engine_manager import EngineManager
from services.market_hours import MarketHoursGuard
from services.session_recovery import SessionRecovery
from services.telegram_notifier import TelegramNotifier
from services.token_refresh import TokenRefreshService
from services.health_monitor import HealthMonitor

# ── Import database ──
from database.connection import init_db, close_db

# ── Import core ──
from core.config import (
    validate_config, ensure_directories, get_config_summary,
    ENABLE_MARKET_HOURS_GUARD, ENABLE_SESSION_RECOVERY,
    ENABLE_TELEGRAM, ENABLE_TOKEN_AUTO_REFRESH, ENABLE_WEBSOCKET,
    TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
)


# ══════════════════════════════════════════════════════════════════
# GLOBAL SERVICE INSTANCES
# ══════════════════════════════════════════════════════════════════
# These are created once and shared across the application.
# They are stored on app.state for access via dependency injection.

engine_manager = EngineManager()
market_guard = MarketHoursGuard() if ENABLE_MARKET_HOURS_GUARD else None
session_recovery = SessionRecovery() if ENABLE_SESSION_RECOVERY else None
telegram_notifier = TelegramNotifier(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID) if ENABLE_TELEGRAM else None
token_service = TokenRefreshService() if ENABLE_TOKEN_AUTO_REFRESH else None
health_monitor = HealthMonitor()


# ══════════════════════════════════════════════════════════════════
# APPLICATION LIFESPAN — Startup and Shutdown hooks
# ══════════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan context manager.

    Runs code ONCE when the server starts and once when it stops.
    This is where all services are initialized and torn down.

    STARTUP ORDER MATTERS:
      1. Validate config (fail fast if secrets missing)
      2. Create directories (prevent file-not-found errors)
      3. Initialize database (tables, connections)
      4. Initialize engine manager (prepares trading engine)
      5. Initialize session recovery (check for crash recovery)
      6. Initialize Telegram notifier (test connection)
      7. Initialize token refresh service (check token validity)
      8. Initialize market hours guard (auto start/stop engine)
      9. Initialize health monitor (register health checks)
     10. Register signal handlers (graceful shutdown on SIGTERM)
    """
    log.info("=" * 65)
    log.info("DDLJ v10.1 Backend — Starting up")
    log.info("=" * 65)

    # ── 1. Validate configuration ──
    try:
        warnings = validate_config()
        for w in warnings:
            log.warning("CONFIG WARNING: %s", w)
    except RuntimeError as e:
        log.critical("CONFIG ERROR: %s", e)
        log.critical("Server cannot start without required configuration.")
        # Don't crash — let the server start but in degraded mode
        # (user can set env vars via the dashboard later)

    # ── 2. Create required directories ──
    ensure_directories()
    log.info("Directories ensured")

    # ── 3. Initialize database ──
    try:
        await init_db()
        log.info("Database initialized")
    except Exception as e:
        log.error("Database initialization failed: %s — continuing without DB", e)

    # ── 4. Initialize engine manager ──
    try:
        engine_manager.initialize()
        log.info("Engine manager initialized")
    except Exception as e:
        log.error("Engine manager initialization failed: %s", e)

    # ── 5. Initialize session recovery ──
    if session_recovery:
        try:
            if session_recovery.has_recoverable_session():
                log.warning("Found recoverable session from previous run")
                # Auto-recover if the session is recent (< 24 hours)
                recovered = session_recovery.recover_session()
                if recovered:
                    log.info("Session recovered: %d open positions restored",
                             recovered.get("open_positions_count", 0))
                    if telegram_notifier:
                        await telegram_notifier.send_system_alert(
                            "Session Recovery",
                            f"Recovered {recovered.get('open_positions_count', 0)} "
                            f"open positions from previous session"
                        )
        except Exception as e:
            log.error("Session recovery failed: %s", e)

    # ── 6. Initialize Telegram notifier ──
    if telegram_notifier:
        try:
            await telegram_notifier.send_system_alert(
                "Backend Started",
                "DDLJ v10.1 backend is online and ready"
            )
            log.info("Telegram notifier initialized and tested")
        except Exception as e:
            log.warning("Telegram test message failed: %s — notifications disabled", e)

    # ── 7. Initialize token refresh service ──
    if token_service:
        try:
            token_service.start()
            log.info("Token refresh service started")
        except Exception as e:
            log.error("Token refresh service failed to start: %s", e)

    # ── 8. Initialize market hours guard ──
    if market_guard:
        try:
            # Wire callbacks: what to do when market opens/closes
            market_guard.on_market_open(lambda: _on_market_open())
            market_guard.on_market_close(lambda: _on_market_close())
            market_guard.start()
            log.info("Market hours guard started (9:15-3:30 IST)")
        except Exception as e:
            log.error("Market hours guard failed to start: %s", e)

    # ── 9. Initialize health monitor ──
    try:
        _register_health_checks()
        log.info("Health monitor initialized with %d checks",
                 len(health_monitor._custom_checks))
    except Exception as e:
        log.error("Health monitor initialization failed: %s", e)

    # ── 10. Register signal handlers ──
    # WHY try/except: signal.signal() only works in the main thread.
    # When running via uvicorn in a thread (e.g., tests), this will fail.
    # That's OK — uvicorn handles its own signal catching.
    try:
        def handle_shutdown(signum, frame):
            """Handle SIGTERM/SIGINT — save state and exit cleanly."""
            log.info("Received signal %s — initiating graceful shutdown", signum)
            _graceful_shutdown()
            sys.exit(0)

        signal.signal(signal.SIGTERM, handle_shutdown)
        signal.signal(signal.SIGINT, handle_shutdown)
        log.info("Signal handlers registered (SIGTERM, SIGINT)")
    except (ValueError, RuntimeError) as e:
        log.debug("Signal handlers not registered (%s) — normal in non-main thread", e)

    log.info("=" * 65)
    log.info("DDLJ v10.1 Backend — READY")
    log.info("API: http://localhost:%s | Docs: http://localhost:%s/docs",
             os.getenv("PORT", "8000"), os.getenv("PORT", "8000"))
    log.info("Market Guard: %s | Telegram: %s | Token Service: %s",
             "ON" if market_guard else "OFF",
             "ON" if telegram_notifier else "OFF",
             "ON" if token_service else "OFF")
    log.info("=" * 65)

    yield  # ← Server is running here

    # ── SHUTDOWN ──
    log.info("Server shutting down...")
    _graceful_shutdown()
    log.info("Shutdown complete")


# ══════════════════════════════════════════════════════════════════
# SERVICE CALLBACKS
# ══════════════════════════════════════════════════════════════════

def _on_market_open():
    """Called by MarketHoursGuard when market opens (9:15 AM IST)."""
    log.info("Market OPEN — starting trading engine")
    try:
        if not engine_manager._running:
            engine_manager.start_engine()
            if telegram_notifier:
                # Fire and forget — don't block the callback
                asyncio.ensure_future(
                    telegram_notifier.send_system_alert(
                        "Market Open", "Trading engine started automatically"
                    )
                )
    except Exception as e:
        log.error("Failed to auto-start engine on market open: %s", e)


def _on_market_close():
    """Called by MarketHoursGuard when market closes (3:30 PM IST)."""
    log.info("Market CLOSE — stopping trading engine")
    try:
        if engine_manager._running:
            engine_manager.stop_engine()
            if telegram_notifier:
                asyncio.ensure_future(
                    telegram_notifier.send_system_alert(
                        "Market Closed", "Trading engine stopped automatically"
                    )
                )
            # Send daily summary
            if telegram_notifier and engine_manager._trader:
                status = engine_manager.get_status()
                asyncio.ensure_future(
                    telegram_notifier.send_daily_summary(
                        capital=status.get("capital", 0),
                        daily_pnl=status.get("daily_pnl", 0),
                        trade_count=status.get("daily_trade_count", 0),
                        open_positions=status.get("open_positions", 0),
                        total_trades=status.get("total_closed_trades", 0),
                    )
                )
    except Exception as e:
        log.error("Failed to auto-stop engine on market close: %s", e)


def _register_health_checks():
    """Register all health check functions with the health monitor."""

    async def check_engine_heartbeat():
        """Check if the trading engine is alive and reporting."""
        status = engine_manager.get_status()
        if not status.get("engine_running", False):
            return "degraded", "Engine is not running"
        return "healthy", "Engine is running"

    async def check_token_validity():
        """Check if the Kite API token is valid."""
        status = engine_manager.get_status()
        token = status.get("token", {})
        if not token.get("stored", False):
            return "degraded", "No Kite token stored"
        if not token.get("valid", False):
            return "unhealthy", "Kite token is expired or invalid"
        return "healthy", "Token is valid"

    async def check_database():
        """Check if the database is accessible."""
        try:
            from database.connection import get_engine
            engine = get_engine()
            if engine is None:
                return "degraded", "Database not configured"
            async with engine.connect() as conn:
                await conn.execute(type(conn).text("SELECT 1") if hasattr(type(conn), 'text') else __import__('sqlalchemy').text("SELECT 1"))
            return "healthy", "Database is accessible"
        except Exception as e:
            return "unhealthy", f"Database error: {e}"

    health_monitor.register_check("engine_heartbeat", check_engine_heartbeat)
    health_monitor.register_check("token_validity", check_token_validity)
    health_monitor.register_check("database", check_database)


def _graceful_shutdown():
    """Perform graceful shutdown of all services."""
    log.info("Initiating graceful shutdown...")

    # 1. Stop market hours guard
    if market_guard:
        try:
            market_guard.stop()
            log.info("Market hours guard stopped")
        except Exception as e:
            log.error("Error stopping market guard: %s", e)

    # 2. Stop token refresh service
    if token_service:
        try:
            token_service.stop()
            log.info("Token refresh service stopped")
        except Exception as e:
            log.error("Error stopping token service: %s", e)

    # 3. Stop the trading engine (save state, close positions)
    try:
        engine_manager.graceful_shutdown()
        log.info("Engine manager shut down")
    except Exception as e:
        log.error("Error shutting down engine: %s", e)

    # 4. Save session state
    if session_recovery and engine_manager._trader:
        try:
            session_recovery.save_session(
                capital=engine_manager._trader.current_capital,
                daily_pnl=engine_manager._trader.daily_pnl,
                open_positions=engine_manager._trader.open_positions,
                closed_trades=engine_manager._trader.closed_trades,
                config=engine_manager._trader._config,
                clean_shutdown=True,
            )
            log.info("Session state saved")
        except Exception as e:
            log.error("Error saving session: %s", e)

    # 5. Close database
    try:
        # Can't await in sync context, schedule it
        asyncio.ensure_future(close_db())
        log.info("Database closed")
    except Exception as e:
        log.error("Error closing database: %s", e)

    # 6. Send Telegram notification
    if telegram_notifier:
        try:
            asyncio.ensure_future(
                telegram_notifier.send_system_alert(
                    "Backend Shutdown", "DDLJ v10.1 backend is going offline"
                )
            )
        except Exception:
            pass  # Best effort


# ══════════════════════════════════════════════════════════════════
# FASTAPI APP — Create and configure the application
# ══════════════════════════════════════════════════════════════════

app = FastAPI(
    title="DDLJ Trading System",
    description="""
    DDLJ v10.1 — Live Paper Trading Backend

    An enterprise-grade options trading system for Indian indices (BankNifty/Nifty)
    with real-time data from Zerodha's Kite API. Everything is real EXCEPT
    order placement — no real money is at risk.

    ## Features
    - **Real-time paper trading** with live market data
    - **REST API** to control and monitor the trading engine
    - **WebSocket** for real-time dashboard updates
    - **Session recovery** — resumes after server restart
    - **Market hours guard** — auto start/stop at 9:15/3:30 IST
    - **Telegram notifications** for trade alerts
    - **Kite token management** — auto-detect expiry, notify for refresh
    - **Health monitoring** — Railway-ready health checks
    - **Database persistence** — Supabase (prod) / SQLite (dev)

    ## Architecture
    - **Railway** (backend) + **Vercel** (frontend) + **Supabase** (database)
    - **FastAPI** for async REST API + WebSocket
    - **Background threads** for trading engine and services
    - **Atomic state files** for crash recovery
    """,
    version="10.1.0",
    lifespan=lifespan,
    docs_url="/docs",        # Swagger UI at /docs
    redoc_url="/redoc",      # ReDoc at /redoc
)

# ── Store service instances on app.state for dependency injection ──
# This is how routes.py accesses services without circular imports
app.state.engine_manager = engine_manager
app.state.market_guard = market_guard
app.state.session_recovery = session_recovery
app.state.telegram_notifier = telegram_notifier
app.state.token_service = token_service
app.state.health_monitor = health_monitor

# ── CORS (Cross-Origin Resource Sharing) ──
# This allows the frontend (on Vercel) to call the backend (on Railway).
valid_origins = [o for o in CORS_ORIGINS if o]  # Filter out empty strings
app.add_middleware(
    CORSMiddleware,
    allow_origins=valid_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routes ──
app.include_router(router, prefix="/api/v1", tags=["Trading Engine"])
app.include_router(live_safety_router, prefix="/api/v1")

if ENABLE_WEBSOCKET:
    app.include_router(ws_router, prefix="/ws", tags=["WebSocket"])


# ── Root endpoint ──
@app.get("/", tags=["Root"])
async def root():
    """Root endpoint — quick health check and API info."""
    return {
        "name": "DDLJ Trading System",
        "version": "10.1.0",
        "status": "running",
        "docs": "/docs",
        "websocket": "/ws/status" if ENABLE_WEBSOCKET else "disabled",
        "config": get_config_summary(),
    }


# ══════════════════════════════════════════════════════════════════
# EXPORTS — For uvicorn to find the app
# ══════════════════════════════════════════════════════════════════
# The app object is what uvicorn looks for: `uvicorn main:app`
