#!/usr/bin/env python3
"""
DDLJ v8.4 Strategy — Candle Data Module
=========================================

This module handles all candle-related data structures and operations:
  - Candle dataclass: Represents a single OHLCV candle
  - CandleBuffer: Efficient rolling window of candles for indicator calculation
  - Data loading: Parse, load, aggregate, and filter candle data

WHY A SEPARATE DATA MODULE?
----------------------------
Separating data handling from strategy logic provides:
  1. Reusability — same data functions for backtesting and live trading
  2. Testability — can unit test data loading independently
  3. Clarity — strategy code doesn't get cluttered with data parsing

DATA FLOW:
  1. Raw JSON from Kite API → parse_candles() → List[Candle]
  2. Multiple tokens merged → load_cached_data() → deduped raw data
  3. Lower TF → higher TF → aggregate_candles() / build_htf_from_ltf()
  4. Date filtering → filter_candles_by_date() → subset for test period

Author: DDLJ Strategy Team
Version: 8.4 (Production)
"""

import os
import json
from datetime import datetime, date
from dataclasses import dataclass
from collections import deque

import pytz

# Indian Standard Timezone — used for all candle timestamps
# WHY IST? All Indian market data is in IST. Using UTC would cause
# confusion at market open/close boundaries.
IST = pytz.timezone("Asia/Kolkata")


# ═══════════════════════════════════════════════════════════════════════════
# CANDLE DATACLASS
# ═══════════════════════════════════════════════════════════════════════════

@dataclass(slots=True)
class Candle:
    """
    A single OHLCV (Open-High-Low-Close-Volume) candle.

    This is the fundamental data structure in the strategy. Every chart,
    every indicator, every signal is derived from Candle objects.

    Attributes:
        symbol (str): Trading symbol (e.g., "BANKNIFTY", "NIFTY").
        ts (datetime): Timestamp of the candle. Always in IST timezone.
            For a 15-minute candle starting at 10:15, ts = 10:15:00 IST.
        open (float): Opening price of the candle period.
        high (float): Highest price during the candle period.
        low (float): Lowest price during the candle period.
        close (float): Closing price of the candle period.
        volume (float): Total volume traded during the candle period.
            Stored as float because Kite API returns it as float.
        timeframe (str): Candle timeframe string (e.g., "15m", "60m").
            Default: "15m" (the most commonly used timeframe).

    Properties:
        is_bullish (bool): True if close ≥ open (green candle).
        is_bearish (bool): True if close < open (red candle).
        body_size (float): |close - open| — the size of the candle body.
        upper_wick (float): high - max(open, close) — the top shadow.
        lower_wick (float): min(open, close) - low — the bottom shadow.
        range (float): high - low — the full candle range.

    WHY slots=True?
        Using __slots__ reduces memory usage by ~40% and speeds up
        attribute access by ~20%. With thousands of candles in memory,
        this makes a measurable difference.

    Example:
        >>> from datetime import datetime
        >>> c = Candle("BANKNIFTY", datetime(2026, 1, 15, 10, 15),
        ...            50000, 50150, 49900, 50080, 1500000, "15m")
        >>> c.is_bullish    # 50080 > 50000
        True
        >>> c.body_size     # |50080 - 50000|
        80
        >>> c.upper_wick    # 50150 - 50080
        70
    """
    symbol: str
    ts: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    timeframe: str = "15m"

    @property
    def is_bullish(self):
        """True if the candle closed higher than it opened (green candle)."""
        return self.close >= self.open

    @property
    def is_bearish(self):
        """True if the candle closed lower than it opened (red candle)."""
        return self.close < self.open

    @property
    def body_size(self):
        """Absolute difference between open and close (the candle body)."""
        return abs(self.close - self.open)

    @property
    def upper_wick(self):
        """Upper shadow: distance from body top to the candle high."""
        return self.high - max(self.open, self.close)

    @property
    def lower_wick(self):
        """Lower shadow: distance from candle low to the body bottom."""
        return min(self.open, self.close) - self.low

    @property
    def range(self):
        """Full range of the candle: high - low."""
        return self.high - self.low


# ═══════════════════════════════════════════════════════════════════════════
# CANDLE BUFFER
# ═══════════════════════════════════════════════════════════════════════════

class CandleBuffer:
    """
    Efficient rolling window of candles for indicator calculation.

    The CandleBuffer maintains a fixed-size deque of candles. As new
    candles arrive, old ones are automatically evicted. This is essential
    for the streaming nature of the backtester, where we process candles
    one at a time.

    WHY A DEDICATED BUFFER CLASS?
        1. Memory efficiency: Fixed size prevents unbounded memory growth
        2. Convenience: Helper methods for common operations (last N, closes)
        3. Warm-up check: is_ready() tells us if we have enough data

    WHY maxlen=2000?
        The maximum lookback used by any indicator is ~200 candles
        (swing detection with lb=50 + structure_lookback=20 + EMA period).
        2000 provides 10× safety margin and handles multi-day data.

    Example:
        >>> buf = CandleBuffer(maxlen=2000)
        >>> buf.push(candle1)
        >>> buf.push(candle2)
        >>> len(buf)
        2
        >>> buf.is_ready(20)  # Do we have 20 candles?
        False
        >>> buf.closes(5)     # Last 5 close prices
        [candle2.close, candle1.close]  # Only 2 available
    """

    def __init__(self, maxlen=2000):
        """
        Initialize the candle buffer.

        Args:
            maxlen (int, optional): Maximum number of candles to store.
                Default: 2000. When full, oldest candles are evicted.
                WHY 2000? See class docstring for reasoning.
        """
        self._buf = deque(maxlen=maxlen)

    def push(self, c):
        """
        Add a candle to the buffer.

        If the buffer is full, the oldest candle is automatically removed.

        Args:
            c (Candle): The candle to add.
        """
        self._buf.append(c)

    def __len__(self):
        """Return the number of candles currently in the buffer."""
        return len(self._buf)

    def last(self, n=1):
        """
        Get the last N candles from the buffer.

        Args:
            n (int, optional): Number of candles to return. Default: 1.

        Returns:
            list[Candle]: The most recent N candles. If fewer than N
                candles are available, returns all candles.
        """
        b = list(self._buf)
        return b[-n:] if n <= len(b) else b

    def closes(self, n=None):
        """
        Get close prices from the buffer.

        Args:
            n (int | None, optional): Number of recent closes to return.
                If None, returns all close prices.

        Returns:
            list[float]: Close prices of the last N candles (or all).
        """
        b = list(self._buf)
        return [c.close for c in (b[-n:] if n else b)]

    def is_ready(self, n):
        """
        Check if the buffer has enough candles for a calculation.

        WHY this check? Indicators like EMA(20) need at least 20 candles
        before they can produce a valid value. Calling an indicator
        without enough data would produce garbage results.

        Args:
            n (int): Minimum number of candles required.

        Returns:
            bool: True if the buffer contains at least N candles.
        """
        return len(self._buf) >= n


# ═══════════════════════════════════════════════════════════════════════════
# DATA LOADING AND PROCESSING FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

def parse_candles(raw, symbol, tf="15m"):
    """
    Parse raw JSON candle data from Kite API into Candle objects.

    Handles multiple timestamp formats (ISO string, datetime object)
    and ensures all timestamps are timezone-aware (IST).

    Args:
        raw (list[dict]): Raw candle data from Kite API or cache files.
            Each dict must have: "date", "open", "high", "low", "close", "volume".
        symbol (str): Trading symbol to assign to each candle
            (e.g., "BANKNIFTY", "NIFTY").
        tf (str, optional): Timeframe string (e.g., "15m", "60m").
            Default: "15m".

    Returns:
        list[Candle]: Parsed candle objects. Candles with unparseable
            timestamps are silently skipped.

    Example:
        >>> raw_data = [
        ...     {"date": "2026-01-15T10:15:00", "open": 50000,
        ...      "high": 50100, "low": 49950, "close": 50080,
        ...      "volume": 1500000}
        ... ]
        >>> candles = parse_candles(raw_data, "BANKNIFTY", "15m")
        >>> len(candles)
        1
        >>> candles[0].close
        50080.0
    """
    out = []
    for d in raw:
        ts = d["date"]

        # Parse timestamp — handle multiple formats
        if isinstance(ts, str):
            try:
                ts = datetime.fromisoformat(ts)
            except (ValueError, TypeError):
                continue  # Skip unparseable timestamps
            # Add IST timezone if missing
            if ts.tzinfo is None:
                ts = IST.localize(ts)
        elif isinstance(ts, datetime):
            # Add IST timezone if missing
            if ts.tzinfo is None:
                ts = IST.localize(ts)
        else:
            continue  # Skip unknown timestamp types

        out.append(Candle(
            symbol, ts,
            float(d["open"]), float(d["high"]),
            float(d["low"]), float(d["close"]),
            float(d["volume"]), tf
        ))
    return out


def load_cached_data(tokens, interval, cache_dir="/home/z/my-project/kite_cache_v10"):
    """
    Load and merge cached candle data for multiple instrument tokens.

    WHY MULTIPLE TOKENS? The same instrument may have different tokens
    over time (e.g., BankNifty index token vs. futures token, or a
    new futures contract each month). By searching for all possible
    tokens, we get the most complete data coverage.

    DEDUPLICATION: Since multiple tokens may cover overlapping time
    periods, we deduplicate by date to avoid double-counting.

    Args:
        tokens (list[int]): List of instrument tokens to search for.
            Example: [260105, 17072130] for BankNifty index + futures.
        interval (str): Kite API interval string (e.g., "5minute",
            "15minute", "60minute").
        cache_dir (str, optional): Directory containing cached data files.
            Default: "/home/z/my-project/kite_cache_v10".
            Files are named: {token}_{interval}_{from_date}_{to_date}.json

    Returns:
        list[dict]: Merged and deduplicated raw candle data.

    Example:
        >>> data = load_cached_data([260105, 17072130], "15minute")
        >>> len(data)
        5420  # Number of 15-minute candles across all matching files
    """
    all_data = []

    if not os.path.exists(cache_dir):
        return []

    # Search for files matching any of the tokens and the interval
    for f in sorted(os.listdir(cache_dir)):
        for token in tokens:
            if f.startswith(f"{token}_{interval}_") and f.endswith(".json"):
                try:
                    with open(os.path.join(cache_dir, f)) as fh:
                        chunk = json.load(fh)
                    all_data.extend(chunk)
                except (json.JSONDecodeError, OSError):
                    pass  # Skip corrupt files silently
                break  # Don't check other tokens for this file

    # Deduplicate by date — keep only the first occurrence
    seen = set()
    deduped = []
    for d in all_data:
        key = d.get("date", "")
        if key not in seen:
            seen.add(key)
            deduped.append(d)

    return deduped


def aggregate_candles(candles, target_minutes, target_tf):
    """
    Aggregate lower-timeframe candles into higher-timeframe candles.

    For example, convert 5-minute candles into 15-minute candles by
    grouping every three 5-minute candles that fall within the same
    15-minute period.

    HOW AGGREGATION WORKS:
      1. For each candle, calculate which "period" it belongs to:
         period = (hour × 60 + minute) // target_minutes
      2. Group candles by (date, period)
      3. For each group: open = first open, close = last close,
         high = max high, low = min low, volume = sum of volumes

    Args:
        candles (list[Candle]): Source candles (lower timeframe).
        target_minutes (int): Target timeframe in minutes (e.g., 15, 60).
        target_tf (str): Target timeframe string (e.g., "15m", "60m").

    Returns:
        list[Candle]: Aggregated candles on the higher timeframe.

    Example:
        >>> # Convert 5m candles to 15m
        >>> candles_15m = aggregate_candles(candles_5m, 15, "15m")
        >>> # Each 15m candle combines 3 consecutive 5m candles
    """
    if not candles:
        return []

    aggregated = {}
    for c in candles:
        total_minutes = c.ts.hour * 60 + c.ts.minute
        period_start = (total_minutes // target_minutes) * target_minutes
        key = (c.ts.date(), period_start)

        if key not in aggregated:
            # First candle in this period — initialize
            aggregated[key] = {
                "symbol": c.symbol, "date": c.ts,
                "open": c.open, "high": c.high,
                "low": c.low, "close": c.close,
                "volume": c.volume,
            }
        else:
            # Update with subsequent candles in the same period
            aggregated[key]["high"] = max(aggregated[key]["high"], c.high)
            aggregated[key]["low"] = min(aggregated[key]["low"], c.low)
            aggregated[key]["close"] = c.close  # Last close wins
            aggregated[key]["volume"] += c.volume

    # Build Candle objects from aggregated data, sorted by time
    result = []
    for key in sorted(aggregated.keys()):
        h = aggregated[key]
        result.append(Candle(
            h["symbol"], h["date"], h["open"], h["high"],
            h["low"], h["close"], h["volume"], target_tf
        ))
    return result


def build_htf_from_ltf(candles_ltf, target_tf):
    """
    Build higher-timeframe candles from lower-timeframe candles.

    This is a convenience wrapper around aggregate_candles() that
    maps timeframe strings to their minute values.

    SUPPORTED CONVERSIONS:
        "3m" → 3 minutes
        "5m" → 5 minutes
        "15m" → 15 minutes
        "60m" → 60 minutes

    Args:
        candles_ltf (list[Candle]): Lower-timeframe candles.
        target_tf (str): Target timeframe string (e.g., "15m", "60m").

    Returns:
        list[Candle]: Aggregated candles on the target timeframe.

    Example:
        >>> # Build 60m candles from 15m candles
        >>> candles_60m = build_htf_from_ltf(candles_15m, "60m")
        >>> # Each 60m candle combines 4 consecutive 15m candles
    """
    tf_minutes = {"3m": 3, "5m": 5, "15m": 15, "60m": 60}
    target_minutes = tf_minutes.get(target_tf, 15)  # Default to 15m
    return aggregate_candles(candles_ltf, target_minutes, target_tf)


def filter_candles_by_date(candles, start_date, end_date):
    """
    Filter candles to only include those within a date range.

    This is used to select only the test period data, excluding
    warm-up data and data outside the backtest window.

    Args:
        candles (list[Candle]): Source candles.
        start_date (date): Start date (inclusive).
        end_date (date): End date (inclusive).

    Returns:
        list[Candle]: Candles whose timestamp falls within the range.

    Example:
        >>> from datetime import date
        >>> filtered = filter_candles_by_date(
        ...     candles,
        ...     date(2026, 1, 1),   # Jan 1 2026
        ...     date(2026, 3, 31)   # Mar 31 2026
        ... )
        >>> # Only January through March 2026 candles
    """
    return [c for c in candles if start_date <= c.ts.date() <= end_date]
