#!/usr/bin/env python3
"""
DDLJ v8.4 Strategy — Enhanced Backtester (BUG-FIXED)
======================================================

This is the CORE of the backtesting system. It simulates real trading
by processing candles sequentially, managing positions, enforcing risk
rules, and tracking capital.

CRITICAL BUG FIX (v8.4 vs v8.3):
---------------------------------
In v8.3, there was a CAPITAL DOUBLE-COUNTING BUG at the new-day boundary:

    OLD (BUG):
        At the start of each new day:
            current_capital += day_pnl    ← THIS WAS THE BUG

        But trades ALREADY updated current_capital per-trade:
            current_capital += net_pnl    ← This is correct

        Result: Every day's P&L was counted TWICE, making results
        look much better than reality.

    NEW (FIXED):
        At the start of each new day:
            equity_curve.append((date, current_capital))  ← Just record

        Per-trade update:
            current_capital += net_pnl    ← The ONLY capital update

        Result: Capital is tracked correctly, results are realistic.

POSITION MANAGEMENT:
  The backtester implements a sophisticated position management system:

  1. STOP LOSS: If price hits SL, exit immediately
  2. TARGET: If price hits target, exit immediately
  3. NEAR-TARGET: If price comes within 3 pts of target and profitable,
     exit at current price (prevents target reversals)
  4. EOD CLOSE: Force close all positions at 3:10 PM
  5. BIAS FLIP: If market direction reverses and held > 6 bars, exit
  6. TIME EXIT: If held > 24 bars (6 hours on 15m), exit (theta risk)
  7. BREAKEVEN: When unrealized profit ≥ 1× risk, move SL to entry + 1
  8. TRAILING STOP: Every 3 bars after breakeven, trail SL to swing low/high

RISK MANAGEMENT:
  - Daily risk limit: Max daily loss = DAILY_RISK_PCT × day-start capital
  - Max open positions: Typically 2
  - No-trade window: 9:15-9:20 AM (market open volatility)
  - Entry cutoff: No new trades after 2:15 PM

MONTHLY RESET MODE (Method B):
  When monthly_reset=True, capital resets to starting_capital at the
  start of each month. Within each month, capital still compounds.
  This shows how the strategy performs with fresh capital each month,
  which is more realistic for evaluating consistency.

Author: DDLJ Strategy Team
Version: 8.4 (Production)
"""

from datetime import date, time as dtime
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
    NO_TRADE_END_HOUR,
    NO_TRADE_END_MINUTE,
    ENTRY_CUTOFF_HOUR,
    ENTRY_CUTOFF_MINUTE,
    FORCE_CLOSE_HOUR,
    FORCE_CLOSE_MINUTE,
)

# Time boundaries (constructed from config values)
NO_TRADE_END = dtime(NO_TRADE_END_HOUR, NO_TRADE_END_MINUTE)       # e.g., 9:20 AM
ENTRY_CUTOFF = dtime(ENTRY_CUTOFF_HOUR, ENTRY_CUTOFF_MINUTE)       # e.g., 2:15 PM
FORCE_CLOSE_TIME = dtime(FORCE_CLOSE_HOUR, FORCE_CLOSE_MINUTE)     # e.g., 3:10 PM


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
    compounding: bool = True,
    monthly_reset: bool = False,
) -> Tuple[list, list]:
    """
    Run the enhanced backtest with BUG-FIXED capital tracking.

    This is the main backtesting function. It processes candles
    sequentially (simulating real-time), generates signals, manages
    open positions, enforces risk limits, and tracks capital.

    BUG FIX EXPLANATION:
        v8.3 had a bug where daily P&L was added to current_capital at
        the new-day boundary, BUT trades already updated current_capital
        per-trade. This caused double-counting of P&L, inflating results.

        v8.4 FIX: Capital is ONLY updated when a trade closes
        (current_capital += net_pnl). At the new-day boundary, we only
        record the equity curve point. Daily P&L is tracked separately
        for risk limit enforcement.

    Args:
        symbol (str): Trading symbol (e.g., "BANKNIFTY").
        candles_entry (list[Candle]): Candles on the entry timeframe.
        candles_bias (list[Candle]): Candles on the bias timeframe.
        signal_engine: Signal generation engine (EMACrossSignal).
        bias_engine: Market direction engine (BiasEngine).
        options_engine (OptionsMimicryEngine | None): Options pricing engine.
            If None, backtest uses futures mode.
        qty (int): Quantity per trade (futures mode only). Default: 1.
        is_fut (bool): True for futures, False for equity. Default: True.
        slip_pct (float): Slippage percentage for futures cost calc.
            Default: 0.01 (1%).
        entry_tf_minutes (int): Entry timeframe in minutes. Default: 15.
        starting_capital (float): Starting capital in rupees.
            Default: STARTING_CAPITAL from config (50000).
        daily_risk_pct (float): Max daily loss as % of capital.
            Default: DAILY_RISK_PCT from config (6.0).
        max_open_positions (int): Max simultaneous open positions.
            Default: MAX_OPEN_POSITIONS from config (2).
        compounding (bool): Whether capital compounds. Default: True.
        monthly_reset (bool): Reset capital each month. Default: False.
            WHY monthly reset? Method B uses this to evaluate
            performance on a fresh Rs 50K each month.

    Returns:
        Tuple[list[Trade], list[tuple]]: (trades, equity_curve)
            trades: List of completed Trade objects.
            equity_curve: List of (date, capital) tuples for plotting.

    Example:
        >>> trades, equity = run_backtest_enhanced(
        ...     symbol="BANKNIFTY",
        ...     candles_entry=bn_15m,
        ...     candles_bias=bn_60m,
        ...     signal_engine=signal_eng,
        ...     bias_engine=bias_eng,
        ...     options_engine=opt_eng,
        ...     entry_tf_minutes=15,
        ... )
        >>> print(f"Total trades: {len(trades)}")
        >>> print(f"Final capital: Rs {equity[-1][1]:,.0f}")
    """
    # Not enough data to run a meaningful backtest
    if len(candles_entry) < 50:
        return [], []

    # Initialize candle buffers for streaming indicator calculation
    buf_entry = CandleBuffer(2000)  # Entry timeframe buffer
    buf_bias = CandleBuffer(2000)   # Bias timeframe buffer

    # ── Build bias candle index ──
    # WHY an index? Bias candles arrive at a different rate than entry
    # candles. We need to synchronize them so the bias is always up-to-date
    # when we process an entry candle.
    b_idx = {}
    for i, c in enumerate(candles_bias):
        # Create a lookup key based on the timeframe
        if c.timeframe == "60m":
            key = (c.ts.date(), c.ts.hour)
        elif c.timeframe == "15m":
            key = (c.ts.date(), c.ts.hour, c.ts.minute // 15)
        elif c.timeframe == "5m":
            key = (c.ts.date(), c.ts.hour, c.ts.minute // 5)
        else:
            key = (c.ts.date(), c.ts.hour, c.ts.minute)
        b_idx[key] = i

    pushed_bias = -1  # Track how many bias candles we've pushed to buffer
    open_positions = []  # Currently open positions
    trades = []  # Completed trades

    # ── Capital tracking (BUG-FIXED) ──
    # The KEY insight: current_capital is ONLY updated per-trade.
    # We do NOT add daily P&L at day boundaries (that was the bug).
    current_capital = starting_capital
    daily_pnl = {}            # date → cumulative daily P&L (for risk limit)
    daily_start_capital = {}  # date → capital at start of day
    daily_count = {}          # date → number of trades today
    equity_curve = []         # [(date, capital), ...] for plotting
    prev_date = None          # Track day changes
    prev_month = None         # Track month changes (for monthly reset)

    # ── Helper: Estimate Days To Expiry (DTE) ──
    # Indian index options expire on Thursdays (weekly expiry).
    # This function calculates how many calendar days remain until then.
    def estimate_dte(dt):
        """
        Estimate days to the nearest weekly expiry.

        Indian index options (BankNifty, Nifty) now expire every THURSDAY
        (weekly expiry), not just the last Thursday of the month.

        FIX #4: Previously, this function only calculated days to the
        last Thursday of the month (monthly expiry). Since NSE moved to
        weekly expiry, the DTE calculation was incorrect for most weeks,
        overstating the time value in Black-Scholes pricing.

        This fix finds the NEXT Thursday from the current date, which
        is the nearest weekly expiry. If today IS Thursday and after
        market hours, the expiry is the following Thursday.

        WHY DTE is important:
            DTE is a critical input to the Black-Scholes formula.
            Options with fewer days to expiry have:
            - Less time value (lower premium)
            - Faster theta decay (losing value faster)
            - Lower vega (less sensitive to IV changes)
        """
        d = dt.date() if hasattr(dt, 'date') else dt

        # Find the next Thursday (weekday 3)
        days_until_thursday = (3 - d.weekday()) % 7
        if days_until_thursday == 0:
            # Today is Thursday — expiry is today (0 DTE)
            # In practice, if we're still trading, DTE = 0 (same-day expiry)
            expiry = d
        else:
            expiry = d + __import__('datetime').timedelta(days=days_until_thursday)

        dte = (expiry - d).days
        return max(0, dte)

    # ══════════════════════════════════════════════════════════════════
    # MAIN BACKTEST LOOP — Process each entry candle sequentially
    # ══════════════════════════════════════════════════════════════════
    for c_ent in candles_entry:
        ct = c_ent.ts.time() if hasattr(c_ent.ts, 'time') else dtime(12, 0)
        today = c_ent.ts.date()
        cur_month = (today.year, today.month)

        # ── NEW DAY SETUP ──
        if today != prev_date:
            # ═══ BUG FIX: Only record equity, DON'T add day_pnl again ═══
            # In v8.3, the code did: current_capital += day_pnl
            # This was WRONG because trades already update current_capital
            # per-trade (see "current_capital += net" below).
            # Now we ONLY record the equity curve point.
            if prev_date is not None:
                equity_curve.append((prev_date, current_capital))

            # Monthly reset for Method B
            # WHY reset? Method B tests each month independently with
            # fresh capital. This shows if the strategy is consistently
            # profitable or just had one lucky month.
            if monthly_reset and prev_month is not None and cur_month != prev_month:
                current_capital = starting_capital
                if options_engine:
                    options_engine.capital = current_capital

            # Initialize daily tracking
            daily_pnl[today] = 0
            daily_start_capital[today] = current_capital
            prev_date = today
            prev_month = cur_month

        # ── Push entry candle to buffer ──
        buf_entry.push(c_ent)

        # ── Synchronize bias buffer ──
        # Push any bias candles that should have arrived by now
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

        # ── Evaluate bias ──
        bias = bias_engine.evaluate(buf_bias)

        # ════════════════════════════════════════════════════════════════
        # MONITOR OPEN POSITIONS — Check exit conditions for each position
        # ════════════════════════════════════════════════════════════════
        closed_this_bar = []
        for pos in open_positions:
            pos.held += 1  # Count bars held
            action = "HOLD"
            price = 0

            if pos.direction == "LONG":
                # ── LONG EXIT CONDITIONS (checked in priority order) ──

                # 1. STOP LOSS: Price dropped to or below our SL
                if c_ent.low <= pos.sl:
                    action, price = "SL", pos.sl

                # 2. TARGET: Price reached our target
                elif c_ent.high >= pos.target:
                    action, price = "TARGET", pos.target

                # 3. NEAR TARGET: Price came within 3 pts of target,
                #    and we're still profitable. Exit at current price.
                #    WHY? Targets are often psychological levels where
                #    price bounces. Locking in profit near the target
                #    is better than watching it reverse.
                elif c_ent.high >= pos.target - 3 and c_ent.close > pos.entry:
                    action, price = "NEAR_TGT", c_ent.close

                # 4. END-OF-DAY: Force close at 3:10 PM
                #    WHY? We don't hold overnight. Options lose value
                #    overnight (theta), and gaps can be devastating.
                elif ct >= FORCE_CLOSE_TIME:
                    action, price = "EOD", c_ent.close

                # 5. BIAS FLIP: Market direction reversed (was bullish,
                #    now bearish) and we've held for > 6 bars.
                #    WHY > 6 bars? Fresh trades might flip briefly —
                #    we don't want to exit on a momentary bias change.
                elif bias.direction == "BEARISH" and pos.held > 6:
                    action, price = "BIAS_FLIP", c_ent.close

                # 6. TIME EXIT: Held too long (> 24 bars on 15m = 6 hrs)
                #    WHY? Options theta decay accelerates over time.
                #    After 6 hours, the odds of a favorable move diminish.
                elif pos.held >= 24 * (15 // entry_tf_minutes):
                    action, price = "TIME", c_ent.close

                # ── POSITION MANAGEMENT (if no exit triggered) ──
                else:
                    # BREAKEVEN MOVE: If unrealized profit ≥ initial risk,
                    # move SL to entry + 1 (guarantees no loss on this trade)
                    # WHY +1 and not exactly entry? A small buffer avoids
                    # getting stopped out by noise right at breakeven.
                    if not pos._be_done:
                        profit = c_ent.high - pos.entry
                        if profit >= pos.risk:
                            pos.sl = pos.entry + 1
                            pos._be_done = True

                    # TRAILING STOP: After breakeven, every 3 bars check
                    # if we can tighten the SL to the most recent swing low.
                    # WHY every 3 bars? Too frequent = whipsawed out of
                    # good trades. Too infrequent = leaving money on the table.
                    elif pos.held % 3 == 0:
                        sl_cand = buf_entry.last(15)
                        new_sl = swing_low(sl_cand, 15)
                        if new_sl and new_sl > pos.sl:
                            pos.sl = round(new_sl - 0.5, 2)

            else:  # SHORT position — mirror image of LONG
                # ── SHORT EXIT CONDITIONS ──

                # 1. STOP LOSS
                if c_ent.high >= pos.sl:
                    action, price = "SL", pos.sl

                # 2. TARGET
                elif c_ent.low <= pos.target:
                    action, price = "TARGET", pos.target

                # 3. NEAR TARGET
                elif c_ent.low <= pos.target + 3 and c_ent.close < pos.entry:
                    action, price = "NEAR_TGT", c_ent.close

                # 4. END-OF-DAY
                elif ct >= FORCE_CLOSE_TIME:
                    action, price = "EOD", c_ent.close

                # 5. BIAS FLIP (was bearish, now bullish)
                elif bias.direction == "BULLISH" and pos.held > 6:
                    action, price = "BIAS_FLIP", c_ent.close

                # 6. TIME EXIT
                elif pos.held >= 24 * (15 // entry_tf_minutes):
                    action, price = "TIME", c_ent.close

                # ── SHORT POSITION MANAGEMENT ──
                else:
                    # Breakeven
                    if not pos._be_done:
                        profit = pos.entry - c_ent.low
                        if profit >= pos.risk:
                            pos.sl = pos.entry - 1
                            pos._be_done = True

                    # Trailing stop to swing high
                    elif pos.held % 3 == 0:
                        sl_cand = buf_entry.last(15)
                        new_sl = swing_high(sl_cand, 15)
                        if new_sl and new_sl < pos.sl:
                            pos.sl = round(new_sl + 0.5, 2)

            # If an exit was triggered, mark for processing
            if action != "HOLD":
                closed_this_bar.append((pos, action, price if price > 0 else c_ent.close))

        # ════════════════════════════════════════════════════════════════
        # PROCESS CLOSED POSITIONS — Calculate P&L and update capital
        # ════════════════════════════════════════════════════════════════
        for pos, action, ep in closed_this_bar:
            if options_engine:
                # ── OPTIONS TRADE P&L ──
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
                # ── FUTURES TRADE P&L ──
                if pos.direction == "LONG":
                    gross = (ep - pos.entry) * pos.qty
                else:
                    gross = (pos.entry - ep) * pos.qty
                bv = pos.entry * pos.qty
                sv = ep * pos.qty
                if pos.direction == "SHORT":
                    bv, sv = sv, bv  # For cost calc, buy is always lower
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

            # Record the completed trade
            trades.append(trade)

            # ═══ THE ONLY PLACE WHERE CAPITAL IS UPDATED ═══
            # This is the BUG FIX: capital is ONLY updated here,
            # not at the day boundary.
            current_capital += net

            # Track daily P&L for risk limit enforcement
            daily_pnl[today] = daily_pnl.get(today, 0) + net

            # Remove from open positions
            open_positions.remove(pos)

        # ════════════════════════════════════════════════════════════════
        # NEW ENTRY CHECK — Should we open a new position?
        # ════════════════════════════════════════════════════════════════

        # 1. Daily risk limit: If we've lost too much today, stop trading
        day_start = daily_start_capital.get(today, current_capital)
        day_loss = daily_pnl.get(today, 0)
        daily_risk_limit = day_start * daily_risk_pct / 100
        if day_loss < -daily_risk_limit:
            continue  # Skip — daily risk limit reached

        # 2. Max positions: Don't open more than allowed
        if len(open_positions) >= max_open_positions:
            continue

        # 3. Time window: Only enter during allowed hours
        #    - Not before NO_TRADE_END (9:20 AM)
        #    - Not after ENTRY_CUTOFF (2:15 PM)
        if ct < NO_TRADE_END or ct >= ENTRY_CUTOFF:
            continue

        # 4. Generate signal
        sig = signal_engine.evaluate(buf_entry, bias)

        if sig.signal in ("LONG", "SHORT"):
            # 5. Daily trade count limit
            if daily_count.get(today, 0) >= max_open_positions:
                continue

            daily_count[today] = daily_count.get(today, 0) + 1

            # 6. Model the options entry if using options engine
            opt_entry = None
            if options_engine:
                options_engine.capital = current_capital
                dte = estimate_dte(c_ent.ts)
                opt_entry = options_engine.model_entry(
                    sig.entry, sig.direction, sig.atr_val, dte, c_ent.ts, ct
                )
                actual_qty = opt_entry["lots"] * opt_entry["lot_size"]
            else:
                actual_qty = qty

            # 7. Create the new position object
            # WHY use a generic object instead of a dataclass? The position
            # has internal state (_be_done, _opt_entry) that changes during
            # the trade's lifetime. A simple namespace object is cleaner here.
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
                '_be_done': False,        # Has breakeven been triggered?
                '_atr_at_entry': sig.atr_val,
                '_opt_entry': opt_entry,   # Options entry details (or None)
            })()
            open_positions.append(new_pos)

    # Record final equity point
    if prev_date:
        equity_curve.append((prev_date, current_capital))

    return trades, equity_curve
