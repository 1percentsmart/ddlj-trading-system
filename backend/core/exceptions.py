#!/usr/bin/env python3
"""
DDLJ Backend — Custom Exception Hierarchy
============================================

All custom exceptions used across the DDLJ backend. Using a proper
exception hierarchy makes error handling predictable and API responses
consistent.

HIERARCHY:
  DDLJError (base)
  ├── EngineError
  │   ├── EngineNotRunningError
  │   ├── EngineAlreadyRunningError
  │   └── EngineStartupError
  ├── TokenError
  │   ├── TokenExpiredError
  │   ├── TokenInvalidError
  │   └── TokenExchangeError
  ├── MarketClosedError
  ├── RiskLimitError
  │   ├── DailyRiskLimitError
  │   └── CapitalFloorError
  ├── DatabaseError
  └── NotificationError
      └── TelegramError

Author: DDLJ Strategy Team
Version: 10.1.0
"""


# ============================================================================
# BASE EXCEPTION
# ============================================================================

class DDLJError(Exception):
    """
    Base exception for all DDLJ errors.

    All custom exceptions inherit from this, making it easy to catch
    any DDLJ-specific error with a single except clause.

    Attributes:
        message (str): Human-readable error description.
        code (str): Machine-readable error code for API responses.
        details (dict): Additional context about the error.
    """

    def __init__(self, message: str, code: str = "UNKNOWN_ERROR", details: dict = None):
        self.message = message
        self.code = code
        self.details = details or {}
        super().__init__(message)


# ============================================================================
# ENGINE ERRORS
# ============================================================================

class EngineError(DDLJError):
    """Base exception for trading engine errors."""

    def __init__(self, message: str, details: dict = None):
        super().__init__(message, code="ENGINE_ERROR", details=details)


class EngineNotRunningError(EngineError):
    """Raised when an operation requires the engine to be running but it's stopped."""

    def __init__(self, message: str = "Trading engine is not running"):
        super().__init__(message, code="ENGINE_NOT_RUNNING")


class EngineAlreadyRunningError(EngineError):
    """Raised when trying to start an already-running engine."""

    def __init__(self, message: str = "Trading engine is already running"):
        super().__init__(message, code="ENGINE_ALREADY_RUNNING")


class EngineStartupError(EngineError):
    """Raised when the engine fails to start."""

    def __init__(self, message: str, details: dict = None):
        super().__init__(message, code="ENGINE_STARTUP_ERROR", details=details)


# ============================================================================
# TOKEN ERRORS
# ============================================================================

class TokenError(DDLJError):
    """Base exception for Kite API token errors."""

    def __init__(self, message: str, code: str = "TOKEN_ERROR", details: dict = None):
        super().__init__(message, code=code, details=details)


class TokenExpiredError(TokenError):
    """Raised when the Kite access token has expired."""

    def __init__(self, message: str = "Kite access token has expired"):
        super().__init__(message, code="TOKEN_EXPIRED")


class TokenInvalidError(TokenError):
    """Raised when the Kite access token is invalid."""

    def __init__(self, message: str = "Kite access token is invalid"):
        super().__init__(message, code="TOKEN_INVALID")


class TokenExchangeError(TokenError):
    """Raised when exchanging a request token fails."""

    def __init__(self, message: str, details: dict = None):
        super().__init__(message, code="TOKEN_EXCHANGE_FAILED", details=details)


# ============================================================================
# MARKET ERRORS
# ============================================================================

class MarketClosedError(DDLJError):
    """Raised when trying to trade outside market hours."""

    def __init__(self, message: str = "Market is currently closed"):
        super().__init__(message, code="MARKET_CLOSED")


# ============================================================================
# RISK MANAGEMENT ERRORS
# ============================================================================

class RiskLimitError(DDLJError):
    """Base exception for risk limit violations."""

    def __init__(self, message: str, code: str = "RISK_LIMIT_ERROR"):
        super().__init__(message, code=code)


class DailyRiskLimitError(RiskLimitError):
    """Raised when daily risk limit is reached."""

    def __init__(self, message: str = "Daily risk limit reached"):
        super().__init__(message, code="DAILY_RISK_LIMIT")


class CapitalFloorError(RiskLimitError):
    """Raised when capital falls below the floor."""

    def __init__(self, message: str = "Capital below floor level"):
        super().__init__(message, code="CAPITAL_FLOOR")


# ============================================================================
# DATABASE ERRORS
# ============================================================================

class DatabaseError(DDLJError):
    """Raised when a database operation fails."""

    def __init__(self, message: str, details: dict = None):
        super().__init__(message, code="DATABASE_ERROR", details=details)


# ============================================================================
# NOTIFICATION ERRORS
# ============================================================================

class NotificationError(DDLJError):
    """Base exception for notification delivery failures."""

    def __init__(self, message: str, code: str = "NOTIFICATION_ERROR"):
        super().__init__(message, code=code)


class TelegramError(NotificationError):
    """Raised when Telegram notification delivery fails."""

    def __init__(self, message: str, details: dict = None):
        super().__init__(message, code="TELEGRAM_ERROR")
        self.details = details or {}


# ============================================================================
# API ERROR RESPONSE BUILDER
# ============================================================================

def error_to_response(error: DDLJError) -> dict:
    """
    Convert a DDLJError to a consistent API error response.

    Args:
        error (DDLJError): The exception to convert.

    Returns:
        dict: API-friendly error response.

    EXAMPLE:
        {
            "error": "TOKEN_EXPIRED",
            "message": "Kite access token has expired",
            "details": {}
        }
    """
    return {
        "error": error.code,
        "message": error.message,
        "details": error.details,
    }
