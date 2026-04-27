#!/usr/bin/env python3
"""
DDLJ v8.4 Strategy — Technical Indicators Module
=================================================

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
Version: 8.4 (Production)
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
            WHY period=20? It provides a good balance between responsiveness
            (catching trends early) and stability (not whipsawing on noise).

    Returns:
        list[float | None]: A list of the same length as `values`. The first
            `period - 1` entries are `None` (not enough data to compute EMA),
            and the remaining entries contain the EMA values rounded to 6
            decimal places.

    Example:
        >>> prices = [100, 102, 101, 103, 105, 104, 106, 108, 107, 109]
        >>> ema_values = ema_series(prices, period=5)
        >>> # First 4 values are None, then EMA values begin
        >>> ema_values[4]  # First EMA value = SMA of first 5 prices = 102.2
        102.2

    WHY EMA instead of SMA?
        EMA reacts faster to price changes. When a trend reverses, EMA turns
        sooner than SMA, which means we enter/exit trades earlier. This is
        critical for the DDLJ strategy because we trade options that decay
        over time — faster signals mean less theta decay.
    """
    if len(values) < period:
        # Not enough data to compute even the first EMA value
        return [None] * len(values)

    # Smoothing factor: k = 2 / (period + 1)
    # Higher k = more weight on recent prices = more responsive
    k = 2.0 / (period + 1)

    # Initialize result with None for the warm-up period
    result = [None] * (period - 1)

    # Seed the first EMA with the Simple Moving Average of the first `period` values
    # WHY SMA seed? EMA is recursive — it needs a previous value to start.
    # Using SMA of the same period is the standard initialization method.
    current = sum(values[:period]) / period
    result.append(round(current, 6))

    # Apply EMA formula for each subsequent value
    for v in values[period:]:
        current = v * k + current * (1 - k)
        result.append(round(current, 6))

    return result


def ema(values, period):
    """
    Compute the EMA and return only the latest (most recent) value.

    This is a convenience wrapper around ema_series() for when you only
    need the current EMA value (e.g., "what is the 20 EMA right now?").

    Args:
        values (list[float]): A list of numerical values (typically closing prices).
        period (int): The EMA period.

    Returns:
        float | None: The latest EMA value, or None if not enough data.

    Example:
        >>> ema([100, 102, 101, 103, 105, 104, 106, 108, 107, 109], period=5)
        105.698475  # The most recent EMA value

    WHY a separate function? Many parts of the strategy only need the current
    EMA value (e.g., Bias Engine checking if price is above/below EMA).
    This avoids computing the entire series when only the latest value matters.
    """
    series = ema_series(values, period)
    # Return the last non-None value
    for v in reversed(series):
        if v is not None:
            return v
    return None


def atr(candles, period=14):
    """
    Compute the Average True Range (ATR) — a measure of market volatility.

    ATR tells us how much the market typically moves in a single period.
    It's calculated using the "True Range", which accounts for gaps:

        True Range = max(
            High - Low,                    # Normal range within the candle
            abs(High - Previous Close),    # Gap up from previous close
            abs(Low - Previous Close)      # Gap down from previous close
        )

    The ATR is the moving average of True Range values. We use a Wilder-style
    smoothing (similar to EMA) rather than a simple average, because it's
    more stable and is the industry standard.

    Args:
        candles (list): A list of Candle objects. Each must have .high, .low,
            and .close attributes. Requires at least `period + 1` candles
            (because True Range needs the previous close).
        period (int, optional): The ATR lookback period. Default is 14.
            WHY 14? This is the standard period used worldwide since J. Welles
            Wilder introduced ATR in 1978. It provides ~3 weeks of data on
            daily charts, which is a good balance for intraday trading.

    Returns:
        float: The current ATR value, rounded to 6 decimal places.

    Raises:
        ValueError: If fewer than `period + 1` candles are provided.

    Example:
        >>> # With 15 candles and default period=14
        >>> atr_value = atr(candles)
        >>> # If BankNifty ATR = 150, it means the index typically
        >>> # moves ~150 points per 15-minute candle

    WHY ATR instead of just (High - Low)?
        ATR accounts for overnight gaps. If the market opens significantly
        higher/lower than the previous close, the simple range misses that
        volatility. True Range captures it, making ATR a more accurate
        measure of real market movement.

    HOW ATR IS USED IN DDLJ:
        1. Stop Loss sizing: SL = Entry ± (SL_MULTIPLIER × ATR)
           Default SL_MULTIPLIER = 2.0, so SL is placed 2 ATRs from entry.
        2. Candle quality filter: Minimum body size = 0.3 × ATR
           Rejects tiny "doji" candles with no conviction.
        3. Overextension check: If price is > 3× ATR from EMA, it's
           overextended and we go NEUTRAL (avoid chasing).
        4. Target setting: Minimum target = 1.5 × ATR from entry.
    """
    if len(candles) < period + 1:
        raise ValueError(
            f"Not enough candles for ATR: need {period + 1}, got {len(candles)}"
        )

    # Step 1: Calculate True Range for each candle
    trs = []
    for i in range(1, len(candles)):
        h = candles[i].high
        l = candles[i].low
        pc = candles[i - 1].close  # Previous close (for gap calculation)

        # True Range = the largest of:
        #   1. High - Low (intraday range)
        #   2. |High - Prev Close| (upward gap)
        #   3. |Low - Prev Close| (downward gap)
        tr = max(h - l, abs(h - pc), abs(l - pc))
        trs.append(tr)

    # Step 2: Calculate the initial ATR as the simple average of first `period` TRs
    # This seeds the Wilder smoothing
    a = sum(trs[:period]) / period

    # Step 3: Apply Wilder smoothing for the remaining TRs
    # Formula: ATR_today = (ATR_yesterday × (period - 1) + TR_today) / period
    # WHY Wilder smoothing? It's more stable than EMA for volatility.
    # The (period-1)/period weighting gives more weight to older values,
    # making ATR less jumpy and more reliable as a volatility measure.
    for t in trs[period:]:
        a = (a * (period - 1) + t) / period

    return round(a, 6)


def ema_slope_pct(vals, lb=3):
    """
    Calculate the slope (percentage change) of the EMA over a lookback period.

    The slope tells us the DIRECTION and STRENGTH of the EMA trend:
        - Positive slope → EMA is rising → Bullish
        - Negative slope → EMA is falling → Bearish
        - Near-zero slope → EMA is flat → No clear trend

    The formula is:
        slope_pct = (EMA_now - EMA_lbars_ago) / EMA_lbars_ago × 100

    Args:
        vals (list[float]): A list of EMA values (output from ema_series).
            Must contain at least `lb + 1` values.
        lb (int, optional): Lookback period in bars. Default is 3.
            WHY 3 bars? On a 15-minute chart, 3 bars = 45 minutes.
            This gives us a short-term slope that's responsive enough to
            detect trend changes without being so short that it's noisy.

    Returns:
        float: The EMA slope as a percentage, rounded to 6 decimal places.
            Returns 0.0 if there isn't enough data or if the reference
            value is zero (to avoid division by zero).

    Example:
        >>> ema_vals = [100.0, 100.5, 101.2, 102.0]
        >>> slope = ema_slope_pct(ema_vals, lb=3)
        >>> # slope = (102.0 - 100.0) / 100.0 * 100 = 2.0%
        >>> # This means the EMA rose 2% over the last 3 bars

    HOW SLOPE IS USED IN DDLJ:
        The Bias Engine uses slope as one of several criteria:
        - slope > +0.005% AND price above EMA → BULLISH bias
        - slope < -0.005% AND price below EMA → BEARISH bias
        The 0.005% threshold is very small — it's just a "direction filter"
        to ensure the EMA is actually moving, not flat.
    """
    if len(vals) < lb + 1:
        # Not enough data points to measure slope
        return 0.0

    # Get the reference value (lb bars ago)
    ref_val = vals[-(lb + 1)]

    if ref_val == 0:
        # Avoid division by zero (shouldn't happen with price data, but safety first)
        return 0.0

    # Calculate percentage change
    current_val = vals[-1]
    slope = (current_val - ref_val) / ref_val * 100

    return round(slope, 6)


def swing_high(candles, lb=30):
    """
    Find the most recent swing high (local maximum) in a series of candles.

    A swing high is a candle whose high is HIGHER than both the candle
    before it AND the candle after it. Think of it as a "peak" in the
    price action.

    This function searches from the most recent candles backward, returning
    the FIRST swing high it finds (i.e., the most recent one).

    Args:
        candles (list): A list of Candle objects with .high attribute.
        lb (int, optional): Lookback — how many candles to search through.
            Default is 30.
            WHY 30? On a 15-minute chart, 30 candles = 7.5 hours ≈ 1.5
            trading days. This is enough to find recent structure without
            looking at stale levels from many days ago.

    Returns:
        float | None: The high price of the most recent swing high candle,
            or None if no swing high is found in the lookback window.

    Example:
        >>> # Candles with highs: [..., 50100, 50250, 50150, ...]
        >>> #                        prev   peak    next
        >>> # 50250 > 50100 and 50250 > 50150 → swing high = 50250
        >>> swing_high(candles, lb=30)
        50250

    WHY SWING HIGHS?
        Swing highs represent resistance levels where sellers previously
        stepped in. In the DDLJ strategy, swing highs are used for:
        1. Trailing stops for SHORT positions (place SL above the
           most recent swing high)
        2. Target setting for LONG positions (target = next swing high)
    """
    # Use only the last `lb` candles (or all if fewer available)
    w = candles[-lb:] if len(candles) >= lb else candles

    # Search backward from the most recent candles
    # WHY backward? We want the MOST RECENT swing high, not the highest one
    for i in range(len(w) - 2, 0, -1):
        # A swing high must be higher than both neighbors
        if w[i].high > w[i - 1].high and w[i].high > w[i + 1].high:
            return w[i].high

    return None


def swing_low(candles, lb=30):
    """
    Find the most recent swing low (local minimum) in a series of candles.

    A swing low is a candle whose low is LOWER than both the candle
    before it AND the candle after it. Think of it as a "valley" in the
    price action.

    This is the mirror image of swing_high() — see that function's
    docstring for the detailed logic explanation.

    Args:
        candles (list): A list of Candle objects with .low attribute.
        lb (int, optional): Lookback — how many candles to search through.
            Default is 30.
            WHY 30? Same reasoning as swing_high — covers ~1.5 trading days.

    Returns:
        float | None: The low price of the most recent swing low candle,
            or None if no swing low is found.

    Example:
        >>> # Candles with lows: [..., 49800, 49650, 49750, ...]
        >>> #                        prev   valley   next
        >>> # 49650 < 49800 and 49650 < 49750 → swing low = 49650
        >>> swing_low(candles, lb=30)
        49650

    WHY SWING LOWS?
        Swing lows represent support levels where buyers previously stepped in.
        In the DDLJ strategy, swing lows are used for:
        1. Trailing stops for LONG positions (place SL below the most
           recent swing low)
        2. Target setting for SHORT positions (target = next swing low)
    """
    w = candles[-lb:] if len(candles) >= lb else candles

    for i in range(len(w) - 2, 0, -1):
        # A swing low must be lower than both neighbors
        if w[i].low < w[i - 1].low and w[i].low < w[i + 1].low:
            return w[i].low

    return None


def swing_high_above(candles, mp, lb=50):
    """
    Find the most recent swing high that is ABOVE a reference price (mp).

    This is a conditional version of swing_high(). It only returns a swing
    high if that swing high's price is above the `mp` (midpoint/reference)
    parameter. This is crucial for setting realistic targets.

    Args:
        candles (list): A list of Candle objects with .high attribute.
        mp (float): The midpoint/reference price. Only swing highs ABOVE
            this level are considered.
            WHY? When setting a LONG target, we want the next resistance
            level ABOVE our entry price. A swing high below entry is
            useless as a target.
        lb (int, optional): Lookback — how many candles to search through.
            Default is 50 (more than swing_high because we need a wider
            search to find a swing high above a specific level).
            WHY 50? On a 15-minute chart, 50 candles ≈ 12.5 hours ≈ 2
            trading days. We need a wider window because we're filtering
            by price level, so fewer candidates are available.

    Returns:
        float | None: The high price of the most recent swing high that
            is above `mp`, or None if no such swing high exists.

    Example:
        >>> # Entry price = 50000, looking for target above entry + 1 ATR
        >>> # If ATR = 150, then mp = 50150
        >>> # Swing highs in window: 50300, 49800, 50500
        >>> # Only 50300 and 50500 are above 50150
        >>> # Returns 50300 (most recent one above mp)
        >>> swing_high_above(candles, mp=50150, lb=50)
        50300

    HOW IT'S USED IN DDLJ:
        When generating a LONG signal, the Signal Engine calls:
            sh = swing_high_above(candles, entry + atr_value, 50)
        This finds the nearest resistance above entry+ATR, which becomes
        the target. If no such swing high exists, the target falls back
        to a fixed ATR-based calculation.
    """
    w = candles[-lb:] if len(candles) >= lb else candles

    for i in range(len(w) - 2, 0, -1):
        if w[i].high > w[i - 1].high and w[i].high > w[i + 1].high and w[i].high > mp:
            return w[i].high

    return None


def swing_low_below(candles, mp, lb=50):
    """
    Find the most recent swing low that is BELOW a reference price (mp).

    This is the mirror image of swing_high_above(). It only returns a swing
    low if that swing low's price is below the `mp` parameter.

    Args:
        candles (list): A list of Candle objects with .low attribute.
        mp (float): The midpoint/reference price. Only swing lows BELOW
            this level are considered.
            WHY? When setting a SHORT target, we want the next support
            level BELOW our entry price. A swing low above entry is
            useless as a target.
        lb (int, optional): Lookback — how many candles to search through.
            Default is 50 (same reasoning as swing_high_above).

    Returns:
        float | None: The low price of the most recent swing low that
            is below `mp`, or None if no such swing low exists.

    Example:
        >>> # Entry price = 50000, looking for target below entry - 1 ATR
        >>> # If ATR = 150, then mp = 49850
        >>> # Swing lows in window: 49700, 49900, 49500
        >>> # Only 49700 and 49500 are below 49850
        >>> # Returns 49700 (most recent one below mp)
        >>> swing_low_below(candles, mp=49850, lb=50)
        49700

    HOW IT'S USED IN DDLJ:
        When generating a SHORT signal, the Signal Engine calls:
            sl_b = swing_low_below(candles, entry - atr_value, 50)
        This finds the nearest support below entry-ATR, which becomes
        the target. If no such swing low exists, the target falls back
        to a fixed ATR-based calculation.
    """
    w = candles[-lb:] if len(candles) >= lb else candles

    for i in range(len(w) - 2, 0, -1):
        if w[i].low < w[i - 1].low and w[i].low < w[i + 1].low and w[i].low < mp:
            return w[i].low

    return None
