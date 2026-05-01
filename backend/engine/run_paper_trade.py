#!/usr/bin/env python3
"""
DDLJ v9 — Paper Trading Entry Point
======================================

This is the MAIN script to start live paper trading. It:
  1. Shows a welcome banner with current configuration
  2. Lets the user confirm parameters before starting
  3. Connects to the Kite API
  4. Starts the paper trading engine
  5. Handles Ctrl+C gracefully
  6. Shows summary on exit

USAGE:
    python -m ddlj_v9.run_paper_trade

    # Or with custom parameters:
    python -c "
    from ddlj_v9.paper_trader import PaperTrader
    trader = PaperTrader(config_override={
        'STARTING_CAPITAL': 100000,
        'DAILY_RISK_PCT': 4.0,
    })
    trader.start()
    "

IMPORTANT:
    Before running, make sure you have a valid Kite access token.
    If you don't have one:
      1. Visit: https://kite.trade/connect/login?api_key=YOUR_API_KEY&v=3
      2. After login, copy the request_token from the redirect URL
      3. Run:
         from ddlj_v9.token_manager import exchange_request_token
         kite = exchange_request_token("YOUR_REQUEST_TOKEN")

Author: DDLJ Strategy Team
Version: 9.0.0 (Production — Paper Trading Ready)
"""

import sys
import logging

from . import config as cfg
from .paper_trader import PaperTrader


def print_banner():
    """Print a welcome banner with current configuration."""
    banner = f"""
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║          DDLJ v9 — Live Paper Trading Engine                  ║
║                                                               ║
║  Everything is REAL except order placement.                   ║
║  No real money is at risk.                                    ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  Starting Capital:    ₹{cfg.STARTING_CAPITAL:>10,}                         ║
║  Max Daily Risk:      {cfg.DAILY_RISK_PCT}% (₹{cfg.STARTING_CAPITAL * cfg.DAILY_RISK_PCT / 100:>10,.0f})                    ║
║  Max Open Positions:  {cfg.MAX_OPEN_POSITIONS:>3}                                      ║
║  Max Daily Trades:    {cfg.MAX_DAILY_TRADES:>3}                                      ║
║  Entry Timeframe:     {cfg.ENTRY_TIMEFRAME:>3}                                      ║
║  Bias Timeframe:      {cfg.BIAS_TIMEFRAME:>3}                                      ║
║  Trade Index:         {cfg.TRADE_INDEX:<10}                            ║
║  Option Moneyness:    {cfg.OPTION_MONEYNESS:<10}                            ║
║  SL Multiplier:       {cfg.SL_ATR_MULTIPLIER}x ATR                                  ║
║  Min Risk-Reward:     {cfg.MIN_RISK_REWARD_RATIO}                                      ║
║  Poll Interval:       {cfg.POLL_INTERVAL_SECONDS}s                                     ║
║                                                               ║
║  Risk Profile:       {'Conservative' if cfg.DAILY_RISK_PCT <= 3 else 'Balanced' if cfg.DAILY_RISK_PCT <= 6 else 'Aggressive':<12}                            ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  Press Ctrl+C to stop gracefully                              ║
║  State is auto-saved every 60 seconds                         ║
║  Trades are logged to trades_log.json & trades_log.csv        ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
"""
    print(banner)


def main():
    """Main entry point for paper trading."""
    # Setup logging
    log_level = getattr(logging, cfg.LOG_LEVEL.upper(), logging.INFO)
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )

    # Print banner
    print_banner()

    # Check if token exists
    try:
        with open(cfg.KITE_TOKEN_FILE, "r") as f:
            token = f.read().strip()
        if not token:
            print("⚠️  No access token found!")
            print("   Please run:")
            print("   from ddlj_v9.token_manager import exchange_request_token")
            print("   kite = exchange_request_token('YOUR_REQUEST_TOKEN')")
            sys.exit(1)
    except FileNotFoundError:
        print("⚠️  Token file not found!")
        print("   Please run:")
        print("   from ddlj_v9.token_manager import exchange_request_token")
        print("   kite = exchange_request_token('YOUR_REQUEST_TOKEN')")
        sys.exit(1)

    # Ask for confirmation
    print("\nReady to start paper trading with the above settings?")
    print("  Type 'yes' to start, anything else to cancel: ", end="")
    try:
        response = input().strip().lower()
    except EOFError:
        response = "yes"  # Auto-start if no input available

    if response not in ("yes", "y"):
        print("Cancelled. Edit config.py to change settings and try again.")
        sys.exit(0)

    # Start paper trading
    trader = PaperTrader()
    trader.start()


if __name__ == "__main__":
    main()
