"""
DDLJ Trading System — API Route Tests
========================================

Tests all REST API endpoints using mocked engine manager.
No real Kite API or database connections needed.
"""

import pytest
import asyncio
from unittest.mock import MagicMock, patch

from core.exceptions import EngineAlreadyRunningError


# ============================================================================
# TEST: GET /api/v1/status
# ============================================================================

@pytest.mark.asyncio
async def test_get_status(mock_engine_manager, app_with_mock):
    """Test that GET /status returns engine status."""
    from httpx import AsyncClient, ASGITransport

    transport = ASGITransport(app=app_with_mock)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/status")

    assert response.status_code == 200
    data = response.json()
    assert "engine_running" in data
    assert "initialized" in data
    assert "token" in data


@pytest.mark.asyncio
async def test_get_status_running(running_engine_manager, app_with_mock):
    """Test status when engine is running."""
    # Override the mock to return running state
    app_with_mock.state.engine_manager = running_engine_manager

    from httpx import AsyncClient, ASGITransport

    transport = ASGITransport(app=app_with_mock)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/status")

    assert response.status_code == 200
    data = response.json()
    assert data["engine_running"] is True
    assert data["capital"] == 52000
    assert data["daily_pnl"] == 2000


# ============================================================================
# TEST: GET /api/v1/health
# ============================================================================

@pytest.mark.asyncio
async def test_health_check_degraded(mock_engine_manager, app_with_mock):
    """Test health check when no token is stored (degraded)."""
    from httpx import AsyncClient, ASGITransport

    transport = ASGITransport(app=app_with_mock)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("healthy", "degraded", "unhealthy")


# ============================================================================
# TEST: GET /api/v1/readiness
# ============================================================================

@pytest.mark.asyncio
async def test_readiness(mock_engine_manager, app_with_mock):
    """Test readiness check endpoint."""
    from httpx import AsyncClient, ASGITransport

    transport = ASGITransport(app=app_with_mock)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/readiness")

    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "checks" in data
    assert "blockers" in data


# ============================================================================
# TEST: POST /api/v1/start
# ============================================================================

@pytest.mark.asyncio
async def test_start_engine(mock_engine_manager, app_with_mock):
    """Test starting the trading engine."""
    from httpx import AsyncClient, ASGITransport

    transport = ASGITransport(app=app_with_mock)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/start", json={})

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "started"


@pytest.mark.asyncio
async def test_start_engine_already_running(mock_engine_manager, app_with_mock):
    """Test starting engine when it's already running (should return 409)."""
    mock_engine_manager.start_engine.side_effect = EngineAlreadyRunningError()

    from httpx import AsyncClient, ASGITransport

    transport = ASGITransport(app=app_with_mock)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/start", json={})

    assert response.status_code == 409
    data = response.json()
    assert "ENGINE_ALREADY_RUNNING" in data.get("detail", {}).get("error", "")


# ============================================================================
# TEST: POST /api/v1/stop
# ============================================================================

@pytest.mark.asyncio
async def test_stop_engine(mock_engine_manager, app_with_mock):
    """Test stopping the trading engine."""
    from httpx import AsyncClient, ASGITransport

    transport = ASGITransport(app=app_with_mock)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/stop")

    assert response.status_code == 200
    data = response.json()
    assert "status" in data


# ============================================================================
# TEST: Token endpoints
# ============================================================================

@pytest.mark.asyncio
async def test_get_token_status(mock_engine_manager, app_with_mock):
    """Test getting token status."""
    from httpx import AsyncClient, ASGITransport

    transport = ASGITransport(app=app_with_mock)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/token/status")

    assert response.status_code == 200
    data = response.json()
    assert "stored" in data
    assert "valid" in data


@pytest.mark.asyncio
async def test_exchange_token(mock_engine_manager, app_with_mock):
    """Test exchanging a Kite request token."""
    from httpx import AsyncClient, ASGITransport

    transport = ASGITransport(app=app_with_mock)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/token",
            json={"request_token": "test_request_token_123"}
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"


@pytest.mark.asyncio
async def test_exchange_token_failure(mock_engine_manager, app_with_mock):
    """Test token exchange failure."""
    mock_engine_manager.exchange_token.return_value = {
        "status": "error",
        "message": "Invalid request token"
    }

    from httpx import AsyncClient, ASGITransport

    transport = ASGITransport(app=app_with_mock)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/token",
            json={"request_token": "bad_token"}
        )

    assert response.status_code == 400


# ============================================================================
# TEST: Config endpoints
# ============================================================================

@pytest.mark.asyncio
async def test_get_config(mock_engine_manager, app_with_mock):
    """Test getting engine configuration."""
    # Include a sensitive key to test masking
    mock_engine_manager.get_config.return_value = {
        "STARTING_CAPITAL": 50000,
        "DAILY_RISK_PCT": 6.0,
        "TRADE_INDEX": "BANKNIFTY",
        "KITE_API_KEY": "test_api_key",
        "KITE_API_SECRET": "test_api_secret",
    }

    from httpx import AsyncClient, ASGITransport

    transport = ASGITransport(app=app_with_mock)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/config")

    assert response.status_code == 200
    data = response.json()
    assert "STARTING_CAPITAL" in data
    # Sensitive keys must be masked
    assert data.get("KITE_API_KEY") == "***"
    assert data.get("KITE_API_SECRET") == "***"


@pytest.mark.asyncio
async def test_update_config(mock_engine_manager, app_with_mock):
    """Test updating engine configuration."""
    from httpx import AsyncClient, ASGITransport

    transport = ASGITransport(app=app_with_mock)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.put(
            "/api/v1/config",
            json={"updates": {"DAILY_RISK_PCT": 3.0}}
        )

    assert response.status_code == 200


# ============================================================================
# TEST: Trades and Positions endpoints
# ============================================================================

@pytest.mark.asyncio
async def test_get_trades_empty(mock_engine_manager, app_with_mock):
    """Test getting trades when engine hasn't run."""
    from httpx import AsyncClient, ASGITransport

    transport = ASGITransport(app=app_with_mock)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/trades")

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert data["trades"] == []


@pytest.mark.asyncio
async def test_get_positions_empty(mock_engine_manager, app_with_mock):
    """Test getting positions when engine hasn't run."""
    from httpx import AsyncClient, ASGITransport

    transport = ASGITransport(app=app_with_mock)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/positions")

    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 0
    assert data["positions"] == []


# ============================================================================
# TEST: Live Safety endpoints
# ============================================================================

@pytest.mark.asyncio
async def test_live_readiness(app_with_mock):
    """Test live trading readiness check."""
    from httpx import AsyncClient, ASGITransport

    transport = ASGITransport(app=app_with_mock)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/live/readiness")

    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "checks" in data


@pytest.mark.asyncio
async def test_kill_switch(app_with_mock):
    """Test kill switch activation and reset."""
    from httpx import AsyncClient, ASGITransport

    transport = ASGITransport(app=app_with_mock)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Activate kill switch
        response = await client.post("/api/v1/live/kill-switch?reason=test")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "blocked"

        # Reset kill switch
        response = await client.post("/api/v1/live/kill-switch/reset")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "clear"
