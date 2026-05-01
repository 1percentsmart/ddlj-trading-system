"""
Strategy timing tests.

These tests guard against two trader-facing failure modes:
1. Backtests using higher-timeframe candles before they are complete.
2. Live paper trading processing a still-forming candle.
"""

import json
from datetime import date, datetime, timedelta

import pytz
import pytest

from engine.backtester import run_backtest_enhanced
from engine.bias_engine import HTFBias
from engine.candle_data import Candle, candle_close_time, timeframe_to_minutes
from engine.data_fetcher import KiteDataFetcher
from engine.paper_trader import PaperTrader
from engine.signal_engine import Signal


IST = pytz.timezone("Asia/Kolkata")


def make_candle(ts, close=50000.0, tf="15m"):
    return Candle(
        symbol="BANKNIFTY",
        ts=ts,
        open=close - 10,
        high=close + 20,
        low=close - 20,
        close=close,
        volume=1000,
        timeframe=tf,
    )


class RecordingBiasEngine:
    def evaluate(self, buf):
        last = buf.last(1)
        bias = HTFBias("NEUTRAL", 0, 0, 0, "FLAT", "test", "test")
        bias.last_bias_ts = last[0].ts if last else None
        return bias


class RecordingSignalEngine:
    def __init__(self):
        self.calls = []

    def evaluate(self, buf_entry, bias):
        entry = buf_entry.last(1)[0]
        self.calls.append((entry.ts, getattr(bias, "last_bias_ts", None)))
        return Signal("NO_SIGNAL", "test")


def test_backtest_does_not_use_unclosed_higher_timeframe_bias_candle():
    start = IST.localize(datetime(2026, 4, 30, 9, 15))
    entry_candles = [
        make_candle(start + timedelta(minutes=15 * i), close=50000 + i, tf="15m")
        for i in range(60)
    ]
    bias_candles = [
        make_candle(start, close=50100, tf="60m"),
        make_candle(start + timedelta(minutes=60), close=50200, tf="60m"),
    ]

    signal_engine = RecordingSignalEngine()
    run_backtest_enhanced(
        "BANKNIFTY",
        entry_candles,
        bias_candles,
        signal_engine,
        RecordingBiasEngine(),
        options_engine=None,
        entry_tf_minutes=15,
    )

    calls = dict(signal_engine.calls)

    # Entry candle stamped 09:45 closes at 10:00; the 09:15 60m bias candle
    # closes at 10:15 and must not be visible yet.
    assert calls[start + timedelta(minutes=30)] is None

    # Entry candle stamped 10:00 closes at 10:15, so the 09:15 60m candle is
    # now complete and can be used without lookahead.
    assert calls[start + timedelta(minutes=45)] == start


def test_candle_close_time_for_app_and_kite_timeframes():
    ts = IST.localize(datetime(2026, 4, 30, 9, 15))
    candle = make_candle(ts, tf="60m")

    assert timeframe_to_minutes("60minute") == 60
    assert timeframe_to_minutes("15m") == 15
    assert candle_close_time(candle) == ts + timedelta(minutes=60)


def test_live_fetch_latest_candle_ignores_current_incomplete_candle(monkeypatch):
    now = IST.localize(datetime(2026, 4, 30, 10, 20))
    completed = now - timedelta(minutes=20)  # 10:00 15m candle completed at 10:15
    forming = now - timedelta(minutes=5)     # 10:15 15m candle completes at 10:30

    class FixedDatetime(datetime):
        @classmethod
        def now(cls, tz=None):
            return now if tz else now.replace(tzinfo=None)

    class Fetcher:
        def __init__(self):
            self.kwargs = None

        def fetch_candles_chunked(self, *_args, **kwargs):
            self.kwargs = kwargs
            return [
                {"date": completed.isoformat(), "open": 1, "high": 2, "low": 0.5, "close": 1.5, "volume": 100},
                {"date": forming.isoformat(), "open": 2, "high": 3, "low": 1.5, "close": 2.5, "volume": 100},
            ]

    monkeypatch.setattr("engine.paper_trader.datetime", FixedDatetime)
    trader = PaperTrader(config_override={"NOTIFY_ON_TRADE": False})
    fetcher = Fetcher()
    trader.fetcher = fetcher

    candle = trader._fetch_latest_candle(123, "15minute")

    assert candle is not None
    assert candle.ts == completed
    assert candle.close == 1.5
    assert fetcher.kwargs["use_cache"] is False
    assert fetcher.kwargs["write_cache"] is False
    assert fetcher.kwargs["raise_on_error"] is True


def test_live_fetch_marks_trader_disconnected_on_auth_error():
    class AuthFailFetcher:
        def fetch_candles_chunked(self, *_args, **_kwargs):
            raise RuntimeError("TokenException: invalid access token")

    trader = object.__new__(PaperTrader)
    trader.trade_index = "BANKNIFTY"
    trader.fetcher = AuthFailFetcher()
    trader._connected = True

    candle = trader._fetch_latest_candle(123, "15minute")

    assert candle is None
    assert trader._connected is False


def test_live_fetcher_can_bypass_stale_current_day_cache(tmp_path):
    class FakeKite:
        def __init__(self):
            self.calls = 0

        def historical_data(self, *_args, **_kwargs):
            self.calls += 1
            return [
                {
                    "date": IST.localize(datetime(2026, 4, 30, 10, 0)),
                    "open": 10,
                    "high": 12,
                    "low": 9,
                    "close": 11,
                    "volume": 100,
                }
            ]

    fetcher = object.__new__(KiteDataFetcher)
    fetcher.kite = FakeKite()
    fetcher.rate_limit_delay = 0
    fetcher._last_call_time = 0
    fetcher._call_count = 0
    fetcher._error_count = 0
    fetcher.CACHE_DIR = tmp_path

    from_date = date(2026, 4, 30)
    to_date = date(2026, 5, 1)
    stale_path = fetcher._cache_path(123, "15minute", from_date, to_date)
    stale_path.write_text(json.dumps([
        {
            "date": IST.localize(datetime(2026, 4, 30, 9, 45)).isoformat(),
            "open": 1,
            "high": 2,
            "low": 0.5,
            "close": 1.5,
            "volume": 100,
        }
    ]))

    cached = fetcher.fetch_candles_chunked(123, from_date, to_date, "15minute")
    fresh = fetcher.fetch_candles_chunked(
        123, from_date, to_date, "15minute",
        use_cache=False, write_cache=False, raise_on_error=True,
    )

    assert cached[0]["close"] == 1.5
    assert fresh[0]["close"] == 11
    assert fetcher.kite.calls == 1
    assert json.loads(stale_path.read_text())[0]["close"] == 1.5


def test_live_fetcher_can_raise_api_errors_for_reconnect_logic(tmp_path):
    class FailingKite:
        def historical_data(self, *_args, **_kwargs):
            raise RuntimeError("TokenException: invalid access token")

    fetcher = object.__new__(KiteDataFetcher)
    fetcher.kite = FailingKite()
    fetcher.rate_limit_delay = 0
    fetcher._last_call_time = 0
    fetcher._call_count = 0
    fetcher._error_count = 0
    fetcher.CACHE_DIR = tmp_path

    with pytest.raises(RuntimeError, match="TokenException"):
        fetcher.fetch_candles_chunked(
            123,
            date(2026, 4, 30),
            date(2026, 5, 1),
            "15minute",
            use_cache=False,
            write_cache=False,
            raise_on_error=True,
        )


class CountingSignalEngine:
    def __init__(self):
        self.calls = 0

    def evaluate(self, _buf_entry, _bias):
        self.calls += 1
        return Signal(
            "LONG",
            "test",
            entry=50000,
            sl=49900,
            target=50200,
            rr=2,
            risk=100,
            reward=200,
            atr_val=50,
            direction="LONG",
        )


def test_backtest_uses_candle_close_time_for_entry_cutoff():
    candle_start = IST.localize(datetime(2026, 4, 30, 14, 0))
    signal_engine = CountingSignalEngine()

    run_backtest_enhanced(
        "BANKNIFTY",
        [make_candle(candle_start, close=50000, tf="15m")],
        [],
        signal_engine,
        RecordingBiasEngine(),
        options_engine=None,
        entry_tf_minutes=15,
    )

    # The 14:00 candle is only actionable at 14:15, exactly the configured
    # entry cutoff, so the signal engine must not be asked for a new entry.
    assert signal_engine.calls == 0


def test_paper_trader_stop_persists_state():
    trader = object.__new__(PaperTrader)
    trader._running = True
    trader.current_capital = 50000
    trader.open_positions = [object()]
    trader.closed_trades = []
    notifications = []
    saved = {"called": False}

    def save_state():
        saved["called"] = True

    trader._save_state = save_state
    trader._notify = notifications.append

    trader.stop()

    assert trader._running is False
    assert saved["called"] is True
    assert any("Session state saved" in msg for msg in notifications)
