#!/usr/bin/env python3
"""
DDLJ v8.4 Strategy — Main Backtest Entry Point
=================================================

This is the MAIN script that runs the complete DDLJ v8.4 backtest.
It orchestrates all the modules:

  1. Load historical data from cache
  2. Parse and filter candles to the test period
  3. Configure signal, bias, and options engines
  4. Run Method A (Capital Compounding across full period)
  5. Run Method B (Monthly Batches with fresh capital each month)
  6. Analyze results
  7. Save results to JSON

TWO TESTING METHODS:
  Method A — Capital Compounding:
    Start with Rs 50K, let it grow/shrink across the full 6 months.
    Shows the POWER of compounding (both positive and negative).

  Method B — Monthly Batches:
    Start each month with fresh Rs 50K. Shows CONSISTENCY of the
    strategy month-by-month. More realistic for evaluation.

USAGE:
    python run_backtest.py

OUTPUT:
    Results saved to /home/z/my-project/download/v84_production_results.json

Author: DDLJ Strategy Team
Version: 8.4 (Production)
"""

import os
import json
import logging
from datetime import date

from .config import (
    STARTING_CAPITAL,
    DAILY_RISK_PCT,
    MAX_OPEN_POSITIONS,
    BN_INDEX_TOKEN,
    NF_INDEX_TOKEN,
    BN_FUT_TOKEN,
    NF_FUT_TOKEN,
    TEST_START_YEAR,
    TEST_START_MONTH,
    TEST_START_DAY,
    TEST_END_YEAR,
    TEST_END_MONTH,
    TEST_END_DAY,
    ENTRY_TIMEFRAME,
    BIAS_TIMEFRAME,
    OPTION_MONEYNESS,
    SPREAD_REGIME,
)
from .candle_data import parse_candles, load_cached_data, filter_candles_by_date
from .bias_engine import BiasEngine
from .signal_engine import EMACrossSignal
from .options_engine import OptionsMimicryEngine
from .backtester import run_backtest_enhanced
from .analysis import analyze

log = logging.getLogger("v84prod")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)

# Test period from config
TEST_START = date(TEST_START_YEAR, TEST_START_MONTH, TEST_START_DAY)
TEST_END = date(TEST_END_YEAR, TEST_END_MONTH, TEST_END_DAY)

# Monthly batches for Method B
MONTHLY_BATCHES = [
    ("Nov 2025", date(2025, 11, 1), date(2025, 11, 30)),
    ("Dec 2025", date(2025, 12, 1), date(2025, 12, 31)),
    ("Jan 2026", date(2026, 1, 1), date(2026, 1, 31)),
    ("Feb 2026", date(2026, 2, 1), date(2026, 2, 28)),
    ("Mar 2026", date(2026, 3, 1), date(2026, 3, 31)),
    ("Apr 2026", date(2026, 4, 1), date(2026, 4, 25)),
]


def main():
    """
    Run the complete DDLJ v8.4 backtest.

    This function:
      1. Loads and parses historical data for BankNifty and Nifty
      2. Filters data to the test period
      3. Runs all timeframe/signal/option configurations
      4. Produces both Method A and Method B results
      5. Saves results to JSON
      6. Prints a summary of top configurations
    """
    log.info("=" * 70)
    log.info("DDLJ v8.4 PRODUCTION — Corrected Options Backtest")
    log.info("=" * 70)
    log.info("Fixes: Capital bug, Proper BS, Real IV from India VIX")
    log.info("Test period: %s to %s", TEST_START, TEST_END)
    log.info("Starting capital: Rs %s", f"{STARTING_CAPITAL:,}")
    log.info("Daily risk: %s%%, Max positions: %s", DAILY_RISK_PCT, MAX_OPEN_POSITIONS)

    # ── Step 1: Load Data ──
    log.info("Loading data...")

    # BankNifty data — using INDEX token (correct, not RELIANCE!)
    bn_5m_raw = load_cached_data([BN_INDEX_TOKEN, BN_FUT_TOKEN], "5minute")
    bn_15m_raw = load_cached_data([BN_INDEX_TOKEN, BN_FUT_TOKEN], "15minute")
    bn_60m_raw = load_cached_data([BN_INDEX_TOKEN, BN_FUT_TOKEN], "60minute")

    # Nifty data
    nf_5m_raw = load_cached_data([NF_INDEX_TOKEN, NF_FUT_TOKEN], "5minute")
    nf_15m_raw = load_cached_data([NF_INDEX_TOKEN, NF_FUT_TOKEN], "15minute")
    nf_60m_raw = load_cached_data([NF_INDEX_TOKEN, NF_FUT_TOKEN], "60minute")

    log.info("BN data: %d (5m), %d (15m), %d (60m)",
             len(bn_5m_raw), len(bn_15m_raw), len(bn_60m_raw))
    log.info("NF data: %d (5m), %d (15m), %d (60m)",
             len(nf_5m_raw), len(nf_15m_raw), len(nf_60m_raw))

    # ── Step 2: Parse Candles ──
    bn_5m = parse_candles(bn_5m_raw, "BANKNIFTY", "5m")
    bn_15m = parse_candles(bn_15m_raw, "BANKNIFTY", "15m")
    bn_60m = parse_candles(bn_60m_raw, "BANKNIFTY", "60m")
    nf_5m = parse_candles(nf_5m_raw, "NIFTY", "5m")
    nf_15m = parse_candles(nf_15m_raw, "NIFTY", "15m")
    nf_60m = parse_candles(nf_60m_raw, "NIFTY", "60m")

    # ── Step 3: Filter to Test Period ──
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
        log.info("  %s: %d candles after date filter", name, len(filtered))

    # ── Step 4: Define Configurations ──
    # Timeframe combinations: (entry_tf, bias_tf, entry_tf_minutes)
    TF_CONFIGS = [
        ("5m", "5m", 5),
        ("5m", "15m", 5),
        ("15m", "15m", 15),
        ("15m", "60m", 15),
        ("5m", "60m", 5),
    ]

    # Signal configs: (sl_atr, min_rr, label)
    SIGNAL_CONFIGS = [
        (2.0, 1.5, "sl2.0_RR1.5"),
        (2.5, 2.0, "sl2.5_RR2.0"),
    ]

    # Option modes: (moneyness, spread_regime)
    OPTION_MODES = [
        ("ATM", "auto"),
        ("ITM", "auto"),
    ]

    # Instruments
    INSTRUMENTS = [
        ("BANKNIFTY", "BN", bn_5m, bn_15m, bn_60m),
        ("NIFTY", "NF", nf_5m, nf_15m, nf_60m),
    ]

    # ── Step 5: Run All Configurations ──
    results_a = {}  # Method A: Full Compounding
    results_b = {}  # Method B: Monthly Batches

    total_configs = (len(INSTRUMENTS) * len(TF_CONFIGS) *
                     len(SIGNAL_CONFIGS) * len(OPTION_MODES))
    config_num = 0

    for inst_name, inst_short, data_5m, data_15m, data_60m in INSTRUMENTS:
        for entry_tf, bias_tf, entry_tf_min in TF_CONFIGS:
            for sl_atr, min_rr, sig_label in SIGNAL_CONFIGS:
                for moneyness, spread_regime in OPTION_MODES:
                    config_num += 1

                    # Select entry candles based on timeframe
                    if entry_tf == "5m":
                        entry_candles = data_5m
                    elif entry_tf == "15m":
                        entry_candles = data_15m
                    else:
                        entry_candles = data_15m

                    # Select bias candles based on timeframe
                    if bias_tf == "5m":
                        bias_candles = data_5m
                    elif bias_tf == "15m":
                        bias_candles = data_15m
                    elif bias_tf == "60m":
                        bias_candles = data_60m
                    else:
                        bias_candles = data_15m

                    if not entry_candles or not bias_candles:
                        continue

                    label = f"{inst_short}_{entry_tf}x{bias_tf}_{sig_label}_{moneyness}"

                    # ── Method A: Full Compounding ──
                    signal_engine = EMACrossSignal(sl_atr=sl_atr, min_rr=min_rr)
                    bias_engine = BiasEngine()
                    opt_engine = OptionsMimicryEngine(
                        index_name=inst_name,
                        moneyness=moneyness,
                        spread_regime=spread_regime,
                        capital=STARTING_CAPITAL,
                    )

                    trades_a, eq_a = run_backtest_enhanced(
                        symbol=inst_name,
                        candles_entry=entry_candles,
                        candles_bias=bias_candles,
                        signal_engine=signal_engine,
                        bias_engine=bias_engine,
                        options_engine=opt_engine,
                        entry_tf_minutes=entry_tf_min,
                        compounding=True,
                        monthly_reset=False,
                    )

                    result_a = analyze(trades_a, label, STARTING_CAPITAL)
                    results_a[label] = result_a

                    # ── Method B: Monthly Batches ──
                    signal_engine_b = EMACrossSignal(sl_atr=sl_atr, min_rr=min_rr)
                    bias_engine_b = BiasEngine()
                    opt_engine_b = OptionsMimicryEngine(
                        index_name=inst_name,
                        moneyness=moneyness,
                        spread_regime=spread_regime,
                        capital=STARTING_CAPITAL,
                    )

                    trades_b, eq_b = run_backtest_enhanced(
                        symbol=inst_name,
                        candles_entry=entry_candles,
                        candles_bias=bias_candles,
                        signal_engine=signal_engine_b,
                        bias_engine=bias_engine_b,
                        options_engine=opt_engine_b,
                        entry_tf_minutes=entry_tf_min,
                        compounding=True,
                        monthly_reset=True,
                    )

                    result_b = analyze(trades_b, label, STARTING_CAPITAL)
                    results_b[label] = result_b

                    if config_num % 10 == 0 or config_num == total_configs:
                        log.info("  [%d/%d] %s: A=%s B=%s",
                                 config_num, total_configs, label,
                                 f"{result_a['net_pnl']:.0f}",
                                 f"{result_b['net_pnl']:.0f}")

    # ── Step 6: Save Results ──
    output = {
        "version": "v8.4_PRODUCTION",
        "fixes_applied": [
            "FIX #1: Capital double-counting bug removed (was at new-day boundary)",
            "FIX #2: Proper Black-Scholes formula with cumulative normal distribution",
            "FIX #3: Real India VIX data used for IV estimation (not ATR-based guess)",
            "FIX #4: Extended test period to 6 months (Nov 2025 - Apr 2026)",
            "FIX #5: Proper monthly batch mode (capital resets each month, compounds within)",
        ],
        "parameters": {
            "starting_capital": STARTING_CAPITAL,
            "daily_risk_pct": DAILY_RISK_PCT,
            "max_open_positions": MAX_OPEN_POSITIONS,
            "risk_per_position": "OFF",
            "test_period": f"{TEST_START} to {TEST_END}",
            "test_months": 6,
            "vix_data_source": "Kite API (India VIX, token 264969)",
            "pricing_model": "Black-Scholes (full formula with CDF)",
        },
        "method_a_compounding": results_a,
        "method_b_monthly_batch": results_b,
    }

    output_path = "/home/z/my-project/download/v84_production_results.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2, default=str)
    log.info("Results saved to %s", output_path)

    # ── Step 7: Print Summary ──
    log.info("\n" + "=" * 70)
    log.info("SUMMARY — Top 10 by Net P&L")
    log.info("=" * 70)

    sorted_a = sorted(results_a.items(), key=lambda x: x[1]["net_pnl"], reverse=True)
    log.info("\nMETHOD A (Compounding across 6 months):")
    for i, (label, r) in enumerate(sorted_a[:10]):
        log.info(
            "  %d. %s: Rs %s (%s%%) | WR=%s%% PF=%s Trades=%s DD=%s%% Sharpe=%s",
            i + 1, label,
            f"{r['net_pnl']:,.0f}", f"{r['net_pnl_pct']:+.1f}",
            f"{r['win_rate']:.0f}", f"{r['profit_factor']:.1f}",
            r['total_trades'], f"{r['max_dd_pct']:.1f}",
            f"{r['sharpe_approx']:.1f}"
        )

    sorted_b = sorted(results_b.items(), key=lambda x: x[1]["net_pnl"], reverse=True)
    log.info("\nMETHOD B (Monthly Batches, Rs 50K each month):")
    for i, (label, r) in enumerate(sorted_b[:10]):
        log.info(
            "  %d. %s: Rs %s (%s%%) | WR=%s%% PF=%s Trades=%s DD=%s%% Sharpe=%s",
            i + 1, label,
            f"{r['net_pnl']:,.0f}", f"{r['net_pnl_pct']:+.1f}",
            f"{r['win_rate']:.0f}", f"{r['profit_factor']:.1f}",
            r['total_trades'], f"{r['max_dd_pct']:.1f}",
            f"{r['sharpe_approx']:.1f}"
        )

    # Profitability stats
    profitable_a = sum(1 for r in results_a.values() if r["net_pnl"] > 0)
    profitable_b = sum(1 for r in results_b.values() if r["net_pnl"] > 0)
    total = len(results_a)
    if total > 0:
        log.info("\nProfitable configs: A=%d/%d (%d%%) B=%d/%d (%d%%)",
                 profitable_a, total, profitable_a * 100 // total,
                 profitable_b, total, profitable_b * 100 // total)

    return output


if __name__ == "__main__":
    main()
