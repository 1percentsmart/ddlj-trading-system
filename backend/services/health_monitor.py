#!/usr/bin/env python3
"""
DDLJ Trading System — Health Monitoring Service
==================================================

Tracks system health and reports issues for monitoring and alerting.
This service provides the /api/v1/health endpoint data and can trigger
alerts when the system is degraded or unhealthy.

KEY DESIGN DECISIONS:
  - Three status levels: healthy, degraded, unhealthy
    * healthy: All systems operational, engine running normally
    * degraded: Some issues (token expiring, slow response, high errors)
    * unhealthy: Critical failures (engine down, no token, DB unreachable)
  - Extensible health checks: New checks can be registered dynamically
    via register_check(). This allows the system to grow without
    modifying this file.
  - No external dependencies: Health checks use only stdlib + pytz.
    WHY: The health monitor must work even when external services (DB,
    Telegram, etc.) are down. If the health check itself depends on
    those services, we can't detect their failures.
  - Stale trade detection: If no trade has occurred in 2 hours during
    market hours, it might indicate a problem with the signal engine.
    WHY: In a volatile market, 2 hours without a trade is unusual.
    It could mean the API connection dropped silently.
  - Memory and disk monitoring: These are common causes of production
    failures. OOM kills are silent and devastating.

HEALTH CHECK CATEGORIES:
  1. Engine heartbeat: Is the trading engine alive and responsive?
  2. API connectivity: Can we reach the Kite API?
  3. Database connection: Is the database available?
  4. Disk space: Do we have enough storage?
  5. Memory usage: Are we approaching memory limits?
  6. Error rate: Are we seeing too many errors per hour?
  7. Last trade: Has it been too long since the last trade?

USAGE:
    monitor = HealthMonitor()
    monitor.register_check("custom", my_check_function)
    health = monitor.get_health()
    # Returns: {"status": "healthy", "checks": {...}, "uptime": ...}

Author: DDLJ Strategy Team
Version: 10.1.0
"""

from __future__ import annotations

import os
import logging
import time
from datetime import datetime, time as dt_time, timedelta
from typing import Any, Callable, Dict, List, Optional

import pytz

# Indian Standard Timezone — ALL timestamps use IST
IST = pytz.timezone("Asia/Kolkata")

log = logging.getLogger("ddlj_backend.health_monitor")


# ============================================================================
# STATUS LEVELS
# ============================================================================

class HealthStatus:
    """Health status constants with priority ordering."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"

    # Priority order for aggregating multiple check results
    # WHY: If any check is unhealthy, the overall status should be unhealthy.
    # If any is degraded (but none unhealthy), overall is degraded.
    PRIORITY = {
        "healthy": 0,
        "degraded": 1,
        "unhealthy": 2,
    }

    @classmethod
    def worst(cls, *statuses: str) -> str:
        """
        Return the worst status from a list of statuses.

        Args:
            *statuses: Variable number of status strings.

        Returns:
            str: The worst status among the inputs.
        """
        if not statuses:
            return cls.HEALTHY
        return max(statuses, key=lambda s: cls.PRIORITY.get(s, 0))


# ============================================================================
# HEALTH CHECK RESULT
# ============================================================================

class HealthCheckResult:
    """
    Result of a single health check.

    Attributes:
        name (str): Name of the health check.
        status (str): "healthy", "degraded", or "unhealthy".
        message (str): Human-readable description of the check result.
        details (dict): Additional details about the check.
        duration_ms (float): How long the check took in milliseconds.
    """

    def __init__(
        self,
        name: str,
        status: str,
        message: str = "",
        details: Optional[Dict[str, Any]] = None,
        duration_ms: float = 0.0,
    ):
        """
        Initialize a health check result.

        Args:
            name (str): Name of the health check.
            status (str): Status level.
            message (str): Description. Default: "".
            details (dict, optional): Additional data. Default: None.
            duration_ms (float): Check duration. Default: 0.0.
        """
        self.name = name
        self.status = status
        self.message = message
        self.details = details or {}
        self.duration_ms = duration_ms

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert the result to a dictionary.

        Returns:
            dict: Serialized health check result.
        """
        return {
            "name": self.name,
            "status": self.status,
            "message": self.message,
            "details": self.details,
            "duration_ms": round(self.duration_ms, 2),
        }


# ============================================================================
# HEALTH MONITOR
# ============================================================================

class HealthMonitor:
    """
    Monitors system health and reports issues.

    Provides a centralized health check system that aggregates results
    from multiple health check functions into a single status.

    FEATURES:
      - Built-in health checks (engine, API, DB, disk, memory, errors, trades)
      - Extensible via register_check() for custom health checks
      - Uptime tracking since service start
      - Error rate tracking (errors per hour)
      - Last trade timestamp tracking
      - Callable from /api/v1/health endpoint

    USAGE:
        monitor = HealthMonitor()
        monitor.register_check("custom_check", my_check_fn)
        health = monitor.get_health()  # Returns full health report
        quick = monitor.check_all()     # Returns just the status

    Attributes:
        start_time (datetime): When the monitor was created (used for uptime).
        error_threshold (int): Errors per hour before status becomes degraded.
        critical_error_threshold (int): Errors per hour before unhealthy.
    """

    def __init__(
        self,
        error_threshold: int = 10,
        critical_error_threshold: int = 50,
        stale_trade_hours: float = 2.0,
        disk_warning_pct: float = 85.0,
        disk_critical_pct: float = 95.0,
        memory_warning_pct: float = 80.0,
        memory_critical_pct: float = 95.0,
    ):
        """
        Initialize the Health Monitor.

        Args:
            error_threshold (int): Errors/hour for "degraded" status. Default: 10.
            critical_error_threshold (int): Errors/hour for "unhealthy" status. Default: 50.
            stale_trade_hours (float): Hours without trade before alert. Default: 2.0.
            disk_warning_pct (float): Disk usage % for "degraded". Default: 85.
            disk_critical_pct (float): Disk usage % for "unhealthy". Default: 95.
            memory_warning_pct (float): Memory usage % for "degraded". Default: 80.
            memory_critical_pct (float): Memory usage % for "unhealthy". Default: 95.
        """
        self.start_time = datetime.now(IST)
        self.error_threshold = error_threshold
        self.critical_error_threshold = critical_error_threshold
        self.stale_trade_hours = stale_trade_hours
        self.disk_warning_pct = disk_warning_pct
        self.disk_critical_pct = disk_critical_pct
        self.memory_warning_pct = memory_warning_pct
        self.memory_critical_pct = memory_critical_pct

        # ── Custom health checks ──
        self._custom_checks: Dict[str, Callable[[], HealthCheckResult]] = {}

        # ── Error tracking ──
        self._error_timestamps: List[float] = []

        # ── Last trade tracking ──
        self._last_trade_time: Optional[datetime] = None

        # ── Engine reference (set externally) ──
        self._engine_manager = None

        log.info(
            "HealthMonitor: Initialized — thresholds: degraded=%d errors/h, "
            "unhealthy=%d errors/h, stale_trade=%.1fh",
            error_threshold, critical_error_threshold, stale_trade_hours,
        )

    # ────────────────────────────────────────────────────────────
    # PUBLIC API — REGISTRATION
    # ────────────────────────────────────────────────────────────

    def register_check(
        self,
        name: str,
        check_fn: Callable[[], HealthCheckResult],
    ) -> None:
        """
        Register a custom health check function.

        The check function should return a HealthCheckResult with
        status, message, and details.

        Args:
            name (str): Unique name for the health check.
            check_fn (callable): Function that returns a HealthCheckResult.
                Called with no arguments.

        Raises:
            ValueError: If a check with this name is already registered.
        """
        if name in self._custom_checks:
            raise ValueError(f"Health check '{name}' is already registered")

        self._custom_checks[name] = check_fn
        log.info("HealthMonitor: Registered health check: %s", name)

    def set_engine_manager(self, engine_manager: Any) -> None:
        """
        Set the engine manager reference for health checks.

        This is called during startup to allow the health monitor
        to check engine status.

        Args:
            engine_manager: The EngineManager instance.
        """
        self._engine_manager = engine_manager
        log.info("HealthMonitor: Engine manager reference set")

    # ────────────────────────────────────────────────────────────
    # PUBLIC API — ERROR TRACKING
    # ────────────────────────────────────────────────────────────

    def record_error(self) -> None:
        """
        Record an error event for error rate tracking.

        Call this whenever the engine or any service encounters an error.
        The monitor tracks errors per hour and reports the rate in
        health checks.
        """
        self._error_timestamps.append(time.monotonic())
        # Prune old timestamps (older than 1 hour)
        one_hour_ago = time.monotonic() - 3600
        self._error_timestamps = [
            ts for ts in self._error_timestamps if ts > one_hour_ago
        ]

    def record_trade(self) -> None:
        """
        Record a trade event for stale trade detection.

        Call this whenever a trade is entered or exited.
        The monitor checks if it's been too long since the last trade.
        """
        self._last_trade_time = datetime.now(IST)

    # ────────────────────────────────────────────────────────────
    # PUBLIC API — HEALTH CHECKS
    # ────────────────────────────────────────────────────────────

    def get_health(self) -> Dict[str, Any]:
        """
        Get a comprehensive health report.

        Runs all registered health checks and returns a detailed
        report with the overall status, individual check results,
        and system metrics.

        Returns:
            dict: Full health report with keys:
                - status (str): Overall status (healthy/degraded/unhealthy)
                - timestamp (str): Report timestamp
                - uptime_seconds (float): Time since monitor started
                - checks (dict): Individual check results
                - system (dict): System metrics (memory, disk, errors)
        """
        all_results: List[HealthCheckResult] = []

        # ── Run built-in checks ──
        all_results.append(self._check_engine_heartbeat())
        all_results.append(self._check_api_connectivity())
        all_results.append(self._check_database())
        all_results.append(self._check_disk_space())
        all_results.append(self._check_memory())
        all_results.append(self._check_error_rate())
        all_results.append(self._check_last_trade())

        # ── Run custom checks ──
        import asyncio
        for name, check_fn in self._custom_checks.items():
            try:
                start = time.monotonic()
                result = check_fn()
                # Handle async check functions — run them in an event loop
                if asyncio.iscoroutine(result):
                    try:
                        loop = asyncio.get_event_loop()
                        if loop.is_running():
                            # Already in an async context — use thread pool
                            import concurrent.futures
                            with concurrent.futures.ThreadPoolExecutor() as pool:
                                result = pool.submit(asyncio.run, result).result(timeout=10)
                        else:
                            result = loop.run_until_complete(result)
                    except RuntimeError:
                        result = asyncio.run(result)
                # Handle tuple returns (status, message) — backward compat
                if isinstance(result, tuple):
                    status_val, message_val = result[0], result[1] if len(result) > 1 else ""
                    result = HealthCheckResult(name=name, status=status_val, message=message_val)
                result.duration_ms = (time.monotonic() - start) * 1000
                all_results.append(result)
            except Exception as e:
                # WHY: A failing health check should not crash the monitor.
                # We create an "unhealthy" result for the failed check.
                all_results.append(HealthCheckResult(
                    name=name,
                    status=HealthStatus.UNHEALTHY,
                    message=f"Health check crashed: {e}",
                ))

        # ── Aggregate results ──
        statuses = [r.status for r in all_results]
        overall_status = HealthStatus.worst(*statuses)

        # ── Build report ──
        checks_dict = {r.name: r.to_dict() for r in all_results}
        uptime = (datetime.now(IST) - self.start_time).total_seconds()

        report = {
            "status": overall_status,
            "timestamp": datetime.now(IST).isoformat(),
            "uptime_seconds": round(uptime, 1),
            "uptime_human": self._format_uptime(uptime),
            "checks": checks_dict,
            "system": {
                "errors_last_hour": len(self._error_timestamps),
                "last_trade_time": (
                    self._last_trade_time.isoformat() if self._last_trade_time else None
                ),
                "memory_usage_pct": self._get_memory_usage(),
                "disk_usage_pct": self._get_disk_usage(),
            },
        }

        return report

    def check_all(self) -> str:
        """
        Run all health checks and return just the overall status.

        This is a lightweight version of get_health() that returns
        only the status string, suitable for quick API responses.

        Returns:
            str: Overall health status ("healthy", "degraded", or "unhealthy").
        """
        report = self.get_health()
        return report["status"]

    # ────────────────────────────────────────────────────────────
    # BUILT-IN HEALTH CHECKS
    # ────────────────────────────────────────────────────────────

    def _check_engine_heartbeat(self) -> HealthCheckResult:
        """
        Check if the trading engine is alive and responsive.

        Returns:
            HealthCheckResult: Check result.
        """
        start = time.monotonic()

        if self._engine_manager is None:
            return HealthCheckResult(
                name="engine_heartbeat",
                status=HealthStatus.DEGRADED,
                message="Engine manager not registered",
                duration_ms=(time.monotonic() - start) * 1000,
            )

        try:
            status = self._engine_manager.get_status()
            is_running = status.get("engine_running", False)

            if is_running:
                # Check last heartbeat — if it's too old, the engine
                # might be stuck
                last_hb = status.get("last_heartbeat")
                if last_hb:
                    try:
                        hb_dt = datetime.fromisoformat(last_hb)
                        age = (datetime.now(IST) - hb_dt).total_seconds()
                        if age > 300:  # 5 minutes
                            return HealthCheckResult(
                                name="engine_heartbeat",
                                status=HealthStatus.DEGRADED,
                                message=f"Last heartbeat {age:.0f}s ago (stale)",
                                details={"last_heartbeat_age_seconds": round(age, 1)},
                                duration_ms=(time.monotonic() - start) * 1000,
                            )
                    except (ValueError, TypeError):
                        pass  # Can't parse heartbeat — don't fail

                return HealthCheckResult(
                    name="engine_heartbeat",
                    status=HealthStatus.HEALTHY,
                    message="Engine is running",
                    details={
                        "uptime_seconds": status.get("uptime_seconds"),
                        "error_count": status.get("error_count", 0),
                    },
                    duration_ms=(time.monotonic() - start) * 1000,
                )
            else:
                # Engine not running — might be expected (outside market hours)
                return HealthCheckResult(
                    name="engine_heartbeat",
                    status=HealthStatus.DEGRADED,
                    message="Engine is not running",
                    details={"initialized": status.get("initialized", False)},
                    duration_ms=(time.monotonic() - start) * 1000,
                )

        except Exception as e:
            return HealthCheckResult(
                name="engine_heartbeat",
                status=HealthStatus.UNHEALTHY,
                message=f"Cannot check engine status: {e}",
                duration_ms=(time.monotonic() - start) * 1000,
            )

    def _check_api_connectivity(self) -> HealthCheckResult:
        """
        Check if the Kite API is reachable.

        Returns:
            HealthCheckResult: Check result.
        """
        start = time.monotonic()

        try:
            # Check token status — if we can validate the token, the API is reachable
            from engine.token_manager import token_status
            result = token_status()

            if result.get("valid"):
                return HealthCheckResult(
                    name="api_connectivity",
                    status=HealthStatus.HEALTHY,
                    message="Kite API is reachable and token is valid",
                    details={
                        "user": result.get("user", {}).get("user_name", "unknown"),
                    },
                    duration_ms=(time.monotonic() - start) * 1000,
                )
            elif result.get("stored"):
                return HealthCheckResult(
                    name="api_connectivity",
                    status=HealthStatus.DEGRADED,
                    message="Token exists but is invalid or expired",
                    details={"error": result.get("error")},
                    duration_ms=(time.monotonic() - start) * 1000,
                )
            else:
                return HealthCheckResult(
                    name="api_connectivity",
                    status=HealthStatus.UNHEALTHY,
                    message="No Kite token found — cannot connect to API",
                    details={"action": "Provide a request token via POST /api/v1/token"},
                    duration_ms=(time.monotonic() - start) * 1000,
                )

        except ImportError:
            # WHY: token_manager might not be available in all contexts
            return HealthCheckResult(
                name="api_connectivity",
                status=HealthStatus.DEGRADED,
                message="Token manager not available (cannot verify API connectivity)",
                duration_ms=(time.monotonic() - start) * 1000,
            )
        except Exception as e:
            return HealthCheckResult(
                name="api_connectivity",
                status=HealthStatus.UNHEALTHY,
                message=f"API connectivity check failed: {e}",
                duration_ms=(time.monotonic() - start) * 1000,
            )

    def _check_database(self) -> HealthCheckResult:
        """
        Check if the database is available.

        Returns:
            HealthCheckResult: Check result.
        """
        start = time.monotonic()

        try:
            from core.config import DATABASE_URL

            if not DATABASE_URL:
                return HealthCheckResult(
                    name="database",
                    status=HealthStatus.DEGRADED,
                    message="No database configured (using local storage)",
                    details={"configured": False},
                    duration_ms=(time.monotonic() - start) * 1000,
                )

            # TODO: Add actual database ping when Supabase is integrated
            return HealthCheckResult(
                name="database",
                status=HealthStatus.HEALTHY,
                message="Database URL is configured",
                details={"configured": True, "ping": "not_implemented"},
                duration_ms=(time.monotonic() - start) * 1000,
            )

        except ImportError:
            return HealthCheckResult(
                name="database",
                status=HealthStatus.DEGRADED,
                message="Config module not available",
                duration_ms=(time.monotonic() - start) * 1000,
            )
        except Exception as e:
            return HealthCheckResult(
                name="database",
                status=HealthStatus.UNHEALTHY,
                message=f"Database check failed: {e}",
                duration_ms=(time.monotonic() - start) * 1000,
            )

    def _check_disk_space(self) -> HealthCheckResult:
        """
        Check available disk space.

        Uses os.statvfs on Unix-like systems. On Windows, falls back
        to a generic check.

        Returns:
            HealthCheckResult: Check result.
        """
        start = time.monotonic()

        try:
            usage_pct = self._get_disk_usage()

            if usage_pct is None:
                return HealthCheckResult(
                    name="disk_space",
                    status=HealthStatus.HEALTHY,
                    message="Disk usage check not available",
                    duration_ms=(time.monotonic() - start) * 1000,
                )

            if usage_pct >= self.disk_critical_pct:
                return HealthCheckResult(
                    name="disk_space",
                    status=HealthStatus.UNHEALTHY,
                    message=f"Disk usage critical: {usage_pct:.1f}%",
                    details={
                        "usage_pct": round(usage_pct, 1),
                        "threshold_critical": self.disk_critical_pct,
                        "threshold_warning": self.disk_warning_pct,
                    },
                    duration_ms=(time.monotonic() - start) * 1000,
                )
            elif usage_pct >= self.disk_warning_pct:
                return HealthCheckResult(
                    name="disk_space",
                    status=HealthStatus.DEGRADED,
                    message=f"Disk usage high: {usage_pct:.1f}%",
                    details={
                        "usage_pct": round(usage_pct, 1),
                        "threshold_warning": self.disk_warning_pct,
                    },
                    duration_ms=(time.monotonic() - start) * 1000,
                )
            else:
                return HealthCheckResult(
                    name="disk_space",
                    status=HealthStatus.HEALTHY,
                    message=f"Disk usage normal: {usage_pct:.1f}%",
                    details={"usage_pct": round(usage_pct, 1)},
                    duration_ms=(time.monotonic() - start) * 1000,
                )

        except Exception as e:
            return HealthCheckResult(
                name="disk_space",
                status=HealthStatus.DEGRADED,
                message=f"Disk check failed: {e}",
                duration_ms=(time.monotonic() - start) * 1000,
            )

    def _check_memory(self) -> HealthCheckResult:
        """
        Check memory usage.

        Returns:
            HealthCheckResult: Check result.
        """
        start = time.monotonic()

        try:
            usage_pct = self._get_memory_usage()

            if usage_pct is None:
                return HealthCheckResult(
                    name="memory",
                    status=HealthStatus.HEALTHY,
                    message="Memory check not available",
                    duration_ms=(time.monotonic() - start) * 1000,
                )

            if usage_pct >= self.memory_critical_pct:
                return HealthCheckResult(
                    name="memory",
                    status=HealthStatus.UNHEALTHY,
                    message=f"Memory usage critical: {usage_pct:.1f}%",
                    details={
                        "usage_pct": round(usage_pct, 1),
                        "threshold_critical": self.memory_critical_pct,
                    },
                    duration_ms=(time.monotonic() - start) * 1000,
                )
            elif usage_pct >= self.memory_warning_pct:
                return HealthCheckResult(
                    name="memory",
                    status=HealthStatus.DEGRADED,
                    message=f"Memory usage high: {usage_pct:.1f}%",
                    details={
                        "usage_pct": round(usage_pct, 1),
                        "threshold_warning": self.memory_warning_pct,
                    },
                    duration_ms=(time.monotonic() - start) * 1000,
                )
            else:
                return HealthCheckResult(
                    name="memory",
                    status=HealthStatus.HEALTHY,
                    message=f"Memory usage normal: {usage_pct:.1f}%",
                    details={"usage_pct": round(usage_pct, 1)},
                    duration_ms=(time.monotonic() - start) * 1000,
                )

        except Exception as e:
            return HealthCheckResult(
                name="memory",
                status=HealthStatus.DEGRADED,
                message=f"Memory check failed: {e}",
                duration_ms=(time.monotonic() - start) * 1000,
            )

    def _check_error_rate(self) -> HealthCheckResult:
        """
        Check the error rate over the last hour.

        Returns:
            HealthCheckResult: Check result.
        """
        start = time.monotonic()

        # Prune old timestamps
        one_hour_ago = time.monotonic() - 3600
        self._error_timestamps = [
            ts for ts in self._error_timestamps if ts > one_hour_ago
        ]

        errors_per_hour = len(self._error_timestamps)

        if errors_per_hour >= self.critical_error_threshold:
            status = HealthStatus.UNHEALTHY
            message = f"Critical error rate: {errors_per_hour} errors/hour"
        elif errors_per_hour >= self.error_threshold:
            status = HealthStatus.DEGRADED
            message = f"Elevated error rate: {errors_per_hour} errors/hour"
        else:
            status = HealthStatus.HEALTHY
            message = f"Error rate normal: {errors_per_hour} errors/hour"

        return HealthCheckResult(
            name="error_rate",
            status=status,
            message=message,
            details={
                "errors_last_hour": errors_per_hour,
                "threshold_degraded": self.error_threshold,
                "threshold_critical": self.critical_error_threshold,
            },
            duration_ms=(time.monotonic() - start) * 1000,
        )

    def _check_last_trade(self) -> HealthCheckResult:
        """
        Check if it's been too long since the last trade.

        During market hours, if no trade has occurred in the last
        `stale_trade_hours` hours, it might indicate a problem.

        Returns:
            HealthCheckResult: Check result.
        """
        start = time.monotonic()

        # ── Only check during market hours ──
        # WHY: Outside market hours, no trades is expected. We don't
        # want to trigger alerts when the market is simply closed.
        now = datetime.now(IST)
        is_weekday = now.weekday() < 5  # Mon-Fri
        market_hours = dt_time(9, 15) <= now.time() <= dt_time(15, 30)

        if not is_weekday or not market_hours:
            return HealthCheckResult(
                name="last_trade",
                status=HealthStatus.HEALTHY,
                message="Outside market hours — trade staleness not checked",
                details={
                    "is_weekday": is_weekday,
                    "is_market_hours": market_hours,
                },
                duration_ms=(time.monotonic() - start) * 1000,
            )

        # ── Check stale trade ──
        if self._last_trade_time is None:
            # No trade recorded at all — might be start of day
            return HealthCheckResult(
                name="last_trade",
                status=HealthStatus.HEALTHY,
                message="No trades recorded yet today",
                duration_ms=(time.monotonic() - start) * 1000,
            )

        time_since_trade = (now - self._last_trade_time).total_seconds() / 3600

        if time_since_trade > self.stale_trade_hours:
            return HealthCheckResult(
                name="last_trade",
                status=HealthStatus.DEGRADED,
                message=(
                    f"No trade in {time_since_trade:.1f} hours during market "
                    f"(threshold: {self.stale_trade_hours}h)"
                ),
                details={
                    "hours_since_last_trade": round(time_since_trade, 2),
                    "last_trade_time": self._last_trade_time.isoformat(),
                    "threshold_hours": self.stale_trade_hours,
                },
                duration_ms=(time.monotonic() - start) * 1000,
            )

        return HealthCheckResult(
            name="last_trade",
            status=HealthStatus.HEALTHY,
            message=f"Last trade {time_since_trade:.1f}h ago",
            details={
                "hours_since_last_trade": round(time_since_trade, 2),
                "last_trade_time": self._last_trade_time.isoformat(),
            },
            duration_ms=(time.monotonic() - start) * 1000,
        )

    # ────────────────────────────────────────────────────────────
    # PRIVATE HELPERS
    # ────────────────────────────────────────────────────────────

    @staticmethod
    def _get_disk_usage() -> Optional[float]:
        """
        Get the current disk usage percentage.

        Returns:
            float: Disk usage as a percentage (0-100), or None if unavailable.
        """
        try:
            # Unix-like systems (Linux, macOS)
            stat = os.statvfs("/")
            total = stat.f_blocks * stat.f_frsize
            available = stat.f_bavail * stat.f_frsize
            used = total - available
            return (used / total) * 100 if total > 0 else None
        except (AttributeError, OSError):
            # Windows or statvfs not available
            return None

    @staticmethod
    def _get_memory_usage() -> Optional[float]:
        """
        Get the current memory usage percentage.

        Returns:
            float: Memory usage as a percentage (0-100), or None if unavailable.
        """
        try:
            # Try using the psutil library if available
            import psutil
            return psutil.virtual_memory().percent
        except ImportError:
            pass

        try:
            # Fallback: read from /proc/meminfo (Linux only)
            with open("/proc/meminfo", "r") as f:
                lines = f.readlines()

            mem_info = {}
            for line in lines:
                parts = line.split(":")
                if len(parts) == 2:
                    key = parts[0].strip()
                    value = parts[1].strip().split()[0]
                    mem_info[key] = int(value)

            total = mem_info.get("MemTotal", 0)
            available = mem_info.get("MemAvailable", 0)

            if total > 0:
                used = total - available
                return (used / total) * 100
            return None

        except (OSError, KeyError, ValueError):
            return None

    @staticmethod
    def _format_uptime(seconds: float) -> str:
        """
        Format uptime in a human-readable string.

        Args:
            seconds (float): Uptime in seconds.

        Returns:
            str: Formatted uptime string (e.g., "2d 5h 30m").
        """
        days = int(seconds // 86400)
        hours = int((seconds % 86400) // 3600)
        minutes = int((seconds % 3600) // 60)

        parts = []
        if days > 0:
            parts.append(f"{days}d")
        if hours > 0:
            parts.append(f"{hours}h")
        parts.append(f"{minutes}m")

        return " ".join(parts)
