#!/usr/bin/env python3
"""
DDLJ Trading System — Engine Manager Service
================================================

The SINGLE source of truth for the trading engine's lifecycle.
All API routes interact with the engine through this manager.

Responsibilities:
  - Initialize the PaperTrader engine with config
  - Start/stop the trading engine (as background thread)
  - Provide engine status to API endpoints
  - Handle graceful shutdown (save state, close positions)
  - Manage Kite token refresh
  - Enforce market hours guard
  - Track engine health (last heartbeat, error count)

WHY A MANAGER CLASS?
  The PaperTrader was designed as a standalone script with its own
  main loop. We can't just call trader.start() from FastAPI because
  that would block the entire web server. Instead, we run the engine
  in a background thread and control it through this manager.

Author: DDLJ Strategy Team
Version: 10.0.0
"""

import os
import threading
import logging
from datetime import datetime
from typing import Optional

import pytz

# Indian Standard Timezone — ALL timestamps in the system use this
IST = pytz.timezone("Asia/Kolkata")

log = logging.getLogger("ddlj_backend")


class EngineManager:
    """
    Manages the lifecycle of the DDLJ trading engine.

    This class is the SINGLE source of truth for:
      - Whether the engine is running
      - The current engine status
      - Starting and stopping the engine
      - Graceful shutdown with state persistence

    USAGE:
        manager = EngineManager()
        manager.initialize()
        manager.start_engine(config_override={...})
        status = manager.get_status()
        manager.stop_engine()
    """

    def __init__(self):
        # ── Engine state ──
        self._trader = None          # PaperTrader instance
        self._engine_thread = None   # Background thread running the engine
        self._running = False        # Is the engine loop active?
        self._initialized = False    # Has initialize() been called?

        # ── Health tracking ──
        self._last_heartbeat = None  # Last time the engine reported alive
        self._error_count = 0        # Number of errors since startup
        self._start_time = None      # When the engine was started
        self._stop_time = None       # When the engine was stopped

        # ── Config ──
        self._config_override = {}   # User-provided config overrides

    def initialize(self):
        """
        Initialize the engine manager.

        This is called ONCE during FastAPI startup. It:
        1. Validates environment variables
        2. Checks for existing session state
        3. Prepares the engine for start

        Does NOT start the engine — that requires an explicit API call
        or manual trigger.
        """
        log.info("EngineManager: Initializing...")

        # Validate required environment variables
        required_vars = ["KITE_API_KEY", "KITE_API_SECRET"]
        missing = [v for v in required_vars if not os.getenv(v)]
        if missing:
            log.warning("EngineManager: Missing environment variables: %s", missing)
            log.warning("  The engine will NOT start until these are set.")

        # Check if Kite token file exists
        # Use core.config for path resolution (handles Railway /app vs local dev)
        try:
            from core.config import KITE_TOKEN_FILE as _default_token_file
        except ImportError:
            _default_token_file = os.path.join(
                os.path.dirname(__file__), "..", "kite_access_token.txt"
            )
        token_file = os.getenv("KITE_TOKEN_FILE", _default_token_file)
        if os.path.exists(token_file):
            try:
                with open(token_file) as f:
                    token = f.read().strip()
                if token:
                    log.info("EngineManager: Found existing Kite access token")
                else:
                    log.warning("EngineManager: Token file exists but is empty")
            except OSError as e:
                log.warning("EngineManager: Could not read token file: %s", e)
        else:
            log.warning("EngineManager: No Kite access token file found at %s", token_file)
            log.warning("  You'll need to provide a request token via the API")

        self._initialized = True
        log.info("EngineManager: Initialization complete")

    def start_engine(self, config_override: Optional[dict] = None):
        """
        Start the trading engine in a background thread.

        This method creates a PaperTrader instance and runs its start()
        method in a daemon thread. The engine will:
        1. Connect to Kite API
        2. Warm up indicators with historical data
        3. Load previous session state
        4. Enter the main trading loop

        Args:
            config_override (dict, optional): Override any config parameter.
                Example: {"STARTING_CAPITAL": 100000, "DAILY_RISK_PCT": 4.0}

        Returns:
            dict: Status of the start operation.

        Raises:
            RuntimeError: If the engine is already running.
        """
        if self._running and self._trader is not None:
            raise RuntimeError("Engine is already running. Stop it first.")

        self._config_override = config_override or {}

        log.info("EngineManager: Starting trading engine...")

        try:
            # Import here to avoid circular imports and to fail fast
            # if dependencies are missing
            from engine.paper_trader import PaperTrader

            # Create the PaperTrader with config overrides
            self._trader = PaperTrader(config_override=self._config_override)
            self._running = True
            self._start_time = datetime.now(IST)
            self._stop_time = None
            self._error_count = 0

            # Start the engine in a background daemon thread
            # daemon=True means the thread will be killed when the main
            # process exits — our graceful shutdown handler ensures state
            # is saved before that happens.
            self._engine_thread = threading.Thread(
                target=self._run_engine,
                name="DDLJ-Trading-Engine",
                daemon=True,
            )
            self._engine_thread.start()

            log.info("EngineManager: Trading engine started in background thread")
            return {"status": "started", "message": "Trading engine is running"}

        except Exception as e:
            self._running = False
            self._error_count += 1
            log.error("EngineManager: Failed to start engine: %s", e, exc_info=True)
            raise RuntimeError(f"Failed to start engine: {e}") from e

    def _run_engine(self):
        """
        Run the trading engine (called in background thread).

        This method wraps PaperTrader.start() with error handling
        so that crashes in the engine don't bring down the API server.
        """
        try:
            log.info("Engine thread: Starting PaperTrader.start()...")
            self._trader.start()
        except Exception as e:
            self._error_count += 1
            log.error("Engine thread: CRASHED — %s", e, exc_info=True)
            self._running = False
            self._stop_time = datetime.now(IST)

    def stop_engine(self):
        """
        Stop the trading engine gracefully.

        This tells the engine to stop taking new trades and then
        waits for it to finish processing the current candle.
        State is saved automatically by the engine's shutdown handler.
        """
        if not self._running or self._trader is None:
            return {"status": "already_stopped", "message": "Engine is not running"}

        log.info("EngineManager: Stopping trading engine...")
        self._trader.stop()
        self._running = False
        self._stop_time = datetime.now(IST)

        # Wait for the engine thread to finish (max 10 seconds)
        if self._engine_thread and self._engine_thread.is_alive():
            self._engine_thread.join(timeout=10)
            if self._engine_thread.is_alive():
                log.warning("EngineManager: Engine thread did not stop in 10s")

        log.info("EngineManager: Trading engine stopped")
        return {"status": "stopped", "message": "Trading engine stopped gracefully"}

    def get_status(self) -> dict:
        """
        Get the current status of the trading engine.

        Returns a comprehensive status dict that includes:
        - Whether the engine is running
        - Current capital, P&L, positions
        - Current bias direction
        - Live VIX value
        - Engine health (uptime, errors, last heartbeat)
        - Token status

        Returns:
            dict: Complete engine status.
        """
        # Base status (always available)
        status = {
            "engine_running": self._running,
            "initialized": self._initialized,
            "error_count": self._error_count,
            "start_time": self._start_time.isoformat() if self._start_time else None,
            "stop_time": self._stop_time.isoformat() if self._stop_time else None,
        }

        # If engine is running, get detailed status from PaperTrader
        if self._trader is not None:
            try:
                trader_status = self._trader.get_status()
                status.update(trader_status)
                self._last_heartbeat = datetime.now(IST)
            except Exception as e:
                log.warning("EngineManager: Could not get trader status: %s", e)
                status["trader_error"] = str(e)

        # Token status
        try:
            from engine.token_manager import token_status
            token_info = token_status()
            status["token"] = {
                "stored": token_info["stored"],
                "valid": token_info["valid"],
                "user": token_info.get("user", {}).get("user_name", "unknown") if token_info.get("valid") else None,
            }
        except Exception as e:
            status["token"] = {"stored": False, "valid": False, "error": str(e)}

        # Uptime calculation
        if self._start_time:
            uptime = (datetime.now(IST) - self._start_time).total_seconds()
            status["uptime_seconds"] = round(uptime, 1)

        status["last_heartbeat"] = (
            self._last_heartbeat.isoformat() if self._last_heartbeat else None
        )

        return status

    def get_config(self) -> dict:
        """
        Get the current engine configuration.

        Returns:
            dict: All config parameters currently in use.
        """
        if self._trader is not None:
            try:
                return dict(self._trader._config)
            except Exception:
                pass

        # If engine isn't running, return default config
        try:
            from engine import config as cfg
            config_dict = {}
            for attr in dir(cfg):
                if attr.isupper():
                    config_dict[attr] = getattr(cfg, attr)
            config_dict.update(self._config_override)
            return config_dict
        except Exception as e:
            return {"error": str(e)}

    def update_config(self, updates: dict) -> dict:
        """
        Update engine configuration.

        NOTE: Most config changes require an engine restart to take effect.
        This method updates the stored overrides so they apply on next start.

        Args:
            updates (dict): Config parameters to update.

        Returns:
            dict: Updated config with a note about which changes need restart.
        """
        self._config_override.update(updates)

        # Some config can be updated live (no restart needed)
        live_updated = []
        restart_needed = []

        if self._trader is not None:
            # These can be changed while engine is running
            live_params = {
                "DAILY_RISK_PCT", "MAX_OPEN_POSITIONS", "MAX_DAILY_TRADES",
                "NOTIFY_ON_TRADE", "NOTIFY_ON_BIAS_CHANGE",
            }
            for key, value in updates.items():
                if key in live_params and hasattr(self._trader, key.lower()):
                    setattr(self._trader, key.lower(), value)
                    live_updated.append(key)
                elif key not in live_params:
                    restart_needed.append(key)

        return {
            "updated": list(updates.keys()),
            "live_updated": live_updated,
            "restart_needed": restart_needed,
            "message": "Config updated. Restart engine for changes to take full effect.",
        }

    def exchange_token(self, request_token: str) -> dict:
        """
        Exchange a Kite request token for an access token.

        This is called when the user provides a new daily request token
        (either via the API or the dashboard).

        Args:
            request_token (str): The request_token from Kite login redirect.

        Returns:
            dict: Token exchange result.
        """
        try:
            from engine.token_manager import exchange_request_token
            kite = exchange_request_token(request_token)
            profile = kite.profile()

            # If engine is running, reconnect with new token
            if self._running and self._trader is not None:
                log.info("EngineManager: Reconnecting engine with new token...")
                self.stop_engine()
                # Small delay to allow clean shutdown
                import time
                time.sleep(2)
                self.start_engine(self._config_override)

            return {
                "status": "success",
                "user": profile.get("user_name", "unknown"),
                "message": "Token exchanged successfully. Engine reconnected."
            }
        except Exception as e:
            log.error("EngineManager: Token exchange failed: %s", e)
            return {
                "status": "error",
                "message": f"Token exchange failed: {e}"
            }

    def graceful_shutdown(self):
        """
        Perform a graceful shutdown of the entire system.

        Called on SIGTERM/SIGINT or FastAPI shutdown. This:
        1. Stops the trading engine
        2. Saves engine state
        3. Logs the shutdown
        """
        log.info("EngineManager: Graceful shutdown initiated")

        if self._trader is not None:
            try:
                # Stop the engine (this triggers PaperTrader's graceful shutdown)
                self._trader.stop()
                self._running = False

                # Force close any open positions
                if hasattr(self._trader, '_force_close_all') and self._trader.open_positions:
                    log.info("EngineManager: Force-closing %d open positions",
                             len(self._trader.open_positions))
                    self._trader._force_close_all("SHUTDOWN")

                # Save state
                if hasattr(self._trader, '_save_state'):
                    self._trader._save_state()
                    log.info("EngineManager: Engine state saved")

            except Exception as e:
                log.error("EngineManager: Error during shutdown: %s", e)

        self._stop_time = datetime.now(IST)
        log.info("EngineManager: Shutdown complete")
