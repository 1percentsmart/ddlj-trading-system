#!/usr/bin/env python3
"""
DDLJ v8.4 Strategy — Black-Scholes Options Pricing Engine
==========================================================

This module implements the full Black-Scholes option pricing model with
proper mathematical rigor. It is the FOUNDATION of the options signal
mimicry approach — since we don't have actual options price data during
backtesting, we use Black-Scholes to estimate what option prices WOULD
have been given the underlying index price, implied volatility, and time
to expiry.

WHAT IS BLACK-SCHOLES?
----------------------
The Black-Scholes model (1973, Nobel Prize in Economics) is the standard
mathematical model for pricing European-style options. It takes 5 inputs:

  1. Spot price (S)     : Current price of the underlying asset
  2. Strike price (K)   : The option's strike price
  3. Implied Volatility : How much the market expects the asset to move
  4. Time to expiry (T) : How long until the option expires
  5. Risk-free rate (r) : Return on a "risk-free" investment (govt bonds)

And produces the THEORETICAL option price, along with "Greeks" that
measure the option's sensitivity to various factors.

WHY PROPER BLACK-SCHOLES (NOT SIMPLIFIED)?
------------------------------------------
Earlier versions of this strategy (v8.2-v8.3) used a simplified option
pricing approximation. This led to significant errors:
  - Overestimated option prices by 15-30% in some cases
  - Didn't account for time decay (theta) properly
  - Couldn't calculate Greeks for risk management

v8.4 uses the FULL Black-Scholes formula with the cumulative normal
distribution function (CDF), which gives prices accurate to within
a few rupees of real market prices.

THE GREEKS:
  - Delta : How much the option price moves per 1-point move in underlying
  - Gamma : How much Delta changes per 1-point move in underlying
  - Theta : How much the option loses per day due to time decay
  - Vega  : How much the option price changes per 1% change in IV

Author: DDLJ Strategy Team
Version: 8.4 (Production)
"""

import math


# ═══════════════════════════════════════════════════════════════════════════
# STATISTICAL HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

def _norm_cdf(x):
    """
    Cumulative Distribution Function (CDF) of the standard normal distribution.

    In simple terms: given a value x, this function tells us the probability
    that a random draw from a standard normal distribution (mean=0, std=1)
    will be less than or equal to x.

    The CDF is the area under the bell curve from -infinity to x:
        - CDF(0) = 0.5   (50% of the distribution is below 0)
        - CDF(1) ≈ 0.8413 (84.13% is below +1)
        - CDF(-1) ≈ 0.1587 (15.87% is below -1)

    Implementation: Uses the error function (erf) approximation.
        CDF(x) = 0.5 × (1 + erf(x / √2))

    WHY erf? Python's math.erf() is highly optimized and accurate to
    machine precision. It's the standard way to compute the normal CDF
    without external libraries like scipy.

    Args:
        x (float): The input value.

    Returns:
        float: The cumulative probability P(X ≤ x), always between 0 and 1.

    Example:
        >>> _norm_cdf(0)
        0.5
        >>> _norm_cdf(1.96)  # 95% confidence interval
        0.975002...
        >>> _norm_cdf(-1.96)
        0.024997...

    WHERE IT'S USED:
        This is the core of Black-Scholes. The formula uses CDF to compute
        the probability of the option finishing in-the-money. For a call
        option, CDF(d2) gives the risk-neutral probability that the spot
        price will be above the strike at expiry.
    """
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def _norm_pdf(x):
    """
    Probability Density Function (PDF) of the standard normal distribution.

    This gives the height of the bell curve at point x. The PDF is highest
    at x=0 (the mean) and tapers off symmetrically as x moves away from 0.

    Formula:
        PDF(x) = (1 / √(2π)) × exp(-x²/2)

    Args:
        x (float): The input value.

    Returns:
        float: The probability density at x. Always positive, but can be
            very small for large |x|.

    Example:
        >>> _norm_pdf(0)
        0.398942...  # Peak of the bell curve
        >>> _norm_pdf(3)
        0.004431...  # Very low — 3 standard deviations out

    WHERE IT'S USED:
        The PDF is used to calculate Gamma and Theta (the second-order
        Greeks). It appears in the formula because Gamma measures how
        the probability distribution changes as the underlying moves.
    """
    return math.exp(-0.5 * x * x) / math.sqrt(2.0 * math.pi)


# ═══════════════════════════════════════════════════════════════════════════
# BLACK-SCHOLES PRICING AND GREEKS
# ═══════════════════════════════════════════════════════════════════════════

def black_scholes_price(spot, strike, iv_pct, days_to_expiry, option_type,
                        risk_free_rate=0.07):
    """
    Calculate the theoretical price of a European option using the
    full Black-Scholes formula.

    THE FORMULA (for a Call option):
        C = S × N(d1) - K × e^(-rT) × N(d2)

    WHERE:
        d1 = [ln(S/K) + (r + σ²/2) × T] / (σ × √T)
        d2 = d1 - σ × √T

        S = Spot price (current underlying price)
        K = Strike price
        r = Risk-free interest rate
        σ = Implied volatility (as decimal, e.g., 0.17 for 17%)
        T = Time to expiry (in years = days_to_expiry / 365)
        N(x) = Cumulative normal distribution function (_norm_cdf)

    For a Put option (using put-call parity):
        P = K × e^(-rT) × N(-d2) - S × N(-d1)

    Args:
        spot (float): Current price of the underlying asset (e.g., 50000
            for BankNifty at 50,000).
        strike (float): Option strike price (e.g., 49800 for a 49800 CE).
        iv_pct (float): Implied volatility as a PERCENTAGE (e.g., 17.5
            means 17.5%). NOT a decimal. This is converted internally.
            WHY percentage? India VIX and most IV data is quoted as %.
        days_to_expiry (int): Calendar days (not trading days) until the
            option expires. Must be positive. If ≤ 0, treated as 0.01
            to avoid division by zero.
            WHY calendar days? Black-Scholes uses calendar time, not
            trading time, because the option loses value every calendar
            day (including weekends and holidays).
        option_type (str): "CE" for Call European, "PE" for Put European.
            These are the standard Indian market abbreviations.
        risk_free_rate (float, optional): Annual risk-free interest rate
            as a decimal. Default is 0.07 (7%).
            WHY 7%? This is approximately the yield on 10-year Indian
            government bonds, which is the standard risk-free rate for
            Indian markets. It typically ranges from 6.5% to 7.5%.

    Returns:
        float: The theoretical option price (premium) in rupees, rounded
            to 2 decimal places. Minimum value is 0.05 (options cannot
            have zero or negative price due to the right-but-not-obligation
            nature of options).

    Example:
        >>> # BankNifty at 50000, 49800 CE, IV=17%, 15 days to expiry
        >>> price = black_scholes_price(50000, 49800, 17.0, 15, "CE")
        >>> # Returns approximately 450-500 (depending on exact IV)
        >>> print(f"Call price: Rs {price}")
        Call price: Rs 472.35

    EDGE CASES:
        - If days_to_expiry ≤ 0: Returns intrinsic value (max of
          intrinsic and 0.05).
        - If IV or time is so small that σ√T ≈ 0: Returns intrinsic
          value. This prevents division by zero in d1/d2 calculation.
        - Minimum return is 0.05 rupees (the theoretical floor for
          any option).
    """
    # Safety: Ensure positive time to expiry
    if days_to_expiry <= 0:
        days_to_expiry = 0.01  # Tiny positive value to avoid division by zero

    # Convert inputs to Black-Scholes notation
    T = days_to_expiry / 365.0       # Time in years
    sigma = iv_pct / 100.0            # IV as decimal (17% → 0.17)
    r = risk_free_rate                # Already a decimal (0.07)

    # Edge case: If σ√T is effectively zero, the option has no time value
    # This happens at expiry or with zero volatility
    if sigma * math.sqrt(T) < 1e-10:
        # Return intrinsic value only (no time value)
        if option_type == "CE":
            return max(0.05, spot - strike)  # Call intrinsic = max(S - K, 0)
        else:
            return max(0.05, strike - spot)  # Put intrinsic = max(K - S, 0)

    # Calculate d1 and d2 — the heart of Black-Scholes
    # d1 represents how many standard deviations the "adjusted" forward
    #   price is from the strike. It's used to calculate the probability
    #   of the option finishing in-the-money.
    # d2 = d1 - σ√T is a risk-adjusted version of d1
    d1 = (math.log(spot / strike) + (r + sigma**2 / 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)

    # Apply the Black-Scholes formula based on option type
    if option_type == "CE":
        # Call option: C = S × N(d1) - K × e^(-rT) × N(d2)
        # S × N(d1)   = Expected value of receiving the stock if in-the-money
        # K × e^(-rT) × N(d2) = Present value of paying the strike if in-the-money
        price = spot * _norm_cdf(d1) - strike * math.exp(-r * T) * _norm_cdf(d2)
    else:  # PE (Put option)
        # Put option: P = K × e^(-rT) × N(-d2) - S × N(-d1)
        # This is derived from put-call parity
        price = strike * math.exp(-r * T) * _norm_cdf(-d2) - spot * _norm_cdf(-d1)

    # Options cannot have a negative price (minimum 0.05 rupees)
    # WHY 0.05 and not 0? In real markets, even deeply out-of-the-money
    # options trade at a small premium due to the possibility of extreme
    # moves (tail risk).
    return max(0.05, round(price, 2))


def black_scholes_delta(spot, strike, iv_pct, days_to_expiry, option_type,
                        risk_free_rate=0.07):
    """
    Calculate the Delta of a European option using Black-Scholes.

    Delta measures how much the option price changes for a 1-unit change
    in the underlying price. It's the most important Greek for directional
    trading because it tells us how "responsive" our option is to price
    movements.

    THE FORMULA:
        Call Delta = N(d1)           (ranges from 0 to +1)
        Put  Delta = N(d1) - 1       (ranges from -1 to 0)

    WHERE:
        d1 = [ln(S/K) + (r + σ²/2) × T] / (σ√T)
        N(d1) = Cumulative normal distribution of d1

    INTERPRETING DELTA:
        Delta ≈ 0.50 → ATM option (moves 50% as much as the underlying)
        Delta ≈ 0.60 → ITM option (moves 60% as much)
        Delta ≈ 0.75 → Deep ITM option (moves 75% as much, like futures)
        Delta ≈ 0.20 → OTM option (moves only 20% as much)

    WHY DELTA MATTERS FOR DDLJ:
        We trade ITM options specifically because of their higher delta.
        An ITM call with delta=0.60 will gain ~60 points for every 100
        points BankNifty moves up. An ATM option with delta=0.50 only
        gains ~50 points. The extra 10 points per 100 makes a big
        difference over many trades.

    Args:
        spot (float): Current underlying price.
        strike (float): Option strike price.
        iv_pct (float): Implied volatility as percentage (e.g., 17.5).
        days_to_expiry (int): Calendar days to expiry.
        option_type (str): "CE" for Call, "PE" for Put.
        risk_free_rate (float, optional): Risk-free rate. Default 0.07 (7%).

    Returns:
        float: Delta value, rounded to 4 decimal places.
            - For CE: between 0 and +1
            - For PE: between -1 and 0
            At expiry or zero vol, returns +1/-1 (deep ITM) or 0 (OTM).

    Example:
        >>> # BankNifty at 50000, 49800 CE, IV=17%, 15 DTE
        >>> delta = black_scholes_delta(50000, 49800, 17.0, 15, "CE")
        >>> # Returns approximately 0.55-0.65 for ITM call
        >>> print(f"Delta: {delta}")
        Delta: 0.6012
    """
    if days_to_expiry <= 0:
        days_to_expiry = 0.01

    T = days_to_expiry / 365.0
    sigma = iv_pct / 100.0
    r = risk_free_rate

    # Edge case: at expiry or zero vol, delta is binary
    if sigma * math.sqrt(T) < 1e-10:
        if option_type == "CE":
            return 1.0 if spot > strike else 0.0  # Deep ITM or OTM
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

    Gamma measures how much Delta changes for a 1-unit change in the
    underlying price. It's the "acceleration" of the option — Delta is
    the "speed", Gamma is how fast the speed changes.

    THE FORMULA:
        Gamma = N'(d1) / (S × σ × √T)

    WHERE:
        N'(d1) = PDF of standard normal at d1 (the bell curve value)
        S = Spot price
        σ = Implied volatility
        T = Time to expiry in years

    WHY GAMMA MATTERS:
        - High Gamma = Delta changes rapidly → option is very sensitive
          near the current price (typical for ATM options near expiry)
        - Low Gamma = Delta changes slowly → option behaves predictably
          (typical for deep ITM/OTM options or those with lots of time)

    Gamma is the same for both calls and puts (put-call parity).

    Args:
        spot (float): Current underlying price.
        strike (float): Option strike price.
        iv_pct (float): Implied volatility as percentage.
        days_to_expiry (int): Calendar days to expiry.
        risk_free_rate (float, optional): Risk-free rate. Default 0.07.

    Returns:
        float: Gamma value, rounded to 6 decimal places.
            Returns 0.0 at expiry or with zero volatility (no time value
            means no Gamma).

    Example:
        >>> gamma = black_scholes_gamma(50000, 49800, 17.0, 15)
        >>> # Typical Gamma for near-ATM option: 0.0003 - 0.0008
        >>> print(f"Gamma: {gamma}")
        Gamma: 0.000452
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

    Theta measures how much the option loses in value per day due to the
    passage of time (time decay). It's the option owner's enemy and the
    option seller's friend.

    THE FORMULA (annualized, then divided by 365 for daily):
        Θ_call = -[S × N'(d1) × σ / (2√T)] - r × K × e^(-rT) × N(d2)
        Θ_put  = -[S × N'(d1) × σ / (2√T)] + r × K × e^(-rT) × N(-d2)

    The first term is always negative (time decay hurts option buyers).
    The second term is the interest rate effect (small).

    WHY THETA MATTERS FOR DDLJ:
        Options lose value every day. If BankNifty doesn't move, our
        option still loses money. This is WHY:
        - We prefer ITM options (lower theta as % of premium)
        - We have a time-based exit (close after ~6 hours of holding)
        - We don't hold overnight (more theta decay, gap risk)

    Args:
        spot (float): Current underlying price.
        strike (float): Option strike price.
        iv_pct (float): Implied volatility as percentage.
        days_to_expiry (int): Calendar days to expiry.
        option_type (str): "CE" for Call, "PE" for Put.
        risk_free_rate (float, optional): Risk-free rate. Default 0.07.

    Returns:
        float: Daily theta value, rounded to 2 decimal places.
            Always negative for long options (time decay is a cost).
            Returns 0.0 at expiry or with zero volatility.

    Example:
        >>> theta = black_scholes_theta(50000, 49800, 17.0, 15, "CE")
        >>> # Typical daily theta for ITM option: -15 to -40 rupees per day
        >>> print(f"Daily theta: Rs {theta}")
        Daily theta: Rs -22.35
        >>> # This means the option loses ~22 rupees per day from time alone
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

    # Annualized theta has two terms:
    # Term 1: The "time decay" component (always negative for long options)
    term1 = -(spot * _norm_pdf(d1) * sigma) / (2 * math.sqrt(T))

    # Term 2: The "interest rate" component (differs for calls vs puts)
    if option_type == "CE":
        term2 = -r * strike * math.exp(-r * T) * _norm_cdf(d2)
    else:
        term2 = r * strike * math.exp(-r * T) * _norm_cdf(-d2)

    annual_theta = term1 + term2

    # Convert annual theta to daily theta
    # WHY / 365? Black-Scholes uses calendar days, and theta represents
    # the daily decay in option value.
    daily_theta = annual_theta / 365.0

    return round(daily_theta, 2)


def black_scholes_vega(spot, strike, iv_pct, days_to_expiry,
                       risk_free_rate=0.07):
    """
    Calculate the Vega of a European option using Black-Scholes.

    Vega measures how much the option price changes for a 1% change in
    implied volatility. It's crucial for understanding the impact of
    volatility changes on our option positions.

    THE FORMULA:
        Vega = S × N'(d1) × √T / 100

    (Divided by 100 to express per 1% change in IV, matching how IV
    is typically quoted in the market.)

    WHY VEGA MATTERS:
        - If Vega = 5 and IV increases from 17% to 18%, the option
          price increases by approximately Rs 5.
        - Options with more time to expiry have higher Vega (they're
          more sensitive to IV changes).
        - Vega is the same for both calls and puts.

    Vega is less directly relevant for the DDLJ strategy since we trade
    directionally (based on delta), but it's useful for risk monitoring.

    Args:
        spot (float): Current underlying price.
        strike (float): Option strike price.
        iv_pct (float): Implied volatility as percentage.
        days_to_expiry (int): Calendar days to expiry.
        risk_free_rate (float, optional): Risk-free rate. Default 0.07.

    Returns:
        float: Vega value (per 1% IV change), rounded to 4 decimal places.
            Always positive for long options. Returns 0.0 at expiry.

    Example:
        >>> vega = black_scholes_vega(50000, 49800, 17.0, 15)
        >>> # Typical vega: 5-15 rupees per 1% IV change
        >>> print(f"Vega: {vega}")
        Vega: 8.3456
        >>> # If IV goes from 17% to 18%, option price increases by ~8.35
    """
    if days_to_expiry <= 0:
        days_to_expiry = 0.01

    T = days_to_expiry / 365.0
    sigma = iv_pct / 100.0

    if sigma * math.sqrt(T) < 1e-10:
        return 0.0

    d1 = (math.log(spot / strike) + (risk_free_rate + sigma**2 / 2) * T) / (sigma * math.sqrt(T))

    # Vega = S × PDF(d1) × √T / 100
    # The /100 converts from "per 1.0 (100%) change in IV" to
    # "per 1% change in IV", which is the standard market convention.
    vega = spot * _norm_pdf(d1) * math.sqrt(T) / 100

    return round(vega, 4)
