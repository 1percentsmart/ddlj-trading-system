#!/usr/bin/env python3
"""
DDLJ v9 Strategy — Sample/Demo Data Generator
=================================================

Generates realistic synthetic candle data for BANKNIFTY and NIFTY so that
the backtest can run even without a Kite API connection.

WHY: When no cached data exists and the Kite API is unreachable (token
     invalid, network error, rate limit), _fetch_data_if_needed() returns
     an empty list, causing the backtest to produce zero trades. This module
     provides a fallback that generates plausible OHLCV data with realistic
     intraday patterns, trends, and volatility so strategies can be tested.

Data format matches Kite API output:
    list[dict] with keys: date, open, high, low, close, volume

Author: DDLJ Strategy Team
Version: 10.3.0
"""

import random
import logging
from datetime import date, datetime, timedelta

import pytz

log = logging.getLogger("ddlj_v9")

IST = pytz.timezone("Asia/Kolkata")

# Realistic base prices for indices
BASE_PRICES = {
    "BANKNIFTY": 48500.0,
    "NIFTY": 22500.0,
}

# Price ranges (min, max) for each index
PRICE_RANGES = {
    "BANKNIFTY": (48000, 52000),
    "NIFTY": (22000, 25000),
}

# Typical daily volatility (as fraction of price)
DAILY_VOLATILITY = {
    "BANKNIFTY": 0.012,   # ~1.2% daily move
    "NIFTY": 0.009,       # ~0.9% daily move
}

# Typical intraday range as fraction of price
INTRADAY_RANGE = {
    "BANKNIFTY": 0.008,   # ~0.8% intraday range
    "NIFTY": 0.006,       # ~0.6% intraday range
}

# Average volume per candle (approximate)
BASE_VOLUMES = {
    "BANKNIFTY": {"5m": 250000, "15m": 750000, "60m": 3000000},
    "NIFTY": {"5m": 400000, "15m": 1200000, "60m": 4800000},
}

# Interval mapping: our short name -> minutes
INTERVAL_MINUTES = {
    "5m": 5,
    "15m": 15,
    "60m": 60,
}

# Kite API interval strings
INTERVAL_KITE_MAP = {
    "5m": "5minute",
    "15m": "15minute",
    "60m": "60minute",
}


def _is_trading_day(d: date) -> bool:
    """Check if a date is a trading day (Mon-Fri, excludes major Indian holidays)."""
    if d.weekday() >= 5:  # Saturday=5, Sunday=6
        return False

    # Major Indian holidays (approximate — not exhaustive)
    year = d.year
    holidays = set()

    # Republic Day
    holidays.add(date(year, 1, 26))
    # Holi (approximate — usually March)
    # We skip movable holidays for simplicity
    # Independence Day
    holidays.add(date(year, 8, 15))
    # Gandhi Jayanti
    holidays.add(date(year, 10, 2))
    # Christmas
    holidays.add(date(year, 12, 25))

    return d not in holidays


def _generate_intraday_candles(
    symbol: str,
    trading_date: date,
    interval: str,
    prev_close: float,
    daily_bias: float,
) -> list:
    """
    Generate intraday candles for a single trading day.

    Args:
        symbol: "BANKNIFTY" or "NIFTY"
        trading_date: The date to generate candles for
        interval: "5m", "15m", or "60m"
        prev_close: Previous day's closing price
        daily_bias: Overall daily direction bias (positive=bullish, negative=bearish)

    Returns:
        list[dict]: List of candle dicts with keys: date, open, high, low, close, volume
    """
    minutes = INTERVAL_MINUTES[interval]
    base_volume = BASE_VOLUMES[symbol][interval]
    vol_fraction = DAILY_VOLATILITY[symbol]
    range_fraction = INTRADAY_RANGE[symbol]

    # Market hours: 9:15 AM to 3:30 PM IST
    market_open_minutes = 9 * 60 + 15   # 555
    market_close_minutes = 15 * 60 + 30  # 930
    total_trading_minutes = market_close_minutes - market_open_minutes  # 375

    candles = []
    current_price = prev_close
    bars_in_day = total_trading_minutes // minutes

    # Daily open gap (small gap up/down based on bias)
    gap = prev_close * random.gauss(daily_bias * 0.3, vol_fraction * 0.3)
    day_open = prev_close + gap

    # Target close for the day
    day_target = prev_close * (1 + daily_bias)

    # Step size toward target per bar
    step_per_bar = (day_target - day_open) / max(bars_in_day, 1)

    current_price = day_open

    bar_num = 0
    for minute_offset in range(0, total_trading_minutes, minutes):
        bar_num += 1
        total_min = market_open_minutes + minute_offset
        hour = total_min // 60
        minute = total_min % 60

        ts = IST.localize(datetime(trading_date.year, trading_date.month, trading_date.day,
                                    hour, minute, 0))

        # Intrabar volatility — higher at open and close, lower midday
        # U-shaped intraday volatility pattern
        bar_progress = bar_num / bars_in_day
        if bar_progress < 0.1 or bar_progress > 0.85:
            vol_mult = 1.4  # Higher vol at open/close
        elif 0.3 < bar_progress < 0.6:
            vol_mult = 0.7  # Lunch lull
        else:
            vol_mult = 1.0

        # Random walk with drift toward daily target
        drift = step_per_bar * random.uniform(0.5, 1.5)
        noise = current_price * random.gauss(0, vol_fraction * vol_mult / (bars_in_day ** 0.5))

        open_price = current_price
        mid_price = open_price + drift + noise

        # Intraday range for this bar
        bar_range = abs(mid_price - open_price) + current_price * range_fraction * vol_mult * random.uniform(0.3, 1.0) / (bars_in_day ** 0.5)

        if mid_price >= open_price:
            high = mid_price + bar_range * random.uniform(0.1, 0.5)
            low = open_price - bar_range * random.uniform(0.1, 0.5)
        else:
            high = open_price + bar_range * random.uniform(0.1, 0.5)
            low = mid_price - bar_range * random.uniform(0.1, 0.5)

        close_price = mid_price + current_price * random.gauss(0, vol_fraction * 0.1 / (bars_in_day ** 0.5))

        # Ensure OHLC consistency
        high = max(high, open_price, close_price)
        low = min(low, open_price, close_price)

        # Ensure low > 0
        low = max(low, current_price * 0.95)

        # Volume — higher at open and close, random variation
        if bar_progress < 0.08 or bar_progress > 0.88:
            vol_mult_v = random.uniform(1.5, 2.5)
        elif 0.35 < bar_progress < 0.55:
            vol_mult_v = random.uniform(0.4, 0.8)
        else:
            vol_mult_v = random.uniform(0.8, 1.3)

        volume = int(base_volume * vol_mult_v * random.uniform(0.7, 1.3))

        candles.append({
            "date": ts.isoformat(),
            "open": round(open_price, 2),
            "high": round(high, 2),
            "low": round(low, 2),
            "close": round(close_price, 2),
            "volume": float(volume),
        })

        current_price = close_price

    return candles


def generate_sample_data(
    symbol: str,
    from_date: date,
    to_date: date,
    interval: str = "15m",
    seed: int = 42,
) -> list:
    """
    Generate realistic synthetic candle data for BANKNIFTY or NIFTY.

    Produces data with:
      - Realistic price levels (BankNifty ~48-52K, Nifty ~22-25K)
      - Proper OHLCV with intraday patterns (U-shaped volume/volatility)
      - Trending behavior with mean reversion
      - Support for 5m, 15m, 60m intervals
      - Only trading days (Mon-Fri, excluding major holidays)

    Args:
        symbol: "BANKNIFTY" or "NIFTY"
        from_date: Start date for data generation
        to_date: End date for data generation
        interval: Candle interval — "5m", "15m", or "60m"
        seed: Random seed for reproducibility

    Returns:
        list[dict]: Candle data in Kite API format (keys: date, open, high, low, close, volume)
    """
    random.seed(seed)

    if symbol not in BASE_PRICES:
        raise ValueError(f"Unknown symbol '{symbol}'. Must be 'BANKNIFTY' or 'NIFTY'.")

    if interval not in INTERVAL_MINUTES:
        raise ValueError(f"Unknown interval '{interval}'. Must be '5m', '15m', or '60m'.")

    price_min, price_max = PRICE_RANGES[symbol]
    base_price = BASE_PRICES[symbol]

    all_candles = []
    current_price = base_price
    current_day = from_date

    # Generate a multi-day trend cycle to ensure the strategy produces trades
    # We create alternating trend phases: bullish → bearish → bullish → ...
    trading_days = []
    d = from_date
    while d <= to_date:
        if _is_trading_day(d):
            trading_days.append(d)
        d += timedelta(days=1)

    if not trading_days:
        log.warning("No trading days in range %s → %s", from_date, to_date)
        return []

    total_trading_days = len(trading_days)
    log.info("Generating sample data for %s (%s, %s → %s): %d trading days",
             symbol, interval, from_date, to_date, total_trading_days)

    # Create trend phases — each phase lasts 5-15 trading days
    phase_length = random.randint(8, 15)
    phase_direction = random.choice([1, -1])
    day_in_phase = 0

    for i, trading_date in enumerate(trading_days):
        day_in_phase += 1

        # Switch trend phase periodically
        if day_in_phase > phase_length:
            day_in_phase = 1
            phase_length = random.randint(5, 15)
            # Tend to reverse direction (70% chance), but can continue (30%)
            if random.random() < 0.7:
                phase_direction *= -1
            # Occasionally go neutral
            if random.random() < 0.15:
                phase_direction = 0

        # Daily bias based on trend phase
        # Stronger at the start of a phase, weakening toward the end
        phase_strength = 1.0 - (day_in_phase / phase_length) * 0.5
        daily_bias = phase_direction * DAILY_VOLATILITY[symbol] * phase_strength * random.uniform(0.3, 1.2)

        # Mean reversion — if price drifts too far from range, pull it back
        price_mid = (price_min + price_max) / 2
        price_range_half = (price_max - price_min) / 2
        distance_from_mid = (current_price - price_mid) / price_range_half
        # Stronger pullback near the edges
        mean_reversion = -distance_from_mid * DAILY_VOLATILITY[symbol] * 0.3
        daily_bias += mean_reversion

        # Add some random daily shocks
        daily_bias += random.gauss(0, DAILY_VOLATILITY[symbol] * 0.3)

        # Generate intraday candles
        day_candles = _generate_intraday_candles(
            symbol, trading_date, interval, current_price, daily_bias
        )
        all_candles.extend(day_candles)

        # Update current price to the day's close
        if day_candles:
            current_price = day_candles[-1]["close"]

    log.info("Generated %d candles for %s (%s): price range %.0f - %.0f",
             len(all_candles), symbol, interval,
             min(c["low"] for c in all_candles) if all_candles else 0,
             max(c["high"] for c in all_candles) if all_candles else 0)

    return all_candles


def generate_sample_data_kite_format(
    symbol: str,
    from_date: date,
    to_date: date,
    kite_interval: str = "15minute",
    seed: int = 42,
) -> list:
    """
    Generate sample data using Kite API interval strings.

    Convenience wrapper that converts Kite interval names (e.g., "15minute")
    to our short names (e.g., "15m") before calling generate_sample_data.

    Args:
        symbol: "BANKNIFTY" or "NIFTY"
        from_date: Start date
        to_date: End date
        kite_interval: Kite API interval string ("5minute", "15minute", "60minute")
        seed: Random seed for reproducibility

    Returns:
        list[dict]: Candle data in Kite API format
    """
    # Convert Kite interval to our short name
    reverse_map = {v: k for k, v in INTERVAL_KITE_MAP.items()}
    interval = reverse_map.get(kite_interval, "15m")

    return generate_sample_data(symbol, from_date, to_date, interval, seed)
