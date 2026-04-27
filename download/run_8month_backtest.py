#!/usr/bin/env python3
"""
DDLJ v8.4 Strategy — 8-Month Comprehensive Backtest
=====================================================

Two Testing Methods:
  Method A — Full 8 months with compounding capital (Rs 50K start)
  Method B — 4 batches of 2 months each, capital reset to Rs 50K every batch

Capital: Rs 50,000
Max Daily Risk: 6%
Max Simultaneous Positions: 2
Max Risk Per Position: No limit (OFF)

Test Period: Sep 1, 2025 → Apr 27, 2026 (8 months)
"""

import os
import sys
import json
import logging
import time
from datetime import date, datetime, timedelta
from collections import defaultdict

# ── Add strategy to path ──
STRATEGY_PATH = "/home/z/my-project/upload/ddlj_v84_strategy_extracted"
sys.path.insert(0, STRATEGY_PATH)

from ddlj_v84_strategy.config import (
    STARTING_CAPITAL, DAILY_RISK_PCT, MAX_OPEN_POSITIONS,
    RISK_PER_POSITION_PCT, BN_INDEX_TOKEN, NF_INDEX_TOKEN,
    BN_FUT_TOKEN, NF_FUT_TOKEN, VIX_TOKEN,
    KITE_API_KEY, KITE_TOKEN_FILE, CACHE_DIR,
    BANKNIFTY_LOT_SIZE, NIFTY_LOT_SIZE,
    BANKNIFTY_STRIKE_STEP, NIFTY_STRIKE_STEP,
)
from ddlj_v84_strategy.candle_data import parse_candles, filter_candles_by_date
from ddlj_v84_strategy.bias_engine import BiasEngine
from ddlj_v84_strategy.signal_engine import EMACrossSignal
from ddlj_v84_strategy.options_engine import OptionsMimicryEngine, load_vix_data
from ddlj_v84_strategy.backtester import run_backtest_enhanced
from ddlj_v84_strategy.analysis import analyze
from ddlj_v84_strategy.token_manager import get_kite_session
from ddlj_v84_strategy.data_fetcher import KiteDataFetcher
from ddlj_v84_strategy.cost_calculator import calc_costs_options

# ── Logging ──
log = logging.getLogger("8month_bt")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)

# ═══════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════
TEST_START = date(2025, 9, 1)
TEST_END = date(2026, 4, 27)
STARTING_CAP = 50000
DAILY_RISK = 6.0
MAX_POSITIONS = 2
RISK_PER_POS = None  # OFF — no per-position risk limit

# 4 batches of 2 months each for Method B
BIMONTHLY_BATCHES = [
    ("Batch1: Sep-Oct 2025", date(2025, 9, 1), date(2025, 10, 31)),
    ("Batch2: Nov-Dec 2025", date(2025, 11, 1), date(2025, 12, 31)),
    ("Batch3: Jan-Feb 2026", date(2026, 1, 1), date(2026, 2, 28)),
    ("Batch4: Mar-Apr 2026", date(2026, 3, 1), date(2026, 4, 27)),
]

# Best configuration based on prior backtesting
BEST_CONFIG = {
    "instrument": "BANKNIFTY",
    "entry_tf": "15m",
    "bias_tf": "60m",
    "sl_atr": 2.0,
    "min_rr": 1.5,
    "moneyness": "ITM",
    "spread_regime": "auto",
}

# Also run a broader sweep for comparison
ALL_CONFIGS = [
    # (entry_tf, bias_tf, sl_atr, min_rr, moneyness, label_suffix)
    ("15m", "60m", 2.0, 1.5, "ITM", "15x60_sl2.0_RR1.5_ITM"),
    ("15m", "60m", 2.0, 1.5, "ATM", "15x60_sl2.0_RR1.5_ATM"),
    ("15m", "60m", 2.5, 2.0, "ITM", "15x60_sl2.5_RR2.0_ITM"),
    ("15m", "15m", 2.0, 1.5, "ITM", "15x15_sl2.0_RR1.5_ITM"),
    ("5m",  "60m", 2.0, 1.5, "ITM", "5x60_sl2.0_RR1.5_ITM"),
]


def fetch_vix_extended(fetcher, start, end):
    """Fetch India VIX data for the extended period and merge with existing."""
    log.info("Fetching India VIX data: %s to %s", start, end)
    vix_raw = fetcher.fetch_candles_chunked(VIX_TOKEN, start, end, "day")

    vix_by_date = {}
    for v in vix_raw:
        dt = v['date']
        if isinstance(dt, str):
            d = dt[:10]
        elif isinstance(dt, datetime):
            d = dt.strftime('%Y-%m-%d')
        else:
            d = str(dt)[:10]
        vix_by_date[d] = float(v['close'])

    # Also load existing VIX data
    existing = load_vix_data()
    vix_by_date.update(existing)  # Merge, existing takes priority

    log.info("Total VIX data points: %d", len(vix_by_date))
    return vix_by_date


def fetch_all_data(fetcher, start, end):
    """Fetch all required data from Kite API with caching."""
    log.info("=" * 70)
    log.info("FETCHING HISTORICAL DATA")
    log.info("=" * 70)

    # Resolve futures tokens dynamically
    bn_fut = BN_FUT_TOKEN
    nf_fut = NF_FUT_TOKEN
    try:
        resolved_bn = fetcher.resolve_future_token("BANKNIFTY")
        resolved_nf = fetcher.resolve_future_token("NIFTY")
        if resolved_bn: bn_fut = resolved_bn
        if resolved_nf: nf_fut = resolved_nf
        log.info("Futures tokens: BN=%d, NF=%d", bn_fut, nf_fut)
    except Exception as e:
        log.warning("Could not resolve futures tokens: %s", e)

    data = {}
    for label, token in [("BN_INDEX", BN_INDEX_TOKEN), ("BN_FUT", bn_fut),
                          ("NF_INDEX", NF_INDEX_TOKEN), ("NF_FUT", nf_fut)]:
        for interval_name, interval_api in [("5m", "5minute"), ("15m", "15minute"), ("60m", "60minute")]:
            key = f"{label}_{interval_name}"
            log.info("  Fetching %s ...", key)
            raw = fetcher.fetch_candles_chunked(token, start, end, interval_api)
            data[key] = raw
            log.info("    Got %d candles", len(raw))

    return data, bn_fut, nf_fut


def parse_and_filter(data, start, end):
    """Parse raw data into Candle objects and filter to test period."""
    parsed = {}
    for key, raw in data.items():
        if "BN" in key:
            symbol = "BANKNIFTY"
        else:
            symbol = "NIFTY"

        tf = key.split("_")[-1]  # e.g., "5m", "15m", "60m"
        candles = parse_candles(raw, symbol, tf)
        filtered = filter_candles_by_date(candles, start, end)
        parsed[key] = filtered
        log.info("  %s: %d candles after parse+filter", key, len(filtered))

    return parsed


def run_single_backtest(symbol, entry_candles, bias_candles, config, start, end,
                        compounding=True, monthly_reset=False, batch_reset_months=2):
    """Run a single backtest configuration."""
    entry_tf = config.get("entry_tf", "15m")
    bias_tf = config.get("bias_tf", "60m")
    sl_atr = config.get("sl_atr", 2.0)
    min_rr = config.get("min_rr", 1.5)
    moneyness = config.get("moneyness", "ITM")
    spread_regime = config.get("spread_regime", "auto")

    entry_tf_minutes = 5 if entry_tf == "5m" else 15

    signal_engine = EMACrossSignal(sl_atr=sl_atr, min_rr=min_rr)
    bias_engine = BiasEngine()
    opt_engine = OptionsMimicryEngine(
        index_name=symbol,
        moneyness=moneyness,
        spread_regime=spread_regime,
        capital=STARTING_CAP,
    )

    # For Method B (batch reset), we need custom behavior:
    # Reset capital every N months instead of every month
    if batch_reset_months and monthly_reset:
        # We'll use the monthly_reset mechanism but with custom batch intervals
        # by passing a modified version of the backtester
        trades, eq = run_backtest_enhanced_with_batch_reset(
            symbol=symbol,
            candles_entry=entry_candles,
            candles_bias=bias_candles,
            signal_engine=signal_engine,
            bias_engine=bias_engine,
            options_engine=opt_engine,
            entry_tf_minutes=entry_tf_minutes,
            compounding=compounding,
            batch_reset_months=batch_reset_months,
            starting_capital=STARTING_CAP,
        )
    else:
        trades, eq = run_backtest_enhanced(
            symbol=symbol,
            candles_entry=entry_candles,
            candles_bias=bias_candles,
            signal_engine=signal_engine,
            bias_engine=bias_engine,
            options_engine=opt_engine,
            entry_tf_minutes=entry_tf_minutes,
            compounding=compounding,
            monthly_reset=False,
        )

    return trades, eq


def run_backtest_enhanced_with_batch_reset(
    symbol, candles_entry, candles_bias, signal_engine, bias_engine,
    options_engine=None, entry_tf_minutes=15, compounding=True,
    batch_reset_months=2, starting_capital=STARTING_CAP,
):
    """
    Run backtest with capital reset every N months (batch reset).
    This is Method B: 4 batches of 2 months each.
    """
    from ddlj_v84_strategy.candle_data import CandleBuffer
    from ddlj_v84_strategy.indicators import swing_high, swing_low
    from ddlj_v84_strategy.cost_calculator import calc_costs_futures, calc_costs_options
    from ddlj_v84_strategy.trade_types import Trade
    from ddlj_v84_strategy.config import (
        DAILY_RISK_PCT, MAX_OPEN_POSITIONS,
        NO_TRADE_END_HOUR, NO_TRADE_END_MINUTE,
        ENTRY_CUTOFF_HOUR, ENTRY_CUTOFF_MINUTE,
        FORCE_CLOSE_HOUR, FORCE_CLOSE_MINUTE,
    )
    from datetime import time as dtime

    NO_TRADE_END = dtime(NO_TRADE_END_HOUR, NO_TRADE_END_MINUTE)
    ENTRY_CUTOFF = dtime(ENTRY_CUTOFF_HOUR, ENTRY_CUTOFF_MINUTE)
    FORCE_CLOSE_TIME = dtime(FORCE_CLOSE_HOUR, FORCE_CLOSE_MINUTE)
    DAILY_RISK_PCT_VAL = DAILY_RISK_PCT
    MAX_OPEN_POSITIONS_VAL = MAX_OPEN_POSITIONS

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
    current_capital = starting_capital
    daily_pnl = {}
    daily_start_capital = {}
    daily_count = {}
    equity_curve = []
    prev_date = None
    prev_month_key = None  # (year, batch_number)

    def estimate_dte(dt):
        d = dt.date() if hasattr(dt, 'date') else dt
        days_until_thursday = (3 - d.weekday()) % 7
        if days_until_thursday == 0:
            expiry = d
        else:
            expiry = d + timedelta(days=days_until_thursday)
        dte = (expiry - d).days
        return max(0, dte)

    def get_batch_key(dt):
        """Get batch key based on 2-month grouping."""
        # Batch 1: Sep-Oct, Batch 2: Nov-Dec, Batch 3: Jan-Feb, Batch 4: Mar-Apr
        year = dt.year
        month = dt.month
        # Group: months 1-2, 3-4, 5-6, 7-8, 9-10, 11-12
        batch_num = (month - 1) // 2 + 1
        return (year, batch_num)

    for c_ent in candles_entry:
        ct = c_ent.ts.time() if hasattr(c_ent.ts, 'time') else dtime(12, 0)
        today = c_ent.ts.date()
        cur_batch_key = get_batch_key(today)

        # New day setup
        if today != prev_date:
            if prev_date is not None:
                equity_curve.append((prev_date, current_capital))

            # BATCH RESET: Reset capital when entering a new 2-month batch
            if prev_month_key is not None and cur_batch_key != prev_month_key:
                log.info("  BATCH RESET: %s → %s, Capital: Rs %,.0f → Rs %,.0f",
                         prev_month_key, cur_batch_key, current_capital, starting_capital)
                current_capital = starting_capital
                if options_engine:
                    options_engine.capital = current_capital

            daily_pnl[today] = 0
            daily_start_capital[today] = current_capital
            prev_date = today
            prev_month_key = cur_batch_key

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

        bias = bias_engine.evaluate(buf_bias)

        # Monitor open positions
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
                elif c_ent.high >= pos.target - 3 and c_ent.close > pos.entry:
                    action, price = "NEAR_TGT", c_ent.close
                elif ct >= FORCE_CLOSE_TIME:
                    action, price = "EOD", c_ent.close
                elif bias.direction == "BEARISH" and pos.held > 6:
                    action, price = "BIAS_FLIP", c_ent.close
                elif pos.held >= 24 * (15 // entry_tf_minutes):
                    action, price = "TIME", c_ent.close
                else:
                    if not pos._be_done:
                        profit = c_ent.high - pos.entry
                        if profit >= pos.risk:
                            pos.sl = pos.entry + 1
                            pos._be_done = True
                    elif pos.held % 3 == 0:
                        sl_cand = buf_entry.last(15)
                        new_sl = swing_low(sl_cand, 15)
                        if new_sl and new_sl > pos.sl:
                            pos.sl = round(new_sl - 0.5, 2)
            else:
                if c_ent.high >= pos.sl:
                    action, price = "SL", pos.sl
                elif c_ent.low <= pos.target:
                    action, price = "TARGET", pos.target
                elif c_ent.low <= pos.target + 3 and c_ent.close < pos.entry:
                    action, price = "NEAR_TGT", c_ent.close
                elif ct >= FORCE_CLOSE_TIME:
                    action, price = "EOD", c_ent.close
                elif bias.direction == "BULLISH" and pos.held > 6:
                    action, price = "BIAS_FLIP", c_ent.close
                elif pos.held >= 24 * (15 // entry_tf_minutes):
                    action, price = "TIME", c_ent.close
                else:
                    if not pos._be_done:
                        profit = pos.entry - c_ent.low
                        if profit >= pos.risk:
                            pos.sl = pos.entry - 1
                            pos._be_done = True
                    elif pos.held % 3 == 0:
                        sl_cand = buf_entry.last(15)
                        new_sl = swing_high(sl_cand, 15)
                        if new_sl and new_sl < pos.sl:
                            pos.sl = round(new_sl + 0.5, 2)

            if action != "HOLD":
                closed_this_bar.append((pos, action, price if price > 0 else c_ent.close))

        # Process closed positions
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
                    option_spread_cost=round(opt_exit.spread_entry + opt_exit.spread_exit, 2),
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
                costs, bd = calc_costs_futures(bv, sv, True, 0.01)
                net = gross - costs
                trade = Trade(
                    symbol=symbol, direction=pos.direction,
                    entry=pos.entry, exit=ep,
                    entry_time=pos.entry_time, exit_time=c_ent.ts,
                    sl=pos.sl, target=pos.target, qty=pos.qty,
                    gross=round(gross, 2), costs=round(costs, 2),
                    net=round(net, 2), exit_reason=action,
                    rr=pos.rr, risk=pos.risk, reward=pos.reward,
                    held=pos.held, is_fut=True, cost_bd=bd,
                    mode="futures",
                )

            trades.append(trade)
            current_capital += net
            daily_pnl[today] = daily_pnl.get(today, 0) + net
            open_positions.remove(pos)

        # New entry check
        day_start = daily_start_capital.get(today, current_capital)
        day_loss = daily_pnl.get(today, 0)
        daily_risk_limit = day_start * DAILY_RISK_PCT_VAL / 100
        if day_loss < -daily_risk_limit:
            continue
        if len(open_positions) >= MAX_OPEN_POSITIONS_VAL:
            continue
        if ct < NO_TRADE_END or ct >= ENTRY_CUTOFF:
            continue

        sig = signal_engine.evaluate(buf_entry, bias)

        if sig.signal in ("LONG", "SHORT"):
            if daily_count.get(today, 0) >= MAX_OPEN_POSITIONS_VAL:
                continue

            daily_count[today] = daily_count.get(today, 0) + 1

            opt_entry = None
            if options_engine:
                options_engine.capital = current_capital
                dte = estimate_dte(c_ent.ts)
                opt_entry = options_engine.model_entry(
                    sig.entry, sig.direction, sig.atr_val, dte, c_ent.ts, ct
                )
                actual_qty = opt_entry["lots"] * opt_entry["lot_size"]
            else:
                actual_qty = 1

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

    if prev_date:
        equity_curve.append((prev_date, current_capital))

    return trades, equity_curve


def detailed_trade_analysis(trades, label="", capital=50000):
    """Enhanced analysis with batch-level breakdown."""
    if not trades:
        return {"label": label, "total_trades": 0, "net_pnl": 0, "capital": capital}

    # Basic analysis using the built-in analyzer
    base = analyze(trades, label, capital)

    # Add batch-level analysis (2-month batches)
    batch_pnl = defaultdict(float)
    batch_trades = defaultdict(list)
    for t in trades:
        dt = t.exit_time
        if isinstance(dt, datetime):
            month = dt.month
            year = dt.year
        else:
            month = int(str(dt)[5:7])
            year = int(str(dt)[:4])

        batch_num = (month - 1) // 2 + 1
        batch_key = f"{year}_Batch{batch_num}"
        batch_pnl[batch_key] += t.net
        batch_trades[batch_key].append(t)

    base["batch_pnl"] = {k: round(v, 2) for k, v in sorted(batch_pnl.items())}

    # Per-batch detailed stats
    batch_stats = {}
    for batch_key, batch_t in sorted(batch_trades.items()):
        wins = [t for t in batch_t if t.net > 0]
        losses = [t for t in batch_t if t.net <= 0]
        batch_stats[batch_key] = {
            "trades": len(batch_t),
            "wins": len(wins),
            "losses": len(losses),
            "win_rate": round(len(wins) / len(batch_t) * 100, 1) if batch_t else 0,
            "net_pnl": round(sum(t.net for t in batch_t), 2),
            "avg_pnl": round(sum(t.net for t in batch_t) / len(batch_t), 2) if batch_t else 0,
            "long_pnl": round(sum(t.net for t in batch_t if t.direction == "LONG"), 2),
            "short_pnl": round(sum(t.net for t in batch_t if t.direction == "SHORT"), 2),
            "largest_win": round(max(t.net for t in batch_t), 2) if batch_t else 0,
            "largest_loss": round(min(t.net for t in batch_t), 2) if batch_t else 0,
        }
    base["batch_stats"] = batch_stats

    # Direction analysis per batch
    dir_analysis = {}
    for batch_key, batch_t in sorted(batch_trades.items()):
        long_t = [t for t in batch_t if t.direction == "LONG"]
        short_t = [t for t in batch_t if t.direction == "SHORT"]
        long_w = [t for t in long_t if t.net > 0]
        short_w = [t for t in short_t if t.net > 0]
        dir_analysis[batch_key] = {
            "long_trades": len(long_t),
            "long_wins": len(long_w),
            "long_wr": round(len(long_w) / len(long_t) * 100, 1) if long_t else 0,
            "long_pnl": round(sum(t.net for t in long_t), 2),
            "short_trades": len(short_t),
            "short_wins": len(short_w),
            "short_wr": round(len(short_w) / len(short_t) * 100, 1) if short_t else 0,
            "short_pnl": round(sum(t.net for t in short_t), 2),
        }
    base["direction_analysis"] = dir_analysis

    # Exit reason analysis per batch
    exit_analysis = {}
    for batch_key, batch_t in sorted(batch_trades.items()):
        reasons = defaultdict(int)
        reason_pnl = defaultdict(float)
        for t in batch_t:
            reasons[t.exit_reason] += 1
            reason_pnl[t.exit_reason] += t.net
        exit_analysis[batch_key] = {
            k: {"count": v, "pnl": round(reason_pnl[k], 2)}
            for k, v in sorted(reasons.items())
        }
    base["exit_analysis"] = exit_analysis

    # Risk analysis
    risk_events = 0
    max_loss_day = 0
    daily_pnl_map = defaultdict(float)
    for t in trades:
        dt = t.exit_time
        if isinstance(dt, datetime):
            d = dt.strftime('%Y-%m-%d')
        else:
            d = str(dt)[:10]
        daily_pnl_map[d] += t.net

    negative_days = {d: pnl for d, pnl in daily_pnl_map.items() if pnl < 0}
    max_loss_day = min(daily_pnl_map.values()) if daily_pnl_map else 0
    risk_limit_hit_days = sum(1 for pnl in daily_pnl_map.values() if pnl < -capital * DAILY_RISK / 100)

    base["risk_analysis"] = {
        "trading_days": len(daily_pnl_map),
        "profitable_days": sum(1 for pnl in daily_pnl_map.values() if pnl > 0),
        "loss_days": sum(1 for pnl in daily_pnl_map.values() if pnl < 0),
        "max_loss_day": round(max_loss_day, 2),
        "max_profit_day": round(max(daily_pnl_map.values()), 2) if daily_pnl_map else 0,
        "avg_daily_pnl": round(sum(daily_pnl_map.values()) / len(daily_pnl_map), 2) if daily_pnl_map else 0,
        "risk_limit_hit_days": risk_limit_hit_days,
        "pct_profitable_days": round(sum(1 for pnl in daily_pnl_map.values() if pnl > 0) / len(daily_pnl_map) * 100, 1) if daily_pnl_map else 0,
    }

    # Options-specific analysis
    opt_trades = [t for t in trades if t.mode == "options"]
    if opt_trades:
        avg_spread = sum(t.option_spread_cost for t in opt_trades) / len(opt_trades)
        total_spread_cost = sum(t.option_spread_cost for t in opt_trades)
        avg_delta = sum(t.option_delta for t in opt_trades) / len(opt_trades)
        ce_trades = [t for t in opt_trades if t.option_type == "CE"]
        pe_trades = [t for t in opt_trades if t.option_type == "PE"]

        base["options_analysis"] = {
            "total_opt_trades": len(opt_trades),
            "avg_spread_cost": round(avg_spread, 2),
            "total_spread_cost": round(total_spread_cost, 2),
            "avg_delta": round(avg_delta, 4),
            "ce_trades": len(ce_trades),
            "ce_pnl": round(sum(t.net for t in ce_trades), 2),
            "ce_wr": round(sum(1 for t in ce_trades if t.net > 0) / len(ce_trades) * 100, 1) if ce_trades else 0,
            "pe_trades": len(pe_trades),
            "pe_pnl": round(sum(t.net for t in pe_trades), 2),
            "pe_wr": round(sum(1 for t in pe_trades if t.net > 0) / len(pe_trades) * 100, 1) if pe_trades else 0,
        }

    return base


def cross_check_results(results_a, results_b):
    """Cross-check results for bugs and inconsistencies."""
    issues = []

    for label in results_a:
        ra = results_a[label]
        rb = results_b.get(label, {})

        # Check 1: Negative final capital (shouldn't go below 0 with risk management)
        if ra.get("final_capital", 0) < 0:
            issues.append(f"BUG: {label} Method A has NEGATIVE final capital: {ra['final_capital']}")
        if rb.get("final_capital", 0) < 0:
            issues.append(f"BUG: {label} Method B has NEGATIVE final capital: {rb['final_capital']}")

        # Check 2: More losses than expected (daily risk limit should cap this)
        ra_risk = ra.get("risk_analysis", {})
        if ra_risk.get("risk_limit_hit_days", 0) > 5:
            issues.append(f"WARN: {label} Method A hit daily risk limit {ra_risk['risk_limit_hit_days']} days")

        # Check 3: Profit factor consistency
        if ra.get("profit_factor", 0) > 10 and ra.get("total_trades", 0) > 5:
            issues.append(f"SUSPICIOUS: {label} Method A has very high PF={ra['profit_factor']} (possible bug)")

        # Check 4: Win rate vs P&L consistency
        if ra.get("win_rate", 0) > 70 and ra.get("net_pnl", 0) < 0:
            issues.append(f"BUG: {label} Method A has WR={ra['win_rate']}% but negative P&L")

        # Check 5: Drawdown vs capital
        if ra.get("max_dd_pct", 0) > 80:
            issues.append(f"DANGER: {label} Method A has drawdown {ra['max_dd_pct']}% (near account blow-up)")

        # Check 6: Batch consistency in Method B
        batch_stats = rb.get("batch_stats", {})
        if batch_stats:
            profitable_batches = sum(1 for bs in batch_stats.values() if bs["net_pnl"] > 0)
            total_batches = len(batch_stats)
            if profitable_batches == 0 and total_batches >= 3:
                issues.append(f"CONCERN: {label} Method B has 0/{total_batches} profitable batches")

        # Check 7: Total cost drag
        if ra.get("total_costs", 0) > abs(ra.get("net_pnl", 0)) * 2 and ra.get("net_pnl", 0) < 0:
            issues.append(f"INSIGHT: {label} Method A — costs ({ra['total_costs']:.0f}) are >2x the net loss, costs are killing profitability")

        # Check 8: Short vs Long imbalance
        dir_a = ra.get("direction_analysis", {})
        for batch_key, da in dir_a.items():
            if da["long_trades"] > 0 and da["short_trades"] > 0:
                long_wr = da["long_wr"]
                short_wr = da["short_wr"]
                if abs(long_wr - short_wr) > 30:
                    issues.append(f"INSIGHT: {label} A {batch_key} — Long WR={long_wr}% vs Short WR={short_wr}% (significant direction bias)")

    return issues


def main():
    start_time = time.time()
    log.info("=" * 70)
    log.info("DDLJ v8.4 — 8-MONTH COMPREHENSIVE BACKTEST")
    log.info("=" * 70)
    log.info("Period: %s to %s", TEST_START, TEST_END)
    log.info("Capital: Rs %s | Daily Risk: %s%% | Max Positions: %s",
             f"{STARTING_CAP:,}", DAILY_RISK, MAX_POSITIONS)
    log.info("Risk Per Position: %s", "OFF" if RISK_PER_POS is None else f"{RISK_PER_POS}%")
    log.info("")

    # ── Step 1: API Connection ──
    log.info("Step 1: Establishing API connection...")
    kite = get_kite_session()
    fetcher = KiteDataFetcher(KITE_API_KEY, kite.access_token)
    log.info("Connected as %s", kite.profile().get("user_name", "unknown"))

    # ── Step 2: Fetch VIX data for extended period ──
    log.info("\nStep 2: Fetching extended VIX data...")
    vix_extended = fetch_vix_extended(fetcher, TEST_START, TEST_END)

    # Save extended VIX data
    vix_save_path = "/home/z/my-project/download/india_vix_data_extended.json"
    vix_list = [{"date": k, "close": v} for k, v in sorted(vix_extended.items())]
    with open(vix_save_path, "w") as f:
        json.dump(vix_list, f, indent=2)
    log.info("Saved extended VIX data (%d days) to %s", len(vix_list), vix_save_path)

    # Update the options engine's VIX data module-level variable
    import ddlj_v84_strategy.options_engine as oe
    oe.VIX_DATA = vix_extended
    log.info("Updated options engine VIX data: %d days", len(oe.VIX_DATA))

    # ── Step 3: Fetch historical candle data ──
    log.info("\nStep 3: Fetching historical candle data...")
    raw_data, bn_fut, nf_fut = fetch_all_data(fetcher, TEST_START, TEST_END)

    # ── Step 4: Parse and filter ──
    log.info("\nStep 4: Parsing and filtering data...")
    parsed = parse_and_filter(raw_data, TEST_START, TEST_END)

    # Organize data by instrument and timeframe
    bn_5m = parsed.get("BN_INDEX_5m", []) + parsed.get("BN_FUT_5m", [])
    bn_15m = parsed.get("BN_INDEX_15m", []) + parsed.get("BN_FUT_15m", [])
    bn_60m = parsed.get("BN_INDEX_60m", []) + parsed.get("BN_FUT_60m", [])
    nf_5m = parsed.get("NF_INDEX_5m", []) + parsed.get("NF_FUT_5m", [])
    nf_15m = parsed.get("NF_INDEX_15m", []) + parsed.get("NF_INDEX_15m", [])
    nf_60m = parsed.get("NF_INDEX_60m", []) + parsed.get("NF_FUT_60m", [])

    # Deduplicate candles by timestamp
    def dedup(candles):
        seen = set()
        out = []
        for c in candles:
            key = (c.ts, c.timeframe)
            if key not in seen:
                seen.add(key)
                out.append(c)
        return sorted(out, key=lambda c: c.ts)

    bn_5m = dedup(bn_5m)
    bn_15m = dedup(bn_15m)
    bn_60m = dedup(bn_60m)
    nf_5m = dedup(nf_5m)
    nf_15m = dedup(nf_15m)
    nf_60m = dedup(nf_60m)

    log.info("Final candle counts:")
    log.info("  BN: %d (5m), %d (15m), %d (60m)", len(bn_5m), len(bn_15m), len(bn_60m))
    log.info("  NF: %d (5m), %d (15m), %d (60m)", len(nf_5m), len(nf_15m), len(nf_60m))

    # ── Step 5: Run all configurations ──
    log.info("\n" + "=" * 70)
    log.info("Step 5: RUNNING ALL BACKTEST CONFIGURATIONS")
    log.info("=" * 70)

    instruments = [
        ("BANKNIFTY", "BN", bn_5m, bn_15m, bn_60m),
        ("NIFTY", "NF", nf_5m, nf_15m, nf_60m),
    ]

    results_a = {}  # Method A: Full compounding
    results_b = {}  # Method B: Batch reset (2-month batches)
    all_trades = {}  # Store raw trades for deep analysis

    config_num = 0
    total_configs = len(instruments) * len(ALL_CONFIGS)

    for inst_name, inst_short, data_5m, data_15m, data_60m in instruments:
        for entry_tf, bias_tf, sl_atr, min_rr, moneyness, label_suffix in ALL_CONFIGS:
            config_num += 1

            # Select candles
            entry_candles = data_15m if entry_tf == "15m" else data_5m
            bias_candles = data_60m if bias_tf == "60m" else (data_15m if bias_tf == "15m" else data_5m)

            if not entry_candles or not bias_candles:
                log.info("  [%d/%d] SKIPPED %s_%s — no data",
                         config_num, total_configs, inst_short, label_suffix)
                continue

            label = f"{inst_short}_{label_suffix}"
            config = {
                "entry_tf": entry_tf, "bias_tf": bias_tf,
                "sl_atr": sl_atr, "min_rr": min_rr,
                "moneyness": moneyness, "spread_regime": "auto",
            }

            log.info("  [%d/%d] %s ...", config_num, total_configs, label)

            # Method A: Full 8-month compounding
            try:
                trades_a, eq_a = run_single_backtest(
                    inst_name, entry_candles, bias_candles, config,
                    TEST_START, TEST_END,
                    compounding=True, monthly_reset=False,
                )
                result_a = detailed_trade_analysis(trades_a, f"{label}_A", STARTING_CAP)
                results_a[label] = result_a
                all_trades[f"{label}_A"] = trades_a
            except Exception as e:
                log.error("  Method A failed for %s: %s", label, e)
                results_a[label] = {"label": label, "total_trades": 0, "net_pnl": 0, "error": str(e)}

            # Method B: 4 batches of 2 months with capital reset
            try:
                trades_b, eq_b = run_single_backtest(
                    inst_name, entry_candles, bias_candles, config,
                    TEST_START, TEST_END,
                    compounding=True, monthly_reset=True, batch_reset_months=2,
                )
                result_b = detailed_trade_analysis(trades_b, f"{label}_B", STARTING_CAP)
                results_b[label] = result_b
                all_trades[f"{label}_B"] = trades_b
            except Exception as e:
                log.error("  Method B failed for %s: %s", label, e)
                results_b[label] = {"label": label, "total_trades": 0, "net_pnl": 0, "error": str(e)}

            ra = results_a.get(label, {})
            rb = results_b.get(label, {})
            log.info("    A: Rs %s (%s%%) | B: Rs %s (%s%%)",
                     f"{ra.get('net_pnl', 0):,.0f}", f"{ra.get('net_pnl_pct', 0):+.1f}",
                     f"{rb.get('net_pnl', 0):,.0f}", f"{rb.get('net_pnl_pct', 0):+.1f}")

    # ── Step 6: Cross-check and find bugs ──
    log.info("\n" + "=" * 70)
    log.info("Step 6: CROSS-CHECKING RESULTS")
    log.info("=" * 70)
    issues = cross_check_results(results_a, results_b)

    # ── Step 7: Save all results ──
    log.info("\nStep 7: Saving results...")

    output = {
        "version": "v8.4_8MONTH_COMPREHENSIVE",
        "parameters": {
            "starting_capital": STARTING_CAP,
            "daily_risk_pct": DAILY_RISK,
            "max_open_positions": MAX_POSITIONS,
            "risk_per_position": "OFF",
            "test_period": f"{TEST_START} to {TEST_END}",
            "test_months": 8,
            "method_b_batches": 4,
            "batch_duration_months": 2,
            "vix_data_points": len(vix_extended),
            "pricing_model": "Black-Scholes with real India VIX IV",
        },
        "method_a_full_compounding": results_a,
        "method_b_4batch_reset": results_b,
        "cross_check_issues": issues,
    }

    output_path = "/home/z/my-project/download/v84_8month_results.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2, default=str)
    log.info("Saved to %s", output_path)

    # ── Step 8: Print comprehensive summary ──
    elapsed = time.time() - start_time
    log.info("\n" + "=" * 70)
    log.info("COMPREHENSIVE SUMMARY — 8-MONTH BACKTEST")
    log.info("=" * 70)

    # Method A summary
    log.info("\nMETHOD A: Full 8-Month Compounding (Rs 50K start)")
    log.info("-" * 70)
    sorted_a = sorted(results_a.items(), key=lambda x: x[1].get("net_pnl", 0), reverse=True)
    for i, (label, r) in enumerate(sorted_a):
        if r.get("total_trades", 0) == 0:
            continue
        log.info(
            "  %d. %s: Rs %s (%s%%) | WR=%s%% PF=%s Trades=%s DD=%s%% Sharpe=%s Final=Rs %s",
            i + 1, label,
            f"{r['net_pnl']:,.0f}", f"{r['net_pnl_pct']:+.1f}",
            f"{r.get('win_rate', 0):.0f}", f"{r.get('profit_factor', 0):.1f}",
            r.get('total_trades', 0), f"{r.get('max_dd_pct', 0):.1f}",
            f"{r.get('sharpe_approx', 0):.1f}",
            f"{r.get('final_capital', 0):,.0f}"
        )

    # Method B summary
    log.info("\nMETHOD B: 4 Batches of 2 Months (Capital resets to Rs 50K each batch)")
    log.info("-" * 70)
    sorted_b = sorted(results_b.items(), key=lambda x: x[1].get("net_pnl", 0), reverse=True)
    for i, (label, r) in enumerate(sorted_b):
        if r.get("total_trades", 0) == 0:
            continue
        batch_pnl = r.get("batch_pnl", {})
        batch_str = " | ".join(f"{k.split('_')[-1]}:{v:+,.0f}" for k, v in sorted(batch_pnl.items()))
        log.info(
            "  %d. %s: Rs %s (%s%%) | WR=%s%% PF=%s Trades=%s DD=%s%% | %s",
            i + 1, label,
            f"{r['net_pnl']:,.0f}", f"{r['net_pnl_pct']:+.1f}",
            f"{r.get('win_rate', 0):.0f}", f"{r.get('profit_factor', 0):.1f}",
            r.get('total_trades', 0), f"{r.get('max_dd_pct', 0):.1f}",
            batch_str
        )

    # Detailed batch breakdown for best config
    log.info("\n" + "=" * 70)
    log.info("DETAILED BATCH BREAKDOWN — BEST CONFIGURATIONS")
    log.info("=" * 70)

    for method_name, results in [("Method A", results_a), ("Method B", results_b)]:
        best = sorted(results.items(), key=lambda x: x[1].get("net_pnl", 0), reverse=True)
        if not best:
            continue
        label, r = best[0]
        if r.get("total_trades", 0) == 0:
            continue

        log.info(f"\nBest {method_name}: {label}")
        log.info("  Net P&L: Rs {:,.0f} ({:+.1f}%)".format(r.get('net_pnl', 0), r.get('net_pnl_pct', 0)))
        log.info("  Win Rate: {:.1f}% | Profit Factor: {:.1f}".format(
            r.get('win_rate', 0), r.get('profit_factor', 0)))
        log.info("  Max Drawdown: {:.1f}% | Sharpe: {:.1f}".format(
            r.get('max_dd_pct', 0), r.get('sharpe_approx', 0)))
        log.info("  Total Trades: {} | Avg Held: {} bars".format(
            r.get('total_trades', 0), r.get('avg_held', 0)))

        # Batch stats
        batch_stats = r.get("batch_stats", {})
        if batch_stats:
            log.info("\n  Batch-by-Batch Performance:")
            for batch_key, bs in sorted(batch_stats.items()):
                log.info("    {}: {} trades, WR={:.0f}%, PnL=Rs {:,.0f}, Avg=Rs {:,.0f}".format(
                    batch_key, bs["trades"], bs["win_rate"],
                    bs["net_pnl"], bs["avg_pnl"]))

        # Direction analysis
        dir_a = r.get("direction_analysis", {})
        if dir_a:
            log.info("\n  Direction Analysis per Batch:")
            for batch_key, da in sorted(dir_a.items()):
                log.info("    {}: Long={} (WR={:.0f}%, PnL=Rs {:,.0f}) | Short={} (WR={:.0f}%, PnL=Rs {:,.0f})".format(
                    batch_key,
                    da["long_trades"], da["long_wr"], da["long_pnl"],
                    da["short_trades"], da["short_wr"], da["short_pnl"]))

        # Exit analysis
        exit_a = r.get("exit_analysis", {})
        if exit_a:
            log.info("\n  Exit Reason Analysis per Batch:")
            for batch_key, ea in sorted(exit_a.items()):
                reasons = ", ".join(f"{k}:{v['count']}({v['pnl']:+,.0f})" for k, v in sorted(ea.items()))
                log.info("    {}: {}".format(batch_key, reasons))

    # Risk analysis
    log.info("\n" + "=" * 70)
    log.info("RISK ANALYSIS")
    log.info("=" * 70)
    for method_name, results in [("Method A", results_a), ("Method B", results_b)]:
        best = sorted(results.items(), key=lambda x: x[1].get("net_pnl", 0), reverse=True)
        if not best:
            continue
        label, r = best[0]
        risk = r.get("risk_analysis", {})
        if risk:
            log.info(f"\n  {method_name} Best ({label}):")
            log.info("    Trading Days: {} | Profitable: {} ({:.0f}%)".format(
                risk["trading_days"], risk["profitable_days"], risk["pct_profitable_days"]))
            log.info("    Max Profit Day: Rs {:,.0f} | Max Loss Day: Rs {:,.0f}".format(
                risk["max_profit_day"], risk["max_loss_day"]))
            log.info("    Avg Daily P&L: Rs {:,.0f}".format(risk["avg_daily_pnl"]))
            log.info("    Risk Limit Hit: {} days".format(risk["risk_limit_hit_days"]))

    # Options analysis
    log.info("\n" + "=" * 70)
    log.info("OPTIONS ANALYSIS")
    log.info("=" * 70)
    for method_name, results in [("Method A", results_a), ("Method B", results_b)]:
        best = sorted(results.items(), key=lambda x: x[1].get("net_pnl", 0), reverse=True)
        if not best:
            continue
        label, r = best[0]
        opt = r.get("options_analysis", {})
        if opt:
            log.info(f"\n  {method_name} Best ({label}):")
            log.info("    Total Options Trades: {}".format(opt["total_opt_trades"]))
            log.info("    Avg Spread Cost: Rs {:.2f} | Total: Rs {:,.0f}".format(
                opt["avg_spread_cost"], opt["total_spread_cost"]))
            log.info("    Avg Delta: {:.3f}".format(opt["avg_delta"]))
            log.info("    CE Trades: {} (WR={:.0f}%, PnL=Rs {:,.0f})".format(
                opt["ce_trades"], opt["ce_wr"], opt["ce_pnl"]))
            log.info("    PE Trades: {} (WR={:.0f}%, PnL=Rs {:,.0f})".format(
                opt["pe_trades"], opt["pe_wr"], opt["pe_pnl"]))

    # Cross-check issues
    log.info("\n" + "=" * 70)
    log.info("CROSS-CHECK ISSUES & FINDINGS")
    log.info("=" * 70)
    if issues:
        for i, issue in enumerate(issues):
            log.info("  %d. %s", i + 1, issue)
    else:
        log.info("  No issues found!")

    # Profitability summary
    prof_a = sum(1 for r in results_a.values() if r.get("net_pnl", 0) > 0)
    prof_b = sum(1 for r in results_b.values() if r.get("net_pnl", 0) > 0)
    total = len(results_a)
    log.info("\n  Profitable configs: A=%d/%d (%d%%) B=%d/%d (%d%%)",
             prof_a, total, prof_a * 100 // max(total, 1),
             prof_b, total, prof_b * 100 // max(total, 1))

    log.info("\nTotal execution time: %.1f seconds", elapsed)
    log.info("Results saved to: %s", output_path)

    return output


if __name__ == "__main__":
    main()
