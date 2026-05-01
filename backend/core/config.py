#!/usr/bin/env python3
"""
DDLJ Backend — Application Configuration
==========================================

Centralized application-level configuration that is SEPARATE from the
trading engine's strategy parameters (those live in engine/config.py).

This module handles:
  - Server settings (host, port, environment)
  - Database connection
  - Telegram notifications
  - Security (auth secret key)
  - Feature flags
  - Market hours defaults
  - File paths (all derived from env vars, no hardcoded paths)

WHY SEPARATE FROM engine/config.py?
  engine/config.py has 72+ STRATEGY parameters (EMA periods, risk %, etc.)
  This file has APPLICATION parameters (server port, DB URL, API keys).
  Mixing them would be chaos. Strategy params change per trade session;
  App params change per deployment environment.

Author: DDLJ Strategy Team
Version: 10.1.0
"""

import os
from pathlib import Path


# ============================================================================
# PROJECT ROOT — All paths are relative to this
# ============================================================================
# WHY: On Railway, the app runs from /app. Locally, it runs from the repo root.
#      We detect the root dynamically so there are ZERO hardcoded paths.

def _detect_project_root() -> Path:
    """
    Detect the project root directory.

    Priority:
      1. PROJECT_ROOT env var (set in Railway/Docker)
      2. Walk up from this file looking for marker files (main.py, requirements.txt)
      3. Fallback: 2 levels up from core/config.py (backend/../ = project root)

    WHY: On Railway, root directory = backend/, so this file is at /app/core/config.py.
    Going up 2 levels gives /app which is correct and writable.
    We also add marker-file detection for robustness in case the directory
    structure changes.

    Returns:
        Path: Absolute path to the project root.
    """
    env_root = os.getenv("PROJECT_ROOT")
    if env_root:
        return Path(env_root).resolve()

    # Walk up from this file looking for a marker directory
    this_dir = Path(__file__).resolve().parent
    candidate = this_dir
    for _ in range(5):
        # On Railway: /app has main.py and requirements.txt
        # Locally: /home/z/my-project/ has both backend/ and frontend/
        if (candidate / "main.py").exists() or (candidate / "requirements.txt").exists():
            return candidate
        candidate = candidate.parent

    # Fallback: This file is at backend/core/config.py
    # Project root is 2 levels up
    return this_dir.parent.parent  # backend/../ = project root


PROJECT_ROOT = _detect_project_root()

# Detect BACKEND_DIR: On Railway (Docker), main.py lives at PROJECT_ROOT (/app),
# so BACKEND_DIR == PROJECT_ROOT. Locally, main.py is at PROJECT_ROOT/backend/main.py,
# so BACKEND_DIR == PROJECT_ROOT / "backend".
# We check for the presence of main.py and core/ at PROJECT_ROOT to decide.
if (PROJECT_ROOT / "main.py").exists() and (PROJECT_ROOT / "core").is_dir():
    # We are already inside the backend directory (e.g., /app in Docker)
    BACKEND_DIR = PROJECT_ROOT
else:
    # We are at the monorepo root; backend is a subdirectory
    BACKEND_DIR = PROJECT_ROOT / "backend"


# ============================================================================
# ENVIRONMENT
# ============================================================================

APP_ENV = os.getenv("APP_ENV", "development")
"""Current environment: 'development', 'staging', or 'production'."""

IS_PRODUCTION = APP_ENV == "production"
IS_DEVELOPMENT = APP_ENV == "development"


# ============================================================================
# SERVER SETTINGS
# ============================================================================

HOST = os.getenv("HOST", "0.0.0.0")
"""Server bind address. 0.0.0.0 = accept connections from any IP."""

PORT = int(os.getenv("PORT", "8000"))
"""Server port. Railway sets this automatically via $PORT."""

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
"""Logging level: DEBUG, INFO, WARNING, ERROR, CRITICAL."""

RELOAD = IS_DEVELOPMENT and os.getenv("RELOAD", "true").lower() == "true"
"""Enable auto-reload on code changes (development only)."""


# ============================================================================
# DATABASE
# ============================================================================

_raw_db_url = os.getenv("DATABASE_URL", "").strip()
# WHY: Some platforms set DATABASE_URL to a non-SQLAlchemy format
#      (e.g., file:/path for SQLite, or empty string with whitespace).
#      We validate it's a proper PostgreSQL/MySQL URL before using it.
#      If it's not a valid SQL database URL, we fall back to local SQLite.
if _raw_db_url and (_raw_db_url.startswith("postgresql://") or _raw_db_url.startswith("postgres://")):
    DATABASE_URL = _raw_db_url
else:
    DATABASE_URL = ""
"""
PostgreSQL connection string for Supabase.

Format: postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

If empty or invalid, the system falls back to local SQLite for development.
This allows you to develop without Supabase, then switch to production DB
by just setting this env var to a valid PostgreSQL URL.
"""

DATABASE_POOL_SIZE = int(os.getenv("DATABASE_POOL_SIZE", "5"))
"""Number of database connections in the pool."""

DATABASE_ECHO = IS_DEVELOPMENT and os.getenv("DATABASE_ECHO", "false").lower() == "true"
"""Echo SQL statements to logs (development debugging only)."""


# ============================================================================
# KITE API
# ============================================================================

KITE_API_KEY = os.getenv("KITE_API_KEY", "")
"""Zerodha Kite API key. MUST be set via env var — no hardcoded fallbacks."""

KITE_API_SECRET = os.getenv("KITE_API_SECRET", "")
"""Zerodha Kite API secret. MUST be set via env var — no hardcoded fallbacks."""

KITE_TOKEN_FILE = os.getenv("KITE_TOKEN_FILE", str(PROJECT_ROOT / "kite_access_token.txt"))
"""Path to the Kite access token file."""

KITE_TOKEN_EXPIRY_HOURS = int(os.getenv("KITE_TOKEN_EXPIRY_HOURS", "24"))
"""Kite access tokens expire after this many hours (typically 24)."""


# ============================================================================
# FILE PATHS — All derived from PROJECT_ROOT, no hardcoded paths
# ============================================================================

DATA_DIR = BACKEND_DIR / "engine" / "data"
"""Directory containing static data files (VIX data, etc.)."""

CACHE_DIR = Path(os.getenv("CACHE_DIR", str(PROJECT_ROOT / "kite_cache_v10")))
"""Directory for cached Kite API data."""

SESSION_DIR = Path(os.getenv("SESSION_DIR", str(PROJECT_ROOT / "sessions")))
"""Directory for session state files."""

TRADE_LOG_DIR = Path(os.getenv("TRADE_LOG_DIR", str(PROJECT_ROOT / "logs")))
"""Directory for trade log files."""

DOWNLOAD_DIR = Path(os.getenv("DOWNLOAD_DIR", str(PROJECT_ROOT / "download")))
"""Directory for backtest result files and other downloads."""


def ensure_directories():
    """
    Create all required directories if they don't exist.

    Called once at application startup to prevent file-not-found errors.
    """
    for dir_path in [CACHE_DIR, SESSION_DIR, TRADE_LOG_DIR, DATA_DIR, DOWNLOAD_DIR]:
        dir_path.mkdir(parents=True, exist_ok=True)


# ============================================================================
# TELEGRAM NOTIFICATIONS
# ============================================================================

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
"""Telegram bot token from @BotFather. Empty = Telegram disabled."""

TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
"""Telegram chat ID to send notifications to. Empty = Telegram disabled."""

TELEGRAM_ENABLED = bool(TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)
"""Whether Telegram notifications are active (auto-detected from tokens)."""


# ============================================================================
# MARKET HOURS (IST — Indian Standard Time)
# ============================================================================

MARKET_OPEN_HOUR = int(os.getenv("MARKET_OPEN_HOUR", "9"))
MARKET_OPEN_MINUTE = int(os.getenv("MARKET_OPEN_MINUTE", "15"))

MARKET_CLOSE_HOUR = int(os.getenv("MARKET_CLOSE_HOUR", "15"))
MARKET_CLOSE_MINUTE = int(os.getenv("MARKET_CLOSE_MINUTE", "30"))

MARKET_TIMEZONE = "Asia/Kolkata"
"""All market time calculations use IST."""


# ============================================================================
# SECURITY
# ============================================================================

AUTH_SECRET_KEY = os.getenv("AUTH_SECRET_KEY", "")
"""Secret key for JWT authentication. Generate with: python -c "import secrets; print(secrets.token_urlsafe(32))" """

CORS_ORIGINS = [
    "http://localhost:3000",       # Local Next.js dev server
    "http://localhost:8000",       # Local backend
    "https://ddlj-dashboard.vercel.app",       # Old Vercel production frontend
    "https://ddlj-dashboard-kt8pblyoz-1percentsmarts-projects.vercel.app",  # Old Vercel deployment URL
    "https://ddlj-trading-system.vercel.app",  # Actual Vercel production frontend
    "https://ddlj-trading-system-1percentsmarts-projects.vercel.app",  # Vercel org deployment
    "https://ddlj-trading-system-git-main-1percentsmarts-projects.vercel.app",  # Vercel branch deployment
    "https://ddlj-trading-system-1du5m5pms-1percentsmarts-projects.vercel.app",  # Latest Vercel deployment
]
# Add production frontend URL from env var (default: actual Vercel URL)
_frontend_url = os.getenv("FRONTEND_URL", "https://ddlj-trading-system.vercel.app").strip()
if _frontend_url and _frontend_url not in CORS_ORIGINS:
    if not _frontend_url.startswith(("http://", "https://")):
        _frontend_url = f"https://{_frontend_url}"
    CORS_ORIGINS.append(_frontend_url)
# Also allow Vercel auto-set URL
_vercel_url = os.getenv("VERCEL_URL", "").strip()
if _vercel_url and _vercel_url not in CORS_ORIGINS:
    if not _vercel_url.startswith(("http://", "https://")):
        _vercel_url = f"https://{_vercel_url}"
    CORS_ORIGINS.append(_vercel_url)
# Also allow all Vercel preview URLs for this project
_vercel_branch_url = os.getenv("VERCEL_BRANCH_URL", "").strip()
if _vercel_branch_url and _vercel_branch_url not in CORS_ORIGINS:
    if not _vercel_branch_url.startswith(("http://", "https://")):
        _vercel_branch_url = f"https://{_vercel_branch_url}"
    CORS_ORIGINS.append(_vercel_branch_url)
"""Allowed CORS origins for the frontend."""


# ============================================================================
# FEATURE FLAGS
# ============================================================================

ENABLE_PAPER_TRADING = os.getenv("ENABLE_PAPER_TRADING", "true").lower() == "true"
"""Master switch for paper trading engine."""

ENABLE_WEBSOCKET = os.getenv("ENABLE_WEBSOCKET", "true").lower() == "true"
"""Enable WebSocket endpoint for real-time dashboard updates."""

ENABLE_TELEGRAM = TELEGRAM_ENABLED
"""Enable Telegram notifications (auto-detected)."""

ENABLE_SESSION_RECOVERY = os.getenv("ENABLE_SESSION_RECOVERY", "true").lower() == "true"
"""Enable automatic session recovery after crash/restart."""

ENABLE_MARKET_HOURS_GUARD = os.getenv("ENABLE_MARKET_HOURS_GUARD", "true").lower() == "true"
"""Enable automatic engine start/stop based on market hours."""

ENABLE_TOKEN_AUTO_REFRESH = os.getenv("ENABLE_TOKEN_AUTO_REFRESH", "true").lower() == "true"
"""Enable automatic detection and notification of token expiry."""


# ============================================================================
# VALIDATION
# ============================================================================

def validate_config():
    """
    Validate critical configuration at startup.

    Returns:
        list[str]: List of warnings. Empty = all good.

    Raises:
        RuntimeError: If critical configuration is missing.
    """
    warnings = []

    # ── Critical: Kite API credentials ──
    if not KITE_API_KEY:
        warnings.append(
            "KITE_API_KEY is not set. "
            "Set it in .env (local) or Environment Variables (Railway) to enable trading."
        )
    if not KITE_API_SECRET:
        warnings.append(
            "KITE_API_SECRET is not set. "
            "Set it in .env (local) or Environment Variables (Railway) to enable trading."
        )

    # ── Warning: Database not configured ──
    if not DATABASE_URL:
        warnings.append(
            "DATABASE_URL is not set. Using local SQLite for development. "
            "Set DATABASE_URL for Supabase/PostgreSQL in production."
        )

    # ── Warning: Telegram not configured ──
    if not TELEGRAM_ENABLED:
        warnings.append(
            "Telegram notifications not configured. "
            "Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to enable trade alerts."
        )

    # ── Warning: Auth secret not set ──
    if not AUTH_SECRET_KEY and IS_PRODUCTION:
        warnings.append(
            "AUTH_SECRET_KEY is not set in production. "
            "API will be publicly accessible. Set this for security."
        )

    return warnings


# ============================================================================
# CONFIGURATION SUMMARY
# ============================================================================

def get_config_summary() -> dict:
    """
    Return a summary of the current application configuration.

    This is used by the /api/v1/health endpoint and for debugging.
    Secrets are masked for security.
    """
    return {
        "app_env": APP_ENV,
        "is_production": IS_PRODUCTION,
        "host": HOST,
        "port": PORT,
        "log_level": LOG_LEVEL,
        "project_root": str(PROJECT_ROOT),
        "database_configured": bool(DATABASE_URL),
        "kite_api_key_set": bool(KITE_API_KEY),
        "kite_api_secret_set": bool(KITE_API_SECRET),
        "telegram_enabled": TELEGRAM_ENABLED,
        "session_recovery_enabled": ENABLE_SESSION_RECOVERY,
        "market_hours_guard_enabled": ENABLE_MARKET_HOURS_GUARD,
        "token_auto_refresh_enabled": ENABLE_TOKEN_AUTO_REFRESH,
        "websocket_enabled": ENABLE_WEBSOCKET,
        "market_hours": f"{MARKET_OPEN_HOUR}:{MARKET_OPEN_MINUTE:02d} - "
                        f"{MARKET_CLOSE_HOUR}:{MARKET_CLOSE_MINUTE:02d} IST",
    }
