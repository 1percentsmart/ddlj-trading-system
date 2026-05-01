# ============================================================
# DDLJ Trading System — Root Dockerfile for Railway Deployment
# ============================================================
# This Dockerfile lives at the MONOREPO ROOT so Railway can find
# it without needing a custom "Root Directory" setting.
#
# STRATEGY:
#   - Copy ONLY the backend/ subdirectory into the Docker image
#   - This avoids copying node_modules, .next, etc.
#   - The result is identical to backend/Dockerfile but works
#     from the repo root with zero dashboard configuration.
# ============================================================

FROM python:3.12-slim AS base

# Metadata
LABEL maintainer="DDLJ Strategy Team"
LABEL description="DDLJ v10.3 — Options Trading Backend"
LABEL version="10.3.0"

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# ── Install Python dependencies (cached layer) ──
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Copy backend application code ──
# Copy ONLY backend/ contents — not the entire monorepo
COPY backend/ .

# ── Create non-root user and set up directories ──
RUN useradd --create-home --shell /bin/bash ddlj && \
    mkdir -p /app/kite_cache_v10 /app/sessions /app/logs /app/data && \
    chown -R ddlj:ddlj /app

# Set project root for path resolution
# IMPORTANT: On Railway, the app runs from /app which IS the backend dir.
# The core/config.py module uses this env var to detect PROJECT_ROOT.
ENV PROJECT_ROOT=/app
ENV CACHE_DIR=/app/kite_cache_v10

# Switch to non-root user
USER ddlj

# Expose the port (Railway sets $PORT automatically)
EXPOSE 8000

# Health check — Railway pings this to verify the server is alive
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT:-8000}/api/v1/health')" || exit 1

# Start the server
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
