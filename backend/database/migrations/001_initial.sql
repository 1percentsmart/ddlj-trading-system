-- ============================================================================
-- DDLJ Trading System — Initial Database Schema (Migration 001)
-- ============================================================================
--
-- This SQL script creates all tables for the DDLJ trading system.
-- It is designed for manual execution on Supabase PostgreSQL.
--
-- For local development, SQLAlchemy's create_all() handles table creation
-- automatically (see database/connection.py::init_db).
--
-- HOW TO RUN ON SUPABASE:
--   1. Go to Supabase Dashboard → SQL Editor
--   2. Paste this entire script
--   3. Click "Run"
--
-- IMPORTANT NOTES:
--   - All timestamps use TIMESTAMPTZ (timezone-aware) in PostgreSQL
--   - IST timezone is enforced at the APPLICATION level, not the DB level
--   - Indexes are created explicitly for common query patterns
--   - UUIDs are NOT used — we use auto-incrementing integers for simplicity
--
-- Author: DDLJ Strategy Team
-- Version: 10.2.0
-- ============================================================================


-- ============================================================================
-- TABLE 1: TRADES — Completed trade history
-- ============================================================================

CREATE TABLE IF NOT EXISTS trades (
    id                  SERIAL PRIMARY KEY,
    session_id          VARCHAR(50) NOT NULL,
    symbol              VARCHAR(20) NOT NULL,
    direction           VARCHAR(10) NOT NULL,
    entry_price         DOUBLE PRECISION NOT NULL,
    exit_price          DOUBLE PRECISION NOT NULL,
    entry_time          TIMESTAMPTZ NOT NULL,
    exit_time           TIMESTAMPTZ NOT NULL,
    sl                  DOUBLE PRECISION NOT NULL,
    target              DOUBLE PRECISION NOT NULL,
    qty                 INTEGER NOT NULL,
    gross_pnl           DOUBLE PRECISION NOT NULL,
    costs               DOUBLE PRECISION NOT NULL,
    net_pnl             DOUBLE PRECISION NOT NULL,
    exit_reason         VARCHAR(30) NOT NULL,
    rr                  DOUBLE PRECISION NOT NULL,
    option_strike       DOUBLE PRECISION,
    option_type         VARCHAR(5),
    option_entry_premium DOUBLE PRECISION,
    option_exit_premium DOUBLE PRECISION,
    option_delta        DOUBLE PRECISION,
    option_iv_entry     DOUBLE PRECISION,
    mode                VARCHAR(10) NOT NULL DEFAULT 'futures',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for trades table
CREATE INDEX IF NOT EXISTS ix_trades_session_id ON trades (session_id);
CREATE INDEX IF NOT EXISTS ix_trades_symbol ON trades (symbol);
CREATE INDEX IF NOT EXISTS ix_trades_entry_time ON trades (entry_time);
CREATE INDEX IF NOT EXISTS ix_trades_exit_time ON trades (exit_time);
CREATE INDEX IF NOT EXISTS ix_trades_created_at ON trades (created_at);
CREATE INDEX IF NOT EXISTS ix_trades_session_symbol ON trades (session_id, symbol);


-- ============================================================================
-- TABLE 2: POSITIONS — Open (active) positions
-- ============================================================================

CREATE TABLE IF NOT EXISTS positions (
    id                  SERIAL PRIMARY KEY,
    session_id          VARCHAR(50) NOT NULL,
    symbol              VARCHAR(20) NOT NULL,
    direction           VARCHAR(10) NOT NULL,
    entry_price         DOUBLE PRECISION NOT NULL,
    entry_time          TIMESTAMPTZ NOT NULL,
    qty                 INTEGER NOT NULL,
    sl                  DOUBLE PRECISION NOT NULL,
    target              DOUBLE PRECISION NOT NULL,
    rr                  DOUBLE PRECISION NOT NULL,
    held                INTEGER NOT NULL DEFAULT 0,
    be_done             BOOLEAN NOT NULL DEFAULT FALSE,
    atr_at_entry        DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    opt_entry_json      TEXT,
    original_sl         DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    status              VARCHAR(10) NOT NULL DEFAULT 'open',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for positions table
CREATE INDEX IF NOT EXISTS ix_positions_session_id ON positions (session_id);
CREATE INDEX IF NOT EXISTS ix_positions_symbol ON positions (symbol);
CREATE INDEX IF NOT EXISTS ix_positions_status ON positions (status);
CREATE INDEX IF NOT EXISTS ix_positions_session_status ON positions (session_id, status);


-- ============================================================================
-- TABLE 3: SESSIONS — Trading session records
-- ============================================================================

CREATE TABLE IF NOT EXISTS sessions (
    id                  SERIAL PRIMARY KEY,
    session_id          VARCHAR(60) NOT NULL UNIQUE,
    start_time          TIMESTAMPTZ NOT NULL,
    end_time            TIMESTAMPTZ,
    starting_capital    DOUBLE PRECISION NOT NULL,
    ending_capital      DOUBLE PRECISION,
    total_trades        INTEGER NOT NULL DEFAULT 0,
    total_pnl           DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    status              VARCHAR(10) NOT NULL DEFAULT 'active',
    config_json         TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for sessions table
CREATE INDEX IF NOT EXISTS ix_sessions_session_id ON sessions (session_id);
CREATE INDEX IF NOT EXISTS ix_sessions_status ON sessions (status);


-- ============================================================================
-- TABLE 4: CONFIG_OVERRIDES — User config changes
-- ============================================================================

CREATE TABLE IF NOT EXISTS config_overrides (
    id                  SERIAL PRIMARY KEY,
    key                 VARCHAR(50) NOT NULL UNIQUE,
    value               TEXT NOT NULL,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by          VARCHAR(20) NOT NULL DEFAULT 'system'
);

-- Indexes for config_overrides table
CREATE INDEX IF NOT EXISTS ix_config_overrides_key ON config_overrides (key);


-- ============================================================================
-- TABLE 5: TOKEN_LOG — Kite token exchange history
-- ============================================================================

CREATE TABLE IF NOT EXISTS token_log (
    id                  SERIAL PRIMARY KEY,
    request_token       VARCHAR(100) NOT NULL,
    access_token        VARCHAR(100) NOT NULL DEFAULT '',
    user_name           VARCHAR(100) NOT NULL DEFAULT '',
    status              VARCHAR(10) NOT NULL,
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for token_log table
CREATE INDEX IF NOT EXISTS ix_token_log_created_at ON token_log (created_at);


-- ============================================================================
-- TABLE 6: ERROR_LOG — Error tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS error_log (
    id                  SERIAL PRIMARY KEY,
    error_type          VARCHAR(50) NOT NULL,
    error_message       TEXT NOT NULL,
    stack_trace         TEXT,
    module              VARCHAR(50),
    severity            VARCHAR(10) NOT NULL DEFAULT 'error',
    resolved            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for error_log table
CREATE INDEX IF NOT EXISTS ix_error_log_error_type ON error_log (error_type);
CREATE INDEX IF NOT EXISTS ix_error_log_severity ON error_log (severity);
CREATE INDEX IF NOT EXISTS ix_error_log_created_at ON error_log (created_at);
CREATE INDEX IF NOT EXISTS ix_errors_severity_resolved ON error_log (severity, resolved);


-- ============================================================================
-- VERIFICATION — Quick sanity check
-- ============================================================================
-- Run this after the migration to verify all tables were created:

-- SELECT table_name FROM information_schema.tables
--     WHERE table_schema = 'public'
--     AND table_name IN (
--         'trades', 'positions', 'sessions',
--         'config_overrides', 'token_log', 'error_log'
--     )
--     ORDER BY table_name;
