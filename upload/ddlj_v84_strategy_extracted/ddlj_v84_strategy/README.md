# DDLJ v8.4 — Options Backtesting Strategy

## What Is This?

DDLJ (Dilwale Dulhania Le Jayenge — "The Brave-Hearted Will Take the Bride") is an **options backtesting strategy** for Indian stock markets. It tests a specific trading approach on **BankNifty** and **Nifty** index options using historical data from Zerodha's Kite API.

**In simple words:** This code answers the question — *"If I had followed this trading strategy over the past 6 months, would I have made money?"*

---

## Strategy Explained Simply

### The Core Idea

1. **Find the Trend (Bias Engine):** We look at a higher timeframe (like 1-hour or 15-minute charts) and determine whether the market is going UP (BULLISH) or DOWN (BEARISH). We use the 20 EMA (Exponential Moving Average) and price structure (Higher Highs, Lower Lows) to decide this.

2. **Find the Entry (Signal Engine):** On a lower timeframe (like 15-minute or 5-minute charts), we wait for the price to cross above the 20 EMA in a BULLISH market (for a LONG trade) or below the 20 EMA in a BEARISH market (for a SHORT trade). The crossover candle must have a strong body (not a tiny doji).

3. **Place the Trade (Options Engine):** Instead of trading the index directly, we buy In-The-Money (ITM) options. For a LONG trade, we buy a Call option (CE). For a SHORT trade, we buy a Put option (PE). We use the Black-Scholes formula to price the options realistically.

4. **Manage the Trade (Risk Management):** We set a Stop Loss, a Target, and use trailing stops to protect profits. If the daily loss reaches 6% of capital, we stop trading for the day. We never hold more than 2 positions at once.

### Visual Example — A LONG Trade

```
Price Chart (15-minute candles):
            ┌─── Target (swing high)
            │
     ╱╲    ╱│╲       <- Price reaches target!
    ╱  ╲  ╱ │  ╲
   ╱    ╲╱  │   ╲     <- Confirmation candle
  ╱     ╱   │    ╲       (bullish, strong body)
 ╱  ╲  ╱    │     ╲
╱    ╲╱     │      ╲
─────EMA20──┼─────── <- Price crosses above EMA
            │
     ┌──────┘
     │  Entry Point (buy Call option)
     │
     └─── Stop Loss (2x ATR below entry)
```

### Step-by-Step Trade Flow

```
Step 1: Bias Engine checks 60m chart
        → Is the market BULLISH or BEARISH?
        → If BULLISH, look for LONG signals only
        → If BEARISH, look for SHORT signals only
        → If NEUTRAL, do nothing

Step 2: Signal Engine watches 15m chart
        → Wait for price to cross above EMA (for LONG)
        → Check: Is the candle body big enough? (≥ 0.3 × ATR)
        → Check: Is the volume sufficient?
        → Check: Is price near VWAP? (not too far away)

Step 3: Options Engine calculates trade details
        → Select strike price (1 strike ITM from spot)
        → Calculate option premium using Black-Scholes
        → Get Implied Volatility from India VIX data
        → Add bid-ask spread (buy at ask price)
        → Calculate how many lots to buy (max 40% capital)

Step 4: Risk Check
        → Is daily loss < 6% of capital? If no, skip.
        → Are there < 2 open positions? If no, skip.
        → Is it between 9:20 AM and 2:15 PM? If no, skip.

Step 5: Enter Trade
        → Buy Call option (for LONG) or Put option (for SHORT)
        → Set Stop Loss = Entry - 2.0 × ATR
        → Set Target = Next swing high (for LONG)

Step 6: Manage Open Position
        → If price hits Stop Loss → EXIT (loss)
        → If price hits Target → EXIT (profit!)
        → If profit = 1× risk → Move SL to breakeven
        → Every 3 bars → Trail SL to recent swing low
        → If bias flips → EXIT (market changed direction)
        → If 3:10 PM → Force EXIT (end of day)
        → If held too long → EXIT (theta decay risk)
```

---

## Testing Methods

We test the strategy using TWO methods to get a complete picture:

### Method A: Capital Compounding

```
Month 1: Start with Rs 50,000
         → Make Rs 5,000 profit
         → End of Month 1: Rs 55,000

Month 2: Start with Rs 55,000 (compounded!)
         → Lose Rs 3,000
         → End of Month 2: Rs 52,000

...continues with whatever capital remains...
```

**What it shows:** The maximum potential if you let profits compound. But it can be misleading — one bad month can wipe out months of gains.

### Method B: Monthly Batches

```
Month 1: Start with Rs 50,000
         → Make Rs 5,000 profit → +10%

Month 2: Start with Rs 50,000 again (RESET!)
         → Lose Rs 3,000 → -6%

Month 3: Start with Rs 50,000 again
         → Make Rs 8,000 → +16%
```

**What it shows:** How consistently the strategy performs month by month. More realistic because you're not risking compounded profits.

---

## Key Results (6-Month Backtest: Nov 2025 — Apr 2026)

> **IMPORTANT:** These are backtested results. Past performance does NOT guarantee future results.

### Best Configuration Found

| Setting | Value |
|---------|-------|
| Instrument | BankNifty |
| Entry Timeframe | 15-minute |
| Bias Timeframe | 60-minute |
| Stop Loss | 2.0 × ATR |
| Risk-Reward Ratio | 1.5 minimum |
| Option Type | In-The-Money (ITM) |

### Key Findings

1. **BankNifty outperforms Nifty** — 8 out of 10 profitable configs were BankNifty
2. **15-minute entry is the only viable timeframe** — 5-minute entry produced 0 profitable configs
3. **ITM options beat ATM options** — More delta (moves more with index), less theta decay
4. **SL=2.0 RR=1.5 slightly beats SL=2.5 RR=2.0** — Tighter risk management works better
5. **Method B (monthly) is more conservative** — Typical monthly returns of 5-15% vs Method A's volatile compounding

### Bug History (Why Results Changed)

| Version | Issue | Impact |
|---------|-------|--------|
| v8.3 (old) | Capital double-counting at day boundary | Profits inflated by ~17% |
| v8.3 (old) | Simplified option pricing (not real Black-Scholes) | Profits inflated by ~95%!! |
| v8.3 (old) | ATR-based IV estimation (not real market IV) | Unrealistic option prices |
| v8.4 (current) | All bugs fixed, proper Black-Scholes + VIX IV | Realistic results |

**The v8.3 "best" result of +1,201% was WRONG. After fixes, the realistic best is around +62%.**

---

## File Structure

```
ddlj_v84_strategy/
├── __init__.py           # Package info (version 8.4.0)
├── config.py             # ALL settings with DEFAULT/SUGGESTED/WHY comments
├── indicators.py         # Technical indicators (EMA, ATR, swing points)
├── black_scholes.py      # Proper Black-Scholes options pricing engine
├── options_engine.py     # Options Signal Mimicry Engine
├── bias_engine.py        # Trend detection (BULLISH/BEARISH/NEUTRAL)
├── signal_engine.py      # Entry signal generation (EMA crossover)
├── candle_data.py        # Candle data structures and data loading
├── cost_calculator.py    # Realistic trading costs (brokerage, STT, GST)
├── trade_types.py        # Trade and OptionsFill data structures
├── backtester.py         # Core backtesting engine (BUG-FIXED)
├── analysis.py           # Results analysis and metrics
├── data_fetcher.py       # Kite API historical data fetcher
├── token_manager.py      # API authentication and token management
├── run_backtest.py       # Main entry point (run this file!)
├── README.md             # This file
├── QUICKSTART.md         # Step-by-step setup guide
└── data/
    └── india_vix_data.json  # India VIX daily data for IV estimation
```

---

## Requirements

- Python 3.10+
- Zerodha account with Kite Connect API enabled
- Required packages: `kiteconnect`, `pandas`, `numpy`, `pytz`

```bash
pip install kiteconnect pandas numpy pytz
```

---

## How to Run

### Step 1: Get Kite API Access
1. Go to https://kite.trade and create a developer account
2. Create an app and get your API Key and API Secret
3. Update `config.py` with your credentials

### Step 2: Generate Access Token
```python
from token_manager import get_login_url, exchange_request_token

# Step 2a: Visit this URL in your browser
print(get_login_url())

# Step 2b: After login, copy the request_token from the redirect URL
# Step 2c: Exchange it for an access token
kite = exchange_request_token("your_request_token_here")
```

### Step 3: Run the Backtest
```bash
cd ddlj_v84_strategy
python run_backtest.py
```

### Step 4: Check Results
Results are saved to `backtest_results_v84.json` with:
- Total trades, wins, losses, win rate
- Net P&L, profit factor, max drawdown
- Monthly breakdown
- Options-specific metrics (delta, IV, spread costs)
- Both Method A and Method B results

---

## Common Questions

### Q: Can I use this for live trading?
**A:** This is a BACKTESTING engine only. It tests strategies on historical data. It does NOT connect to live markets or place real orders. For live trading, you would need to build additional infrastructure for real-time data, order management, and risk controls.

### Q: Why are the results different from v8.3?
**A:** v8.3 had two major bugs: (1) capital was double-counted at day boundaries, inflating profits by ~17%, and (2) option pricing used a simplified approximation instead of the proper Black-Scholes formula, inflating profits by ~95%. v8.4 fixes both bugs, giving realistic results.

### Q: What is India VIX and why does it matter?
**A:** India VIX is the volatility index — it measures how much the market expects Nifty to move in the near future. When VIX is high (above 20), options are expensive. When VIX is low (below 12), options are cheap. We use real VIX data to estimate Implied Volatility, which is a key input to the Black-Scholes formula for pricing options.

### Q: Why ITM options instead of ATM or OTM?
**A:** In-The-Money options have higher delta (they move more with the underlying index), which means our directional bets pay off better. They also have less time decay (theta), so holding them for a few hours doesn't eat into profits as much. OTM options are cheap but often expire worthless.

### Q: What does "Signal Mimicry Engine" mean?
**A:** Since we don't have actual historical options prices for every strike, we "mimic" what the options price would have been using the Black-Scholes formula. We feed in the actual spot price, real IV from India VIX, and calculate what the option premium would have been. This is very close to reality but not 100% exact — real markets have supply/demand effects that the formula can't capture.

---

## Glossary

| Term | Meaning |
|------|---------|
| **ATM** | At-The-Money — option strike equals spot price |
| **ITM** | In-The-Money — option has intrinsic value |
| **OTM** | Out-of-The-Money — option has no intrinsic value |
| **EMA** | Exponential Moving Average — a trend-following indicator |
| **ATR** | Average True Range — measures volatility |
| **IV** | Implied Volatility — market's expectation of future price movement |
| **VIX** | Volatility Index — India VIX measures Nifty's expected volatility |
| **Delta** | How much the option price moves per 1-point move in the index |
| **Theta** | Time decay — how much the option loses per day as expiry approaches |
| **Gamma** | Rate of change of delta |
| **Vega** | Sensitivity of option price to changes in volatility |
| **SL** | Stop Loss — the price at which we exit a losing trade |
| **RR** | Risk-Reward ratio — how much we risk vs. how much we expect to gain |
| **DTE** | Days To Expiry — how many days until the option contract expires |
| **BankNifty** | Bank Nifty Index — index of top banking stocks in India |
| **Nifty** | Nifty 50 Index — index of top 50 companies in India |
| **PF** | Profit Factor — total profits divided by total losses |
| **WR** | Win Rate — percentage of trades that are profitable |
| **DD** | Drawdown — the peak-to-trough decline in equity |
| **Black-Scholes** | The standard mathematical formula for pricing options |
| **VWAP** | Volume-Weighted Average Price — average price weighted by volume |

---

## Disclaimer

This software is for **educational and research purposes only**. It does NOT constitute financial advice. Trading in derivatives (options, futures) involves substantial risk and may result in the loss of your entire capital. Past backtested performance does not guarantee future results. Always consult a qualified financial advisor before making investment decisions.
