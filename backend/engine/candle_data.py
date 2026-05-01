#!/usr/bin/env python3
"""
DDLJ v9 Strategy — Candle Data Module
=========================================

Handles all candle-related data structures and operations:
  - Candle dataclass: Represents a single OHLCV candle
  - CandleBuffer: Efficient rolling window of candles for indicator calculation
  - Data loading: Parse, load, aggregate, and filter candle data

DATA FLOW:
  1. Raw JSON from Kite API -> parse_candles() -> List[Candle]
  2. Multiple tokens merged -> load_cached_data() -> deduped raw data
  3. Lower TF -> higher TF -> aggregate_candles() / build_htf_from_ltf()
  4. Date filtering -> filter_candles_by_date() -> subset for test period

Author: DDLJ Strategy Team
Version: 9.0 (Paper Trading Production)
"""

import os
import json
from datetime import datetime, date, timedelta
from dataclasses import dataclass
from collections import deque

import pytz

# Indian Standard Timezone — used for all candle timestamps
IST = pytz.timezone("Asia/Kolkata")


def timeframe_to_minutes(tf) -> int:
    """Convert app/Kite timeframe strings to minutes."""
    if tf is None:
        return 15

    value = str(tf).strip().lower()
    mapping = {
        "3m": 3,
        "3minute": 3,
        "5m": 5,
        "5minute": 5,
        "15m": 15,
        "15minute": 15,
        "60m": 60,
        "60minute": 60,
        "hour": 60,
        "day": 24 * 60,
    }
    return mapping.get(value, 15)


def candle_close_time(candle, timeframe_minutes: int | None = None) -> datetime:
    """Return the timestamp when a candle is complete."""
    minutes = timeframe_minutes or timeframe_to_minutes(getattr(candle, "timeframe", "15m"))
    return candle.ts + timedelta(minutes=minutes)


@dataclass(slots=True)
class Candle:
    """
    A single OHLCV (Open-High-Low-Close-Volume) candle.

    Attributes:
        symbol (str): Trading symbol (e.g., "BANKNIFTY", "NIFTY").
        ts (datetime): Timestamp of the candle. Always in IST timezone.
        open (float): Opening price of the candle period.
        high (float): Highest price during the candle period.
        low (float): Lowest price during the candle period.
        close (float): Closing price of the candle period.
        volume (float): Total volume traded during the candle period.
        timeframe (str): Candle timeframe string (e.g., "15m", "60m").
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
        """True if close >= open (green candle)."""
        return self.close >= self.open

    @property
    def is_bearish(self):
        """True if close < open (red candle)."""
        return self.close < self.open

    @property
    def body_size(self):
        """Absolute difference between open and close."""
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


class CandleBuffer:
    """
    Efficient rolling window of candles for indicator calculation.

    WHY A DEDICATED BUFFER CLASS?
        1. Memory efficiency: Fixed size prevents unbounded memory growth
        2. Convenience: Helper methods for common operations (last N, closes)
        3. Warm-up check: is_ready() tells us if we have enough data

    WHY maxlen=2000?
        The maximum lookback used by any indicator is ~200 candles.
        2000 provides 10x safety margin and handles multi-day data.
    """

    def __init__(self, maxlen=2000):
        self._buf = deque(maxlen=maxlen)

    def push(self, c):
        """Add a candle to the buffer."""
        self._buf.append(c)

    def __len__(self):
        return len(self._buf)

    def last(self, n=1):
        """Get the last N candles from the buffer."""
        b = list(self._buf)
        return b[-n:] if n <= len(b) else b

    def closes(self, n=None):
        """Get close prices from the buffer."""
        b = list(self._buf)
        return [c.close for c in (b[-n:] if n else b)]

    def is_ready(self, n):
        """Check if the buffer has enough candles for a calculation."""
        return len(self._buf) >= n


def parse_candles(raw, symbol, tf="15m"):
    """
    Parse raw JSON candle data from Kite API into Candle objects.

    Args:
        raw (list[dict]): Raw candle data from Kite API or cache files.
        symbol (str): Trading symbol to assign to each candle.
        tf (str): Timeframe string (e.g., "15m", "60m").

    Returns:
        list[Candle]: Parsed candle objects.
    """
    out = []
    for d in raw:
        ts = d["date"]

        if isinstance(ts, str):
            try:
                ts = datetime.fromisoformat(ts)
            except (ValueError, TypeError):
                continue
            if ts.tzinfo is None:
                ts = IST.localize(ts)
        elif isinstance(ts, datetime):
            if ts.tzinfo is None:
                ts = IST.localize(ts)
        else:
            continue

        out.append(Candle(
            symbol, ts,
            float(d["open"]), float(d["high"]),
            float(d["low"]), float(d["close"]),
            float(d["volume"]), tf
        ))
    return out


def load_cached_data(tokens, interval, cache_dir=None):
    """
    Load and merge cached candle data for multiple instrument tokens.

    Args:
        tokens (list[int]): List of instrument tokens to search for.
        interval (str): Kite API interval string (e.g., "15minute").
        cache_dir (str): Directory containing cached data files.
            Defaults to CACHE_DIR from config (no hardcoded paths).

    Returns:
        list[dict]: Merged and deduplicated raw candle data.
    """
    if cache_dir is None:
        cache_dir = os.getenv("CACHE_DIR", os.path.join(os.path.dirname(__file__), "..", "..", "kite_cache_v10"))
    all_data = []

    if not os.path.exists(cache_dir):
        return []

    for f in sorted(os.listdir(cache_dir)):
        for token in tokens:
            if f.startswith(f"{token}_{interval}_") and f.endswith(".json"):
                try:
                    with open(os.path.join(cache_dir, f)) as fh:
                        chunk = json.load(fh)
                    all_data.extend(chunk)
                except (json.JSONDecodeError, OSError):
                    pass
                break

    seen = set()
    deduped = []
    for d in all_data:
        key = d.get("date", "")
        if key not in seen:
            seen.add(key)
            deduped.append(d)

    # Sort by timestamp to ensure chronological order.
    # WHY: Cache files are loaded in filename-sorted order, which sorts by
    # token+interval+date_range, NOT by candle timestamps within each chunk.
    # Without sorting, candles from different chunks may be interleaved,
    # causing wrong EMA calculations and signal generation.
    deduped.sort(key=lambda d: d.get("date", ""))

    return deduped


def aggregate_candles(candles, target_minutes, target_tf):
    """
    Aggregate lower-timeframe candles into higher-timeframe candles.

    Args:
        candles (list[Candle]): Source candles (lower timeframe).
        target_minutes (int): Target timeframe in minutes.
        target_tf (str): Target timeframe string.

    Returns:
        list[Candle]: Aggregated candles on the higher timeframe.
    """
    if not candles:
        return []

    aggregated = {}
    for c in candles:
        total_minutes = c.ts.hour * 60 + c.ts.minute
        period_start = (total_minutes // target_minutes) * target_minutes
        key = (c.ts.date(), period_start)

        if key not in aggregated:
            aggregated[key] = {
                "symbol": c.symbol, "date": c.ts,
                "open": c.open, "high": c.high,
                "low": c.low, "close": c.close,
                "volume": c.volume,
            }
        else:
            aggregated[key]["high"] = max(aggregated[key]["high"], c.high)
            aggregated[key]["low"] = min(aggregated[key]["low"], c.low)
            aggregated[key]["close"] = c.close
            aggregated[key]["volume"] += c.volume

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

    Args:
        candles_ltf (list[Candle]): Lower-timeframe candles.
        target_tf (str): Target timeframe string (e.g., "15m", "60m").

    Returns:
        list[Candle]: Aggregated candles on the target timeframe.
    """
    tf_minutes = {"3m": 3, "5m": 5, "15m": 15, "60m": 60}
    target_minutes = tf_minutes.get(target_tf, 15)
    return aggregate_candles(candles_ltf, target_minutes, target_tf)


def filter_candles_by_date(candles, start_date, end_date):
    """
    Filter candles to only include those within a date range.

    Args:
        candles (list[Candle]): Source candles.
        start_date (date): Start date (inclusive).
        end_date (date): End date (inclusive).

    Returns:
        list[Candle]: Candles whose timestamp falls within the range.
    """
    return [c for c in candles if start_date <= c.ts.date() <= end_date]
