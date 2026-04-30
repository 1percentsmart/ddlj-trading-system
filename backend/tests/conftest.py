"""
DDLJ Trading System — Test Configuration
============================================

Shared fixtures for all test modules.
Provides a test client, mock engine manager, and in-memory database.
"""

import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, AsyncMock, patch

import pytest

# ── Ensure backend root is on sys.path ──
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# ── Set test environment variables BEFORE importing app ──
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("KITE_API_KEY", "test_api_key")
os.environ.setdefault("KITE_API_SECRET", "test_api_secret")
os.environ.setdefault("DATABASE_URL", "")  # Use SQLite for tests
os.environ.setdefault("ENABLE_MARKET_HOURS_GUARD", "false")
os.environ.setdefault("ENABLE_SESSION_RECOVERY", "false")
os.environ.setdefault("ENABLE_TELEGRAM", "false")
os.environ.setdefault("ENABLE_TOKEN_AUTO_REFRESH", "false")
os.environ.setdefault("ENABLE_WEBSOCKET", "false")


@pytest.fixture
def mock_engine_manager():
    """Create a mock EngineManager with typical responses."""
    mgr = MagicMock()
    mgr._running = False
    mgr._trader = None
    mgr._initialized = True
    mgr._error_count = 0
    mgr._start_time = None
    mgr._config_override = {}

    # Default status response
    mgr.get_status.return_value = {
        "engine_running": False,
        "initialized": True,
        "error_count": 0,
        "start_time": None,
        "stop_time": None,
        "token": {"stored": False, "valid": False, "user": None},
        "last_heartbeat": None,
    }

    # Default config
    mgr.get_config.return_value = {
        "STARTING_CAPITAL": 50000,
        "DAILY_RISK_PCT": 6.0,
        "TRADE_INDEX": "BANKNIFTY",
    }

    mgr.start_engine.return_value = {"status": "started", "message": "Trading engine is running"}
    mgr.stop_engine.return_value = {"status": "stopped", "message": "Trading engine stopped gracefully"}
    mgr.exchange_token.return_value = {"status": "success", "user": "test_user", "message": "Token exchanged"}
    mgr.update_config.return_value = {"updated": ["DAILY_RISK_PCT"], "live_updated": [], "restart_needed": ["DAILY_RISK_PCT"]}

    return mgr


@pytest.fixture
def running_engine_manager(mock_engine_manager):
    """Create a mock EngineManager that's in a running state."""
    from datetime import datetime
    import pytz
    IST = pytz.timezone("Asia/Kolkata")

    mock_engine_manager._running = True
    mock_engine_manager.get_status.return_value = {
        "engine_running": True,
        "initialized": True,
        "error_count": 0,
        "start_time": datetime.now(IST).isoformat(),
        "stop_time": None,
        "token": {"stored": True, "valid": True, "user": "test_user"},
        "last_heartbeat": datetime.now(IST).isoformat(),
        "capital": 52000,
        "peak_capital": 53000,
        "daily_pnl": 2000,
        "daily_trade_count": 2,
        "open_positions": 1,
        "total_closed_trades": 5,
        "last_bias": "BULLISH",
        "index": "BANKNIFTY",
        "entry_tf": "15m",
        "bias_tf": "60m",
        "live_vix": 14.5,
        "uptime_seconds": 3600,
    }
    return mock_engine_manager


@pytest.fixture
def app_with_mock(mock_engine_manager):
    """Create a FastAPI test app with mocked engine manager."""
    from fastapi import FastAPI
    from api.routes import router
    from api.routes_live_safety import router as live_safety_router

    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    app.include_router(live_safety_router, prefix="/api/v1")

    # Store mock engine manager on app.state
    app.state.engine_manager = mock_engine_manager
    app.state.health_monitor = None

    return app


@pytest.fixture
def client(app_with_mock):
    """Create a test client."""
    from httpx import AsyncClient, ASGITransport

    transport = ASGITransport(app=app_with_mock)
    return AsyncClient(transport=transport, base_url="http://test")
