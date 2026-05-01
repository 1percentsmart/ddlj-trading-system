"""
Strategy timing tests.

These tests guard against two trader-facing failure modes:
1. Backtests using higher-timeframe candles before they are complete.
2. Live paper trading processing a still-forming candle.
"""

from datetime import datetime, timedelta

import pytz

from engine.backtester import run_backtest_enhanced
from engine.bias_engine import HTFBias
from engine.candle_data import Candle, candle_close_time, timeframe_to_minutes
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
        def fetch_candles_chunked(self, *_args, **_kwargs):
            return [
                {"date": completed.isoformat(), "open": 1, "high": 2, "low": 0.5, "close": 1.5, "volume": 100},
                {"date": forming.isoformat(), "open": 2, "high": 3, "low": 1.5, "close": 2.5, "volume": 100},
            ]

    monkeypatch.setattr("engine.paper_trader.datetime", FixedDatetime)
    trader = PaperTrader(config_override={"NOTIFY_ON_TRADE": False})
    trader.fetcher = Fetcher()

    candle = trader._fetch_latest_candle(123, "15minute")

    assert candle is not None
    assert candle.ts == completed
    assert candle.close == 1.5
