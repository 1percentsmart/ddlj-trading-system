#!/usr/bin/env python3
"""
DDLJ Trading System — FastAPI Main Application
=================================================

The entry point for the DDLJ backend server. This creates the FastAPI
app, registers all routes, sets up middleware, and starts the
trading engine in the background.

HOW IT WORKS:
  1. FastAPI starts and serves REST API endpoints
  2. The trading engine runs as a background asyncio task
  3. API endpoints control the engine (start, stop, config, status)
  4. WebSocket endpoint streams real-time updates to the dashboard
  5. Graceful shutdown on SIGTERM/SIGINT (saves state, closes positions)

RUNNING LOCALLY:
    cd /home/z/my-project/backend
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload

RUNNING IN PRODUCTION (Railway):
    uvicorn main:app --host 0.0.0.0 --port $PORT

Author: DDLJ Strategy Team
Version: 10.0.0 (Production — Cloud Deployable)
"""

import os
import sys
import signal
import asyncio
import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ── Load environment variables from .env file ──
# This MUST happen before any engine imports that read config
load_dotenv()

# ── Import API routes ──
from api.routes import router
from api.websocket import ws_router

# ── Import engine manager (controls the trading engine) ──
from services.engine_manager import EngineManager

# ── Configure logging ──
log_level = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, log_level, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger("ddlj_backend")


# ══════════════════════════════════════════════════════════════════
# ENGINE MANAGER — Global singleton that controls the trading engine
# ══════════════════════════════════════════════════════════════════

# This is the SINGLE instance that manages the trading engine.
# All API routes access the engine through this manager.
engine_manager = EngineManager()


# ══════════════════════════════════════════════════════════════════
# APPLICATION LIFESPAN — Startup and Shutdown hooks
# ══════════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan context manager.

    This runs code ONCE when the server starts and once when it stops.
    We use it to:
      - Initialize the engine manager on startup
      - Load any saved session state
      - Start the market hours guard
      - Gracefully shut down on exit (save state, close positions)
    """
    log.info("=" * 65)
    log.info("DDLJ v10 Backend — Starting up")
    log.info("=" * 65)

    # ── STARTUP ──
    try:
        engine_manager.initialize()
        log.info("Engine manager initialized successfully")
    except Exception as e:
        log.error("Failed to initialize engine manager: %s", e)

    # ── Register signal handlers for graceful shutdown ──
    # Railway sends SIGTERM when shutting down. We catch it to save state.
    loop = asyncio.get_event_loop()

    def handle_shutdown(signum, frame):
        """Handle SIGTERM/SIGINT by saving state and exiting cleanly."""
        log.info("Received signal %s — initiating graceful shutdown", signum)
        engine_manager.graceful_shutdown()
        sys.exit(0)

    signal.signal(signal.SIGTERM, handle_shutdown)
    signal.signal(signal.SIGINT, handle_shutdown)

    log.info("Signal handlers registered (SIGTERM, SIGINT)")
    log.info("Server ready — API endpoints available at http://localhost:%s",
             os.getenv("PORT", "8000"))

    yield  # ← Server is running here

    # ── SHUTDOWN ──
    log.info("Server shutting down — saving state...")
    engine_manager.graceful_shutdown()
    log.info("Shutdown complete")


# ══════════════════════════════════════════════════════════════════
# FASTAPI APP — Create and configure the application
# ══════════════════════════════════════════════════════════════════

app = FastAPI(
    title="DDLJ Trading System",
    description="""
    DDLJ v10 — Live Paper Trading Backend

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
    - **Health checks** for Railway monitoring
    """,
    version="10.0.0",
    lifespan=lifespan,
    docs_url="/docs",        # Swagger UI at /docs
    redoc_url="/redoc",      # ReDoc at /redoc
)

# ── CORS (Cross-Origin Resource Sharing) ──
# This allows the frontend (on Vercel) to call the backend (on Railway).
# In production, restrict origins to your Vercel URL.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",      # Local Next.js dev server
        "http://localhost:8000",      # Local backend
        os.getenv("FRONTEND_URL", ""),  # Production Vercel URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register routes ──
app.include_router(router, prefix="/api/v1", tags=["Trading Engine"])
app.include_router(ws_router, prefix="/ws", tags=["WebSocket"])


# ── Root endpoint ──
@app.get("/", tags=["Root"])
async def root():
    """Root endpoint — quick health check and API info."""
    return {
        "name": "DDLJ Trading System",
        "version": "10.0.0",
        "status": "running",
        "docs": "/docs",
        "websocket": "/ws/status",
    }


# ══════════════════════════════════════════════════════════════════
# EXPORTS — For uvicorn to find the app
# ══════════════════════════════════════════════════════════════════

# The app object is what uvicorn looks for: `uvicorn main:app`
