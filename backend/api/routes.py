#!/usr/bin/env python3
"""
DDLJ Trading System — REST API Routes
========================================

All REST API endpoints for controlling and monitoring the trading engine.

Endpoints:
  GET  /api/v1/status      — Engine status (capital, P&L, positions, bias)
  GET  /api/v1/health      — Health check for Railway monitoring
  POST /api/v1/start       — Start the trading engine
  POST /api/v1/stop        — Stop the trading engine
  GET  /api/v1/config      — Get current configuration
  PUT  /api/v1/config      — Update configuration
  POST /api/v1/token       — Exchange a Kite request token
  GET  /api/v1/trades      — Get trade history
  GET  /api/v1/positions   — Get current open positions
  GET  /api/v1/token/status — Get Kite token status
  GET  /api/v1/token/login  — Get Kite login URL

Author: DDLJ Strategy Team
Version: 10.1.0
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from api.deps import get_engine_manager
from services.engine_manager import EngineManager
from core.exceptions import (
    EngineAlreadyRunningError, EngineNotRunningError,
    TokenExchangeError, error_to_response,
)

log = logging.getLogger("ddlj_backend")


# ══════════════════════════════════════════════════════════════════
# ROUTER
# ══════════════════════════════════════════════════════════════════

router = APIRouter()


# ══════════════════════════════════════════════════════════════════
# REQUEST/RESPONSE MODELS (Pydantic)
# ══════════════════════════════════════════════════════════════════

class StartEngineRequest(BaseModel):
    """Request body for starting the trading engine."""
    config_override: Optional[dict] = Field(
        default=None,
        description="Override any config parameter. Example: {'STARTING_CAPITAL': 100000, 'DAILY_RISK_PCT': 4.0}",
        examples=[{
            "STARTING_CAPITAL": 100000,
            "DAILY_RISK_PCT": 4.0,
            "TRADE_INDEX": "NIFTY",
            "ENTRY_TIMEFRAME": "15m",
            "BIAS_TIMEFRAME": "60m",
        }]
    )


class TokenExchangeRequest(BaseModel):
    """Request body for exchanging a Kite request token."""
    request_token: str = Field(
        ...,
        description="The request_token from the Kite login redirect URL.",
        examples=["EeU4JBYusoahaHM9Wts1JRUAjbFIbKCf"]
    )


class ConfigUpdateRequest(BaseModel):
    """Request body for updating engine configuration."""
    updates: dict = Field(
        ...,
        description="Config parameters to update. Key = parameter name, Value = new value.",
        examples=[{"DAILY_RISK_PCT": 4.0, "MAX_OPEN_POSITIONS": 3}]
    )


# ══════════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════════

@router.get("/status")
async def get_status(mgr: EngineManager = Depends(get_engine_manager)):
    """
    Get the current trading engine status.

    Returns comprehensive status including:
    - Engine running state
    - Current capital and P&L
    - Open positions count
    - Current bias direction
    - Live VIX value
    - Token status
    - Uptime and error count
    """
    return mgr.get_status()


@router.get("/health")
async def health_check(mgr: EngineManager = Depends(get_engine_manager)):
    """
    Health check endpoint for Railway monitoring.

    Railway pings this endpoint periodically to check if the server
    is alive. If this returns non-200, Railway restarts the server.

    Returns:
        - "healthy" if all critical components are working
        - "degraded" if running but some components have issues
        - "unhealthy" if critical components are down
    """
    # Use the health monitor if available
    from fastapi import Request
    # Try to get health monitor from app state
    try:
        # We need to access app.state, but we're in a route.
        # Use a simple approach: check engine manager status
        status = mgr.get_status()

        # Determine health status
        if not status.get("initialized", False):
            return {"status": "unhealthy", "reason": "Engine manager not initialized"}

        if status.get("error_count", 0) > 5:
            return {"status": "degraded", "reason": f"Too many errors: {status['error_count']}"}

        # Check token status
        token = status.get("token", {})
        if not token.get("stored", False):
            return {
                "status": "degraded",
                "reason": "No Kite access token — engine cannot connect to API",
                "action": "Provide a request token via POST /api/v1/token",
            }

        return {
            "status": "healthy",
            "engine_running": status.get("engine_running", False),
            "token_valid": token.get("valid", False),
        }
    except Exception as e:
        return {"status": "unhealthy", "reason": str(e)}


@router.post("/start")
async def start_engine(
    request: StartEngineRequest = None,
    mgr: EngineManager = Depends(get_engine_manager),
):
    """
    Start the trading engine.

    The engine connects to Kite API, warms up indicators, loads
    previous session state, and enters the main trading loop.

    Requires a valid Kite access token. If the token is expired,
    the engine will fail to start. Use POST /api/v1/token first.

    Optional: Pass config_override to customize parameters for this session.
    """
    config_override = None
    if request and request.config_override:
        config_override = request.config_override

    try:
        result = mgr.start_engine(config_override=config_override)
        return result
    except EngineAlreadyRunningError as e:
        raise HTTPException(status_code=409, detail=error_to_response(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start engine: {e}")


@router.post("/stop")
async def stop_engine(mgr: EngineManager = Depends(get_engine_manager)):
    """
    Stop the trading engine gracefully.

    The engine will:
    1. Stop taking new trades
    2. Save current session state
    3. Close any open positions (force close)
    4. Exit the main loop
    """
    return mgr.stop_engine()


@router.get("/config")
async def get_config(mgr: EngineManager = Depends(get_engine_manager)):
    """
    Get the current engine configuration.

    Returns all config parameters with their current values.
    If the engine is running, returns the live config.
    Otherwise, returns the default config with any stored overrides.
    """
    return mgr.get_config()


@router.put("/config")
async def update_config(
    request: ConfigUpdateRequest,
    mgr: EngineManager = Depends(get_engine_manager),
):
    """
    Update engine configuration.

    Most changes require an engine restart to take full effect.
    Some parameters (like DAILY_RISK_PCT) can be updated live.

    Returns which parameters were updated live vs which need restart.
    """
    return mgr.update_config(request.updates)


@router.post("/token")
async def exchange_token(
    request: TokenExchangeRequest,
    mgr: EngineManager = Depends(get_engine_manager),
):
    """
    Exchange a Kite request token for an access token.

    Kite access tokens expire daily. Every morning, you must:
    1. Visit: https://kite.trade/connect/login?api_key=YOUR_API_KEY&v=3
    2. Login to Zerodha
    3. Copy the request_token from the redirect URL
    4. Submit it here

    If the engine is running, it will be restarted with the new token.
    """
    result = mgr.exchange_token(request.request_token)

    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message", "Token exchange failed"))

    return result


@router.get("/token/status")
async def get_token_status(mgr: EngineManager = Depends(get_engine_manager)):
    """
    Get the current Kite API token status.

    Returns whether a token is stored, valid, and when it expires.
    """
    status = mgr.get_status()
    return status.get("token", {"stored": False, "valid": False})


@router.get("/token/login")
async def get_login_url():
    """
    Get the Kite login URL for token generation.

    Open this URL in a browser, login to Zerodha, and copy the
    request_token from the redirect URL.
    """
    try:
        from engine.token_manager import get_login_url as _get_login_url
        return {"login_url": _get_login_url()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate login URL: {e}")


@router.get("/trades")
async def get_trades(
    limit: int = 50,
    offset: int = 0,
    mgr: EngineManager = Depends(get_engine_manager),
):
    """
    Get trade history.

    Returns the list of completed trades from the current session.
    In the future, this will query the Supabase database for
    historical trades across all sessions.

    Args:
        limit (int): Maximum number of trades to return. Default: 50.
        offset (int): Number of trades to skip. Default: 0.
    """
    status = mgr.get_status()

    # Get trades from the running engine
    if mgr._trader is not None and hasattr(mgr._trader, 'closed_trades'):
        trades = mgr._trader.closed_trades
        total = len(trades)

        # Paginate
        paginated = trades[offset:offset + limit]

        # Convert Trade objects to dicts
        trade_list = []
        for t in paginated:
            trade_dict = {
                "symbol": t.symbol,
                "direction": t.direction,
                "entry": t.entry,
                "exit": t.exit,
                "entry_time": str(t.entry_time),
                "exit_time": str(t.exit_time),
                "sl": t.sl,
                "target": t.target,
                "qty": t.qty,
                "gross": t.gross,
                "costs": t.costs,
                "net": t.net,
                "exit_reason": t.exit_reason,
                "rr": t.rr,
                "held": t.held,
                "mode": t.mode,
            }
            if t.mode == "options":
                trade_dict.update({
                    "option_strike": t.option_strike,
                    "option_type": t.option_type,
                    "option_entry_premium": t.option_entry_premium,
                    "option_exit_premium": t.option_exit_premium,
                    "option_delta": t.option_delta,
                    "option_iv_entry": t.option_iv_entry,
                    "option_iv_exit": t.option_iv_exit,
                })
            trade_list.append(trade_dict)

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "trades": trade_list,
        }

    return {"total": 0, "limit": limit, "offset": offset, "trades": []}


@router.get("/positions")
async def get_positions(mgr: EngineManager = Depends(get_engine_manager)):
    """
    Get current open positions.

    Returns all currently open positions with their details
    including entry price, stop loss, target, and P&L estimate.
    """
    if mgr._trader is not None and hasattr(mgr._trader, 'open_positions'):
        positions = []
        for pos in mgr._trader.open_positions:
            positions.append({
                "symbol": pos.symbol,
                "direction": pos.direction,
                "entry": pos.entry,
                "entry_time": pos.entry_time,
                "qty": pos.qty,
                "sl": pos.sl,
                "target": pos.target,
                "rr": pos.rr,
                "held": pos.held,
                "be_done": pos.be_done,
                "atr_at_entry": pos.atr_at_entry,
            })
        return {"count": len(positions), "positions": positions}

    return {"count": 0, "positions": []}
