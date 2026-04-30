"""
DDLJ Trading System — Engine Manager Tests
=============================================

Tests the EngineManager service class.
"""

import pytest
from unittest.mock import MagicMock, patch

from services.engine_manager import EngineManager
from core.exceptions import EngineAlreadyRunningError


class TestEngineManager:
    """Tests for EngineManager lifecycle."""

    def test_initial_state(self):
        """Test that a new EngineManager is in the correct initial state."""
        mgr = EngineManager()
        assert mgr._running is False
        assert mgr._trader is None
        assert mgr._initialized is False
        assert mgr._error_count == 0

    def test_initialize(self):
        """Test that initialize() sets _initialized to True."""
        mgr = EngineManager()
        with patch.dict("os.environ", {
            "KITE_API_KEY": "test_key",
            "KITE_API_SECRET": "test_secret",
        }):
            mgr.initialize()
        assert mgr._initialized is True

    def test_get_status_not_initialized(self):
        """Test get_status when not initialized."""
        mgr = EngineManager()
        status = mgr.get_status()
        assert status["engine_running"] is False
        assert status["initialized"] is False
        assert status["error_count"] == 0

    def test_get_status_initialized(self):
        """Test get_status after initialization."""
        mgr = EngineManager()
        with patch.dict("os.environ", {
            "KITE_API_KEY": "test_key",
            "KITE_API_SECRET": "test_secret",
        }):
            mgr.initialize()
        status = mgr.get_status()
        assert status["initialized"] is True

    def test_stop_when_not_running(self):
        """Test stopping engine when it's not running."""
        mgr = EngineManager()
        result = mgr.stop_engine()
        assert result["status"] == "already_stopped"

    def test_get_config_default(self):
        """Test get_config returns default config when engine not running."""
        mgr = EngineManager()
        with patch.dict("os.environ", {
            "KITE_API_KEY": "test_key",
            "KITE_API_SECRET": "test_secret",
        }):
            mgr.initialize()
        config = mgr.get_config()
        assert isinstance(config, dict)
        # Should have strategy config params
        assert len(config) > 0

    def test_update_config(self):
        """Test update_config stores overrides."""
        mgr = EngineManager()
        result = mgr.update_config({"DAILY_RISK_PCT": 3.0})
        assert "DAILY_RISK_PCT" in result["updated"]
        assert mgr._config_override["DAILY_RISK_PCT"] == 3.0

    def test_exchange_token_success(self):
        """Test token exchange with mocked kite."""
        mgr = EngineManager()
        mock_kite = MagicMock()
        mock_kite.profile.return_value = {"user_name": "test_user"}

        with patch("engine.token_manager.exchange_request_token", return_value=mock_kite):
            result = mgr.exchange_token("test_request_token")
        assert result["status"] == "success"
        assert result["user"] == "test_user"

    def test_exchange_token_failure(self):
        """Test token exchange failure."""
        mgr = EngineManager()
        with patch("engine.token_manager.exchange_request_token", side_effect=RuntimeError("Bad token")):
            result = mgr.exchange_token("bad_token")
        assert result["status"] == "error"

    def test_graceful_shutdown(self):
        """Test graceful shutdown doesn't crash."""
        mgr = EngineManager()
        # Should not raise any exceptions
        mgr.graceful_shutdown()


class TestEngineManagerStartEngine:
    """Tests for engine start behavior."""

    def test_start_engine_raises_already_running(self):
        """Test that starting an already-running engine raises EngineAlreadyRunningError."""
        mgr = EngineManager()
        mgr._running = True
        mgr._trader = MagicMock()  # Simulate running state

        with pytest.raises(EngineAlreadyRunningError):
            mgr.start_engine()

    def test_start_engine_failure(self):
        """Test that a failed engine start is handled."""
        mgr = EngineManager()
        with patch("engine.paper_trader.PaperTrader", side_effect=ImportError("No module")):
            with pytest.raises(RuntimeError, match="Failed to start engine"):
                mgr.start_engine()
