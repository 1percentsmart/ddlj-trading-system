#!/usr/bin/env python3
"""
DDLJ v9 Strategy — Bias Engine (Market Direction Detection)
==============================================================

Determines the OVERALL market direction on a higher timeframe (HTF).
Combines THREE independent signals:
  1. EMA Position (price above/below EMA)
  2. EMA Slope (EMA rising/falling)
  3. Market Structure (HH/HL vs LL/LH)

SAFETY: If price is > 3x ATR from EMA, goes NEUTRAL (overextended).

Author: DDLJ Strategy Team
Version: 9.0 (Paper Trading Production)
"""

from dataclasses import dataclass

from .indicators import ema_series, atr, ema_slope_pct
from .config import BIAS_EMA_PERIOD, BIAS_ATR_PERIOD, BIAS_STRUCTURE_LOOKBACK


@dataclass
class HTFBias:
    """
    Higher Timeframe Bias result — the complete market direction assessment.

    Attributes:
        direction (str): "BULLISH", "BEARISH", or "NEUTRAL"
        ema_value (float): Current EMA value on the HTF.
        slope_pct (float): EMA slope as percentage.
        atr_value (float): Current ATR on the HTF.
        hh_ll_structure (str): "HH", "HL", "LL", "LH", or "FLAT"
        structure_reason (str): Human-readable explanation of structure.
        reason (str): Human-readable explanation of the FINAL bias decision.
    """
    direction: str
    ema_value: float
    slope_pct: float
    atr_value: float
    hh_ll_structure: str
    structure_reason: str
    reason: str


class BiasEngine:
    """
    Market direction detection engine using EMA, slope, and structure.

    Example:
        >>> engine = BiasEngine(ema_period=20, atr_period=14)
        >>> bias = engine.evaluate(candle_buffer)
        >>> print(bias.direction)   # "BULLISH"
        >>> print(bias.reason)      # "HH/HL + above EMA"
    """

    def __init__(self, ema_period=None, atr_period=None, structure_lookback=None):
        self.ema_period = ema_period if ema_period is not None else BIAS_EMA_PERIOD
        self.atr_period = atr_period if atr_period is not None else BIAS_ATR_PERIOD
        self.structure_lookback = structure_lookback if structure_lookback is not None else BIAS_STRUCTURE_LOOKBACK

    def _detect_structure(self, candles):
        """
        Detect market structure by analyzing swing highs and swing lows.

        Returns:
            tuple[str, str]: (structure, reason)
                structure: "HH", "HL", "LL", "LH", or "FLAT"
                reason: Human-readable explanation
        """
        lb = self.structure_lookback
        w = candles[-lb:] if len(candles) >= lb else candles

        if len(w) < 5:
            return "FLAT", "insufficient"

        sh = []
        sl = []
        for i in range(1, len(w) - 1):
            if w[i].high > w[i - 1].high and w[i].high > w[i + 1].high:
                sh.append(w[i].high)
            if w[i].low < w[i - 1].low and w[i].low < w[i + 1].low:
                sl.append(w[i].low)

        bull = 0
        bear = 0

        if len(sh) >= 2:
            if sh[-1] > sh[-2]:
                bull += 2
            elif sh[-1] < sh[-2]:
                bear += 1

        if len(sl) >= 2:
            if sl[-1] > sl[-2]:
                bull += 1
            elif sl[-1] < sl[-2]:
                bear += 2

        if bull >= 2 and bear == 0:
            return "HH", f"bull={bull}"
        if bull >= 1 and bear == 0:
            return "HL", f"bull={bull}"
        if bear >= 2 and bull == 0:
            return "LL", f"bear={bear}"
        if bear >= 1 and bull == 0:
            return "LH", f"bear={bear}"

        return "FLAT", f"b={bull},br={bear}"

    def evaluate(self, buf):
        """
        Evaluate the market direction on the higher timeframe.

        Args:
            buf (CandleBuffer): The candle buffer containing HTF candles.

        Returns:
            HTFBias: The complete bias assessment.
        """
        mn = max(self.ema_period, self.atr_period + 1) + 5

        if not buf.is_ready(mn):
            return HTFBias("NEUTRAL", 0, 0, 0, "FLAT", "warmup", "warming up")

        candles = buf.last(mn + self.structure_lookback)
        recent = buf.last(mn)

        closes = [c.close for c in recent]
        ev = ema_series(closes, self.ema_period)
        ve = [v for v in ev if v is not None]

        if not ve:
            return HTFBias("NEUTRAL", 0, 0, 0, "FLAT", "no ema", "no ema")

        ce = ve[-1]
        cc = recent[-1].close

        try:
            ca = atr(recent, self.atr_period)
        except ValueError:
            return HTFBias("NEUTRAL", ce, 0, 0, "FLAT", "no atr", "no atr")

        slope = ema_slope_pct(ve, 3)
        dist = (cc - ce) / ca if ca > 0 else 0

        struct, sr = self._detect_structure(candles)

        # Overextension check
        if dist > 3.0:
            return HTFBias("NEUTRAL", ce, slope, ca, struct, sr,
                           f"overextended +{dist:.1f}x ATR")
        if dist < -3.0:
            return HTFBias("NEUTRAL", ce, slope, ca, struct, sr,
                           f"overextended {dist:.1f}x ATR")

        sb = struct in ("HH", "HL")
        sbr = struct in ("LL", "LH")

        # PRIORITY 1: Structure + EMA position agree
        if sb and cc > ce:
            return HTFBias("BULLISH", ce, slope, ca, struct, sr, "HH/HL + above EMA")
        if sbr and cc < ce:
            return HTFBias("BEARISH", ce, slope, ca, struct, sr, "LL/LH + below EMA")

        # PRIORITY 2: Slope + EMA position agree
        if slope > 0.005 and cc > ce:
            return HTFBias("BULLISH", ce, slope, ca, struct, sr, "slope up + above EMA")
        if slope < -0.005 and cc < ce:
            return HTFBias("BEARISH", ce, slope, ca, struct, sr, "slope down + below EMA")

        # PRIORITY 3: EMA position alone
        if cc > ce * 1.002:
            return HTFBias("BULLISH", ce, slope, ca, struct, sr, "price above EMA")
        if cc < ce * 0.998:
            return HTFBias("BEARISH", ce, slope, ca, struct, sr, "price below EMA")

        return HTFBias("NEUTRAL", ce, slope, ca, struct, sr,
                       f"neutral ({struct}, slope={slope:.4f}%)")
