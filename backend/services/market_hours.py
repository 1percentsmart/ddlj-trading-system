#!/usr/bin/env python3
"""
DDLJ Trading System — Market Hours Guard Service
===================================================

Automatically starts and stops the trading engine based on Indian market
hours (9:15 AM - 3:30 PM IST). This ensures the engine is never running
outside of valid trading windows, conserving resources and preventing
erroneous signals from after-hours data.

KEY DESIGN DECISIONS:
  - Pre-market warmup: The engine is started 5 minutes before market open
    (9:10 AM) so that indicators (EMA, ATR, VWAP) are fully warmed up by
    the time the first tradeable candle forms at 9:15 AM. Without warmup,
    the first 15-20 minutes produce no signals — which means missed trades.
  - Post-market cooldown: The engine runs 5 minutes after market close
    (3:35 PM) to allow final position saves and state persistence to
    complete before shutting down.
  - Weekend/holiday awareness: The guard skips weekends entirely. A
    configurable holiday list can be added for Indian market holidays
    (Republic Day, Holi, Diwali, etc.).
  - Background thread: Runs a daemon thread that checks every 30 seconds
    whether the market is open/closed and fires the appropriate callbacks.

CALLBACK ARCHITECTURE:
  on_market_open(callback)  → called when market transitions to OPEN
  on_market_close(callback) → called when market transitions to CLOSED
  Callbacks are invoked in the background thread, so they should be
  non-blocking or spawn their own threads for long-running work.

INTEGRATION WITH ENGINE MANAGER:
  The guard calls engine_manager.start_engine() / stop_engine() when
  market opens/closes. This is set up via the callback mechanism,
  keeping the guard decoupled from the engine manager implementation.

Author: DDLJ Strategy Team
Version: 10.1.0
"""

from __future__ import annotations

import threading
import logging
from datetime import datetime, time, timedelta
from typing import Callable, List, Optional

import pytz

# Indian Standard Timezone — ALL timestamps in this service use IST
IST = pytz.timezone("Asia/Kolkata")

log = logging.getLogger("ddlj_backend.market_hours")


# ============================================================================
# MARKET HOLIDAYS
# ============================================================================
# Indian stock market holidays for the current year.
# Updated manually or loaded from an external source.
# WHY: NSE/BSE are closed on these days — we must not start the engine.

# Default holiday list — can be extended via config or API
DEFAULT_HOLIDAYS_2025: List[str] = [
    # Format: "YYYY-MM-DD" — Indian market holidays
    "2025-02-26",  # Mahashivratri
    "2025-03-14",  # Holi
    "2025-03-31",  # Id-Ul-Fitr
    "2025-04-10",  # Shri Mahavir Jayanti
    "2025-04-14",  # Dr. Baba Saheb Ambedkar Jayanti
    "2025-04-18",  # Good Friday
    "2025-05-01",  # Maharashtra Day
    "2025-06-07",  # Bakri Id
    "2025-07-06",  # Muharram
    "2025-08-15",  # Independence Day
    "2025-08-16",  # Janmashtami
    "2025-08-27",  # Ganesh Chaturthi
    "2025-10-02",  # Mahatma Gandhi Jayanti
    "2025-10-21",  # Dussehra
    "2025-10-22",  # Dussehra (additional)
    "2025-11-05",  # Diwali (Laxmi Pujan) — special Muhurat trading only
    "2025-11-07",  # Diwali (Balipratipada)
    "2025-11-15",  # Guru Nanak Jayanti
    "2025-12-25",  # Christmas
]


class MarketHoursGuard:
    """
    Guards the trading engine lifecycle based on Indian market hours.

    Runs a background thread that monitors the current time and automatically
    triggers engine start/stop when the market opens/closes.

    FEATURES:
      - Pre-market warmup at 9:10 AM (engine starts 5 min early)
      - Post-market cooldown until 3:35 PM (engine stops 5 min after close)
      - Weekend detection (Saturday/Sunday → market closed)
      - Holiday detection (configurable list of dates)
      - Callbacks for market open/close transitions
      - Time-to-close calculation for risk management

    USAGE:
        guard = MarketHoursGuard()
        guard.on_market_open(my_start_function)
        guard.on_market_close(my_stop_function)
        guard.start()  # Starts the background checker

    Attributes:
        market_open (time): Market open time (default 9:15 AM IST).
        market_close (time): Market close time (default 3:30 PM IST).
        warmup_minutes (int): Minutes before open to start the engine.
        cooldown_minutes (int): Minutes after close to stop the engine.
    """

    def __init__(
        self,
        market_open: Optional[time] = None,
        market_close: Optional[time] = None,
        warmup_minutes: int = 5,
        cooldown_minutes: int = 5,
        check_interval: int = 30,
        holidays: Optional[List[str]] = None,
    ):
        """
        Initialize the Market Hours Guard.

        Args:
            market_open (time, optional): Market open time. Defaults to 9:15 AM IST.
            market_close (time, optional): Market close time. Defaults to 3:30 PM IST.
            warmup_minutes (int): Start engine this many minutes before market open.
                Default: 5 (engine starts at 9:10 AM).
            cooldown_minutes (int): Keep engine running this many minutes after
                market close. Default: 5 (engine stops at 3:35 PM).
            check_interval (int): Seconds between market status checks. Default: 30.
            holidays (list[str], optional): List of holiday dates in "YYYY-MM-DD"
                format. Defaults to the 2025 Indian market holiday list.
        """
        # ── Market timing configuration ──
        self.market_open = market_open or time(9, 15, 0)
        self.market_close = market_close or time(15, 30, 0)
        self.warmup_minutes = warmup_minutes
        self.cooldown_minutes = cooldown_minutes
        self.check_interval = check_interval

        # ── Holidays ──
        # WHY: The guard needs to know when the market is closed for holidays
        # so it doesn't start the engine on a non-trading day.
        self.holidays = set(holidays or DEFAULT_HOLIDAYS_2025)

        # ── Derived times ──
        # Warmup time: when we start the engine (before market open)
        self._warmup_time = time(
            self.market_open.hour,
            max(0, self.market_open.minute - warmup_minutes),
            0,
        )
        # Cooldown time: when we stop the engine (after market close)
        cooldown_total = self.market_close.hour * 60 + self.market_close.minute + cooldown_minutes
        self._cooldown_time = time(
            cooldown_total // 60,
            cooldown_total % 60,
            0,
        )

        # ── Callbacks ──
        self._on_open_callbacks: List[Callable] = []
        self._on_close_callbacks: List[Callable] = []

        # ── State ──
        self._running = False              # Is the guard thread running?
        self._market_is_open = False        # Current market state
        self._engine_should_run = False     # Should engine be running? (warmup + market + cooldown)
        self._guard_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

        log.info(
            "MarketHoursGuard: Initialized — Market %s-%s IST, "
            "Warmup at %s, Cooldown until %s",
            self.market_open.strftime("%H:%M"),
            self.market_close.strftime("%H:%M"),
            self._warmup_time.strftime("%H:%M"),
            self._cooldown_time.strftime("%H:%M"),
        )

    # ────────────────────────────────────────────────────────────
    # PUBLIC API
    # ────────────────────────────────────────────────────────────

    def start(self) -> dict:
        """
        Start the market hours guard background thread.

        The guard will begin monitoring market hours and triggering
        callbacks when the market opens or closes.

        Returns:
            dict: Status of the start operation.

        Raises:
            RuntimeError: If the guard is already running.
        """
        if self._running:
            raise RuntimeError("MarketHoursGuard is already running")

        self._stop_event.clear()
        self._running = True

        self._guard_thread = threading.Thread(
            target=self._guard_loop,
            name="DDLJ-MarketHours-Guard",
            daemon=True,  # Die when the main process exits
        )
        self._guard_thread.start()

        log.info("MarketHoursGuard: Started background thread (check every %ds)", self.check_interval)
        return {"status": "started", "message": "Market hours guard is running"}

    def stop(self) -> dict:
        """
        Stop the market hours guard background thread.

        Returns:
            dict: Status of the stop operation.
        """
        if not self._running:
            return {"status": "already_stopped", "message": "Guard is not running"}

        self._stop_event.set()
        self._running = False

        # Wait for the thread to finish (max 5 seconds)
        if self._guard_thread and self._guard_thread.is_alive():
            self._guard_thread.join(timeout=5)
            if self._guard_thread.is_alive():
                log.warning("MarketHoursGuard: Thread did not stop in 5s")

        log.info("MarketHoursGuard: Stopped")
        return {"status": "stopped", "message": "Market hours guard stopped"}

    def is_market_hours(self) -> bool:
        """
        Check if the market is currently open.

        This checks against the current IST time, weekday, and holiday list.

        Returns:
            bool: True if the market is currently within trading hours.
        """
        now = datetime.now(IST)
        return self._is_market_hours_at(now)

    def should_engine_run(self) -> bool:
        """
        Check if the engine should be running right now.

        This includes the warmup period before market open and the
        cooldown period after market close.

        Returns:
            bool: True if the engine should be running.
        """
        now = datetime.now(IST)
        return self._should_engine_run_at(now)

    def get_next_market_open(self) -> Optional[datetime]:
        """
        Calculate the next market open time.

        Accounts for weekends and holidays. Returns None if no trading
        day can be found within the next 7 days.

        Returns:
            datetime: The next market open time in IST, or None.
        """
        now = datetime.now(IST)

        # Check today first
        if self._is_trading_day(now) and now.time() < self.market_open:
            return IST.localize(datetime.combine(now.date(), self.market_open))

        # Check the next 7 days
        for day_offset in range(1, 8):
            future_date = now.date() + timedelta(days=day_offset)
            future_dt = datetime(future_date.year, future_date.month, future_date.day)
            if self._is_trading_day_by_date(future_date):
                return IST.localize(datetime.combine(future_date, self.market_open))

        log.warning("MarketHoursGuard: No trading day found in next 7 days")
        return None

    def get_time_to_close(self) -> Optional[timedelta]:
        """
        Get the time remaining until market close.

        Returns None if the market is not currently open.

        Returns:
            timedelta: Time remaining until market close, or None.
        """
        if not self.is_market_hours():
            return None

        now = datetime.now(IST)
        close_dt = IST.localize(datetime.combine(now.date(), self.market_close))
        remaining = close_dt - now
        return remaining if remaining.total_seconds() > 0 else timedelta(0)

    def on_market_open(self, callback: Callable) -> None:
        """
        Register a callback to be called when the market opens.

        The callback is invoked in the guard's background thread, so
        it should be non-blocking or spawn its own thread.

        Args:
            callback (Callable): Function to call on market open.
                Receives no arguments.
        """
        self._on_open_callbacks.append(callback)
        log.info("MarketHoursGuard: Registered market-open callback: %s", callback.__name__)

    def on_market_close(self, callback: Callable) -> None:
        """
        Register a callback to be called when the market closes.

        The callback is invoked in the guard's background thread, so
        it should be non-blocking or spawn its own thread.

        Args:
            callback (Callable): Function to call on market close.
                Receives no arguments.
        """
        self._on_close_callbacks.append(callback)
        log.info("MarketHoursGuard: Registered market-close callback: %s", callback.__name__)

    def add_holiday(self, date_str: str) -> None:
        """
        Add a market holiday to the guard's holiday list.

        Args:
            date_str (str): Date in "YYYY-MM-DD" format.
        """
        self.holidays.add(date_str)
        log.info("MarketHoursGuard: Added holiday: %s", date_str)

    def get_status(self) -> dict:
        """
        Get the current status of the market hours guard.

        Returns:
            dict: Status information including market state, next open,
                time to close, and guard running state.
        """
        now = datetime.now(IST)
        is_trading_day = self._is_trading_day(now)

        status = {
            "guard_running": self._running,
            "market_is_open": self.is_market_hours(),
            "engine_should_run": self.should_engine_run(),
            "is_trading_day": is_trading_day,
            "current_time_ist": now.strftime("%Y-%m-%d %H:%M:%S"),
            "market_hours": f"{self.market_open.strftime('%H:%M')}-{self.market_close.strftime('%H:%M')} IST",
            "warmup_time": self._warmup_time.strftime("%H:%M"),
            "cooldown_until": self._cooldown_time.strftime("%H:%M"),
            "holidays_count": len(self.holidays),
        }

        # Add next market open if applicable
        next_open = self.get_next_market_open()
        if next_open:
            status["next_market_open"] = next_open.strftime("%Y-%m-%d %H:%M:%S IST")

        # Add time to close if market is open
        time_to_close = self.get_time_to_close()
        if time_to_close is not None:
            status["time_to_close"] = str(time_to_close)

        return status

    # ────────────────────────────────────────────────────────────
    # PRIVATE METHODS
    # ────────────────────────────────────────────────────────────

    def _guard_loop(self) -> None:
        """
        Main guard loop running in the background thread.

        Checks market status every `check_interval` seconds and fires
        callbacks when the market transitions between open and closed states.
        """
        log.info("MarketHoursGuard: Background loop started")

        # Perform an immediate check on startup
        self._check_and_transition()

        while not self._stop_event.is_set():
            # Wait for the check interval, but exit early if stop is requested
            if self._stop_event.wait(timeout=self.check_interval):
                break

            try:
                self._check_and_transition()
            except Exception as e:
                # WHY: The guard must NEVER crash — it's a critical system service.
                # If it crashes, the engine might run outside market hours or
                # fail to start when the market opens.
                log.error("MarketHoursGuard: Error in guard loop: %s", e, exc_info=True)

        log.info("MarketHoursGuard: Background loop ended")

    def _check_and_transition(self) -> None:
        """
        Check the current market state and fire callbacks if the state changed.

        State transitions:
          CLOSED → OPEN:    When time enters [warmup_time, cooldown_time) on a trading day
          OPEN   → CLOSED:  When time exits the [warmup_time, cooldown_time) window
        """
        now = datetime.now(IST)
        engine_should_run = self._should_engine_run_at(now)

        # Detect transition: engine was NOT running → should NOW run
        if engine_should_run and not self._engine_should_run:
            log.info(
                "MarketHoursGuard: Market opening — triggering start callbacks "
                "(current time: %s IST)",
                now.strftime("%H:%M:%S"),
            )
            self._engine_should_run = True

            # Fire open callbacks — each in its own try/except so one
            # failing callback doesn't prevent others from running
            for callback in self._on_open_callbacks:
                try:
                    callback()
                except Exception as e:
                    log.error(
                        "MarketHoursGuard: Open callback %s failed: %s",
                        callback.__name__, e, exc_info=True,
                    )

        # Detect transition: engine WAS running → should NOW stop
        elif not engine_should_run and self._engine_should_run:
            log.info(
                "MarketHoursGuard: Market closing — triggering stop callbacks "
                "(current time: %s IST)",
                now.strftime("%H:%M:%S"),
            )
            self._engine_should_run = False

            for callback in self._on_close_callbacks:
                try:
                    callback()
                except Exception as e:
                    log.error(
                        "MarketHoursGuard: Close callback %s failed: %s",
                        callback.__name__, e, exc_info=True,
                    )

        # Update market open state (for is_market_hours queries)
        self._market_is_open = self._is_market_hours_at(now)

    def _should_engine_run_at(self, dt: datetime) -> bool:
        """
        Check if the engine should be running at a specific datetime.

        The engine should run during:
          - Warmup period: [warmup_time, market_open)
          - Market hours:  [market_open, market_close)
          - Cooldown period: [market_close, cooldown_time)

        But ONLY on trading days (not weekends, not holidays).

        Args:
            dt (datetime): The datetime to check (should be IST-aware).

        Returns:
            bool: True if the engine should be running at this time.
        """
        if not self._is_trading_day(dt):
            return False

        current_time = dt.time()

        # Engine runs from warmup_time through cooldown_time
        # WHY: Warmup allows indicators to stabilize before trading begins.
        #      Cooldown allows final state saves after market closes.
        if self._warmup_time <= current_time < self._cooldown_time:
            return True

        return False

    def _is_market_hours_at(self, dt: datetime) -> bool:
        """
        Check if a specific datetime falls within market hours.

        This is STRICT market hours (9:15-3:30), NOT including warmup/cooldown.

        Args:
            dt (datetime): The datetime to check (should be IST-aware).

        Returns:
            bool: True if the market is open at this time.
        """
        if not self._is_trading_day(dt):
            return False

        current_time = dt.time()
        return self.market_open <= current_time < self.market_close

    def _is_trading_day(self, dt: datetime) -> bool:
        """
        Check if a datetime falls on a trading day.

        A trading day is a weekday (Mon-Fri) that is not a holiday.

        Args:
            dt (datetime): The datetime to check.

        Returns:
            bool: True if it's a trading day.
        """
        # Weekend check: Saturday=5, Sunday=6
        if dt.weekday() >= 5:
            return False

        # Holiday check
        date_str = dt.strftime("%Y-%m-%d")
        if date_str in self.holidays:
            log.debug("MarketHoursGuard: %s is a holiday", date_str)
            return False

        return True

    def _is_trading_day_by_date(self, date) -> bool:
        """
        Check if a date object falls on a trading day.

        Args:
            date: A datetime.date object.

        Returns:
            bool: True if it's a trading day.
        """
        # Create a datetime for weekday check
        dt = datetime(date.year, date.month, date.day)
        if dt.weekday() >= 5:
            return False

        date_str = date.strftime("%Y-%m-%d")
        if date_str in self.holidays:
            return False

        return True
