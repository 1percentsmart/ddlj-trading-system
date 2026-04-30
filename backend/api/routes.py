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


class BacktestRunRequest(BaseModel):
    """Request body for running a backtest with user-configurable parameters."""
    symbol: Optional[str] = "both"
    timeframe: Optional[str] = "all"
    method: Optional[str] = "both"
    from_date: Optional[str] = None
    to_date: Optional[str] = None
    capital: Optional[float] = None
    sl_atr: Optional[float] = None
    min_rr: Optional[float] = None
    moneyness: Optional[str] = None
    daily_risk_pct: Optional[float] = None
    max_open_positions: Optional[int] = None
    max_daily_trades: Optional[int] = None


# ── Global backtest state tracker ─────────────────────────────────────
# WHY: The previous implementation had no way to tell if a backtest was
#      currently running. The status endpoint only checked the results file,
#      which doesn't exist until the backtest completes. This caused the
#      frontend to give up polling after the first "no_results" response.
_backtest_state = {
    "status": "idle",          # "idle" | "running" | "completed" | "error"
    "started_at": None,        # ISO timestamp when backtest started
    "error_message": None,     # Error message if backtest failed
    "params": None,            # Parameters used for the current/last run
    "progress": {              # Real-time progress info
        "phase": "idle",       # "idle" | "fetching" | "running" | "analyzing" | "saving" | "done"
        "current_config": 0,   # Current config being tested
        "total_configs": 0,    # Total configs to test
        "current_label": "",   # Label of current config (e.g. "BN_15mx60m_sl2.0_RR1.5_ITM")
        "data_fetched": False,  # Whether candle data was fetched
        "candle_counts": {},   # Candle counts per symbol+interval
        "pct": 0,             # Overall progress percentage (0-100)
        "message": "",        # Human-readable progress message
    },
}


def _get_results_path():
    """Resolve the backtest results file path consistently.

    WHY: Previously, routes.py and run_backtest.py used DIFFERENT path
    resolution logic, which could cause the status endpoint to look in
    the wrong directory. Now we use the same DOWNLOAD_DIR from core.config.
    """
    from pathlib import Path
    try:
        from core.config import DOWNLOAD_DIR
        return DOWNLOAD_DIR / "v9_backtest_results.json"
    except Exception:
        return Path("/app/download/v9_backtest_results.json")


@router.post("/backtest/run")
async def run_backtest(request: BacktestRunRequest = None):
    """Run the DDLJ backtest engine with user-configurable parameters."""
    import threading
    import json
    from datetime import datetime, timezone

    # Prevent starting a new backtest if one is already running
    if _backtest_state["status"] == "running":
        return {
            "status": "already_running",
            "message": "A backtest is already in progress. Please wait for it to complete.",
            "started_at": _backtest_state["started_at"],
            "params": _backtest_state["params"],
        }

    # Build params dict from request, filtering out None values
    params = {}
    if request:
        for key in ["symbol", "timeframe", "method", "from_date", "to_date",
                     "capital", "sl_atr", "min_rr", "moneyness",
                     "daily_risk_pct", "max_open_positions", "max_daily_trades"]:
            val = getattr(request, key, None)
            if val is not None:
                params[key] = val

    log.info("Backtest: Request received with params=%s — starting in background thread", params)

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

    # Update global state to "running"
    _backtest_state["status"] = "running"
    _backtest_state["started_at"] = datetime.now(timezone.utc).isoformat()
    _backtest_state["error_message"] = None
    _backtest_state["params"] = params
    _backtest_state["progress"] = {
        "phase": "starting",
        "current_config": 0,
        "total_configs": 0,
        "current_label": "",
        "data_fetched": False,
        "candle_counts": {},
        "pct": 0,
        "message": "Initializing backtest...",
    }

    def _update_progress(**kwargs):
        """Thread-safe progress update helper."""
        _backtest_state["progress"].update(kwargs)
        # Auto-calculate percentage from current_config/total_configs if not explicit
        if "pct" not in kwargs:
            total = _backtest_state["progress"].get("total_configs", 0)
            current = _backtest_state["progress"].get("current_config", 0)
            if total > 0:
                _backtest_state["progress"]["pct"] = min(int(current / total * 100), 99)

    def _run_backtest_thread(bt_params):
        """Run backtest in a background thread and update global state with progress."""
        try:
            from engine.run_backtest import main as run_bt
            result = run_bt(bt_params, progress_callback=_update_progress)
            _backtest_state["status"] = "completed"
            _backtest_state["error_message"] = None
            _backtest_state["progress"]["phase"] = "done"
            _backtest_state["progress"]["pct"] = 100
            _backtest_state["progress"]["message"] = "Backtest completed successfully!"
            log.info("Backtest: Completed successfully")
        except Exception as e:
            _backtest_state["status"] = "error"
            _backtest_state["error_message"] = f"Backtest failed: {e}"
            _backtest_state["progress"]["phase"] = "error"
            _backtest_state["progress"]["message"] = f"Error: {e}"
            log.error("Backtest: Failed — %s", e, exc_info=True)

    # Start backtest in background
    bt_thread = threading.Thread(target=_run_backtest_thread, args=(params,), name="DDLJ-Backtest", daemon=True)
    bt_thread.start()

    return {
        "status": "started",
        "message": "Backtest is running in the background with your parameters.",
        "params": params,
        "note": "Results will be available at GET /backtest/status. Typically takes 2-5 minutes.",
        "progress_endpoint": "/backtest/progress (SSE stream)",
    }


@router.get("/backtest/status")
async def backtest_status():
    """Check if a backtest is currently running and get last results."""
    import json

    current_status = _backtest_state["status"]

    # If currently running, return running status with progress info
    if current_status == "running":
        progress = _backtest_state.get("progress", {})
        return {
            "status": "running",
            "message": "Backtest is currently in progress.",
            "started_at": _backtest_state["started_at"],
            "params": _backtest_state["params"],
            "progress": progress,
        }

    # If error, return error details
    if current_status == "error":
        return {
            "status": "error",
            "message": _backtest_state.get("error_message", "Backtest failed with unknown error."),
        }

    # Check for results file (for completed or idle status)
    results_path = _get_results_path()

    if results_path.exists():
        try:
            with open(results_path) as f:
                data = json.load(f)

            # Return FULL results — not truncated — so the frontend can display everything
            method_a = data.get("method_a_compounding", {})
            method_b = data.get("method_b_monthly_batch", {})

            return {
                "status": "completed",
                "last_results": {
                    "version": data.get("version", "unknown"),
                    "params_used": data.get("params_used", {}),
                    "configs_tested": len(method_a) + len(method_b),
                    "method_a_top": method_a,
                    "method_b_top": method_b,
                },
            }
        except Exception as e:
            return {"status": "error", "message": f"Could not read results: {e}"}

    # No results file and not running
    return {"status": "no_results", "message": "No backtest results found. Run POST /backtest/run first."}


@router.get("/backtest/progress")
async def backtest_progress():
    """SSE endpoint for real-time backtest progress updates.

    WHY: The regular status endpoint requires polling every N seconds,
    which means the user sees updates with delay. SSE (Server-Sent Events)
    pushes updates instantly as they happen, giving a real-time progress bar.

    Usage:
        const es = new EventSource('/api/v1/backtest/progress');
        es.onmessage = (e) => console.log(JSON.parse(e.data));
    """
    import asyncio
    from starlette.responses import StreamingResponse

    async def event_generator():
        """Generate SSE events from backtest progress state."""
        last_pct = -1
        idle_count = 0
        while True:
            progress = _backtest_state.get("progress", {})
            status = _backtest_state.get("status", "idle")
            pct = progress.get("pct", 0)

            # Always send an update (even if pct unchanged, phase might have)
            data = {
                "status": status,
                "phase": progress.get("phase", "idle"),
                "current_config": progress.get("current_config", 0),
                "total_configs": progress.get("total_configs", 0),
                "current_label": progress.get("current_label", ""),
                "data_fetched": progress.get("data_fetched", False),
                "candle_counts": progress.get("candle_counts", {}),
                "pct": pct,
                "message": progress.get("message", ""),
                "error_message": _backtest_state.get("error_message"),
            }
            yield f"data: {json.dumps(data)}\n\n"

            # Terminal state — send final update and close
            if status in ("completed", "error"):
                yield f"event: done\ndata: {json.dumps(data)}\n\n"
                return

            # Idle for too long — stop streaming
            if status == "idle":
                idle_count += 1
                if idle_count > 3:
                    return

            last_pct = pct
            await asyncio.sleep(1)  # Push updates every second

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


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
