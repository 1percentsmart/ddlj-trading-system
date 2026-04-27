#!/usr/bin/env python3
"""
DDLJ v9 — Live Paper Trading Engine
=====================================

The HEART of the live paper trading system. Connects to Zerodha's Kite API
for real-time candle data, runs the DDLJ strategy logic (bias + signal +
options engines), and simulates order placement. Everything is real EXCEPT
order execution — no real money is at risk.

HOW IT WORKS:
  1. Connect to Kite API using token_manager
  2. Poll for new candles at the configured interval (default: 5 seconds)
  3. Feed each new candle through the strategy pipeline:
     a. Bias Engine → Is the market BULLISH, BEARISH, or NEUTRAL?
     b. Signal Engine → Is there a valid entry setup?
     c. Options Engine → What option should we "buy", at what price?
     d. Risk Manager → Are we within daily risk limits?
  4. If all checks pass, simulate an order (record what WOULD have happened)
  5. Manage open positions with trailing stops, breakeven, time exits
  6. Force close all positions at 3:10 PM (end-of-day rule)
  7. Log everything to JSON and CSV files
  8. Save session state for resume after restart

KEY PRINCIPLE:
  This is NOT a backtest. This runs on REAL-TIME data during market hours.
  The only difference from live trading is that orders are NOT actually sent
  to the exchange. Every other aspect (data, signals, risk management) is
  identical to what a live system would do.

Author: DDLJ Strategy Team
Version: 9.0.0 (Production — Paper Trading Ready)
"""

import os
import json
import csv
import time
import logging
from datetime import datetime, date, timedelta, time as dtime
from dataclasses import dataclass, asdict

import pytz

from .candle_data import Candle, CandleBuffer
from .indicators import swing_high, swing_low
from .cost_calculator import calc_costs_options
from .bias_engine import BiasEngine
from .signal_engine import EMACrossSignal
from .options_engine import OptionsMimicryEngine
from .trade_types import Trade
from .token_manager import get_kite_session
from .data_fetcher import KiteDataFetcher
from . import config as cfg

# Indian Standard Timezone
IST = pytz.timezone("Asia/Kolkata")
log = logging.getLogger("ddlj_v9")


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
    Live paper trading engine for the DDLJ v9 strategy.

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

    # Market hours in IST
    MARKET_OPEN = dtime(9, 15)
    MARKET_CLOSE = dtime(15, 30)

    def __init__(self, config_override=None):
        """
        Initialize the Paper Trader.

        Args:
            config_override (dict, optional): Override any config.py parameter.
                Example: {"STARTING_CAPITAL": 100000, "DAILY_RISK_PCT": 4.0}
                WHY config_override? Lets users customize without editing files.
        """
        # Apply config overrides
        self._config = {}
        for attr in dir(cfg):
            if attr.isupper():
                self._config[attr] = getattr(cfg, attr)
        if config_override:
            self._config.update(config_override)

        # Core trading parameters
        self.starting_capital = self._config["STARTING_CAPITAL"]
        self.current_capital = self.starting_capital
        self.peak_capital = self.starting_capital
        self.daily_risk_pct = self._config["DAILY_RISK_PCT"]
        self.max_open_positions = self._config["MAX_OPEN_POSITIONS"]
        self.max_daily_trades = self._config["MAX_DAILY_TRADES"]

        # Timeframe settings
        self.entry_tf = self._config["ENTRY_TIMEFRAME"]
        self.bias_tf = self._config["BIAS_TIMEFRAME"]
        self.trade_index = self._config["TRADE_INDEX"]

        # Time boundaries
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

        # Polling settings
        self.poll_interval = self._config["POLL_INTERVAL_SECONDS"]

        # Notification settings
        self.notify_on_trade = self._config["NOTIFY_ON_TRADE"]
        self.notify_on_daily_limit = self._config["NOTIFY_ON_DAILY_LIMIT"]
        self.notify_on_bias_change = self._config["NOTIFY_ON_BIAS_CHANGE"]

        # File paths
        self.trade_log_file = self._config["TRADE_LOG_FILE"]
        self.trade_log_csv = self._config["TRADE_LOG_CSV"]
        self.session_state_file = self._config["SESSION_STATE_FILE"]

        # Instrument tokens
        if self.trade_index == "BANKNIFTY":
            self.index_token = self._config["BN_INDEX_TOKEN"]
        else:
            self.index_token = self._config["NF_INDEX_TOKEN"]

        # Kite API connection (initialized in start())
        self.kite = None
        self.fetcher = None

        # Strategy engines (initialized in start())
        self.bias_engine = None
        self.signal_engine = None
        self.options_engine = None

        # Candle buffers for streaming indicator calculation
        self.buf_entry = CandleBuffer(2000)
        self.buf_bias = CandleBuffer(2000)

        # Position tracking
        self.open_positions = []  # List[SimulatedPosition]
        self.closed_trades = []   # List[Trade]

        # Daily tracking
        self.daily_pnl = 0
        self.daily_start_capital = self.starting_capital
        self.daily_trade_count = 0
        self.today = None

        # Current bias (for change detection)
        self._last_bias_direction = "NEUTRAL"

        # Session control
        self._running = False

        # Kite API interval mapping
        self._kite_interval_map = {
            "1m": "minute", "3m": "3minute", "5m": "5minute",
            "15m": "15minute", "60m": "60minute",
        }

        # Entry TF in minutes for calculations
        self._entry_tf_minutes = int(self.entry_tf.replace("m", ""))

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
        3. Loads any previous session state
        4. Enters the main trading loop

        The loop runs continuously during market hours, checking for new
        candles and processing them through the strategy pipeline.

        Press Ctrl+C to stop gracefully.
        """
        self._connect_api()
        self._init_engines()
        self._load_state()

        self._running = True
        self._notify("=" * 65)
        self._notify("DDLJ v9 PAPER TRADING — SESSION STARTED")
        self._notify("=" * 65)
        self._notify(f"Capital: ₹{self.current_capital:,.0f} | "
                     f"Risk: {self.daily_risk_pct}%/day | "
                     f"Max Pos: {self.max_open_positions}")
        self._notify(f"Index: {self.trade_index} | "
                     f"Entry: {self.entry_tf} | Bias: {self.bias_tf}")
        self._notify(f"Open positions from previous session: {len(self.open_positions)}")
        self._notify("Press Ctrl+C to stop gracefully")
        self._notify("=" * 65)

        try:
            self._main_loop()
        except KeyboardInterrupt:
            self._notify("\n⚠️ Ctrl+C received — shutting down gracefully...")
            self._graceful_shutdown()
        except Exception as e:
            log.error("Unexpected error: %s", e, exc_info=True)
            self._notify(f"❌ ERROR: {e}")
            self._graceful_shutdown()

    def stop(self):
        """Stop the paper trader gracefully."""
        self._running = False

    def get_status(self) -> dict:
        """
        Return current status as a dictionary.

        Returns:
            dict: Current trading status including positions, P&L, bias.
        """
        return {
            "running": self._running,
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
        }

    # ══════════════════════════════════════════════════════════════════
    # CONNECTION & INITIALIZATION
    # ══════════════════════════════════════════════════════════════════

    def _connect_api(self):
        """Connect to Kite API and initialize data fetcher."""
        self._notify("Connecting to Kite API...")
        try:
            self.kite = get_kite_session()
            self.fetcher = KiteDataFetcher(
                self._config["KITE_API_KEY"],
                self.kite.access_token,
                rate_limit_delay=0.35
            )
            profile = self.kite.profile()
            self._notify(f"✅ Connected as {profile.get('user_name', 'unknown')}")
        except Exception as e:
            self._notify(f"❌ API connection failed: {e}")
            self._notify("Run token_manager.exchange_request_token('YOUR_TOKEN') first")
            raise

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

    # ══════════════════════════════════════════════════════════════════
    # MAIN TRADING LOOP
    # ══════════════════════════════════════════════════════════════════

    def _main_loop(self):
        """
        Main trading loop. Runs continuously during market hours.

        Every poll_interval seconds, it:
        1. Checks if we're within market hours
        2. Fetches the latest candle data
        3. Processes new candles through the strategy
        4. Manages open positions (exits, trailing stops)
        5. Saves state periodically
        """
        last_candle_time_entry = None
        last_candle_time_bias = None
        last_save_time = 0

        while self._running:
            try:
                now = datetime.now(IST)
                current_time = now.time()
                today = now.date()

                # ── NEW DAY RESET ──
                if self.today != today:
                    if self.today is not None:
                        # Log previous day's summary
                        self._notify(
                            f"📊 Day {self.today} Summary: "
                            f"P&L=₹{self.daily_pnl:,.0f} | "
                            f"Trades={self.daily_trade_count} | "
                            f"Capital=₹{self.current_capital:,.0f}"
                        )
                    self.today = today
                    self.daily_pnl = 0
                    self.daily_start_capital = self.current_capital
                    self.daily_trade_count = 0
                    self._notify(f"🌅 New trading day: {today}")

                # ── MARKET HOURS CHECK ──
                if current_time < self.MARKET_OPEN:
                    # Pre-market — wait
                    time.sleep(self.poll_interval)
                    continue

                if current_time >= self.MARKET_CLOSE:
                    # After market — close positions if any, then stop
                    if self.open_positions:
                        self._force_close_all("POST_MARKET")
                    self._save_state()
                    self._notify("Market closed. Session paused until next market day.")
                    # Sleep until next morning check
                    time.sleep(60)
                    continue

                # ── FETCH LATEST CANDLE ──
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

                # Fetch bias timeframe candle
                try:
                    bias_candle = self._fetch_latest_candle(
                        self.index_token, bias_interval
                    )
                except Exception as e:
                    log.warning("Failed to fetch bias candle: %s", e)
                    bias_candle = None

                # ── PROCESS NEW CANDLES ──
                if entry_candle:
                    candle_key = (entry_candle.ts.date(), entry_candle.ts.hour,
                                  entry_candle.ts.minute)
                    if candle_key != last_candle_time_entry:
                        last_candle_time_entry = candle_key
                        self.buf_entry.push(entry_candle)
                        log.debug("New entry candle: %s %s close=%.2f",
                                  entry_candle.ts, self.entry_tf, entry_candle.close)

                        # Push any new bias candles too
                        if bias_candle:
                            self.buf_bias.push(bias_candle)

                        # Process the candle through strategy
                        self._on_new_candle(entry_candle)

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

        # Detect bias changes
        if bias.direction != self._last_bias_direction:
            if self.notify_on_bias_change and self._last_bias_direction != "NEUTRAL":
                self._notify(
                    f"🔄 Bias changed: {self._last_bias_direction} → {bias.direction} "
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
            # Daily trade count check
            if self.daily_trade_count >= self.max_daily_trades:
                return

            # Capital floor check
            if self.current_capital < self.starting_capital * 0.20:
                return

            # Capital check for new position
            self._simulate_entry(sig, candle, bias)

    def _check_long_exit(self, pos, candle, ct, bias):
        """Check exit conditions for a LONG position. Returns (action, price)."""
        # 1. Stop Loss
        if candle.low <= pos.sl:
            return "SL", pos.sl
        # 2. Target
        if candle.high >= pos.target:
            return "TARGET", pos.target
        # 3. Near Target
        if candle.high >= pos.target - 3 and candle.close > pos.entry:
            return "NEAR_TGT", candle.close
        # 4. End-of-Day
        if ct >= self.force_close_time:
            return "EOD", candle.close
        # 5. Bias Flip
        if bias.direction == "BEARISH" and pos.held > 6:
            return "BIAS_FLIP", candle.close
        # 6. Time Exit
        if pos.held >= 24 * (15 // self._entry_tf_minutes):
            return "TIME", candle.close

        # Position Management (no exit)
        if not pos.be_done:
            profit = candle.high - pos.entry
            if profit >= pos.risk:
                pos.sl = pos.entry + 1
                pos.be_done = True
        elif pos.held % 3 == 0:
            sl_cand = self.buf_entry.last(15)
            new_sl = swing_low(sl_cand, 15)
            if new_sl and new_sl > pos.sl:
                pos.sl = round(new_sl - 0.5, 2)

        return "HOLD", 0

    def _check_short_exit(self, pos, candle, ct, bias):
        """Check exit conditions for a SHORT position. Returns (action, price)."""
        # 1. Stop Loss
        if candle.high >= pos.sl:
            return "SL", pos.sl
        # 2. Target
        if candle.low <= pos.target:
            return "TARGET", pos.target
        # 3. Near Target
        if candle.low <= pos.target + 3 and candle.close < pos.entry:
            return "NEAR_TGT", candle.close
        # 4. End-of-Day
        if ct >= self.force_close_time:
            return "EOD", candle.close
        # 5. Bias Flip
        if bias.direction == "BULLISH" and pos.held > 6:
            return "BIAS_FLIP", candle.close
        # 6. Time Exit
        if pos.held >= 24 * (15 // self._entry_tf_minutes):
            return "TIME", candle.close

        # Position Management (no exit)
        if not pos.be_done:
            profit = pos.entry - candle.low
            if profit >= pos.risk:
                pos.sl = pos.entry - 1
                pos.be_done = True
        elif pos.held % 3 == 0:
            sl_cand = self.buf_entry.last(15)
            new_sl = swing_high(sl_cand, 15)
            if new_sl and new_sl < pos.sl:
                pos.sl = round(new_sl + 0.5, 2)

        return "HOLD", 0

    def _check_risk_limits(self, ct) -> bool:
        """
        Check if we're allowed to take new trades.

        Returns:
            bool: True if we can trade, False if not.
        """
        # Time window
        if ct < self.no_trade_end or ct >= self.entry_cutoff:
            return False

        # Max positions
        if len(self.open_positions) >= self.max_open_positions:
            return False

        # Daily risk limit (sum all unrealized losses — BUG FIX #1)
        realized_loss = min(self.daily_pnl, 0)
        unrealized_loss = 0
        for pos in self.open_positions:
            if pos.opt_entry:
                worst_case = -pos.opt_entry["fill_price"] * pos.opt_entry["lots"] * pos.opt_entry["lot_size"]
            else:
                if pos.direction == "LONG":
                    worst_case = (pos.sl - pos.entry) * pos.qty
                else:
                    worst_case = (pos.entry - pos.sl) * pos.qty
            unrealized_loss += worst_case

        total_day_risk = realized_loss + unrealized_loss
        daily_risk_limit = self.daily_start_capital * self.daily_risk_pct / 100

        if total_day_risk < -daily_risk_limit:
            if self.notify_on_daily_limit and self.daily_trade_count == 0:
                self._notify(f"🛑 Daily risk limit reached! "
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
        # Estimate DTE (days to Thursday expiry)
        d = candle.ts.date()
        days_until_thursday = (3 - d.weekday()) % 7
        if days_until_thursday == 0:
            dte = 0
        else:
            dte = (d + timedelta(days=days_until_thursday) - d).days
        dte = max(0, dte)

        # Drawdown circuit breaker
        effective_capital = self.current_capital
        dd_ratio = self.current_capital / self.peak_capital if self.peak_capital > 0 else 1
        if dd_ratio < 0.80:
            effective_capital = self.current_capital * dd_ratio

        # Model the options entry
        self.options_engine.capital = effective_capital
        opt_entry = self.options_engine.model_entry(
            signal.entry, signal.direction, signal.atr_val, dte,
            candle.ts, candle.ts.time()
        )

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
                f"⚡ ENTRY: {signal.direction} {self.trade_index} "
                f"@ {signal.entry:,.0f} | "
                f"SL={signal.sl:,.0f} TGT={signal.target:,.0f} "
                f"RR={signal.rr:.2f}"
            )
            self._notify(
                f"📦 ORDER: BUY {opt_entry['lots']} lot "
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
        # Estimate DTE at exit
        d = candle.ts.date()
        days_until_thursday = (3 - d.weekday()) % 7
        dte = max(0, (d + timedelta(days=days_until_thursday) - d).days if days_until_thursday > 0 else 0)

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
        pnl_emoji = "✅" if net > 0 else "❌"
        if self.notify_on_trade:
            self._notify(
                f"{pnl_emoji} EXIT: {exit_reason} | "
                f"{pos.direction} {pos.symbol} | "
                f"P&L=₹{net:,.0f} (gross=₹{gross:,.0f} costs=₹{costs:,.0f})"
            )

    def _force_close_all(self, reason="EOD"):
        """Close all open positions at current market price."""
        if not self.open_positions:
            return

        self._notify(f"⚠️ Force closing {len(self.open_positions)} positions ({reason})")

        # Fetch current candle for exit price
        try:
            entry_interval = self._kite_interval_map.get(self.entry_tf, "15minute")
            latest = self._fetch_latest_candle(self.index_token, entry_interval)
        except Exception:
            latest = None

        if latest is None:
            self._notify("❌ Cannot fetch price for force close — positions remain open!")
            return

        for pos in list(self.open_positions):
            self._simulate_exit(pos, reason, latest.close, latest)
            self.open_positions.remove(pos)

    # ══════════════════════════════════════════════════════════════════
    # STATE PERSISTENCE
    # ══════════════════════════════════════════════════════════════════

    def _save_state(self):
        """Save current session state to JSON for resume after restart."""
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
            "timestamp": datetime.now(IST).isoformat(),
        }

        try:
            os.makedirs(os.path.dirname(self.session_state_file), exist_ok=True)
            with open(self.session_state_file, "w") as f:
                json.dump(state, f, indent=2, default=str)
        except Exception as e:
            log.warning("Failed to save state: %s", e)

    def _load_state(self):
        """Load previously saved session state for resumption."""
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

        Args:
            trade (Trade): The completed trade to log.
        """
        # JSON log
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
                "option_spread_cost": trade.option_spread_cost,
                "mode": trade.mode,
            }
            trades_list.append(trade_dict)

            with open(self.trade_log_file, "w") as f:
                json.dump(trades_list, f, indent=2, default=str)
        except Exception as e:
            log.warning("Failed to log trade to JSON: %s", e)

        # CSV log
        try:
            os.makedirs(os.path.dirname(self.trade_log_csv), exist_ok=True)
            file_exists = os.path.exists(self.trade_log_csv)

            with open(self.trade_log_csv, "a", newline="") as f:
                writer = csv.writer(f)
                if not file_exists:
                    writer.writerow([
                        "entry_time", "exit_time", "symbol", "direction",
                        "entry", "exit", "sl", "target", "qty",
                        "gross", "costs", "net", "exit_reason", "rr",
                        "held", "option_strike", "option_type",
                        "entry_premium", "exit_premium", "delta",
                        "spread_cost", "mode"
                    ])
                writer.writerow([
                    trade.entry_time, trade.exit_time, trade.symbol,
                    trade.direction, trade.entry, trade.exit, trade.sl,
                    trade.target, trade.qty, trade.gross, trade.costs,
                    trade.net, trade.exit_reason, trade.rr, trade.held,
                    trade.option_strike, trade.option_type,
                    trade.option_entry_premium, trade.option_exit_premium,
                    trade.option_delta, trade.option_spread_cost,
                    trade.mode,
                ])
        except Exception as e:
            log.warning("Failed to log trade to CSV: %s", e)

    # ══════════════════════════════════════════════════════════════════
    # NOTIFICATIONS
    # ══════════════════════════════════════════════════════════════════

    def _notify(self, message):
        """
        Print a notification with timestamp.

        WHY a separate notify method? Makes it easy to add more notification
        channels later (email, Telegram, etc.) without changing the code.

        Args:
            message (str): The notification message.
        """
        now = datetime.now(IST).strftime("%H:%M:%S")
        print(f"[{now}] {message}")

    # ══════════════════════════════════════════════════════════════════
    # GRACEFUL SHUTDOWN
    # ══════════════════════════════════════════════════════════════════

    def _graceful_shutdown(self):
        """Gracefully shut down the paper trader."""
        self._running = False

        # Save current state
        self._save_state()

        # Print summary
        total_pnl = sum(t.net for t in self.closed_trades)
        wins = sum(1 for t in self.closed_trades if t.net > 0)
        total = len(self.closed_trades)

        self._notify("=" * 65)
        self._notify("DDLJ v9 PAPER TRADING — SESSION ENDED")
        self._notify("=" * 65)
        self._notify(f"Capital: ₹{self.current_capital:,.0f} "
                     f"(started ₹{self.starting_capital:,.0f})")
        self._notify(f"Total P&L: ₹{total_pnl:,.0f} "
                     f"({total_pnl / self.starting_capital * 100:+.1f}%)")
        self._notify(f"Closed Trades: {total} | Wins: {wins} | "
                     f"Win Rate: {wins/total*100:.0f}%" if total > 0 else
                     f"Closed Trades: 0")
        self._notify(f"Open Positions: {len(self.open_positions)} (saved for resume)")
        self._notify(f"Peak Capital: ₹{self.peak_capital:,.0f}")
        if self.peak_capital > 0:
            dd = (self.peak_capital - self.current_capital) / self.peak_capital * 100
            self._notify(f"Current Drawdown: {dd:.1f}%")
        self._notify(f"State saved to: {self.session_state_file}")
        self._notify(f"Trade log: {self.trade_log_file}")
        self._notify(f"CSV log: {self.trade_log_csv}")
        self._notify("=" * 65)
