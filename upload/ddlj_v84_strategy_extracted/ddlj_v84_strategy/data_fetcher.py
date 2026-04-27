#!/usr/bin/env python3
"""
DDLJ v8.4 Strategy — Kite Data Fetcher
========================================

This module provides production-grade historical data fetching from
Zerodha's Kite Connect API. It handles:

  - Chunked fetching: Respects API rate limits per interval
  - Auto-retry: Exponential backoff on API errors
  - Rate limiting: Max ~3 requests/second to avoid throttling
  - Local caching: Avoids re-downloading previously fetched data
  - Batch fetching: Multiple symbols in one session
  - Instrument resolution: NSE EQ + NFO FUT token lookup

KITE API LIMITS (per call):
  - minute (1m):    max 7 days
  - 5minute:        max 60 days
  - 15minute:       max 60 days
  - 60minute:       max 365 days
  - day:            max 2000 days

WHY CHUNKED FETCHING?
    If you request 6 months of 5-minute data in one call, Kite will
    reject it. You must break the request into chunks that respect
    the interval-specific limits. This module handles that automatically.

Author: DDLJ Strategy Team
Version: 8.4 (Production)
"""

import os
import json
import time
import logging
from datetime import datetime, date, timedelta
from pathlib import Path

import pytz

# Kite API interval → max days per request
# These are hard limits set by Zerodha. Exceeding them causes API errors.
INTERVAL_LIMITS = {
    "minute":    7,     # 1-minute candles: max 7 days per call
    "5minute":   60,    # 5-minute candles: max 60 days per call
    "15minute":  60,    # 15-minute candles: max 60 days per call
    "60minute":  365,   # 60-minute candles: max 365 days per call
    "day":       2000,  # Daily candles: max 2000 days per call
}

IST = pytz.timezone("Asia/Kolkata")
log = logging.getLogger("kite_fetcher")


class KiteDataFetcher:
    """
    Production-grade Kite historical data fetcher with chunking and caching.

    This class handles the entire data pipeline:
      1. Authenticate with Kite API
      2. Resolve instrument tokens (symbol → numeric token)
      3. Fetch historical data in API-respectful chunks
      4. Cache results locally for future runs
      5. Batch process multiple symbols efficiently

    Example:
        >>> fetcher = KiteDataFetcher("api_key", "access_token")
        >>> # Fetch 3 months of 5-minute data
        >>> data = fetcher.fetch_candles_chunked(
        ...     260105,  # BankNifty index token
        ...     date(2025, 11, 1),
        ...     date(2026, 1, 31),
        ...     interval="5minute"
        ... )
    """

    CACHE_DIR = Path("/home/z/my-project/kite_cache")

    def __init__(self, api_key: str, access_token: str, rate_limit_delay: float = 0.35):
        """
        Initialize the data fetcher.

        Args:
            api_key (str): Kite Connect API key from https://kite.trade
            access_token (str): Valid access token (obtain via token_manager)
            rate_limit_delay (float, optional): Minimum seconds between API
                calls. Default: 0.35 (≈3 calls/second).
                WHY 0.35s? Zerodha allows ~3 requests/second. This delay
                ensures we stay within limits even with network latency.
        """
        try:
            from kiteconnect import KiteConnect
        except ImportError:
            raise ImportError(
                "kiteconnect is required. Install with: pip install kiteconnect"
            )

        self.kite = KiteConnect(api_key=api_key)
        self.kite.set_access_token(access_token)
        self.rate_limit_delay = rate_limit_delay
        self._last_call_time = 0.0
        self._instrument_cache = {}
        self._call_count = 0
        self._error_count = 0

        # Ensure cache directory exists
        self.CACHE_DIR.mkdir(parents=True, exist_ok=True)

    def _rate_limit(self):
        """
        Enforce rate limiting between API calls.

        Waits if the time since the last call is less than rate_limit_delay.
        This prevents exceeding Zerodha's ~3 requests/second limit.
        """
        elapsed = time.time() - self._last_call_time
        if elapsed < self.rate_limit_delay:
            time.sleep(self.rate_limit_delay - elapsed)
        self._last_call_time = time.time()

    def _api_call(self, func, *args, max_retries=3, **kwargs):
        """
        Make an API call with retry logic and rate limiting.

        Uses exponential backoff: 2s, 4s, 8s between retries.
        WHY exponential? If the API is down or rate-limiting, waiting
        longer between retries increases the chance of success.

        Args:
            func: The Kite API function to call.
            *args: Positional arguments for the function.
            max_retries (int): Maximum number of retry attempts.
            **kwargs: Keyword arguments for the function.

        Returns:
            The API response.

        Raises:
            Exception: If all retries fail.
        """
        for attempt in range(max_retries):
            try:
                self._rate_limit()
                result = func(*args, **kwargs)
                self._call_count += 1
                return result
            except Exception as e:
                self._error_count += 1
                if attempt < max_retries - 1:
                    wait = (2 ** attempt) * 2  # 2, 4, 8 seconds
                    log.warning(
                        "API error (attempt %d/%d): %s. Retrying in %ds...",
                        attempt + 1, max_retries, e, wait
                    )
                    time.sleep(wait)
                else:
                    log.error("API error after %d attempts: %s", max_retries, e)
                    raise

    def get_nse_instruments(self, force_refresh=False) -> list:
        """
        Get all NSE instruments (with daily caching).

        Args:
            force_refresh (bool): If True, re-fetch even if cached.
                Default: False.

        Returns:
            list[dict]: List of instrument dictionaries.
        """
        cache_file = self.CACHE_DIR / "nse_instruments.json"

        if not force_refresh and cache_file.exists():
            age = time.time() - cache_file.stat().st_mtime
            if age < 86400:  # Less than 1 day old
                with open(cache_file) as f:
                    return json.load(f)

        instruments = self._api_call(self.kite.instruments, "NSE")

        # Convert date objects to strings for JSON serialization
        data = []
        for inst in instruments:
            item = {}
            for k, v in inst.items():
                if isinstance(v, (date, datetime)):
                    item[k] = v.isoformat()
                else:
                    item[k] = v
            data.append(item)

        with open(cache_file, "w") as f:
            json.dump(data, f)

        return data

    def get_nfo_instruments(self, force_refresh=False) -> list:
        """
        Get all NFO (derivatives) instruments (with daily caching).

        Args:
            force_refresh (bool): If True, re-fetch even if cached.

        Returns:
            list[dict]: List of instrument dictionaries.
        """
        cache_file = self.CACHE_DIR / "nfo_instruments.json"

        if not force_refresh and cache_file.exists():
            age = time.time() - cache_file.stat().st_mtime
            if age < 86400:
                with open(cache_file) as f:
                    return json.load(f)

        instruments = self._api_call(self.kite.instruments, "NFO")

        data = []
        for inst in instruments:
            item = {}
            for k, v in inst.items():
                if isinstance(v, (date, datetime)):
                    item[k] = v.isoformat()
                else:
                    item[k] = v
            data.append(item)

        with open(cache_file, "w") as f:
            json.dump(data, f)

        return data

    def resolve_instrument_token(self, symbol: str, exchange: str = "NSE",
                                  instrument_type: str = "EQ") -> int | None:
        """
        Resolve a trading symbol to its Kite instrument token.

        Args:
            symbol (str): Trading symbol (e.g., "RELIANCE", "TCS").
            exchange (str): Exchange ("NSE" or "NFO").
            instrument_type (str): Instrument type ("EQ", "FUT", etc.).

        Returns:
            int | None: Instrument token, or None if not found.
        """
        cache_key = f"{symbol}_{exchange}_{instrument_type}"
        if cache_key in self._instrument_cache:
            return self._instrument_cache[cache_key]

        if exchange == "NSE":
            instruments = self.get_nse_instruments()
        elif exchange == "NFO":
            instruments = self.get_nfo_instruments()
        else:
            return None

        for inst in instruments:
            if (inst.get("tradingsymbol") == symbol and
                inst.get("exchange") == exchange and
                inst.get("instrument_type") == instrument_type):
                token = inst.get("instrument_token")
                self._instrument_cache[cache_key] = token
                return token

        return None

    def resolve_future_token(self, symbol: str) -> int | None:
        """
        Resolve the current month's futures contract token for an index.

        Args:
            symbol (str): Index name ("NIFTY" or "BANKNIFTY").

        Returns:
            int | None: Instrument token for the nearest futures contract.
        """
        cache_key = f"{symbol}_FUT"
        if cache_key in self._instrument_cache:
            return self._instrument_cache[cache_key]

        instruments = self.get_nfo_instruments()
        today_str = date.today().isoformat()

        candidates = []
        for inst in instruments:
            if (inst.get("name") == symbol and
                inst.get("instrument_type") == "FUT" and
                inst.get("exchange") == "NFO"):
                expiry_str = inst.get("expiry", "")
                if expiry_str and expiry_str >= today_str:
                    candidates.append(inst)

        if candidates:
            candidates.sort(key=lambda x: x.get("expiry", "9999-12-31"))
            token = candidates[0].get("instrument_token")
            self._instrument_cache[cache_key] = token
            return token

        return None

    def _cache_path(self, instrument_token: int, interval: str,
                     from_date: date, to_date: date) -> Path:
        """
        Get the cache file path for a specific data range.

        Args:
            instrument_token (int): Instrument token.
            interval (str): Candle interval.
            from_date (date): Start date.
            to_date (date): End date.

        Returns:
            Path: Cache file path.
        """
        return self.CACHE_DIR / f"{instrument_token}_{interval}_{from_date}_{to_date}.json"

    def fetch_candles_chunked(self, instrument_token: int,
                               from_date: date, to_date: date,
                               interval: str = "5minute") -> list:
        """
        Fetch historical candles in chunks respecting API limits.

        This is the main data fetching method. It automatically:
          1. Breaks the date range into API-compliant chunks
          2. Checks the local cache before fetching
          3. Fetches missing chunks from the API
          4. Caches each chunk for future use

        Args:
            instrument_token (int): Kite instrument token.
            from_date (date): Start date.
            to_date (date): End date.
            interval (str): Candle interval ("minute", "5minute",
                "15minute", "60minute", "day"). Default: "5minute".

        Returns:
            list[dict]: List of candle dictionaries with keys:
                "date", "open", "high", "low", "close", "volume".
        """
        max_days = INTERVAL_LIMITS.get(interval, 60)
        all_candles = []
        current = from_date
        chunk_num = 0

        while current < to_date:
            chunk_end = min(current + timedelta(days=max_days - 1), to_date)
            chunk_num += 1

            # Check cache first
            cache_file = self._cache_path(instrument_token, interval, current, chunk_end)
            if cache_file.exists():
                try:
                    with open(cache_file) as f:
                        chunk_data = json.load(f)
                    all_candles.extend(chunk_data)
                    log.info("  Chunk %d: %s → %s = %d candles (cached)",
                             chunk_num, current, chunk_end, len(chunk_data))
                    current = chunk_end + timedelta(days=1)
                    continue
                except (json.JSONDecodeError, OSError) as e:
                    log.warning("  Cache corrupt for %s: %s. Re-fetching.", cache_file, e)

            # Fetch from API
            try:
                data = self._api_call(
                    self.kite.historical_data,
                    instrument_token,
                    from_date=current.isoformat(),
                    to_date=chunk_end.isoformat(),
                    interval=interval,
                )

                # Convert to serializable format
                chunk_data = []
                for d in data:
                    ts = d["date"]
                    if isinstance(ts, str):
                        ts_str = ts
                    elif isinstance(ts, datetime):
                        ts_str = ts.isoformat()
                    else:
                        ts_str = str(ts)

                    chunk_data.append({
                        "date": ts_str,
                        "open": float(d["open"]),
                        "high": float(d["high"]),
                        "low": float(d["low"]),
                        "close": float(d["close"]),
                        "volume": float(d["volume"]),
                    })

                all_candles.extend(chunk_data)

                # Cache this chunk
                try:
                    with open(cache_file, "w") as f:
                        json.dump(chunk_data, f)
                except OSError as e:
                    log.warning("  Failed to cache: %s", e)

                log.info("  Chunk %d: %s → %s = %d candles",
                         chunk_num, current, chunk_end, len(chunk_data))

            except Exception as e:
                log.error("  Chunk %d: %s → %s FAILED: %s", chunk_num, current, chunk_end, e)

            current = chunk_end + timedelta(days=1)

        return all_candles

    def fetch_batch(self, symbols: list, from_date: date, to_date: date,
                     interval: str = "5minute", include_futures: bool = True) -> dict:
        """
        Fetch historical data for multiple symbols in batch.

        Args:
            symbols (list[str]): Trading symbols (e.g., ["RELIANCE", "TCS"]).
            from_date (date): Start date.
            to_date (date): End date.
            interval (str): Candle interval. Default: "5minute".
            include_futures (bool): Include NIFTY/BANKNIFTY futures.
                Default: True.

        Returns:
            dict: {symbol: list[candle_dict]}
        """
        results = {}
        token_map = {}

        for sym in symbols:
            token = self.resolve_instrument_token(sym, "NSE", "EQ")
            if token:
                token_map[sym] = (token, sym)
            else:
                log.warning("  Could not resolve token for %s", sym)

        if include_futures:
            for idx in ["NIFTY", "BANKNIFTY"]:
                token = self.resolve_future_token(idx)
                if token:
                    token_map[f"{idx}_FUT"] = (token, f"{idx} Futures")

        print(f"\n{'='*60}")
        print(f"  BATCH DATA FETCH")
        print(f"  {len(token_map)} symbols | {interval} | {from_date} → {to_date}")
        print(f"{'='*60}")

        for i, (sym, (token, display)) in enumerate(token_map.items()):
            print(f"\n  [{i+1}/{len(token_map)}] {display} (token: {token})...")
            try:
                candles = self.fetch_candles_chunked(token, from_date, to_date, interval)
                results[sym] = candles
                print(f"    → {len(candles)} candles fetched")
            except Exception as e:
                print(f"    → FAILED: {e}")
                results[sym] = []

        total_candles = sum(len(v) for v in results.values())
        successful = sum(1 for v in results.values() if len(v) > 0)
        print(f"\n{'='*60}")
        print(f"  BATCH COMPLETE: {successful}/{len(token_map)} symbols, "
              f"{total_candles} total candles")
        print(f"  API calls: {self._call_count} | Errors: {self._error_count}")
        print(f"{'='*60}")

        return results

    def get_stats(self) -> dict:
        """
        Return fetcher statistics.

        Returns:
            dict: {"api_calls": int, "errors": int, "cached_instruments": int}
        """
        return {
            "api_calls": self._call_count,
            "errors": self._error_count,
            "cached_instruments": len(self._instrument_cache),
        }


# ═══════════════════════════════════════════════════════════════════════════
# NIFTY 100 STOCKS — Pre-defined list for batch fetching
# ═══════════════════════════════════════════════════════════════════════════

NIFTY100_STOCKS = [
    "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "HINDUNILVR",
    "ITC", "SBIN", "BHARTIARTL", "LT", "KOTAKBANK", "AXISBANK",
    "ASIANPAINT", "BAJFINANCE", "MARUTI", "TITAN", "SUNPHARMA", "WIPRO",
    "ULTRACEMCO", "TATAMOTORS", "HCLTECH", "ONGC", "NTPC", "POWERGRID",
    "COALINDIA", "ADANIENT", "TECHM", "BAJAJFINSV", "TATASTEEL", "HINDALCO",
    "DRREDDY", "CIPLA", "GRASIM", "BPCL", "HEROMOTOCO", "EICHERMOT",
    "DIVISLAB", "TATACONSUM", "BRITANNIA", "M&M", "APOLLOHOSP", "HDFCLIFE",
    "SBILIFE", "ICICIGI", "ICICIPRULI", "PIDILITIND", "HAVELLS", "DABUR",
    "VEDL", "JSWSTEEL", "SHREECEM", "INDUSINDBK", "BANDHANBNK", "IDFCFIRSTB",
    "AUBANK", "PNB", "BANKBARODA", "CANBK", "UNIONBANK", "IOC",
    "TATACHEM", "ATGL", "NAUKRI", "DALBHARAT", "AMBUJACEM", "ACC",
    "GAIL", "NHPC", "RECLTD", "PNBHOUSING", "MFSL", "CHOLAFIN",
    "MUTHOOTFIN", "BAJAJHLDNG", "SIEMENS", "PERSISTENT", "LTTS",
    "MPHASIS", "COFORGE", "LTIM", "PAGEIND", "MARICO", "GODREJCP",
    "COLPAL", "HINDZINC", "NMDC", "SAIL", "RATNAMANI", "BEL",
    "HAL", "TORNTPHARM", "ABBOTINDIA", "ZYDUSLIFE", "BIOCON", "LAURUSLABS",
    "CUMMINSIND", "ASHOKLEY", "CONCOR", "DELHIVERY",
]

# Remove duplicates while preserving order
NIFTY100_STOCKS = list(dict.fromkeys(NIFTY100_STOCKS))
