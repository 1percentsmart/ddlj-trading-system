#!/usr/bin/env python3
"""
DDLJ v9 Strategy — Trade Data Types
======================================

Defines the Trade dataclass for recording completed trades.

BUG FIX #2: The duplicate OptionsFill class has been REMOVED from this file.
OptionsFill now lives ONLY in options_engine.py where it belongs.
This eliminates the confusion of having two identical classes.

If you need OptionsFill, import it from options_engine:
    from ddlj_v9.options_engine import OptionsFill

Author: DDLJ Strategy Team
Version: 9.0 (Paper Trading Production)
"""

from datetime import datetime
from dataclasses import dataclass, field


@dataclass
class Trade:
    """
    Complete record of a completed trade (futures or options).

    This is the MAIN output of the backtester and paper trader. Each Trade
    captures EVERYTHING about a single round-trip trade.

    Attributes:
        symbol (str): Trading symbol (e.g., "BANKNIFTY", "NIFTY").
        direction (str): "LONG" or "SHORT".
        entry (float): Entry price of the underlying (not the option).
        exit (float): Exit price of the underlying.
        entry_time (datetime): When the trade was entered.
        exit_time (datetime): When the trade was exited.
        sl (float): Stop loss price at time of exit (may have been trailed).
        target (float): Target price.
        qty (int): Quantity traded (lots * lot_size for options).
        gross (float): Gross profit/loss in rupees.
        costs (float): Total transaction costs in rupees.
        net (float): Net profit/loss in rupees (gross - costs).
        exit_reason (str): Why the trade was closed.
        rr (float): Risk-reward ratio at entry.
        risk (float): Risk in rupees at entry.
        reward (float): Reward in rupees at entry.
        held (int): Number of bars held.
        is_fut (bool): True for futures trade, False for options.
        cost_bd (dict): Detailed cost breakdown.
        option_strike (float): Strike price if options trade.
        option_type (str): "CE" or "PE" if options trade.
        option_entry_premium (float): Premium paid per share.
        option_exit_premium (float): Premium received per share.
        option_delta (float): Option delta at entry.
        option_iv_entry (float): IV at entry (%).
        option_iv_exit (float): IV at exit (%).
        option_spread_cost (float): Total spread cost (entry + exit).
        option_theta_cost (float): Estimated theta decay cost.
        mode (str): "futures" or "options".
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
