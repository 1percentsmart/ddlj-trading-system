#!/usr/bin/env python3
"""
DDLJ v9 — Backtest Entry Point (Fixed Version)
=================================================

Run the complete DDLJ v9 backtest with all 5 bug fixes.

USAGE:
    python -m ddlj_v9.run_backtest

Author: DDLJ Strategy Team
Version: 9.0.0
"""

import os
import json
import logging
from datetime import date

from .config import (
    STARTING_CAPITAL, DAILY_RISK_PCT, MAX_OPEN_POSITIONS, MAX_DAILY_TRADES,
    BN_INDEX_TOKEN, NF_INDEX_TOKEN, BN_FUT_TOKEN, NF_FUT_TOKEN,
    TEST_START_YEAR, TEST_START_MONTH, TEST_START_DAY,
    TEST_END_YEAR, TEST_END_MONTH, TEST_END_DAY,
    ENTRY_TIMEFRAME, BIAS_TIMEFRAME, OPTION_MONEYNESS, SPREAD_REGIME,
    KITE_API_KEY, VIX_TOKEN,
)
from .candle_data import parse_candles, load_cached_data, filter_candles_by_date
from .bias_engine import BiasEngine
from .signal_engine import EMACrossSignal
from .options_engine import OptionsMimicryEngine
from .backtester import run_backtest_enhanced
from .analysis import analyze
from .token_manager import get_kite_session
from .data_fetcher import KiteDataFetcher

log = logging.getLogger("ddlj_v9")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")

TEST_START = date(TEST_START_YEAR, TEST_START_MONTH, TEST_START_DAY)
TEST_END = date(TEST_END_YEAR, TEST_END_MONTH, TEST_END_DAY)


def _fetch_data_if_needed(tokens, interval, from_date, to_date):
    """Load from cache or fetch from API."""
    cached = load_cached_data(tokens, interval)
    if cached:
        return cached

    log.warning("No cache for tokens=%s interval=%s. Fetching from API...", tokens, interval)
    try:
        kite = get_kite_session()
        fetcher = KiteDataFetcher(KITE_API_KEY, kite.access_token)
        all_data = []
        for token in tokens:
            data = fetcher.fetch_candles_chunked(token, from_date, to_date, interval)
            all_data.extend(data)
        return all_data
    except Exception as e:
        log.error("API fetch failed: %s", e)
        return []


def main():
    """Run the complete DDLJ v9 backtest with all bug fixes."""
    log.info("=" * 70)
    log.info("DDLJ v9 BACKTEST — All Bug Fixes Applied")
    log.info("=" * 70)
    log.info("Fixes: #1 Unrealized loss SUM, #2 Duplicate OptionsFill, "
             "#3 MAX_DAILY_TRADES, #4 Peak capital DD, #5 timedelta import")
    log.info("Period: %s → %s | Capital: ₹%s", TEST_START, TEST_END, f"{STARTING_CAPITAL:,}")

    # Load data
    bn_fut_token = BN_FUT_TOKEN
    nf_fut_token = NF_FUT_TOKEN
    try:
        kite = get_kite_session()
        fetcher = KiteDataFetcher(KITE_API_KEY, kite.access_token)
        resolved_bn = fetcher.resolve_future_token("BANKNIFTY")
        resolved_nf = fetcher.resolve_future_token("NIFTY")
        if resolved_bn: bn_fut_token = resolved_bn
        if resolved_nf: nf_fut_token = resolved_nf
    except Exception:
        log.warning("Using default futures tokens from config")

    bn_5m_raw = _fetch_data_if_needed([BN_INDEX_TOKEN, bn_fut_token], "5minute", TEST_START, TEST_END)
    bn_15m_raw = _fetch_data_if_needed([BN_INDEX_TOKEN, bn_fut_token], "15minute", TEST_START, TEST_END)
    bn_60m_raw = _fetch_data_if_needed([BN_INDEX_TOKEN, bn_fut_token], "60minute", TEST_START, TEST_END)
    nf_5m_raw = _fetch_data_if_needed([NF_INDEX_TOKEN, nf_fut_token], "5minute", TEST_START, TEST_END)
    nf_15m_raw = _fetch_data_if_needed([NF_INDEX_TOKEN, nf_fut_token], "15minute", TEST_START, TEST_END)
    nf_60m_raw = _fetch_data_if_needed([NF_INDEX_TOKEN, nf_fut_token], "60minute", TEST_START, TEST_END)

    bn_5m = parse_candles(bn_5m_raw, "BANKNIFTY", "5m")
    bn_15m = parse_candles(bn_15m_raw, "BANKNIFTY", "15m")
    bn_60m = parse_candles(bn_60m_raw, "BANKNIFTY", "60m")
    nf_5m = parse_candles(nf_5m_raw, "NIFTY", "5m")
    nf_15m = parse_candles(nf_15m_raw, "NIFTY", "15m")
    nf_60m = parse_candles(nf_60m_raw, "NIFTY", "60m")

    for name, arr in [("BN 5m", bn_5m), ("BN 15m", bn_15m), ("BN 60m", bn_60m),
                      ("NF 5m", nf_5m), ("NF 15m", nf_15m), ("NF 60m", nf_60m)]:
        filtered = filter_candles_by_date(arr, TEST_START, TEST_END)
        if "BN" in name:
            if "5m" in name: bn_5m = filtered
            elif "15m" in name: bn_15m = filtered
            elif "60m" in name: bn_60m = filtered
        else:
            if "5m" in name: nf_5m = filtered
            elif "15m" in name: nf_15m = filtered
            elif "60m" in name: nf_60m = filtered
        log.info("  %s: %d candles", name, len(filtered))

    # Run configurations
    TF_CONFIGS = [("15m", "60m", 15), ("15m", "15m", 15), ("5m", "60m", 5)]
    SIGNAL_CONFIGS = [(2.0, 1.5, "sl2.0_RR1.5")]
    OPTION_MODES = [("ITM", "auto")]
    INSTRUMENTS = [
        ("BANKNIFTY", "BN", bn_5m, bn_15m, bn_60m),
        ("NIFTY", "NF", nf_5m, nf_15m, nf_60m),
    ]

    results_a = {}
    results_b = {}
    config_num = 0
    total = len(INSTRUMENTS) * len(TF_CONFIGS) * len(SIGNAL_CONFIGS) * len(OPTION_MODES)

    for inst_name, inst_short, data_5m, data_15m, data_60m in INSTRUMENTS:
        for entry_tf, bias_tf, entry_tf_min in TF_CONFIGS:
            for sl_atr, min_rr, sig_label in SIGNAL_CONFIGS:
                for moneyness, spread_regime in OPTION_MODES:
                    config_num += 1
                    entry_candles = data_15m if entry_tf == "15m" else data_5m
                    bias_candles = data_60m if bias_tf == "60m" else data_15m if bias_tf == "15m" else data_5m
                    if not entry_candles or not bias_candles:
                        continue

                    label = f"{inst_short}_{entry_tf}x{bias_tf}_{sig_label}_{moneyness}"

                    # Method A
                    se_a = EMACrossSignal(sl_atr=sl_atr, min_rr=min_rr)
                    be_a = BiasEngine()
                    oe_a = OptionsMimicryEngine(inst_name, moneyness, spread_regime, capital=STARTING_CAPITAL)
                    trades_a, _ = run_backtest_enhanced(inst_name, entry_candles, bias_candles,
                                                        se_a, be_a, oe_a, entry_tf_minutes=entry_tf_min)
                    results_a[label] = analyze(trades_a, label, STARTING_CAPITAL)

                    # Method B
                    se_b = EMACrossSignal(sl_atr=sl_atr, min_rr=min_rr)
                    be_b = BiasEngine()
                    oe_b = OptionsMimicryEngine(inst_name, moneyness, spread_regime, capital=STARTING_CAPITAL)
                    trades_b, _ = run_backtest_enhanced(inst_name, entry_candles, bias_candles,
                                                        se_b, be_b, oe_b, entry_tf_minutes=entry_tf_min,
                                                        monthly_reset=True)
                    results_b[label] = analyze(trades_b, label, STARTING_CAPITAL)

                    log.info("[%d/%d] %s: A=₹%.0f B=₹%.0f", config_num, total, label,
                             results_a[label]["net_pnl"], results_b[label]["net_pnl"])

    # Save results
    output = {
        "version": "v9.0_ALL_BUGS_FIXED",
        "fixes": [
            "#1 Unrealized loss SUMs all positions (was min — only worst single)",
            "#2 Removed duplicate OptionsFill (now only in options_engine.py)",
            "#3 MAX_DAILY_TRADES separate from MAX_OPEN_POSITIONS",
            "#4 Drawdown circuit breaker uses PEAK capital (not starting)",
            "#5 Replaced __import__('datetime') with proper timedelta import",
        ],
        "method_a_compounding": results_a,
        "method_b_monthly_batch": results_b,
    }

    # Resolve output path dynamically (works on both local dev and Railway)
    _project_root = os.getenv("PROJECT_ROOT", os.path.join(os.path.dirname(__file__), "..", ".."))
    output_dir = os.path.join(_project_root, "download")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "v9_backtest_results.json")
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2, default=str)
    log.info("Results saved to %s", output_path)

    # Print summary
    log.info("\n" + "=" * 70)
    log.info("SUMMARY — Top 5 by Net P&L")
    for method, results, name in [("A", results_a, "Compounding"), ("B", results_b, "Monthly Batch")]:
        log.info(f"\nMETHOD {method} ({name}):")
        for i, (label, r) in enumerate(sorted(results.items(), key=lambda x: x[1]["net_pnl"], reverse=True)[:5]):
            log.info("  %d. %s: ₹%s (%s%%) WR=%s%% PF=%s Trades=%s DD=%s%% Sharpe=%s",
                     i+1, label, f"{r['net_pnl']:,.0f}", f"{r['net_pnl_pct']:+.1f}",
                     f"{r['win_rate']:.0f}", f"{r['profit_factor']:.1f}",
                     r['total_trades'], f"{r['max_dd_pct']:.1f}", f"{r['sharpe_approx']:.1f}")

    return output


if __name__ == "__main__":
    main()
