#!/usr/bin/env python3
"""
DDLJ Trading System — Database Package
========================================

Centralized database access layer for the DDLJ trading system.

This package provides:
  - **connection**: Database engine, session factory, init/close lifecycle
  - **models**: SQLAlchemy ORM models for all 6 tables
  - **crud**: Async CRUD operations for all tables

QUICK START:
    from database import init_db, close_db, get_session
    from database.crud import get_trades, create_trade

    # At startup:
    await init_db()

    # In API routes:
    async with get_session() as session:
        trades = await get_trades(session, limit=10)

    # At shutdown:
    await close_db()

WHY THIS STRUCTURE?
  - connection.py: Infrastructure (engine, pool, session factory)
  - models.py: Schema definition (tables, columns, indexes)
  - crud.py: Business logic (queries, inserts, updates)
  - migrations/: SQL scripts for manual Supabase deployment

  This separation follows the "layered architecture" pattern:
  API routes → CRUD operations → Models → Connection

Author: DDLJ Strategy Team
Version: 10.2.0
"""

# ── Connection lifecycle functions ──
from database.connection import (
    get_engine,
    get_session_factory,
    get_session,
    init_db,
    close_db,
    get_db_type,
    is_sqlite,
    get_db_info,
)

# ── ORM models (for type hints and direct queries) ──
from database.models import (
    Base,
    Trade,
    Position,
    Session,
    ConfigOverride,
    TokenLog,
    ErrorLog,
    ist_now,
    IST,
)

# ── CRUD operations ──
from database.crud import (
    # Trades
    create_trade,
    get_trades,
    get_trades_by_session,
    # Positions
    create_position,
    get_open_positions,
    close_position,
    # Sessions
    create_session,
    get_active_session,
    close_session,
    get_sessions,
    # Config overrides
    save_config_override,
    get_config_overrides,
    # Token log
    log_token_exchange,
    get_token_log,
    # Error log
    log_error,
    get_errors,
    resolve_error,
    # Utility
    count_trades,
    count_open_positions,
    count_unresolved_errors,
    get_session_pnl_summary,
)

__all__ = [
    # Connection
    "get_engine",
    "get_session_factory",
    "get_session",
    "init_db",
    "close_db",
    "get_db_type",
    "is_sqlite",
    "get_db_info",
    # Models
    "Base",
    "Trade",
    "Position",
    "Session",
    "ConfigOverride",
    "TokenLog",
    "ErrorLog",
    "ist_now",
    "IST",
    # CRUD — Trades
    "create_trade",
    "get_trades",
    "get_trades_by_session",
    # CRUD — Positions
    "create_position",
    "get_open_positions",
    "close_position",
    # CRUD — Sessions
    "create_session",
    "get_active_session",
    "close_session",
    "get_sessions",
    # CRUD — Config
    "save_config_override",
    "get_config_overrides",
    # CRUD — Token
    "log_token_exchange",
    "get_token_log",
    # CRUD — Errors
    "log_error",
    "get_errors",
    "resolve_error",
    # CRUD — Utility
    "count_trades",
    "count_open_positions",
    "count_unresolved_errors",
    "get_session_pnl_summary",
]
