#!/usr/bin/env python3
"""
DDLJ v9 — Live Paper Trading Engine for Indian Index Options
=============================================================

A production-grade options trading system that connects to real market data
via Zerodha's Kite API, runs the DDLJ strategy in real-time, and simulates
order placement — everything is real EXCEPT order execution.

WHAT'S NEW IN v9 (vs v8.4):
  - Live paper trading mode with real-time data
  - All v8.4 critical bugs fixed (5 bugs)
  - User-configurable parameters at runtime
  - Professional logging and trade tracking
  - Session persistence (resume after restart)
  - Real-time notifications and status dashboard
  - Separate daily trade count limit
  - Peak capital tracking for drawdown

PACKAGE STRUCTURE:
  config.py            — ALL settings with DEFAULT/SUGGESTED/WHY/EXAMPLE
  indicators.py        — Technical indicators (EMA, ATR, swing points)
  black_scholes.py     — Full Black-Scholes pricing engine and Greeks
  options_engine.py    — Options signal mimicry with real IV from India VIX
  bias_engine.py       — Market direction detection (BULLISH/BEARISH/NEUTRAL)
  signal_engine.py     — Entry/exit signal generation (EMA crossover)
  candle_data.py       — Candle dataclass, buffer, loading, and aggregation
  cost_calculator.py   — Realistic transaction cost modeling (Zerodha rates)
  trade_types.py       — Trade dataclass (OptionsFill lives in options_engine)
  backtester.py        — Enhanced backtester with ALL bugs fixed
  analysis.py          — Performance analysis and statistics
  data_fetcher.py      — Kite API data fetching with chunking and caching
  token_manager.py     — Kite API token lifecycle management
  paper_trader.py      — *** NEW: Live paper trading engine ***
  run_paper_trade.py   — *** NEW: Entry point for paper trading ***
  run_backtest.py      — Backtest entry point (fixed version)

Author: DDLJ Strategy Team
Version: 9.0.0 (Production — Paper Trading Ready)
"""

__version__ = "9.0.0"
__author__ = "DDLJ Strategy Team"
__description__ = "DDLJ v9 — Live Paper Trading Engine for Indian Index Options"
