#!/usr/bin/env python3
"""
DDLJ v9 Strategy — Configuration File (USER-FACING)
=====================================================

This file contains EVERY parameter that controls the strategy behavior.
Every parameter has:
  - DEFAULT VALUE: Safe starting point
  - SUGGESTED VALUE: What we recommend based on backtesting
  - WHY: Explanation of what this parameter does and why this value
  - EXAMPLE: What happens when you change it (where helpful)

HOW TO USE:
  1. Copy this file and rename to my_config.py
  2. Change only the values you want to customize
  3. Pass your overrides as a dict to PaperTrader(config_override={...})
  4. Or import your custom config in run_paper_trade.py

IMPORTANT: You do NOT need to edit this file. All parameters can be
overridden at runtime when starting the paper trader.

Author: DDLJ Strategy Team
Version: 9.0.0 (Production — Paper Trading Ready)
"""

import os
from pathlib import Path

# ============================================================================
# 0. PATH RESOLUTION — No hardcoded paths!
# ============================================================================
# WHY: Hardcoded paths like "/home/z/my-project/" break on Railway/Docker.
#      We detect the project root dynamically and derive all paths from it.

def _detect_project_root() -> Path:
    """Detect the project root directory from environment or file location.

    Priority:
      1. PROJECT_ROOT env var (set on Railway/Docker)
      2. Walk up from this file looking for marker files (main.py, requirements.txt)
      3. Fallback: 3 levels up (local dev: backend/engine/config.py → project root)

    WHY: On Railway, root directory = backend/, so this file is at /app/engine/config.py.
    Going up 3 levels would give '/' (filesystem root) which is not writable.
    We use marker file detection instead to find the correct root.
    """
    env_root = os.getenv("PROJECT_ROOT")
    if env_root:
        return Path(env_root).resolve()

    # Walk up from this file looking for a marker directory
    candidate = Path(__file__).resolve().parent
    for _ in range(5):
        # On Railway: /app has main.py and requirements.txt
        # Locally: /home/z/my-project/ has both backend/ and frontend/
        if (candidate / "main.py").exists() or (candidate / "requirements.txt").exists():
            return candidate
        candidate = candidate.parent

    # Fallback: 3 levels up (local dev structure)
    return Path(__file__).resolve().parent.parent.parent

_PROJECT_ROOT = _detect_project_root()

# ============================================================================
# 1. TRADING CAPITAL & RISK MANAGEMENT
# ============================================================================
# These are the MOST IMPORTANT settings — they control how much money you
# risk and how the strategy manages your capital. Get these wrong and
# even a good strategy will lose money.
# ============================================================================

# --- Starting Capital ---
# DEFAULT:   50000
# SUGGESTED: 50000 (for options), 100000+ (for futures)
# WHY: This is the amount of money you start with on Day 1.
#      With 50,000 rupees, you can trade 1-2 lots of BankNifty options.
#      Futures require more margin (around 1.5 lakh per lot).
# EXAMPLE: If you set 100000, you can trade 2-3 lots instead of 1.
STARTING_CAPITAL = 50000

# --- Daily Maximum Risk Percentage ---
# DEFAULT:   6.0
# SUGGESTED: 6.0 (aggressive), 3.0 (conservative), 4.0 (balanced)
# WHY: This is the maximum percentage of your capital you can lose in a
#      single day. If your daily losses reach this limit, the strategy
#      stops taking new trades for the rest of that day.
#      Example: 6% of 50,000 = 3,000 rupees max daily loss.
#      Higher values = more aggressive but riskier.
# EXAMPLE: Setting 3% means max daily loss = 1,500 rupees. Safer but
#          fewer trading opportunities on volatile days.
DAILY_RISK_PCT = 6.0

# --- Maximum Simultaneous Positions ---
# DEFAULT:   2
# SUGGESTED: 2 (recommended), 1 (very safe), 3 (aggressive)
# WHY: How many trades can be open at the same time.
#      2 positions means you can have one BankNifty trade and one Nifty
#      trade running at the same time.
#      More positions = more diversification but also more risk.
# EXAMPLE: With 1 position, you can only be in one trade at a time.
#          Safer, but you might miss profitable setups.
MAX_OPEN_POSITIONS = 2

# --- Maximum Daily Trades ---
# DEFAULT:   4
# SUGGESTED: 4 (recommended), 2 (conservative), 6 (aggressive)
# WHY: Maximum number of NEW entries allowed per day. This is DIFFERENT
#      from max open positions. You could have 2 open positions and
#      enter 4 trades total (2 opened, 2 closed, then 2 more opened).
#      This prevents overtrading on volatile days.
# EXAMPLE: With 2 max daily trades, you're very selective. With 6, you
#          might overtrade and rack up transaction costs.
MAX_DAILY_TRADES = 4

# --- Risk Per Position Limit ---
# DEFAULT:   None (OFF / No limit)
# SUGGESTED: None for this strategy, or 3.0 for extra safety
# WHY: This would limit how much you risk on each individual trade as a
#      percentage of capital. In this strategy, we set it to None (off)
#      because position sizing is already controlled by the capital-based
#      lot calculation and MAX_CAPITAL_PER_POSITION_PCT.
#      If you want per-trade limits, set to a percentage like 3.0.
# EXAMPLE: RISK_PER_POSITION_PCT = 3.0 means max 1,500 rupees risk per
#          trade (3% of 50,000). This might be too tight for options.
RISK_PER_POSITION_PCT = None  # OFF — no per-position risk limit

# --- Drawdown Circuit Breaker Percentage ---
# DEFAULT:   0.80 (20% drawdown from peak)
# SUGGESTED: 0.80 (standard), 0.85 (conservative), 0.70 (aggressive)
# WHY: When your capital falls below this fraction of your peak capital,
#      the strategy reduces position sizes to protect remaining capital.
#      Think of it as a "slow down" signal when things go wrong.
#      At 0.80: If peak was 60K and you drop to 48K (20% DD), sizes shrink.
# EXAMPLE: DRAWDOWN_CIRCUIT_BREAKER = 0.85 means the strategy slows down
#          after a 15% drawdown (more protective). 0.70 means it keeps
#          trading at full size until a 30% drawdown (riskier).
DRAWDOWN_CIRCUIT_BREAKER = 0.80

# --- Capital Floor Percentage ---
# DEFAULT:   0.20 (20% of starting capital)
# SUGGESTED: 0.20 (standard), 0.30 (conservative), 0.10 (aggressive)
# WHY: The minimum capital level before the strategy STOPS trading entirely.
#      Below this, you've lost so much that continuing is dangerous.
#      At 0.20 with 50K start: stops trading if capital falls below 10K.
# EXAMPLE: CAPITAL_FLOOR_PCT = 0.30 means stop at 15K (30% of 50K).
#          More conservative — saves more capital but exits earlier.
CAPITAL_FLOOR_PCT = 0.20

# --- Peak Capital Tracking ---
# DEFAULT:   True
# SUGGESTED: True (always keep on)
# WHY: When True, we track the highest capital ever reached (peak) and
#      use it for drawdown calculations. This is more accurate than
#      comparing to starting_capital because your capital may have grown.
#      BUG FIX: v8.4 compared to starting_capital, which was wrong after
#      the account had grown. Now we compare to peak.
# EXAMPLE: If you started at 50K, grew to 60K, then dropped to 55K:
#          - With peak tracking: drawdown = 55K/60K = 91.7% of peak (8.3% DD)
#          - Without: drawdown = 55K/50K = 110% of start (no DD detected!)
PEAK_CAPITAL_TRACKING = True


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
# EXAMPLE: Setting 9:30 means you skip the first 15 minutes. More
#          conservative but you might miss opening range breakouts.
NO_TRADE_END_HOUR = 9
NO_TRADE_END_MINUTE = 20

# --- Entry Cutoff Time ---
# DEFAULT:   2:15 PM
# SUGGESTED: 2:15 PM (standard), 1:30 PM (very conservative)
# WHY: We stop taking NEW trades after 2:15 PM because:
#      1. European markets open around this time, causing volatility
#      2. We need time for existing trades to reach their targets
#      3. Late-day trades have less time to work out
# EXAMPLE: Setting 1:30 PM means fewer trades but less afternoon risk.
ENTRY_CUTOFF_HOUR = 14
ENTRY_CUTOFF_MINUTE = 15

# --- Force Close Time ---
# DEFAULT:   3:10 PM
# SUGGESTED: 3:10 PM (20 min before close)
# WHY: All open positions are forcefully closed at this time.
#      This ensures we are never holding positions into the close,
#      which can be dangerous due to last-minute volatility.
# EXAMPLE: Setting 3:20 PM gives positions more time but risks
#          getting stuck in the closing auction.
FORCE_CLOSE_HOUR = 15
FORCE_CLOSE_MINUTE = 10


# ============================================================================
# 3. INSTRUMENT SETTINGS — WHAT TO TRADE
# ============================================================================
# The strategy trades index options on Nifty and BankNifty.
# ============================================================================

# --- Lot Sizes ---
# WHY: Each index has a fixed lot size set by the exchange.
#      These are NOT configurable — they are set by NSE.
BANKNIFTY_LOT_SIZE = 30
NIFTY_LOT_SIZE = 65

# --- Strike Step ---
# WHY: BankNifty options have strikes every 100 points.
#      Nifty options have strikes every 50 points.
BANKNIFTY_STRIKE_STEP = 100
NIFTY_STRIKE_STEP = 50

# --- Kite API Instrument Tokens ---
# WHY: Each instrument on Zerodha's Kite API has a unique numeric token.
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
# SUGGESTED: 20 (standard), 10 (fast), 50 (slow)
# WHY: We use a 20-period EMA to determine the trend.
#      - Lower (e.g., 10): Faster signals, more false signals
#      - Higher (e.g., 50): Slower signals, fewer false signals
# EXAMPLE: BIAS_EMA_PERIOD = 10 catches trends earlier but you'll get
#          more whipsaws in choppy markets.
BIAS_EMA_PERIOD = 20

# --- ATR Period for Bias ---
# DEFAULT:   14
# SUGGESTED: 14 (industry standard)
# WHY: Standard ATR period. 14 has been used worldwide since 1978.
BIAS_ATR_PERIOD = 14

# --- Structure Lookback ---
# DEFAULT:   20
# SUGGESTED: 20 (balanced)
# WHY: How many candles to look back when detecting market structure.
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
# EXAMPLE: SL_ATR_MULTIPLIER = 1.5 with ATR=150 means SL is 225 points
#          away from entry. Tighter, but might get stopped out by noise.
SL_ATR_MULTIPLIER = 2.0

# --- Minimum Risk-Reward Ratio ---
# DEFAULT:   1.5
# SUGGESTED: 1.5 (balanced), 2.0 (aggressive), 1.0 (conservative)
# WHY: We only take trades where the potential reward is at least
#      1.5 times the risk. Example: Risk 100 rupees to make 150 rupees.
# EXAMPLE: MIN_RISK_REWARD_RATIO = 2.0 means fewer trades but higher
#          quality — each winner makes at least 2x what each loser loses.
MIN_RISK_REWARD_RATIO = 1.5

# --- Minimum Target Distance (in ATR) ---
# DEFAULT:   1.5
# SUGGESTED: 1.5
# WHY: The minimum distance from entry to target, measured in ATR.
MIN_TARGET_ATR = 1.5

# --- Minimum Candle Body Size (in ATR) ---
# DEFAULT:   0.3
# SUGGESTED: 0.3
# WHY: We only take signals from candles with a body size of at least
#      0.3 x ATR. This filters out tiny "doji" candles.
MIN_BODY_ATR = 0.3

# --- EMA Buffer (in ATR) ---
# DEFAULT:   0.1
# SUGGESTED: 0.1
# WHY: Price must cross ABOVE the EMA + buffer for a LONG signal.
#      This small buffer prevents false signals at the EMA boundary.
EMA_BUFFER_ATR = 0.1


# ============================================================================
# 5b. POSITION MANAGEMENT — HOW OPEN TRADES ARE MANAGED
# ============================================================================
# These control what happens AFTER you enter a trade: when to trail stops,
# when to move to breakeven, and when to exit for non-SL/TGT reasons.
# ============================================================================

# --- Breakeven Trigger (in multiples of risk) ---
# DEFAULT:   1.0
# SUGGESTED: 1.0 (standard), 0.5 (quick BE), 1.5 (let it run more)
# WHY: When a trade moves in your favor by this many times your initial risk,
#      we move the stop loss to breakeven (entry price + small buffer).
#      This locks in a "free trade" — you can't lose on this position anymore.
# EXAMPLE: BE_TRIGGER_RISK_MULT = 1.0 with risk of 200 points means:
#          When profit reaches 200 points, SL moves to entry price + 1.
#          If you set 0.5, you move to BE at 100 points profit (faster but
#          might get stopped out before the real move starts).
BE_TRIGGER_RISK_MULT = 1.0

# --- Trailing Stop Enabled ---
# DEFAULT:   True
# SUGGESTED: True (always), False (use fixed stop only)
# WHY: When True, the stop loss is trailed (moved in your favor) as the
#      trade progresses. This locks in more profit as the trade moves.
#      When False, the stop loss stays at its original level.
# EXAMPLE: TRAILING_STOP_ENABLED = False means once you enter, your SL
#          never moves. Simpler but less profit on winning trades.
TRAILING_STOP_ENABLED = True

# --- Trailing Stop Frequency (every N candles) ---
# DEFAULT:   3
# SUGGESTED: 3 (balanced), 2 (responsive), 5 (relaxed)
# WHY: How often (in candles) to check if the trailing stop should be moved.
#      Every 3 candles means we update the trail roughly every 45 minutes
#      on a 15m timeframe.
# EXAMPLE: TRAIL_EVERY_N_CANDLES = 1 means trail every candle (very active,
#          may whipsaw). 5 means check less often (simpler, less noise).
TRAIL_EVERY_N_CANDLES = 3

# --- Bias Flip Exit: Minimum Candles Held ---
# DEFAULT:   6
# SUGGESTED: 6 (standard), 10 (patient), 3 (quick exit)
# WHY: If the market direction flips (e.g., BULLISH → BEARISH), we exit
#      the position — BUT only if we've held it for at least this many
#      candles. This prevents premature exits on brief bias wiggles.
# EXAMPLE: BIAS_FLIP_MIN_HELD = 3 means exit very quickly on a bias flip.
#          10 means give the trade more time before believing the flip.
BIAS_FLIP_MIN_HELD = 6

# --- Near Target Threshold (in ATR) ---
# DEFAULT:   0.01 (1% of ATR — very close to target)
# SUGGESTED: 0.01 (standard), 0.02 (wider), 0.005 (tighter)
# WHY: If price gets within this fraction of ATR from the target AND the
#      candle is profitable, we close the position to lock in gains.
#      For BankNifty ATR=265, 0.01*265 ≈ 2.65 points from target.
# EXAMPLE: NEAR_TARGET_ATR = 0.02 means close within 5.3 points of target
#          (wider capture zone, more exits at "near target").
NEAR_TARGET_ATR = 0.01

# --- Time Exit: Maximum Hours in Trade ---
# DEFAULT:   6.0 (one trading day worth of hours)
# SUGGESTED: 6.0 (standard), 4.0 (intraday scalper), 8.0 (patient)
# WHY: Maximum time (in hours) to hold a position before force-closing.
#      Indian market has 6.25 trading hours (9:15 to 3:30). If a trade
#      hasn't hit SL or target in 6 hours, it's probably not working.
# EXAMPLE: MAX_TRADE_HOURS = 4.0 means close trades after 4 hours even
#          if SL/TGT not hit. Good for quick scalps on 5m timeframe.
MAX_TRADE_HOURS = 6.0


# ============================================================================
# 6. OPTIONS PRICING — BLACK-SCHOLES MODEL
# ============================================================================

# --- Risk-Free Interest Rate ---
# DEFAULT:   0.07 (7%)
# SUGGESTED: 0.07
# WHY: India's risk-free rate (approximately the 10-year government bond yield).
RISK_FREE_RATE = 0.07

# --- IV-VIX Spread ---
# WHY: BankNifty IV is typically VIX + 4 points. Nifty IV ≈ VIX + 1.5 points.
BN_IV_VIX_SPREAD = 4.0
NF_IV_VIX_SPREAD = 1.5

# --- IV Adjustment Factor ---
# DEFAULT:   1.0
# SUGGESTED: 1.0 (normal), 1.1 (conservative — 10% higher IV)
# WHY: A multiplier applied to the estimated IV. Set to 1.0 for normal.
# EXAMPLE: IV_ADJUSTMENT = 1.1 means we assume 10% higher IV than estimated,
#          making options more expensive in our model = more conservative.
IV_ADJUSTMENT = 1.0


# ============================================================================
# 7. OPTIONS MONEYNESS — WHICH OPTIONS TO TRADE
# ============================================================================

# DEFAULT:   "ITM"
# SUGGESTED: "ITM" (based on backtesting)
# WHY: Our backtesting shows ITM options perform best because:
#      1. Higher delta means they move more with the index
#      2. Less theta decay eats into profits
#      3. Still affordable with 50K capital
# EXAMPLE: OPTION_MONEYNESS = "ATM" → cheaper options, more leverage,
#          but more time decay. "DEEP_ITM" → very expensive, moves like futures.
OPTION_MONEYNESS = "ITM"  # Options: "ATM", "ITM", or "DEEP_ITM"

# --- Spread Regime ---
# DEFAULT:   "auto"
# SUGGESTED: "auto"
# WHY: "auto" selects spread regime based on VIX level.
#      ALWAYS use "auto" unless you have a specific reason.
SPREAD_REGIME = "auto"


# ============================================================================
# 8. POSITION SIZING — HOW MANY LOTS TO TRADE
# ============================================================================

# --- Maximum Capital Per Position ---
# DEFAULT:   0.40 (40%)
# SUGGESTED: 0.40 (balanced), 0.30 (conservative), 0.50 (aggressive)
# WHY: We allocate at most 40% of current capital to any single position.
#      With 50K capital and 40%: max 20,000 rupees per position.
# EXAMPLE: 0.30 means max 15,000 per position. Safer but fewer lots.
MAX_CAPITAL_PER_POSITION_PCT = 0.40

# --- Maximum Number of Lots ---
# DEFAULT:   3
# SUGGESTED: 3
# WHY: Hard cap on the number of lots regardless of capital.
MAX_LOTS = 3


# ============================================================================
# 9. TIMEFRAME CONFIGURATION
# ============================================================================
# The strategy uses TWO timeframes:
#   1. ENTRY TIMEFRAME: Where we look for trade signals (crossover patterns)
#   2. BIAS TIMEFRAME: Where we determine the market direction (trend)
#
# Common combinations:
#   Entry 15m x Bias 60m  — RECOMMENDED (best backtest results)
#   Entry 5m  x Bias 15m  — Fast signals, more noise
#   Entry 15m x Bias 15m  — Same TF, medium
#   Entry 5m  x Bias 60m  — Fast entry, slow bias
# ============================================================================

# DEFAULT (recommended based on backtesting):
# EXAMPLE: ENTRY_TIMEFRAME = "5m" gives faster signals but more false signals.
#          Stick with 15m unless you have a specific reason.
ENTRY_TIMEFRAME = "15m"
BIAS_TIMEFRAME = "60m"

# --- Index to Trade ---
# DEFAULT:   "BANKNIFTY"
# SUGGESTED: "BANKNIFTY" (higher beta, more profit potential)
# WHY: Backtesting shows BankNifty outperforms Nifty for this strategy.
# EXAMPLE: TRADE_INDEX = "NIFTY" → less volatile, smaller moves.
TRADE_INDEX = "BANKNIFTY"  # "BANKNIFTY" or "NIFTY"


# ============================================================================
# 10. PAPER TRADING SPECIFIC SETTINGS
# ============================================================================
# These settings control the live paper trading engine.
# ============================================================================

# --- Paper Trading Master Switch ---
# DEFAULT:   True
# SUGGESTED: True (for paper trading), False (for backtesting only)
# WHY: When True, the system runs in paper trading mode with real data.
#      When False, only backtesting is available.
PAPER_TRADING_ENABLED = True

# --- Polling Interval (seconds) ---
# DEFAULT:   5
# SUGGESTED: 5 (balanced), 3 (responsive), 10 (battery saver)
# WHY: How often (in seconds) to check for new candle data from Kite API.
#      5 seconds is a good balance between responsiveness and API rate limits.
# EXAMPLE: POLL_INTERVAL_SECONDS = 3 means faster response but more API calls.
#          Kite allows ~3 requests/second, so 3 seconds is safe.
POLL_INTERVAL_SECONDS = 5

# --- Warmup Days (Historical Data Preload) ---
# DEFAULT:   30
# SUGGESTED: 30 (standard), 15 (faster startup), 60 (more data)
# WHY: When the paper trader starts, it needs enough historical candles
#      to "warm up" the indicators (EMA needs ~20 candles, ATR needs ~15).
#      30 days ensures we have plenty of data even with missing trading days.
#      Without warmup, the first 1-2 hours produce no signals (dangerous!).
# EXAMPLE: WARMUP_DAYS = 7 might not have enough candles for 60m bias TF.
#          60 days is safer but takes longer to download at startup.
WARMUP_DAYS = 30

# --- Real-time VIX Refresh (seconds) ---
# DEFAULT:   300 (5 minutes)
# SUGGESTED: 300 (standard), 120 (responsive), 600 (less API calls)
# WHY: For live trading, we periodically fetch the current India VIX value
#      from the API instead of relying on the static JSON file. This gives
#      much more accurate IV estimation for options pricing.
# EXAMPLE: VIX_REFRESH_SECONDS = 120 means we update VIX every 2 minutes.
#          600 = every 10 minutes (less API usage but slightly stale IV).
VIX_REFRESH_SECONDS = 300

# --- Use WebSocket for Real-Time Data ---
# DEFAULT:   False (use REST polling — more reliable)
# SUGGESTED: False (recommended), True (for advanced users)
# WHY: WebSocket gives true real-time data but is complex to manage.
#      REST polling is simpler, more reliable, and sufficient for 15m candles.
#      The strategy only acts on completed candles, so sub-second data isn't needed.
# EXAMPLE: USE_WEBSOCKET = True requires the `kiteconnect` ticker module
#          and a stable internet connection. Use only if you know what you're doing.
USE_WEBSOCKET = False


# ============================================================================
# 11. TRADE LOGGING & NOTIFICATIONS
# ============================================================================

# --- Trade Log File (JSON) ---
# WHY: Complete record of all paper trades in JSON format for analysis.
TRADE_LOG_FILE = os.getenv("TRADE_LOG_FILE", str(_PROJECT_ROOT / "logs" / "trades_log.json"))

# --- Trade Log File (CSV) ---
# WHY: CSV format for easy import into Excel/Google Sheets.
TRADE_LOG_CSV = os.getenv("TRADE_LOG_CSV", str(_PROJECT_ROOT / "logs" / "trades_log.csv"))

# --- Session State File ---
# WHY: Saves current positions and state so we can resume after restart.
#      If the script crashes or you stop it, you can restart and it picks
#      up where it left off.
SESSION_STATE_FILE = os.getenv("SESSION_STATE_FILE", str(_PROJECT_ROOT / "sessions" / "session_state.json"))

# --- Log Level ---
# DEFAULT:   "INFO"
# SUGGESTED: "INFO" (normal), "DEBUG" (verbose — see every candle), "WARNING" (quiet)
# WHY: Controls how much information is printed to the console.
# EXAMPLE: LOG_LEVEL = "DEBUG" shows every candle processed, every bias check.
#          Useful for debugging but very noisy during normal trading.
LOG_LEVEL = "INFO"

# --- Notify on Trade ---
# DEFAULT:   True
# WHY: Print a prominent alert when a trade enters or exits.
# EXAMPLE: NOTIFY_ON_TRADE = False → silent mode, only logs to file.
NOTIFY_ON_TRADE = True

# --- Notify on Daily Limit ---
# DEFAULT:   True
# WHY: Alert when daily risk limit is hit (no more trading today).
NOTIFY_ON_DAILY_LIMIT = True

# --- Notify on Bias Change ---
# DEFAULT:   True
# WHY: Alert when market direction changes (e.g., BULLISH → BEARISH).
NOTIFY_ON_BIAS_CHANGE = True


# ============================================================================
# 12. BACKTEST PERIOD (for run_backtest.py only)
# ============================================================================

TEST_START_YEAR = 2025
TEST_START_MONTH = 11
TEST_START_DAY = 1

TEST_END_YEAR = 2026
TEST_END_MONTH = 4
TEST_END_DAY = 25


# ============================================================================
# 13. KITE API CREDENTIALS
# ============================================================================
# You MUST have a Zerodha account with Kite Connect API enabled.
# Sign up at: https://kite.trade
# ============================================================================

# --- API Key ---
# WHY: Your Kite API key from Zerodha.
#      MUST be set via environment variable KITE_API_KEY.
#      No hardcoded fallback — secrets should NEVER be in source code.
#      Set it in .env (local) or Railway Environment Variables (production).
KITE_API_KEY = os.getenv("KITE_API_KEY", "")

# --- API Secret ---
# WHY: Your API secret from Zerodha. NEVER share this publicly.
#      MUST be set via environment variable KITE_API_SECRET.
#      No hardcoded fallback — secrets should NEVER be in source code.
KITE_API_SECRET = os.getenv("KITE_API_SECRET", "")

# --- Token File Path ---
# WHY: Where to store the access token after login.
#      The token is valid for one day and auto-refreshes.
#      Derived from project root — no hardcoded paths.
KITE_TOKEN_FILE = os.getenv("KITE_TOKEN_FILE", str(_PROJECT_ROOT / "kite_access_token.txt"))


# ============================================================================
# 14. DATA CACHE DIRECTORY
# ============================================================================
# WHY: Historical data is cached locally to avoid re-downloading.
CACHE_DIR = os.getenv("CACHE_DIR", str(_PROJECT_ROOT / "kite_cache_v10"))


# ============================================================================
# SUMMARY OF RECOMMENDED SETTINGS FOR DIFFERENT RISK PROFILES
# ============================================================================
#
# ┌─────────────────────┬──────────────┬──────────────┬──────────────┐
# │ Parameter           │ Conservative │ Balanced     │ Aggressive   │
# ├─────────────────────┼──────────────┼──────────────┼──────────────┤
# │ STARTING_CAPITAL    │ 50000        │ 50000        │ 50000        │
# │ DAILY_RISK_PCT      │ 3.0          │ 6.0          │ 8.0          │
# │ MAX_OPEN_POSITIONS  │ 1            │ 2            │ 3            │
# │ MAX_DAILY_TRADES    │ 2            │ 4            │ 6            │
# │ SL_ATR_MULTIPLIER   │ 2.5          │ 2.0          │ 1.5          │
# │ MIN_RISK_REWARD     │ 2.0          │ 1.5          │ 1.0          │
# │ OPTION_MONEYNESS    │ DEEP_ITM     │ ITM          │ ATM          │
# │ ENTRY_TIMEFRAME     │ 15m          │ 15m          │ 5m           │
# │ BIAS_TIMEFRAME      │ 60m          │ 60m          │ 15m          │
# │ MAX_CAP_PER_POS_PCT │ 0.30         │ 0.40         │ 0.50         │
# │ DD_CIRCUIT_BREAKER  │ 0.85         │ 0.80         │ 0.70         │
# │ CAPITAL_FLOOR_PCT   │ 0.30         │ 0.20         │ 0.10         │
# │ BE_TRIGGER_RISK_MULT│ 0.5          │ 1.0          │ 1.5          │
# │ TRAILING_STOP       │ True         │ True         │ True         │
# │ MAX_TRADE_HOURS     │ 4.0          │ 6.0          │ 8.0          │
# └─────────────────────┴──────────────┴──────────────┴──────────────┘
#
# The "Balanced" profile gave the best risk-adjusted returns in our 6-month
# backtest. Start there and adjust based on your comfort level.
# ============================================================================
