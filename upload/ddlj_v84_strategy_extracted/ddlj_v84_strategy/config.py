#!/usr/bin/env python3
"""
DDLJ v8.4 Strategy — Configuration File
=========================================

This file contains ALL parameters that control the strategy behavior.
Every parameter has:
  - DEFAULT VALUE: Safe starting point
  - SUGGESTED VALUE: What we recommend based on backtesting
  - WHY: Explanation of what this parameter does and why this value

HOW TO USE:
  1. Copy this file and rename to my_config.py
  2. Change only the values you want to customize
  3. Import your custom config in run_backtest.py

Author: DDLJ Strategy Team
Version: 8.4 (Production — Bug-Fixed)
"""

# ============================================================================
# 1. TRADING CAPITAL & RISK MANAGEMENT
# ============================================================================
# These are the most important settings — they control how much money you
# risk and how the strategy manages your capital.
# ============================================================================

# --- Starting Capital ---
# DEFAULT:   50000
# SUGGESTED: 50000 (for options), 100000+ (for futures)
# WHY: This is the amount of money you start with on Day 1.
#      With 50,000 rupees, you can trade 1-2 lots of BankNifty options.
#      Futures require more margin (around 1.5 lakh per lot).
STARTING_CAPITAL = 50000

# --- Daily Maximum Risk Percentage ---
# DEFAULT:   6.0
# SUGGESTED: 6.0 (aggressive), 3.0 (conservative)
# WHY: This is the maximum percentage of your capital you can lose in a
#      single day. If your daily losses reach this limit, the strategy
#      stops taking new trades for the rest of that day.
#      Example: 6% of 50,000 = 3,000 rupees max daily loss.
#      Higher values = more aggressive but riskier.
DAILY_RISK_PCT = 6.0

# --- Maximum Simultaneous Positions ---
# DEFAULT:   2
# SUGGESTED: 2 (recommended), 1 (very safe), 3 (aggressive)
# WHY: How many trades can be open at the same time.
#      2 positions means you can have, for example, one BankNifty trade
#      and one Nifty trade running at the same time.
#      More positions = more diversification but also more risk.
MAX_OPEN_POSITIONS = 2

# --- Risk Per Position Limit ---
# DEFAULT:   None (OFF / No limit)
# SUGGESTED: None for this strategy
# WHY: This would limit how much you risk on each individual trade.
#      In this strategy, we set it to None (off) because position sizing
#      is already controlled by the capital-based lot calculation.
#      If you want per-trade limits, set to a percentage like 3.0.
RISK_PER_POSITION_PCT = None  # OFF — no per-position risk limit


# ============================================================================
# 2. MARKET TIMING — WHEN TO TRADE AND WHEN NOT TO
# ============================================================================
# Indian stock market opens at 9:15 AM and closes at 3:30 PM (IST).
# These settings control which hours the strategy is allowed to trade.
# ============================================================================

# --- No-Trade Window (Morning) ---
# DEFAULT:   9:20 AM
# SUGGESTED: 9:20 AM (skip first 5 minutes)
# WHY: The first few minutes after market open are extremely volatile
#      and unpredictable. Prices whipsaw wildly. We wait 5 minutes
#      for the market to settle before we start looking for signals.
#      Format: (hour, minute) in 24-hour format
NO_TRADE_END_HOUR = 9
NO_TRADE_END_MINUTE = 20

# --- Entry Cutoff Time ---
# DEFAULT:   2:15 PM
# SUGGESTED: 2:15 PM
# WHY: We stop taking NEW trades after 2:15 PM because:
#      1. European markets open around this time, causing volatility
#      2. We need time for existing trades to reach their targets
#      3. Late-day trades have less time to work out
#      Existing open positions continue to be managed after this time.
ENTRY_CUTOFF_HOUR = 14
ENTRY_CUTOFF_MINUTE = 15

# --- Force Close Time ---
# DEFAULT:   3:10 PM
# SUGGESTED: 3:10 PM
# WHY: All open positions are forcefully closed at this time.
#      This ensures we are never holding positions into the close,
#      which can be dangerous due to last-minute volatility.
#      20 minutes before market close gives enough time to exit.
FORCE_CLOSE_HOUR = 15
FORCE_CLOSE_MINUTE = 10


# ============================================================================
# 3. INSTRUMENT SETTINGS — WHAT TO TRADE
# ============================================================================
# The strategy trades index options on Nifty and BankNifty.
# ============================================================================

# --- Lot Sizes ---
# WHY: Each index has a fixed lot size set by the exchange.
#      BankNifty = 30 shares per lot, Nifty = 65 shares per lot.
#      These are NOT configurable — they are set by NSE.
BANKNIFTY_LOT_SIZE = 30
NIFTY_LOT_SIZE = 65

# --- Strike Step ---
# WHY: BankNifty options have strikes every 100 points (e.g., 50000, 50100, 50200).
#      Nifty options have strikes every 50 points (e.g., 24000, 24050, 24100).
#      These are NOT configurable — they are set by NSE.
BANKNIFTY_STRIKE_STEP = 100
NIFTY_STRIKE_STEP = 50

# --- Kite API Instrument Tokens ---
# WHY: Each instrument on Zerodha's Kite API has a unique numeric token.
#      These tokens identify which data to fetch.
#      Token 260105 = NIFTY BANK index (spot price)
#      Token 256265 = NIFTY 50 index (spot price)
BN_INDEX_TOKEN = 260105   # BankNifty spot price
NF_INDEX_TOKEN = 256265   # Nifty spot price
BN_FUT_TOKEN = 17072130   # BankNifty current month futures
NF_FUT_TOKEN = 17072898   # Nifty current month futures
VIX_TOKEN = 264969        # India VIX (volatility index)


# ============================================================================
# 4. BIAS ENGINE — TREND DETECTION
# ============================================================================
# The Bias Engine determines the market direction (BULLISH, BEARISH, NEUTRAL)
# on a higher timeframe. We only take trades in the direction of the bias.
# ============================================================================

# --- EMA Period for Bias ---
# DEFAULT:   20
# SUGGESTED: 20
# WHY: We use a 20-period Exponential Moving Average (EMA) to determine
#      the trend. 20 is the standard choice — not too fast, not too slow.
#      - Lower (e.g., 10): Faster signals, more false signals
#      - Higher (e.g., 50): Slower signals, fewer false signals
BIAS_EMA_PERIOD = 20

# --- ATR Period for Bias ---
# DEFAULT:   14
# SUGGESTED: 14
# WHY: Average True Range (ATR) measures volatility. 14 is the standard
#      period used by most traders worldwide. It gives a good balance
#      between responsiveness and stability.
BIAS_ATR_PERIOD = 14

# --- Structure Lookback ---
# DEFAULT:   20
# SUGGESTED: 20
# WHY: How many candles to look back when detecting market structure
#      (Higher Highs, Lower Lows, etc.). 20 candles provides enough
#      data to identify genuine structure patterns.
BIAS_STRUCTURE_LOOKBACK = 20


# ============================================================================
# 5. SIGNAL ENGINE — ENTRY/EXIT SIGNAL GENERATION
# ============================================================================
# The Signal Engine generates actual LONG/SHORT entry signals on the
# entry timeframe. It looks for EMA crossover patterns confirmed by
# candle body size, volume, and VWAP alignment.
# ============================================================================

# --- EMA Period for Entry Signals ---
# DEFAULT:   20
# SUGGESTED: 20
# WHY: Same as bias EMA. We look for price crossing above/below
#      the 20 EMA as our entry trigger.
SIGNAL_EMA_PERIOD = 20

# --- ATR Period for Signals ---
# DEFAULT:   14
# SUGGESTED: 14
# WHY: Used to calculate Stop Loss distance and verify candle quality.
SIGNAL_ATR_PERIOD = 14

# --- Stop Loss ATR Multiplier ---
# DEFAULT:   2.0
# SUGGESTED: 2.0 (balanced), 1.5 (tight), 2.5 (wide)
# WHY: Stop Loss is placed at: Entry Price - (SL_MULTIPLIER x ATR)
#      - 1.5x ATR: Tight stop, gets hit more often, but less risk per trade
#      - 2.0x ATR: Balanced, good for most conditions
#      - 2.5x ATR: Wide stop, less likely to get hit, but more risk per trade
#      Our backtesting shows SL=2.0 works best overall.
SL_ATR_MULTIPLIER = 2.0

# --- Minimum Risk-Reward Ratio ---
# DEFAULT:   1.5
# SUGGESTED: 1.5 (balanced), 2.0 (aggressive), 1.0 (conservative)
# WHY: We only take trades where the potential reward is at least
#      1.5 times the risk. Example: Risk 100 rupees to make 150 rupees.
#      - 1.0: Accept break-even trades (more trades, lower quality)
#      - 1.5: Good balance of quantity and quality
#      - 2.0: Fewer trades but higher quality
MIN_RISK_REWARD_RATIO = 1.5

# --- Minimum Target Distance (in ATR) ---
# DEFAULT:   1.5
# SUGGESTED: 1.5
# WHY: The minimum distance from entry to target, measured in ATR.
#      This ensures our target is far enough away to be meaningful.
MIN_TARGET_ATR = 1.5

# --- Minimum Candle Body Size (in ATR) ---
# DEFAULT:   0.3
# SUGGESTED: 0.3
# WHY: We only take signals from candles with a body size of at least
#      0.3 x ATR. This filters out tiny "doji" candles that have no
#      conviction. A bigger body = stronger signal.
MIN_BODY_ATR = 0.3

# --- EMA Buffer (in ATR) ---
# DEFAULT:   0.1
# SUGGESTED: 0.1
# WHY: Price must cross ABOVE the EMA + buffer for a LONG signal.
#      This small buffer prevents false signals when price is just
#      touching the EMA without real conviction.
EMA_BUFFER_ATR = 0.1


# ============================================================================
# 6. OPTIONS PRICING — BLACK-SCHOLES MODEL
# ============================================================================
# We use the Black-Scholes formula to price options realistically.
# This is far more accurate than the simplified approximation used
# in earlier versions of the strategy.
# ============================================================================

# --- Risk-Free Interest Rate ---
# DEFAULT:   0.07 (7%)
# SUGGESTED: 0.07
# WHY: India's risk-free rate (approximately the 10-year government
#      bond yield). This is a standard input to Black-Scholes.
#      In India, this is typically between 6.5% and 7.5%.
RISK_FREE_RATE = 0.07

# --- IV-VIX Spread (Implied Volatility adjustment) ---
# WHY: India VIX measures Nifty's implied volatility. But BankNifty and
#      Nifty options have slightly higher IV than VIX because of:
#      - Skew (different strikes have different IVs)
#      - Supply/demand for specific options
#      BankNifty IV is typically VIX + 4 points.
#      Nifty IV is typically VIX + 1.5 points.
BN_IV_VIX_SPREAD = 4.0   # BankNifty IV ≈ VIX + 4
NF_IV_VIX_SPREAD = 1.5   # Nifty IV ≈ VIX + 1.5

# --- IV Adjustment Factor ---
# DEFAULT:   1.0
# SUGGESTED: 1.0
# WHY: A multiplier applied to the estimated IV. Set to 1.0 for
#      normal conditions. Increase to 1.1 (10% higher) if you think
#      actual IV is higher than our estimate, which would make options
#      more expensive and results more conservative.
IV_ADJUSTMENT = 1.0


# ============================================================================
# 7. OPTIONS MONEYNESS — WHICH OPTIONS TO TRADE
# ============================================================================
# "Moneyness" describes how far the option strike is from the current
# spot price. This is a CRITICAL setting.
#
# ATM  = At-The-Money (strike ≈ spot price, delta ≈ 0.50)
#        -> Cheaper, more leverage, but more time decay (theta)
#        -> Good for quick directional bets
#
# ITM = In-The-Money (strike is favorable, delta ≈ 0.60)
#        -> More expensive, less leverage, but less time decay
#        -> Moves more like the underlying index
#        -> BEST for this strategy based on backtesting
#
# DEEP_ITM = Deep In-The-Money (strike very favorable, delta ≈ 0.75)
#        -> Very expensive, moves almost like futures
#        -> Least time decay, but requires more capital
# ============================================================================

# DEFAULT:   "ITM"
# SUGGESTED: "ITM" (based on backtesting)
# WHY: Our backtesting shows ITM options perform best because:
#      1. Higher delta means they move more with the index
#      2. Less theta decay eats into profits
#      3. Still affordable with 50K capital
OPTION_MONEYNESS = "ITM"  # Options: "ATM", "ITM", or "DEEP_ITM"

# --- Spread Regime ---
# DEFAULT:   "auto"
# SUGGESTED: "auto"
# WHY: The bid-ask spread model has three modes:
#      "normal"   — Low volatility, tight spreads (VIX < 14)
#      "volatile" — Medium volatility, wider spreads (VIX 14-20)
#      "illiquid" — High volatility, very wide spreads (VIX > 20)
#      "auto" — Automatically selects based on current VIX level.
#      ALWAYS use "auto" unless you have a specific reason.
SPREAD_REGIME = "auto"


# ============================================================================
# 8. POSITION SIZING — HOW MANY LOTS TO TRADE
# ============================================================================
# Controls how many lots of options we buy per trade.
# ============================================================================

# --- Maximum Capital Per Position ---
# DEFAULT:   0.40 (40%)
# SUGGESTED: 0.40
# WHY: We allocate at most 40% of current capital to any single position.
#      This prevents over-concentration in one trade.
#      With 50K capital and 40%: max 20,000 rupees per position.
MAX_CAPITAL_PER_POSITION_PCT = 0.40

# --- Maximum Number of Lots ---
# DEFAULT:   3
# SUGGESTED: 3
# WHY: Hard cap on the number of lots regardless of capital.
#      This is a safety limit. Even if you have millions in capital,
#      we don't want to take excessively large positions.
MAX_LOTS = 3


# ============================================================================
# 9. TRAILING STOP LOSS — HOW WE PROTECT PROFITS
# ============================================================================
# Once a trade is in profit, we use trailing stop losses to lock in gains.
# ============================================================================

# --- Breakeven Trigger ---
# WHY: When unrealized profit equals the initial risk (1R), we move
#      the stop loss to breakeven (entry price + 1 rupee). This ensures
#      a winning trade can never turn into a losing trade.
#      This is automatic and always ON.

# --- Trailing Method ---
# WHY: After breakeven, every 3 bars we check if we can tighten the
#      stop loss. We move it to the most recent swing low (for LONG)
#      or swing high (for SHORT), minus a small buffer.
#      This trails the stop behind the price action, locking in more
#      profit as the trade moves in our favor.

# --- Near-Target Exit ---
# WHY: If the price comes within 3 points of the target and is still
#      profitable, we exit at the current price. This prevents the
#      frustration of watching a profitable trade reverse at the target.

# --- Time-Based Exit ---
# WHY: If a trade is held for too long (approximately 24 fifteen-minute
#      candles = 6 hours), we exit at market price. Options lose value
#      over time (theta decay), so holding too long is costly.

# --- Bias Flip Exit ---
# WHY: If the market direction reverses (e.g., was BULLISH, now BEARISH)
#      and we've held the trade for more than 6 bars, we exit. The
#      original reason for the trade is no longer valid.


# ============================================================================
# 10. TRANSACTION COSTS — REALISTIC TRADING COSTS
# ============================================================================
# These are the actual costs you pay when trading options on Zerodha.
# These are NOT configurable — they are real exchange/brokerage fees.
# ============================================================================

# Brokerage: Rs 20 per executed order (Zerodha flat rate)
# STT: 0.0625% on sell side (options)
# Exchange Transaction Charge: 0.05% on both buy and sell
# GST: 18% on (brokerage + exchange charges)
# SEBI Turnover Fee: 0.0001% on both sides
# Stamp Duty: 0.003% on buy side
# Slippage: Built into the spread model (see Section 7)


# ============================================================================
# 11. BACKTEST PERIOD — WHEN TO TEST
# ============================================================================

# --- Test Start Date ---
# DEFAULT:   November 1, 2025
# SUGGESTED: Use at least 6 months of data
# WHY: We test from November 2025 through April 2026 (6 months).
#      This covers different market conditions: trending, choppy, volatile.
TEST_START_YEAR = 2025
TEST_START_MONTH = 11
TEST_START_DAY = 1

# --- Test End Date ---
TEST_END_YEAR = 2026
TEST_END_MONTH = 4
TEST_END_DAY = 25


# ============================================================================
# 12. TESTING METHOD — HOW TO MEASURE PERFORMANCE
# ============================================================================
# We test using TWO methods to get a complete picture.
#
# METHOD A: Capital Compounding
#   - Start with 50,000 rupees
#   - After each trade, capital grows or shrinks
#   - Next trade uses the updated capital
#   - Shows maximum potential if you let profits compound
#   - PRO: Shows the power of compounding
#   - CON: Can be misleading (one bad month can wipe out everything)
#
# METHOD B: Monthly Batches
#   - Start each month with a fresh 50,000 rupees
#   - Within the month, capital compounds
#   - At month end, reset back to 50,000
#   - Shows consistent monthly performance
#   - PRO: More realistic — shows how the strategy performs month by month
#   - CON: Doesn't show compounding benefits over time
# ============================================================================

# Both methods are always run. No configuration needed.


# ============================================================================
# 13. TIMEFRAME CONFIGURATION
# ============================================================================
# The strategy uses TWO timeframes:
#   1. ENTRY TIMEFRAME: Where we look for trade signals (crossover patterns)
#   2. BIAS TIMEFRAME: Where we determine the market direction (trend)
#
# Common combinations tested:
#   Entry 5m  x Bias 5m   — Same TF, fast signals, more noise
#   Entry 5m  x Bias 15m  — Fast entry, medium bias
#   Entry 5m  x Bias 60m  — Fast entry, slow bias (more reliable trend)
#   Entry 15m x Bias 15m  — Medium entry, medium bias
#   Entry 15m x Bias 60m  — Medium entry, slow bias (RECOMMENDED)
#
# NOTE: 1-minute and 3-minute data is only available from February 2026
#       due to API limitations. 5m and 15m data is available for the full
#       6-month test period. This is why we recommend 15m entry.
# ============================================================================

# Entry timeframe options: "1m", "3m", "5m", "15m"
# Bias timeframe options: "5m", "15m", "60m"

# DEFAULT (recommended based on backtesting):
ENTRY_TIMEFRAME = "15m"
BIAS_TIMEFRAME = "60m"


# ============================================================================
# 14. KITE API CREDENTIALS
# ============================================================================
# You MUST have a Zerodha account with Kite Connect API enabled.
# Sign up at: https://kite.trade
# ============================================================================

# --- API Key ---
# WHY: Your unique API key from Zerodha. Get it from https://kite.trade
KITE_API_KEY = "cjzjv3v9y3lox6mh"

# --- API Secret ---
# WHY: Your API secret from Zerodha. NEVER share this publicly.
KITE_API_SECRET = ""  # Fill in your own secret

# --- Token File Path ---
# WHY: Where to store the access token after login.
#      The token is valid for one day and auto-refreshes.
KITE_TOKEN_FILE = "kite_access_token.txt"


# ============================================================================
# 15. DATA CACHE DIRECTORY
# ============================================================================
# WHY: Historical data is cached locally to avoid re-downloading.
#      This saves API calls and speeds up subsequent runs.
#      Cache files are named like: 260105_15minute_2025-11-01_2025-12-31.json
CACHE_DIR = "kite_cache_v10"


# ============================================================================
# SUMMARY OF RECOMMENDED SETTINGS
# ============================================================================
#
# For a beginner with 50K capital:
#   STARTING_CAPITAL = 50000
#   DAILY_RISK_PCT = 6.0
#   MAX_OPEN_POSITIONS = 2
#   SL_ATR_MULTIPLIER = 2.0
#   MIN_RISK_REWARD_RATIO = 1.5
#   OPTION_MONEYNESS = "ITM"
#   ENTRY_TIMEFRAME = "15m"
#   BIAS_TIMEFRAME = "60m"
#
# These settings gave the best risk-adjusted returns in our backtesting.
# ============================================================================
