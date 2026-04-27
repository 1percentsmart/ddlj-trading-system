"""
DDLJ Trading System — Backend (FastAPI + Trading Engine)
=========================================================

This is the backend package that wraps the DDLJ trading engine
inside a FastAPI web server, making it controllable via REST API
and ready for cloud deployment on Railway.

Architecture:
  api/        → FastAPI routes (REST endpoints + WebSocket)
  engine/     → Core DDLJ strategy engine (bias, signal, options, paper trader)
  services/   → Business logic (notification, market hours, token management)
  database/   → Database models and CRUD operations (Supabase/PostgreSQL)

Version: 10.0.0 (Production — Cloud Deployable)
"""
