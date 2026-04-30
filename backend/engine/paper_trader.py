#!/usr/bin/env python3
"""
DDLJ v9.1 — Live Paper Trading Engine (Production-Ready)
==========================================================

The HEART of the live paper trading system. Connects to Zerodha's Kite API
for real-time candle data, runs the DDLJ strategy logic (bias + signal +
options engines), and simulates order placement. Everything is real EXCEPT
order execution — no real money is at risk.

HOW IT WORKS:
  1. Connect to Kite API using token_manager
  2. Preload historical data for indicator warmup (BUG FIX: was missing)
  3. Poll for new candles at the configured interval (default: 5 seconds)
  4. Feed each new candle through the strategy pipeline:
     a. Bias Engine → Is the market BULLISH, BEARISH, or NEUTRAL?
     b. Signal Engine → Is there a valid entry setup?
     c. Options Engine → What option should we "buy", at what price?
     d. Risk Manager → Are we within daily risk limits?
  5. If all checks pass, simulate an order (record what WOULD have happened)
  6. Manage open positions with trailing stops, breakeven, time exits
  7. Force close all positions at 3:10 PM (end-of-day rule)
  8. Log everything to JSON and CSV files
  9. Save session state for resume after restart
 10. Periodically refresh India VIX for accurate IV (NEW in v9.1)

BUG FIXES IN v9.1 (on top of v9.0):
  #6  Time Exit calculation: 60m TF caused instant exit (15//60=0)
  #7  DTE estimation: was weekly Thursday, now monthly (last Thursday)
  #8  Missing warmup preload: buffers started empty, no signals for hours
  #9  Bias candle only pushed with entry candle: now pushed independently
  #10 NEAR_TGT hardcoded 3 points: now scaled by ATR
  #11 Bias change notification missed NEUTRAL→BULLISH: now fires on all changes
  #12 RISK_PER_POSITION_PCT not implemented: now checked before entry
  #13 Drawdown circuit breaker hardcoded 0.80: now uses config parameter
  #14 Capital floor hardcoded 0.20: now uses config parameter
  #15 Position management hardcoded values: now uses config parameters
  #16 Real-time VIX refresh: now periodically fetches current VIX from API

KEY PRINCIPLE:
  This is NOT a backtest. This runs on REAL-TIME data during market hours.
  The only difference from live trading is that orders are NOT actually sent
  to the exchange. Every other aspect (data, signals, risk management) is
  identical to what a live system would do.

Author: DDLJ Strategy Team
Version: 9.1.0 (Production — Paper Trading Ready, All Bugs Fixed)
"""

import os
import json
import csv
import time
import logging
import calendar
from datetime import datetime, date, timedelta, time as dtime
from dataclasses import dataclass, asdict

import pytz

from .candle_data import Candle, CandleBuffer, parse_candles, build_htf_from_ltf
from .indicators import swing_high, swing_low
from .cost_calculator import calc_costs_options
from .bias_engine import BiasEngine
from .signal_engine import EMACrossSignal
from .options_engine import OptionsMimicryEngine
from .trade_types import Trade
from .token_manager import get_kite_session
from .data_fetcher import KiteDataFetcher
from . import config as cfg

# Indian Standard Timezone — used for ALL timestamps in the system
IST = pytz.timezone("Asia/Kolkata")
log = logging.getLogger("ddlj_v9")


# ============================================================================
# HELPER: Monthly Expiry Calculation (BUG FIX #7)
# ============================================================================

def last_thursday_of_month(year: int, month: int) -> date:
    """
    Find the last Thursday of a given month.

    WHY: Indian index options expire on the last Thursday of each month.
    The old code used (3 - weekday()) % 7 which gives the NEXT Thursday
    (weekly expiry), not the monthly expiry. This caused DTE to be wrong
    — sometimes too short (same week) when it should be longer (end of month).

    EXAMPLE: last_thursday_of_month(2026, 4) = April 30, 2026 (Thursday)

    Args:
        year (int): The year.
        month (int): The month (1-12).

    Returns:
        date: The last Thursday of that month.
    """
    # Get the last day of the month
    last_day = calendar.monthrange(year, month)[1]
    last_date = date(year, month, last_day)

    # Walk backwards until we find a Thursday (weekday() == 3)
    while last_date.weekday() != 3:
        last_date -= timedelta(days=1)

    return last_date


def estimate_dte_monthly(trade_date) -> int:
    """
    Estimate Days To Expiry for the nearest MONTHLY options expiry.

    BUG FIX #7: The old code used `(3 - weekday()) % 7` which gives
    days to the NEXT Thursday (weekly expiry). But Indian index options
    have MONTHLY expiry on the last Thursday. This matters because:
    - If today is Monday April 27, old code says DTE=3 (April 30).
    - But if today is Monday April 6, old code says DTE=3 (April 9) — WRONG!
    - The correct DTE for April 6 should be 24 (April 30).

    This function always calculates days to the last Thursday of the
    CURRENT month (or next month if this month's expiry has passed).

    Args:
        trade_date: The trade date (date or datetime object).

    Returns:
        int: Calendar days to monthly expiry. Minimum 0 (expiry day).
    """
    d = trade_date.date() if hasattr(trade_date, 'date') else trade_date

    # Find this month's expiry
    expiry = last_thursday_of_month(d.year, d.month)

    # If expiry has passed, use next month's expiry
    if d > expiry:
        if d.month == 12:
            expiry = last_thursday_of_month(d.year + 1, 1)
        else:
            expiry = last_thursday_of_month(d.year, d.month + 1)

    dte = (expiry - d).days
    return max(0, dte)


# ============================================================================
# SIMULATED POSITION — Tracks an open paper trade
# ============================================================================

@dataclass
class SimulatedPosition:
    """
    A single open position in the paper trading system.

    This mirrors the position object used in the backtester but is a proper
    dataclass for cleaner serialization and state persistence.

    Attributes:
        symbol (str): Trading symbol (e.g., "BANKNIFTY").
        direction (str): "LONG" or "SHORT".
        entry (float): Entry price of the underlying (spot at signal time).
        entry_time (str): ISO format timestamp of entry.
        qty (int): Quantity traded (lots * lot_size for options).
        sl (float): Current stop loss price (may be trailed from original).
        target (float): Target (take-profit) price.
        rr (float): Risk-reward ratio at entry.
        risk (float): Risk in points at entry.
        reward (float): Reward in points at entry.
        held (int): Number of candles held since entry.
        be_done (bool): Whether breakeven has been triggered.
        atr_at_entry (float): ATR value when the trade was entered.
        opt_entry (dict): Options entry details from OptionsMimicryEngine.
        original_sl (float): Original stop loss (before trailing).
    """
    symbol: str
    direction: str
    entry: float
    entry_time: str
    qty: int
    sl: float
    target: float
    rr: float
    risk: float
    reward: float
    held: int = 0
    be_done: bool = False
    atr_at_entry: float = 0
    opt_entry: dict = None
    original_sl: float = 0


# ============================================================================
# PAPER TRADER — The Main Engine
# ============================================================================

class PaperTrader:
    """
    Live paper trading engine for the DDLJ v9.1 strategy.

    This engine runs during Indian market hours (9:15 AM - 3:30 PM IST),
    processes real candle data from the Kite API, generates trading signals,
    and simulates order placement. No real orders are sent.

    USAGE:
        >>> trader = PaperTrader()                       # Use defaults from config
        >>> trader.start()                                # Start trading
        >>> # Or with overrides:
        >>> trader = PaperTrader(config_override={
        ...     "STARTING_CAPITAL": 100000,
        ...     "DAILY_RISK_PCT": 4.0,
        ...     "TRADE_INDEX": "NIFTY",
        ... })
        >>> trader.start()

    CONFIGURATION:
        All parameters can be overridden at initialization by passing a
        config_override dict. This allows you to customize without editing
        config.py. See config.py for all available parameters.
    """

    # Market hours in IST — Indian stock market timing
    MARKET_OPEN = dtime(9, 15)    # 9:15 AM IST
    MARKET_CLOSE = dtime(15, 30)  # 3:30 PM IST

    def __init__(self, config_override=None):
        """
        Initialize the Paper Trader.

        Args:
            config_override (dict, optional): Override any config.py parameter.
                Example: {"STARTING_CAPITAL": 100000, "DAILY_RISK_PCT": 4.0}
                WHY config_override? Lets users customize without editing files.
        """
        # ── Apply config overrides ──
        # Copy ALL uppercase attributes from config.py into our local _config dict.
        # This allows runtime overrides without modifying the original file.
        self._config = {}
        for attr in dir(cfg):
            if attr.isupper():
                self._config[attr] = getattr(cfg, attr)
        if config_override:
            self._config.update(config_override)

        # ── Core trading parameters ──
        self.starting_capital = self._config["STARTING_CAPITAL"]
        self.current_capital = self.starting_capital
        self.peak_capital = self.starting_capital
        self.daily_risk_pct = self._config["DAILY_RISK_PCT"]
        self.max_open_positions = self._config["MAX_OPEN_POSITIONS"]
        self.max_daily_trades = self._config["MAX_DAILY_TRADES"]
        self.max_daily_trades_enabled = self._config.get("MAX_DAILY_TRADES_ENABLED", True)

        # BUG FIX #12: Read RISK_PER_POSITION_PCT from config (was ignored)
        # If set to None, no per-position risk limit is applied.
        # If set to a float (e.g., 3.0), max risk per trade = 3% of capital.
        self.risk_per_position_pct = self._config.get("RISK_PER_POSITION_PCT", None)

        # BUG FIX #13: Drawdown circuit breaker uses config (was hardcoded 0.80)
        # BUG FIX #14: Capital floor uses config (was hardcoded 0.20)
        self.dd_circuit_breaker = self._config.get("DRAWDOWN_CIRCUIT_BREAKER", 0.80)
        self.capital_floor_pct = self._config.get("CAPITAL_FLOOR_PCT", 0.20)

        # BUG FIX #15: Position management uses config (was hardcoded)
        self.be_trigger_risk_mult = self._config.get("BE_TRIGGER_RISK_MULT", 1.0)
        self.trailing_stop_enabled = self._config.get("TRAILING_STOP_ENABLED", True)
        self.trail_every_n_candles = self._config.get("TRAIL_EVERY_N_CANDLES", 3)
        self.bias_flip_min_held = self._config.get("BIAS_FLIP_MIN_HELD", 6)
        self.near_target_atr = self._config.get("NEAR_TARGET_ATR", 0.01)
        self.max_trade_hours = self._config.get("MAX_TRADE_HOURS", 6.0)

        # ── Timeframe settings ──
        self.entry_tf = self._config["ENTRY_TIMEFRAME"]
        self.bias_tf = self._config["BIAS_TIMEFRAME"]
        self.trade_index = self._config["TRADE_INDEX"]

        # ── Time boundaries ──
        self.no_trade_end = dtime(
            self._config["NO_TRADE_END_HOUR"],
            self._config["NO_TRADE_END_MINUTE"]
        )
        self.entry_cutoff = dtime(
            self._config["ENTRY_CUTOFF_HOUR"],
            self._config["ENTRY_CUTOFF_MINUTE"]
        )
        self.force_close_time = dtime(
            self._config["FORCE_CLOSE_HOUR"],
            self._config["FORCE_CLOSE_MINUTE"]
        )

        # ── Polling settings ──
        self.poll_interval = self._config["POLL_INTERVAL_SECONDS"]

        # ── Warmup settings (BUG FIX #8) ──
        self.warmup_days = self._config.get("WARMUP_DAYS", 30)

        # ── Real-time VIX settings ──
        self.vix_refresh_seconds = self._config.get("VIX_REFRESH_SECONDS", 300)
        self._last_vix_refresh = 0
        self._live_vix = None  # Will be populated from API

        # ── Notification settings ──
        self.notify_on_trade = self._config["NOTIFY_ON_TRADE"]
        self.notify_on_daily_limit = self._config["NOTIFY_ON_DAILY_LIMIT"]
        self.notify_on_bias_change = self._config["NOTIFY_ON_BIAS_CHANGE"]

        # ── File paths ──
        self.trade_log_file = self._config["TRADE_LOG_FILE"]
        self.trade_log_csv = self._config["TRADE_LOG_CSV"]
        self.session_state_file = self._config["SESSION_STATE_FILE"]

        # ── Instrument tokens ──
        if self.trade_index == "BANKNIFTY":
            self.index_token = self._config["BN_INDEX_TOKEN"]
        else:
            self.index_token = self._config["NF_INDEX_TOKEN"]

        # ── Kite API connection (initialized in start()) ──
        self.kite = None
        self.fetcher = None

        # ── Strategy engines (initialized in start()) ──
        self.bias_engine = None
        self.signal_engine = None
        self.options_engine = None

        # ── Candle buffers for streaming indicator calculation ──
        # maxlen=2000: The maximum lookback used by any indicator is ~200 candles.
        # 2000 provides 10x safety margin and handles multi-day data.
        self.buf_entry = CandleBuffer(2000)
        self.buf_bias = CandleBuffer(2000)

        # ── Position tracking ──
        self.open_positions = []  # List[SimulatedPosition]
        self.closed_trades = []   # List[Trade]

        # ── Daily tracking ──
        self.daily_pnl = 0
        self.daily_start_capital = self.starting_capital
        self.daily_trade_count = 0
        self.today = None

        # ── Current bias (for change detection) ──
        self._last_bias_direction = "NEUTRAL"

        # ── Session control ──
        self._running = False

        # ── Connection state ──
        # _connected tracks whether the Kite API is reachable.
        # _last_connect_attempt tracks when we last tried to connect
        # so we can retry periodically without hammering the API.
        self._connected = False
        self._last_connect_attempt = 0

        # ── Reconnect interval (seconds) ──
        self._reconnect_interval = self._config.get("RECONNECT_INTERVAL_SECONDS", 60)

        # ── Kite API interval mapping ──
        # Maps our internal TF notation ("15m") to Kite API strings ("15minute")
        self._kite_interval_map = {
            "1m": "minute", "3m": "3minute", "5m": "5minute",
            "15m": "15minute", "60m": "60minute",
        }

        # ── Entry TF in minutes ──
        # Used for time-exit calculations and candle-to-time conversions.
        self._entry_tf_minutes = int(self.entry_tf.replace("m", ""))

        # BUG FIX #6: Calculate max candles based on trading hours
        # Indian market has 6.25 trading hours = 375 minutes.
        # For 15m TF: 375/15 = 25 candles per day
        # For 5m TF:  375/5  = 75 candles per day
        # For 60m TF: 375/60 = 6 candles per day
        # OLD CODE: pos.held >= 24 * (15 // self._entry_tf_minutes)
        #   This gave 0 for 60m TF (15//60=0), causing instant time exit!
        # NEW CODE: uses max_trade_hours converted to candle count
        self._max_candles = max(1, int(self.max_trade_hours * 60 / self._entry_tf_minutes))

        log.info("PaperTrader initialized | Capital=₹%s | Risk=%s%% | MaxPos=%s | TF=%sx%s | Index=%s",
                 f"{self.starting_capital:,}", self.daily_risk_pct,
                 self.max_open_positions, self.entry_tf, self.bias_tf,
                 self.trade_index)

    # ══════════════════════════════════════════════════════════════════
    # PUBLIC API
    # ══════════════════════════════════════════════════════════════════

    def start(self):
        """
        Start the paper trading session.

        This method:
        1. Connects to the Kite API
        2. Initializes strategy engines
        3. Preloads historical data for warmup (BUG FIX #8)
        4. Loads any previous session state
        5. Enters the main trading loop

        RESILIENCE: If the Kite API connection fails (e.g. expired token),
        the engine does NOT crash. Instead, it sets _connected = False and
        enters the main loop in a "disconnected" state. The main loop will
        periodically attempt to reconnect every _reconnect_interval seconds.

        The loop runs continuously during market hours, checking for new
        candles and processing them through the strategy pipeline.

        Press Ctrl+C to stop gracefully.
        """
        # Try to connect to the API — but don't crash if it fails.
        # The main loop will retry periodically.
        try:
            connected = self._connect_api()
        except Exception as e:
            log.error("API connection failed on start: %s", e, exc_info=True)
            connected = False

        if connected:
            self._init_engines()
            self._warmup()  # BUG FIX #8: Preload historical data
            self._load_state()
            self._refresh_vix()  # Fetch current VIX value
        else:
            # Initialize engines anyway so get_status() doesn't crash
            # and we can still report the "disconnected" state.
            self._init_engines()
            self._load_state()
            self._notify("⚠ API connection FAILED — engine running in DISCONNECTED state")
            self._notify("  The engine will retry connecting every "
                         f"{self._reconnect_interval}s in the main loop.")
            self._notify("  Fix the token and the engine will auto-reconnect.")

        self._running = True
        self._notify("=" * 65)
        self._notify("DDLJ v9.1 PAPER TRADING — SESSION STARTED")
        self._notify("=" * 65)
        self._notify(f"Capital: ₹{self.current_capital:,.0f} | "
                     f"Peak: ₹{self.peak_capital:,.0f} | "
                     f"Risk: {self.daily_risk_pct}%/day | "
                     f"Max Pos: {self.max_open_positions}")
        self._notify(f"Index: {self.trade_index} | "
                     f"Entry: {self.entry_tf} | Bias: {self.bias_tf}")
        self._notify(f"DD Breaker: {self.dd_circuit_breaker:.0%} | "
                     f"Floor: {self.capital_floor_pct:.0%} | "
                     f"Max Candles: {self._max_candles}")
        self._notify(f"Connected: {self._connected} | "
                     f"Live VIX: {self._live_vix or 'N/A'} | "
                     f"Open positions from previous session: {len(self.open_positions)}")
        self._notify("Press Ctrl+C to stop gracefully")
        self._notify("=" * 65)

        try:
            self._main_loop()
        except KeyboardInterrupt:
            self._notify("\nCtrl+C received — shutting down gracefully...")
            self._graceful_shutdown()
        except Exception as e:
            log.error("Unexpected error: %s", e, exc_info=True)
            self._notify(f"ERROR: {e}")
            self._graceful_shutdown()

    def stop(self):
        """Stop the paper trader gracefully."""
        self._running = False

    def get_status(self) -> dict:
        """
        Return current status as a dictionary.

        Returns:
            dict: Current trading status including positions, P&L, bias,
                  and connection state.
        """
        return {
            "running": self._running,
            "connected": self._connected,
            "capital": round(self.current_capital, 2),
            "peak_capital": round(self.peak_capital, 2),
            "daily_pnl": round(self.daily_pnl, 2),
            "daily_trade_count": self.daily_trade_count,
            "open_positions": len(self.open_positions),
            "total_closed_trades": len(self.closed_trades),
            "last_bias": self._last_bias_direction,
            "index": self.trade_index,
            "entry_tf": self.entry_tf,
            "bias_tf": self.bias_tf,
            "live_vix": self._live_vix,
        }

    # ══════════════════════════════════════════════════════════════════
    # CONNECTION & INITIALIZATION
    # ══════════════════════════════════════════════════════════════════

    def _connect_api(self) -> bool:
        """
        Connect to Kite API and initialize data fetcher.

        Returns:
            bool: True if connection succeeded, False otherwise.

        RESILIENCE: On failure, this method does NOT raise an exception.
        Instead, it returns False and sets self._connected = False.
        The caller (start() or _main_loop()) can then decide what to do.
        On success, sets self._connected = True and returns True.
        """
        self._last_connect_attempt = time.time()
        self._notify("Connecting to Kite API...")
        try:
            self.kite = get_kite_session()
            self.fetcher = KiteDataFetcher(
                self._config["KITE_API_KEY"],
                self.kite.access_token,
                rate_limit_delay=0.35
            )
            profile = self.kite.profile()
            self._notify(f"Connected as {profile.get('user_name', 'unknown')}")
            self._connected = True
            return True
        except Exception as e:
            self._notify(f"API connection failed: {e}")
            self._notify("Run token_manager.exchange_request_token('YOUR_TOKEN') first")
            self._connected = False
            return False

    def _init_engines(self):
        """Initialize the three strategy engines."""
        self.bias_engine = BiasEngine(
            ema_period=self._config["BIAS_EMA_PERIOD"],
            atr_period=self._config["BIAS_ATR_PERIOD"],
            structure_lookback=self._config["BIAS_STRUCTURE_LOOKBACK"],
        )
        self.signal_engine = EMACrossSignal(
            ema_period=self._config["SIGNAL_EMA_PERIOD"],
            atr_period=self._config["SIGNAL_ATR_PERIOD"],
            sl_atr=self._config["SL_ATR_MULTIPLIER"],
            min_rr=self._config["MIN_RISK_REWARD_RATIO"],
            min_target_atr=self._config["MIN_TARGET_ATR"],
            min_body_atr=self._config["MIN_BODY_ATR"],
            ema_buffer=self._config["EMA_BUFFER_ATR"],
        )
        self.options_engine = OptionsMimicryEngine(
            index_name=self.trade_index,
            moneyness=self._config["OPTION_MONEYNESS"],
            spread_regime=self._config["SPREAD_REGIME"],
            capital=self.current_capital,
        )
        self._notify(f"Engines ready | Bias={self._config['BIAS_EMA_PERIOD']}EMA | "
                     f"Signal={self._config['SIGNAL_EMA_PERIOD']}EMA | "
                     f"SL={self._config['SL_ATR_MULTIPLIER']}xATR | "
                     f"RR={self._config['MIN_RISK_REWARD_RATIO']} | "
                     f"Option={self._config['OPTION_MONEYNESS']}")

    def _warmup(self):
        """
        Preload historical data to warm up indicators.

        BUG FIX #8: Previously, the paper trader started with EMPTY candle
        buffers. This meant:
        - No bias could be calculated (need ~20 candles minimum)
        - No signals could be generated (need ~20 candles minimum)
        - On a 15m TF, it takes ~5 hours (25 candles) to get the first signal!
        - On a 60m bias TF, it takes ~3 days!

        Now we preload `warmup_days` of historical data at startup.
        With 30 days of data, both buffers are immediately warm.
        """
        self._notify(f"Warming up indicators with {self.warmup_days} days of historical data...")

        try:
            end = date.today()
            start = end - timedelta(days=self.warmup_days)

            # Fetch entry timeframe candles
            entry_interval = self._kite_interval_map.get(self.entry_tf, "15minute")
            self._notify(f"  Fetching {self.entry_tf} candles: {start} to {end}...")
            raw_entry = self.fetcher.fetch_candles_chunked(
                self.index_token, start, end, entry_interval
            )
            candles_entry = parse_candles(raw_entry, self.trade_index, self.entry_tf)
            self._notify(f"  Got {len(candles_entry)} {self.entry_tf} candles")

            # Build bias timeframe candles from entry candles
            if self.bias_tf != self.entry_tf:
                candles_bias = build_htf_from_ltf(candles_entry, self.bias_tf)
                self._notify(f"  Built {len(candles_bias)} {self.bias_tf} candles from {self.entry_tf}")
            else:
                candles_bias = candles_entry

            # Push all historical candles into buffers
            for c in candles_entry:
                self.buf_entry.push(c)
            for c in candles_bias:
                self.buf_bias.push(c)

            # Test that indicators are ready
            bias = self.bias_engine.evaluate(self.buf_bias)
            self._notify(f"  Warmup complete | Bias={bias.direction} | "
                         f"Entry buffer={len(self.buf_entry._buf)} | "
                         f"Bias buffer={len(self.buf_bias._buf)}")

        except Exception as e:
            log.warning("Warmup failed: %s — will warm up naturally during trading", e)
            self._notify(f"  Warmup failed: {e} — indicators will warm up during trading")

    def _refresh_vix(self):
        """
        Fetch the current India VIX value from the Kite API.

        WHY: The static VIX JSON file in data/ may not have today's value.
        For live trading, we need the CURRENT VIX to estimate IV accurately.
        This is called periodically (every vix_refresh_seconds).
        """
        try:
            vix_token = self._config.get("VIX_TOKEN", 264969)
            raw_vix = self.fetcher.fetch_candles_chunked(
                vix_token,
                date.today() - timedelta(days=5),
                date.today(),
                "day"
            )
            if raw_vix:
                last = raw_vix[-1]
                self._live_vix = float(last["close"])
                log.info("Live VIX refreshed: %.2f", self._live_vix)

                # Also update the options engine's VIX data with today's value
                today_str = date.today().isoformat()
                from .options_engine import VIX_DATA
                VIX_DATA[today_str] = self._live_vix

        except Exception as e:
            log.warning("VIX refresh failed: %s", e)

    # ══════════════════════════════════════════════════════════════════
    # MAIN TRADING LOOP
    # ══════════════════════════════════════════════════════════════════

    def _main_loop(self):
        """
        Main trading loop. Runs continuously during market hours.

        Every poll_interval seconds, it:
        1. Checks if we're within market hours
        2. If disconnected, attempts to reconnect periodically
        3. Fetches the latest candle data
        4. Processes new candles through the strategy
        5. Manages open positions (exits, trailing stops)
        6. Periodically refreshes VIX data
        7. Saves state periodically

        RESILIENCE: If _connected is False, the loop skips candle fetching
        and strategy processing, and instead tries to reconnect every
        _reconnect_interval seconds (default 60s). Once reconnected, it
        performs warmup and resumes normal operation.
        """
        last_candle_time_entry = None
        last_candle_time_bias = None
        last_save_time = 0
        last_vix_refresh = 0

        while self._running:
            try:
                now = datetime.now(IST)
                current_time = now.time()
                today = now.date()

                # ── DISCONNECTED: Try to reconnect periodically ──
                if not self._connected:
                    elapsed = time.time() - self._last_connect_attempt
                    if elapsed >= self._reconnect_interval:
                        log.info("Disconnected — attempting reconnect "
                                 "(last attempt %.0fs ago)...", elapsed)
                        try:
                            reconnected = self._connect_api()
                        except Exception as e:
                            log.error("Reconnect attempt failed: %s", e)
                            reconnected = False

                        if reconnected:
                            self._notify("✓ Reconnected to Kite API — resuming trading")
                            # Re-initialize engines and warmup since we now have API access
                            self._warmup()
                            self._refresh_vix()
                        else:
                            self._notify(
                                f"⚠ Reconnect failed — will retry in "
                                f"{self._reconnect_interval}s"
                            )

                    # While disconnected, still do day resets and state saves
                    # so we don't lose track of time/positions.
                    if self.today != today:
                        if self.today is not None:
                            self._notify(
                                f"Day {self.today} Summary: "
                                f"P&L=₹{self.daily_pnl:,.0f} | "
                                f"Trades={self.daily_trade_count} | "
                                f"Capital=₹{self.current_capital:,.0f}"
                            )
                        self.today = today
                        self.daily_pnl = 0
                        self.daily_start_capital = self.current_capital
                        self.daily_trade_count = 0
                        self._notify(f"New trading day: {today} (disconnected)")

                    # Periodic state save even when disconnected
                    if time.time() - last_save_time > 60:
                        self._save_state()
                        last_save_time = time.time()

                    # Wait before next check (use longer interval when disconnected)
                    time.sleep(min(self._reconnect_interval, self.poll_interval * 10))
                    continue

                # ── NEW DAY RESET ──
                if self.today != today:
                    if self.today is not None:
                        # Log previous day's summary
                        self._notify(
                            f"Day {self.today} Summary: "
                            f"P&L=₹{self.daily_pnl:,.0f} | "
                            f"Trades={self.daily_trade_count} | "
                            f"Capital=₹{self.current_capital:,.0f}"
                        )
                    self.today = today
                    self.daily_pnl = 0
                    self.daily_start_capital = self.current_capital
                    self.daily_trade_count = 0
                    self._notify(f"New trading day: {today}")

                # ── MARKET HOURS CHECK ──
                if current_time < self.MARKET_OPEN:
                    # Pre-market — wait
                    time.sleep(self.poll_interval)
                    continue

                if current_time >= self.MARKET_CLOSE:
                    # After market — close positions if any, then wait
                    if self.open_positions:
                        self._force_close_all("POST_MARKET")
                    self._save_state()
                    self._notify("Market closed. Session paused until next market day.")
                    time.sleep(60)
                    continue

                # ── FETCH LATEST CANDLES ──
                entry_interval = self._kite_interval_map.get(self.entry_tf, "15minute")
                bias_interval = self._kite_interval_map.get(self.bias_tf, "60minute")

                # Fetch entry timeframe candle
                try:
                    entry_candle = self._fetch_latest_candle(
                        self.index_token, entry_interval
                    )
                except Exception as e:
                    log.warning("Failed to fetch entry candle: %s", e)
                    entry_candle = None
                    # If the fetch fails with an auth error, mark as disconnected
                    if "token" in str(e).lower() or "auth" in str(e).lower():
                        log.warning("API auth error detected — marking as disconnected")
                        self._connected = False

                # BUG FIX #9: Fetch bias candle INDEPENDENTLY
                # Old code only pushed bias candle when a new entry candle arrived.
                # This meant if a 60m bias candle completed between 15m candles,
                # it was missed. Now we always check for new bias candles.
                try:
                    bias_candle = self._fetch_latest_candle(
                        self.index_token, bias_interval
                    )
                except Exception as e:
                    log.warning("Failed to fetch bias candle: %s", e)
                    bias_candle = None
                    if "token" in str(e).lower() or "auth" in str(e).lower():
                        log.warning("API auth error detected — marking as disconnected")
                        self._connected = False

                # ── PROCESS BIAS CANDLE INDEPENDENTLY (BUG FIX #9) ──
                if bias_candle:
                    bias_key = (bias_candle.ts.date(), bias_candle.ts.hour,
                                bias_candle.ts.minute)
                    if bias_key != last_candle_time_bias:
                        last_candle_time_bias = bias_key
                        self.buf_bias.push(bias_candle)
                        log.debug("New bias candle: %s %s close=%.2f",
                                  bias_candle.ts, self.bias_tf, bias_candle.close)

                # ── PROCESS ENTRY CANDLE ──
                if entry_candle:
                    candle_key = (entry_candle.ts.date(), entry_candle.ts.hour,
                                  entry_candle.ts.minute)
                    if candle_key != last_candle_time_entry:
                        last_candle_time_entry = candle_key
                        self.buf_entry.push(entry_candle)
                        log.debug("New entry candle: %s %s close=%.2f",
                                  entry_candle.ts, self.entry_tf, entry_candle.close)

                        # Process the candle through strategy
                        self._on_new_candle(entry_candle)

                # ── PERIODIC VIX REFRESH ──
                if time.time() - last_vix_refresh > self.vix_refresh_seconds:
                    self._refresh_vix()
                    last_vix_refresh = time.time()

                # ── PERIODIC STATE SAVE ──
                if time.time() - last_save_time > 60:  # Save every minute
                    self._save_state()
                    last_save_time = time.time()

                # ── WAIT FOR NEXT POLL ──
                time.sleep(self.poll_interval)

            except Exception as e:
                log.error("Error in main loop: %s", e, exc_info=True)
                time.sleep(self.poll_interval * 2)  # Back off on error

    def _fetch_latest_candle(self, instrument_token, interval):
        """
        Fetch the latest completed candle from Kite API.

        Args:
            instrument_token (int): Kite instrument token.
            interval (str): Kite API interval string (e.g., "15minute").

        Returns:
            Candle | None: The latest candle, or None if fetch failed.
        """
        try:
            # Fetch the last 2 days of data to ensure we get the latest candle
            to_date = date.today()
            from_date = to_date - timedelta(days=2)
            raw = self.fetcher.fetch_candles_chunked(
                instrument_token, from_date, to_date, interval
            )
            if not raw:
                return None

            # Parse and return the last candle
            candles = []
            for d in raw[-5:]:  # Only parse last 5 to save time
                ts = d.get("date", "")
                if isinstance(ts, str):
                    try:
                        ts = datetime.fromisoformat(ts)
                        if ts.tzinfo is None:
                            ts = IST.localize(ts)
                    except (ValueError, TypeError):
                        continue
                elif isinstance(ts, datetime):
                    if ts.tzinfo is None:
                        ts = IST.localize(ts)
                else:
                    continue

                tf = interval.replace("minute", "m").replace("3m", "3m")
                candles.append(Candle(
                    self.trade_index, ts,
                    float(d["open"]), float(d["high"]),
                    float(d["low"]), float(d["close"]),
                    float(d["volume"]), tf
                ))

            return candles[-1] if candles else None

        except Exception as e:
            log.warning("Fetch candle failed: %s", e)
            return None

    # ══════════════════════════════════════════════════════════════════
    # STRATEGY PROCESSING
    # ══════════════════════════════════════════════════════════════════

    def _on_new_candle(self, candle):
        """
        Process a new candle through the full strategy pipeline.

        This is called every time a new completed candle arrives.
        It runs the same logic as the backtester, but in real-time.

        Steps:
        1. Check exit conditions for all open positions
        2. Process any closed positions
        3. Check risk limits
        4. Generate new signal
        5. If signal valid, simulate entry

        Args:
            candle (Candle): The new completed candle on the entry timeframe.
        """
        ct = candle.ts.time()
        today = candle.ts.date()

        # ── STEP 1: EVALUATE BIAS ──
        bias = self.bias_engine.evaluate(self.buf_bias)

        # BUG FIX #11: Notify on ALL bias changes (was skipping NEUTRAL→BULLISH)
        # Old code: only notified if _last_bias_direction != "NEUTRAL"
        # This meant you'd miss the important NEUTRAL → BULLISH transition
        # (the moment the market picks a direction after being undecided).
        # Now: notify on any direction change except the very first "NEUTRAL".
        if bias.direction != self._last_bias_direction:
            if self.notify_on_bias_change and self._last_bias_direction is not None:
                self._notify(
                    f"Bias changed: {self._last_bias_direction} -> {bias.direction} "
                    f"({bias.reason})"
                )
            self._last_bias_direction = bias.direction

        # ── STEP 2: MONITOR OPEN POSITIONS ──
        closed_positions = []
        for pos in self.open_positions:
            pos.held += 1
            action = "HOLD"
            price = 0

            if pos.direction == "LONG":
                action, price = self._check_long_exit(pos, candle, ct, bias)
            else:
                action, price = self._check_short_exit(pos, candle, ct, bias)

            if action != "HOLD":
                closed_positions.append((pos, action, price if price > 0 else candle.close))

        # ── STEP 3: PROCESS CLOSED POSITIONS ──
        for pos, action, ep in closed_positions:
            self._simulate_exit(pos, action, ep, candle)
            self.open_positions.remove(pos)

        # ── STEP 4: CHECK RISK LIMITS ──
        if not self._check_risk_limits(ct):
            return  # Can't trade — risk limit reached or outside hours

        # ── STEP 5: GENERATE SIGNAL ──
        sig = self.signal_engine.evaluate(self.buf_entry, bias)

        if sig.signal in ("LONG", "SHORT"):
            # Daily trade count check (respects toggle)
            if self.max_daily_trades_enabled and self.daily_trade_count >= self.max_daily_trades:
                return

            # BUG FIX #14: Capital floor uses config (was hardcoded 0.20)
            if self.current_capital < self.starting_capital * self.capital_floor_pct:
                log.info("Below capital floor (%.0f%%) — no new entries",
                         self.capital_floor_pct * 100)
                return

            # BUG FIX #12: Per-position risk check (was not implemented)
            # If RISK_PER_POSITION_PCT is set, verify this trade's risk
            # doesn't exceed the allowed percentage of capital.
            if self.risk_per_position_pct is not None:
                max_risk_amount = self.current_capital * self.risk_per_position_pct / 100
                # Estimate trade risk from signal (risk in points * estimated lot size)
                # This is a pre-check; the actual check happens after options pricing
                # Use actual lot_size from options_engine (30 for BANKNIFTY, 65 for NIFTY)
                lot_size = getattr(self.options_engine, 'lot_size', 30) if self.options_engine else 30
                if sig.risk * lot_size > max_risk_amount:  # Estimate with 1 lot at correct lot size
                    log.info("Skipping entry — per-position risk limit: "
                             "risk=%.0f > max=%.0f (%.1f%% of capital, lot_size=%d)",
                             sig.risk * lot_size, max_risk_amount, self.risk_per_position_pct, lot_size)
                    return

            # Simulate the entry
            self._simulate_entry(sig, candle, bias)

    def _check_long_exit(self, pos, candle, ct, bias):
        """
        Check exit conditions for a LONG position. Returns (action, price).

        Exit priority (checked in order):
        1. Stop Loss hit → exit at SL price
        2. Target hit → exit at target price
        3. Near Target → exit at close (lock in profits)
        4. End-of-Day → force close
        5. Bias Flip → exit if bias turns against us
        6. Time Exit → too many candles held
        7. Position Management → trailing stop, breakeven
        """
        # 1. Stop Loss
        if candle.low <= pos.sl:
            return "SL", pos.sl

        # 2. Target
        if candle.high >= pos.target:
            return "TARGET", pos.target

        # BUG FIX #10: Near Target threshold scaled by ATR (was hardcoded 3)
        # OLD: candle.high >= pos.target - 3
        # For BankNifty at 56,000 with ATR=265, "3 points" is meaningless.
        # NEW: pos.target - near_target_atr * ATR
        # With near_target_atr=0.01 and ATR=265: threshold = 2.65 points
        # With near_target_atr=0.02 and ATR=265: threshold = 5.3 points
        near_tgt_threshold = self.near_target_atr * pos.atr_at_entry
        if candle.high >= pos.target - near_tgt_threshold and candle.close > pos.entry:
            return "NEAR_TGT", candle.close

        # 4. End-of-Day
        if ct >= self.force_close_time:
            return "EOD", candle.close

        # BUG FIX #15: Bias flip min held uses config (was hardcoded 6)
        # 5. Bias Flip — if bias turns bearish, exit the long
        if bias.direction == "BEARISH" and pos.held > self.bias_flip_min_held:
            return "BIAS_FLIP", candle.close

        # BUG FIX #6: Time exit uses proper max_candles calculation
        # OLD: pos.held >= 24 * (15 // self._entry_tf_minutes) → 0 for 60m TF!
        # NEW: pos.held >= self._max_candles → proper calculation
        # 6. Time Exit
        if pos.held >= self._max_candles:
            return "TIME", candle.close

        # ── Position Management (no exit, just adjust stop loss) ──
        # BUG FIX #15: Uses config parameters for BE trigger and trail frequency

        # Breakeven trigger: move SL to entry when profit >= BE_TRIGGER_RISK_MULT * risk
        if not pos.be_done:
            profit = candle.high - pos.entry
            if profit >= pos.risk * self.be_trigger_risk_mult:
                pos.sl = pos.entry + 1  # +1 buffer to account for slippage
                pos.be_done = True
                log.debug("LONG BE triggered: SL moved to %.2f", pos.sl)

        # Trailing stop: every N candles, move SL up to recent swing low
        elif self.trailing_stop_enabled and pos.held % self.trail_every_n_candles == 0:
            sl_cand = self.buf_entry.last(15)
            new_sl = swing_low(sl_cand, 15)
            if new_sl and new_sl > pos.sl:
                pos.sl = round(new_sl - 0.5, 2)  # 0.5 buffer below swing low
                log.debug("LONG trailing SL: moved to %.2f", pos.sl)

        return "HOLD", 0

    def _check_short_exit(self, pos, candle, ct, bias):
        """
        Check exit conditions for a SHORT position. Returns (action, price).

        Exit priority (checked in order):
        1. Stop Loss hit → exit at SL price
        2. Target hit → exit at target price
        3. Near Target → exit at close (lock in profits)
        4. End-of-Day → force close
        5. Bias Flip → exit if bias turns against us
        6. Time Exit → too many candles held
        7. Position Management → trailing stop, breakeven
        """
        # 1. Stop Loss
        if candle.high >= pos.sl:
            return "SL", pos.sl

        # 2. Target
        if candle.low <= pos.target:
            return "TARGET", pos.target

        # BUG FIX #10: Near Target threshold scaled by ATR
        near_tgt_threshold = self.near_target_atr * pos.atr_at_entry
        if candle.low <= pos.target + near_tgt_threshold and candle.close < pos.entry:
            return "NEAR_TGT", candle.close

        # 4. End-of-Day
        if ct >= self.force_close_time:
            return "EOD", candle.close

        # 5. Bias Flip — if bias turns bullish, exit the short
        if bias.direction == "BULLISH" and pos.held > self.bias_flip_min_held:
            return "BIAS_FLIP", candle.close

        # 6. Time Exit
        if pos.held >= self._max_candles:
            return "TIME", candle.close

        # ── Position Management ──
        if not pos.be_done:
            profit = pos.entry - candle.low
            if profit >= pos.risk * self.be_trigger_risk_mult:
                pos.sl = pos.entry - 1
                pos.be_done = True
                log.debug("SHORT BE triggered: SL moved to %.2f", pos.sl)

        elif self.trailing_stop_enabled and pos.held % self.trail_every_n_candles == 0:
            sl_cand = self.buf_entry.last(15)
            new_sl = swing_high(sl_cand, 15)
            if new_sl and new_sl < pos.sl:
                pos.sl = round(new_sl + 0.5, 2)
                log.debug("SHORT trailing SL: moved to %.2f", pos.sl)

        return "HOLD", 0

    def _check_risk_limits(self, ct) -> bool:
        """
        Check if we're allowed to take new trades.

        Returns:
            bool: True if we can trade, False if not.
        """
        # Time window — no trades outside allowed hours
        if ct < self.no_trade_end or ct >= self.entry_cutoff:
            return False

        # Max positions — can't open more than allowed
        if len(self.open_positions) >= self.max_open_positions:
            return False

        # Daily risk limit — sum all unrealized losses (BUG FIX #1 from v9.0)
        realized_loss = min(self.daily_pnl, 0)
        unrealized_loss = 0
        for pos in self.open_positions:
            if pos.opt_entry:
                # Options: worst case is losing the entire premium paid
                worst_case = -pos.opt_entry["fill_price"] * pos.opt_entry["lots"] * pos.opt_entry["lot_size"]
            else:
                # Futures: worst case based on SL distance
                if pos.direction == "LONG":
                    worst_case = (pos.sl - pos.entry) * pos.qty
                else:
                    worst_case = (pos.entry - pos.sl) * pos.qty
            unrealized_loss += worst_case

        total_day_risk = realized_loss + unrealized_loss
        daily_risk_limit = self.daily_start_capital * self.daily_risk_pct / 100

        if total_day_risk < -daily_risk_limit:
            if self.notify_on_daily_limit:
                self._notify(f"Daily risk limit reached! "
                           f"Risk=₹{abs(total_day_risk):,.0f} > Limit=₹{daily_risk_limit:,.0f}")
            return False

        return True

    # ══════════════════════════════════════════════════════════════════
    # ORDER SIMULATION
    # ══════════════════════════════════════════════════════════════════

    def _simulate_entry(self, signal, candle, bias):
        """
        Simulate placing an entry order.

        This records what WOULD have happened if we placed a real order.
        No actual order is sent to the exchange.

        Args:
            signal (Signal): The entry signal from the Signal Engine.
            candle (Candle): The current candle when the signal was generated.
            bias (HTFBias): The current market bias.
        """
        # BUG FIX #7: Use monthly expiry for DTE (was weekly Thursday)
        dte = estimate_dte_monthly(candle.ts)

        # BUG FIX #13: Drawdown circuit breaker uses config (was hardcoded 0.80)
        # When drawdown exceeds the threshold, we reduce position sizes
        # by multiplying capital by the drawdown ratio. This makes the
        # strategy "slow down" when losing, instead of going full speed.
        #
        # Example: If peak=60K, current=48K (20% DD), dd_ratio=0.80
        #   With breaker at 0.80: effective_capital = 48K * 0.80 = 38.4K
        #   This means we trade smaller lots to protect remaining capital.
        effective_capital = self.current_capital
        dd_ratio = self.current_capital / self.peak_capital if self.peak_capital > 0 else 1
        if dd_ratio < self.dd_circuit_breaker:
            effective_capital = self.current_capital * dd_ratio
            log.info("DD circuit breaker active: dd_ratio=%.2f, effective_capital=₹%s",
                     dd_ratio, f"{effective_capital:,.0f}")

        # Model the options entry
        self.options_engine.capital = effective_capital
        opt_entry = self.options_engine.model_entry(
            signal.entry, signal.direction, signal.atr_val, dte,
            candle.ts, candle.ts.time()
        )

        # BUG FIX #12: Per-position risk check (was not implemented)
        # After options pricing, verify the actual risk doesn't exceed
        # the per-position limit if RISK_PER_POSITION_PCT is set.
        if self.risk_per_position_pct is not None:
            max_risk_amount = self.current_capital * self.risk_per_position_pct / 100
            trade_risk = opt_entry["fill_price"] * opt_entry["lots"] * opt_entry["lot_size"]
            if trade_risk > max_risk_amount:
                log.info("Skipping entry — per-position risk: "
                         "trade_risk=₹%.0f > max=₹%.0f (%.1f%% of capital)",
                         trade_risk, max_risk_amount, self.risk_per_position_pct)
                return

        # Capital check: worst-case loss on this + existing positions
        worst_case_new = opt_entry["fill_price"] * opt_entry["lots"] * opt_entry["lot_size"]
        existing_worst = sum(
            p.opt_entry["fill_price"] * p.opt_entry["lots"] * p.opt_entry["lot_size"]
            for p in self.open_positions if p.opt_entry
        )
        if worst_case_new + existing_worst > self.current_capital:
            log.info("Skipping entry — capital insufficient for worst case")
            return

        # Create simulated position
        actual_qty = opt_entry["lots"] * opt_entry["lot_size"]
        pos = SimulatedPosition(
            symbol=self.trade_index,
            direction=signal.direction,
            entry=signal.entry,
            entry_time=candle.ts.isoformat(),
            qty=actual_qty,
            sl=signal.sl,
            target=signal.target,
            rr=signal.rr,
            risk=signal.risk,
            reward=signal.reward,
            held=0,
            be_done=False,
            atr_at_entry=signal.atr_val,
            opt_entry=opt_entry,
            original_sl=signal.sl,
        )
        self.open_positions.append(pos)
        self.daily_trade_count += 1

        # Notify
        if self.notify_on_trade:
            self._notify(
                f"ENTRY: {signal.direction} {self.trade_index} "
                f"@ {signal.entry:,.0f} | "
                f"SL={signal.sl:,.0f} TGT={signal.target:,.0f} "
                f"RR={signal.rr:.2f}"
            )
            self._notify(
                f"ORDER: BUY {opt_entry['lots']} lot "
                f"{opt_entry['strike']} {opt_entry['option_type']} "
                f"@ ₹{opt_entry['fill_price']:.2f} (simulated)"
            )

    def _simulate_exit(self, pos, exit_reason, exit_price, candle):
        """
        Simulate closing a position and calculate P&L.

        Args:
            pos (SimulatedPosition): The position being closed.
            exit_reason (str): Why the position is being closed.
            exit_price (float): The exit price of the underlying.
            candle (Candle): The current candle at exit time.
        """
        # BUG FIX #7: Use monthly expiry for DTE
        dte = estimate_dte_monthly(candle.ts)

        # Model options exit
        self.options_engine.capital = self.current_capital
        opt_exit = self.options_engine.model_exit(
            pos.opt_entry, exit_price, pos.atr_at_entry, dte,
            candle.ts, candle.ts.time(), pos.held, self._entry_tf_minutes
        )

        # Calculate P&L
        gross = opt_exit.net_pnl
        costs, bd = calc_costs_options(
            pos.opt_entry["fill_price"], opt_exit.exit_premium,
            self.options_engine.lot_size, pos.opt_entry["lots"]
        )
        net = gross - costs

        # Create Trade record
        trade = Trade(
            symbol=pos.symbol,
            direction=pos.direction,
            entry=pos.entry,
            exit=exit_price,
            entry_time=datetime.fromisoformat(pos.entry_time) if isinstance(pos.entry_time, str) else pos.entry_time,
            exit_time=candle.ts,
            sl=pos.sl,
            target=pos.target,
            qty=pos.qty,
            gross=round(gross, 2),
            costs=round(costs, 2),
            net=round(net, 2),
            exit_reason=exit_reason,
            rr=pos.rr,
            risk=pos.risk,
            reward=pos.reward,
            held=pos.held,
            is_fut=False,
            cost_bd=bd,
            option_strike=opt_exit.strike,
            option_type=opt_exit.option_type,
            option_entry_premium=opt_exit.entry_premium,
            option_exit_premium=opt_exit.exit_premium,
            option_delta=opt_exit.delta,
            option_iv_entry=opt_exit.iv_entry,
            option_iv_exit=opt_exit.iv_exit,
            option_spread_cost=round(opt_exit.spread_entry + opt_exit.spread_exit, 2),
            mode="options",
        )

        self.closed_trades.append(trade)
        self.current_capital += net
        self.daily_pnl += net

        # Update peak capital
        if self.current_capital > self.peak_capital:
            self.peak_capital = self.current_capital

        # Log the trade
        self._log_trade(trade)

        # Notify
        pnl_sign = "+" if net > 0 else ""
        if self.notify_on_trade:
            self._notify(
                f"EXIT: {exit_reason} | "
                f"{pos.direction} {pos.symbol} | "
                f"P&L=₹{pnl_sign}{net:,.0f} (gross=₹{gross:,.0f} costs=₹{costs:,.0f})"
            )

    def _force_close_all(self, reason="EOD"):
        """
        Close all open positions at current market price.

        If we can't fetch the current price, we retry once. If that also
        fails, we keep the positions open (they'll be closed on the next
        cycle when price data becomes available).
        """
        if not self.open_positions:
            return

        self._notify(f"Force closing {len(self.open_positions)} positions ({reason})")

        # Fetch current candle for exit price
        try:
            entry_interval = self._kite_interval_map.get(self.entry_tf, "15minute")
            latest = self._fetch_latest_candle(self.index_token, entry_interval)
        except Exception:
            latest = None

        if latest is None:
            self._notify("Cannot fetch price for force close — will retry next cycle")
            return

        for pos in list(self.open_positions):
            self._simulate_exit(pos, reason, latest.close, latest)
            self.open_positions.remove(pos)

    # ══════════════════════════════════════════════════════════════════
    # STATE PERSISTENCE
    # ══════════════════════════════════════════════════════════════════

    def _save_state(self):
        """
        Save current session state to JSON for resume after restart.

        If the script crashes or you stop it, this state allows a clean
        restart with positions, capital, and daily stats intact.
        """
        state = {
            "current_capital": self.current_capital,
            "peak_capital": self.peak_capital,
            "daily_pnl": self.daily_pnl,
            "daily_start_capital": self.daily_start_capital,
            "daily_trade_count": self.daily_trade_count,
            "today": str(self.today) if self.today else None,
            "last_bias_direction": self._last_bias_direction,
            "open_positions": [
                {
                    "symbol": p.symbol,
                    "direction": p.direction,
                    "entry": p.entry,
                    "entry_time": p.entry_time,
                    "qty": p.qty,
                    "sl": p.sl,
                    "target": p.target,
                    "rr": p.rr,
                    "risk": p.risk,
                    "reward": p.reward,
                    "held": p.held,
                    "be_done": p.be_done,
                    "atr_at_entry": p.atr_at_entry,
                    "opt_entry": p.opt_entry,
                    "original_sl": p.original_sl,
                }
                for p in self.open_positions
            ],
            "closed_trades_count": len(self.closed_trades),
            "live_vix": self._live_vix,
            "timestamp": datetime.now(IST).isoformat(),
        }

        try:
            os.makedirs(os.path.dirname(self.session_state_file), exist_ok=True)
            with open(self.session_state_file, "w") as f:
                json.dump(state, f, indent=2, default=str)
        except Exception as e:
            log.warning("Failed to save state: %s", e)

    def _load_state(self):
        """
        Load previously saved session state for resumption.

        If no state file exists, we start fresh (which is normal for the
        first run or after a deliberate reset).
        """
        if not os.path.exists(self.session_state_file):
            log.info("No previous session state found — starting fresh")
            return

        try:
            with open(self.session_state_file) as f:
                state = json.load(f)

            self.current_capital = state.get("current_capital", self.starting_capital)
            self.peak_capital = state.get("peak_capital", self.starting_capital)
            self.daily_pnl = state.get("daily_pnl", 0)
            self.daily_start_capital = state.get("daily_start_capital", self.current_capital)
            self.daily_trade_count = state.get("daily_trade_count", 0)
            self._last_bias_direction = state.get("last_bias_direction", "NEUTRAL")

            # Restore open positions
            for pd in state.get("open_positions", []):
                pos = SimulatedPosition(
                    symbol=pd["symbol"],
                    direction=pd["direction"],
                    entry=pd["entry"],
                    entry_time=pd["entry_time"],
                    qty=pd["qty"],
                    sl=pd["sl"],
                    target=pd["target"],
                    rr=pd["rr"],
                    risk=pd["risk"],
                    reward=pd["reward"],
                    held=pd.get("held", 0),
                    be_done=pd.get("be_done", False),
                    atr_at_entry=pd.get("atr_at_entry", 0),
                    opt_entry=pd.get("opt_entry"),
                    original_sl=pd.get("original_sl", pd["sl"]),
                )
                self.open_positions.append(pos)

            log.info("Loaded session state: capital=₹%s, %d open positions",
                     f"{self.current_capital:,.0f}", len(self.open_positions))
        except Exception as e:
            log.warning("Failed to load session state: %s — starting fresh", e)

    # ══════════════════════════════════════════════════════════════════
    # TRADE LOGGING
    # ══════════════════════════════════════════════════════════════════

    def _log_trade(self, trade):
        """
        Log a completed trade to both JSON and CSV files.

        JSON format: Complete trade details for programmatic analysis.
        CSV format: Simplified view for Excel/Google Sheets import.

        Args:
            trade (Trade): The completed trade to log.
        """
        # ── JSON log ──
        try:
            os.makedirs(os.path.dirname(self.trade_log_file), exist_ok=True)
            trades_list = []
            if os.path.exists(self.trade_log_file):
                with open(self.trade_log_file) as f:
                    trades_list = json.load(f)

            trade_dict = {
                "symbol": trade.symbol,
                "direction": trade.direction,
                "entry": trade.entry,
                "exit": trade.exit,
                "entry_time": str(trade.entry_time),
                "exit_time": str(trade.exit_time),
                "sl": trade.sl,
                "target": trade.target,
                "qty": trade.qty,
                "gross": trade.gross,
                "costs": trade.costs,
                "net": trade.net,
                "exit_reason": trade.exit_reason,
                "rr": trade.rr,
                "held": trade.held,
                "option_strike": trade.option_strike,
                "option_type": trade.option_type,
                "option_entry_premium": trade.option_entry_premium,
                "option_exit_premium": trade.option_exit_premium,
                "option_delta": trade.option_delta,
                "option_iv_entry": trade.option_iv_entry,
                "option_iv_exit": trade.option_iv_exit,
            }
            trades_list.append(trade_dict)

            with open(self.trade_log_file, "w") as f:
                json.dump(trades_list, f, indent=2, default=str)
        except Exception as e:
            log.warning("Failed to write JSON trade log: %s", e)

        # ── CSV log ──
        try:
            os.makedirs(os.path.dirname(self.trade_log_csv), exist_ok=True)
            file_exists = os.path.exists(self.trade_log_csv)

            with open(self.trade_log_csv, "a", newline="") as f:
                writer = csv.writer(f)
                if not file_exists:
                    writer.writerow([
                        "entry_time", "exit_time", "symbol", "direction",
                        "entry", "exit", "sl", "target", "qty",
                        "gross", "costs", "net", "exit_reason", "rr", "held",
                        "strike", "option_type", "entry_premium", "exit_premium",
                        "delta", "iv_entry", "iv_exit"
                    ])
                writer.writerow([
                    trade.entry_time, trade.exit_time, trade.symbol,
                    trade.direction, trade.entry, trade.exit, trade.sl,
                    trade.target, trade.qty, trade.gross, trade.costs,
                    trade.net, trade.exit_reason, trade.rr, trade.held,
                    trade.option_strike, trade.option_type,
                    trade.option_entry_premium, trade.option_exit_premium,
                    trade.option_delta, trade.option_iv_entry,
                    trade.option_iv_exit,
                ])
        except Exception as e:
            log.warning("Failed to write CSV trade log: %s", e)

    # ══════════════════════════════════════════════════════════════════
    # NOTIFICATIONS
    # ══════════════════════════════════════════════════════════════════

    def _notify(self, msg: str):
        """
        Print a notification message to the console.

        WHY a separate method? This makes it easy to add other notification
        channels later (Telegram, email, etc.) by overriding this method.
        """
        print(msg)
