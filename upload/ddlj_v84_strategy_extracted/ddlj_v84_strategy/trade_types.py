#!/usr/bin/env python3
"""
DDLJ v8.4 Strategy — Trade and Options Fill Data Types
========================================================

This module defines the data structures used to record completed trades
and options fill information. These are the OUTPUT of the backtester.

WHY SEPARATE DATA TYPES?
------------------------
Having well-defined dataclasses for trades provides:
  1. Type safety — you know exactly what fields are available
  2. Documentation — each field is explained in the docstring
  3. Analysis — the analysis module can access fields by name
  4. Serialization — easy to convert to JSON for saving results

Author: DDLJ Strategy Team
Version: 8.4 (Production)
"""

from datetime import datetime
from dataclasses import dataclass, field


@dataclass
class OptionsFill:
    """
    Complete record of an options trade's entry and exit pricing.

    This captures every detail of HOW the options trade was priced,
    including the difference between theoretical (mid) price and actual
    fill price, the spread paid, and the Greeks at entry.

    WHY TRACK ALL THIS?
        When we analyze strategy performance, we need to understand:
        - How much did spreads cost us? (spread_entry + spread_exit)
        - Was IV higher at entry or exit? (iv_entry vs iv_exit)
        - What was our delta exposure? (delta)
        - How much theta decay did we suffer? (theta_daily × days held)
        - Was slippage significant for multi-lot trades? (slippage)

    Attributes:
        strike (float): Option strike price (e.g., 49800).
        option_type (str): "CE" for Call European, "PE" for Put European.
        entry_premium (float): Actual fill price at entry (includes spread).
            This is what we PAID per share.
        exit_premium (float): Actual fill price at exit (includes spread).
            This is what we RECEIVED per share.
        theoretical_entry (float): Black-Scholes mid-price at entry
            (no spread). Used to calculate spread cost.
        theoretical_exit (float): Black-Scholes mid-price at exit.
        spread_entry (float): Bid-ask spread at entry in rupees per share.
            spread_entry = fill_price - theoretical_price (for buy side).
        spread_exit (float): Bid-ask spread at exit in rupees per share.
            spread_exit = theoretical_price - fill_price (for sell side).
        iv_entry (float): Implied volatility at entry (%).
        iv_exit (float): Implied volatility at exit (%).
        delta (float): Option delta at entry (0 to 1 for calls).
            Measures directional exposure.
        theta_daily (float): Daily time decay at entry (rupees/share/day).
            Measures how much the option loses per day from time alone.
        gamma (float): Option gamma at entry.
            Measures how fast delta changes.
        vega (float): Option vega at entry.
            Measures sensitivity to IV changes.
        lot_size (int): Shares per lot (30 for BN, 65 for NF).
        lots (int): Number of lots traded.
        gross_pnl (float): Gross P&L before slippage (rupees).
            = (exit_premium - entry_premium) × lot_size × lots
        net_pnl (float): Net P&L after slippage (rupees).
            = gross_pnl - slippage
        slippage (float): Market impact cost for multi-lot trades.
            WHY only for multi-lot? Single lot trades don't move the market.
            Each additional lot adds Rs 0.10 × lot_size of impact.
        moneyness (str): Option moneyness category.
            "ATM", "ITM", or "DEEP_ITM".
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


@dataclass
class Trade:
    """
    Complete record of a completed trade (futures or options).

    This is the MAIN output of the backtester. Each Trade object captures
    EVERYTHING about a single round-trip trade, from entry to exit.

    WHY SO MANY FIELDS?
        Comprehensive trade records are essential for:
        - Performance analysis (win rate, profit factor, drawdown)
        - Trade journaling (what worked, what didn't)
        - Risk analysis (max loss, consecutive losses)
        - Options analysis (spread costs, theta decay, IV changes)

    Attributes:
        symbol (str): Trading symbol (e.g., "BANKNIFTY", "NIFTY").
        direction (str): Trade direction — "LONG" or "SHORT".
        entry (float): Entry price of the underlying (not the option).
        exit (float): Exit price of the underlying.
        entry_time (datetime): When the trade was entered.
        exit_time (datetime): When the trade was exited.
        sl (float): Stop loss price at the time of exit (may have been
            trailed from the original SL).
        target (float): Target price.
        qty (int): Quantity traded (lots × lot_size for options).
        gross (float): Gross profit/loss in rupees (before costs).
        costs (float): Total transaction costs in rupees.
        net (float): Net profit/loss in rupees (gross - costs).
            THIS is the number that matters for the bottom line.
        exit_reason (str): Why the trade was closed. Possible values:
            "SL"        → Stop loss hit (trade went against us)
            "TARGET"    → Target reached (trade hit our profit goal)
            "NEAR_TGT"  → Price came within 3 pts of target, profitable
            "EOD"       → End-of-day force close (3:10 PM rule)
            "BIAS_FLIP" → Market direction reversed
            "TIME"      → Held too long (theta decay risk)
            "BREAKEVEN" → Stopped out at breakeven (after trailing)
        rr (float): Risk-reward ratio at entry.
        risk (float): Risk in rupees at entry (entry - SL × qty).
        reward (float): Reward in rupees at entry (target - entry × qty).
        held (int): Number of bars the trade was held.
            On 15m TF: held=8 means 2 hours (8 × 15 min).
        is_fut (bool): True if this was a futures trade, False for options.
        cost_bd (dict): Detailed cost breakdown from the cost calculator.
        option_strike (float): Strike price if options trade. Default: 0.
        option_type (str): "CE" or "PE" if options trade. Default: "".
        option_entry_premium (float): Premium paid per share. Default: 0.
        option_exit_premium (float): Premium received per share. Default: 0.
        option_delta (float): Option delta at entry. Default: 0.
        option_iv_entry (float): IV at entry (%). Default: 0.
        option_iv_exit (float): IV at exit (%). Default: 0.
        option_spread_cost (float): Total spread cost (entry + exit).
            Default: 0.
        option_theta_cost (float): Estimated theta decay cost. Default: 0.
        mode (str): Trade mode — "futures" or "options". Default: "futures".

    Example:
        >>> t = Trade(
        ...     symbol="BANKNIFTY", direction="LONG",
        ...     entry=50000, exit=50300,
        ...     entry_time=datetime(2026, 1, 15, 10, 30),
        ...     exit_time=datetime(2026, 1, 15, 14, 0),
        ...     sl=49700, target=50500, qty=30,
        ...     gross=540.0, costs=45.0, net=495.0,
        ...     exit_reason="TARGET", rr=1.67,
        ...     risk=300, reward=500, held=14,
        ...     is_fut=False, mode="options",
        ...     option_strike=49900, option_type="CE",
        ...     option_entry_premium=400.0,
        ...     option_exit_premium=450.0,
        ... )
    """
    symbol: str
    direction: str
    entry: float
    exit: float
    entry_time: datetime
    exit_time: datetime
    sl: float
    target: float
    qty: int
    gross: float
    costs: float
    net: float
    exit_reason: str
    rr: float
    risk: float
    reward: float
    held: int
    is_fut: bool
    cost_bd: dict = field(default_factory=dict)
    option_strike: float = 0
    option_type: str = ""
    option_entry_premium: float = 0
    option_exit_premium: float = 0
    option_delta: float = 0
    option_iv_entry: float = 0
    option_iv_exit: float = 0
    option_spread_cost: float = 0
    option_theta_cost: float = 0
    mode: str = "futures"
