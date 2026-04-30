#!/usr/bin/env python3
"""
DDLJ v9 — Backtest Entry Point (Fixed Version)
=================================================

Run the complete DDLJ v9 backtest with all bug fixes.

USAGE:
    python -m ddlj_v9.run_backtest

Accepts optional parameters via main() to allow API-driven configuration.

Author: DDLJ Strategy Team
Version: 10.2.0
"""

import os
import json
import logging
from datetime import date, datetime
from typing import Optional, Dict, Any, List, Tuple

from .config import (
    STARTING_CAPITAL, DAILY_RISK_PCT, MAX_OPEN_POSITIONS, MAX_DAILY_TRADES,
    BN_INDEX_TOKEN, NF_INDEX_TOKEN, BN_FUT_TOKEN, NF_FUT_TOKEN,
    TEST_START_YEAR, TEST_START_MONTH, TEST_START_DAY,
    TEST_END_YEAR, TEST_END_MONTH, TEST_END_DAY,
    ENTRY_TIMEFRAME, BIAS_TIMEFRAME, OPTION_MONEYNESS, SPREAD_REGIME,
    KITE_API_KEY, VIX_TOKEN,
    SIGNAL_EMA_PERIOD, SL_ATR_MULTIPLIER, MIN_RISK_REWARD_RATIO,
    DRAWDOWN_CIRCUIT_BREAKER, CAPITAL_FLOOR_PCT,
    MAX_CAPITAL_PER_POSITION_PCT, MAX_LOTS,
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


def _parse_date(d) -> date:
    """Parse a date from various formats (str, date, datetime)."""
    if isinstance(d, date):
        return d
    if isinstance(d, datetime):
        return d.date()
    if isinstance(d, str):
        # Try ISO format first: "2025-11-01"
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y"):
            try:
                return datetime.strptime(d, fmt).date()
            except ValueError:
                continue
        raise ValueError(f"Cannot parse date: {d}")
    raise TypeError(f"Expected date/str, got {type(d)}")


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


def main(params: Optional[Dict[str, Any]] = None, progress_callback=None):
    """
    Run the complete DDLJ v9 backtest with all bug fixes.

    Args:
        params: Optional dictionary of parameters to override defaults.
            Supported keys:
                - symbol (str): "BANKNIFTY", "NIFTY", or "both" (default: "both")
                - timeframe (str): "15m/60m", "15m/15m", "5m/60m", or "all" (default: "all")
                - method (str): "method_a", "method_b", or "both" (default: "both")
                - from_date (str/date): Start date (default: from config)
                - to_date (str/date): End date (default: from config)
                - capital (float): Starting capital (default: from config)
                - sl_atr (float): SL ATR multiplier (default: 2.0)
                - min_rr (float): Minimum risk-reward ratio (default: 1.5)
                - moneyness (str): Option moneyness "ATM"/"ITM"/"DEEP_ITM" (default: "ITM")
                - daily_risk_pct (float): Daily risk % (default: from config)
                - max_open_positions (int): Max open positions (default: from config)
                - max_daily_trades (int): Max daily trades (default: from config)

    Returns:
        dict: Complete backtest results with method_a and method_b data.
    """
    p = params or {}

    # ── Parse parameters with sensible defaults ──
    symbol = p.get("symbol", "both")
    timeframe = p.get("timeframe", "all")
    method = p.get("method", "both")
    capital = float(p.get("capital", STARTING_CAPITAL))
    sl_atr = float(p.get("sl_atr", SL_ATR_MULTIPLIER))
    min_rr = float(p.get("min_rr", MIN_RISK_REWARD_RATIO))
    moneyness = p.get("moneyness", OPTION_MONEYNESS)
    daily_risk_pct = float(p.get("daily_risk_pct", DAILY_RISK_PCT))
    max_open_positions = int(p.get("max_open_positions", MAX_OPEN_POSITIONS))
    max_daily_trades = int(p.get("max_daily_trades", MAX_DAILY_TRADES))

    # ── Parse date range ──
    try:
        from_date = _parse_date(p.get("from_date", date(TEST_START_YEAR, TEST_START_MONTH, TEST_START_DAY)))
    except (ValueError, TypeError):
        from_date = date(TEST_START_YEAR, TEST_START_MONTH, TEST_START_DAY)

    try:
        to_date = _parse_date(p.get("to_date", date(TEST_END_YEAR, TEST_END_MONTH, TEST_END_DAY)))
    except (ValueError, TypeError):
        to_date = date(TEST_END_YEAR, TEST_END_MONTH, TEST_END_DAY)

    def _progress(**kwargs):
        """Send progress update to callback if provided."""
        if progress_callback:
            try:
                progress_callback(**kwargs)
            except Exception:
                pass  # Never let progress updates crash the backtest

    log.info("=" * 70)
    log.info("DDLJ v9 BACKTEST — All Bug Fixes Applied")
    log.info("=" * 70)
    log.info("Period: %s → %s | Capital: ₹%s", from_date, to_date, f"{capital:,}")
    log.info("Symbol: %s | TF: %s | Method: %s | SL_ATR: %s | Min_RR: %s | Moneyness: %s",
             symbol, timeframe, method, sl_atr, min_rr, moneyness)
    _progress(phase="fetching", message=f"Fetching data for {symbol} ({from_date} → {to_date})...", pct=5)

    # Load data
    _progress(phase="fetching", message="Resolving futures tokens...", pct=8)
    bn_fut_token = BN_FUT_TOKEN
    nf_fut_token = NF_FUT_TOKEN
    try:
        kite = get_kite_session()
        fetcher = KiteDataFetcher(KITE_API_KEY, kite.access_token)
        resolved_bn = fetcher.resolve_future_token("BANKNIFTY")
        resolved_nf = fetcher.resolve_future_token("NIFTY")
        if resolved_bn: bn_fut_token = resolved_bn
        if resolved_nf: nf_fut_token = resolved_nf
        _progress(message="Futures tokens resolved from API")
    except Exception:
        log.warning("Using default futures tokens from config")
        _progress(message="Using default futures tokens (API unavailable)")

    # Only fetch data for the symbols we need
    data_cache = {}

    candle_counts = {}

    if symbol in ("BANKNIFTY", "both"):
        _progress(phase="fetching", message="Fetching BANKNIFTY candle data...", pct=10)
        bn_5m_raw = _fetch_data_if_needed([BN_INDEX_TOKEN, bn_fut_token], "5minute", from_date, to_date)
        _progress(phase="fetching", message="Fetching BANKNIFTY 15m data...", pct=15)
        bn_15m_raw = _fetch_data_if_needed([BN_INDEX_TOKEN, bn_fut_token], "15minute", from_date, to_date)
        _progress(phase="fetching", message="Fetching BANKNIFTY 60m data...", pct=20)
        bn_60m_raw = _fetch_data_if_needed([BN_INDEX_TOKEN, bn_fut_token], "60minute", from_date, to_date)
        bn_5m = filter_candles_by_date(parse_candles(bn_5m_raw, "BANKNIFTY", "5m"), from_date, to_date)
        bn_15m = filter_candles_by_date(parse_candles(bn_15m_raw, "BANKNIFTY", "15m"), from_date, to_date)
        bn_60m = filter_candles_by_date(parse_candles(bn_60m_raw, "BANKNIFTY", "60m"), from_date, to_date)
        data_cache["BANKNIFTY"] = ("BN", bn_5m, bn_15m, bn_60m)
        candle_counts["BN_5m"] = len(bn_5m)
        candle_counts["BN_15m"] = len(bn_15m)
        candle_counts["BN_60m"] = len(bn_60m)
        log.info("  BN 5m: %d | BN 15m: %d | BN 60m: %d", len(bn_5m), len(bn_15m), len(bn_60m))

    if symbol in ("NIFTY", "both"):
        _progress(phase="fetching", message="Fetching NIFTY candle data...", pct=25)
        nf_5m_raw = _fetch_data_if_needed([NF_INDEX_TOKEN, nf_fut_token], "5minute", from_date, to_date)
        _progress(phase="fetching", message="Fetching NIFTY 15m data...", pct=30)
        nf_15m_raw = _fetch_data_if_needed([NF_INDEX_TOKEN, nf_fut_token], "15minute", from_date, to_date)
        _progress(phase="fetching", message="Fetching NIFTY 60m data...", pct=35)
        nf_60m_raw = _fetch_data_if_needed([NF_INDEX_TOKEN, nf_fut_token], "60minute", from_date, to_date)
        nf_5m = filter_candles_by_date(parse_candles(nf_5m_raw, "NIFTY", "5m"), from_date, to_date)
        nf_15m = filter_candles_by_date(parse_candles(nf_15m_raw, "NIFTY", "15m"), from_date, to_date)
        nf_60m = filter_candles_by_date(parse_candles(nf_60m_raw, "NIFTY", "60m"), from_date, to_date)
        data_cache["NIFTY"] = ("NF", nf_5m, nf_15m, nf_60m)
        candle_counts["NF_5m"] = len(nf_5m)
        candle_counts["NF_15m"] = len(nf_15m)
        candle_counts["NF_60m"] = len(nf_60m)
        log.info("  NF 5m: %d | NF 15m: %d | NF 60m: %d", len(nf_5m), len(nf_15m), len(nf_60m))

    _progress(phase="running", data_fetched=True, candle_counts=candle_counts,
              message=f"Data fetched: {sum(candle_counts.values())} candles total. Starting backtest...", pct=40)

    # ── Build instrument list based on symbol filter ──
    INSTRUMENTS = []
    for inst_name, (inst_short, data_5m, data_15m, data_60m) in data_cache.items():
        INSTRUMENTS.append((inst_name, inst_short, data_5m, data_15m, data_60m))

    # ── Build timeframe configs based on filter ──
    ALL_TF_CONFIGS = {
        "15m/60m": [("15m", "60m", 15)],
        "15m/15m": [("15m", "15m", 15)],
        "5m/60m": [("5m", "60m", 5)],
        "all": [("15m", "60m", 15), ("15m", "15m", 15), ("5m", "60m", 5)],
    }
    TF_CONFIGS = ALL_TF_CONFIGS.get(timeframe, ALL_TF_CONFIGS["all"])

    # ── Signal configs from user params ──
    SIGNAL_CONFIGS = [(sl_atr, min_rr, f"sl{sl_atr}_RR{min_rr}")]

    # ── Option modes from user params ──
    spread_regime = SPREAD_REGIME
    OPTION_MODES = [(moneyness, spread_regime)]

    results_a = {}
    results_b = {}
    config_num = 0
    total = len(INSTRUMENTS) * len(TF_CONFIGS) * len(SIGNAL_CONFIGS) * len(OPTION_MODES)
    _progress(phase="running", total_configs=total, message=f"Running {total} config combinations...", pct=40)

    for inst_name, inst_short, data_5m, data_15m, data_60m in INSTRUMENTS:
        for entry_tf, bias_tf, entry_tf_min in TF_CONFIGS:
            for sl_atr_val, min_rr_val, sig_label in SIGNAL_CONFIGS:
                for moneyness_val, spread_regime_val in OPTION_MODES:
                    config_num += 1
                    _progress(
                        phase="running",
                        current_config=config_num,
                        current_label=f"{inst_short}_{entry_tf}x{bias_tf}_{sig_label}_{moneyness_val}",
                        message=f"Config {config_num}/{total}: {inst_short} {entry_tf}x{bias_tf} {sig_label} {moneyness_val}",
                    )
                    entry_candles = data_15m if entry_tf == "15m" else data_5m
                    bias_candles = data_60m if bias_tf == "60m" else data_15m if bias_tf == "15m" else data_5m
                    if not entry_candles or not bias_candles:
                        log.warning("Skipping %s %s/%s — no candle data", inst_name, entry_tf, bias_tf)
                        continue

                    label = f"{inst_short}_{entry_tf}x{bias_tf}_{sig_label}_{moneyness_val}"

                    # Method A (Compounding)
                    if method in ("method_a", "both"):
                        se_a = EMACrossSignal(sl_atr=sl_atr_val, min_rr=min_rr_val)
                        be_a = BiasEngine()
                        oe_a = OptionsMimicryEngine(inst_name, moneyness_val, spread_regime_val, capital=capital)
                        trades_a, _ = run_backtest_enhanced(inst_name, entry_candles, bias_candles,
                                                            se_a, be_a, oe_a, entry_tf_minutes=entry_tf_min)
                        results_a[label] = analyze(trades_a, label, capital)

                    # Method B (Monthly Batch)
                    if method in ("method_b", "both"):
                        se_b = EMACrossSignal(sl_atr=sl_atr_val, min_rr=min_rr_val)
                        be_b = BiasEngine()
                        oe_b = OptionsMimicryEngine(inst_name, moneyness_val, spread_regime_val, capital=capital)
                        trades_b, _ = run_backtest_enhanced(inst_name, entry_candles, bias_candles,
                                                            se_b, be_b, oe_b, entry_tf_minutes=entry_tf_min,
                                                            monthly_reset=True)
                        results_b[label] = analyze(trades_b, label, capital)

                    pnl_a = results_a.get(label, {}).get("net_pnl", 0)
                    pnl_b = results_b.get(label, {}).get("net_pnl", 0)
                    log.info("[%d/%d] %s: A=₹%.0f B=₹%.0f", config_num, total, label, pnl_a, pnl_b)

    # Save results
    _progress(phase="saving", message="Saving results...", pct=95)
    output = {
        "version": "v10.2_ALL_BUGS_FIXED",
        "params_used": {
            "symbol": symbol,
            "timeframe": timeframe,
            "method": method,
            "from_date": str(from_date),
            "to_date": str(to_date),
            "capital": capital,
            "sl_atr": sl_atr,
            "min_rr": min_rr,
            "moneyness": moneyness,
            "daily_risk_pct": daily_risk_pct,
            "max_open_positions": max_open_positions,
            "max_daily_trades": max_daily_trades,
        },
        "method_a_compounding": results_a,
        "method_b_monthly_batch": results_b,
    }

    # Resolve output path using core.config.DOWNLOAD_DIR for consistency with routes.py
    # WHY: Previously, run_backtest.py used os.path.dirname(__file__)+"../.."
    #      which resolves to the PROJECT ROOT (parent of backend/).
    #      But routes.py uses core.config.PROJECT_ROOT which on local dev
    #      resolves to backend/ (because it finds main.py there).
    #      This PATH MISMATCH caused the status endpoint to look in the wrong
    #      directory for results, showing "no_results" even after backtest completed.
    try:
        from core.config import DOWNLOAD_DIR as _download_dir
        output_dir = str(_download_dir)
    except ImportError:
        _project_root = os.getenv("PROJECT_ROOT", os.path.join(os.path.dirname(__file__), "..", ".."))
        output_dir = os.path.join(_project_root, "download")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "v9_backtest_results.json")
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2, default=str)
    log.info("Results saved to %s", output_path)

    _progress(phase="done", pct=100, message="Backtest completed!")

    # Print summary
    log.info("\n" + "=" * 70)
    log.info("SUMMARY — Top 5 by Net P&L")
    for method_name, results, display_name in [("A", results_a, "Compounding"), ("B", results_b, "Monthly Batch")]:
        log.info(f"\nMETHOD {method_name} ({display_name}):")
        for i, (label, r) in enumerate(sorted(results.items(), key=lambda x: x[1]["net_pnl"], reverse=True)[:5]):
            log.info("  %d. %s: ₹%s (%s%%) WR=%s%% PF=%s Trades=%s DD=%s%% Sharpe=%s",
                     i+1, label, f"{r['net_pnl']:,.0f}", f"{r['net_pnl_pct']:+.1f}",
                     f"{r['win_rate']:.0f}", f"{r['profit_factor']:.1f}",
                     r['total_trades'], f"{r['max_dd_pct']:.1f}", f"{r['sharpe_approx']:.1f}")

    return output


if __name__ == "__main__":
    main()
