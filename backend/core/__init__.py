"""
DDLJ Backend — Core Package
==============================

Centralized configuration, logging, and exceptions for the DDLJ backend.
This package is independent of the trading engine and provides the
infrastructure that all other packages depend on.

Modules:
  config.py         — Application-level config (ports, URLs, feature flags)
  logging_config.py  — Structured logging setup with JSON support
  exceptions.py     — Custom exception hierarchy
"""

__all__ = ["config", "logging_config", "exceptions"]
