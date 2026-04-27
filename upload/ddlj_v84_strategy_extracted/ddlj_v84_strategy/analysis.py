#!/usr/bin/env python3
"""
DDLJ v8.4 Strategy — Performance Analysis Module
==================================================

This module analyzes completed trades and produces comprehensive
performance statistics including:
  - Win rate, profit factor, average win/loss
  - Maximum drawdown (absolute and percentage)
  - Monthly P&L breakdown
  - Exit reason distribution
  - Win/loss streaks
  - Approximate Sharpe ratio
  - Options-specific metrics (spread costs, delta, IV)

WHY COMPREHENSIVE ANALYSIS?
---------------------------
A single metric (like net P&L) tells you very little. You need the
FULL PICTURE to evaluate a strategy:
  - A strategy with +50% returns but 40% drawdown is dangerous
  - A strategy with 70% win rate but tiny wins and huge losses will fail
  - A strategy that only works in one month is unreliable

The analyze() function returns a comprehensive dictionary that can be
compared across different strategy configurations.

Author: DDLJ Strategy Team
Version: 8.4 (Production)
"""

from datetime import datetime
from collections import defaultdict

from .trade_types import Trade


def analyze(trades, label="", capital=50000):
    """
    Analyze a list of completed trades and produce performance statistics.

    This function computes EVERY metric you'd need to evaluate a trading
    strategy. The output is a flat dictionary that's easy to compare,
    sort, filter, and serialize to JSON.

    METRICS COMPUTED:
    ┌────────────────────┬─────────────────────────────────────────────────┐
    │ Category           │ Metrics                                         │
    ├────────────────────┼─────────────────────────────────────────────────┤
    │ Overview           │ total_trades, wins, losses, win_rate            │
    │ Direction Breakdown│ long_trades, short_trades, long_wr, short_wr   │
    │ Profitability      │ gross_profit, gross_loss, net_pnl, net_pnl_pct │
    │ Risk Metrics       │ profit_factor, max_dd, max_dd_pct              │
    │ Trade Quality      │ avg_win, avg_loss, avg_rr, avg_held            │
    │ Streaks            │ max_win_streak, max_loss_streak                 │
    │ Cost Analysis      │ total_costs, cost_per_trade                    │
    │ Options Metrics    │ avg_spread_cost, avg_delta, opt_trades          │
    │ Time Analysis      │ monthly_pnl, trading_days, avg_daily_pnl       │
    │ Risk-Adj Return    │ sharpe_approx                                   │
    │ Extremes           │ largest_win, largest_loss                       │
    └────────────────────┴─────────────────────────────────────────────────┘

    Args:
        trades (list[Trade]): List of completed Trade objects.
        label (str, optional): Label for this analysis (e.g., "BN_15mx60m").
            Default: "".
        capital (float, optional): Starting capital for drawdown and
            percentage calculations. Default: 50000.

    Returns:
        dict: A comprehensive dictionary of performance metrics.
            If no trades, returns a minimal dict with total_trades=0.

    Example:
        >>> result = analyze(trades, label="BN_15mx60m_ITM", capital=50000)
        >>> print(f"Win Rate: {result['win_rate']}%")
        >>> print(f"Net P&L: Rs {result['net_pnl']:,.0f}")
        >>> print(f"Max DD: {result['max_dd_pct']}%")
        >>> print(f"Sharpe: {result['sharpe_approx']}")
    """
    if not trades:
        return {"label": label, "total_trades": 0, "net_pnl": 0, "capital": capital}

    # ── BASIC COUNTS ──
    wins = [t for t in trades if t.net > 0]
    losses = [t for t in trades if t.net <= 0]
    long_trades = [t for t in trades if t.direction == "LONG"]
    short_trades = [t for t in trades if t.direction == "SHORT"]
    long_wins = [t for t in long_trades if t.net > 0]
    short_wins = [t for t in short_trades if t.net > 0]

    # ── PROFITABILITY ──
    gross_profit = sum(t.net for t in wins)
    gross_loss = abs(sum(t.net for t in losses))
    total_costs = sum(t.costs for t in trades)
    net_pnl = sum(t.net for t in trades)

    # ── MAX DRAWDOWN ──
    # Walk through trades sequentially, tracking peak capital and
    # calculating drawdown from peak at each step.
    peak = capital
    max_dd = 0
    max_dd_pct = 0
    running = capital
    for t in trades:
        running += t.net
        if running > peak:
            peak = running
        dd = peak - running
        dd_pct = (dd / peak * 100) if peak > 0 else 0
        if dd > max_dd:
            max_dd = dd
        if dd_pct > max_dd_pct:
            max_dd_pct = dd_pct

    # ── MONTHLY P&L ──
    monthly_pnl = defaultdict(float)
    for t in trades:
        if isinstance(t.exit_time, datetime):
            m = t.exit_time.strftime('%Y-%m')
        else:
            m = str(t.exit_time)[:7]
        monthly_pnl[m] += t.net

    # ── EXIT REASONS ──
    exit_reasons = defaultdict(int)
    for t in trades:
        exit_reasons[t.exit_reason] += 1

    # ── WIN/LOSS STREAKS ──
    max_win_streak = 0
    max_loss_streak = 0
    ws = 0  # Current win streak
    ls = 0  # Current loss streak
    for t in trades:
        if t.net > 0:
            ws += 1
            ls = 0
            max_win_streak = max(max_win_streak, ws)
        else:
            ls += 1
            ws = 0
            max_loss_streak = max(max_loss_streak, ls)

    # ── APPROXIMATE SHARPE RATIO ──
    # Using daily P&L to estimate risk-adjusted return.
    # Sharpe = (avg_daily_return / std_daily_return) × √252
    # This is an approximation — a true Sharpe uses returns, not P&L.
    daily_pnls = defaultdict(float)
    trading_days = set()
    for t in trades:
        if isinstance(t.exit_time, datetime):
            d = t.exit_time.strftime('%Y-%m-%d')
        else:
            d = str(t.exit_time)[:10]
        daily_pnls[d] += t.net
        trading_days.add(d)

    if daily_pnls:
        dpnl_list = list(daily_pnls.values())
        avg_daily = sum(dpnl_list) / len(dpnl_list)
        std_daily = (sum((p - avg_daily)**2 for p in dpnl_list) / len(dpnl_list)) ** 0.5
        sharpe = (avg_daily / std_daily) * (252 ** 0.5) if std_daily > 0 else 0
    else:
        sharpe = 0
        avg_daily = 0

    # ── OPTIONS-SPECIFIC METRICS ──
    opt_trades = [t for t in trades if t.mode == "options"]
    avg_spread = 0
    avg_delta = 0
    if opt_trades:
        avg_spread = sum(t.option_spread_cost for t in opt_trades) / len(opt_trades)
        avg_delta = sum(t.option_delta for t in opt_trades) / len(opt_trades)

    return {
        "label": label,
        "total_trades": len(trades),
        "wins": len(wins),
        "losses": len(losses),
        "win_rate": round(len(wins) / len(trades) * 100, 2),
        "long_trades": len(long_trades),
        "short_trades": len(short_trades),
        "long_wr": round(len(long_wins) / len(long_trades) * 100, 2) if long_trades else 0,
        "short_wr": round(len(short_wins) / len(short_trades) * 100, 2) if short_trades else 0,
        "gross_profit": round(gross_profit, 2),
        "gross_loss": round(gross_loss, 2),
        "total_costs": round(total_costs, 2),
        "net_pnl": round(net_pnl, 2),
        "net_pnl_pct": round(net_pnl / capital * 100, 2),
        "profit_factor": round(gross_profit / gross_loss, 2) if gross_loss > 0 else 999,
        "avg_win": round(gross_profit / len(wins), 2) if wins else 0,
        "avg_loss": round(gross_loss / len(losses), 2) if losses else 0,
        "avg_rr": round(sum(t.rr for t in trades) / len(trades), 2),
        "avg_held": round(sum(t.held for t in trades) / len(trades), 1),
        "max_dd": round(max_dd, 2),
        "max_dd_pct": round(max_dd_pct, 2),
        "long_pnl": round(sum(t.net for t in long_trades), 2),
        "short_pnl": round(sum(t.net for t in short_trades), 2),
        "exit_reasons": dict(exit_reasons),
        "monthly_pnl": {k: round(v, 2) for k, v in sorted(monthly_pnl.items())},
        "cost_per_trade": round(total_costs / len(trades), 2),
        "avg_spread_cost": round(avg_spread, 2),
        "avg_delta": round(avg_delta, 4),
        "opt_trades": len(opt_trades),
        "fut_trades": len(trades) - len(opt_trades),
        "largest_win": round(max(t.net for t in trades), 2),
        "largest_loss": round(min(t.net for t in trades), 2),
        "max_win_streak": max_win_streak,
        "max_loss_streak": max_loss_streak,
        "trading_days": len(trading_days),
        "avg_daily_pnl": round(avg_daily, 2),
        "sharpe_approx": round(sharpe, 2),
        "final_capital": round(capital + net_pnl, 2),
        "starting_capital": capital,
    }
