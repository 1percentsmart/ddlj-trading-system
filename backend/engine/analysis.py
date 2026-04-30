#!/usr/bin/env python3
"""
DDLJ v9 Strategy — Performance Analysis Module
==================================================

Analyzes completed trades and produces comprehensive performance statistics.

Author: DDLJ Strategy Team
Version: 9.0 (Paper Trading Production)
"""

from datetime import datetime
from collections import defaultdict

from .trade_types import Trade


def analyze(trades, label="", capital=50000):
    """
    Analyze a list of completed trades and produce performance statistics.

    Args:
        trades (list[Trade]): List of completed Trade objects.
        label (str): Label for this analysis.
        capital (float): Starting capital for calculations.

    Returns:
        dict: Comprehensive dictionary of performance metrics.
    """
    if not trades:
        return {
            "label": label,
            "total_trades": 0,
            "net_pnl": 0,
            "net_pnl_pct": 0.0,
            "capital": capital,
            "win_rate": 0.0,
            "profit_factor": 0.0,
            "max_dd_pct": 0.0,
            "sharpe_approx": 0.0,
            "avg_trade": 0.0,
            "wins": 0,
            "losses": 0,
            "gross_profit": 0.0,
            "gross_loss": 0.0,
            "total_costs": 0.0,
            "avg_win": 0.0,
            "avg_loss": 0.0,
            "avg_rr": 0.0,
            "avg_held": 0.0,
            "max_dd": 0.0,
            "long_trades": 0,
            "short_trades": 0,
            "long_wr": 0.0,
            "short_wr": 0.0,
            "long_pnl": 0.0,
            "short_pnl": 0.0,
            "exit_reasons": {},
            "monthly_pnl": {},
            "cost_per_trade": 0.0,
            "avg_spread_cost": 0.0,
            "avg_delta": 0.0,
            "opt_trades": 0,
            "fut_trades": 0,
            "largest_win": 0.0,
            "largest_loss": 0.0,
            "max_win_streak": 0,
            "max_loss_streak": 0,
            "trading_days": 0,
            "avg_daily_pnl": 0.0,
            "final_capital": capital,
            "starting_capital": capital,
            "trades": [],
        }

    wins = [t for t in trades if t.net > 0]
    losses = [t for t in trades if t.net <= 0]
    long_trades = [t for t in trades if t.direction == "LONG"]
    short_trades = [t for t in trades if t.direction == "SHORT"]
    long_wins = [t for t in long_trades if t.net > 0]
    short_wins = [t for t in short_trades if t.net > 0]

    gross_profit = sum(t.net for t in wins)
    gross_loss = abs(sum(t.net for t in losses))
    total_costs = sum(t.costs for t in trades)
    net_pnl = sum(t.net for t in trades)

    # Max drawdown
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

    # Monthly P&L
    monthly_pnl = defaultdict(float)
    for t in trades:
        if isinstance(t.exit_time, datetime):
            m = t.exit_time.strftime('%Y-%m')
        else:
            m = str(t.exit_time)[:7]
        monthly_pnl[m] += t.net

    # Exit reasons
    exit_reasons = defaultdict(int)
    for t in trades:
        exit_reasons[t.exit_reason] += 1

    # Win/loss streaks
    max_win_streak = 0
    max_loss_streak = 0
    ws = 0
    ls = 0
    for t in trades:
        if t.net > 0:
            ws += 1
            ls = 0
            max_win_streak = max(max_win_streak, ws)
        else:
            ls += 1
            ws = 0
            max_loss_streak = max(max_loss_streak, ls)

    # Approximate Sharpe ratio
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

    # Options-specific metrics
    opt_trades = [t for t in trades if t.mode == "options"]
    avg_spread = 0
    avg_delta = 0
    if opt_trades:
        avg_spread = sum(t.option_spread_cost for t in opt_trades) / len(opt_trades)
        avg_delta = sum(t.option_delta for t in opt_trades) / len(opt_trades)

    # ── Individual trade details ──
    # WHY: The frontend needs to show each trade with date, time, quantity,
    #      entry/exit, SL/target, trigger reason, and P&L. Without this,
    #      the backtest results page shows only aggregate stats and users
    #      cannot understand WHY only 2 trades occurred in 5 months.
    trade_details = []
    for idx, t in enumerate(trades):
        entry_ts = t.entry_time.isoformat() if isinstance(t.entry_time, datetime) else str(t.entry_time)
        exit_ts = t.exit_time.isoformat() if isinstance(t.exit_time, datetime) else str(t.exit_time)
        detail = {
            "id": idx + 1,
            "symbol": t.symbol,
            "direction": t.direction,
            "entry_time": entry_ts,
            "exit_time": exit_ts,
            "entry_price": round(t.entry, 2),
            "exit_price": round(t.exit, 2),
            "sl": round(t.sl, 2),
            "target": round(t.target, 2),
            "qty": t.qty,
            "gross": round(t.gross, 2),
            "costs": round(t.costs, 2),
            "net": round(t.net, 2),
            "exit_reason": t.exit_reason,
            "rr": round(t.rr, 2),
            "risk": round(t.risk, 2),
            "reward": round(t.reward, 2),
            "held_bars": t.held,
            "mode": t.mode,
        }
        # Add option-specific fields if applicable
        if t.mode == "options":
            detail.update({
                "option_strike": t.option_strike,
                "option_type": t.option_type,
                "option_entry_premium": round(t.option_entry_premium, 2),
                "option_exit_premium": round(t.option_exit_premium, 2),
                "option_delta": round(t.option_delta, 4),
                "option_iv_entry": round(t.option_iv_entry, 2),
                "option_iv_exit": round(t.option_iv_exit, 2),
                "option_spread_cost": round(t.option_spread_cost, 2),
            })
        trade_details.append(detail)

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
        "trades": trade_details,
    }
