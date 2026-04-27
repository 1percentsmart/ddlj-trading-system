# Task: DDLJ Backend Service Modules

## Agent: Main Developer
## Task ID: backend-services

## Summary
Created 6 service files for the DDLJ Trading System backend, implementing market hours guard, session recovery, Telegram notifications, token refresh, and health monitoring.

## Files Created

1. **`backend/services/market_hours.py`** - Market Hours Guard
   - `MarketHoursGuard` class with start/stop/is_market_hours/get_next_market_open/get_time_to_close
   - Background thread checking every 30 seconds
   - on_market_open/on_market_close callbacks
   - Pre-market warmup at 9:10 AM IST
   - Post-market cooldown until 3:35 PM IST
   - Weekend and holiday detection (2025 Indian market holidays included)

2. **`backend/services/session_recovery.py`** - Session Recovery
   - `SessionRecovery` class with save_session/recover_session/has_recoverable_session/clear_session
   - Dual persistence (JSON file + database)
   - Auto-save every 60 seconds during trading
   - Save on trade entry/exit
   - Crash detection via clean_shutdown flag
   - 24-hour staleness check
   - Position validation (symbol, direction)

3. **`backend/services/telegram_notifier.py`** - Telegram Notifications
   - `TelegramNotifier` class with send_message/send_trade_alert/send_system_alert/send_daily_summary/send_test
   - Async sending via httpx
   - Rate limiting (20 msgs/min)
   - HTML formatting with emoji
   - Sync wrappers for use in the engine thread
   - Graceful fallback on failure

4. **`backend/services/token_refresh.py`** - Kite Token Auto-Refresh
   - `TokenRefreshService` class with start/stop/get_token_status/get_login_url/exchange_request_token
   - Background thread checking every 30 minutes
   - Pre-market check at 9:00 AM IST
   - Early check at 8:30 AM IST
   - Token health tracking
   - Token history logging

5. **`backend/services/health_monitor.py`** - Health Monitor
   - `HealthMonitor` class with get_health/check_all/register_check
   - `HealthStatus` class (healthy/degraded/unhealthy)
   - `HealthCheckResult` class for individual check results
   - Built-in checks: engine heartbeat, API, DB, disk, memory, error rate, last trade
   - Extensible via register_check()
   - Uptime and error rate tracking

6. **`backend/services/__init__.py`** - Package init with all exports

## File Modified
- **`backend/requirements.txt`** - Added httpx>=0.27.0 dependency

## Verification
- All files pass Python syntax check
- All services import and instantiate correctly
- Functional tests pass for all major features
- No circular import issues
- All services use `from __future__ import annotations`
- All services use `logging.getLogger("ddlj_backend.service_name")`
- All services handle exceptions gracefully
