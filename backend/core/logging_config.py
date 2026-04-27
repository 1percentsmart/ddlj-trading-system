#!/usr/bin/env python3
"""
DDLJ Backend — Structured Logging Configuration
=================================================

Provides consistent, structured logging across the entire backend.
Supports both human-readable console output (development) and
JSON-formatted logs (production for log aggregation).

WHY STRUCTURED LOGGING?
  In production, logs are shipped to monitoring tools (Datadog, CloudWatch,
  Railway logs). Structured (JSON) logs are machine-parseable, making it
  easy to search, filter, and alert on specific events.

  In development, we use colorful human-readable format for readability.

USAGE:
  In any module:
    import logging
    log = logging.getLogger("ddlj_backend")

  The logger is automatically configured when setup_logging() is called
  at application startup (in main.py).

Author: DDLJ Strategy Team
Version: 10.1.0
"""

import sys
import logging
import json
from datetime import datetime
from typing import Any, Optional

import pytz

IST = pytz.timezone("Asia/Kolkata")


# ============================================================================
# JSON FORMATTER — For production log aggregation
# ============================================================================

class JSONFormatter(logging.Formatter):
    """
    Format log records as JSON for production log aggregation.

    Each log line is a valid JSON object with:
      - timestamp: ISO format in IST
      - level: LOG level (INFO, WARNING, etc.)
      - logger: Logger name (e.g., "ddlj_backend.engine")
      - message: Log message
      - extra: Any additional fields passed via extra={}

    EXAMPLE OUTPUT:
      {"timestamp":"2026-04-27T09:15:00+05:30","level":"INFO","logger":"ddlj_backend","message":"Engine started"}
    """

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(IST).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Add any extra fields passed via extra={}
        if hasattr(record, "extra_fields"):
            log_entry.update(record.extra_fields)

        # Add exception info if present
        if record.exc_info and record.exc_info[0] is not None:
            log_entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_entry, default=str)


# ============================================================================
# CONSOLE FORMATTER — For development readability
# ============================================================================

class ConsoleFormatter(logging.Formatter):
    """
    Colorful, human-readable log format for development.

    EXAMPLE OUTPUT:
      09:15:00 [INFO] ddlj_backend: Engine started
      09:15:01 [WARNING] ddlj_backend.engine: Token expiring soon
    """

    # ANSI color codes
    COLORS = {
        "DEBUG": "\033[36m",     # Cyan
        "INFO": "\033[32m",      # Green
        "WARNING": "\033[33m",   # Yellow
        "ERROR": "\033[31m",     # Red
        "CRITICAL": "\033[35m",  # Magenta
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, "")
        reset = self.RESET

        # Format timestamp in IST
        ts = datetime.now(IST).strftime("%H:%M:%S")

        # Build the log line
        message = record.getMessage()

        # Add extra fields inline if present
        if hasattr(record, "extra_fields") and record.extra_fields:
            extras = " ".join(f"{k}={v}" for k, v in record.extra_fields.items())
            message = f"{message} | {extras}"

        line = f"{ts} [{color}{record.levelname:<8}{reset}] {record.name}: {message}"

        # Add exception info if present
        if record.exc_info and record.exc_info[0] is not None:
            line += "\n" + self.formatException(record.exc_info)

        return line


# ============================================================================
# LOGGING SETUP
# ============================================================================

def setup_logging(log_level: str = "INFO", json_logs: bool = False) -> None:
    """
    Configure structured logging for the entire application.

    Args:
        log_level (str): Logging level. Default: "INFO".
            Options: DEBUG, INFO, WARNING, ERROR, CRITICAL
        json_logs (bool): Use JSON format for production log aggregation.
            Default: False (use human-readable console format).

    USAGE:
        # In main.py, before anything else:
        from core.logging_config import setup_logging
        setup_logging(log_level="INFO", json_logs=False)
    """
    # Get the root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    # Remove any existing handlers (prevent duplicate logs on reload)
    root_logger.handlers.clear()

    # Create console handler
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    # Choose formatter based on environment
    if json_logs:
        formatter = JSONFormatter()
    else:
        formatter = ConsoleFormatter()

    handler.setFormatter(formatter)
    root_logger.addHandler(handler)

    # ── Set specific logger levels ──
    # Our app loggers — use the configured level
    logging.getLogger("ddlj_backend").setLevel(
        getattr(logging, log_level.upper(), logging.INFO)
    )

    # Third-party loggers — reduce noise
    logging.getLogger("uvicorn").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("fastapi").setLevel(logging.WARNING)
    logging.getLogger("kiteconnect").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger with the ddlj_backend namespace.

    Args:
        name (str): Sub-module name (e.g., "engine", "api", "services")

    Returns:
        logging.Logger: Configured logger instance.

    USAGE:
        log = get_logger("engine")
        log.info("Engine started")
        log.warning("Token expiring soon", extra={"extra_fields": {"expires_in": "2h"}})
    """
    if name.startswith("ddlj_backend"):
        return logging.getLogger(name)
    return logging.getLogger(f"ddlj_backend.{name}")
