#!/usr/bin/env python3
"""
DDLJ v8.4 Strategy — Transaction Cost Calculator
==================================================

This module calculates realistic trading costs for both futures and
options trades on the Indian stock market (NSE/NFO).

WHY REALISTIC COSTS?
--------------------
Many backtests use zero or minimal trading costs, which dramatically
overstates profitability. In reality, each trade incurs:
  - Brokerage fees
  - Securities Transaction Tax (STT)
  - Exchange transaction charges
  - GST on brokerage + exchange charges
  - SEBI turnover fees
  - Stamp duty
  - Slippage (the hidden cost)

For options trading with small capital (Rs 50K), costs can eat 10-30%
of gross profits. Accurate cost modeling is essential for realistic
backtesting.

ALL RATES ARE CURRENT AS OF 2025-2026:
  These are the actual rates charged by Zerodha/NSE. If rates change,
  update this file.

Author: DDLJ Strategy Team
Version: 8.4 (Production)
"""


def calc_costs_futures(buy_value, sell_value, is_futures=True, slippage_pct=0.01):
    """
    Calculate total transaction costs for a FUTURES trade on Zerodha.

    COST BREAKDOWN (Zerodha rates):
    ┌─────────────────────────┬──────────────────────────────────────────┐
    │ Component               │ Rate                                     │
    ├─────────────────────────┼──────────────────────────────────────────┤
    │ Brokerage (buy)         │ min(Rs 20, 0.025% of buy value)         │
    │ Brokerage (sell)        │ min(Rs 20, 0.025% of sell value)        │
    │ STT/CTT (sell side)    │ 0.0125% of sell value                   │
    │ Exchange Txn (buy)      │ 0.002% of buy value                     │
    │ Exchange Txn (sell)     │ 0.002% of sell value                    │
    │ Stamp Duty (buy side)   │ 0.002% of buy value                     │
    │ SEBI Fee (buy)          │ 0.0001% of buy value                    │
    │ SEBI Fee (sell)         │ 0.0001% of sell value                   │
    │ GST                     │ 18% of (brokerage + exchange charges)    │
    │ Slippage (buy)          │ slippage_pct × buy value                │
    │ Slippage (sell)         │ slippage_pct × sell value               │
    └─────────────────────────┴──────────────────────────────────────────┘

    WHY min(Rs 20, 0.025%)?
        Zerodha charges 0.025% OR Rs 20 per order, whichever is LOWER.
        For large orders, the percentage-based fee exceeds Rs 20, so
        the flat Rs 20 applies. For small orders, 0.025% applies.

    Args:
        buy_value (float): Total buy-side value in rupees.
            = entry_price × quantity
            Example: 50000 × 30 = 15,00,000 (for 1 lot BN futures)
        sell_value (float): Total sell-side value in rupees.
            = exit_price × quantity
        is_futures (bool, optional): True for futures, False for equity.
            Currently not used differently, but reserved for future.
            Default: True.
        slippage_pct (float, optional): Slippage as percentage of value.
            Default: 0.01 (1% = 0.01).
            WHY 1%? Futures slippage is relatively small because
            futures are highly liquid. 1% is a conservative estimate
            that accounts for market impact and timing delays.

    Returns:
        tuple[float, dict]: (total_cost, breakdown)
            total_cost: Sum of all cost components, rounded to 2 decimals.
            breakdown: Dictionary with individual cost components:
                - "brokerage": Total brokerage (buy + sell)
                - "stt": Securities Transaction Tax
                - "exchange": Exchange transaction charges (buy + sell)
                - "gst": Goods and Services Tax
                - "slippage": Total slippage cost (buy + sell)

    Example:
        >>> total, bd = calc_costs_futures(1500000, 1515000)
        >>> print(f"Total costs: Rs {total}")
        >>> print(f"Breakdown: {bd}")
    """
    # Brokerage: min(Rs 20, 0.025% of trade value) per order
    brokerage_buy = min(20, 0.025 * buy_value / 100)
    brokerage_sell = min(20, 0.025 * sell_value / 100)

    # STT/CTT: 0.0125% on sell side only
    # WHY sell side only? Government policy — STT is levied on the seller
    stt = 0.0125 * sell_value / 100

    # Exchange transaction charges: 0.002% on both sides
    ex_buy = 0.002 * buy_value / 100
    ex_sell = 0.002 * sell_value / 100

    # Stamp duty: 0.002% on buy side only
    # WHY buy side only? Stamp duty is a state tax on purchase transactions
    stamp = 0.002 * buy_value / 100

    # SEBI turnover fee: 0.0001% on both sides
    sebi_buy = 0.0001 * buy_value / 100
    sebi_sell = 0.0001 * sell_value / 100

    # GST: 18% on (brokerage + exchange charges)
    # WHY only on brokerage + exchange? GST is a service tax, not a
    # transaction tax. It applies to services rendered (brokerage)
    # and exchange services (transaction charges), not to STT or stamp duty.
    gst = 0.18 * (brokerage_buy + brokerage_sell + ex_buy + ex_sell)

    # Slippage: estimated market impact and timing cost
    # WHY slippage? In real trading, you rarely get the exact price you
    # see. There's always a small difference due to:
    #   - Order execution delay (even milliseconds matter)
    #   - Market impact (your order moves the price)
    #   - Bid-ask spread (you buy at ask, sell at bid)
    slip_buy = slippage_pct * buy_value / 100
    slip_sell = slippage_pct * sell_value / 100

    total = (brokerage_buy + brokerage_sell + stt + ex_buy + ex_sell +
             gst + sebi_buy + sebi_sell + stamp + slip_buy + slip_sell)

    return round(total, 2), {
        "brokerage": round(brokerage_buy + brokerage_sell, 2),
        "stt": round(stt, 2),
        "exchange": round(ex_buy + ex_sell, 2),
        "gst": round(gst, 2),
        "slippage": round(slip_buy + slip_sell, 2),
    }


def calc_costs_options(buy_premium, sell_premium, lot_size, lots):
    """
    Calculate total transaction costs for an OPTIONS trade on Zerodha.

    COST BREAKDOWN (Zerodha rates for options):
    ┌─────────────────────────┬──────────────────────────────────────────┐
    │ Component               │ Rate                                     │
    ├─────────────────────────┼──────────────────────────────────────────┤
    │ Brokerage (buy)         │ Rs 20 flat per order                     │
    │ Brokerage (sell)        │ Rs 20 flat per order                     │
    │ STT (sell side)         │ 0.0625% of sell-side premium value       │
    │ Exchange Txn (buy)      │ 0.05% of buy-side premium value          │
    │ Exchange Txn (sell)     │ 0.05% of sell-side premium value         │
    │ Stamp Duty (buy side)   │ 0.003% of buy-side premium value         │
    │ SEBI Fee (buy)          │ 0.0001% of buy-side premium value        │
    │ SEBI Fee (sell)         │ 0.0001% of sell-side premium value       │
    │ GST                     │ 18% of (brokerage + exchange charges)    │
    └─────────────────────────┴──────────────────────────────────────────┘

    WHY Rs 20 flat for options brokerage?
        Zerodha charges a flat Rs 20 per executed order for options,
        regardless of order size. This is because options premiums
        are much smaller than futures values, so percentage-based
        brokerage would be negligible.

    WHY 0.0625% STT for options (vs 0.0125% for futures)?
        The government charges higher STT on options because options
        are considered more speculative than futures. The higher rate
        discourages excessive speculation.

    NOTE: Options don't have a separate slippage parameter because
    slippage is already modeled in the bid-ask spread by the
    OptionsMimicryEngine. Adding it here would double-count.

    Args:
        buy_premium (float): Option premium per share at entry.
            Example: 400.00 (the premium you paid per share)
        sell_premium (float): Option premium per share at exit.
            Example: 450.00 (the premium you received per share)
        lot_size (int): Number of shares per lot.
            BankNifty = 30, Nifty = 65.
        lots (int): Number of lots traded.

    Returns:
        tuple[float, dict]: (total_cost, breakdown)
            total_cost: Sum of all cost components, rounded to 2 decimals.
            breakdown: Dictionary with individual cost components:
                - "brokerage": Total brokerage (buy + sell) = Rs 40
                - "stt": Securities Transaction Tax
                - "exchange": Exchange transaction charges (buy + sell)
                - "gst": Goods and Services Tax
                - "stamp": Stamp duty
                - "total": Total cost (same as first return value)

    Example:
        >>> # Buy 1 lot BN 49800 CE at 400, sell at 450
        >>> total, bd = calc_costs_options(400, 450, 30, 1)
        >>> print(f"Total costs: Rs {total}")
        >>> print(f"Breakdown: {bd}")
        >>> # Buy-side value = 400 × 30 × 1 = 12000
        >>> # Sell-side value = 450 × 30 × 1 = 13500
    """
    # Total premium values (premium × lot_size × lots)
    total_premium_buy = buy_premium * lot_size * lots
    total_premium_sell = sell_premium * lot_size * lots

    # Brokerage: Flat Rs 20 per order for options on Zerodha
    brokerage_buy = 20
    brokerage_sell = 20

    # STT: 0.0625% on sell-side premium value
    # WHY higher than futures? Government considers options more speculative
    stt = 0.0625 * total_premium_sell / 100

    # Exchange transaction charges: 0.05% on both sides
    # WHY higher than futures (0.002%)? Options exchange charges are
    # significantly higher because options clearing involves more risk
    ex_buy = 0.05 * total_premium_buy / 100
    ex_sell = 0.05 * total_premium_sell / 100

    # Stamp duty: 0.003% on buy side only
    stamp = 0.003 * total_premium_buy / 100

    # SEBI turnover fee: 0.0001% on both sides
    sebi_buy = 0.0001 * total_premium_buy / 100
    sebi_sell = 0.0001 * total_premium_sell / 100

    # GST: 18% on (brokerage + exchange charges)
    gst = 0.18 * (brokerage_buy + brokerage_sell + ex_buy + ex_sell)

    total = (brokerage_buy + brokerage_sell + stt + ex_buy + ex_sell +
             gst + sebi_buy + sebi_sell + stamp)

    return round(total, 2), {
        "brokerage": round(brokerage_buy + brokerage_sell, 2),
        "stt": round(stt, 2),
        "exchange": round(ex_buy + ex_sell, 2),
        "gst": round(gst, 2),
        "stamp": round(stamp, 2),
        "total": round(total, 2),
    }
