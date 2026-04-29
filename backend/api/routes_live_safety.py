#!/usr/bin/env python3
"""Live trading safety endpoints.

These endpoints deliberately do NOT place orders. They expose hard-readiness
checks and a manual kill switch so live execution can only be added behind
explicit, auditable controls.
"""

from __future__ import annotations

import os
from datetime import datetime, time as dt_time

import pytz
from fastapi import APIRouter, Depends

from api.deps import get_engine_manager
from services.engine_manager import EngineManager
from core.config import get_config_summary

router = APIRouter(prefix="/live", tags=["live-safety"])
IST = pytz.timezone("Asia/Kolkata")

_KILL_SWITCH = False
_KILL_SWITCH_REASON = None


def _env_true(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


def _market_open_now() -> bool:
    now = datetime.now(IST)
    return now.weekday() < 5 and dt_time(9, 15) <= now.time() <= dt_time(15, 30)


@router.get("/readiness")
async def live_readiness(mgr: EngineManager = Depends(get_engine_manager)):
    """Return live-order readiness without placing any order."""
    status = mgr.get_status()
    token = status.get("token", {})
    config = get_config_summary()

    trading_mode = os.getenv("TRADING_MODE", "paper").strip().lower()
    checks = {
        "trading_mode_live": trading_mode == "live",
        "live_trading_enabled": _env_true("LIVE_TRADING_ENABLED"),
        "confirm_live_risk": _env_true("CONFIRM_LIVE_RISK"),
        "kill_switch_clear": not _KILL_SWITCH,
        "market_open": _market_open_now(),
        "engine_initialized": bool(status.get("initialized")),
        "kite_api_key_set": bool(config.get("kite_api_key_set")),
        "kite_api_secret_set": bool(config.get("kite_api_secret_set")),
        "database_configured": bool(config.get("database_configured")),
        "kite_token_stored": bool(token.get("stored")),
        "kite_token_valid": bool(token.get("valid")),
    }

    blockers = [name for name, ok in checks.items() if not ok]
    return {
        "status": "ready" if not blockers else "blocked",
        "mode": trading_mode,
        "checks": checks,
        "blockers": blockers,
        "kill_switch": {"active": _KILL_SWITCH, "reason": _KILL_SWITCH_REASON},
        "message": "Live order execution is blocked until every check is true.",
    }


@router.post("/kill-switch")
async def activate_kill_switch(reason: str = "manual"):
    """Block live trading until explicitly reset."""
    global _KILL_SWITCH, _KILL_SWITCH_REASON
    _KILL_SWITCH = True
    _KILL_SWITCH_REASON = reason
    return {"status": "blocked", "kill_switch": True, "reason": reason}


@router.post("/kill-switch/reset")
async def reset_kill_switch():
    """Clear the manual live-trading kill switch."""
    global _KILL_SWITCH, _KILL_SWITCH_REASON
    _KILL_SWITCH = False
    _KILL_SWITCH_REASON = None
    return {"status": "clear", "kill_switch": False}
