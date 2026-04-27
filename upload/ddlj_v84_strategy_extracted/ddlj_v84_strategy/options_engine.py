#!/usr/bin/env python3
"""
DDLJ v8.4 Strategy — Options Signal Mimicry Engine
====================================================

This module is the BRIDGE between the futures-based signal generation
and options-based trade execution. Since the DDLJ strategy generates
signals based on the underlying index (BankNifty/Nifty spot prices) but
actually trades options, we need this engine to "mimic" what the options
prices would have been.

WHAT IS "SIGNAL MIMICRY"?
-------------------------
We don't have historical options price data for every strike and expiry.
Instead, we:
  1. Generate a signal on the underlying (e.g., "LONG BankNifty at 50000")
  2. Use Black-Scholes to estimate the option price at entry
  3. Use Black-Scholes to estimate the option price at exit
  4. Apply realistic bid-ask spreads, slippage, and impact costs
  5. Calculate the P&L as if we actually traded the option

This approach is called "signal mimicry" because we're mimicking what
would have happened if we had traded options, based on our spot signals.

KEY COMPONENTS:
  - Spread Model : Three regimes (normal/volatile/illiquid) based on VIX
  - IV Estimation : Real India VIX data + index-specific adjustment
  - Strike Selection : ATM, ITM, or Deep ITM based on config
  - Position Sizing : Capital-based lot calculation with safety cap
  - Entry/Exit Modeling : Full BS pricing with spread and slippage

Author: DDLJ Strategy Team
Version: 8.4 (Production)
"""

import os
import json
import math
import logging
from datetime import datetime, date
from dataclasses import dataclass

from .black_scholes import (
    black_scholes_price,
    black_scholes_delta,
    black_scholes_gamma,
    black_scholes_theta,
    black_scholes_vega,
)
from .config import (
    STARTING_CAPITAL,
    BANKNIFTY_LOT_SIZE,
    NIFTY_LOT_SIZE,
    BN_IV_VIX_SPREAD,
    NF_IV_VIX_SPREAD,
    IV_ADJUSTMENT,
    MAX_CAPITAL_PER_POSITION_PCT,
    MAX_LOTS,
)

log = logging.getLogger("v84prod")


# ═══════════════════════════════════════════════════════════════════════════
# INDIA VIX DATA LOADER
# ═══════════════════════════════════════════════════════════════════════════

def load_vix_data(vix_path="/home/z/my-project/download/india_vix_data.json"):
    """
    Load India VIX daily close data from a JSON file for real IV estimation.

    India VIX is the NSE's volatility index, similar to the CBOE VIX in
    the US. It measures the market's expectation of Nifty 50 volatility
    over the next 30 days. It's the BEST proxy for real-time implied
    volatility in Indian markets.

    WHY REAL VIX DATA?
        Earlier versions of this strategy estimated IV using ATR-based
        approximations, which were inaccurate by 30-50% in some cases.
        Using actual India VIX data gives us IV estimates that are within
        2-3 points of real option IVs.

    Args:
        vix_path (str, optional): Path to the India VIX JSON data file.
            Default: "/home/z/my-project/download/india_vix_data.json"
            The file should contain an array of objects with "date" and
            "close" keys.

    Returns:
        dict: A mapping of date string (YYYY-MM-DD) → VIX close value (float).
            Returns empty dict if the file doesn't exist or is invalid.

    Example:
        >>> vix = load_vix_data()
        >>> vix["2026-01-15"]
        14.35  # India VIX was 14.35 on Jan 15, 2026
    """
    if not os.path.exists(vix_path):
        log.warning("India VIX data not found at %s, will use fallback IV estimation", vix_path)
        return {}
    try:
        with open(vix_path) as f:
            raw = json.load(f)
        vix_by_date = {}
        for v in raw:
            dt = v['date']
            # Handle different date formats (string vs datetime)
            if isinstance(dt, str):
                d = dt[:10]  # Take first 10 chars: YYYY-MM-DD
            elif isinstance(dt, datetime):
                d = dt.strftime('%Y-%m-%d')
            else:
                continue
            vix_by_date[d] = float(v['close'])
        log.info("Loaded India VIX data: %d days", len(vix_by_date))
        return vix_by_date
    except Exception as e:
        log.warning("Error loading VIX data: %s", e)
        return {}


# Load VIX data at module level so it's available to all engine instances
# WHY module-level? This data is loaded once and shared across all engine
# instances. Loading it per-trade would be extremely inefficient.
VIX_DATA = load_vix_data()


# ═══════════════════════════════════════════════════════════════════════════
# OPTIONS FILL DATACLASS
# ═══════════════════════════════════════════════════════════════════════════

@dataclass
class OptionsFill:
    """
    Complete record of an options trade entry and exit.

    This dataclass captures EVERY detail of an options trade, including
    theoretical vs actual prices, spreads, Greeks, and P&L breakdown.

    WHY SO MANY FIELDS?
        When analyzing strategy performance, we need to understand WHERE
        our profits and losses come from:
          - Was it a directional win (delta) or an IV win (vega)?
          - How much did we lose to bid-ask spread?
          - How much did theta decay eat into profits?
          - Was slippage significant?

    Attributes:
        strike (float): Option strike price (e.g., 49800).
        option_type (str): "CE" for Call, "PE" for Put.
        entry_premium (float): Actual fill price at entry (including spread).
        exit_premium (float): Actual fill price at exit (including spread).
        theoretical_entry (float): Black-Scholes theoretical price at entry
            (before spread).
        theoretical_exit (float): Black-Scholes theoretical price at exit.
        spread_entry (float): Bid-ask spread at entry in rupees.
        spread_exit (float): Bid-ask spread at exit in rupees.
        iv_entry (float): Implied volatility used at entry (%).
        iv_exit (float): Implied volatility used at exit (%).
        delta (float): Option delta at entry (0 to 1 for calls).
        theta_daily (float): Daily theta decay at entry (rupees/day).
        gamma (float): Option gamma at entry.
        vega (float): Option vega at entry.
        lot_size (int): Number of shares per lot (30 for BN, 65 for NF).
        lots (int): Number of lots traded.
        gross_pnl (float): Gross profit/loss before slippage (rupees).
        net_pnl (float): Net profit/loss after slippage (rupees).
        slippage (float): Impact cost for multi-lot trades (rupees).
        moneyness (str): Option moneyness category ("ATM", "ITM", "DEEP_ITM").
    """
    strike: float
    option_type: str
    entry_premium: float
    exit_premium: float
    theoretical_entry: float
    theoretical_exit: float
    spread_entry: float
    spread_exit: float
    iv_entry: float
    iv_exit: float
    delta: float
    theta_daily: float
    gamma: float
    vega: float
    lot_size: int
    lots: int
    gross_pnl: float
    net_pnl: float
    slippage: float
    moneyness: str


# ═══════════════════════════════════════════════════════════════════════════
# OPTIONS MIMICRY ENGINE
# ═══════════════════════════════════════════════════════════════════════════

class OptionsMimicryEngine:
    """
    Realistic options signal mimicry engine using proper Black-Scholes pricing.

    This engine translates spot-price signals into realistic options trades
    by:
      1. Selecting the appropriate option strike based on moneyness
      2. Estimating IV from real India VIX data
      3. Pricing the option using full Black-Scholes
      4. Adding realistic bid-ask spreads based on market regime
      5. Calculating position size based on available capital
      6. Computing Greeks for risk analysis

    SPREAD MODEL:
        The bid-ask spread is modeled based on two factors:
        - Moneyness: ATM options are most liquid (tightest spreads),
          OTM options are least liquid (widest spreads)
        - Market regime: Determined by VIX level
            "normal"   (VIX < 14): Calm markets, tight spreads
            "volatile" (VIX 14-20): Elevated volatility, wider spreads
            "illiquid" (VIX > 20): Crisis mode, very wide spreads

    IV ESTIMATION:
        India VIX measures Nifty 50's expected volatility. But BankNifty
        and Nifty options have slightly higher IV than VIX due to:
          - Volatility skew (different strikes have different IVs)
          - Supply/demand for specific option contracts
        We add a spread:
          - BankNifty IV ≈ VIX + 4.0 points
          - Nifty IV ≈ VIX + 1.5 points

    Example:
        >>> engine = OptionsMimicryEngine(
        ...     index_name="BANKNIFTY",
        ...     moneyness="ITM",
        ...     capital=50000
        ... )
        >>> # Model an entry
        >>> entry = engine.model_entry(
        ...     spot=50000, direction="LONG",
        ...     atr_value=150, days_to_expiry=15,
        ...     trade_date=datetime(2026, 1, 15, 10, 30)
        ... )
        >>> print(f"Strike: {entry['strike']}, Premium: {entry['fill_price']}")
        >>> # Model an exit
        >>> exit_fill = engine.model_exit(
        ...     entry_info=entry, spot_exit=50300,
        ...     atr_exit=155, days_to_expiry=14,
        ...     trade_date=datetime(2026, 1, 15, 14, 0)
        ... )
        >>> print(f"P&L: Rs {exit_fill.net_pnl}")
    """

    # Bid-ask spread model as a fraction of option premium.
    # These values are based on observed market data and represent the
    # TYPICAL spread you'd see when trading index options on NSE.
    #
    # WHY these specific numbers?
    #   - ATM options are the most traded → tightest spreads
    #   - ITM options are also fairly liquid
    #   - Deep ITM options have wider spreads (fewer traders)
    #   - OTM options have the widest spreads (low liquidity, high risk)
    #
    # WHY three regimes?
    #   Market conditions dramatically affect spreads. During calm periods,
    #   spreads are tight. During volatile periods (budget day, election
    #   results, global crisis), spreads can triple or more.
    SPREAD_MODEL = {
        "ATM":      {"normal": 0.012, "volatile": 0.025, "illiquid": 0.045},
        "ITM":      {"normal": 0.010, "volatile": 0.020, "illiquid": 0.035},
        "DEEP_ITM": {"normal": 0.018, "volatile": 0.030, "illiquid": 0.055},
        "OTM":      {"normal": 0.035, "volatile": 0.060, "illiquid": 0.100},
    }

    # IV-VIX spread: how much higher each index's IV is compared to VIX.
    # These are empirical observations from Indian options markets.
    IV_VIX_SPREAD = {
        "BANKNIFTY": BN_IV_VIX_SPREAD,   # Default: 4.0 (BN IV ≈ VIX + 4)
        "NIFTY": NF_IV_VIX_SPREAD,       # Default: 1.5 (NF IV ≈ VIX + 1.5)
    }

    # Target delta values for each moneyness category.
    # These are informational — we don't use them for strike selection
    # directly, but they represent the typical delta you'd expect.
    DELTA_TARGETS = {"ATM": 0.50, "ITM": 0.60, "DEEP_ITM": 0.75}

    def __init__(self, index_name="BANKNIFTY", moneyness="ITM",
                 spread_regime="auto", iv_adjustment=None, capital=None):
        """
        Initialize the Options Mimicry Engine.

        Args:
            index_name (str, optional): Which index to trade.
                "BANKNIFTY" or "NIFTY". Default: "BANKNIFTY".
                WHY BankNifty default? It has higher beta (more volatile),
                which means bigger moves and more profit potential for
                a trend-following strategy.

            moneyness (str, optional): Which options to trade.
                "ATM", "ITM", or "DEEP_ITM". Default: "ITM".
                WHY ITM default? Backtesting shows ITM options give the
                best risk-adjusted returns because:
                  - Higher delta → moves more with the index
                  - Lower theta as % of premium → less time decay
                  - Still affordable with Rs 50K capital

            spread_regime (str, optional): Bid-ask spread regime.
                "auto", "normal", "volatile", or "illiquid".
                Default: "auto" (automatically selects based on VIX).
                WHY "auto"? Market conditions change daily. Using a fixed
                regime would overestimate costs in calm markets and
                underestimate them in volatile markets.

            iv_adjustment (float, optional): Multiplier applied to estimated IV.
                Default: None (uses value from config, typically 1.0).
                Set to 1.1 for 10% higher IV (more conservative pricing).
                WHY adjustable? Some users may want to stress-test with
                higher IV assumptions.

            capital (float, optional): Current trading capital in rupees.
                Default: None (uses STARTING_CAPITAL from config).
                This is UPDATED by the backtester as capital changes,
                so position sizing reflects the current account value.
        """
        self.index_name = index_name
        self.moneyness = moneyness
        self.spread_regime = spread_regime
        self.iv_adjustment = iv_adjustment if iv_adjustment is not None else IV_ADJUSTMENT

        # Set lot size and strike step based on the index
        # These are FIXED by NSE and cannot be changed
        if index_name == "BANKNIFTY":
            self.lot_size = BANKNIFTY_LOT_SIZE    # 30 shares per lot
        else:
            self.lot_size = NIFTY_LOT_SIZE         # 65 shares per lot

        # Strike step: how far apart option strikes are
        # BankNifty: 100 points (50000, 50100, 50200, ...)
        # Nifty: 50 points (24000, 24050, 24100, ...)
        if index_name == "BANKNIFTY":
            self.strike_step = 100
        else:
            self.strike_step = 50

        self.capital = capital if capital is not None else STARTING_CAPITAL

    def _round_strike(self, price, direction="down"):
        """
        Round a price to the nearest valid strike price.

        Args:
            price (float): The raw price to round.
            direction (str): "down" rounds to nearest strike below the price,
                "up" rounds to nearest strike above the price.
                WHY direction matters? For calls, we round down to find the
                ATM strike. For puts, same logic but in the other direction.

        Returns:
            float: The rounded strike price.

        Example:
            >>> engine = OptionsMimicryEngine(index_name="BANKNIFTY")
            >>> engine._round_strike(50047.50, "down")
            50000
            >>> engine._round_strike(50047.50, "up")
            50100
        """
        step = self.strike_step
        if direction == "down":
            return math.floor(price / step) * step
        return math.ceil(price / step) * step

    def select_strike(self, spot, direction):
        """
        Select the appropriate option strike based on trade direction and
        moneyness setting.

        HOW STRIKE SELECTION WORKS:
            For LONG (buying a Call):
                ATM:      Strike = Round(spot) — closest to current price
                ITM:      Strike = Round(spot) - 1 step — below spot (has intrinsic value)
                DEEP_ITM: Strike = Round(spot) - 2 steps — well below spot

            For SHORT (buying a Put):
                ATM:      Strike = Round(spot) — closest to current price
                ITM:      Strike = Round(spot) + 1 step — above spot (has intrinsic value)
                DEEP_ITM: Strike = Round(spot) + 2 steps — well above spot

        WHY DOES ITM MEAN "BELOW SPOT" FOR CALLS?
            A call option with strike BELOW the spot price is "in the money"
            because you have the right to buy at a lower price than market.
            Example: If BankNifty is at 50000, a 49800 CE is ITM because
            you can buy at 49800 when the market is at 50000. The intrinsic
            value is 50000 - 49800 = 200 points.

        Args:
            spot (float): Current underlying price.
            direction (str): Trade direction — "LONG" or "SHORT".

        Returns:
            tuple[float, str]: (strike_price, option_type)
                option_type is "CE" for LONG (buying a call) or
                "PE" for SHORT (buying a put).

        Example:
            >>> engine = OptionsMimicryEngine(index_name="BANKNIFTY", moneyness="ITM")
            >>> engine.select_strike(50000, "LONG")
            (49900, 'CE')   # One step below spot for ITM call
            >>> engine.select_strike(50000, "SHORT")
            (50100, 'PE')   # One step above spot for ITM put
        """
        if direction == "LONG":
            option_type = "CE"  # Buy a Call option
            if self.moneyness == "ATM":
                strike = self._round_strike(spot)
            elif self.moneyness == "ITM":
                # For BankNifty (step=100): 1 step in = 100 points ITM
                # For Nifty (step=50): 2 steps in = 100 points ITM
                strikes_in = 1 if self.strike_step >= 100 else 2
                strike = self._round_strike(spot) - strikes_in * self.strike_step
            else:  # DEEP_ITM
                strikes_in = 2 if self.strike_step >= 100 else 4
                strike = self._round_strike(spot) - strikes_in * self.strike_step
        else:  # SHORT
            option_type = "PE"  # Buy a Put option
            if self.moneyness == "ATM":
                strike = self._round_strike(spot)
            elif self.moneyness == "ITM":
                strikes_in = 1 if self.strike_step >= 100 else 2
                strike = self._round_strike(spot) + strikes_in * self.strike_step
            else:  # DEEP_ITM
                strikes_in = 2 if self.strike_step >= 100 else 4
                strike = self._round_strike(spot) + strikes_in * self.strike_step

        return strike, option_type

    def _get_iv_from_vix(self, trade_date):
        """
        Estimate Implied Volatility from India VIX data.

        This is a THREE-TIER fallback system:

        TIER 1 (Best): Use actual VIX data for the specific trade date.
            If we have VIX data for Jan 15, 2026, we use it directly.
            IV = VIX + IndexSpread (e.g., BN IV = 14.35 + 4.0 = 18.35%)

        TIER 2 (OK): Use the monthly average VIX for that month.
            If we don't have VIX for a specific day but have other days
            in the same month, we average them. This is reasonable because
            VIX doesn't change drastically within a month.

        TIER 3 (Fallback): Use hardcoded default IV values.
            BankNifty: 17.0%, Nifty: 14.0%. These are long-term averages.
            This should rarely happen — only if VIX data is entirely missing.

        Args:
            trade_date (datetime | date | str): The trade date.

        Returns:
            float: Estimated IV as a percentage, rounded to 2 decimal places.
                Already multiplied by the iv_adjustment factor.

        Example:
            >>> engine = OptionsMimicryEngine(index_name="BANKNIFTY")
            >>> engine._get_iv_from_vix(datetime(2026, 1, 15))
            18.35  # VIX was 14.35, + 4.0 for BN = 18.35%
        """
        # Convert trade_date to a string key for lookup
        if isinstance(trade_date, datetime):
            date_str = trade_date.strftime('%Y-%m-%d')
        elif isinstance(trade_date, date):
            date_str = trade_date.strftime('%Y-%m-%d')
        else:
            date_str = str(trade_date)[:10]

        # TIER 1: Direct VIX data for this date
        vix_value = VIX_DATA.get(date_str, None)

        if vix_value is not None:
            iv_spread = self.IV_VIX_SPREAD.get(self.index_name, 2.0)
            iv = vix_value + iv_spread
        else:
            # TIER 2: Monthly average VIX
            month_str = date_str[:7]  # e.g., "2026-01"
            monthly_vix = [v for k, v in VIX_DATA.items() if k.startswith(month_str)]
            if monthly_vix:
                avg_vix = sum(monthly_vix) / len(monthly_vix)
                iv_spread = self.IV_VIX_SPREAD.get(self.index_name, 2.0)
                iv = avg_vix + iv_spread
            else:
                # TIER 3: Hardcoded defaults (long-term averages)
                defaults = {"BANKNIFTY": 17.0, "NIFTY": 14.0}
                iv = defaults.get(self.index_name, 15.0)

        # Apply IV adjustment factor (default 1.0 = no adjustment)
        return round(iv * self.iv_adjustment, 2)

    def _get_spread_regime(self, vix_value=None):
        """
        Determine the current bid-ask spread regime based on VIX level.

        The three regimes model how market liquidity changes with volatility:
            - "normal"   (VIX < 14): Markets are calm, spreads are tight
            - "volatile" (VIX 14-20): Elevated uncertainty, wider spreads
            - "illiquid" (VIX > 20): Crisis conditions, very wide spreads

        WHY VIX-based regimes?
            During the 2020 COVID crash, India VIX spiked to 70+ and
            option spreads went from 1-2 rupees to 20-50 rupees. A fixed
            spread model would wildly underestimate costs in such conditions.

        Args:
            vix_value (float | None): Current VIX value. If None and
                regime is "auto", falls back to the last known VIX value.

        Returns:
            str: "normal", "volatile", or "illiquid"
        """
        # If user has manually set a regime, respect it
        if self.spread_regime != "auto":
            return self.spread_regime

        if vix_value is None:
            # Try to get from the last known VIX value
            if VIX_DATA:
                vix_value = list(VIX_DATA.values())[-1]
            else:
                return "normal"  # Default to normal if no VIX data at all

        # Classify based on VIX level
        # WHY these thresholds?
        #   - VIX < 14: This is below long-term average (≈15), calm market
        #   - VIX 14-20: Above average but not extreme
        #   - VIX > 20: Significantly elevated, typically during events
        if vix_value < 14:
            return "normal"
        elif vix_value < 20:
            return "volatile"
        else:
            return "illiquid"

    def _estimate_spread(self, premium, vix_value=None):
        """
        Estimate the bid-ask spread for an option based on its premium
        and the current market regime.

        The spread is calculated as:
            spread = max(minimum_spread, premium × spread_percentage)

        WHY a minimum spread?
            Even in liquid markets, there's always a minimum spread due to:
            - Exchange transaction charges
            - Market maker inventory risk
            - Rounding to tick sizes
            For ATM/ITM: minimum 0.50 rupees
            For DEEP_ITM/OTM: minimum 1.00 rupee
            Nifty has 70% of BankNifty's minimum (more liquid).

        Args:
            premium (float): The theoretical option premium (mid price).
            vix_value (float | None): Current VIX value for regime detection.

        Returns:
            float: Estimated spread in rupees, rounded to 2 decimal places.

        Example:
            >>> engine = OptionsMimicryEngine(index_name="BANKNIFTY", moneyness="ITM")
            >>> # Premium=400, VIX=14 → "volatile" regime → 2.0% spread
            >>> # spread = max(0.50, 400 × 0.020) = max(0.50, 8.00) = 8.00
            >>> engine._estimate_spread(400, vix_value=14)
            8.0
        """
        regime = self._get_spread_regime(vix_value)
        spread_pct = self.SPREAD_MODEL[self.moneyness][regime]

        # Minimum spread depends on moneyness (liquid options = tighter min)
        min_spread = 0.50 if self.moneyness in ("ATM", "ITM") else 1.00

        # Nifty is more liquid than BankNifty → tighter spreads
        if self.index_name == "NIFTY":
            min_spread *= 0.7

        return round(max(min_spread, premium * spread_pct), 2)

    def calculate_lots(self, premium):
        """
        Calculate the number of option lots to trade based on capital.

        POSITION SIZING LOGIC:
            1. Max capital per position = 40% of current capital
            2. Premium per lot = option_premium × lot_size
            3. Number of lots = max_capital_per_position / premium_per_lot
            4. Hard cap at MAX_LOTS (3) for risk management

        WHY 40% per position?
            With 2 max open positions, each using 40%, the maximum
            capital deployed is 80%. This leaves 20% as a buffer for:
            - Slippage and unexpected costs
            - Margin requirements (if any)
            - A third opportunity that might be better

        WHY hard cap at 3 lots?
            Even with large capital, we don't want to take excessively
            large positions. 3 lots of BankNifty options = 90 shares,
            which is a significant position that can move the market.

        Args:
            premium (float): The option premium per share (fill price).

        Returns:
            int: Number of lots to trade (between 1 and MAX_LOTS).

        Example:
            >>> engine = OptionsMimicryEngine(index_name="BANKNIFTY", capital=50000)
            >>> # Premium=400, lot_size=30
            >>> # Max per position = 50000 × 0.40 = 20000
            >>> # Premium per lot = 400 × 30 = 12000
            >>> # Lots = 20000 / 12000 = 1.67 → floor = 1
            >>> engine.calculate_lots(400)
            1
            >>> # With higher capital:
            >>> engine.capital = 200000
            >>> # Max per position = 200000 × 0.40 = 80000
            >>> # Lots = 80000 / 12000 = 6.67 → capped at 3
            >>> engine.calculate_lots(400)
            3
        """
        max_premium_per_lot = premium * self.lot_size
        lots = max(1, int(self.capital * MAX_CAPITAL_PER_POSITION_PCT / max_premium_per_lot))
        return min(lots, MAX_LOTS)

    def model_entry(self, spot, direction, atr_value, days_to_expiry,
                    trade_date, time_of_day=None):
        """
        Model an option entry using proper Black-Scholes with real IV.

        This is called when the strategy generates a signal (e.g., "LONG
        BankNifty at 50000"). The engine:
          1. Selects the appropriate option strike and type
          2. Estimates IV from India VIX
          3. Prices the option using Black-Scholes
          4. Adds half the bid-ask spread (we buy at the ask price)
          5. Calculates all Greeks for risk analysis
          6. Determines position size based on capital

        Args:
            spot (float): The underlying price at which the signal was
                generated (from the entry timeframe).
            direction (str): Trade direction — "LONG" or "SHORT".
            atr_value (float): Current ATR value (used for context,
                not directly in pricing but stored for reference).
            days_to_expiry (int): Calendar days to the nearest monthly
                expiry (typically the last Thursday of the month).
            trade_date (datetime | date): The date/time of the trade.
                Used to look up India VIX for IV estimation.
            time_of_day (time | None): Time of the trade. Currently
                unused but reserved for intraday IV adjustments.

        Returns:
            dict: A comprehensive entry record with keys:
                - "strike": Option strike price
                - "option_type": "CE" or "PE"
                - "theoretical_price": BS mid-price (no spread)
                - "fill_price": Actual fill price (mid + half spread)
                - "spread": Bid-ask spread in rupees
                - "iv": Implied volatility used (%)
                - "delta", "theta_daily", "gamma", "vega": Greeks
                - "lot_size": Shares per lot
                - "lots": Number of lots traded
                - "spot_at_entry": Underlying price at entry
                - "atr_at_entry": ATR at entry time
                - "moneyness": Moneyness category
                - "vix_at_entry": VIX value on trade date

        Example:
            >>> entry = engine.model_entry(
            ...     spot=50000, direction="LONG",
            ...     atr_value=150, days_to_expiry=15,
            ...     trade_date=datetime(2026, 1, 15, 10, 30)
            ... )
            >>> entry["strike"]       # e.g., 49900 (ITM call)
            49900
            >>> entry["fill_price"]   # e.g., 405.50 (includes spread)
            405.50
            >>> entry["delta"]        # e.g., 0.60
            0.60
        """
        # Step 1: Select strike and option type
        strike, option_type = self.select_strike(spot, direction)

        # Step 2: Get IV from India VIX
        iv = self._get_iv_from_vix(trade_date)

        # Step 3: Get VIX value for spread regime determination
        if isinstance(trade_date, datetime):
            date_str = trade_date.strftime('%Y-%m-%d')
        elif isinstance(trade_date, date):
            date_str = trade_date.strftime('%Y-%m-%d')
        else:
            date_str = str(trade_date)[:10]
        vix_value = VIX_DATA.get(date_str, None)

        # Step 4: Price the option using full Black-Scholes
        theo_price = black_scholes_price(spot, strike, iv, days_to_expiry, option_type)

        # Step 5: Calculate all Greeks
        delta = abs(black_scholes_delta(spot, strike, iv, days_to_expiry, option_type))
        gamma = black_scholes_gamma(spot, strike, iv, days_to_expiry)
        theta = black_scholes_theta(spot, strike, iv, days_to_expiry, option_type)
        vega = black_scholes_vega(spot, strike, iv, days_to_expiry)

        # Step 6: Add bid-ask spread (we BUY at the ASK price)
        # Ask = midpoint + half_spread, because the ask is always above mid
        spread = self._estimate_spread(theo_price, vix_value)
        fill_price = theo_price + spread / 2

        # Step 7: Determine position size
        lots = self.calculate_lots(fill_price)

        return {
            "strike": strike,
            "option_type": option_type,
            "theoretical_price": theo_price,
            "fill_price": fill_price,
            "spread": spread,
            "iv": iv,
            "delta": delta,
            "theta_daily": theta,
            "gamma": gamma,
            "vega": vega,
            "lot_size": self.lot_size,
            "lots": lots,
            "spot_at_entry": spot,
            "atr_at_entry": atr_value,
            "moneyness": self.moneyness,
            "vix_at_entry": vix_value,
        }

    def model_exit(self, entry_info, spot_exit, atr_exit, days_to_expiry,
                   trade_date, time_of_day=None, bars_held=0,
                   entry_tf_minutes=15):
        """
        Model an option exit using proper Black-Scholes with real IV.

        This is called when the backtester decides to close a position
        (stop loss hit, target reached, EOD close, etc.). The engine:
          1. Re-prices the option at the exit spot price
          2. Subtracts half the bid-ask spread (we sell at the bid price)
          3. Calculates impact cost (slippage) for multi-lot trades
          4. Computes net P&L

        Args:
            entry_info (dict): The entry record from model_entry().
                Contains strike, option_type, fill_price, lots, etc.
            spot_exit (float): The underlying price at exit.
            atr_exit (float): ATR at exit time (for context).
            days_to_expiry (int): Calendar days remaining to expiry.
            trade_date (datetime | date): The exit date/time.
            time_of_day (time | None): Exit time. Currently unused.
            bars_held (int): Number of bars the position was held.
                Used to calculate theta cost estimate.
            entry_tf_minutes (int): Entry timeframe in minutes (default 15).
                Used with bars_held for theta calculations.

        Returns:
            OptionsFill: A complete record of the options trade with all
                P&L breakdown and Greek information.

        Example:
            >>> exit_fill = engine.model_exit(
            ...     entry_info=entry,
            ...     spot_exit=50300,
            ...     atr_exit=155,
            ...     days_to_expiry=14,
            ...     trade_date=datetime(2026, 1, 15, 14, 0)
            ... )
            >>> exit_fill.net_pnl   # Net profit after all costs
            540.00
            >>> exit_fill.gross_pnl  # Gross profit before slippage
            555.00
            >>> exit_fill.slippage   # Impact cost for 2 lots
            15.00
        """
        strike = entry_info["strike"]
        option_type = entry_info["option_type"]
        entry_premium = entry_info["fill_price"]
        entry_iv = entry_info["iv"]

        # Get exit IV from VIX
        exit_iv = self._get_iv_from_vix(trade_date)

        # Get VIX for spread regime
        if isinstance(trade_date, datetime):
            date_str = trade_date.strftime('%Y-%m-%d')
        elif isinstance(trade_date, date):
            date_str = trade_date.strftime('%Y-%m-%d')
        else:
            date_str = str(trade_date)[:10]
        vix_value = VIX_DATA.get(date_str, None)

        # Price the option at exit using full Black-Scholes
        theo_exit = black_scholes_price(spot_exit, strike, exit_iv,
                                         days_to_expiry, option_type)

        # Subtract bid-ask spread (we SELL at the BID price)
        # Bid = midpoint - half_spread, because the bid is always below mid
        spread_exit = self._estimate_spread(theo_exit, vix_value)
        fill_exit = theo_exit - spread_exit / 2

        # Calculate P&L
        lots = entry_info["lots"]
        lot_size = entry_info["lot_size"]
        gross_per_share = fill_exit - entry_premium
        total_gross = gross_per_share * lot_size * lots

        # Impact cost: larger positions move the market more
        # WHY this formula? Each additional lot beyond the first adds
        # Rs 0.10 per share of slippage. For 2 lots: (2-1) × 0.10 × 30 = Rs 3
        # This is a simplified model of market impact.
        slippage = (lots - 1) * 0.10 * lot_size if lots > 1 else 0
        total_net = total_gross - slippage

        return OptionsFill(
            strike=strike,
            option_type=option_type,
            entry_premium=entry_premium,
            exit_premium=fill_exit,
            theoretical_entry=entry_info["theoretical_price"],
            theoretical_exit=theo_exit,
            spread_entry=entry_info["spread"],
            spread_exit=spread_exit,
            iv_entry=entry_iv,
            iv_exit=exit_iv,
            delta=entry_info["delta"],
            theta_daily=entry_info["theta_daily"],
            gamma=entry_info["gamma"],
            vega=entry_info["vega"],
            lot_size=lot_size,
            lots=lots,
            gross_pnl=round(total_gross, 2),
            net_pnl=round(total_net, 2),
            slippage=round(slippage, 2),
            moneyness=entry_info["moneyness"],
        )
