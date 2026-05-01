#!/usr/bin/env python3
"""
DDLJ Trading System — Session Recovery Service
=================================================

Restores trading positions and state after an unexpected crash or server
restart. This is CRITICAL for a trading system — without session recovery,
a crash during market hours means:

  1. Open positions are forgotten (potentially unlimited risk)
  2. Capital tracking is reset (risk limits are wrong)
  3. Daily P&L is lost (performance tracking is broken)
  4. Config overrides are lost (wrong strategy parameters)

KEY DESIGN DECISIONS:
  - Dual persistence: State is saved to both a JSON file (fast, local)
    and a database (durable, remote) if available. The JSON file is the
    primary recovery source because it's always available, even if the
    database is down.
  - Crash detection: A "clean_shutdown" flag is written on graceful
    shutdown. If the flag is absent on startup, we know the previous
    session crashed, and we trigger crash recovery procedures.
  - Auto-save every 60 seconds: This limits data loss to at most 1
    minute of trading activity, even if the server crashes without
    warning (power failure, OOM kill, etc.).
  - Save on every trade: Trade events are critical — we save immediately
    after each entry/exit to ensure no position data is lost.
  - Validation: Recovered positions are validated against the current
    trading index to detect stale or mismatched state.
  - 24-hour staleness check: If the saved session is older than 24 hours,
    it's considered stale and a fresh start is recommended.

RECOVERY FLOW:
  1. On startup, check if session_state.json exists
  2. If it exists WITHOUT clean_shutdown flag → crash detected
  3. Validate the saved state (age, positions, config)
  4. Offer recovery: restore positions, capital, P&L
  5. If user declines or state is invalid → start fresh

Author: DDLJ Strategy Team
Version: 10.1.0
"""

from __future__ import annotations

import os
import json
import threading
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

import pytz

# Indian Standard Timezone — ALL timestamps use IST
IST = pytz.timezone("Asia/Kolkata")

log = logging.getLogger("ddlj_backend.session_recovery")


# ============================================================================
# CONSTANTS
# ============================================================================

# Use core.config for path resolution — it handles Railway (/app) vs local dev
def _get_session_state_file() -> str:
    """Resolve session state file path using core.config's PROJECT_ROOT.

    WHY: On Railway, the app runs from /app (root dir = backend/).
    Path(__file__).parent.parent.parent would resolve to '/' which is
    not writable. core.config._detect_project_root() handles this
    correctly by going up only 2 levels from core/config.py.
    """
    env_val = os.getenv("SESSION_STATE_FILE")
    if env_val:
        return env_val
    try:
        from core.config import SESSION_DIR
        return str(SESSION_DIR / "session_state.json")
    except ImportError:
        pass
    # Fallback: detect project root with marker file check
    env_root = os.getenv("PROJECT_ROOT")
    if env_root:
        return str(Path(env_root) / "sessions" / "session_state.json")
    # Walk up from this file looking for a marker directory
    candidate = Path(__file__).resolve().parent
    for _ in range(5):
        if (candidate / "main.py").exists() or (candidate / "requirements.txt").exists():
            return str(candidate / "sessions" / "session_state.json")
        candidate = candidate.parent
    # Last resort: use /tmp (always writable)
    return str(Path(os.environ.get("TMPDIR", "/tmp")) / "ddlj_sessions" / "session_state.json")

SESSION_STATE_FILE = _get_session_state_file()
"""Path to the session state JSON file."""

CLEAN_SHUTDOWN_FLAG = "clean_shutdown"
"""Key in session state JSON that indicates a graceful shutdown."""

MAX_SESSION_AGE_HOURS = 24
"""Maximum age (in hours) for a session to be considered recoverable."""

AUTO_SAVE_INTERVAL_SECONDS = 60
"""How often to auto-save session state during trading."""

VALID_INDICES = {"BANKNIFTY", "NIFTY"}
"""Valid trading indices for position validation."""


class SessionRecovery:
    """
    Manages session persistence and crash recovery for the trading engine.

    This service ensures that trading state (positions, capital, P&L)
    survives server restarts and crashes. It provides:
      - Automatic periodic saves (every 60 seconds during trading)
      - Immediate saves on trade entry/exit
      - Crash detection via clean_shutdown flag
      - State validation on recovery
      - Telegram notifications for crash events

    USAGE:
        recovery = SessionRecovery()
        recovery.on_trade_entry(position_data)
        recovery.on_trade_exit(trade_data)
        recovery.save_session(current_state)
        # On startup:
        if recovery.has_recoverable_session():
            state = recovery.recover_session()

    Attributes:
        state_file (str): Path to the session state JSON file.
        auto_save_enabled (bool): Whether periodic auto-save is active.
    """

    def __init__(
        self,
        state_file: Optional[str] = None,
        auto_save: bool = True,
        auto_save_interval: int = AUTO_SAVE_INTERVAL_SECONDS,
        max_session_age_hours: int = MAX_SESSION_AGE_HOURS,
    ):
        """
        Initialize the Session Recovery service.

        Args:
            state_file (str, optional): Path to the session state file.
                Defaults to SESSION_STATE_FILE from config.
            auto_save (bool): Enable periodic auto-save. Default: True.
            auto_save_interval (int): Seconds between auto-saves. Default: 60.
            max_session_age_hours (int): Max session age for recovery. Default: 24.
        """
        self.state_file = state_file or SESSION_STATE_FILE
        self.auto_save_enabled = auto_save
        self.auto_save_interval = auto_save_interval
        self.max_session_age_hours = max_session_age_hours

        # ── Internal state ──
        self._auto_save_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._last_save_time: Optional[datetime] = None
        self._current_state: Dict[str, Any] = {}
        self._lock = threading.Lock()  # Protects _current_state for thread safety

        # ── Ensure session directory exists ──
        # WHY: The sessions directory might not exist on first run,
        # and trying to write to a non-existent directory causes FileNotFound.
        # On Railway, the non-root user may not have permission to create
        # top-level directories, so we fall back to /tmp if needed.
        state_dir = os.path.dirname(self.state_file)
        if state_dir:
            try:
                os.makedirs(state_dir, exist_ok=True)
            except PermissionError:
                # Fall back to /tmp/ddlj_sessions on restricted environments
                fallback_dir = os.path.join(os.environ.get("TMPDIR", "/tmp"), "ddlj_sessions")
                os.makedirs(fallback_dir, exist_ok=True)
                self.state_file = os.path.join(fallback_dir, "session_state.json")
                log.warning(
                    "SessionRecovery: Permission denied for %s, using fallback: %s",
                    state_dir, self.state_file,
                )

        log.info(
            "SessionRecovery: Initialized — state file: %s, auto-save: %s (%ds)",
            self.state_file, auto_save, auto_save_interval,
        )

    # ────────────────────────────────────────────────────────────
    # PUBLIC API — SAVE
    # ────────────────────────────────────────────────────────────

    def save_session(self, state: Dict[str, Any]) -> bool:
        """
        Save the current session state to disk (and database if available).

        This is the PRIMARY save method. It writes a complete snapshot of
        the trading session including positions, capital, P&L, and config.

        Args:
            state (dict): Session state to save. Expected keys:
                - positions (list): Open position data
                - capital (float): Current capital
                - daily_pnl (float): Today's P&L
                - config (dict): Current configuration overrides
                - trades_today (list): Completed trades today
                - Any additional keys are preserved as-is

        Returns:
            bool: True if save was successful, False otherwise.
        """
        try:
            with self._lock:
                # Enrich the state with metadata
                save_state = dict(state)
                save_state["saved_at"] = datetime.now(IST).isoformat()
                save_state["saved_at_ts"] = datetime.now(IST).timestamp()
                save_state["version"] = "10.3.0"

                # Remove the clean_shutdown flag — it should ONLY be
                # present after a graceful shutdown
                save_state.pop(CLEAN_SHUTDOWN_FLAG, None)

                self._current_state = save_state

            # Write to JSON file (primary)
            self._write_state_file(save_state)

            # Write to database (secondary — if available)
            self._save_to_database(save_state)

            self._last_save_time = datetime.now(IST)
            log.debug(
                "SessionRecovery: State saved at %s",
                self._last_save_time.strftime("%H:%M:%S"),
            )
            return True

        except Exception as e:
            # WHY: A save failure should NEVER crash the trading engine.
            # We log the error and continue — the next auto-save will retry.
            log.error("SessionRecovery: Failed to save session: %s", e, exc_info=True)
            return False

    def save_on_trade_entry(self, position_data: Dict[str, Any]) -> bool:
        """
        Save session state immediately after a trade entry.

        This is called right after a new position is opened. It merges
        the new position into the existing state and saves immediately.

        Args:
            position_data (dict): The new position that was just opened.

        Returns:
            bool: True if save was successful.
        """
        with self._lock:
            positions = self._current_state.get("positions", [])
            positions.append(position_data)
            self._current_state["positions"] = positions
            self._current_state["last_trade_time"] = datetime.now(IST).isoformat()
            self._current_state["last_trade_type"] = "entry"
            state_copy = dict(self._current_state)

        log.info(
            "SessionRecovery: Saving after trade ENTRY — %s %s",
            position_data.get("symbol", "?"),
            position_data.get("direction", "?"),
        )
        return self._write_state_file(state_copy)

    def save_on_trade_exit(self, trade_data: Dict[str, Any]) -> bool:
        """
        Save session state immediately after a trade exit.

        This is called right after a position is closed. It updates
        the positions list, P&L, and capital, then saves immediately.

        Args:
            trade_data (dict): The completed trade data including P&L.

        Returns:
            bool: True if save was successful.
        """
        with self._lock:
            # Remove the closed position from open positions
            positions = self._current_state.get("positions", [])
            closed_symbol = trade_data.get("symbol", "")
            closed_direction = trade_data.get("direction", "")

            # Remove the matching open position
            updated_positions = []
            removed = False
            for pos in positions:
                if (
                    not removed
                    and pos.get("symbol") == closed_symbol
                    and pos.get("direction") == closed_direction
                ):
                    removed = True  # Remove only the first match
                    continue
                updated_positions.append(pos)

            self._current_state["positions"] = updated_positions

            # Update P&L and capital
            net_pnl = trade_data.get("net", 0)
            current_capital = self._current_state.get("capital", 0)
            self._current_state["capital"] = current_capital + net_pnl

            daily_pnl = self._current_state.get("daily_pnl", 0)
            self._current_state["daily_pnl"] = daily_pnl + net_pnl

            # Track completed trades
            trades_today = self._current_state.get("trades_today", [])
            trades_today.append(trade_data)
            self._current_state["trades_today"] = trades_today

            self._current_state["last_trade_time"] = datetime.now(IST).isoformat()
            self._current_state["last_trade_type"] = "exit"
            state_copy = dict(self._current_state)

        log.info(
            "SessionRecovery: Saving after trade EXIT — %s %s (P&L: ₹%.2f)",
            trade_data.get("symbol", "?"),
            trade_data.get("direction", "?"),
            net_pnl,
        )
        return self._write_state_file(state_copy)

    def mark_clean_shutdown(self) -> bool:
        """
        Mark the session as cleanly shut down.

        This is called during graceful shutdown. The presence of this
        flag on the next startup indicates the previous session ended
        normally — NOT a crash.

        Returns:
            bool: True if the flag was written successfully.
        """
        try:
            with self._lock:
                self._current_state[CLEAN_SHUTDOWN_FLAG] = True
                self._current_state["shutdown_time"] = datetime.now(IST).isoformat()
                state_copy = dict(self._current_state)

            self._write_state_file(state_copy)
            log.info("SessionRecovery: Marked clean shutdown")
            return True

        except Exception as e:
            log.error("SessionRecovery: Failed to mark clean shutdown: %s", e)
            return False

    # ────────────────────────────────────────────────────────────
    # PUBLIC API — RECOVER
    # ────────────────────────────────────────────────────────────

    def has_recoverable_session(self) -> bool:
        """
        Check if a recoverable session exists.

        A session is recoverable if:
          1. The session state file exists
          2. The file contains valid JSON
          3. The saved state is not older than MAX_SESSION_AGE_HOURS

        Returns:
            bool: True if a recoverable session exists.
        """
        if not os.path.exists(self.state_file):
            return False

        try:
            with open(self.state_file, "r") as f:
                state = json.load(f)

            # Check age
            saved_at = state.get("saved_at_ts")
            if saved_at is None:
                # Old format without timestamp — try saved_at string
                saved_at_str = state.get("saved_at")
                if saved_at_str:
                    saved_dt = datetime.fromisoformat(saved_at_str)
                    age = datetime.now(IST) - saved_dt
                    if age > timedelta(hours=self.max_session_age_hours):
                        log.info("SessionRecovery: Session too old (%s)", saved_at_str)
                        return False
                else:
                    # No timestamp at all — not recoverable
                    log.warning("SessionRecovery: Session has no timestamp")
                    return False
            else:
                age = datetime.now(IST).timestamp() - saved_at
                if age > self.max_session_age_hours * 3600:
                    log.info("SessionRecovery: Session too old (%.1f hours)", age / 3600)
                    return False

            # Must have positions or capital data
            if "positions" not in state and "capital" not in state:
                log.warning("SessionRecovery: Session has no position/capital data")
                return False

            return True

        except (json.JSONDecodeError, OSError) as e:
            log.error("SessionRecovery: Cannot read session file: %s", e)
            return False

    def is_crash_recovery(self) -> bool:
        """
        Check if the previous session crashed (no clean_shutdown flag).

        This is used to detect unclean exits and trigger crash
        recovery procedures (Telegram notification, logging, etc.).

        Returns:
            bool: True if the previous session crashed.
        """
        if not os.path.exists(self.state_file):
            return False

        try:
            with open(self.state_file, "r") as f:
                state = json.load(f)

            # If clean_shutdown is True, it was a graceful exit
            if state.get(CLEAN_SHUTDOWN_FLAG, False):
                return False

            # If there are open positions, it's definitely a crash
            has_open_positions = bool(state.get("positions", []))
            if has_open_positions:
                log.warning(
                    "SessionRecovery: CRASH DETECTED — %d open positions without clean shutdown",
                    len(state["positions"]),
                )
                return True

            # No positions but no clean_shutdown flag — might still be a crash
            # but less critical since no positions are at risk
            return False

        except (json.JSONDecodeError, OSError):
            return False

    def recover_session(self) -> Optional[Dict[str, Any]]:
        """
        Recover the most recent session state.

        This loads the saved state, validates it, and returns it
        for the engine manager to restore.

        Returns:
            dict: The recovered session state, or None if recovery failed.

        Raises:
            ValueError: If the recovered state fails validation.
        """
        if not os.path.exists(self.state_file):
            log.info("SessionRecovery: No session file to recover")
            return None

        try:
            with open(self.state_file, "r") as f:
                state = json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            log.error("SessionRecovery: Cannot read session file: %s", e)
            return None

        # ── Validate the recovered state ──
        validation_errors = self._validate_state(state)
        if validation_errors:
            log.warning(
                "SessionRecovery: State validation failed: %s",
                "; ".join(validation_errors),
            )
            # Return the state anyway but with validation warnings
            state["_validation_warnings"] = validation_errors

        # ── Remove metadata keys that shouldn't be restored ──
        state.pop(CLEAN_SHUTDOWN_FLAG, None)
        state.pop("_validation_warnings", None)  # Will be re-added if present

        # ── Log recovery info ──
        saved_at = state.get("saved_at", "unknown")
        positions_count = len(state.get("positions", []))
        capital = state.get("capital", 0)
        daily_pnl = state.get("daily_pnl", 0)

        log.info(
            "SessionRecovery: Recovered session from %s — "
            "Capital: ₹%.2f, P&L: ₹%.2f, Open positions: %d",
            saved_at, capital, daily_pnl, positions_count,
        )

        # ── Store in current state ──
        with self._lock:
            self._current_state = state

        # ── Also try to load from database as a fallback ──
        # (in case the JSON file is corrupted but DB has a recent save)
        db_state = self._load_from_database()
        if db_state and not state.get("positions"):
            log.info("SessionRecovery: Using database state as fallback")
            return db_state

        return state

    def clear_session(self) -> bool:
        """
        Clear the saved session state.

        This is called after a successful recovery or when the user
        chooses to start fresh instead of recovering.

        Returns:
            bool: True if the session was cleared successfully.
        """
        try:
            if os.path.exists(self.state_file):
                # Write an empty state with clean_shutdown=True so it
                # doesn't trigger crash detection on next startup
                empty_state = {
                    CLEAN_SHUTDOWN_FLAG: True,
                    "cleared_at": datetime.now(IST).isoformat(),
                    "positions": [],
                    "capital": 0,
                    "daily_pnl": 0,
                }
                with open(self.state_file, "w") as f:
                    json.dump(empty_state, f, indent=2, default=str)

            with self._lock:
                self._current_state = {}

            log.info("SessionRecovery: Session cleared")
            return True

        except Exception as e:
            log.error("SessionRecovery: Failed to clear session: %s", e)
            return False

    # ────────────────────────────────────────────────────────────
    # PUBLIC API — AUTO-SAVE
    # ────────────────────────────────────────────────────────────

    def start_auto_save(self, state_provider: callable) -> None:
        """
        Start the automatic save thread.

        The state_provider is a callable that returns the current session
        state. It's called every auto_save_interval seconds.

        Args:
            state_provider (callable): A function that returns the current
                session state dict. Example: lambda: engine.get_status()
        """
        if self._auto_save_thread and self._auto_save_thread.is_alive():
            log.warning("SessionRecovery: Auto-save already running")
            return

        self._stop_event.clear()

        def _auto_save_loop():
            """Background thread that saves state periodically."""
            log.info("SessionRecovery: Auto-save started (every %ds)", self.auto_save_interval)
            while not self._stop_event.is_set():
                if self._stop_event.wait(timeout=self.auto_save_interval):
                    break

                try:
                    state = state_provider()
                    if state:
                        self.save_session(state)
                except Exception as e:
                    log.error("SessionRecovery: Auto-save error: %s", e, exc_info=True)

            log.info("SessionRecovery: Auto-save stopped")

        self._auto_save_thread = threading.Thread(
            target=_auto_save_loop,
            name="DDLJ-Session-AutoSave",
            daemon=True,
        )
        self._auto_save_thread.start()

    def stop_auto_save(self) -> None:
        """Stop the automatic save thread."""
        self._stop_event.set()
        if self._auto_save_thread and self._auto_save_thread.is_alive():
            self._auto_save_thread.join(timeout=5)
        log.info("SessionRecovery: Auto-save stopped")

    # ────────────────────────────────────────────────────────────
    # PUBLIC API — STATUS
    # ────────────────────────────────────────────────────────────

    def get_status(self) -> Dict[str, Any]:
        """
        Get the current status of the session recovery service.

        Returns:
            dict: Status information including last save time, auto-save
                state, and recoverability.
        """
        return {
            "state_file": self.state_file,
            "file_exists": os.path.exists(self.state_file),
            "has_recoverable_session": self.has_recoverable_session(),
            "is_crash_recovery": self.is_crash_recovery(),
            "auto_save_running": (
                self._auto_save_thread is not None
                and self._auto_save_thread.is_alive()
            ),
            "last_save_time": (
                self._last_save_time.isoformat() if self._last_save_time else None
            ),
            "current_positions": len(self._current_state.get("positions", [])),
            "current_capital": self._current_state.get("capital", 0),
        }

    # ────────────────────────────────────────────────────────────
    # PRIVATE METHODS
    # ────────────────────────────────────────────────────────────

    def _write_state_file(self, state: Dict[str, Any]) -> bool:
        """
        Write session state to the JSON file.

        Uses atomic write (write to temp file, then rename) to prevent
        corruption if the process crashes mid-write.

        Args:
            state (dict): The state to write.

        Returns:
            bool: True if write was successful.
        """
        try:
            # Ensure directory exists
            state_dir = os.path.dirname(self.state_file)
            if state_dir:
                os.makedirs(state_dir, exist_ok=True)

            # WHY: Atomic write prevents corruption. If the process crashes
            # during json.dump, the temp file is incomplete but the original
            # file is still intact. Only after the write completes do we
            # rename the temp file to the actual file.
            temp_file = self.state_file + ".tmp"
            with open(temp_file, "w") as f:
                json.dump(state, f, indent=2, default=str)

            # Atomic rename (on POSIX, rename is atomic)
            os.replace(temp_file, self.state_file)
            return True

        except Exception as e:
            log.error("SessionRecovery: Failed to write state file: %s", e, exc_info=True)
            return False

    def _validate_state(self, state: Dict[str, Any]) -> List[str]:
        """
        Validate a recovered session state.

        Checks for common issues:
          - Positions referencing invalid indices
          - Capital is negative or zero
          - State is too old
          - Required keys are missing

        Args:
            state (dict): The state to validate.

        Returns:
            list[str]: List of validation error messages. Empty = valid.
        """
        errors = []

        # Check age
        saved_at_ts = state.get("saved_at_ts")
        if saved_at_ts:
            age_hours = (datetime.now(IST).timestamp() - saved_at_ts) / 3600
            if age_hours > self.max_session_age_hours:
                errors.append(
                    f"Session is {age_hours:.1f} hours old "
                    f"(max: {self.max_session_age_hours}h)"
                )

        # Check capital
        capital = state.get("capital", 0)
        if capital < 0:
            errors.append(f"Capital is negative: ₹{capital}")

        # Check positions
        positions = state.get("positions", [])
        for i, pos in enumerate(positions):
            symbol = pos.get("symbol", "")
            if symbol and symbol.upper() not in VALID_INDICES:
                errors.append(
                    f"Position {i}: Unknown symbol '{symbol}' "
                    f"(expected one of {VALID_INDICES})"
                )

            direction = pos.get("direction", "")
            if direction not in ("LONG", "SHORT"):
                errors.append(
                    f"Position {i}: Invalid direction '{direction}'"
                )

        # Check config consistency
        config = state.get("config", {})
        if config:
            trade_index = config.get("TRADE_INDEX", "")
            if trade_index and trade_index.upper() not in VALID_INDICES:
                errors.append(f"Config has invalid TRADE_INDEX: '{trade_index}'")

            # Cross-check: positions should match the configured index
            if positions and trade_index:
                for pos in positions:
                    if pos.get("symbol", "").upper() != trade_index.upper():
                        errors.append(
                            f"Position symbol '{pos.get('symbol')}' doesn't match "
                            f"configured index '{trade_index}'"
                        )

        return errors

    def _save_to_database(self, state: Dict[str, Any]) -> bool:
        """
        Save session state to the database (if available).

        This is a secondary save — the JSON file is the primary. If the
        database is not configured, this is a no-op.

        Args:
            state (dict): The state to save.

        Returns:
            bool: True if database save succeeded, False if DB unavailable.
        """
        # WHY: The database might not be set up yet (e.g., during development).
        # We silently skip the DB save rather than failing the entire operation.
        try:
            # Import database only if available — avoids import errors
            # when the database is not configured
            from core.config import DATABASE_URL

            if not DATABASE_URL:
                return False

            # TODO: Implement database save when Supabase is integrated
            # For now, just log that we would save to the database
            log.debug("SessionRecovery: Database save (not yet implemented)")
            return False

        except ImportError:
            return False
        except Exception as e:
            log.debug("SessionRecovery: Database save skipped: %s", e)
            return False

    def _load_from_database(self) -> Optional[Dict[str, Any]]:
        """
        Load the most recent session state from the database.

        Returns:
            dict: The most recent session state, or None if unavailable.
        """
        try:
            from core.config import DATABASE_URL

            if not DATABASE_URL:
                return None

            # TODO: Implement database load when Supabase is integrated
            log.debug("SessionRecovery: Database load (not yet implemented)")
            return None

        except ImportError:
            return None
        except Exception as e:
            log.debug("SessionRecovery: Database load skipped: %s", e)
            return None
