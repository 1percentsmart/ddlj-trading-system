# DDLJ v8.4 — Quick Start Guide

## Step-by-Step: From Zero to Running Your First Backtest

This guide assumes you have ZERO experience with this code. Follow each step in order.

---

## Step 1: Install Python (5 minutes)

You need Python 3.10 or newer. Check if you already have it:

```bash
python --version
# Should show: Python 3.10.x or higher
```

If not installed, download from: https://www.python.org/downloads/

---

## Step 2: Install Required Packages (2 minutes)

Open a terminal and run:

```bash
pip install kiteconnect pandas numpy pytz
```

This installs:
- `kiteconnect` — Zerodha's official Python library for market data
- `pandas` — Data manipulation (not strictly required but useful)
- `numpy` — Mathematical calculations
- `pytz` — Timezone handling (Indian markets use IST)

---

## Step 3: Get a Zerodha Kite API Account (10 minutes)

1. Go to **https://kite.trade**
2. Sign in with your Zerodha account (or create one)
3. Click **"Create New App"**
4. Fill in the details:
   - App Name: `DDLJ Backtest` (or anything you like)
   - Redirect URL: `https://127.0.0.0` (doesn't matter for backtesting)
   - Description: `Backtesting strategy`
5. After creating, you'll see:
   - **API Key** — looks like: `cjzjv3v9y3lox6mh`
   - **API Secret** — looks like: `xp0gjrwdojz064o45ehinu9ar2hszb49`

**IMPORTANT:** Keep your API Secret safe. Never share it publicly or commit it to GitHub.

---

## Step 4: Configure the Strategy (5 minutes)

Open the file `config.py` in any text editor. Find the KITE API section and fill in:

```python
# Replace with YOUR values from Step 3
KITE_API_KEY = "your_api_key_here"
KITE_API_SECRET = "your_api_secret_here"
```

Review other settings if you want to customize:
- `STARTING_CAPITAL` — Default: 50000 (rupees)
- `DAILY_RISK_PCT` — Default: 6.0 (percent)
- `OPTION_MONEYNESS` — Default: "ITM" (recommended)
- `ENTRY_TIMEFRAME` — Default: "15m" (recommended)

**For your first run, leave everything at defaults.**

---

## Step 5: Generate Access Token (2 minutes)

The Kite API requires a daily access token. Here's how to get one:

### Step 5a: Get the Login URL

Open Python in your terminal:

```bash
cd /path/to/ddlj_v84_strategy
python
```

Then run:

```python
from token_manager import get_login_url
print(get_login_url())
```

This prints a URL like:
```
https://kite.trade/connect/login?api_key=cjzjv3v9y3lox6mh&v=3
```

### Step 5b: Visit the URL in Your Browser

1. Copy the URL
2. Paste it into your browser
3. Log in with your Zerodha credentials
4. Approve the connection
5. After approval, your browser redirects to a URL that looks like:
   ```
   https://127.0.0.0?request_token=PG7se3f76JtZRgcEEIywe1LKQe8W92Np&action=...
   ```
6. Copy the `request_token` value (the part between `=` and `&`)

### Step 5c: Exchange for Access Token

Back in your Python session:

```python
from token_manager import exchange_request_token
kite = exchange_request_token("paste_your_request_token_here")
```

If successful, you'll see:
```
Token exchange successful.
Access token saved to kite_access_token.txt
Authenticated as Your Name (your@email.com)
```

**The access token is valid for one day.** If it expires, repeat Steps 5a-5c.

---

## Step 6: Run the Backtest (5-30 minutes depending on data)

```bash
cd /path/to/ddlj_v84_strategy
python run_backtest.py
```

### What Happens When You Run It:

1. **Loading Data** — The script fetches historical candle data from Kite API
   - BankNifty 15-minute and 60-minute candles
   - Nifty 15-minute and 60-minute candles
   - India VIX daily data
   - Data is cached locally, so subsequent runs are much faster

2. **Running Backtests** — For each configuration:
   - Method A: Capital compounding across 6 months
   - Method B: Monthly batches with Rs 50K starting capital each month

3. **Saving Results** — Results are written to `backtest_results_v84.json`

### Expected Output:

```
================================================================
  DDLJ v8.4 BACKTEST ENGINE — Production (Bug-Fixed)
================================================================
  Starting Capital:  Rs 50,000
  Daily Risk Limit:  6.0%
  Max Positions:     2
  Test Period:       Nov 2025 — Apr 2026 (6 months)
================================================================

Loading data...
  BankNifty 15m: 1,245 candles loaded
  BankNifty 60m: 312 candles loaded
  Nifty 15m: 1,198 candles loaded
  Nifty 60m: 300 candles loaded
  India VIX: 117 trading days loaded

Running Method A (Capital Compounding)...
  BN 15mx60m SL2.0 RR1.5 ITM ... 145 trades, Net: Rs +31,199 (+62.4%)
  BN 15mx60m SL2.0 RR1.5 ATM ... 145 trades, Net: Rs -21,141 (-42.3%)
  ...

Running Method B (Monthly Batches)...
  BN 15mx15m SL2.0 RR1.5 ITM:
    Nov: -2,916 | Dec: -2,874 | Jan: -3,465 | Feb: -294 | Total: -31.9%
  ...

================================================================
  TOP 10 CONFIGURATIONS (Method A)
================================================================
  #1  BN 15mx60m SL2.0 RR1.5 ITM  | +62.4%  | 145 trades | WR 31.7%
  #2  BN 15mx15m SL2.0 RR1.5 ATM  | -42.3%  | 336 trades | WR 19.9%
  ...

Results saved to: backtest_results_v84.json
```

---

## Step 7: Understand the Results

### Key Metrics to Look At

| Metric | What It Means | Good Value |
|--------|---------------|------------|
| Net P&L % | Total profit/loss as % of starting capital | Positive |
| Win Rate | % of trades that were profitable | > 35% |
| Profit Factor | Total profits / Total losses | > 1.5 |
| Max Drawdown | Largest peak-to-trough decline | < 30% |
| Avg Daily P&L | Average profit/loss per trading day | Positive |
| Sharpe Ratio | Risk-adjusted return | > 1.0 |

### Reading the JSON Results

Open `backtest_results_v84.json` in any text editor. Key sections:

```json
{
  "method_a_compounding": {
    "BN_15mx60m_sl2.0_RR1.5_ITM": {
      "total_trades": 145,        // Number of trades taken
      "wins": 46,                  // Winning trades
      "losses": 99,                // Losing trades
      "win_rate": 31.72,           // % of trades that won
      "net_pnl": -30934.25,       // Net profit/loss in rupees
      "net_pnl_pct": -61.87,      // Net P&L as % of capital
      "profit_factor": 0.24,      // Gross profit / Gross loss
      "max_dd_pct": 62.37,        // Maximum drawdown %
      "monthly_pnl": {            // Month-by-month breakdown
        "2025-11": -5311.44,
        "2025-12": -3698.88,
        ...
      }
    }
  },
  "method_b_monthly": {
    // Same structure but with monthly reset
  }
}
```

---

## Step 8: Customize and Experiment

Now that you understand the basics, try changing settings:

### Experiment 1: Change the Timeframe

In `config.py`:
```python
# Try 5-minute entry instead of 15-minute
ENTRY_TIMEFRAME = "5m"
BIAS_TIMEFRAME = "15m"
```

### Experiment 2: Change the Stop Loss

```python
# Try a tighter stop loss
SL_ATR_MULTIPLIER = 1.5  # was 2.0

# Or a wider one
SL_ATR_MULTIPLIER = 2.5
```

### Experiment 3: Change the Option Type

```python
# Try At-The-Money options (cheaper, more leverage)
OPTION_MONEYNESS = "ATM"

# Or Deep In-The-Money (more expensive, less leverage)
OPTION_MONEYNESS = "DEEP_ITM"
```

### Experiment 4: Reduce Risk

```python
# More conservative daily risk limit
DAILY_RISK_PCT = 3.0  # was 6.0

# Only one position at a time
MAX_OPEN_POSITIONS = 1  # was 2
```

---

## Troubleshooting

### Problem: "Token is invalid/expired"
**Solution:** The access token expires daily. Repeat Step 5 to get a new one.

### Problem: "API error: Too many requests"
**Solution:** The Kite API has rate limits (3 requests per second). The code handles this automatically, but if you see this error, just wait a few seconds and try again.

### Problem: "No data found for token XXXXX"
**Solution:** The instrument token may have changed (they change monthly for futures). Check the latest tokens at https://kite.trade/docs/connect/v3/

### Problem: "Not enough candles for ATR"
**Solution:** This is normal for the first few candles of each session. The engine skips these automatically.

### Problem: All results are negative
**Solution:** This is normal for many configurations! Our backtesting shows that most configurations lose money. Only specific combinations (BankNifty + 15m entry + ITM options + SL2.0 + RR1.5) are profitable. Check the TOP 10 list in the output.

---

## Data Management

### Where Is Data Stored?

Historical candle data is cached in the `kite_cache_v10/` directory. Each file contains one chunk of data:

```
kite_cache_v10/
├── 260105_15minute_2025-11-01_2025-12-31.json   # BankNifty 15m
├── 260105_60minute_2025-11-01_2026-04-30.json   # BankNifty 60m
├── 256265_15minute_2025-11-01_2025-12-31.json   # Nifty 15m
├── 264969_day_2025-11-01_2026-04-30.json        # India VIX daily
└── ... (more chunks)
```

### How Much Disk Space?

- Each month of 15m data ≈ 200 KB
- Each month of 5m data ≈ 600 KB
- Each month of 1m data ≈ 3 MB
- Total for 6 months, all timeframes ≈ 50 MB

### Can I Delete the Cache?

Yes! The cache is just for speed. If you delete it, the script will re-fetch from the API (slower but works fine).

---

## Understanding the Code Structure

If you want to read or modify the code, start here:

1. **`config.py`** — Read this FIRST. Every parameter is documented with DEFAULT, SUGGESTED, and WHY.

2. **`run_backtest.py`** — The main entry point. Shows how all the pieces fit together.

3. **`bias_engine.py`** — How we decide if the market is BULLISH or BEARISH. Simple and well-commented.

4. **`signal_engine.py`** — How we generate LONG/SHORT signals. Also straightforward.

5. **`black_scholes.py`** — The math behind options pricing. Heavy math but well-commented.

6. **`options_engine.py`** — The most complex module. Combines BS pricing, IV estimation, spread modeling.

7. **`backtester.py`** — The core engine. Well-commented with the BUG FIX documentation.

---

## Next Steps

- Read the full `README.md` for detailed strategy explanation
- Modify `config.py` to test different parameters
- Compare Method A vs Method B results to understand consistency
- Focus on BankNifty + 15m + ITM + SL2.0 + RR1.5 as the baseline
