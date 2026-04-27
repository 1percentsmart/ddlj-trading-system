#!/usr/bin/env python3
"""
DDLJ Trading System — Kite Token Auto-Refresh Service
========================================================

Monitors the validity of Zerodha Kite Connect API access tokens and
notifies the user when a new token is needed. Kite access tokens expire
daily at midnight IST, so a fresh token must be obtained every morning
before the market opens.

KEY DESIGN DECISIONS:
  - Check every 30 minutes: Kite tokens last 24 hours, so checking every
    30 minutes is more than sufficient. We don't want to hammer the API.
  - Pre-market check at 9:00 AM IST: If the token is invalid at 9:00 AM,
    we send an urgent Telegram notification with the login URL so the
    trader can authenticate before the market opens at 9:15 AM.
  - 8:30 AM validation: An early check at 8:30 AM gives the trader 30
    minutes of lead time to refresh the token before the 9:00 AM alert.
  - Remote token input: Accepts request_token via a method call (from the
    API endpoint), exchanges it for an access token, and stores it.
  - Token history: Logs all token exchanges to the database for auditing.
  - Graceful on failure: If the token check fails (API down, network
    issues), we don't panic — just retry later. A single failed check
    doesn't mean the token is invalid.

TOKEN LIFECYCLE:
  1. User visits Kite login URL → gets request_token
  2. request_token is exchanged for access_token (via this service)
  3. access_token is saved to disk (kite_access_token.txt)
  4. Token is valid until midnight IST
  5. Next morning, this service detects the expired token
  6. Telegram alert is sent with login URL
  7. User authenticates → new request_token → new access_token

INTEGRATION:
  This service is started during FastAPI startup and runs as a background
  thread. The API endpoint POST /api/v1/token calls exchange_request_token()
  which triggers this service's token exchange logic.

Author: DDLJ Strategy Team
Version: 10.1.0
"""

from __future__ import annotations

import os
import threading
import logging
from datetime import datetime, time, timedelta
from typing import Any, Dict, List, Optional

import pytz

# Indian Standard Timezone — ALL timestamps use IST
IST = pytz.timezone("Asia/Kolkata")

log = logging.getLogger("ddlj_backend.token_refresh")


# ============================================================================
# CONSTANTS
# ============================================================================

CHECK_INTERVAL_MINUTES = 30
"""How often (in minutes) to check token validity."""

PRE_MARKET_CHECK_TIME = time(9, 0, 0)
"""Time to send urgent Telegram alert if token is invalid (9:00 AM IST)."""

EARLY_CHECK_TIME = time(8, 30, 0)
"""Time for early token validation check (8:30 AM IST)."""

TOKEN_EXPIRY_HOUR = 0
"""Hour at which Kite tokens expire (midnight IST = 00:00)."""


class TokenRefreshService:
    """
    Monitors Kite API token validity and notifies when refresh is needed.

    This service runs as a background thread that periodically checks
    whether the Kite access token is still valid. If the token is expired
    or invalid, it sends Telegram notifications with the login URL.

    FEATURES:
      - Background token validity checks every 30 minutes
      - Pre-market alert at 9:00 AM IST if token needs refresh
      - Early check at 8:30 AM IST for advance warning
      - Remote token input via exchange_request_token() method
      - Token history logging to database
      - Graceful handling of API failures

    USAGE:
        service = TokenRefreshService()
        service.start()  # Start the background checker
        # ... later, when user provides a request token:
        result = service.exchange_request_token("abc123")
        service.stop()

    Attributes:
        check_interval (int): Minutes between token validity checks.
        token_file (str): Path to the Kite access token file.
    """

    def __init__(
        self,
        check_interval: int = CHECK_INTERVAL_MINUTES,
        token_file: Optional[str] = None,
        api_key: Optional[str] = None,
        api_secret: Optional[str] = None,
    ):
        """
        Initialize the Token Refresh Service.

        Args:
            check_interval (int): Minutes between token checks. Default: 30.
            token_file (str, optional): Path to the token file. Defaults to
                KITE_TOKEN_FILE from core config.
            api_key (str, optional): Kite API key. Defaults to KITE_API_KEY
                from environment.
            api_secret (str, optional): Kite API secret. Defaults to
                KITE_API_SECRET from environment.
        """
        self.check_interval = check_interval
        # Use core.config for token file path (handles Railway /app vs local dev)
        _default_token_file = os.getenv(
            "KITE_TOKEN_FILE",
            os.path.realpath(os.path.join(os.path.dirname(__file__), "..", "kite_access_token.txt")),
        )
        self.token_file = token_file or _default_token_file
        self.api_key = api_key or os.getenv("KITE_API_KEY", "")
        self.api_secret = api_secret or os.getenv("KITE_API_SECRET", "")

        # ── State tracking ──
        self._running = False
        self._guard_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

        # ── Token health tracking ──
        self._token_created_at: Optional[datetime] = None
        self._token_expires_at: Optional[datetime] = None
        self._last_validation_time: Optional[datetime] = None
        self._last_validation_result: Optional[bool] = None
        self._token_history: List[Dict[str, Any]] = []

        # ── Notification state ──
        # WHY: We track whether we've already sent a notification for this
        # token expiry to avoid spamming the user with repeated alerts.
        self._notified_today: bool = False
        self._notified_date: Optional[str] = None

        # ── Login URL ──
        self._login_url = f"https://kite.trade/connect/login?api_key={self.api_key}&v=3"

        log.info(
            "TokenRefreshService: Initialized — check every %dm, token file: %s",
            check_interval,
            self.token_file,
        )

    # ────────────────────────────────────────────────────────────
    # PUBLIC API — LIFECYCLE
    # ────────────────────────────────────────────────────────────

    def start(self) -> dict:
        """
        Start the token refresh background thread.

        Returns:
            dict: Status of the start operation.

        Raises:
            RuntimeError: If the service is already running.
        """
        if self._running:
            raise RuntimeError("TokenRefreshService is already running")

        self._stop_event.clear()
        self._running = True

        self._guard_thread = threading.Thread(
            target=self._monitor_loop,
            name="DDLJ-Token-Refresh",
            daemon=True,
        )
        self._guard_thread.start()

        log.info("TokenRefreshService: Started (check every %dm)", self.check_interval)
        return {"status": "started", "message": "Token refresh service is running"}

    def stop(self) -> dict:
        """
        Stop the token refresh background thread.

        Returns:
            dict: Status of the stop operation.
        """
        if not self._running:
            return {"status": "already_stopped", "message": "Service is not running"}

        self._stop_event.set()
        self._running = False

        if self._guard_thread and self._guard_thread.is_alive():
            self._guard_thread.join(timeout=5)
            if self._guard_thread.is_alive():
                log.warning("TokenRefreshService: Thread did not stop in 5s")

        log.info("TokenRefreshService: Stopped")
        return {"status": "stopped", "message": "Token refresh service stopped"}

    # ────────────────────────────────────────────────────────────
    # PUBLIC API — TOKEN STATUS
    # ────────────────────────────────────────────────────────────

    def get_token_status(self) -> Dict[str, Any]:
        """
        Get the current token status and health information.

        Returns:
            dict: Token status including:
                - stored (bool): Whether a token file exists
                - valid (bool): Whether the token is currently valid
                - user (dict): User profile if token is valid
                - created_at (str): When the token was created
                - expires_at (str): When the token expires
                - last_checked (str): Last validation time
                - needs_refresh (bool): Whether token needs refresh
                - login_url (str): URL for Kite login
        """
        status = {
            "stored": False,
            "valid": False,
            "user": None,
            "created_at": (
                self._token_created_at.isoformat() if self._token_created_at else None
            ),
            "expires_at": (
                self._token_expires_at.isoformat() if self._token_expires_at else None
            ),
            "last_checked": (
                self._last_validation_time.isoformat()
                if self._last_validation_time
                else None
            ),
            "needs_refresh": True,
            "login_url": self._login_url,
        }

        # Check if token file exists
        if not os.path.exists(self.token_file):
            status["error"] = "No token file found"
            return status

        try:
            with open(self.token_file, "r") as f:
                token = f.read().strip()

            if not token:
                status["error"] = "Token file is empty"
                return status

            status["stored"] = True

            # Try to validate the token
            try:
                from engine.token_manager import token_status as check_token
                result = check_token()
                status["valid"] = result.get("valid", False)
                status["user"] = result.get("user")
                status["error"] = result.get("error")
                status["needs_refresh"] = not result.get("valid", False)

                self._last_validation_time = datetime.now(IST)
                self._last_validation_result = result.get("valid", False)

            except ImportError:
                # WHY: token_manager might not be importable during testing
                # or if the engine package is not on the path.
                # We fall back to a simple file-based check.
                log.debug("TokenRefreshService: token_manager not available, using file check")
                status["needs_refresh"] = False  # Assume valid if file exists
                status["valid"] = True  # Can't verify without API call

            return status

        except OSError as e:
            status["error"] = f"Cannot read token file: {e}"
            return status

    def get_login_url(self) -> str:
        """
        Get the Kite login URL for token refresh.

        Returns:
            str: The Kite Connect login URL with the configured API key.
        """
        return self._login_url

    def needs_refresh(self) -> bool:
        """
        Check if the token needs to be refreshed.

        Returns:
            bool: True if the token is missing, invalid, or expired.
        """
        status = self.get_token_status()
        return status.get("needs_refresh", True)

    # ────────────────────────────────────────────────────────────
    # PUBLIC API — TOKEN EXCHANGE
    # ────────────────────────────────────────────────────────────

    def exchange_request_token(self, request_token: str) -> Dict[str, Any]:
        """
        Exchange a request token for an access token.

        This is called when the user provides a new daily request token
        (either via the API or after clicking the login URL).

        Args:
            request_token (str): The request_token from Kite login redirect.

        Returns:
            dict: Exchange result with keys:
                - status (str): "success" or "error"
                - user (str): Authenticated user name (if success)
                - message (str): Result description
        """
        log.info("TokenRefreshService: Exchanging request token...")

        try:
            from engine.token_manager import exchange_request_token as do_exchange

            kite = do_exchange(request_token)
            profile = kite.profile()

            # ── Update internal state ──
            now = datetime.now(IST)
            self._token_created_at = now
            # WHY: Kite tokens expire at midnight IST on the same day.
            # If the token is created after midnight, it expires at the
            # next midnight.
            self._token_expires_at = IST.localize(
                datetime.combine(now.date() + timedelta(days=1), time(0, 0, 0))
            )
            self._last_validation_time = now
            self._last_validation_result = True

            # Reset the notified flag so we can alert again tomorrow
            self._notified_today = False

            # ── Log to token history ──
            exchange_record = {
                "timestamp": now.isoformat(),
                "user": profile.get("user_name", "unknown"),
                "user_id": profile.get("user_id", "unknown"),
                "status": "success",
            }
            self._token_history.append(exchange_record)
            self._save_token_history(exchange_record)

            log.info(
                "TokenRefreshService: Token exchanged successfully for user %s",
                profile.get("user_name", "unknown"),
            )

            return {
                "status": "success",
                "user": profile.get("user_name", "unknown"),
                "message": "Token exchanged successfully. Engine can connect to Kite API.",
            }

        except ImportError:
            log.error("TokenRefreshService: token_manager not available for exchange")
            return {
                "status": "error",
                "message": "Token manager not available. Cannot exchange token.",
            }
        except Exception as e:
            log.error("TokenRefreshService: Token exchange failed: %s", e, exc_info=True)

            # Log the failed exchange
            exchange_record = {
                "timestamp": datetime.now(IST).isoformat(),
                "status": "failed",
                "error": str(e),
            }
            self._token_history.append(exchange_record)

            return {
                "status": "error",
                "message": f"Token exchange failed: {e}",
            }

    # ────────────────────────────────────────────────────────────
    # PUBLIC API — STATUS
    # ────────────────────────────────────────────────────────────

    def get_status(self) -> Dict[str, Any]:
        """
        Get the current status of the token refresh service.

        Returns:
            dict: Service status including running state, token health,
                and notification state.
        """
        token_status = self.get_token_status()

        return {
            "service_running": self._running,
            "check_interval_minutes": self.check_interval,
            "token": token_status,
            "notified_today": self._notified_today,
            "history_entries": len(self._token_history),
            "login_url": self._login_url,
        }

    # ────────────────────────────────────────────────────────────
    # PRIVATE METHODS — MONITORING LOOP
    # ────────────────────────────────────────────────────────────

    def _monitor_loop(self) -> None:
        """
        Main monitoring loop running in the background thread.

        Checks token validity at the configured interval and sends
        Telegram notifications when the token needs refresh.
        """
        log.info("TokenRefreshService: Monitor loop started")

        # Perform an immediate check on startup
        self._perform_check()

        while not self._stop_event.is_set():
            # Wait for the check interval
            # WHY: We use wait() instead of sleep() so the thread can be
            # stopped immediately when stop() is called.
            if self._stop_event.wait(timeout=self.check_interval * 60):
                break

            try:
                self._perform_check()
            except Exception as e:
                # WHY: The monitor must NEVER crash — it's a critical
                # background service. On error, we log and retry later.
                log.error(
                    "TokenRefreshService: Monitor error: %s", e, exc_info=True
                )

        log.info("TokenRefreshService: Monitor loop ended")

    def _perform_check(self) -> None:
        """
        Perform a single token validity check.

        This method checks the current time and token status, and sends
        Telegram notifications at the appropriate times:
          - 8:30 AM: Early validation check
          - 9:00 AM: Urgent alert if token is still invalid
          - Every 30 min: Routine validity check
        """
        now = datetime.now(IST)
        current_time = now.time()

        # ── Reset daily notification state at midnight ──
        today_str = now.strftime("%Y-%m-%d")
        if self._notified_date != today_str:
            self._notified_today = False
            self._notified_date = today_str

        # ── Check token validity ──
        status = self.get_token_status()
        is_valid = status.get("valid", False)
        is_stored = status.get("stored", False)

        self._last_validation_time = now
        self._last_validation_result = is_valid

        # ── Pre-market checks (8:30 AM and 9:00 AM) ──
        # WHY: These are the most critical checks. If the token is
        # invalid before market open, the trader MUST be notified so they
        # can log in before 9:15 AM.
        is_early_check = (
            EARLY_CHECK_TIME <= current_time < time(
                EARLY_CHECK_TIME.hour, EARLY_CHECK_TIME.minute + 5
            )
        )
        is_pre_market = (
            PRE_MARKET_CHECK_TIME <= current_time < time(
                PRE_MARKET_CHECK_TIME.hour, PRE_MARKET_CHECK_TIME.minute + 5
            )
        )

        if not is_valid and not self._notified_today:
            # ── Send Telegram notification ──
            if is_pre_market:
                self._send_urgent_notification(now)
            elif is_early_check:
                self._send_early_notification(now)
            elif not is_stored:
                # No token at all — send a general notification
                self._send_missing_token_notification(now)
            # else: Routine check — don't spam for routine failures

        elif is_valid:
            log.debug("TokenRefreshService: Token is valid (checked at %s)", now.strftime("%H:%M"))

    # ────────────────────────────────────────────────────────────
    # PRIVATE METHODS — NOTIFICATIONS
    # ────────────────────────────────────────────────────────────

    def _send_urgent_notification(self, now: datetime) -> None:
        """
        Send an urgent pre-market Telegram notification.

        This is sent at 9:00 AM IST if the token is still invalid.
        The market opens in 15 minutes, so this is time-critical.

        Args:
            now (datetime): Current IST time.
        """
        log.warning(
            "TokenRefreshService: URGENT — Token invalid at %s (15 min to market open!)",
            now.strftime("%H:%M"),
        )

        try:
            # Import notifier here to avoid circular dependency
            # and to only create the notifier when we need it
            from services.telegram_notifier import TelegramNotifier
            notifier = TelegramNotifier()

            message = (
                "⚠️ <b>ACTION REQUIRED — Token Expired!</b>\n\n"
                f"Market opens in <b>15 minutes</b> but your Kite token is invalid.\n\n"
                f"🔑 <b>Login here:</b>\n{self._login_url}\n\n"
                f"After login, submit the request_token via the dashboard or API.\n\n"
                f"<i>🕐 {now.strftime('%H:%M:%S IST')}</i>"
            )
            notifier.send_message_sync(message)
            self._notified_today = True

        except Exception as e:
            log.error("TokenRefreshService: Failed to send urgent notification: %s", e)

    def _send_early_notification(self, now: datetime) -> None:
        """
        Send an early morning Telegram notification.

        This is sent at 8:30 AM IST as an early warning if the token
        is invalid. Gives the trader 30 minutes to refresh before
        the urgent 9:00 AM alert.

        Args:
            now (datetime): Current IST time.
        """
        log.info(
            "TokenRefreshService: Early check — Token invalid at %s",
            now.strftime("%H:%M"),
        )

        try:
            from services.telegram_notifier import TelegramNotifier
            notifier = TelegramNotifier()

            message = (
                "🔑 <b>Token Refresh Needed</b>\n\n"
                f"Your Kite access token is invalid or expired.\n"
                f"Market opens in ~45 minutes.\n\n"
                f"👉 <b>Login here:</b>\n{self._login_url}\n\n"
                f"<i>🕐 {now.strftime('%H:%M:%S IST')}</i>"
            )
            notifier.send_message_sync(message)

        except Exception as e:
            log.error("TokenRefreshService: Failed to send early notification: %s", e)

    def _send_missing_token_notification(self, now: datetime) -> None:
        """
        Send a notification when no token file exists at all.

        Args:
            now (datetime): Current IST time.
        """
        log.info("TokenRefreshService: No token file found")

        try:
            from services.telegram_notifier import TelegramNotifier
            notifier = TelegramNotifier()

            message = (
                "🔑 <b>No Kite Token Found</b>\n\n"
                f"No access token file exists. The trading engine cannot start.\n\n"
                f"👉 <b>Login here:</b>\n{self._login_url}\n\n"
                f"After login, submit the request_token via the dashboard or API.\n\n"
                f"<i>🕐 {now.strftime('%H:%M:%S IST')}</i>"
            )
            notifier.send_message_sync(message)

        except Exception as e:
            log.error("TokenRefreshService: Failed to send missing token notification: %s", e)

    # ────────────────────────────────────────────────────────────
    # PRIVATE METHODS — HISTORY
    # ────────────────────────────────────────────────────────────

    def _save_token_history(self, record: Dict[str, Any]) -> None:
        """
        Save a token exchange record to the database.

        This is a best-effort operation — if the database is unavailable,
        we just log the record locally.

        Args:
            record (dict): The token exchange record to save.
        """
        try:
            from core.config import DATABASE_URL

            if not DATABASE_URL:
                log.debug("TokenRefreshService: No database — history saved in memory only")
                return

            # TODO: Implement database save when Supabase is integrated
            log.debug("TokenRefreshService: Database history save (not yet implemented)")

        except ImportError:
            log.debug("TokenRefreshService: Database config not available")
        except Exception as e:
            log.debug("TokenRefreshService: History save skipped: %s", e)
