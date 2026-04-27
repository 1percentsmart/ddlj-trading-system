#!/usr/bin/env python3
"""
DDLJ Backend — API Dependencies (Dependency Injection)
========================================================

FastAPI dependency injection functions. This replaces the old circular
import pattern where routes.py did `from main import engine_manager`.

WHY IS THIS NEEDED?
  The old pattern:
    main.py imports routes.py (at module level)
    routes.py imports main.py (to get engine_manager)
    → CIRCULAR IMPORT!

  The new pattern:
    main.py sets engine_manager on app.state
    routes.py gets engine_manager via Depends(get_engine_manager)
    → No circular import! FastAPI handles the wiring.

  This also makes testing easier — you can swap the engine_manager
  with a mock during unit tests.

Author: DDLJ Strategy Team
Version: 10.1.0
"""

from fastapi import Request

from services.engine_manager import EngineManager


def get_engine_manager(request: Request) -> EngineManager:
    """
    Get the EngineManager instance from the FastAPI app state.

    This is the SINGLE way API routes should access the engine manager.
    No more `from main import engine_manager` — that creates circular imports.

    USAGE in routes.py:
        @router.get("/status")
        async def get_status(mgr: EngineManager = Depends(get_engine_manager)):
            return mgr.get_status()

    Args:
        request (Request): FastAPI request object (injected automatically).

    Returns:
        EngineManager: The global engine manager instance.

    Raises:
        RuntimeError: If the engine manager hasn't been initialized yet.
    """
    mgr = getattr(request.app.state, "engine_manager", None)
    if mgr is None:
        raise RuntimeError(
            "Engine manager not initialized. "
            "The application may not have started correctly."
        )
    return mgr
