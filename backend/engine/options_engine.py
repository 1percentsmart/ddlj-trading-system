#!/usr/bin/env python3
"""
DDLJ v9 Strategy — Options Signal Mimicry Engine
====================================================

Translates spot-price signals into realistic options trades using
Black-Scholes pricing with real India VIX data for IV estimation.

This is the ONLY place where OptionsFill is defined (BUG FIX #2).

KEY COMPONENTS:
  - Spread Model : Three regimes (normal/volatile/illiquid) based on VIX
  - IV Estimation : Real India VIX data + index-specific adjustment
  - Strike Selection : ATM, ITM, or Deep ITM based on config
  - Position Sizing : Capital-based lot calculation with safety cap
  - Entry/Exit Modeling : Full BS pricing with spread and slippage

Author: DDLJ Strategy Team
Version: 9.0 (Paper Trading Production)
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

log = logging.getLogger("ddlJ_v9")


# ═══════════════════════════════════════════════════════════════════════════
# INDIA VIX DATA LOADER
# ═══════════════════════════════════════════════════════════════════════════

def load_vix_data(vix_path=None):
    """
    Load India VIX daily close data from a JSON file for real IV estimation.

    THREE-TIER fallback:
      1. Direct VIX for the trade date (best)
      2. Monthly average VIX (OK)
      3. Hardcoded defaults (fallback)

    Args:
        vix_path (str, optional): Path to the India VIX JSON data file.

    Returns:
        dict: date_string (YYYY-MM-DD) -> VIX close value (float).
    """
    if vix_path is None:
        search_paths = [
            "/home/z/my-project/download/india_vix_data.json",
            os.path.join(os.path.dirname(__file__), "data", "india_vix_data.json"),
        ]
        for p in search_paths:
            if os.path.exists(p):
                vix_path = p
                break
    if vix_path is None or not os.path.exists(vix_path):
        log.warning("India VIX data not found at %s, will use fallback IV estimation", vix_path)
        return {}
    try:
        with open(vix_path) as f:
            raw = json.load(f)
        vix_by_date = {}
        for v in raw:
            dt = v['date']
            if isinstance(dt, str):
                d = dt[:10]
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


VIX_DATA = load_vix_data()


# ═══════════════════════════════════════════════════════════════════════════
# OPTIONS FILL DATACLASS — THE ONLY DEFINITION (BUG FIX #2)
# ═══════════════════════════════════════════════════════════════════════════

@dataclass
class OptionsFill:
    """
    Complete record of an options trade entry and exit.

    This is the ONLY definition of OptionsFill in v9 (BUG FIX #2).
    Previously, v8.4 had a duplicate in trade_types.py, causing confusion
    about which class to import. Now it lives ONLY here.

    Attributes:
        strike (float): Option strike price.
        option_type (str): "CE" or "PE".
        entry_premium (float): Fill price at entry (including spread).
        exit_premium (float): Fill price at exit (including spread).
        theoretical_entry (float): BS mid-price at entry.
        theoretical_exit (float): BS mid-price at exit.
        spread_entry (float): Bid-ask spread at entry.
        spread_exit (float): Bid-ask spread at exit.
        iv_entry (float): IV used at entry (%).
        iv_exit (float): IV used at exit (%).
        delta (float): Option delta at entry.
        theta_daily (float): Daily theta at entry.
        gamma (float): Option gamma at entry.
        vega (float): Option vega at entry.
        lot_size (int): Shares per lot.
        lots (int): Number of lots traded.
        gross_pnl (float): Gross P&L before slippage.
        net_pnl (float): Net P&L after slippage.
        slippage (float): Impact cost for multi-lot trades.
        moneyness (str): "ATM", "ITM", or "DEEP_ITM".
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
    """

    SPREAD_MODEL = {
        "ATM":      {"normal": 0.012, "volatile": 0.025, "illiquid": 0.045},
        "ITM":      {"normal": 0.010, "volatile": 0.020, "illiquid": 0.035},
        "DEEP_ITM": {"normal": 0.018, "volatile": 0.030, "illiquid": 0.055},
        "OTM":      {"normal": 0.035, "volatile": 0.060, "illiquid": 0.100},
    }

    IV_VIX_SPREAD = {
        "BANKNIFTY": BN_IV_VIX_SPREAD,
        "NIFTY": NF_IV_VIX_SPREAD,
    }

    DELTA_TARGETS = {"ATM": 0.50, "ITM": 0.60, "DEEP_ITM": 0.75}

    def __init__(self, index_name="BANKNIFTY", moneyness="ITM",
                 spread_regime="auto", iv_adjustment=None, capital=None):
        self.index_name = index_name
        self.moneyness = moneyness
        self.spread_regime = spread_regime
        self.iv_adjustment = iv_adjustment if iv_adjustment is not None else IV_ADJUSTMENT

        if index_name == "BANKNIFTY":
            self.lot_size = BANKNIFTY_LOT_SIZE
        else:
            self.lot_size = NIFTY_LOT_SIZE

        if index_name == "BANKNIFTY":
            self.strike_step = 100
        else:
            self.strike_step = 50

        self.capital = capital if capital is not None else STARTING_CAPITAL

    def _round_strike(self, price, direction="down"):
        """Round a price to the nearest valid strike price."""
        step = self.strike_step
        if direction == "down":
            return math.floor(price / step) * step
        return math.ceil(price / step) * step

    def select_strike(self, spot, direction):
        """
        Select the appropriate option strike based on trade direction and moneyness.

        Args:
            spot (float): Current underlying price.
            direction (str): "LONG" or "SHORT".

        Returns:
            tuple[float, str]: (strike_price, option_type)
        """
        if direction == "LONG":
            option_type = "CE"
            if self.moneyness == "ATM":
                strike = self._round_strike(spot)
            elif self.moneyness == "ITM":
                strikes_in = 1 if self.strike_step >= 100 else 2
                strike = self._round_strike(spot) - strikes_in * self.strike_step
            else:  # DEEP_ITM
                strikes_in = 2 if self.strike_step >= 100 else 4
                strike = self._round_strike(spot) - strikes_in * self.strike_step
        else:  # SHORT
            option_type = "PE"
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
        Estimate IV from India VIX data with three-tier fallback.

        Args:
            trade_date: The trade date.

        Returns:
            float: Estimated IV as a percentage.
        """
        if isinstance(trade_date, datetime):
            date_str = trade_date.strftime('%Y-%m-%d')
        elif isinstance(trade_date, date):
            date_str = trade_date.strftime('%Y-%m-%d')
        else:
            date_str = str(trade_date)[:10]

        vix_value = VIX_DATA.get(date_str, None)

        if vix_value is not None:
            iv_spread = self.IV_VIX_SPREAD.get(self.index_name, 2.0)
            iv = vix_value + iv_spread
        else:
            month_str = date_str[:7]
            monthly_vix = [v for k, v in VIX_DATA.items() if k.startswith(month_str)]
            if monthly_vix:
                avg_vix = sum(monthly_vix) / len(monthly_vix)
                iv_spread = self.IV_VIX_SPREAD.get(self.index_name, 2.0)
                iv = avg_vix + iv_spread
            else:
                defaults = {"BANKNIFTY": 17.0, "NIFTY": 14.0}
                iv = defaults.get(self.index_name, 15.0)

        return round(iv * self.iv_adjustment, 2)

    def _get_spread_regime(self, vix_value=None):
        """Determine the current bid-ask spread regime based on VIX level."""
        if self.spread_regime != "auto":
            return self.spread_regime

        if vix_value is None:
            if VIX_DATA:
                vix_value = list(VIX_DATA.values())[-1]
            else:
                return "normal"

        if vix_value < 14:
            return "normal"
        elif vix_value < 20:
            return "volatile"
        else:
            return "illiquid"

    def _estimate_spread(self, premium, vix_value=None):
        """Estimate the bid-ask spread for an option."""
        regime = self._get_spread_regime(vix_value)
        spread_pct = self.SPREAD_MODEL[self.moneyness][regime]

        min_spread = 0.50 if self.moneyness in ("ATM", "ITM") else 1.00

        if self.index_name == "NIFTY":
            min_spread *= 0.7

        return round(max(min_spread, premium * spread_pct), 2)

    def calculate_lots(self, premium):
        """
        Calculate the number of option lots to trade based on capital.

        Args:
            premium (float): The option premium per share (fill price).

        Returns:
            int: Number of lots to trade (between 1 and MAX_LOTS).
        """
        max_premium_per_lot = premium * self.lot_size
        lots = max(1, int(self.capital * MAX_CAPITAL_PER_POSITION_PCT / max_premium_per_lot))
        return min(lots, MAX_LOTS)

    def model_entry(self, spot, direction, atr_value, days_to_expiry,
                    trade_date, time_of_day=None):
        """
        Model an option entry using proper Black-Scholes with real IV.

        Args:
            spot (float): The underlying price at signal.
            direction (str): "LONG" or "SHORT".
            atr_value (float): Current ATR value.
            days_to_expiry (int): Calendar days to nearest monthly expiry.
            trade_date: The date/time of the trade.
            time_of_day: Time of the trade (currently unused).

        Returns:
            dict: Comprehensive entry record with pricing and Greeks.
        """
        strike, option_type = self.select_strike(spot, direction)
        iv = self._get_iv_from_vix(trade_date)

        if isinstance(trade_date, datetime):
            date_str = trade_date.strftime('%Y-%m-%d')
        elif isinstance(trade_date, date):
            date_str = trade_date.strftime('%Y-%m-%d')
        else:
            date_str = str(trade_date)[:10]
        vix_value = VIX_DATA.get(date_str, None)

        theo_price = black_scholes_price(spot, strike, iv, days_to_expiry, option_type)
        delta = abs(black_scholes_delta(spot, strike, iv, days_to_expiry, option_type))
        gamma = black_scholes_gamma(spot, strike, iv, days_to_expiry)
        theta = black_scholes_theta(spot, strike, iv, days_to_expiry, option_type)
        vega = black_scholes_vega(spot, strike, iv, days_to_expiry)

        spread = self._estimate_spread(theo_price, vix_value)
        fill_price = theo_price + spread / 2

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

        Args:
            entry_info (dict): The entry record from model_entry().
            spot_exit (float): The underlying price at exit.
            atr_exit (float): ATR at exit time.
            days_to_expiry (int): Calendar days remaining to expiry.
            trade_date: The exit date/time.
            bars_held (int): Number of bars held.
            entry_tf_minutes (int): Entry timeframe in minutes.

        Returns:
            OptionsFill: Complete record of the options trade.
        """
        strike = entry_info["strike"]
        option_type = entry_info["option_type"]
        entry_premium = entry_info["fill_price"]
        entry_iv = entry_info["iv"]

        exit_iv = self._get_iv_from_vix(trade_date)

        if isinstance(trade_date, datetime):
            date_str = trade_date.strftime('%Y-%m-%d')
        elif isinstance(trade_date, date):
            date_str = trade_date.strftime('%Y-%m-%d')
        else:
            date_str = str(trade_date)[:10]
        vix_value = VIX_DATA.get(date_str, None)

        theo_exit = black_scholes_price(spot_exit, strike, exit_iv,
                                         days_to_expiry, option_type)

        spread_exit = self._estimate_spread(theo_exit, vix_value)
        fill_exit = theo_exit - spread_exit / 2

        lots = entry_info["lots"]
        lot_size = entry_info["lot_size"]
        gross_per_share = fill_exit - entry_premium
        total_gross = gross_per_share * lot_size * lots

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
