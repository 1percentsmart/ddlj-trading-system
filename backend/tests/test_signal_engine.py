"""
DDLJ Trading System — Signal Engine Tests
============================================
Tests the EMA crossover signal engine with mock candle data.
"""

import pytest
from datetime import datetime
from unittest.mock import MagicMock

import sys
from pathlib import Path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from engine.signal_engine import EMACrossSignal, Signal
from engine.candle_data import Candle, CandleBuffer
from engine.bias_engine import HTFBias


def make_candle(close, open_=None, high=None, low=None, volume=1000, idx=0):
    """Create a mock Candle object."""
    if open_ is None:
        open_ = close - 5
    if high is None:
        high = close + 10
    if low is None:
        low = close - 10
    return Candle(
        symbol="BANKNIFTY",
        ts=datetime(2026, 4, 30, 9, 15 + idx),
        open=open_,
        high=high,
        low=low,
        close=close,
        volume=volume,
        timeframe="15m",
    )


def make_bias(direction="BULLISH", reason="test"):
    """Create an HTFBias with the given direction, filling defaults."""
    return HTFBias(
        direction=direction,
        ema_value=50000.0,
        slope_pct=0.01,
        atr_value=265.0,
        hh_ll_structure="HH",
        structure_reason="test",
        reason=reason,
    )


class TestSignal:
    """Tests for the Signal dataclass."""

    def test_signal_defaults(self):
        """Test Signal dataclass creation with defaults."""
        sig = Signal("NO_SIGNAL", "warming up")
        assert sig.signal == "NO_SIGNAL"
        assert sig.entry == 0
        assert sig.sl == 0
        assert sig.target == 0
        assert sig.rr == 0
        assert sig.direction == "LONG"

    def test_signal_with_values(self):
        """Test Signal dataclass with all values set."""
        sig = Signal(
            "LONG", "EMA cross",
            entry=53000.0, sl=52700.0, target=53500.0,
            rr=2.5, risk=300.0, reward=500.0,
            ema=52950.0, atr_val=265.0,
            direction="LONG", sl_method="ATR",
        )
        assert sig.signal == "LONG"
        assert sig.entry == 53000.0
        assert sig.rr == 2.5
        assert sig.sl_method == "ATR"


class TestSignalEngine:
    """Tests for EMACrossSignal engine."""

    def test_engine_initialization(self):
        """Test engine initializes with correct parameters."""
        engine = EMACrossSignal(
            ema_period=10,
            atr_period=7,
            sl_atr=1.5,
            min_rr=2.0,
        )
        assert engine.ema_period == 10
        assert engine.atr_period == 7
        assert engine.sl_atr == 1.5
        assert engine.min_rr == 2.0

    def test_engine_default_parameters(self):
        """Test engine initializes with defaults from config."""
        engine = EMACrossSignal()
        assert engine.ema_period is not None
        assert engine.atr_period is not None
        assert engine.sl_atr is not None
        assert engine.min_rr is not None

    def test_warmup_returns_no_signal(self):
        """Test that insufficient data returns NO_SIGNAL."""
        engine = EMACrossSignal(ema_period=20, atr_period=14)
        buf = CandleBuffer(2000)

        # Push only 5 candles (not enough for warmup)
        for i in range(5):
            buf.push(make_candle(50000 + i * 10, idx=i))

        bias = make_bias("BULLISH")
        signal = engine.evaluate(buf, bias)
        assert signal.signal == "NO_SIGNAL"
        assert "warm" in signal.reason.lower()

    def test_neutral_bias_no_signal(self):
        """Test that NEUTRAL bias produces NO_SIGNAL."""
        engine = EMACrossSignal(ema_period=5, atr_period=5)
        buf = CandleBuffer(2000)

        for i in range(30):
            buf.push(make_candle(50000 + i * 10, idx=i))

        bias = make_bias("NEUTRAL")
        signal = engine.evaluate(buf, bias)
        assert signal.signal == "NO_SIGNAL"
        assert "NEUTRAL" in signal.reason or "bias" in signal.reason.lower()

    def test_bearish_bias_no_long(self):
        """Test that BEARISH bias doesn't produce LONG signals."""
        engine = EMACrossSignal(ema_period=5, atr_period=5)
        buf = CandleBuffer(2000)

        # Steadily rising prices
        for i in range(30):
            buf.push(make_candle(50000 + i * 50, idx=i))

        bias = make_bias("BEARISH")
        signal = engine.evaluate(buf, bias)
        # With BEARISH bias, should not generate LONG signal
        assert signal.signal != "LONG"

    def test_no_ema_returns_no_signal(self):
        """Test that no valid EMA produces NO_SIGNAL."""
        engine = EMACrossSignal(ema_period=5, atr_period=5)
        buf = CandleBuffer(2000)

        # Only 3 candles, not enough for EMA period 5
        for i in range(3):
            buf.push(make_candle(50000 + i * 10, idx=i))

        bias = make_bias("BULLISH")
        signal = engine.evaluate(buf, bias)
        assert signal.signal == "NO_SIGNAL"

    def test_flat_prices_no_signal(self):
        """Test that flat prices produce NO_SIGNAL (no crossover)."""
        engine = EMACrossSignal(ema_period=5, atr_period=5)
        buf = CandleBuffer(2000)

        # Flat prices — no crossover possible
        for i in range(30):
            buf.push(make_candle(50000.0, open_=50000.0, high=50005.0, low=49995.0, idx=i))

        bias = make_bias("BULLISH")
        signal = engine.evaluate(buf, bias)
        assert signal.signal == "NO_SIGNAL"


class TestCandleBuffer:
    """Tests for CandleBuffer functionality."""

    def test_push_and_length(self):
        """Test pushing candles and checking length."""
        buf = CandleBuffer(100)
        assert len(buf) == 0

        for i in range(5):
            buf.push(make_candle(50000 + i * 10, idx=i))
        assert len(buf) == 5

    def test_is_ready(self):
        """Test is_ready warmup check."""
        buf = CandleBuffer(100)
        assert buf.is_ready(10) is False

        for i in range(10):
            buf.push(make_candle(50000 + i, idx=i))
        assert buf.is_ready(10) is True

    def test_last(self):
        """Test getting last N candles."""
        buf = CandleBuffer(100)
        for i in range(10):
            buf.push(make_candle(50000 + i, idx=i))

        last3 = buf.last(3)
        assert len(last3) == 3
        assert last3[0].close == 50007
        assert last3[2].close == 50009

    def test_closes(self):
        """Test getting close prices."""
        buf = CandleBuffer(100)
        for i in range(5):
            buf.push(make_candle(50000 + i * 100, idx=i))

        closes = buf.closes()
        assert closes == [50000, 50100, 50200, 50300, 50400]

    def test_maxlen_overflow(self):
        """Test that buffer respects maxlen."""
        buf = CandleBuffer(5)
        for i in range(10):
            buf.push(make_candle(50000 + i, idx=i))

        # Should only keep the last 5
        assert len(buf) == 5
        closes = buf.closes()
        assert closes[0] == 50005  # First 5 were dropped


class TestCandle:
    """Tests for Candle dataclass properties."""

    def test_bullish_candle(self):
        """Test bullish candle properties."""
        c = make_candle(50100, open_=50000)
        assert c.is_bullish is True
        assert c.is_bearish is False
        assert c.body_size == 100

    def test_bearish_candle(self):
        """Test bearish candle properties."""
        c = make_candle(50000, open_=50100)
        assert c.is_bearish is True
        assert c.is_bullish is False
        assert c.body_size == 100

    def test_candle_range(self):
        """Test candle range property."""
        c = make_candle(50100, open_=50000, high=50200, low=49900)
        assert c.range == 300  # high - low

    def test_candle_wicks(self):
        """Test candle wick properties."""
        c = make_candle(50100, open_=50000, high=50200, low=49900)
        assert c.upper_wick == 100  # high - max(open, close)
        assert c.lower_wick == 100  # min(open, close) - low


class TestHTFBias:
    """Tests for HTFBias dataclass."""

    def test_bias_creation(self):
        """Test creating HTFBias with all fields."""
        bias = HTFBias(
            direction="BULLISH",
            ema_value=53000.0,
            slope_pct=0.015,
            atr_value=265.0,
            hh_ll_structure="HH",
            structure_reason="bull=2",
            reason="HH/HL + above EMA",
        )
        assert bias.direction == "BULLISH"
        assert bias.ema_value == 53000.0
        assert bias.reason == "HH/HL + above EMA"

    def test_neutral_bias(self):
        """Test creating a NEUTRAL HTFBias."""
        bias = make_bias("NEUTRAL")
        assert bias.direction == "NEUTRAL"

    def test_bearish_bias(self):
        """Test creating a BEARISH HTFBias."""
        bias = HTFBias(
            direction="BEARISH",
            ema_value=53000.0,
            slope_pct=-0.01,
            atr_value=265.0,
            hh_ll_structure="LL",
            structure_reason="bear=2",
            reason="LL/LH + below EMA",
        )
        assert bias.direction == "BEARISH"
