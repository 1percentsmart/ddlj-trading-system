#!/usr/bin/env python3
"""
DDLJ Trading System — REST API Routes
========================================

All REST API endpoints for controlling and monitoring the trading engine.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field

from api.deps import get_engine_manager
from services.engine_manager import EngineManager
from core.exceptions import EngineAlreadyRunningError, error_to_response
from core.config import get_config_summary

log = logging.getLogger("ddlj_backend")
router = APIRouter()


class StartEngineRequest(BaseModel):
    config_override: Optional[dict] = Field(default=None)


class TokenExchangeRequest(BaseModel):
    request_token: str = Field(...)


class ConfigUpdateRequest(BaseModel):
    updates: dict = Field(...)


@router.get("/status")
async def get_status(mgr: EngineManager = Depends(get_engine_manager)):
    return mgr.get_status()


@router.get("/readiness")
async def readiness(mgr: EngineManager = Depends(get_engine_manager)):
    """Deployment and live-trading readiness check for dashboard/Railway smoke tests."""
    status = mgr.get_status()
    token = status.get("token", {})
    config = get_config_summary()

    checks = {
        "engine_manager_initialized": bool(status.get("initialized")),
        "kite_api_key_set": bool(config.get("kite_api_key_set")),
        "kite_api_secret_set": bool(config.get("kite_api_secret_set")),
        "database_configured": bool(config.get("database_configured")),
        "kite_token_stored": bool(token.get("stored")),
        "kite_token_valid": bool(token.get("valid")),
        "telegram_enabled": bool(config.get("telegram_enabled")),
        "websocket_enabled": bool(config.get("websocket_enabled")),
        "market_hours_guard_enabled": bool(config.get("market_hours_guard_enabled")),
    }

    blockers = [name for name, ok in checks.items() if name in {
        "engine_manager_initialized",
        "kite_api_key_set",
        "kite_api_secret_set",
        "database_configured",
        "kite_token_stored",
        "kite_token_valid",
    } and not ok]

    return {
        "status": "ready" if not blockers else "not_ready",
        "checks": checks,
        "blockers": blockers,
        "engine_running": bool(status.get("engine_running")),
        "next_actions": [
            "Set missing Railway environment variables",
            "Exchange daily Kite request token via POST /api/v1/token",
            "Start paper/live-test engine via POST /api/v1/start only after readiness is ready",
        ] if blockers else ["Start engine with POST /api/v1/start during market hours or run backtest first"],
    }


@router.get("/health")
async def health_check(request: Request, mgr: EngineManager = Depends(get_engine_manager)):
    """Return health status using the registered HealthMonitor checks."""
    try:
        # Access health_monitor via Request object to avoid circular import
        # (main imports routes, so routes must NOT import main)
        health_monitor = getattr(request.app.state, "health_monitor", None)
        if health_monitor:
            return health_monitor.get_health()
    except Exception:
        pass

    # Fallback: simple health check
    try:
        status = mgr.get_status()
        if not status.get("initialized", False):
            return {"status": "unhealthy", "reason": "Engine manager not initialized"}
        if status.get("error_count", 0) > 5:
            return {"status": "degraded", "reason": f"Too many errors: {status['error_count']}"}
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
async def start_engine(request: StartEngineRequest = None, mgr: EngineManager = Depends(get_engine_manager)):
    config_override = request.config_override if request and request.config_override else None
    try:
        return mgr.start_engine(config_override=config_override)
    except EngineAlreadyRunningError as e:
        raise HTTPException(status_code=409, detail=error_to_response(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start engine: {e}")


@router.post("/stop")
async def stop_engine(mgr: EngineManager = Depends(get_engine_manager)):
    return mgr.stop_engine()


# Sensitive keys that should never be exposed via the API
_SENSITIVE_KEYS = frozenset({
    "KITE_API_KEY", "KITE_API_SECRET", "AUTH_SECRET_KEY",
    "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID",
})

@router.get("/config")
async def get_config(mgr: EngineManager = Depends(get_engine_manager)):
    config = mgr.get_config()
    # Filter out sensitive values before returning
    return {k: ("***" if k in _SENSITIVE_KEYS else v) for k, v in config.items()}


@router.put("/config")
async def update_config(request: ConfigUpdateRequest, mgr: EngineManager = Depends(get_engine_manager)):
    return mgr.update_config(request.updates)


@router.post("/token")
async def exchange_token(request: TokenExchangeRequest, mgr: EngineManager = Depends(get_engine_manager)):
    result = mgr.exchange_token(request.request_token)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message", "Token exchange failed"))
    return result


@router.get("/token/status")
async def get_token_status(mgr: EngineManager = Depends(get_engine_manager)):
    status = mgr.get_status()
    return status.get("token", {"stored": False, "valid": False})


@router.get("/token/login")
async def get_login_url():
    try:
        from engine.token_manager import get_login_url as _get_login_url
        return {"login_url": _get_login_url()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate login URL: {e}")


@router.get("/trades")
async def get_trades(limit: int = 50, offset: int = 0, mgr: EngineManager = Depends(get_engine_manager)):
    if mgr._trader is not None and hasattr(mgr._trader, 'closed_trades'):
        trades = mgr._trader.closed_trades
        total = len(trades)
        paginated = trades[offset:offset + limit]
        trade_list = []
        for idx, t in enumerate(paginated):
            trade_dict = {
                "id": str(idx + offset),
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
            if getattr(t, "mode", None) == "options":
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
        return {"total": total, "limit": limit, "offset": offset, "trades": trade_list}
    return {"total": 0, "limit": limit, "offset": offset, "trades": []}


@router.get("/positions")
async def get_positions(mgr: EngineManager = Depends(get_engine_manager)):
    if mgr._trader is not None and hasattr(mgr._trader, 'open_positions'):
        positions = []
        for idx, pos in enumerate(mgr._trader.open_positions):
            pos_dict = {
                "id": str(idx),
                "symbol": pos.symbol,
                "direction": pos.direction,
                "entry": pos.entry,
                "entry_time": str(pos.entry_time),
                "qty": pos.qty,
                "sl": pos.sl,
                "target": pos.target,
                "rr": pos.rr,
                "held": pos.held,
                "be_done": pos.be_done,
                "atr_at_entry": pos.atr_at_entry,
                # Option fields — extracted from opt_entry dict if available
                "option_strike": getattr(pos, "opt_entry", {}).get("strike") if getattr(pos, "opt_entry", None) else None,
                "option_type": getattr(pos, "opt_entry", {}).get("option_type") if getattr(pos, "opt_entry", None) else None,
                "current_premium": getattr(pos, "current_premium", None),
                "unrealized_pnl": getattr(pos, "unrealized_pnl", None),
            }
            positions.append(pos_dict)
        return {"count": len(positions), "positions": positions}
    return {"count": 0, "positions": []}


@router.post("/backtest/run")
async def run_backtest():
    """Run the DDLJ backtest engine and return results."""
    import threading
    import json
    from pathlib import Path

    log.info("Backtest: Request received — starting in background thread")

    # The backtest needs a valid Kite token to fetch data
    try:
        from engine.token_manager import token_status
        token_info = token_status()
        if not token_info.get("valid", False):
            return {
                "status": "error",
                "message": "Kite token is not valid. Please exchange a fresh token first via the Token page.",
                "hint": "Tokens expire daily — visit the Token page to get a new one.",
            }
    except Exception as e:
        log.warning("Backtest: Could not check token status: %s", e)

    # Run backtest in a background thread so we don't block the API
    backtest_result = {"status": "running", "message": "Backtest started"}

    def _run_backtest_thread():
        """Run backtest in a background thread."""
        try:
            from engine.run_backtest import main as run_bt
            result = run_bt()
            backtest_result["status"] = "completed"
            backtest_result["data"] = result
            log.info("Backtest: Completed successfully")
        except Exception as e:
            backtest_result["status"] = "error"
            backtest_result["message"] = f"Backtest failed: {e}"
            log.error("Backtest: Failed — %s", e, exc_info=True)

    # Start backtest in background
    bt_thread = threading.Thread(target=_run_backtest_thread, name="DDLJ-Backtest", daemon=True)
    bt_thread.start()

    return {
        "status": "started",
        "message": "Backtest is running in the background. Results will be saved to download/v9_backtest_results.json.",
        "note": "Check the Health page or backend logs for progress. Backtest typically takes 2-5 minutes.",
    }


@router.get("/backtest/status")
async def backtest_status():
    """Check if a backtest is currently running and get last results."""
    import json
    from pathlib import Path

    # Check for results file
    try:
        from core.config import PROJECT_ROOT
        results_path = PROJECT_ROOT / "download" / "v9_backtest_results.json"
    except Exception:
        results_path = Path("/app/download/v9_backtest_results.json")

    if results_path.exists():
        try:
            with open(results_path) as f:
                data = json.load(f)
            return {
                "status": "completed",
                "last_results": {
                    "version": data.get("version", "unknown"),
                    "configs_tested": len(data.get("method_a_compounding", {})),
                    "method_a_top": dict(list(data.get("method_a_compounding", {}).items())[:3]),
                    "method_b_top": dict(list(data.get("method_b_monthly_batch", {}).items())[:3]),
                },
            }
        except Exception as e:
            return {"status": "error", "message": f"Could not read results: {e}"}

    return {"status": "no_results", "message": "No backtest results found. Run POST /backtest/run first."}


# ============================================================================
# DATABASE-PERSISTED ENDPOINTS — Survive server restarts
# ============================================================================

@router.get("/db/trades")
async def get_db_trades(limit: int = 50, offset: int = 0, symbol: Optional[str] = None):
    """Get trades from the persistent database (survives restarts)."""
    try:
        from database.connection import get_session
        from database.crud import get_trades as db_get_trades

        async for session in get_session():
            trades = await db_get_trades(session, limit=limit, offset=offset, symbol=symbol)
            trade_list = []
            for t in trades:
                trade_list.append({
                    "id": t.id,
                    "session_id": t.session_id,
                    "symbol": t.symbol,
                    "direction": t.direction,
                    "entry_price": t.entry_price,
                    "exit_price": t.exit_price,
                    "entry_time": str(t.entry_time),
                    "exit_time": str(t.exit_time),
                    "sl": t.sl,
                    "target": t.target,
                    "qty": t.qty,
                    "gross_pnl": t.gross_pnl,
                    "costs": t.costs,
                    "net_pnl": t.net_pnl,
                    "exit_reason": t.exit_reason,
                    "rr": t.rr,
                    "option_strike": t.option_strike,
                    "option_type": t.option_type,
                    "option_entry_premium": t.option_entry_premium,
                    "option_exit_premium": t.option_exit_premium,
                    "option_delta": t.option_delta,
                    "option_iv_entry": t.option_iv_entry,
                    "mode": t.mode,
                    "created_at": str(t.created_at),
                })
            return {"total": len(trade_list), "limit": limit, "offset": offset, "trades": trade_list}
    except Exception as e:
        log.warning("DB trades endpoint failed: %s — returning empty", e)
        return {"total": 0, "limit": limit, "offset": offset, "trades": [], "error": str(e)}


@router.get("/db/positions")
async def get_db_positions():
    """Get open positions from the persistent database."""
    try:
        from database.connection import get_session
        from database.crud import get_open_positions as db_get_positions

        async for session in get_session():
            positions = await db_get_positions(session)
            pos_list = []
            for p in positions:
                pos_list.append({
                    "id": p.id,
                    "session_id": p.session_id,
                    "symbol": p.symbol,
                    "direction": p.direction,
                    "entry_price": p.entry_price,
                    "entry_time": str(p.entry_time),
                    "qty": p.qty,
                    "sl": p.sl,
                    "target": p.target,
                    "rr": p.rr,
                    "held": p.held,
                    "be_done": p.be_done,
                    "atr_at_entry": p.atr_at_entry,
                    "status": p.status,
                    "created_at": str(p.created_at),
                    "updated_at": str(p.updated_at),
                })
            return {"count": len(pos_list), "positions": pos_list}
    except Exception as e:
        log.warning("DB positions endpoint failed: %s — returning empty", e)
        return {"count": 0, "positions": [], "error": str(e)}


@router.get("/db/sessions")
async def get_db_sessions(limit: int = 20, offset: int = 0):
    """Get trading sessions from the persistent database."""
    try:
        from database.connection import get_session
        from database.crud import get_sessions as db_get_sessions

        async for session in get_session():
            sessions = await db_get_sessions(session, limit=limit, offset=offset)
            session_list = []
            for s in sessions:
                session_list.append({
                    "id": s.id,
                    "session_id": s.session_id,
                    "start_time": str(s.start_time),
                    "end_time": str(s.end_time) if s.end_time else None,
                    "starting_capital": s.starting_capital,
                    "ending_capital": s.ending_capital,
                    "total_trades": s.total_trades,
                    "total_pnl": s.total_pnl,
                    "status": s.status,
                    "created_at": str(s.created_at),
                })
            return {"total": len(session_list), "sessions": session_list}
    except Exception as e:
        log.warning("DB sessions endpoint failed: %s — returning empty", e)
        return {"total": 0, "sessions": [], "error": str(e)}


@router.get("/db/errors")
async def get_db_errors(limit: int = 50, severity: Optional[str] = None):
    """Get error log from the persistent database."""
    try:
        from database.connection import get_session
        from database.crud import get_errors as db_get_errors

        async for session in get_session():
            errors = await db_get_errors(session, limit=limit, severity=severity)
            error_list = []
            for e in errors:
                error_list.append({
                    "id": e.id,
                    "error_type": e.error_type,
                    "error_message": e.error_message,
                    "module": e.module,
                    "severity": e.severity,
                    "resolved": e.resolved,
                    "created_at": str(e.created_at),
                })
            return {"total": len(error_list), "errors": error_list}
    except Exception as e:
        log.warning("DB errors endpoint failed: %s — returning empty", e)
        return {"total": 0, "errors": [], "error": str(e)}
