#!/usr/bin/env python3
"""
DDLJ v9 Strategy — Signal Engine (Entry/Exit Signal Generation)
=================================================================

Generates actual LONG/SHORT entry signals on the entry timeframe.
The Bias Engine tells us the DIRECTION, the Signal Engine tells us the TIMING.

Looks for EMA crossover patterns with conviction:
  - Pattern 1 (EMA Cross): Price crosses above/below EMA with body >= 0.3*ATR
  - Pattern 2 (Continuation): Pullback followed by resumption with larger body

Author: DDLJ Strategy Team
Version: 9.0 (Paper Trading Production)
"""

from dataclasses import dataclass

from .indicators import ema_series, atr, swing_high_above, swing_low_below
from .config import (
    SIGNAL_EMA_PERIOD,
    SIGNAL_ATR_PERIOD,
    SL_ATR_MULTIPLIER,
    MIN_RISK_REWARD_RATIO,
    MIN_TARGET_ATR,
    MIN_BODY_ATR,
    EMA_BUFFER_ATR,
)


@dataclass
class Signal:
    """
    Trading signal — the complete entry specification for a potential trade.

    Attributes:
        signal (str): "LONG", "SHORT", or "NO_SIGNAL"
        reason (str): Human-readable explanation
        entry (float): Suggested entry price
        sl (float): Stop loss price
        target (float): Target (take-profit) price
        rr (float): Risk-Reward ratio
        risk (float): Risk in points
        reward (float): Reward in points
        ema (float): EMA value at signal time
        atr_val (float): ATR value at signal time
        direction (str): "LONG" or "SHORT"
        sl_method (str): Stop loss method — "ATR"
    """
    signal: str
    reason: str
    entry: float = 0
    sl: float = 0
    target: float = 0
    rr: float = 0
    risk: float = 0
    reward: float = 0
    ema: float = 0
    atr_val: float = 0
    direction: str = "LONG"
    sl_method: str = "ATR"


class EMACrossSignal:
    """
    EMA Crossover signal generator with bias confirmation.

    Example:
        >>> engine = EMACrossSignal(sl_atr=2.0, min_rr=1.5)
        >>> signal = engine.evaluate(candle_buffer, bias)
        >>> if signal.signal == "LONG":
        ...     print(f"Entry: {signal.entry}, SL: {signal.sl}")
    """

    def __init__(self, ema_period=None, atr_period=None, sl_atr=None,
                 min_rr=None, min_target_atr=None, min_body_atr=None,
                 ema_buffer=None):
        self.ema_period = ema_period if ema_period is not None else SIGNAL_EMA_PERIOD
        self.atr_period = atr_period if atr_period is not None else SIGNAL_ATR_PERIOD
        self.sl_atr = sl_atr if sl_atr is not None else SL_ATR_MULTIPLIER
        self.min_rr = min_rr if min_rr is not None else MIN_RISK_REWARD_RATIO
        self.min_target_atr = min_target_atr if min_target_atr is not None else MIN_TARGET_ATR
        self.min_body_atr = min_body_atr if min_body_atr is not None else MIN_BODY_ATR
        self.ema_buffer = ema_buffer if ema_buffer is not None else EMA_BUFFER_ATR

    def evaluate(self, buf_entry, bias):
        """
        Evaluate the entry timeframe for a valid trading signal.

        Args:
            buf_entry (CandleBuffer): Candle buffer for the entry timeframe.
            bias (HTFBias): The current bias from the Bias Engine.

        Returns:
            Signal: The complete signal or NO_SIGNAL with reason.
        """
        mn = max(self.ema_period, self.atr_period + 1) + 5

        if not buf_entry.is_ready(mn):
            return Signal("NO_SIGNAL", "warming up")

        if bias.direction not in ("BULLISH", "BEARISH"):
            return Signal("NO_SIGNAL", f"bias={bias.direction}")

        candles = buf_entry.last(60)
        closes = [c.close for c in candles]
        ev = ema_series(closes, self.ema_period)
        ve = [v for v in ev if v is not None]

        if not ve:
            return Signal("NO_SIGNAL", "no ema")

        if len(ve) < 2:
            return Signal("NO_SIGNAL", "ema warming up")

        cur_ema = ve[-1]
        prev_ema = ve[-2]

        try:
            ca = atr(candles, self.atr_period)
        except ValueError:
            return Signal("NO_SIGNAL", "no atr")

        cur = candles[-1]
        prev = candles[-2]

        # BULLISH SIGNAL DETECTION
        if bias.direction == "BULLISH":
            # Pattern 1: EMA Cross — prev close below prev EMA, current close above cur EMA
            if prev.close < prev_ema - self.ema_buffer * ca:
                if cur.close > cur_ema + self.ema_buffer * ca:
                    if cur.is_bullish and cur.body_size >= self.min_body_atr * ca:
                        return self._make_long(cur, cur_ema, ca, candles)

            # Pattern 2: Bullish continuation after pullback
            if cur.is_bullish and cur.close > cur_ema + self.ema_buffer * ca:
                if cur.body_size >= self.min_body_atr * ca * 1.5:
                    if prev.is_bearish and prev.close < prev_ema:
                        return self._make_long(cur, cur_ema, ca, candles)

            return Signal("NO_SIGNAL", "no long setup")

        # BEARISH SIGNAL DETECTION
        # Pattern 1: EMA Cross — prev close above prev EMA, current close below cur EMA
        if prev.close > prev_ema + self.ema_buffer * ca:
            if cur.close < cur_ema - self.ema_buffer * ca:
                if cur.is_bearish and cur.body_size >= self.min_body_atr * ca:
                    return self._make_short(cur, cur_ema, ca, candles)

        # Pattern 2: Bearish continuation after pullback
        if cur.is_bearish and cur.close < cur_ema - self.ema_buffer * ca:
            if cur.body_size >= self.min_body_atr * ca * 1.5:
                if prev.is_bullish and prev.close > prev_ema:
                    return self._make_short(cur, cur_ema, ca, candles)

        return Signal("NO_SIGNAL", "no short setup")

    def _make_long(self, cur, ema, ca, candles):
        """Generate a LONG signal with entry, stop loss, and target."""
        entry = cur.close + 0.5
        sl = round(entry - self.sl_atr * ca, 2)
        risk = entry - sl
        if risk <= 0:
            return Signal("NO_SIGNAL", "invalid risk")

        min_tgt = entry + self.min_target_atr * ca
        sh = swing_high_above(candles, entry + ca, 50)
        target = round(max(sh or min_tgt, min_tgt), 2)

        reward = target - entry
        rr = reward / risk if risk > 0 else 0

        if rr < self.min_rr:
            rr_sl = entry - reward / self.min_rr
            if rr_sl > 0 and (entry - rr_sl) < 4 * ca:
                sl = round(rr_sl, 2)
                risk = entry - sl
                rr = self.min_rr
            else:
                return Signal("NO_SIGNAL", f"RR={rr:.2f}")

        return Signal(
            "LONG", f"LONG EMA cross RR={rr:.2f}",
            entry, sl, target, rr, risk, reward, ema, ca,
            "LONG", "ATR"
        )

    def _make_short(self, cur, ema, ca, candles):
        """Generate a SHORT signal with entry, stop loss, and target."""
        entry = cur.close - 0.5
        sl = round(entry + self.sl_atr * ca, 2)
        risk = sl - entry
        if risk <= 0:
            return Signal("NO_SIGNAL", "invalid risk")

        min_tgt = entry - self.min_target_atr * ca
        sl_b = swing_low_below(candles, entry - ca, 50)
        target = round(min(sl_b or min_tgt, min_tgt), 2)

        reward = entry - target
        rr = reward / risk if risk > 0 else 0

        if rr < self.min_rr:
            rr_sl = entry + reward / self.min_rr
            if rr_sl > 0 and (rr_sl - entry) < 4 * ca:
                sl = round(rr_sl, 2)
                risk = sl - entry
                rr = self.min_rr
            else:
                return Signal("NO_SIGNAL", f"RR={rr:.2f}")

        return Signal(
            "SHORT", f"SHORT EMA cross RR={rr:.2f}",
            entry, sl, target, rr, risk, reward, ema, ca,
            "SHORT", "ATR"
        )
