#!/usr/bin/env python3
"""
DDLJ v9 Strategy — Technical Indicators Module
================================================

This module provides all the technical indicators used by the DDLJ strategy.
Every indicator here serves a specific purpose in the trading system:

  - ema_series / ema   : Exponential Moving Average — the core trend-following
                         indicator. Used by both the Bias Engine (to determine
                         market direction) and the Signal Engine (to detect
                         crossover entries).

  - atr                 : Average True Range — measures market volatility.
                         Used to size stop losses, validate candle quality,
                         and check for overextended prices.

  - ema_slope_pct       : Measures the slope (direction) of the EMA line as a
                         percentage. A positive slope means the EMA is rising
                         (bullish), negative means falling (bearish).

  - swing_high / swing_low : Detect recent swing points (local maxima/minima).
                             Used for trailing stop placement and target
                             calculation.

  - swing_high_above / swing_low_below : Conditional swing point detection.
      Only returns a swing point if it's above/below a reference price.
      Used by the Signal Engine to set realistic price targets based on
      market structure.

WHY THESE INDICATORS?
---------------------
The DDLJ strategy is a trend-following system. The EMA identifies the trend,
ATR measures how much the market is moving (for stop sizing and filtering),
and swing points identify key support/resistance levels for exits.

These indicators are intentionally simple — complex indicators tend to
overfit in backtesting and fail in live trading. Simple + robust > complex.

Author: DDLJ Strategy Team
Version: 9.0 (Paper Trading Production)
"""


def ema_series(values, period):
    """
    Compute the Exponential Moving Average (EMA) for an entire series of values.

    The EMA gives more weight to recent prices than older ones, making it
    more responsive to price changes than a Simple Moving Average (SMA).

    The formula is:
        EMA_today = Price_today * k + EMA_yesterday * (1 - k)
    where k = 2 / (period + 1) is the smoothing factor.

    The first EMA value is seeded with the Simple Moving Average (SMA) of
    the first `period` values, because EMA needs a starting point.

    Args:
        values (list[float]): A list of numerical values (typically closing prices).
            Must contain at least `period` values to produce a valid EMA.
        period (int): The EMA period (lookback window). Common values:
            - 20: Standard for trend identification
            - 50: Medium-term trend
            - 200: Long-term trend

    Returns:
        list[float | None]: A list of the same length as `values`. The first
            `period - 1` entries are `None` (not enough data to compute EMA),
            and the remaining entries contain the EMA values rounded to 6
            decimal places.
    """
    if len(values) < period:
        return [None] * len(values)

    k = 2.0 / (period + 1)
    result = [None] * (period - 1)

    current = sum(values[:period]) / period
    result.append(round(current, 6))

    for v in values[period:]:
        current = v * k + current * (1 - k)
        result.append(round(current, 6))

    return result


def ema(values, period):
    """
    Compute the EMA and return only the latest (most recent) value.

    Convenience wrapper around ema_series() for when you only need the
    current EMA value (e.g., "what is the 20 EMA right now?").

    Args:
        values (list[float]): A list of numerical values (typically closing prices).
        period (int): The EMA period.

    Returns:
        float | None: The latest EMA value, or None if not enough data.
    """
    series = ema_series(values, period)
    for v in reversed(series):
        if v is not None:
            return v
    return None


def atr(candles, period=14):
    """
    Compute the Average True Range (ATR) — a measure of market volatility.

    ATR tells us how much the market typically moves in a single period.
    True Range accounts for gaps:
        True Range = max(
            High - Low,
            abs(High - Previous Close),
            abs(Low - Previous Close)
        )

    Uses Wilder-style smoothing (industry standard).

    Args:
        candles (list): A list of Candle objects. Each must have .high, .low,
            and .close attributes. Requires at least `period + 1` candles.
        period (int, optional): The ATR lookback period. Default is 14.

    Returns:
        float: The current ATR value, rounded to 6 decimal places.

    Raises:
        ValueError: If fewer than `period + 1` candles are provided.
    """
    if len(candles) < period + 1:
        raise ValueError(
            f"Not enough candles for ATR: need {period + 1}, got {len(candles)}"
        )

    trs = []
    for i in range(1, len(candles)):
        h = candles[i].high
        l = candles[i].low
        pc = candles[i - 1].close
        tr = max(h - l, abs(h - pc), abs(l - pc))
        trs.append(tr)

    a = sum(trs[:period]) / period

    for t in trs[period:]:
        a = (a * (period - 1) + t) / period

    return round(a, 6)


def ema_slope_pct(vals, lb=3):
    """
    Calculate the slope (percentage change) of the EMA over a lookback period.

    The slope tells us the DIRECTION and STRENGTH of the EMA trend:
        - Positive slope -> EMA is rising -> Bullish
        - Negative slope -> EMA is falling -> Bearish
        - Near-zero slope -> EMA is flat -> No clear trend

    Args:
        vals (list[float]): A list of EMA values.
        lb (int, optional): Lookback period in bars. Default is 3.

    Returns:
        float: The EMA slope as a percentage, rounded to 6 decimal places.
            Returns 0.0 if there isn't enough data.
    """
    if len(vals) < lb + 1:
        return 0.0

    ref_val = vals[-(lb + 1)]

    if ref_val == 0:
        return 0.0

    current_val = vals[-1]
    slope = (current_val - ref_val) / ref_val * 100

    return round(slope, 6)


def swing_high(candles, lb=30):
    """
    Find the most recent swing high (local maximum) in a series of candles.

    A swing high is a candle whose high is HIGHER than both the candle
    before it AND the candle after it.

    Args:
        candles (list): A list of Candle objects with .high attribute.
        lb (int, optional): Lookback — how many candles to search through.

    Returns:
        float | None: The high price of the most recent swing high candle,
            or None if no swing high is found.
    """
    w = candles[-lb:] if len(candles) >= lb else candles

    for i in range(len(w) - 2, 0, -1):
        if w[i].high > w[i - 1].high and w[i].high > w[i + 1].high:
            return w[i].high

    return None


def swing_low(candles, lb=30):
    """
    Find the most recent swing low (local minimum) in a series of candles.

    A swing low is a candle whose low is LOWER than both the candle
    before it AND the candle after it.

    Args:
        candles (list): A list of Candle objects with .low attribute.
        lb (int, optional): Lookback — how many candles to search through.

    Returns:
        float | None: The low price of the most recent swing low candle,
            or None if no swing low is found.
    """
    w = candles[-lb:] if len(candles) >= lb else candles

    for i in range(len(w) - 2, 0, -1):
        if w[i].low < w[i - 1].low and w[i].low < w[i + 1].low:
            return w[i].low

    return None


def swing_high_above(candles, mp, lb=50):
    """
    Find the most recent swing high that is ABOVE a reference price (mp).

    Used for setting realistic LONG targets — finds the nearest resistance
    level ABOVE entry price.

    Args:
        candles (list): A list of Candle objects with .high attribute.
        mp (float): The midpoint/reference price. Only swing highs ABOVE
            this level are considered.
        lb (int, optional): Lookback. Default is 50.

    Returns:
        float | None: The high price of the most recent swing high above mp.
    """
    w = candles[-lb:] if len(candles) >= lb else candles

    for i in range(len(w) - 2, 0, -1):
        if w[i].high > w[i - 1].high and w[i].high > w[i + 1].high and w[i].high > mp:
            return w[i].high

    return None


def swing_low_below(candles, mp, lb=50):
    """
    Find the most recent swing low that is BELOW a reference price (mp).

    Used for setting realistic SHORT targets — finds the nearest support
    level BELOW entry price.

    Args:
        candles (list): A list of Candle objects with .low attribute.
        mp (float): The midpoint/reference price. Only swing lows BELOW
            this level are considered.
        lb (int, optional): Lookback. Default is 50.

    Returns:
        float | None: The low price of the most recent swing low below mp.
    """
    w = candles[-lb:] if len(candles) >= lb else candles

    for i in range(len(w) - 2, 0, -1):
        if w[i].low < w[i - 1].low and w[i].low < w[i + 1].low and w[i].low < mp:
            return w[i].low

    return None
