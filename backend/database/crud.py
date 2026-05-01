#!/usr/bin/env python3
"""
DDLJ Trading System — CRUD Operations
========================================

Async CRUD (Create, Read, Update, Delete) operations for all database
tables. These are the ONLY functions that should touch the database —
all other modules (API routes, engine, services) call these functions.

DESIGN PRINCIPLES:
  1. All functions are async — no blocking I/O in a FastAPI app
  2. All functions accept an AsyncSession parameter — the caller
     controls the session lifecycle (dependency injection)
  3. All functions have proper type hints and docstrings
  4. All functions handle errors gracefully and log them
  5. No raw SQL — use SQLAlchemy ORM for portability

USAGE IN API ROUTES:
    from database.crud import get_trades
    from database.connection import get_session

    @router.get("/trades")
    async def list_trades(db: AsyncSession = Depends(get_session)):
        trades = await get_trades(db)
        return {"trades": trades}

WHY SEPARATE CRUD MODULE?
  - Separation of concerns: API routes handle HTTP, CRUD handles DB
  - Testability: Mock CRUD functions instead of the entire DB
  - Reusability: Multiple routes can call the same CRUD function
  - Consistency: All DB access follows the same patterns

Author: DDLJ Strategy Team
Version: 10.2.0
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Optional, Sequence

from sqlalchemy import select, update, delete, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import (
    Trade,
    Position,
    Session,
    ConfigOverride,
    TokenLog,
    ErrorLog,
    ist_now,
)

log = logging.getLogger("ddlj_backend")


# ============================================================================
# TRADES CRUD
# ============================================================================

async def create_trade(
    db: AsyncSession,
    *,
    session_id: str,
    symbol: str,
    direction: str,
    entry_price: float,
    exit_price: float,
    entry_time: datetime,
    exit_time: datetime,
    sl: float,
    target: float,
    qty: int,
    gross_pnl: float,
    costs: float,
    net_pnl: float,
    exit_reason: str,
    rr: float,
    mode: str = "futures",
    option_strike: Optional[float] = None,
    option_type: Optional[str] = None,
    option_entry_premium: Optional[float] = None,
    option_exit_premium: Optional[float] = None,
    option_delta: Optional[float] = None,
    option_iv_entry: Optional[float] = None,
    option_iv_exit: Optional[float] = None,
) -> Trade:
    """
    Insert a new completed trade record.

    This is called when a position is closed — the trade data is
    finalized and stored for historical analysis.

    Args:
        db: AsyncSession — the database session.
        session_id: The trading session this trade belongs to.
        symbol: Trading symbol (e.g., 'NIFTY', 'BANKNIFTY').
        direction: 'LONG' or 'SHORT'.
        entry_price: Entry price of the underlying.
        exit_price: Exit price of the underlying.
        entry_time: When the trade was entered.
        exit_time: When the trade was exited.
        sl: Stop loss price at exit (may have been trailed).
        target: Target price at entry.
        qty: Quantity traded.
        gross_pnl: Gross profit/loss in rupees.
        costs: Total transaction costs in rupees.
        net_pnl: Net profit/loss in rupees.
        exit_reason: Why the trade was closed.
        rr: Risk-reward ratio at entry.
        mode: 'futures' or 'options'.
        option_strike: Strike price (options only).
        option_type: 'CE' or 'PE' (options only).
        option_entry_premium: Entry premium (options only).
        option_exit_premium: Exit premium (options only).
        option_delta: Delta at entry (options only).
        option_iv_entry: IV at entry (options only).
        option_iv_exit: IV at exit (options only).

    Returns:
        Trade: The newly created Trade ORM object.

    Raises:
        Exception: If the database insert fails.
    """
    trade = Trade(
        session_id=session_id,
        symbol=symbol,
        direction=direction,
        entry_price=entry_price,
        exit_price=exit_price,
        entry_time=entry_time,
        exit_time=exit_time,
        sl=sl,
        target=target,
        qty=qty,
        gross_pnl=gross_pnl,
        costs=costs,
        net_pnl=net_pnl,
        exit_reason=exit_reason,
        rr=rr,
        mode=mode,
        option_strike=option_strike,
        option_type=option_type,
        option_entry_premium=option_entry_premium,
        option_exit_premium=option_exit_premium,
        option_delta=option_delta,
        option_iv_entry=option_iv_entry,
        option_iv_exit=option_iv_exit,
        created_at=ist_now(),
    )
    db.add(trade)
    await db.flush()  # WHY flush? Gets the auto-generated ID without committing
    log.info(
        "Trade recorded: %s %s %s entry=%.1f exit=%.1f net_pnl=%.1f reason=%s",
        session_id, symbol, direction, entry_price, exit_price,
        net_pnl, exit_reason,
    )
    return trade


async def get_trades(
    db: AsyncSession,
    *,
    limit: int = 50,
    offset: int = 0,
    symbol: Optional[str] = None,
    mode: Optional[str] = None,
) -> Sequence[Trade]:
    """
    Retrieve completed trades with optional filtering and pagination.

    Args:
        db: AsyncSession — the database session.
        limit: Maximum number of trades to return. Default 50.
        offset: Number of trades to skip (for pagination). Default 0.
        symbol: Filter by trading symbol. None = all symbols.
        mode: Filter by trade mode ('futures'/'options'). None = all.

    Returns:
        Sequence[Trade]: List of Trade objects, most recent first.
    """
    stmt = select(Trade).order_by(desc(Trade.exit_time))

    if symbol:
        stmt = stmt.where(Trade.symbol == symbol)
    if mode:
        stmt = stmt.where(Trade.mode == mode)

    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_trades_by_session(
    db: AsyncSession,
    session_id: str,
) -> Sequence[Trade]:
    """
    Retrieve all trades for a specific trading session.

    Args:
        db: AsyncSession — the database session.
        session_id: The session to fetch trades for.

    Returns:
        Sequence[Trade]: List of trades for the session, ordered by exit time.
    """
    stmt = (
        select(Trade)
        .where(Trade.session_id == session_id)
        .order_by(Trade.exit_time)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


# ============================================================================
# POSITIONS CRUD
# ============================================================================

async def create_position(
    db: AsyncSession,
    *,
    session_id: str,
    symbol: str,
    direction: str,
    entry_price: float,
    entry_time: datetime,
    qty: int,
    sl: float,
    target: float,
    rr: float,
    held: int = 0,
    be_done: bool = False,
    atr_at_entry: float = 0.0,
    opt_entry_json: Optional[str] = None,
    original_sl: float = 0.0,
) -> Position:
    """
    Insert a new open position.

    Called when the trading engine enters a new trade.

    Args:
        db: AsyncSession — the database session.
        session_id: The trading session this position belongs to.
        symbol: Trading symbol.
        direction: 'LONG' or 'SHORT'.
        entry_price: Entry price of the underlying.
        entry_time: When the position was opened.
        qty: Quantity being held.
        sl: Initial stop loss price.
        target: Target price.
        rr: Risk-reward ratio at entry.
        held: Number of bars held (default 0 at entry).
        be_done: Whether break-even SL has been applied.
        atr_at_entry: ATR value at entry time.
        opt_entry_json: Options entry data as JSON string.
        original_sl: Original stop loss (before trailing).

    Returns:
        Position: The newly created Position ORM object.
    """
    position = Position(
        session_id=session_id,
        symbol=symbol,
        direction=direction,
        entry_price=entry_price,
        entry_time=entry_time,
        qty=qty,
        sl=sl,
        target=target,
        rr=rr,
        held=held,
        be_done=be_done,
        atr_at_entry=atr_at_entry,
        opt_entry_json=opt_entry_json,
        original_sl=original_sl or sl,
        status="open",
        created_at=ist_now(),
        updated_at=ist_now(),
    )
    db.add(position)
    await db.flush()
    log.info(
        "Position opened: %s %s %s entry=%.1f sl=%.1f target=%.1f",
        session_id, symbol, direction, entry_price, sl, target,
    )
    return position


async def get_open_positions(
    db: AsyncSession,
    *,
    session_id: Optional[str] = None,
) -> Sequence[Position]:
    """
    Retrieve all currently open positions.

    Optionally filter by session_id. Only returns status='open'.

    Args:
        db: AsyncSession — the database session.
        session_id: Filter by session. None = all sessions.

    Returns:
        Sequence[Position]: List of open Position objects.
    """
    stmt = (
        select(Position)
        .where(Position.status == "open")
        .order_by(desc(Position.entry_time))
    )
    if session_id:
        stmt = stmt.where(Position.session_id == session_id)

    result = await db.execute(stmt)
    return result.scalars().all()


async def close_position(
    db: AsyncSession,
    position_id: int,
    *,
    status: str = "closed",
) -> Optional[Position]:
    """
    Mark a position as closed.

    This is called when a trade is exited. The position is marked
    as 'closed' (or 'force_closed' for EOD exits). A corresponding
    Trade row should also be created via create_trade().

    WHY NOT DELETE?
      We keep closed positions for a short time for audit/debugging.
      They can be cleaned up later by a maintenance job.

    Args:
        db: AsyncSession — the database session.
        position_id: The ID of the position to close.
        status: New status ('closed' or 'force_closed'). Default 'closed'.

    Returns:
        Position: The updated Position object, or None if not found.
    """
    stmt = select(Position).where(Position.id == position_id)
    result = await db.execute(stmt)
    position = result.scalar_one_or_none()

    if position is None:
        log.warning("close_position: position id=%d not found", position_id)
        return None

    position.status = status
    position.updated_at = ist_now()
    await db.flush()

    log.info(
        "Position closed: id=%d %s %s status=%s",
        position_id, position.symbol, position.direction, status,
    )
    return position


# ============================================================================
# SESSIONS CRUD
# ============================================================================

async def create_session(
    db: AsyncSession,
    *,
    session_id: str,
    start_time: datetime,
    starting_capital: float,
    config_json: str,
) -> Session:
    """
    Create a new trading session record.

    Called when the trading engine starts.

    Args:
        db: AsyncSession — the database session.
        session_id: Unique session identifier (e.g., 'session_20250103_091500').
        start_time: When the session started.
        starting_capital: Capital at the start of the session.
        config_json: Full engine configuration as JSON string.

    Returns:
        Session: The newly created Session ORM object.

    Raises:
        Exception: If a session with the same session_id already exists.
    """
    session = Session(
        session_id=session_id,
        start_time=start_time,
        starting_capital=starting_capital,
        config_json=config_json,
        status="active",
        total_trades=0,
        total_pnl=0.0,
        created_at=ist_now(),
        updated_at=ist_now(),
    )
    db.add(session)
    await db.flush()
    log.info(
        "Session created: %s capital=%.0f",
        session_id, starting_capital,
    )
    return session


async def get_active_session(db: AsyncSession) -> Optional[Session]:
    """
    Get the currently active trading session (if any).

    There should be at most one active session at a time.
    If multiple exist (due to a crash), returns the most recent one.

    Args:
        db: AsyncSession — the database session.

    Returns:
        Session: The active session, or None if no session is active.
    """
    stmt = (
        select(Session)
        .where(Session.status == "active")
        .order_by(desc(Session.start_time))
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def close_session(
    db: AsyncSession,
    session_id: str,
    *,
    ending_capital: float,
    total_trades: int,
    total_pnl: float,
    status: str = "closed",
) -> Optional[Session]:
    """
    Mark a trading session as closed and record final stats.

    Called when the engine stops (gracefully or via crash recovery).

    Args:
        db: AsyncSession — the database session.
        session_id: The session to close.
        ending_capital: Final capital at session end.
        total_trades: Total number of completed trades.
        total_pnl: Cumulative P&L for the session.
        status: Final status ('closed' or 'crashed'). Default 'closed'.

    Returns:
        Session: The updated Session object, or None if not found.
    """
    stmt = select(Session).where(Session.session_id == session_id)
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()

    if session is None:
        log.warning("close_session: session %s not found", session_id)
        return None

    session.end_time = ist_now()
    session.ending_capital = ending_capital
    session.total_trades = total_trades
    session.total_pnl = total_pnl
    session.status = status
    session.updated_at = ist_now()
    await db.flush()

    log.info(
        "Session closed: %s status=%s trades=%d pnl=%.0f capital=%.0f",
        session_id, status, total_trades, total_pnl, ending_capital,
    )
    return session


async def get_sessions(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
    status: Optional[str] = None,
) -> Sequence[Session]:
    """
    Retrieve trading sessions with optional filtering and pagination.

    Args:
        db: AsyncSession — the database session.
        limit: Maximum number of sessions to return. Default 20.
        offset: Number of sessions to skip. Default 0.
        status: Filter by status ('active'/'closed'/'crashed'). None = all.

    Returns:
        Sequence[Session]: List of Session objects, most recent first.
    """
    stmt = select(Session).order_by(desc(Session.start_time))

    if status:
        stmt = stmt.where(Session.status == status)

    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


# ============================================================================
# CONFIG_OVERRIDES CRUD
# ============================================================================

async def save_config_override(
    db: AsyncSession,
    *,
    key: str,
    value: str,
    updated_by: str = "system",
) -> ConfigOverride:
    """
    Save or update a config parameter override.

    If the key already exists, the value is updated (upsert behavior).
    If the key doesn't exist, a new row is inserted.

    Args:
        db: AsyncSession — the database session.
        key: Config parameter name (e.g., 'DAILY_RISK_PCT').
        value: Config parameter value as string.
        updated_by: Who made the change ('system' or 'user').

    Returns:
        ConfigOverride: The created or updated ConfigOverride object.
    """
    # Check if key already exists
    stmt = select(ConfigOverride).where(ConfigOverride.key == key)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        existing.value = value
        existing.updated_by = updated_by
        existing.updated_at = ist_now()
        await db.flush()
        log.info("Config override updated: %s=%s by=%s", key, value, updated_by)
        return existing
    else:
        override = ConfigOverride(
            key=key,
            value=value,
            updated_by=updated_by,
            updated_at=ist_now(),
        )
        db.add(override)
        await db.flush()
        log.info("Config override created: %s=%s by=%s", key, value, updated_by)
        return override


async def get_config_overrides(
    db: AsyncSession,
) -> Sequence[ConfigOverride]:
    """
    Retrieve all config overrides.

    Returns all overrides ordered by key name for consistent display.

    Args:
        db: AsyncSession — the database session.

    Returns:
        Sequence[ConfigOverride]: List of all config overrides.
    """
    stmt = select(ConfigOverride).order_by(ConfigOverride.key)
    result = await db.execute(stmt)
    return result.scalars().all()


# ============================================================================
# TOKEN_LOG CRUD
# ============================================================================

async def log_token_exchange(
    db: AsyncSession,
    *,
    request_token: str,
    access_token: str = "",
    user_name: str = "",
    status: str,
    error_message: Optional[str] = None,
) -> TokenLog:
    """
    Record a Kite token exchange attempt (success or failure).

    This creates an audit trail for authentication events.

    Args:
        db: AsyncSession — the database session.
        request_token: The one-time request token that was submitted.
        access_token: Masked access token received (e.g., 'abcd...xyz1').
                      Empty string if exchange failed.
        user_name: Zerodha user name from the response. Empty if failed.
        status: 'success' or 'failed'.
        error_message: Error message if the exchange failed. None if success.

    Returns:
        TokenLog: The newly created TokenLog object.
    """
    token_log = TokenLog(
        request_token=request_token,
        access_token=access_token,
        user_name=user_name,
        status=status,
        error_message=error_message,
        created_at=ist_now(),
    )
    db.add(token_log)
    await db.flush()
    log.info(
        "Token exchange logged: status=%s user=%s",
        status, user_name or "(none)",
    )
    return token_log


async def get_token_log(
    db: AsyncSession,
    *,
    limit: int = 20,
    offset: int = 0,
) -> Sequence[TokenLog]:
    """
    Retrieve recent token exchange log entries.

    Args:
        db: AsyncSession — the database session.
        limit: Maximum number of entries to return. Default 20.
        offset: Number of entries to skip. Default 0.

    Returns:
        Sequence[TokenLog]: List of token log entries, most recent first.
    """
    stmt = (
        select(TokenLog)
        .order_by(desc(TokenLog.created_at))
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


# ============================================================================
# ERROR_LOG CRUD
# ============================================================================

async def log_error(
    db: AsyncSession,
    *,
    error_type: str,
    error_message: str,
    stack_trace: Optional[str] = None,
    module: Optional[str] = None,
    severity: str = "error",
) -> ErrorLog:
    """
    Record an application error.

    This is the centralized error logging function. All modules should
    call this (in addition to Python's logging) to ensure errors are
    queryable from the dashboard.

    Args:
        db: AsyncSession — the database session.
        error_type: Error class name (e.g., 'TokenExpiredError').
        error_message: The main error message.
        stack_trace: Full Python stack trace. None if not available.
        module: Which module raised the error (e.g., 'signal_engine').
        severity: 'warning', 'error', or 'critical'. Default 'error'.

    Returns:
        ErrorLog: The newly created ErrorLog object.
    """
    error_log = ErrorLog(
        error_type=error_type,
        error_message=error_message,
        stack_trace=stack_trace,
        module=module,
        severity=severity,
        resolved=False,
        created_at=ist_now(),
    )
    db.add(error_log)
    await db.flush()
    log.error(
        "Error logged: type=%s severity=%s module=%s msg=%.100s",
        error_type, severity, module or "(none)", error_message,
    )
    return error_log


async def get_errors(
    db: AsyncSession,
    *,
    limit: int = 50,
    offset: int = 0,
    severity: Optional[str] = None,
    resolved: Optional[bool] = None,
    module: Optional[str] = None,
) -> Sequence[ErrorLog]:
    """
    Retrieve error log entries with optional filtering.

    Args:
        db: AsyncSession — the database session.
        limit: Maximum number of errors to return. Default 50.
        offset: Number of errors to skip. Default 0.
        severity: Filter by severity ('warning'/'error'/'critical'). None = all.
        resolved: Filter by resolution status. None = all.
        module: Filter by source module. None = all.

    Returns:
        Sequence[ErrorLog]: List of error log entries, most recent first.
    """
    stmt = select(ErrorLog).order_by(desc(ErrorLog.created_at))

    if severity:
        stmt = stmt.where(ErrorLog.severity == severity)
    if resolved is not None:
        stmt = stmt.where(ErrorLog.resolved == resolved)
    if module:
        stmt = stmt.where(ErrorLog.module == module)

    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


async def resolve_error(
    db: AsyncSession,
    error_id: int,
) -> Optional[ErrorLog]:
    """
    Mark an error as resolved.

    Args:
        db: AsyncSession — the database session.
        error_id: The ID of the error to resolve.

    Returns:
        ErrorLog: The updated ErrorLog object, or None if not found.
    """
    stmt = select(ErrorLog).where(ErrorLog.id == error_id)
    result = await db.execute(stmt)
    error_entry = result.scalar_one_or_none()

    if error_entry is None:
        log.warning("resolve_error: error id=%d not found", error_id)
        return None

    error_entry.resolved = True
    await db.flush()

    log.info(
        "Error resolved: id=%d type=%s",
        error_id, error_entry.error_type,
    )
    return error_entry


# ============================================================================
# UTILITY — Count helpers for dashboard stats
# ============================================================================

async def count_trades(db: AsyncSession, session_id: Optional[str] = None) -> int:
    """
    Count total trades, optionally filtered by session.

    Args:
        db: AsyncSession — the database session.
        session_id: Filter by session. None = count all trades.

    Returns:
        int: Number of trades.
    """
    stmt = select(func.count(Trade.id))
    if session_id:
        stmt = stmt.where(Trade.session_id == session_id)
    result = await db.execute(stmt)
    return result.scalar_one()


async def count_open_positions(db: AsyncSession) -> int:
    """
    Count currently open positions.

    Args:
        db: AsyncSession — the database session.

    Returns:
        int: Number of open positions.
    """
    stmt = select(func.count(Position.id)).where(Position.status == "open")
    result = await db.execute(stmt)
    return result.scalar_one()


async def count_unresolved_errors(db: AsyncSession) -> int:
    """
    Count unresolved errors, grouped by severity.

    Args:
        db: AsyncSession — the database session.

    Returns:
        int: Number of unresolved errors.
    """
    stmt = select(func.count(ErrorLog.id)).where(ErrorLog.resolved == False)  # noqa: E712
    result = await db.execute(stmt)
    return result.scalar_one()


async def get_session_pnl_summary(
    db: AsyncSession,
    session_id: str,
) -> dict:
    """
    Get P&L summary statistics for a trading session.

    Returns total trades, total P&L, win rate, and average R:R.

    Args:
        db: AsyncSession — the database session.
        session_id: The session to summarize.

    Returns:
        dict: Summary stats with keys:
            - total_trades (int)
            - total_pnl (float)
            - winning_trades (int)
            - losing_trades (int)
            - win_rate (float)
            - avg_rr (float)
    """
    trades = await get_trades_by_session(db, session_id)

    if not trades:
        return {
            "total_trades": 0,
            "total_pnl": 0.0,
            "winning_trades": 0,
            "losing_trades": 0,
            "win_rate": 0.0,
            "avg_rr": 0.0,
        }

    total = len(trades)
    total_pnl = sum(t.net_pnl for t in trades)
    winning = sum(1 for t in trades if t.net_pnl > 0)
    losing = sum(1 for t in trades if t.net_pnl <= 0)
    win_rate = (winning / total * 100) if total > 0 else 0.0
    avg_rr = sum(t.rr for t in trades) / total if total > 0 else 0.0

    return {
        "total_trades": total,
        "total_pnl": round(total_pnl, 2),
        "winning_trades": winning,
        "losing_trades": losing,
        "win_rate": round(win_rate, 2),
        "avg_rr": round(avg_rr, 2),
    }
