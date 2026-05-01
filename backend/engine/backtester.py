#!/usr/bin/env python3
"""
DDLJ v9 Strategy — Enhanced Backtester (5 BUG FIXES)
======================================================

CORE of the backtesting system. Processes candles sequentially, manages
positions, enforces risk rules, and tracks capital.

BUG FIXES IN v9:
  1. Unrealized loss SUMS all positions (was using min — only worst single)
  2. Removed duplicate OptionsFill (now only in options_engine.py)
  3. MAX_DAILY_TRADES separate from MAX_OPEN_POSITIONS
  4. Drawdown circuit breaker tracks PEAK capital (not starting capital)
  5. Replaced __import__('datetime') with proper timedelta import

Author: DDLJ Strategy Team
Version: 9.0 (Paper Trading Production)
"""

import calendar
from datetime import date, time as dtime, timedelta
from typing import Tuple
from collections import defaultdict

from .candle_data import CandleBuffer
from .indicators import swing_high, swing_low
from .cost_calculator import calc_costs_futures, calc_costs_options
from .trade_types import Trade
from .config import (
    STARTING_CAPITAL,
    DAILY_RISK_PCT,
    MAX_OPEN_POSITIONS,
    MAX_DAILY_TRADES,       # BUG FIX #3: Separate from max_open_positions
    MAX_DAILY_TRADES_ENABLED, # Toggle for max daily trades limit
    NO_TRADE_END_HOUR,
    NO_TRADE_END_MINUTE,
    ENTRY_CUTOFF_HOUR,
    ENTRY_CUTOFF_MINUTE,
    FORCE_CLOSE_HOUR,
    FORCE_CLOSE_MINUTE,
    PEAK_CAPITAL_TRACKING,  # BUG FIX #4: Track peak capital
    DRAWDOWN_CIRCUIT_BREAKER,  # BUG FIX #13: Config parameter
    CAPITAL_FLOOR_PCT,         # BUG FIX #14: Config parameter
    MAX_TRADE_HOURS,           # BUG FIX #6: Config parameter
    BE_TRIGGER_RISK_MULT,      # BUG FIX #15: Breakeven trigger from config
    TRAILING_STOP_ENABLED,     # BUG FIX #15: Trailing stop toggle from config
    TRAIL_EVERY_N_CANDLES,     # BUG FIX #15: Trail frequency from config
    BIAS_FLIP_MIN_HELD,        # BUG FIX #15: Bias flip min held from config
    NEAR_TARGET_ATR,           # BUG FIX #10: Near-target threshold from config
)

# Time boundaries
NO_TRADE_END = dtime(NO_TRADE_END_HOUR, NO_TRADE_END_MINUTE)
ENTRY_CUTOFF = dtime(ENTRY_CUTOFF_HOUR, ENTRY_CUTOFF_MINUTE)
FORCE_CLOSE_TIME = dtime(FORCE_CLOSE_HOUR, FORCE_CLOSE_MINUTE)


def run_backtest_enhanced(
    symbol: str,
    candles_entry: list,
    candles_bias: list,
    signal_engine,
    bias_engine,
    options_engine=None,
    qty: int = 1,
    is_fut: bool = True,
    slip_pct: float = 0.01,
    entry_tf_minutes: int = 15,
    starting_capital: float = STARTING_CAPITAL,
    daily_risk_pct: float = DAILY_RISK_PCT,
    max_open_positions: int = MAX_OPEN_POSITIONS,
    max_daily_trades: int = MAX_DAILY_TRADES,  # BUG FIX #3
    max_daily_trades_enabled: bool = MAX_DAILY_TRADES_ENABLED,  # Toggle
    compounding: bool = True,
    monthly_reset: bool = False,
) -> Tuple[list, list]:
    """
    Run the enhanced backtest with all 5 bug fixes.

    Args:
        symbol (str): Trading symbol.
        candles_entry (list[Candle]): Candles on the entry timeframe.
        candles_bias (list[Candle]): Candles on the bias timeframe.
        signal_engine: Signal generation engine.
        bias_engine: Market direction engine.
        options_engine (OptionsMimicryEngine | None): Options pricing engine.
        qty (int): Quantity per trade (futures mode only).
        is_fut (bool): True for futures.
        slip_pct (float): Slippage percentage.
        entry_tf_minutes (int): Entry timeframe in minutes.
        starting_capital (float): Starting capital.
        daily_risk_pct (float): Max daily loss as %.
        max_open_positions (int): Max simultaneous positions.
        max_daily_trades (int): BUG FIX #3 — Max entries per day (separate!).
        compounding (bool): Whether capital compounds.
        monthly_reset (bool): Reset capital each month.

    Returns:
        Tuple[list[Trade], list[tuple]]: (trades, equity_curve)
    """
    if len(candles_entry) < 50:
        return [], []

    buf_entry = CandleBuffer(2000)
    buf_bias = CandleBuffer(2000)

    # Build bias candle index
    b_idx = {}
    for i, c in enumerate(candles_bias):
        if c.timeframe == "60m":
            key = (c.ts.date(), c.ts.hour)
        elif c.timeframe == "15m":
            key = (c.ts.date(), c.ts.hour, c.ts.minute // 15)
        elif c.timeframe == "5m":
            key = (c.ts.date(), c.ts.hour, c.ts.minute // 5)
        else:
            key = (c.ts.date(), c.ts.hour, c.ts.minute)
        b_idx[key] = i

    pushed_bias = -1
    open_positions = []
    trades = []

    # Capital tracking (BUG-FIXED)
    current_capital = starting_capital
    peak_capital = starting_capital       # BUG FIX #4: Track peak capital
    daily_pnl = {}
    daily_start_capital = {}
    daily_count = {}
    equity_curve = []
    prev_date = None
    prev_month = None

    # BUG FIX #6: Calculate max candles based on trading hours
    # OLD: 24 * (15 // entry_tf_minutes) → gives 0 for 60m TF!
    # NEW: (max_trade_hours * 60) / entry_tf_minutes → correct for all TFs
    try:
        _max_trade_hours = MAX_TRADE_HOURS
    except NameError:
        _max_trade_hours = 6.0
    max_candles = max(1, int(_max_trade_hours * 60 / entry_tf_minutes))

    # BUG FIX #5: Import timedelta at top level instead of __import__('datetime')
    # Previously: expiry = d + __import__('datetime').timedelta(days=days_until_thursday)
    # Now: use timedelta imported at the top of this file.

    def estimate_dte(dt):
        """
        Estimate days to the nearest MONTHLY options expiry.

        BUG FIX #5: Uses proper timedelta import instead of __import__.
        BUG FIX #7: Uses MONTHLY expiry (last Thursday) instead of weekly.

        WHY: Indian index options expire on the last Thursday of each month.
        The old code used the next Thursday, which gave wrong DTE for
        options mid-month (e.g., April 6 would give DTE=3 instead of 24).
        """
        d = dt.date() if hasattr(dt, 'date') else dt

        # Find last Thursday of current month
        last_day = calendar.monthrange(d.year, d.month)[1]
        expiry = date(d.year, d.month, last_day)
        while expiry.weekday() != 3:
            expiry -= timedelta(days=1)

        # If expiry has passed, use next month
        if d > expiry:
            if d.month == 12:
                expiry = date(d.year + 1, 1, 31)
            else:
                expiry = date(d.year, d.month + 1, calendar.monthrange(d.year, d.month + 1)[1])
            while expiry.weekday() != 3:
                expiry -= timedelta(days=1)

        dte = (expiry - d).days
        return max(0, dte)

    # ══════════════════════════════════════════════════════════════════
    # MAIN BACKTEST LOOP
    # ══════════════════════════════════════════════════════════════════
    for c_ent in candles_entry:
        ct = c_ent.ts.time() if hasattr(c_ent.ts, 'time') else dtime(12, 0)
        today = c_ent.ts.date()
        cur_month = (today.year, today.month)

        # NEW DAY SETUP
        if today != prev_date:
            if prev_date is not None:
                equity_curve.append((prev_date, current_capital))

            if monthly_reset and prev_month is not None and cur_month != prev_month:
                current_capital = starting_capital
                peak_capital = starting_capital  # BUG FIX #4: Reset peak too
                if options_engine:
                    options_engine.capital = current_capital

            daily_pnl[today] = 0
            daily_start_capital[today] = current_capital
            prev_date = today
            prev_month = cur_month

        # Push entry candle
        buf_entry.push(c_ent)

        # Synchronize bias buffer
        if candles_bias:
            if candles_bias[0].timeframe == "60m":
                key = (c_ent.ts.date(), c_ent.ts.hour)
            elif candles_bias[0].timeframe == "15m":
                key = (c_ent.ts.date(), c_ent.ts.hour, c_ent.ts.minute // 15)
            elif candles_bias[0].timeframe == "5m":
                key = (c_ent.ts.date(), c_ent.ts.hour, c_ent.ts.minute // 5)
            else:
                key = (c_ent.ts.date(), c_ent.ts.hour, c_ent.ts.minute)

            if key in b_idx:
                tgt = b_idx[key]
                while pushed_bias < tgt:
                    pushed_bias += 1
                    if pushed_bias < len(candles_bias):
                        buf_bias.push(candles_bias[pushed_bias])

        # Evaluate bias
        bias = bias_engine.evaluate(buf_bias)

        # ════════════════════════════════════════════════════════════════
        # MONITOR OPEN POSITIONS
        # ════════════════════════════════════════════════════════════════
        closed_this_bar = []
        for pos in open_positions:
            pos.held += 1
            action = "HOLD"
            price = 0

            if pos.direction == "LONG":
                if c_ent.low <= pos.sl:
                    action, price = "SL", pos.sl
                elif c_ent.high >= pos.target:
                    action, price = "TARGET", pos.target
                # BUG FIX #10: Near Target threshold scaled by ATR (was hardcoded 3)
                elif c_ent.high >= pos.target - NEAR_TARGET_ATR * pos._atr_at_entry and c_ent.close > pos.entry:
                    action, price = "NEAR_TGT", c_ent.close
                elif ct >= FORCE_CLOSE_TIME:
                    action, price = "EOD", c_ent.close
                # BUG FIX #15: Bias flip min held from config (was hardcoded 6)
                elif bias.direction == "BEARISH" and pos.held > BIAS_FLIP_MIN_HELD:
                    action, price = "BIAS_FLIP", c_ent.close
                elif pos.held >= max_candles:  # BUG FIX #6: proper time exit
                    action, price = "TIME", c_ent.close
                else:
                    # BUG FIX #15: BE trigger uses config multiplier (was hardcoded 1.0)
                    if not pos._be_done:
                        profit = c_ent.high - pos.entry
                        if profit >= pos.risk * BE_TRIGGER_RISK_MULT:
                            pos.sl = pos.entry + 1
                            pos._be_done = True
                    # BUG FIX #15: Trailing stop uses config toggle and frequency
                    elif TRAILING_STOP_ENABLED and pos.held % TRAIL_EVERY_N_CANDLES == 0:
                        sl_cand = buf_entry.last(15)
                        new_sl = swing_low(sl_cand, 15)
                        if new_sl and new_sl > pos.sl:
                            pos.sl = round(new_sl - 0.5, 2)

            else:  # SHORT
                if c_ent.high >= pos.sl:
                    action, price = "SL", pos.sl
                elif c_ent.low <= pos.target:
                    action, price = "TARGET", pos.target
                # BUG FIX #10: Near Target threshold scaled by ATR (was hardcoded 3)
                elif c_ent.low <= pos.target + NEAR_TARGET_ATR * pos._atr_at_entry and c_ent.close < pos.entry:
                    action, price = "NEAR_TGT", c_ent.close
                elif ct >= FORCE_CLOSE_TIME:
                    action, price = "EOD", c_ent.close
                # BUG FIX #15: Bias flip min held from config (was hardcoded 6)
                elif bias.direction == "BULLISH" and pos.held > BIAS_FLIP_MIN_HELD:
                    action, price = "BIAS_FLIP", c_ent.close
                elif pos.held >= max_candles:  # BUG FIX #6: proper time exit
                    action, price = "TIME", c_ent.close
                else:
                    # BUG FIX #15: BE trigger uses config multiplier (was hardcoded 1.0)
                    if not pos._be_done:
                        profit = pos.entry - c_ent.low
                        if profit >= pos.risk * BE_TRIGGER_RISK_MULT:
                            pos.sl = pos.entry - 1
                            pos._be_done = True
                    # BUG FIX #15: Trailing stop uses config toggle and frequency
                    elif TRAILING_STOP_ENABLED and pos.held % TRAIL_EVERY_N_CANDLES == 0:
                        sl_cand = buf_entry.last(15)
                        new_sl = swing_high(sl_cand, 15)
                        if new_sl and new_sl < pos.sl:
                            pos.sl = round(new_sl + 0.5, 2)

            if action != "HOLD":
                closed_this_bar.append((pos, action, price if price > 0 else c_ent.close))

        # ════════════════════════════════════════════════════════════════
        # PROCESS CLOSED POSITIONS
        # ════════════════════════════════════════════════════════════════
        for pos, action, ep in closed_this_bar:
            if options_engine:
                options_engine.capital = current_capital
                dte = estimate_dte(c_ent.ts)
                opt_exit = options_engine.model_exit(
                    pos._opt_entry, ep, pos._atr_at_entry, dte,
                    c_ent.ts, ct, pos.held, entry_tf_minutes
                )
                gross = opt_exit.net_pnl
                costs_opt, bd_opt = calc_costs_options(
                    pos._opt_entry["fill_price"], opt_exit.exit_premium,
                    options_engine.lot_size, pos._opt_entry["lots"]
                )
                net = gross - costs_opt
                trade = Trade(
                    symbol=symbol, direction=pos.direction,
                    entry=pos.entry, exit=ep,
                    entry_time=pos.entry_time, exit_time=c_ent.ts,
                    sl=pos.sl, target=pos.target, qty=pos.qty,
                    gross=round(gross, 2), costs=round(costs_opt, 2),
                    net=round(net, 2), exit_reason=action,
                    rr=pos.rr, risk=pos.risk, reward=pos.reward,
                    held=pos.held, is_fut=False, cost_bd=bd_opt,
                    option_strike=opt_exit.strike,
                    option_type=opt_exit.option_type,
                    option_entry_premium=opt_exit.entry_premium,
                    option_exit_premium=opt_exit.exit_premium,
                    option_delta=opt_exit.delta,
                    option_iv_entry=opt_exit.iv_entry,
                    option_iv_exit=opt_exit.iv_exit,
                    option_spread_cost=round(
                        opt_exit.spread_entry + opt_exit.spread_exit, 2
                    ),
                    mode="options",
                )
            else:
                if pos.direction == "LONG":
                    gross = (ep - pos.entry) * pos.qty
                else:
                    gross = (pos.entry - ep) * pos.qty
                bv = pos.entry * pos.qty
                sv = ep * pos.qty
                if pos.direction == "SHORT":
                    bv, sv = sv, bv
                costs, bd = calc_costs_futures(bv, sv, is_fut, slip_pct)
                net = gross - costs
                trade = Trade(
                    symbol=symbol, direction=pos.direction,
                    entry=pos.entry, exit=ep,
                    entry_time=pos.entry_time, exit_time=c_ent.ts,
                    sl=pos.sl, target=pos.target, qty=pos.qty,
                    gross=round(gross, 2), costs=round(costs, 2),
                    net=round(net, 2), exit_reason=action,
                    rr=pos.rr, risk=pos.risk, reward=pos.reward,
                    held=pos.held, is_fut=is_fut, cost_bd=bd,
                    mode="futures",
                )

            trades.append(trade)
            current_capital += net
            daily_pnl[today] = daily_pnl.get(today, 0) + net

            # BUG FIX #4: Update peak capital
            if PEAK_CAPITAL_TRACKING and current_capital > peak_capital:
                peak_capital = current_capital

            open_positions.remove(pos)

        # ════════════════════════════════════════════════════════════════
        # NEW ENTRY CHECK
        # ════════════════════════════════════════════════════════════════

        # 1. Daily risk limit with BUG FIX #1: SUM all unrealized losses
        day_start = daily_start_capital.get(today, current_capital)
        day_loss_realized = daily_pnl.get(today, 0)

        # BUG FIX #1: SUM all worst-case losses (was using min — only kept worst single)
        # Previously: unrealized_loss = min(unrealized_loss, worst_case_per_pos)
        # Now: unrealized_loss = SUM(worst_case_per_pos for all positions)
        unrealized_loss = 0
        for pos in open_positions:
            if pos.direction == "LONG":
                worst_case = (pos.sl - pos.entry) * pos.qty if options_engine is None else -pos._opt_entry["fill_price"] * pos._opt_entry["lots"] * pos._opt_entry["lot_size"]
            else:
                worst_case = (pos.entry - pos.sl) * pos.qty if options_engine is None else -pos._opt_entry["fill_price"] * pos._opt_entry["lots"] * pos._opt_entry["lot_size"]
            unrealized_loss += worst_case  # BUG FIX #1: SUM all positions

        total_day_risk = day_loss_realized + unrealized_loss
        daily_risk_limit = day_start * daily_risk_pct / 100
        if total_day_risk < -daily_risk_limit:
            continue

        # 2. Max positions
        if len(open_positions) >= max_open_positions:
            continue

        # 3. Time window
        if ct < NO_TRADE_END or ct >= ENTRY_CUTOFF:
            continue

        # BUG FIX #14: Capital floor uses config (was hardcoded 0.20)
        try:
            _cap_floor = CAPITAL_FLOOR_PCT
        except NameError:
            _cap_floor = 0.20
        if current_capital < starting_capital * _cap_floor:
            continue

        # BUG FIX #13: Drawdown circuit breaker uses config (was hardcoded 0.80)
        try:
            _dd_breaker = DRAWDOWN_CIRCUIT_BREAKER
        except NameError:
            _dd_breaker = 0.80
        effective_capital = current_capital
        if PEAK_CAPITAL_TRACKING:
            dd_ratio = current_capital / peak_capital if peak_capital > 0 else 1
        else:
            dd_ratio = current_capital / starting_capital if starting_capital > 0 else 1
        if dd_ratio < _dd_breaker:
            effective_capital = current_capital * dd_ratio

        # 6. Generate signal
        sig = signal_engine.evaluate(buf_entry, bias)

        if sig.signal in ("LONG", "SHORT"):
            # BUG FIX #3: Daily trade count uses MAX_DAILY_TRADES, not max_open_positions
            # Previously: if daily_count.get(today, 0) >= max_open_positions:
            # Now: if daily_count.get(today, 0) >= max_daily_trades:
            # Toggle: if max_daily_trades_enabled is False, skip this check entirely
            if max_daily_trades_enabled and daily_count.get(today, 0) >= max_daily_trades:
                continue

            daily_count[today] = daily_count.get(today, 0) + 1

            # 8. Model options entry
            opt_entry = None
            if options_engine:
                options_engine.capital = effective_capital
                dte = estimate_dte(c_ent.ts)
                opt_entry = options_engine.model_entry(
                    sig.entry, sig.direction, sig.atr_val, dte, c_ent.ts, ct
                )
                actual_qty = opt_entry["lots"] * opt_entry["lot_size"]

                worst_case_new_loss = opt_entry["fill_price"] * opt_entry["lots"] * opt_entry["lot_size"]
                existing_worst_loss = sum(
                    p._opt_entry["fill_price"] * p._opt_entry["lots"] * p._opt_entry["lot_size"]
                    for p in open_positions if p._opt_entry
                )
                if worst_case_new_loss + existing_worst_loss > current_capital:
                    continue
            else:
                actual_qty = qty

            # 9. Create new position
            new_pos = type('OT', (), {
                'symbol': symbol,
                'direction': sig.direction,
                'entry': sig.entry,
                'entry_time': c_ent.ts,
                'qty': actual_qty,
                'sl': sig.sl,
                'target': sig.target,
                'rr': sig.rr,
                'risk': sig.risk,
                'reward': sig.reward,
                'held': 0,
                '_be_done': False,
                '_atr_at_entry': sig.atr_val,
                '_opt_entry': opt_entry,
            })()
            open_positions.append(new_pos)

    # Record final equity point
    if prev_date:
        equity_curve.append((prev_date, current_capital))

    return trades, equity_curve
