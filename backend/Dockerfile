# ============================================================
# DDLJ Trading System — Dockerfile for Railway Deployment
# ============================================================
# This Dockerfile creates a lightweight production image for
# running the DDLJ FastAPI backend on Railway.
#
# USAGE:
#   - If Railway Root Directory = "backend/", this file is used
#   - If Railway Root Directory = "/" (root), the root Dockerfile is used
#   Both produce identical results.
#
# STRATEGY:
#   - Use Python 3.12 slim (small image, fast builds)
#   - Install dependencies first (cached layer)
#   - Copy application code second (changes often, not cached)
#   - Run as non-root user for security
#   - Health check on /api/v1/health
#   - Expose port from $PORT env var (Railway sets this)
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

# ── Install Python dependencies ──
# This layer is cached unless requirements.txt changes
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Copy application code ──
# Copy the entire backend directory
COPY . .

# ── Create non-root user and set up directories ──
RUN useradd --create-home --shell /bin/bash ddlj && \
    mkdir -p /app/kite_cache_v10 /app/sessions /app/logs /app/data && \
    chown -R ddlj:ddlj /app

# Set project root for path resolution
# IMPORTANT: When Railway Root Directory = backend/, the app runs from /app
# which IS the backend dir. The core/config.py module uses this env var.
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
# Railway sets the PORT env var. We use it if available, otherwise 8000.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
