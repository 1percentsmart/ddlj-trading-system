#!/usr/bin/env python3
"""
DDLJ Trading System — Services Package
=========================================

Business logic layer that sits between the API routes and the core engine.
Each service is self-contained and can be used independently.

AVAILABLE SERVICES:
  - EngineManager: Controls the trading engine lifecycle (start/stop/status)
  - MarketHoursGuard: Auto-start/stop engine based on market hours
  - SessionRecovery: Restore positions and state after crash/restart
  - TelegramNotifier: Send trade alerts and system notifications via Telegram
  - TokenRefreshService: Monitor and refresh Kite API tokens
  - HealthMonitor: Track system health and report issues

USAGE:
    from services import EngineManager, MarketHoursGuard
    from services import SessionRecovery, TelegramNotifier
    from services import TokenRefreshService, HealthMonitor

DESIGN PRINCIPLES:
  - Services do NOT import from each other (avoids circular deps)
  - Services CAN import from engine/ and core/ packages
  - Services are self-contained — if one fails, others continue
  - All services use IST timezone for time calculations
  - All services handle exceptions gracefully and never crash the app

Author: DDLJ Strategy Team
Version: 10.1.0
"""

from __future__ import annotations

# ── Engine Management ──
from services.engine_manager import EngineManager

# ── Market Hours ──
from services.market_hours import MarketHoursGuard

# ── Session Recovery ──
from services.session_recovery import SessionRecovery

# ── Telegram Notifications ──
from services.telegram_notifier import TelegramNotifier

# ── Token Refresh ──
from services.token_refresh import TokenRefreshService

# ── Health Monitoring ──
from services.health_monitor import HealthMonitor, HealthStatus, HealthCheckResult


# ── Package-level convenience exports ──
__all__ = [
    # Core services
    "EngineManager",
    "MarketHoursGuard",
    "SessionRecovery",
    "TelegramNotifier",
    "TokenRefreshService",
    "HealthMonitor",
    # Health check types
    "HealthStatus",
    "HealthCheckResult",
]
