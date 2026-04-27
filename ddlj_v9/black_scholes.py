#!/usr/bin/env python3
"""
DDLJ v9 Strategy — Black-Scholes Options Pricing Engine
==========================================================

Full Black-Scholes option pricing model with proper mathematical rigor.
Foundation of the options signal mimicry approach — estimates what option
prices WOULD have been given the underlying index price, IV, and time to expiry.

THE GREEKS:
  - Delta : How much the option price moves per 1-point move in underlying
  - Gamma : How much Delta changes per 1-point move in underlying
  - Theta : How much the option loses per day due to time decay
  - Vega  : How much the option price changes per 1% change in IV

Author: DDLJ Strategy Team
Version: 9.0 (Paper Trading Production)
"""

import math


# ═══════════════════════════════════════════════════════════════════════════
# STATISTICAL HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

def _norm_cdf(x):
    """
    Cumulative Distribution Function (CDF) of the standard normal distribution.

    CDF(x) = 0.5 * (1 + erf(x / sqrt(2)))

    WHY erf? Python's math.erf() is highly optimized and accurate to
    machine precision. It's the standard way to compute the normal CDF
    without external libraries like scipy.
    """
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def _norm_pdf(x):
    """
    Probability Density Function (PDF) of the standard normal distribution.

    PDF(x) = (1 / sqrt(2*pi)) * exp(-x^2/2)
    """
    return math.exp(-0.5 * x * x) / math.sqrt(2.0 * math.pi)


# ═══════════════════════════════════════════════════════════════════════════
# BLACK-SCHOLES PRICING AND GREEKS
# ═══════════════════════════════════════════════════════════════════════════

def black_scholes_price(spot, strike, iv_pct, days_to_expiry, option_type,
                        risk_free_rate=0.07):
    """
    Calculate the theoretical price of a European option using Black-Scholes.

    Args:
        spot (float): Current underlying price.
        strike (float): Option strike price.
        iv_pct (float): Implied volatility as PERCENTAGE (e.g., 17.5 means 17.5%).
        days_to_expiry (int): Calendar days to expiry.
        option_type (str): "CE" for Call, "PE" for Put.
        risk_free_rate (float): Annual risk-free rate as decimal. Default 0.07 (7%).

    Returns:
        float: Theoretical option price in rupees, rounded to 2 decimal places.
            Minimum value is 0.05.
    """
    if days_to_expiry <= 0:
        days_to_expiry = 0.01

    T = days_to_expiry / 365.0
    sigma = iv_pct / 100.0
    r = risk_free_rate

    if sigma * math.sqrt(T) < 1e-10:
        if option_type == "CE":
            return max(0.05, spot - strike)
        else:
            return max(0.05, strike - spot)

    d1 = (math.log(spot / strike) + (r + sigma**2 / 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)

    if option_type == "CE":
        price = spot * _norm_cdf(d1) - strike * math.exp(-r * T) * _norm_cdf(d2)
    else:
        price = strike * math.exp(-r * T) * _norm_cdf(-d2) - spot * _norm_cdf(-d1)

    return max(0.05, round(price, 2))


def black_scholes_delta(spot, strike, iv_pct, days_to_expiry, option_type,
                        risk_free_rate=0.07):
    """
    Calculate the Delta of a European option using Black-Scholes.

    Call Delta = N(d1) (ranges from 0 to +1)
    Put  Delta = N(d1) - 1 (ranges from -1 to 0)
    """
    if days_to_expiry <= 0:
        days_to_expiry = 0.01

    T = days_to_expiry / 365.0
    sigma = iv_pct / 100.0
    r = risk_free_rate

    if sigma * math.sqrt(T) < 1e-10:
        if option_type == "CE":
            return 1.0 if spot > strike else 0.0
        else:
            return -1.0 if spot < strike else 0.0

    d1 = (math.log(spot / strike) + (r + sigma**2 / 2) * T) / (sigma * math.sqrt(T))

    if option_type == "CE":
        return round(_norm_cdf(d1), 4)
    else:
        return round(_norm_cdf(d1) - 1, 4)


def black_scholes_gamma(spot, strike, iv_pct, days_to_expiry,
                        risk_free_rate=0.07):
    """
    Calculate the Gamma of a European option using Black-Scholes.

    Gamma = N'(d1) / (S * sigma * sqrt(T))
    Same for both calls and puts (put-call parity).
    """
    if days_to_expiry <= 0:
        days_to_expiry = 0.01

    T = days_to_expiry / 365.0
    sigma = iv_pct / 100.0

    if sigma * math.sqrt(T) < 1e-10:
        return 0.0

    d1 = (math.log(spot / strike) + (risk_free_rate + sigma**2 / 2) * T) / (sigma * math.sqrt(T))
    gamma = _norm_pdf(d1) / (spot * sigma * math.sqrt(T))

    return round(gamma, 6)


def black_scholes_theta(spot, strike, iv_pct, days_to_expiry, option_type,
                        risk_free_rate=0.07):
    """
    Calculate the daily Theta of a European option using Black-Scholes.

    Theta measures how much the option loses in value per day due to time decay.
    Always negative for long options.
    """
    if days_to_expiry <= 0:
        days_to_expiry = 0.01

    T = days_to_expiry / 365.0
    sigma = iv_pct / 100.0
    r = risk_free_rate

    if sigma * math.sqrt(T) < 1e-10:
        return 0.0

    d1 = (math.log(spot / strike) + (r + sigma**2 / 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)

    term1 = -(spot * _norm_pdf(d1) * sigma) / (2 * math.sqrt(T))

    if option_type == "CE":
        term2 = -r * strike * math.exp(-r * T) * _norm_cdf(d2)
    else:
        term2 = r * strike * math.exp(-r * T) * _norm_cdf(-d2)

    annual_theta = term1 + term2
    daily_theta = annual_theta / 365.0

    return round(daily_theta, 2)


def black_scholes_vega(spot, strike, iv_pct, days_to_expiry,
                       risk_free_rate=0.07):
    """
    Calculate the Vega of a European option using Black-Scholes.

    Vega measures how much the option price changes for a 1% change in IV.
    Same for both calls and puts.
    """
    if days_to_expiry <= 0:
        days_to_expiry = 0.01

    T = days_to_expiry / 365.0
    sigma = iv_pct / 100.0

    if sigma * math.sqrt(T) < 1e-10:
        return 0.0

    d1 = (math.log(spot / strike) + (risk_free_rate + sigma**2 / 2) * T) / (sigma * math.sqrt(T))

    vega = spot * _norm_pdf(d1) * math.sqrt(T) / 100

    return round(vega, 4)
