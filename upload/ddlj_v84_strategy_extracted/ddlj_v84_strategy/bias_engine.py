#!/usr/bin/env python3
"""
DDLJ v8.4 Strategy — Bias Engine (Market Direction Detection)
==============================================================

The Bias Engine determines the OVERALL market direction on a higher
timeframe (HTF). It answers the question: "Is this market BULLISH,
BEARISH, or NEUTRAL right now?"

WHY A BIAS ENGINE?
------------------
The DDLJ strategy only takes trades IN THE DIRECTION of the trend.
If the bias is BULLISH, we only look for LONG entries. If BEARISH,
only SHORT entries. If NEUTRAL, we don't trade at all.

This is the single most important filter in the strategy. Without it,
the strategy would take trades against the trend, which is the #1
cause of losses in trend-following systems.

HOW IT WORKS:
  1. Compute the EMA on the higher timeframe → identifies the trend
  2. Compute the EMA slope → confirms the trend direction
  3. Detect market structure (HH/HL/LL/LH) → confirms with price action
  4. Check for overextension → avoids chasing overextended markets
  5. Combine all signals into a single BULLISH/BEARISH/NEUTRAL verdict

MARKET STRUCTURE:
  HH (Higher Highs)  → Bullish — each peak is higher than the last
  HL (Higher Lows)   → Bullish — each valley is higher than the last
  LL (Lower Lows)    → Bearish — each valley is lower than the last
  LH (Lower Highs)   → Bearish — each peak is lower than the last
  FLAT               → No clear structure — market is chopping

Author: DDLJ Strategy Team
Version: 8.4 (Production)
"""

from dataclasses import dataclass

from .indicators import ema_series, atr, ema_slope_pct
from .config import BIAS_EMA_PERIOD, BIAS_ATR_PERIOD, BIAS_STRUCTURE_LOOKBACK


@dataclass
class HTFBias:
    """
    Higher Timeframe Bias result — the complete market direction assessment.

    This dataclass captures not just the direction, but ALL the reasoning
    behind it. This is crucial for debugging and understanding WHY the
    strategy took (or didn't take) a particular trade.

    Attributes:
        direction (str): The final bias verdict.
            "BULLISH"  → Market is trending up, look for LONG entries
            "BEARISH"  → Market is trending down, look for SHORT entries
            "NEUTRAL"  → No clear direction, don't trade
            WHY NEUTRAL? Trading in a choppy market is the fastest way
            to lose money. NEUTRAL means "sit on your hands".

        ema_value (float): Current EMA value on the higher timeframe.
            Used to determine if price is above/below the trend line.

        slope_pct (float): EMA slope as a percentage.
            Positive = EMA rising (bullish), Negative = falling (bearish).

        atr_value (float): Current ATR on the higher timeframe.
            Used to measure overextension (price too far from EMA).

        hh_ll_structure (str): Market structure classification.
            "HH" = Higher Highs, "HL" = Higher Lows (bullish)
            "LL" = Lower Lows, "LH" = Lower Highs (bearish)
            "FLAT" = No clear structure

        structure_reason (str): Human-readable explanation of structure.
            e.g., "bull=2" means 2 bullish structure points found.

        reason (str): Human-readable explanation of the FINAL bias decision.
            e.g., "HH/HL + above EMA" or "overextended +3.5x ATR"
            WHY a reason string? When reviewing trades, you need to know
            exactly why the bias was what it was. "NEUTRAL" alone is
            useless — "overextended +3.5x ATR" tells you the market
            was too far from the EMA to trade safely.
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

    The Bias Engine combines THREE independent signals to determine
    market direction:

    SIGNAL 1: EMA Position
        Is price above or below the EMA? Above = bullish, below = bearish.

    SIGNAL 2: EMA Slope
        Is the EMA rising or falling? Rising = bullish, falling = bearish.
        We use a minimum slope threshold (0.005%) to filter out flat EMAs.

    SIGNAL 3: Market Structure (HH/HL vs LL/LH)
        Are swing points making higher highs/higher lows (bullish) or
        lower lows/lower highs (bearish)?

    PRIORITY:
        Structure + EMA position > Slope + EMA position > EMA position alone
        Strong signals require more confirmation. Weak signals can still
        generate a bias if price is clearly above/below the EMA.

    SAFETY CHECK:
        If price is more than 3x ATR away from the EMA, we go NEUTRAL
        regardless of other signals. WHY? Overextended markets tend to
        mean-revert (pull back), which is dangerous for trend followers.

    Example:
        >>> engine = BiasEngine(ema_period=20, atr_period=14)
        >>> bias = engine.evaluate(candle_buffer)
        >>> print(bias.direction)   # "BULLISH"
        >>> print(bias.reason)      # "HH/HL + above EMA"
    """

    def __init__(self, ema_period=None, atr_period=None, structure_lookback=None):
        """
        Initialize the Bias Engine.

        Args:
            ema_period (int, optional): EMA period for trend identification.
                Default: Uses BIAS_EMA_PERIOD from config (20).
                WHY 20? Standard trend EMA — not too fast, not too slow.

            atr_period (int, optional): ATR period for volatility measurement.
                Default: Uses BIAS_ATR_PERIOD from config (14).
                WHY 14? Standard ATR period since Wilder (1978).

            structure_lookback (int, optional): How many candles to examine
                for market structure detection.
                Default: Uses BIAS_STRUCTURE_LOOKBACK from config (20).
                WHY 20? Enough candles to identify 2-3 swing points,
                which is the minimum for confirming a trend.
        """
        self.ema_period = ema_period if ema_period is not None else BIAS_EMA_PERIOD
        self.atr_period = atr_period if atr_period is not None else BIAS_ATR_PERIOD
        self.structure_lookback = structure_lookback if structure_lookback is not None else BIAS_STRUCTURE_LOOKBACK

    def _detect_structure(self, candles):
        """
        Detect market structure by analyzing swing highs and swing lows.

        MARKET STRUCTURE 101:
            Bullish trends make Higher Highs (HH) and Higher Lows (HL).
            Bearish trends make Lower Lows (LL) and Lower Highs (LH).
            No trend makes mixed patterns → FLAT.

        SCORING SYSTEM:
            We assign points to bullish and bearish evidence:
            - If the most recent swing high > previous: bull += 2
            - If the most recent swing high < previous: bear += 1
            - If the most recent swing low > previous:  bull += 1
            - If the most recent swing low < previous:  bear += 2

            WHY these weights? Higher highs are the strongest bullish
            signal (2 points), while lower swing highs are a weaker
            bearish signal (1 point). This asymmetry prevents whipsaws.

        CLASSIFICATION:
            bull ≥ 2 and bear = 0 → "HH" (strong bullish)
            bull ≥ 1 and bear = 0 → "HL" (mild bullish)
            bear ≥ 2 and bull = 0 → "LL" (strong bearish)
            bear ≥ 1 and bull = 0 → "LH" (mild bearish)
            Otherwise → "FLAT" (no clear structure)

        Args:
            candles (list): A list of Candle objects with .high and .low.

        Returns:
            tuple[str, str]: (structure, reason)
                structure: "HH", "HL", "LL", "LH", or "FLAT"
                reason: Human-readable explanation (e.g., "bull=2")
        """
        lb = self.structure_lookback
        w = candles[-lb:] if len(candles) >= lb else candles

        # Need at least 5 candles to identify any structure
        if len(w) < 5:
            return "FLAT", "insufficient"

        # Find all swing highs and swing lows in the window
        sh = []  # Swing highs
        sl = []  # Swing lows
        for i in range(1, len(w) - 1):
            if w[i].high > w[i - 1].high and w[i].high > w[i + 1].high:
                sh.append(w[i].high)
            if w[i].low < w[i - 1].low and w[i].low < w[i + 1].low:
                sl.append(w[i].low)

        # Score bullish vs bearish evidence
        bull = 0
        bear = 0

        if len(sh) >= 2:
            if sh[-1] > sh[-2]:
                bull += 2  # Higher high = strong bullish
            elif sh[-1] < sh[-2]:
                bear += 1  # Lower high = mild bearish

        if len(sl) >= 2:
            if sl[-1] > sl[-2]:
                bull += 1  # Higher low = mild bullish
            elif sl[-1] < sl[-2]:
                bear += 2  # Lower low = strong bearish

        # Classify the structure
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

        This is the MAIN method of the Bias Engine. It combines all
        three signals (EMA position, EMA slope, market structure)
        into a single BULLISH/BEARISH/NEUTRAL verdict.

        EVALUATION PRIORITY (from strongest to weakest):
            1. STRUCTURE + EMA: "HH/HL + above EMA" → BULLISH
            2. SLOPE + EMA: "slope up + above EMA" → BULLISH
            3. EMA ALONE: "price above EMA" → BULLISH (weakest)
            Same logic mirrored for bearish.

        SAFETY CHECKS:
            - Overextension: price > 3x ATR from EMA → NEUTRAL
            - Warm-up: not enough candles → NEUTRAL
            - Zero ATR: can't calculate → NEUTRAL

        Args:
            buf (CandleBuffer): The candle buffer containing HTF candles.
                Must have enough candles for EMA and ATR calculation.

        Returns:
            HTFBias: The complete bias assessment with direction, values,
                and human-readable reasoning.

        Example:
            >>> engine = BiasEngine()
            >>> bias = engine.evaluate(buf)
            >>> if bias.direction == "BULLISH":
            ...     print("Look for LONG entries")
            >>> elif bias.direction == "BEARISH":
            ...     print("Look for SHORT entries")
            >>> else:
            ...     print("Stay out of the market")
        """
        # Minimum candles needed for all calculations
        mn = max(self.ema_period, self.atr_period + 1) + 5

        # Not enough data yet — still warming up
        if not buf.is_ready(mn):
            return HTFBias("NEUTRAL", 0, 0, 0, "FLAT", "warmup", "warming up")

        # Get candles for structure detection (wider window)
        candles = buf.last(mn + self.structure_lookback)

        # Get recent candles for EMA/ATR calculation
        recent = buf.last(mn)

        # Calculate EMA series
        closes = [c.close for c in recent]
        ev = ema_series(closes, self.ema_period)
        ve = [v for v in ev if v is not None]

        if not ve:
            return HTFBias("NEUTRAL", 0, 0, 0, "FLAT", "no ema", "no ema")

        # Current EMA value and close price
        ce = ve[-1]           # Current EMA
        cc = recent[-1].close # Current close

        # Calculate ATR
        try:
            ca = atr(recent, self.atr_period)
        except ValueError:
            return HTFBias("NEUTRAL", ce, 0, 0, "FLAT", "no atr", "no atr")

        # Calculate EMA slope
        slope = ema_slope_pct(ve, 3)

        # Calculate distance from EMA in terms of ATR
        # This tells us if the market is overextended
        dist = (cc - ce) / ca if ca > 0 else 0

        # Detect market structure
        struct, sr = self._detect_structure(candles)

        # ═══ SAFETY: Overextension check ═══
        # If price is > 3x ATR away from EMA, the market is overextended.
        # WHY 3x ATR? Empirically, moves beyond 3x ATR tend to mean-revert.
        # Taking a trend trade at such extremes is risky — you're likely
        # entering near the end of the move.
        if dist > 3.0:
            return HTFBias("NEUTRAL", ce, slope, ca, struct, sr,
                           f"overextended +{dist:.1f}x ATR")
        if dist < -3.0:
            return HTFBias("NEUTRAL", ce, slope, ca, struct, sr,
                           f"overextended {dist:.1f}x ATR")

        # ═══ CLASSIFICATION: Combine all signals ═══

        # Check if structure is bullish or bearish
        sb = struct in ("HH", "HL")    # Structure is bullish
        sbr = struct in ("LL", "LH")   # Structure is bearish

        # PRIORITY 1: Strong signal — Structure + EMA position agree
        if sb and cc > ce:
            return HTFBias("BULLISH", ce, slope, ca, struct, sr,
                           "HH/HL + above EMA")
        if sbr and cc < ce:
            return HTFBias("BEARISH", ce, slope, ca, struct, sr,
                           "LL/LH + below EMA")

        # PRIORITY 2: Medium signal — Slope + EMA position agree
        # WHY 0.005% threshold? This is a very small slope — it just
        # confirms the EMA is actually moving, not flat.
        if slope > 0.005 and cc > ce:
            return HTFBias("BULLISH", ce, slope, ca, struct, sr,
                           "slope up + above EMA")
        if slope < -0.005 and cc < ce:
            return HTFBias("BEARISH", ce, slope, ca, struct, sr,
                           "slope down + below EMA")

        # PRIORITY 3: Weak signal — EMA position alone
        # WHY 0.2% buffer? We don't want to trigger on price that's
        # barely above/below the EMA. The 0.2% buffer requires a
        # meaningful departure from the EMA line.
        if cc > ce * 1.002:
            return HTFBias("BULLISH", ce, slope, ca, struct, sr,
                           "price above EMA")
        if cc < ce * 0.998:
            return HTFBias("BEARISH", ce, slope, ca, struct, sr,
                           "price below EMA")

        # No clear bias — market is in a chop zone
        return HTFBias("NEUTRAL", ce, slope, ca, struct, sr,
                       f"neutral ({struct}, slope={slope:.4f}%)")
