"""
DDLJ Trading System — Services Tests
========================================

Tests for market hours guard, session recovery, health monitor, etc.
"""

import pytest
from datetime import datetime, time, timedelta
from unittest.mock import MagicMock, patch

import pytz

IST = pytz.timezone("Asia/Kolkata")


class TestMarketHoursGuard:
    """Tests for MarketHoursGuard service."""

    def test_market_hours_default(self):
        """Test default market hours are 9:15-15:30 IST."""
        from services.market_hours import MarketHoursGuard
        guard = MarketHoursGuard()
        assert guard.market_open == time(9, 15)
        assert guard.market_close == time(15, 30)

    def test_is_trading_day_weekday(self):
        """Test that weekdays are trading days (excluding holidays)."""
        from services.market_hours import MarketHoursGuard
        guard = MarketHoursGuard()

        # Monday (2026-04-27 is a Monday)
        monday = IST.localize(datetime(2026, 4, 27, 10, 0))
        assert guard._is_trading_day(monday) is True

    def test_is_trading_day_weekend(self):
        """Test that weekends are NOT trading days."""
        from services.market_hours import MarketHoursGuard
        guard = MarketHoursGuard()

        # Saturday
        saturday = IST.localize(datetime(2026, 4, 25, 10, 0))
        assert guard._is_trading_day(saturday) is False

    def test_is_trading_day_holiday(self):
        """Test that configured holidays are NOT trading days."""
        from services.market_hours import MarketHoursGuard
        guard = MarketHoursGuard(holidays=["2026-01-26"])  # Republic Day

        republic_day = IST.localize(datetime(2026, 1, 26, 10, 0))
        assert guard._is_trading_day(republic_day) is False

    def test_should_engine_run_warmup_period(self):
        """Test that engine should run during warmup period (9:10 AM)."""
        from services.market_hours import MarketHoursGuard
        guard = MarketHoursGuard(warmup_minutes=5)

        # 9:10 AM on a weekday — should be in warmup
        warmup_time = IST.localize(datetime(2026, 4, 27, 9, 10))
        assert guard._should_engine_run_at(warmup_time) is True

    def test_should_not_run_outside_hours(self):
        """Test that engine should NOT run at 8:00 AM."""
        from services.market_hours import MarketHoursGuard
        guard = MarketHoursGuard()

        early_time = IST.localize(datetime(2026, 4, 27, 8, 0))
        assert guard._should_engine_run_at(early_time) is False

    def test_get_status(self):
        """Test get_status returns expected keys."""
        from services.market_hours import MarketHoursGuard
        guard = MarketHoursGuard()

        status = guard.get_status()
        assert "guard_running" in status
        assert "market_is_open" in status
        assert "market_hours" in status


class TestHealthMonitor:
    """Tests for HealthMonitor service."""

    def test_initial_state(self):
        """Test health monitor initial state."""
        from services.health_monitor import HealthMonitor
        monitor = HealthMonitor()
        assert monitor.start_time is not None

    def test_register_check(self):
        """Test registering a custom health check."""
        from services.health_monitor import HealthMonitor, HealthCheckResult, HealthStatus
        monitor = HealthMonitor()

        def my_check():
            return HealthCheckResult(
                name="test_check",
                status=HealthStatus.HEALTHY,
                message="Test is healthy",
            )

        monitor.register_check("test_check", my_check)
        assert "test_check" in monitor._custom_checks

    def test_register_duplicate_check(self):
        """Test that registering a duplicate check raises ValueError."""
        from services.health_monitor import HealthMonitor, HealthCheckResult, HealthStatus
        monitor = HealthMonitor()

        def my_check():
            return HealthCheckResult(name="test", status=HealthStatus.HEALTHY, message="ok")

        monitor.register_check("test", my_check)
        with pytest.raises(ValueError):
            monitor.register_check("test", my_check)

    def test_record_error(self):
        """Test recording errors for error rate tracking."""
        from services.health_monitor import HealthMonitor
        monitor = HealthMonitor()

        for _ in range(5):
            monitor.record_error()

        assert len(monitor._error_timestamps) == 5

    def test_record_trade(self):
        """Test recording a trade event."""
        from services.health_monitor import HealthMonitor
        monitor = HealthMonitor()

        assert monitor._last_trade_time is None
        monitor.record_trade()
        assert monitor._last_trade_time is not None

    def test_worst_status(self):
        """Test HealthStatus.worst() aggregation."""
        from services.health_monitor import HealthStatus

        assert HealthStatus.worst("healthy", "degraded") == "degraded"
        assert HealthStatus.worst("degraded", "unhealthy") == "unhealthy"
        assert HealthStatus.worst("healthy", "healthy") == "healthy"
        assert HealthStatus.worst() == "healthy"

    def test_health_check_result_to_dict(self):
        """Test HealthCheckResult serialization."""
        from services.health_monitor import HealthCheckResult, HealthStatus
        result = HealthCheckResult(
            name="test",
            status=HealthStatus.HEALTHY,
            message="All good",
            details={"key": "value"},
            duration_ms=1.5,
        )
        d = result.to_dict()
        assert d["name"] == "test"
        assert d["status"] == "healthy"
        assert d["message"] == "All good"
        assert d["details"]["key"] == "value"


class TestSessionRecovery:
    """Tests for SessionRecovery service."""

    def test_initial_state(self):
        """Test session recovery initial state."""
        from services.session_recovery import SessionRecovery
        recovery = SessionRecovery(auto_save=False)
        assert recovery.auto_save_enabled is False

    def test_no_recoverable_session(self):
        """Test that no session file means no recovery."""
        from services.session_recovery import SessionRecovery
        import tempfile
        import os

        with tempfile.TemporaryDirectory() as tmpdir:
            state_file = os.path.join(tmpdir, "test_session.json")
            recovery = SessionRecovery(state_file=state_file, auto_save=False)
            assert recovery.has_recoverable_session() is False

    def test_save_and_recover_session(self):
        """Test saving and recovering a session."""
        from services.session_recovery import SessionRecovery
        import tempfile
        import os

        with tempfile.TemporaryDirectory() as tmpdir:
            state_file = os.path.join(tmpdir, "test_session.json")
            recovery = SessionRecovery(state_file=state_file, auto_save=False)

            # Save a session
            state = {
                "capital": 55000,
                "daily_pnl": 5000,
                "positions": [
                    {"symbol": "BANKNIFTY", "direction": "LONG", "entry": 53000}
                ],
            }
            result = recovery.save_session(state)
            assert result is True

            # Recover it
            assert recovery.has_recoverable_session() is True
            recovered = recovery.recover_session()
            assert recovered is not None
            assert recovered["capital"] == 55000
            assert recovered["daily_pnl"] == 5000
            assert len(recovered["positions"]) == 1

    def test_clear_session(self):
        """Test clearing a session."""
        from services.session_recovery import SessionRecovery
        import tempfile
        import os

        with tempfile.TemporaryDirectory() as tmpdir:
            state_file = os.path.join(tmpdir, "test_session.json")
            recovery = SessionRecovery(state_file=state_file, auto_save=False)

            recovery.save_session({"capital": 50000, "positions": []})
            result = recovery.clear_session()
            assert result is True


class TestExceptions:
    """Tests for custom exception hierarchy."""

    def test_ddlj_error_base(self):
        """Test base DDLJError."""
        from core.exceptions import DDLJError
        err = DDLJError("test error", code="TEST_ERROR")
        assert str(err) == "test error"
        assert err.code == "TEST_ERROR"

    def test_engine_already_running_error(self):
        """Test EngineAlreadyRunningError."""
        from core.exceptions import EngineAlreadyRunningError
        err = EngineAlreadyRunningError()
        assert err.code == "ENGINE_ALREADY_RUNNING"

    def test_token_expired_error(self):
        """Test TokenExpiredError."""
        from core.exceptions import TokenExpiredError
        err = TokenExpiredError()
        assert err.code == "TOKEN_EXPIRED"

    def test_error_to_response(self):
        """Test error_to_response conversion."""
        from core.exceptions import DDLJError, error_to_response
        err = DDLJError("test", code="TEST", details={"key": "val"})
        resp = error_to_response(err)
        assert resp["error"] == "TEST"
        assert resp["message"] == "test"
        assert resp["details"]["key"] == "val"
