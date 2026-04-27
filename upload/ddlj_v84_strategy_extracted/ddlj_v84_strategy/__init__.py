#!/usr/bin/env python3
"""
DDLJ v8.4 Strategy — Python Package
=====================================

A clean, well-documented options signal mimicry backtesting package
for Indian index options (BankNifty and Nifty).

WHAT IS DDLJ?
-------------
DDLJ (Directional Derivatives Long/Short Journey) is a trend-following
options trading strategy that:
  1. Identifies market direction using EMA and market structure (Bias Engine)
  2. Generates entry signals on EMA crossovers (Signal Engine)
  3. Translates spot-price signals into realistic options trades using
     the Black-Scholes pricing model (Options Mimicry Engine)
  4. Manages positions with trailing stops, breakeven, and time exits
  5. Enforces daily risk limits and position limits

PACKAGE STRUCTURE:
  config.py            — All configurable parameters with detailed comments
  indicators.py        — Technical indicators (EMA, ATR, swing points)
  black_scholes.py     — Full Black-Scholes pricing engine and Greeks
  options_engine.py    — Options signal mimicry with real IV from India VIX
  bias_engine.py       — Market direction detection (BULLISH/BEARISH/NEUTRAL)
  signal_engine.py     — Entry/exit signal generation (EMA crossover)
  candle_data.py       — Candle dataclass, buffer, loading, and aggregation
  cost_calculator.py   — Realistic transaction cost modeling (Zerodha rates)
  trade_types.py       — Trade and OptionsFill dataclasses
  backtester.py        — Enhanced backtester with BUG-FIXED capital tracking
  analysis.py          — Performance analysis and statistics
  data_fetcher.py      — Kite API data fetching with chunking and caching
  token_manager.py     — Kite API token lifecycle management
  run_backtest.py      — Main entry point for running backtests

v8.4 KEY FIXES:
  1. Capital double-counting bug removed
  2. Proper Black-Scholes with cumulative normal distribution
  3. Real India VIX data for IV estimation
  4. Extended test period (6 months)
  5. Proper monthly batch mode

Author: DDLJ Strategy Team
Version: 8.4 (Production)
"""

__version__ = "8.4.0"
__author__ = "DDLJ Strategy Team"
__description__ = "DDLJ v8.4 — Options Signal Mimicry Backtesting Strategy"
