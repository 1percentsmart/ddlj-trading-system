"""
DDLJ v9.1 Strategy Engine — Core Trading Modules
===================================================

This package contains the core trading strategy logic.
It is completely independent of the FastAPI layer and can
be used standalone (like before) or through the API server.

Modules:
  config.py          — All strategy parameters with defaults and docs
  bias_engine.py     — Market direction detection (BULLISH/BEARISH/NEUTRAL)
  signal_engine.py   — EMA crossover entry/exit signal generation
  options_engine.py  — Options pricing with Black-Scholes and real VIX
  black_scholes.py   — Full BS pricing + Greeks
  paper_trader.py    — Live paper trading engine
  backtester.py      — Historical backtesting engine
  indicators.py      — Technical indicators (EMA, ATR, swing points)
  candle_data.py     — Candle data structures, loading, aggregation
  cost_calculator.py — Zerodha transaction costs
  trade_types.py     — Trade dataclass
  token_manager.py   — Kite API token lifecycle
  data_fetcher.py    — Kite API data fetcher with chunking & caching
  analysis.py        — Performance statistics

Version: 9.1.0 (inherited from standalone — all 16 bug fixes applied)
"""

__version__ = "9.1.0"
__author__ = "DDLJ Strategy Team"
