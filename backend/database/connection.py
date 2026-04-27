#!/usr/bin/env python3
"""
DDLJ Trading System — Database Connection Manager
====================================================

Dual-database connection manager that transparently supports:
  - **Supabase PostgreSQL** (production): when DATABASE_URL is set
  - **Local SQLite** (development fallback): when DATABASE_URL is empty

WHY DUAL DATABASE?
  In production on Railway, we connect to Supabase PostgreSQL for
  durability, backups, and multi-instance access. But during local
  development, we want ZERO setup — just `uvicorn main:app` and go.
  SQLite gives us that: a file-based database that auto-creates
  on first run with no external services needed.

HOW IT WORKS:
  1. On import, reads DATABASE_URL from core.config
  2. If DATABASE_URL is set → creates async PostgreSQL engine (asyncpg)
  3. If DATABASE_URL is empty → creates async SQLite engine (aiosqlite)
  4. Both use the same SQLAlchemy ORM models — zero code changes
  5. SQLite files are stored in backend/data/ddlj.db (auto-created)

CONNECTION POOL CONFIG:
  - PostgreSQL: pool_size=5, max_overflow=10 (handles burst traffic)
  - SQLite: no pool (single-writer limitation), but StaticPool for
    in-memory testing if needed

THREAD SAFETY:
  - SQLAlchemy async engines are thread-safe by design
  - SQLite uses WAL mode for concurrent reads
  - All session operations are async (no blocking I/O)

Author: DDLJ Strategy Team
Version: 10.2.0
"""

from __future__ import annotations

import os
import logging
from pathlib import Path
from typing import AsyncGenerator, Optional
from urllib.parse import urlparse, quote_plus

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

# ── Import app config (centralized env var reading) ──
from core.config import DATABASE_URL, DATABASE_POOL_SIZE, DATABASE_ECHO, IS_PRODUCTION

log = logging.getLogger("ddlj_backend")


# ============================================================================
# CONSTANTS
# ============================================================================

# SQLite database directory and file path
# WHY: We put the SQLite file inside backend/data/ so it's gitignored
#      and doesn't pollute the project root.
_SQLITE_DIR = Path(__file__).resolve().parent.parent / "data"
_SQLITE_PATH = _SQLITE_DIR / "ddlj.db"
_SQLITE_URL = f"sqlite+aiosqlite:///{_SQLITE_PATH}"


# ============================================================================
# MODULE-LEVEL STATE (singleton pattern)
# ============================================================================

_engine: Optional[AsyncEngine] = None
"""The global async engine instance. Created once, reused everywhere."""

_session_factory: Optional[async_sessionmaker[AsyncSession]] = None
"""The global session factory. Creates new AsyncSession instances."""

_db_type: str = "unknown"
"""Tracks which database backend is active: 'postgresql' or 'sqlite'."""


# ============================================================================
# ENGINE CREATION
# ============================================================================

def get_engine() -> AsyncEngine:
    """
    Get or create the async database engine.

    This is a LAZY singleton — the engine is only created on first call.
    Subsequent calls return the same engine instance.

    Returns:
        AsyncEngine: The SQLAlchemy async engine connected to either
                     PostgreSQL (production) or SQLite (development).

    WHY LAZY?
      If we created the engine at import time, it would try to connect
      immediately, even during `pytest` collection or `import` statements.
      Lazy creation means the DB only connects when actually needed.

    Raises:
        RuntimeError: If engine creation fails (bad URL, driver missing).
    """
    global _engine, _db_type

    if _engine is not None:
        return _engine

    try:
        if DATABASE_URL:
            # ── PRODUCTION: Supabase PostgreSQL ──
            _db_type = "postgresql"
            log.info(
                "Database: PostgreSQL (Supabase) — pool_size=%d",
                DATABASE_POOL_SIZE,
            )

            # Convert the standard postgres:// URL to postgresql+asyncpg://
            # WHY: Supabase gives us `postgresql://...` but SQLAlchemy's
            #      async driver needs `postgresql+asyncpg://...`
            #
            # IMPORTANT: We also sanitize the URL to handle special characters
            # in the password (e.g., @, [, ], etc.) which would break URL parsing.
            # Example: password "[IndianShit@123]" → "%5BIndianShit%40123%5D"
            url = DATABASE_URL
            if url.startswith("postgresql://") or url.startswith("postgres://"):
                try:
                    parsed = urlparse(url)
                    # Rebuild the URL with properly encoded credentials
                    safe_user = quote_plus(parsed.username or "")
                    safe_password = quote_plus(parsed.password or "")
                    host = parsed.hostname or ""
                    port = parsed.port or 5432
                    database = parsed.path.lstrip("/") or "postgres"
                    url = f"postgresql+asyncpg://{safe_user}:{safe_password}@{host}:{port}/{database}"
                except Exception:
                    # Fallback: simple prefix replacement if URL parsing fails
                    if url.startswith("postgresql://"):
                        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
                    else:
                        url = url.replace("postgres://", "postgresql+asyncpg://", 1)

            _engine = create_async_engine(
                url,
                pool_size=DATABASE_POOL_SIZE,
                max_overflow=10,        # Allow 10 extra connections during bursts
                pool_timeout=30,        # Wait 30s for a connection from pool
                pool_recycle=1800,      # Recycle connections after 30 min
                pool_pre_ping=True,     # Verify connections before use
                echo=DATABASE_ECHO,     # Log SQL statements in dev mode
            )
        else:
            # ── DEVELOPMENT: Local SQLite ──
            _db_type = "sqlite"
            log.info("Database: SQLite (local development) — path=%s", _SQLITE_PATH)

            # Auto-create the directory for the SQLite file
            # WHY: First-time developers would get a confusing error
            #      if the directory doesn't exist. We create it for them.
            _SQLITE_DIR.mkdir(parents=True, exist_ok=True)

            _engine = create_async_engine(
                _SQLITE_URL,
                echo=DATABASE_ECHO,
                # SQLite-specific connection args
                connect_args={
                    "check_same_thread": False,  # Allow cross-thread usage
                },
            )

        log.info("Database engine created successfully (type=%s)", _db_type)
        return _engine

    except Exception as e:
        log.error("Failed to create database engine: %s", e)
        raise RuntimeError(f"Database engine creation failed: {e}") from e


# ============================================================================
# SESSION FACTORY
# ============================================================================

def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """
    Get or create the async session factory.

    The session factory produces AsyncSession instances that are bound
    to the engine. Each API request should get its own session.

    Returns:
        async_sessionmaker[AsyncSession]: Factory for creating sessions.

    USAGE:
        factory = get_session_factory()
        async with factory() as session:
            result = await session.execute(select(Trade))
    """
    global _session_factory

    if _session_factory is not None:
        return _session_factory

    engine = get_engine()
    _session_factory = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,  # WHY: Allows accessing attributes after commit
    )

    log.info("Database session factory created")
    return _session_factory


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency that yields a database session.

    This is the PRIMARY way API routes get a database session:
        @router.get("/trades")
        async def get_trades(db: AsyncSession = Depends(get_session)):
            ...

    The session is automatically closed when the request completes,
    even if an exception occurs (via the async context manager).

    Yields:
        AsyncSession: A database session for the current request.

    WHY DEPENDENCY INJECTION?
      - Each request gets its own session (no shared state)
      - Session is auto-closed after the request (no leaks)
      - Easy to mock in tests (swap the dependency)
    """
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ============================================================================
# DATABASE INITIALIZATION
# ============================================================================

async def init_db() -> None:
    """
    Initialize the database — create all tables if they don't exist.

    This is called ONCE at application startup. It uses SQLAlchemy's
    metadata to CREATE TABLE for all models defined in models.py.

    WHY NOT ALEMBIC MIGRATIONS (yet)?
      For v1, we use create_all() which is idempotent — it only creates
      tables that don't already exist. This is simpler than setting up
      Alembic for a new project. Once we need schema migrations
      (altering columns, adding indexes), we'll add Alembic.

    IMPORTANT: This does NOT drop existing tables or data.
    """
    from database.models import Base  # Import here to avoid circular imports

    engine = get_engine()

    try:
        from sqlalchemy import text  # Import once at top of function

        async with engine.begin() as conn:
            # Enable SQLite WAL mode for better concurrent read performance
            # WHY: WAL (Write-Ahead Logging) allows readers and one writer
            #      to operate simultaneously without blocking each other.
            if _db_type == "sqlite":
                await conn.execute(text("PRAGMA journal_mode=WAL"))
                await conn.execute(text("PRAGMA synchronous=NORMAL"))
                await conn.execute(text("PRAGMA foreign_keys=ON"))
                log.info("SQLite pragmas applied (WAL, NORMAL sync, FK ON)")

            # Create all tables defined in Base.metadata
            await conn.run_sync(Base.metadata.create_all)

        log.info("Database initialized — all tables created/verified")

    except Exception as e:
        log.error("Failed to initialize database: %s", e)
        raise RuntimeError(f"Database initialization failed: {e}") from e


# ============================================================================
# DATABASE CLEANUP
# ============================================================================

async def close_db() -> None:
    """
    Close the database engine and release all connections.

    This is called ONCE at application shutdown (in the lifespan handler).
    It properly disposes of the connection pool and releases resources.

    WHY EXPLICIT CLOSE?
      Python's garbage collector might not close connections immediately,
      especially with async code. Explicit cleanup ensures:
      - All pooled connections are returned to the DB server
      - SQLite WAL files are checkpointed
      - No "connection leak" warnings in logs
    """
    global _engine, _session_factory

    if _engine is not None:
        try:
            await _engine.dispose()
            log.info("Database engine disposed (type=%s)", _db_type)
        except Exception as e:
            log.error("Error disposing database engine: %s", e)
        finally:
            _engine = None
            _session_factory = None


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def get_db_type() -> str:
    """
    Return the current database type.

    Returns:
        str: 'postgresql' or 'sqlite'
    """
    return _db_type


def is_sqlite() -> bool:
    """
    Check if we're running on SQLite (development mode).

    Returns:
        bool: True if using SQLite, False if using PostgreSQL.

    WHY?
      Some queries need different syntax for SQLite vs PostgreSQL.
      For example, datetime functions differ. This lets us branch.
    """
    return _db_type == "sqlite"


def get_db_info() -> dict:
    """
    Return database connection information for health checks.

    This is used by the /api/v1/health endpoint to report DB status.

    Returns:
        dict: Database type, connection status, and pool info.
    """
    info = {
        "db_type": _db_type,
        "configured": bool(DATABASE_URL),
        "engine_created": _engine is not None,
    }

    if _engine is not None:
        pool = _engine.pool
        info.update({
            "pool_size": pool.size(),
            "pool_checked_out": pool.checkedout(),
            "pool_overflow": pool.overflow(),
        })

    if _db_type == "sqlite":
        info["sqlite_path"] = str(_SQLITE_PATH)
        info["sqlite_exists"] = _SQLITE_PATH.exists()

    return info
