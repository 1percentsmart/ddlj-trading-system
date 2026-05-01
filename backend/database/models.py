#!/usr/bin/env python3
"""
DDLJ Trading System — SQLAlchemy ORM Models
==============================================

Defines all database tables for the DDLJ trading system using SQLAlchemy's
declarative mapping style (v2.0+). These models are used by both:
  - **SQLite** (development) — via aiosqlite
  - **PostgreSQL** (production) — via asyncpg on Supabase

TABLES:
  1. trades        — Completed trade history (the main output of the engine)
  2. positions     — Open/active positions (currently held trades)
  3. sessions      — Trading session records (each engine run = 1 session)
  4. config_overrides — User config changes (persisted across restarts)
  5. token_log     — Kite token exchange history (audit trail)
  6. error_log     — Error tracking (for debugging and monitoring)

TIMEZONE NOTE:
  All datetime columns use IST (Indian Standard Time, UTC+5:30).
  We store datetimes as timezone-aware (with IST) or as naive datetimes
  that are implicitly IST. The `ist_now()` helper centralizes this.

  WHY IST?
    Indian stock market (NSE/BSE) operates in IST. All trade times,
    session times, and log entries should be in IST for consistency
    with market data and regulatory reporting.

INDEXING STRATEGY:
  - Primary keys: auto-indexed by SQLAlchemy
  - Foreign-key-like columns (session_id): indexed for JOIN performance
  - Status columns: indexed for filtering (e.g., WHERE status='open')
  - Timestamp columns: indexed for time-range queries

Author: DDLJ Strategy Team
Version: 10.2.0
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

import pytz
from sqlalchemy import (
    Column,
    Integer,
    Float,
    String,
    Text,
    Boolean,
    DateTime,
    Index,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


# ============================================================================
# IST TIMEZONE HELPER
# ============================================================================

IST = pytz.timezone("Asia/Kolkata")
"""Indian Standard Time timezone object. Used for all timestamp columns."""


def ist_now() -> datetime:
    """
    Return the current time in IST (Indian Standard Time).

    WHY A HELPER?
      1. Centralizes timezone logic — change it once here if needed
      2. Ensures ALL models use the same timezone consistently
      3. Makes it easy to mock time in tests

    Returns:
        datetime: Current IST time (timezone-aware).
    """
    return datetime.now(IST)


# ============================================================================
# DECLARATIVE BASE
# ============================================================================

class Base(DeclarativeBase):
    """
    SQLAlchemy declarative base class.

    All ORM models inherit from this class. It provides:
      - metadata: Table metadata used by create_all() and migrations
      - registry: Type registry for mapped columns

    WHY SEPARATE BASE CLASS?
      If we used Base = declarative_base(), all models would be in the
      same metadata. This is fine for our use case. In larger projects,
      you might have multiple bases for different schemas.
    """
    pass


# ============================================================================
# TABLE 1: TRADES — Completed trade history
# ============================================================================

class Trade(Base):
    """
    Completed trade record — the MAIN output of the trading engine.

    Every time a position is closed (by SL, target, signal, or EOD),
    a Trade row is inserted with the full round-trip details.

    This is the primary table for:
      - P&L calculations and reporting
      - Backtesting result analysis
      - Trade journal and review
      - Tax reporting (real trades in future)

    RELATIONSHIP TO positions TABLE:
      When a position in `positions` is closed, it's deleted from
      `positions` and a new row is inserted here in `trades`.

    WHY BOTH entry_price AND exit_price?
      Because these are the actual prices of the UNDERLYING (e.g., NIFTY
      at 24500), not the option premium. Option premiums are in the
      option_* columns.
    """

    __tablename__ = "trades"

    # ── Primary Key ──
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    """Auto-incrementing unique ID for each trade."""

    # ── Session Reference ──
    session_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    """
    The trading session this trade belongs to.
    WHY INDEXED? We frequently query "all trades for session X".
    """

    # ── Basic Trade Info ──
    symbol: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    """Trading symbol: 'NIFTY', 'BANKNIFTY', etc."""

    direction: Mapped[str] = mapped_column(String(10), nullable=False)
    """Trade direction: 'LONG' or 'SHORT'."""

    entry_price: Mapped[float] = mapped_column(Float, nullable=False)
    """Entry price of the UNDERLYING (not the option)."""

    exit_price: Mapped[float] = mapped_column(Float, nullable=False)
    """Exit price of the UNDERLYING."""

    entry_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    """When the trade was entered. Indexed for time-range queries."""

    exit_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    """When the trade was exited."""

    # ── Risk Management ──
    sl: Mapped[float] = mapped_column(Float, nullable=False)
    """Stop loss price at time of exit (may have been trailed)."""

    target: Mapped[float] = mapped_column(Float, nullable=False)
    """Target price at time of entry."""

    qty: Mapped[int] = mapped_column(Integer, nullable=False)
    """Quantity traded. For options: lots * lot_size."""

    # ── P&L ──
    gross_pnl: Mapped[float] = mapped_column(Float, nullable=False)
    """Gross profit/loss in rupees (before costs)."""

    costs: Mapped[float] = mapped_column(Float, nullable=False)
    """Total transaction costs in rupees (brokerage + STT + etc.)."""

    net_pnl: Mapped[float] = mapped_column(Float, nullable=False)
    """Net profit/loss in rupees (gross_pnl - costs)."""

    # ── Exit Details ──
    exit_reason: Mapped[str] = mapped_column(String(30), nullable=False)
    """
    Why the trade was closed. Values:
      'SL'      — Stop loss hit
      'TARGET'  — Target hit
      'SIGNAL'  — Opposite signal generated
      'EOD'     — End-of-day forced close
      'TRAIL_SL' — Trailed stop loss hit
    """

    rr: Mapped[float] = mapped_column(Float, nullable=False)
    """Risk-reward ratio at entry (reward/risk). E.g., 2.5 = 2.5R trade."""

    # ── Options-Specific Fields (nullable for futures trades) ──
    option_strike: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    """Strike price if options trade. NULL for futures."""

    option_type: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    """'CE' or 'PE' if options trade. NULL for futures."""

    option_entry_premium: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    """Premium paid per share at entry."""

    option_exit_premium: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    """Premium received per share at exit."""

    option_delta: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    """Option delta at entry time."""

    option_iv_entry: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    """Implied volatility at entry time (%)."""

    option_iv_exit: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    """Implied volatility at exit time (%)."""

    # ── Metadata ──
    mode: Mapped[str] = mapped_column(String(10), nullable=False, default="futures")
    """Trade mode: 'futures' or 'options'."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=ist_now, index=True
    )
    """When this record was inserted. Indexed for time-range queries."""

    # ── Composite Indexes ──
    __table_args__ = (
        # Common query: "show me all trades for this symbol in this session"
        Index("ix_trades_session_symbol", "session_id", "symbol"),
        # Common query: "show me recent trades sorted by exit time"
        Index("ix_trades_exit_time_desc", "exit_time"),
    )

    def __repr__(self) -> str:
        return (
            f"<Trade id={self.id} {self.symbol} {self.direction} "
            f"net_pnl={self.net_pnl:.0f} mode={self.mode}>"
        )


# ============================================================================
# TABLE 2: POSITIONS — Open (active) positions
# ============================================================================

class Position(Base):
    """
    Open position — a trade currently being held.

    When the engine enters a trade, a Position row is created.
    When the trade is closed, the Position row is updated (status='closed')
    and a Trade row is created in the trades table.

    WHY KEEP CLOSED POSITIONS?
      The `status` column lets us keep closed positions temporarily
      for audit purposes, but the `get_open_positions()` CRUD function
      only returns status='open'. This is safer than immediate deletion.

    OPT_ENTRY_JSON:
      For options trades, we store the full option chain data as JSON.
      This includes greeks, IV, strike details — things that are too
      complex for individual columns but needed for analysis.
    """

    __tablename__ = "positions"

    # ── Primary Key ──
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # ── Session Reference ──
    session_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    """The trading session this position belongs to."""

    # ── Basic Position Info ──
    symbol: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    """Trading symbol: 'NIFTY', 'BANKNIFTY', etc."""

    direction: Mapped[str] = mapped_column(String(10), nullable=False)
    """Position direction: 'LONG' or 'SHORT'."""

    entry_price: Mapped[float] = mapped_column(Float, nullable=False)
    """Entry price of the underlying."""

    entry_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    """When the position was opened."""

    qty: Mapped[int] = mapped_column(Integer, nullable=False)
    """Quantity being held."""

    # ── Risk Management ──
    sl: Mapped[float] = mapped_column(Float, nullable=False)
    """Current stop loss (may be trailed from original)."""

    target: Mapped[float] = mapped_column(Float, nullable=False)
    """Target price."""

    rr: Mapped[float] = mapped_column(Float, nullable=False)
    """Risk-reward ratio at entry."""

    # ── Position State ──
    held: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    """Number of bars (candles) the position has been held."""

    be_done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    """
    Whether break-even stop loss has been applied.
    WHY? Once a trade moves enough in our favor, we move SL to entry
    price (break-even) to eliminate risk. This flag prevents re-doing it.
    """

    atr_at_entry: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    """
    ATR (Average True Range) value at the time of entry.
    WHY? Used to calculate trailing stop loss distance dynamically.
    """

    opt_entry_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    """
    JSON string with full options entry data (greeks, IV, etc.).
    WHY TEXT? SQLite doesn't have a native JSON type, but PostgreSQL does.
    Using Text works on both. We parse it with json.loads() when needed.
    """

    original_sl: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    """The original stop loss before any trailing. Needed for R:R recalc."""

    status: Mapped[str] = mapped_column(
        String(10), nullable=False, default="open", index=True
    )
    """
    Position status: 'open', 'closed', 'force_closed'.
    WHY INDEXED? We frequently query WHERE status='open'.
    """

    # ── Timestamps ──
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=ist_now
    )
    """When this position was first opened."""

    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=ist_now, onupdate=ist_now
    )
    """When this position was last updated (SL trail, status change, etc.)."""

    # ── Composite Indexes ──
    __table_args__ = (
        # Most common query: "show open positions for this session"
        Index("ix_positions_session_status", "session_id", "status"),
    )

    def __repr__(self) -> str:
        return (
            f"<Position id={self.id} {self.symbol} {self.direction} "
            f"status={self.status}>"
        )


# ============================================================================
# TABLE 3: SESSIONS — Trading session records
# ============================================================================

class Session(Base):
    """
    Trading session record — one row per engine run.

    Each time the trading engine starts, a new Session row is created.
    When the engine stops (gracefully or via crash), the row is updated
    with ending_capital, total_trades, and final status.

    SESSION LIFECYCLE:
      1. Engine starts → INSERT with status='active'
      2. Engine runs → UPDATE updated_at periodically
      3. Engine stops normally → UPDATE status='closed', ending_capital
      4. Engine crashes → UPDATE status='crashed' (if possible)

    CONFIG_JSON:
      We store the full engine configuration as JSON so we can
      reconstruct exactly what parameters were used for any session.
      This is crucial for post-mortem analysis.

    WHY UNIQUE session_id?
      The session_id is a human-readable identifier like 'session_20250103_091500'.
      It's used as a foreign-key-like reference in trades and positions.
      Making it unique prevents accidental duplicate sessions.
    """

    __tablename__ = "sessions"

    # ── Primary Key ──
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # ── Session Identifier ──
    session_id: Mapped[str] = mapped_column(
        String(60), nullable=False, unique=True, index=True
    )
    """
    Unique session identifier. Format: 'session_YYYYMMDD_HHMMSS'.
    WHY UNIQUE + INDEX? We frequently look up sessions by this ID,
    and it serves as the logical foreign key in trades/positions.
    """

    # ── Session Time Range ──
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    """When the session started (engine start time)."""

    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    """When the session ended. NULL if still active."""

    # ── Capital ──
    starting_capital: Mapped[float] = mapped_column(Float, nullable=False)
    """Capital at the start of the session."""

    ending_capital: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    """Capital at the end of the session. NULL if still active."""

    # ── Session Stats ──
    total_trades: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    """Total number of completed trades in this session."""

    total_pnl: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    """Cumulative P&L for this session in rupees."""

    # ── Session Status ──
    status: Mapped[str] = mapped_column(
        String(10), nullable=False, default="active", index=True
    )
    """
    Session status: 'active', 'closed', 'crashed'.
    WHY INDEXED? We frequently query WHERE status='active' for recovery.
    """

    # ── Configuration ──
    config_json: Mapped[str] = mapped_column(Text, nullable=False)
    """
    Full engine configuration as JSON string.
    Captures all strategy parameters used in this session.
    WHY? So we can reconstruct the exact conditions of any past session.
    """

    # ── Timestamps ──
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=ist_now
    )
    """When this session record was created."""

    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=ist_now, onupdate=ist_now
    )
    """When this session was last updated."""

    def __repr__(self) -> str:
        return (
            f"<Session id={self.id} {self.session_id} "
            f"status={self.status} pnl={self.total_pnl:.0f}>"
        )


# ============================================================================
# TABLE 4: CONFIG_OVERRIDES — User config changes
# ============================================================================

class ConfigOverride(Base):
    """
    Persisted config parameter overrides.

    When a user changes a trading parameter via the API
    (PUT /api/v1/config), the change is saved here so it
    survives server restarts.

    WHY A SEPARATE TABLE?
      The engine config (engine/config.py) has 72+ parameters.
      We don't want to modify that file on disk (it's in version control).
      Instead, overrides are stored in the DB and applied at engine start.

    EXAMPLE ROWS:
      key='DAILY_RISK_PCT'     value='4.0'   updated_by='user'
      key='MAX_OPEN_POSITIONS' value='3'     updated_by='system'
      key='TRADE_INDEX'        value='NIFTY' updated_by='user'
    """

    __tablename__ = "config_overrides"

    # ── Primary Key ──
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # ── Config Key-Value ──
    key: Mapped[str] = mapped_column(
        String(50), nullable=False, unique=True, index=True
    )
    """
    Config parameter name (e.g., 'DAILY_RISK_PCT').
    WHY UNIQUE? Each parameter can only have ONE override value.
    """

    value: Mapped[str] = mapped_column(Text, nullable=False)
    """
    Config parameter value as string.
    WHY STRING? Config values can be int, float, bool, or string.
    Storing as string and converting on read is the simplest approach.
    """

    # ── Audit ──
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=ist_now, onupdate=ist_now
    )
    """When this override was last changed."""

    updated_by: Mapped[str] = mapped_column(
        String(20), nullable=False, default="system"
    )
    """
    Who made the change: 'system' or 'user'.
    WHY? Distinguishes auto-adjustments from manual overrides.
    """

    def __repr__(self) -> str:
        return f"<ConfigOverride {self.key}={self.value} by={self.updated_by}>"


# ============================================================================
# TABLE 5: TOKEN_LOG — Kite token exchange history
# ============================================================================

class TokenLog(Base):
    """
    Audit trail for Kite API token exchanges.

    Every time a request token is exchanged for an access token,
    we log it here. This helps with:
      - Debugging authentication issues
      - Tracking when tokens were last refreshed
      - Auditing who accessed the system

    ACCESS TOKEN MASKING:
      We store a MASKED version of the access token (first 4 + last 4 chars).
      NEVER store the full access token in the database — it's a secret.

    WHY LOG FAILED ATTEMPTS?
      Failed token exchanges are just as important as successful ones.
      They indicate:
        - Expired request tokens
        - Wrong API credentials
        - Potential unauthorized access attempts
    """

    __tablename__ = "token_log"

    # ── Primary Key ──
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # ── Token Data ──
    request_token: Mapped[str] = mapped_column(String(100), nullable=False)
    """The request token submitted for exchange (one-time use)."""

    access_token: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    """
    Masked access token received (e.g., 'abcd...xyz1').
    WHY MASKED? Security — full tokens should never be in the DB.
    """

    user_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    """Zerodha user name from the token response."""

    # ── Status ──
    status: Mapped[str] = mapped_column(String(10), nullable=False)
    """
    Exchange result: 'success' or 'failed'.
    WHY NOT BOOLEAN? We might add more statuses later (e.g., 'expired', 'revoked').
    """

    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    """Error message if the exchange failed. NULL if successful."""

    # ── Timestamp ──
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=ist_now, index=True
    )
    """When this token exchange was attempted. Indexed for recent queries."""

    def __repr__(self) -> str:
        return (
            f"<TokenLog id={self.id} status={self.status} "
            f"user={self.user_name}>"
        )


# ============================================================================
# TABLE 6: ERROR_LOG — Error tracking
# ============================================================================

class ErrorLog(Base):
    """
    Application error tracking table.

    All errors from the trading engine, API, and background tasks
    are logged here. This provides:
      - A centralized error view (no need to dig through log files)
      - Error frequency analysis (which errors happen most?)
      - Resolution tracking (mark errors as resolved)
      - Severity classification (warning/error/critical)

    WHY NOT JUST USE LOG FILES?
      Log files are great for development but terrible for:
        - Querying specific error patterns
        - Counting error frequency
        - Tracking resolution status
        - Dashboard display
      This table makes all of those trivial.

    SEVERITY LEVELS:
      warning  — Non-critical, engine continues (e.g., slow API response)
      error    — Operation failed, but engine can recover (e.g., bad candle)
      critical — Engine may need to stop (e.g., token expired, DB down)
    """

    __tablename__ = "error_log"

    # ── Primary Key ──
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # ── Error Classification ──
    error_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    """
    Error type/category (e.g., 'TokenExpiredError', 'ConnectionError').
    WHY INDEXED? We frequently group errors by type for analysis.
    """

    error_message: Mapped[str] = mapped_column(Text, nullable=False)
    """The main error message (first line of the exception)."""

    stack_trace: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    """
    Full Python stack trace. NULL if not available.
    WHY? Stack traces are essential for debugging but can be very long.
    """

    module: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    """
    Which module raised the error (e.g., 'signal_engine', 'data_fetcher').
    WHY? Helps narrow down where to look in the codebase.
    """

    severity: Mapped[str] = mapped_column(
        String(10), nullable=False, default="error", index=True
    )
    """
    Severity: 'warning', 'error', or 'critical'.
    WHY INDEXED? We frequently filter by severity (e.g., "show all critical errors").
    """

    # ── Resolution ──
    resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    """
    Whether this error has been investigated and resolved.
    WHY? Prevents the same error from being investigated twice.
    """

    # ── Timestamp ──
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=ist_now, index=True
    )
    """When this error occurred. Indexed for time-range queries."""

    # ── Composite Indexes ──
    __table_args__ = (
        # Common query: "show unresolved errors by severity"
        Index("ix_errors_severity_resolved", "severity", "resolved"),
    )

    def __repr__(self) -> str:
        return (
            f"<ErrorLog id={self.id} {self.error_type} "
            f"severity={self.severity} resolved={self.resolved}>"
        )
