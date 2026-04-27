#!/usr/bin/env python3
"""
DDLJ v9 Strategy — Transaction Cost Calculator
==================================================

Realistic trading costs for both futures and options trades on NSE/NFO.
All rates are current as of 2025-2026 (Zerodha rates).

Author: DDLJ Strategy Team
Version: 9.0 (Paper Trading Production)
"""


def calc_costs_futures(buy_value, sell_value, is_futures=True, slippage_pct=0.01):
    """
    Calculate total transaction costs for a FUTURES trade on Zerodha.

    Args:
        buy_value (float): Total buy-side value in rupees.
        sell_value (float): Total sell-side value in rupees.
        is_futures (bool): True for futures. Default: True.
        slippage_pct (float): Slippage as percentage. Default: 0.01 (1%).

    Returns:
        tuple[float, dict]: (total_cost, breakdown)
    """
    brokerage_buy = min(20, 0.025 * buy_value / 100)
    brokerage_sell = min(20, 0.025 * sell_value / 100)
    stt = 0.0125 * sell_value / 100
    ex_buy = 0.002 * buy_value / 100
    ex_sell = 0.002 * sell_value / 100
    stamp = 0.002 * buy_value / 100
    sebi_buy = 0.0001 * buy_value / 100
    sebi_sell = 0.0001 * sell_value / 100
    gst = 0.18 * (brokerage_buy + brokerage_sell + ex_buy + ex_sell)
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

    Args:
        buy_premium (float): Option premium per share at entry.
        sell_premium (float): Option premium per share at exit.
        lot_size (int): Number of shares per lot.
        lots (int): Number of lots traded.

    Returns:
        tuple[float, dict]: (total_cost, breakdown)
    """
    total_premium_buy = buy_premium * lot_size * lots
    total_premium_sell = sell_premium * lot_size * lots

    brokerage_buy = 20
    brokerage_sell = 20
    stt = 0.0625 * total_premium_sell / 100
    ex_buy = 0.05 * total_premium_buy / 100
    ex_sell = 0.05 * total_premium_sell / 100
    stamp = 0.003 * total_premium_buy / 100
    sebi_buy = 0.0001 * total_premium_buy / 100
    sebi_sell = 0.0001 * total_premium_sell / 100
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
