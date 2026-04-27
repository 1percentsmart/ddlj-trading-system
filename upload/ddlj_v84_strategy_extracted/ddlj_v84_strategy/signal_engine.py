#!/usr/bin/env python3
"""
DDLJ v8.4 Strategy — Signal Engine (Entry/Exit Signal Generation)
=================================================================

The Signal Engine generates actual LONG/SHORT entry signals on the
entry timeframe. It's the "trigger" that tells us WHEN to enter a trade.

WHY A SEPARATE SIGNAL ENGINE?
------------------------------
The Bias Engine tells us the DIRECTION (bullish/bearish/neutral).
The Signal Engine tells us the TIMING (when exactly to enter).

Having these as separate engines is critical because:
  1. They operate on different timeframes (HTF for bias, LTF for signals)
  2. A market can be bullish but not have an entry signal yet
  3. This separation prevents overtrading — we only enter when BOTH
     the direction (bias) AND timing (signal) align

HOW IT WORKS:
  The Signal Engine looks for EMA crossover patterns — moments when
  price crosses above or below the EMA with conviction.

  FOR A LONG SIGNAL (in a BULLISH bias):
    Pattern 1 (EMA Cross): Previous candle closed BELOW EMA, current
      candle closes ABOVE EMA → Price just crossed the EMA upward.
      Requires: bullish candle body ≥ 0.3 × ATR (filters weak crosses)

    Pattern 2 (Continuation): Current candle is bullish and above EMA,
      previous candle was bearish → Pullback followed by resumption.
      Requires: larger body size (1.5× normal) for extra conviction.

  FOR A SHORT SIGNAL (in a BEARISH bias):
    Mirror image of the LONG patterns.

  STOP LOSS: Entry ± (SL_MULTIPLIER × ATR) from entry price
  TARGET: Nearest swing high/low above/below entry, or ATR-based minimum
  MIN RISK-REWARD: Only take trades with RR ≥ min_rr (default 1.5)

Author: DDLJ Strategy Team
Version: 8.4 (Production)
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

    When the Signal Engine detects a valid entry setup, it produces this
    dataclass with ALL the information needed to execute the trade:

    Attributes:
        signal (str): Signal type.
            "LONG"      → Buy signal (expect price to go up)
            "SHORT"     → Sell signal (expect price to go down)
            "NO_SIGNAL" → No valid entry setup detected

        reason (str): Human-readable explanation of why this signal was
            generated (or not). Examples:
            - "LONG EMA cross RR=2.15" (good signal)
            - "bias=NEUTRAL" (no signal because market is neutral)
            - "RR=0.85" (no signal because risk-reward too low)
            WHY a reason? Essential for trade journaling and debugging.

        entry (float): Suggested entry price. For LONG: close + 0.5
            (slightly above the candle close to account for slippage).
            For SHORT: close - 0.5.
            WHY +0.5/-0.5? This is a small buffer to ensure we actually
            get filled. In real trading, you often can't buy at the
            exact close price due to market microstructure.

        sl (float): Stop loss price. For LONG: entry - (SL_MULTIPLIER × ATR).
            For SHORT: entry + (SL_MULTIPLIER × ATR).
            This is where we exit if the trade goes against us.

        target (float): Target (take-profit) price. Based on the nearest
            swing high (for LONG) or swing low (for SHORT), with a
            minimum distance of MIN_TARGET_ATR × ATR from entry.

        rr (float): Risk-Reward ratio. reward / risk.
            Must be ≥ MIN_RISK_REWARD_RATIO (default 1.5).
            WHY minimum RR? If the potential reward doesn't justify the
            risk, the trade isn't worth taking over the long run.

        risk (float): Risk in points (distance from entry to stop loss).
        reward (float): Reward in points (distance from entry to target).
        ema (float): EMA value at the time of signal.
        atr_val (float): ATR value at the time of signal.
        direction (str): Trade direction — "LONG" or "SHORT".
        sl_method (str): Stop loss method — "ATR" (always).
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

    This engine generates LONG/SHORT signals when price crosses the EMA
    with sufficient conviction (body size, volume proxy, direction alignment).

    KEY FEATURES:
      - Requires bias confirmation (only LONG in bullish, SHORT in bearish)
      - EMA buffer zone prevents false signals at the EMA boundary
      - Minimum body size filter rejects weak candles (dojis)
      - Risk-reward ratio enforcement (minimum 1.5:1)
      - Dynamic target based on market structure (swing points)

    Example:
        >>> engine = EMACrossSignal(sl_atr=2.0, min_rr=1.5)
        >>> signal = engine.evaluate(candle_buffer, bias)
        >>> if signal.signal == "LONG":
        ...     print(f"Entry: {signal.entry}, SL: {signal.sl}, "
        ...           f"Target: {signal.target}, RR: {signal.rr}")
    """

    def __init__(self, ema_period=None, atr_period=None, sl_atr=None,
                 min_rr=None, min_target_atr=None, min_body_atr=None,
                 ema_buffer=None):
        """
        Initialize the Signal Engine.

        Args:
            ema_period (int, optional): EMA period. Default from config (20).
            atr_period (int, optional): ATR period. Default from config (14).
            sl_atr (float, optional): Stop loss = SL_ATR × ATR from entry.
                Default from config (2.0).
                WHY 2.0? Backtesting shows 2× ATR gives the best balance:
                - 1.5× ATR: Too tight, gets stopped out by normal noise
                - 2.0× ATR: Good balance of protection and room to breathe
                - 2.5× ATR: Too wide, takes too much risk per trade

            min_rr (float, optional): Minimum risk-reward ratio.
                Default from config (1.5).
                WHY 1.5? With a 50% win rate and 1.5:1 RR, you're
                profitable: 0.50 × 1.5 - 0.50 × 1.0 = 0.25 (25% edge).

            min_target_atr (float, optional): Minimum target distance in ATR.
                Default from config (1.5).

            min_body_atr (float, optional): Minimum candle body in ATR.
                Default from config (0.3).
                WHY 0.3? A body smaller than 0.3× ATR is a "doji" —
                it shows indecision, not conviction.

            ema_buffer (float, optional): EMA buffer in ATR for cross detection.
                Default from config (0.1).
                WHY 0.1? Price must cross ABOVE (EMA + 0.1×ATR) to confirm
                a real cross. This tiny buffer prevents signals when price
                is just touching the EMA without conviction.
        """
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

        STEP-BY-STEP PROCESS:
          1. Check if we have enough candles (warm-up period)
          2. Check if the bias supports trading (BULLISH or BEARISH)
          3. Calculate EMA and ATR on the entry timeframe
          4. Look for EMA crossover patterns
          5. Validate candle quality (body size, direction)
          6. Calculate entry, stop loss, target, and risk-reward
          7. Return signal or NO_SIGNAL with reason

        Args:
            buf_entry (CandleBuffer): Candle buffer for the entry timeframe.
                Contains the most recent candles on the LTF (lower timeframe).
            bias (HTFBias): The current bias from the Bias Engine.
                Must be BULLISH for LONG signals, BEARISH for SHORT signals.

        Returns:
            Signal: The complete signal with entry/SL/target/RR, or
                NO_SIGNAL with a reason explaining why no entry was found.

        Example:
            >>> signal = engine.evaluate(buf_entry, bias)
            >>> if signal.signal == "LONG":
            ...     print(f"BUY at {signal.entry}, SL at {signal.sl}")
        """
        # Minimum candles needed
        mn = max(self.ema_period, self.atr_period + 1) + 5

        # Not enough data
        if not buf_entry.is_ready(mn):
            return Signal("NO_SIGNAL", "warming up")

        # No trade without a directional bias
        if bias.direction not in ("BULLISH", "BEARISH"):
            return Signal("NO_SIGNAL", f"bias={bias.direction}")

        # Get recent candles and calculate indicators
        candles = buf_entry.last(60)
        closes = [c.close for c in candles]
        ev = ema_series(closes, self.ema_period)
        ve = [v for v in ev if v is not None]

        if not ve:
            return Signal("NO_SIGNAL", "no ema")

        ce = ve[-1]  # Current EMA value

        try:
            ca = atr(candles, self.atr_period)
        except ValueError:
            return Signal("NO_SIGNAL", "no atr")

        cur = candles[-1]   # Current (latest) candle
        prev = candles[-2]  # Previous candle

        # ── BULLISH SIGNAL DETECTION ──
        if bias.direction == "BULLISH":
            # Pattern 1: EMA Cross — price crossed from below to above EMA
            # Previous close was below EMA (minus buffer), current close
            # is above EMA (plus buffer). This is a classic crossover.
            if prev.close < ce - self.ema_buffer * ca:
                if cur.close > ce + self.ema_buffer * ca:
                    # Must be a bullish candle with sufficient body
                    if cur.is_bullish and cur.body_size >= self.min_body_atr * ca:
                        return self._make_long(cur, ce, ca, candles)

            # Pattern 2: Bullish continuation after pullback
            # Current candle is bullish and above EMA, previous was bearish
            # (pullback), and the body is large (conviction to resume).
            # Requires 1.5× the normal body size for extra confirmation.
            #
            # FIX #5: Added check that prev.close < ce (the previous candle
            # should have been at or near the EMA — a REAL pullback to EMA,
            # not just any bearish candle above EMA). Without this check,
            # a bearish candle far above EMA followed by a bullish candle
            # would trigger a false "continuation" signal.
            if cur.is_bullish and cur.close > ce + self.ema_buffer * ca:
                if cur.body_size >= self.min_body_atr * ca * 1.5:
                    if prev.is_bearish and prev.close < ce:
                        return self._make_long(cur, ce, ca, candles)

            return Signal("NO_SIGNAL", "no long setup")

        # ── BEARISH SIGNAL DETECTION ──
        # Pattern 1: EMA Cross — price crossed from above to below EMA
        if prev.close > ce + self.ema_buffer * ca:
            if cur.close < ce - self.ema_buffer * ca:
                if cur.is_bearish and cur.body_size >= self.min_body_atr * ca:
                    return self._make_short(cur, ce, ca, candles)

        # Pattern 2: Bearish continuation after pullback
        # FIX #5: Same fix as LONG — previous candle should have been above
        # EMA (a real pullback toward EMA from below), not just any bullish
        # candle below EMA.
        if cur.is_bearish and cur.close < ce - self.ema_buffer * ca:
            if cur.body_size >= self.min_body_atr * ca * 1.5:
                if prev.is_bullish and prev.close > ce:
                    return self._make_short(cur, ce, ca, candles)

        return Signal("NO_SIGNAL", "no short setup")

    def _make_long(self, cur, ema, ca, candles):
        """
        Generate a LONG signal with entry, stop loss, and target.

        ENTRY: close + 0.5 (slight buffer above the close)
        SL: entry - (SL_ATR × ATR) — below entry by the SL distance
        TARGET: max(nearest swing high above entry+ATR, entry + MIN_TARGET_ATR × ATR)

        RR CHECK: If reward/risk < min_rr, we try to widen the stop loss
        to achieve the minimum RR (up to 4× ATR risk). If that's still
        not enough, we reject the signal.

        Args:
            cur (Candle): The current (signal) candle.
            ema (float): Current EMA value.
            ca (float): Current ATR value.
            candles (list): Recent candles for swing point detection.

        Returns:
            Signal: A LONG signal with all parameters, or NO_SIGNAL.
        """
        # Entry price: slightly above the close to ensure fill
        entry = cur.close + 0.5

        # Stop loss: below entry by SL_ATR × ATR
        sl = round(entry - self.sl_atr * ca, 2)

        # Risk = distance from entry to stop loss
        risk = entry - sl
        if risk <= 0:
            return Signal("NO_SIGNAL", "invalid risk")

        # Minimum target based on ATR
        min_tgt = entry + self.min_target_atr * ca

        # Target: use nearest swing high above entry+ATR if available,
        # otherwise use the ATR-based minimum target
        sh = swing_high_above(candles, entry + ca, 50)
        target = round(max(sh or min_tgt, min_tgt), 2)

        # Reward = distance from entry to target
        reward = target - entry
        rr = reward / risk if risk > 0 else 0

        # RR CHECK: If RR is below minimum, try adjusting stop loss
        if rr < self.min_rr:
            # Calculate what SL would need to be for minimum RR
            rr_sl = entry - reward / self.min_rr
            # Only accept if the adjusted SL isn't too wide (≤ 4× ATR risk)
            if rr_sl > 0 and (entry - rr_sl) < 4 * ca:
                sl = round(rr_sl, 2)
                risk = entry - sl
                rr = self.min_rr
            else:
                return Signal("NO_SIGNAL", f"RR={rr:.2f}")

        return Signal(
            "LONG",
            f"LONG EMA cross RR={rr:.2f}",
            entry, sl, target, rr, risk, reward, ema, ca,
            "LONG", "ATR"
        )

    def _make_short(self, cur, ema, ca, candles):
        """
        Generate a SHORT signal with entry, stop loss, and target.

        Mirror image of _make_long():
        ENTRY: close - 0.5 (slight buffer below the close)
        SL: entry + (SL_ATR × ATR) — above entry by the SL distance
        TARGET: min(nearest swing low below entry-ATR, entry - MIN_TARGET_ATR × ATR)

        Args:
            cur (Candle): The current (signal) candle.
            ema (float): Current EMA value.
            ca (float): Current ATR value.
            candles (list): Recent candles for swing point detection.

        Returns:
            Signal: A SHORT signal with all parameters, or NO_SIGNAL.
        """
        # Entry price: slightly below the close to ensure fill
        entry = cur.close - 0.5

        # Stop loss: above entry by SL_ATR × ATR
        sl = round(entry + self.sl_atr * ca, 2)

        # Risk = distance from stop loss to entry
        risk = sl - entry
        if risk <= 0:
            return Signal("NO_SIGNAL", "invalid risk")

        # Minimum target based on ATR
        min_tgt = entry - self.min_target_atr * ca

        # Target: use nearest swing low below entry-ATR if available
        sl_b = swing_low_below(candles, entry - ca, 50)
        target = round(min(sl_b or min_tgt, min_tgt), 2)

        # Reward = distance from entry to target
        reward = entry - target
        rr = reward / risk if risk > 0 else 0

        # RR CHECK
        if rr < self.min_rr:
            rr_sl = entry + reward / self.min_rr
            if rr_sl > 0 and (rr_sl - entry) < 4 * ca:
                sl = round(rr_sl, 2)
                risk = sl - entry
                rr = self.min_rr
            else:
                return Signal("NO_SIGNAL", f"RR={rr:.2f}")

        return Signal(
            "SHORT",
            f"SHORT EMA cross RR={rr:.2f}",
            entry, sl, target, rr, risk, reward, ema, ca,
            "SHORT", "ATR"
        )
