#!/usr/bin/env python3
"""
DDLJ Trading System — Telegram Notification Service
======================================================

Sends trade alerts and system notifications via Telegram Bot API.
This is the PRIMARY notification channel for the trading system — it
keeps the trader informed of critical events without needing to watch
the dashboard 24/7.

KEY DESIGN DECISIONS:
  - Uses httpx for async HTTP requests instead of python-telegram-bot.
    WHY: python-telegram-bot is a full framework (2MB+), while we only
    need to SEND messages. httpx is lightweight (200KB), async-native,
    and already in our dependency tree. Less code = fewer bugs.
  - Rate limiting: Telegram allows ~30 messages per second per bot, but
    we self-limit to 20 per minute to avoid hitting any rate limits and
    to prevent notification spam during volatile market conditions.
  - HTML formatting: Telegram's Bot API supports HTML parsing, which is
    simpler than Markdown for structured trade alerts (no escaping issues).
  - Fallback on failure: If Telegram is down or the bot token is wrong,
    we log the message but NEVER crash the trading engine. Notifications
    are "nice to have" — the engine must keep running.
  - Synchronous wrapper: The trading engine runs in a sync thread, so we
    provide both sync and async send methods. The sync version runs the
    async code in a separate event loop to avoid blocking.

MESSAGE TYPES:
  1. Trade alerts: Entry/exit with symbol, direction, price, SL, target, P&L
  2. System alerts: Engine start/stop, token expiry, crash recovery
  3. Daily summary: P&L, trade count, win rate, capital, open positions
  4. Test message: Verify bot configuration works

Author: DDLJ Strategy Team
Version: 10.1.0
"""

from __future__ import annotations

import os
import asyncio
import logging
import time
from collections import deque
from datetime import datetime
from typing import Any, Dict, List, Optional

import pytz

# Indian Standard Timezone — ALL timestamps in messages use IST
IST = pytz.timezone("Asia/Kolkata")

log = logging.getLogger("ddlj_backend.telegram_notifier")


# ============================================================================
# CONSTANTS
# ============================================================================

TELEGRAM_API_BASE = "https://api.telegram.org/bot{token}/sendMessage"
"""Telegram Bot API endpoint for sending messages."""

MAX_MESSAGES_PER_MINUTE = 20
"""Rate limit: max messages per minute to avoid Telegram API limits."""

MAX_MESSAGE_LENGTH = 4096
"""Telegram's maximum message length in characters."""

MESSAGE_TIMEOUT_SECONDS = 10
"""HTTP request timeout for sending messages."""

# Emoji constants for visual distinction in messages
# WHY: Telegram messages are read on mobile phones during trading hours.
#      Emoji make it instantly clear whether a message is good (✅), bad (❌),
#      or informational (ℹ️) without reading the full text.
EMOJI = {
    "entry": "🟢",       # Trade entry — green circle
    "exit_profit": "💰",  # Profitable exit — money bag
    "exit_loss": "🔴",    # Loss exit — red circle
    "exit_be": "⚪",      # Breakeven exit — white circle
    "system": "⚙️",       # System alert — gear
    "warning": "⚠️",      # Warning — triangle
    "error": "❌",         # Error — cross mark
    "success": "✅",       # Success — check mark
    "info": "ℹ️",         # Info — information source
    "chart": "📊",        # Statistics — bar chart
    "clock": "🕐",        # Time — clock
    "rocket": "🚀",       # Start/launch — rocket
    "stop": "🛑",         # Stop — stop sign
    "crash": "💥",        # Crash — collision
    "token": "🔑",        # Token — key
    "money": "💵",        # Money — dollar banknote
    "arrow_up": "📈",     # Bullish — chart increasing
    "arrow_down": "📉",   # Bearish — chart decreasing
}


class TelegramNotifier:
    """
    Sends trade alerts and system notifications via Telegram.

    This service handles all Telegram communication for the DDLJ trading
    system. It supports:
      - Trade entry/exit alerts with detailed P&L information
      - System alerts for engine lifecycle events
      - Daily trading summaries with statistics
      - Rate limiting to comply with Telegram API limits
      - Graceful degradation when Telegram is unavailable

    USAGE:
        notifier = TelegramNotifier()
        notifier.send_trade_alert({
            "type": "entry",
            "symbol": "BANKNIFTY",
            "direction": "LONG",
            ...
        })
        notifier.send_daily_summary({...})

    Attributes:
        bot_token (str): Telegram bot token from @BotFather.
        chat_id (str): Telegram chat ID to send messages to.
        enabled (bool): Whether Telegram notifications are active.
    """

    def __init__(
        self,
        bot_token: Optional[str] = None,
        chat_id: Optional[str] = None,
        enabled: Optional[bool] = None,
    ):
        """
        Initialize the Telegram Notifier.

        Args:
            bot_token (str, optional): Telegram bot token. Defaults to
                TELEGRAM_BOT_TOKEN env var.
            chat_id (str, optional): Telegram chat ID. Defaults to
                TELEGRAM_CHAT_ID env var.
            enabled (bool, optional): Override auto-detection. If None,
                auto-detects from bot_token and chat_id presence.
        """
        self.bot_token = bot_token or os.getenv("TELEGRAM_BOT_TOKEN", "")
        self.chat_id = chat_id or os.getenv("TELEGRAM_CHAT_ID", "")

        # Auto-detect enabled state if not explicitly set
        if enabled is not None:
            self.enabled = enabled
        else:
            self.enabled = bool(self.bot_token and self.chat_id)

        # ── Rate limiting ──
        # WHY: Telegram's API has rate limits. If we exceed them, messages
        # are silently dropped or the bot gets temporarily banned.
        # We track send timestamps in a sliding window to enforce our limit.
        self._message_timestamps: deque = deque(maxlen=MAX_MESSAGES_PER_MINUTE)
        self._rate_limit_lock = asyncio.Lock() if asyncio.get_event_loop().is_running() else None

        # ── HTTP client (lazy initialization) ──
        # WHY: We don't import httpx at module level because it might not
        # be installed. We create the client lazily on first use.
        self._client = None

        if self.enabled:
            log.info(
                "TelegramNotifier: Enabled — chat_id: %s...%s",
                self.chat_id[:4] if len(self.chat_id) > 4 else "****",
                self.chat_id[-4:] if len(self.chat_id) > 4 else "",
            )
        else:
            log.info("TelegramNotifier: Disabled (no bot_token or chat_id)")

    # ────────────────────────────────────────────────────────────
    # PUBLIC API — SEND MESSAGES
    # ────────────────────────────────────────────────────────────

    async def send_message(
        self,
        text: str,
        parse_mode: str = "HTML",
        disable_notification: bool = False,
    ) -> bool:
        """
        Send a message to the configured Telegram chat.

        This is the LOW-LEVEL send method. Use send_trade_alert(),
        send_system_alert(), or send_daily_summary() for formatted messages.

        Args:
            text (str): Message text to send. Supports HTML formatting.
            parse_mode (str): Telegram parse mode. Default: "HTML".
            disable_notification (bool): Send silently (no sound). Default: False.

        Returns:
            bool: True if message was sent successfully, False otherwise.
        """
        if not self.enabled:
            log.debug("TelegramNotifier: Skipped (disabled) — %s", text[:50])
            return False

        # ── Rate limiting check ──
        if not await self._check_rate_limit():
            log.warning("TelegramNotifier: Rate limit reached — message dropped")
            return False

        try:
            client = await self._get_client()

            url = TELEGRAM_API_BASE.format(token=self.bot_token)
            payload = {
                "chat_id": self.chat_id,
                "text": text,
                "parse_mode": parse_mode,
                "disable_notification": disable_notification,
            }

            response = await client.post(url, json=payload, timeout=MESSAGE_TIMEOUT_SECONDS)

            if response.status_code == 200:
                log.debug("TelegramNotifier: Message sent successfully")
                return True
            elif response.status_code == 429:
                # Too Many Requests — Telegram's server-side rate limit
                retry_after = response.json().get("parameters", {}).get("retry_after", 30)
                log.warning(
                    "TelegramNotifier: Rate limited by Telegram API — retry after %ds",
                    retry_after,
                )
                return False
            else:
                log.warning(
                    "TelegramNotifier: API returned %d: %s",
                    response.status_code,
                    response.text[:200],
                )
                return False

        except Exception as e:
            # WHY: Telegram failures should NEVER crash the trading engine.
            # We log the error and return False so callers can handle it.
            log.error("TelegramNotifier: Failed to send message: %s", e)
            return False

    def send_message_sync(
        self,
        text: str,
        parse_mode: str = "HTML",
        disable_notification: bool = False,
    ) -> bool:
        """
        Synchronous wrapper for send_message().

        This is used by the trading engine (which runs in a sync thread)
        to send Telegram messages without blocking.

        Args:
            text (str): Message text to send.
            parse_mode (str): Telegram parse mode. Default: "HTML".
            disable_notification (bool): Send silently. Default: False.

        Returns:
            bool: True if message was sent successfully.
        """
        try:
            # Try to run in the existing event loop if one is running
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # If we're already in an async context, create a new loop
                # WHY: Can't call asyncio.run() from within an existing event loop.
                # This happens when FastAPI's async route calls a sync method.
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    future = pool.submit(
                        asyncio.run,
                        self.send_message(text, parse_mode, disable_notification),
                    )
                    return future.result(timeout=MESSAGE_TIMEOUT_SECONDS + 5)
            else:
                return loop.run_until_complete(
                    self.send_message(text, parse_mode, disable_notification)
                )
        except RuntimeError:
            # No event loop — create one
            return asyncio.run(
                self.send_message(text, parse_mode, disable_notification)
            )
        except Exception as e:
            log.error("TelegramNotifier: Sync send failed: %s", e)
            return False

    # ────────────────────────────────────────────────────────────
    # PUBLIC API — TRADE ALERTS
    # ────────────────────────────────────────────────────────────

    async def send_trade_alert(self, trade_data: Dict[str, Any]) -> bool:
        """
        Send a formatted trade alert (entry or exit).

        Args:
            trade_data (dict): Trade information with keys:
                - type (str): "entry" or "exit"
                - symbol (str): Trading symbol (e.g., "BANKNIFTY")
                - direction (str): "LONG" or "SHORT"
                - entry_price (float): Entry price
                - exit_price (float, optional): Exit price (for exits)
                - sl (float): Stop loss price
                - target (float): Target price
                - qty (int): Quantity (lots)
                - pnl (float, optional): P&L in rupees (for exits)
                - exit_reason (str, optional): Why the trade was closed
                - option_type (str, optional): "CE" or "PE"
                - option_strike (float, optional): Strike price
                - option_premium (float, optional): Option premium

        Returns:
            bool: True if alert was sent successfully.
        """
        trade_type = trade_data.get("type", "entry")
        symbol = trade_data.get("symbol", "???")
        direction = trade_data.get("direction", "???")

        if trade_type == "entry":
            message = self._format_entry_alert(trade_data)
        elif trade_type == "exit":
            message = self._format_exit_alert(trade_data)
        else:
            log.warning("TelegramNotifier: Unknown trade type: %s", trade_type)
            message = f"{EMOJI['info']} <b>Trade Alert</b>\n{trade_data}"

        return await self.send_message(message)

    def send_trade_alert_sync(self, trade_data: Dict[str, Any]) -> bool:
        """
        Synchronous wrapper for send_trade_alert().

        Args:
            trade_data (dict): Trade information.

        Returns:
            bool: True if alert was sent successfully.
        """
        try:
            return asyncio.run(self.send_trade_alert(trade_data))
        except RuntimeError:
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, self.send_trade_alert(trade_data))
                return future.result(timeout=15)

    # ────────────────────────────────────────────────────────────
    # PUBLIC API — SYSTEM ALERTS
    # ────────────────────────────────────────────────────────────

    async def send_system_alert(
        self,
        title: str,
        message: str,
        level: str = "info",
    ) -> bool:
        """
        Send a formatted system alert.

        Args:
            title (str): Alert title (e.g., "Engine Started").
            message (str): Detailed message.
            level (str): Alert level — "info", "warning", "error", "success".
                Default: "info".

        Returns:
            bool: True if alert was sent successfully.
        """
        emoji = EMOJI.get(level, EMOJI["info"])

        # Format the alert with timestamp
        now = datetime.now(IST).strftime("%H:%M:%S IST")
        formatted = (
            f"{emoji} <b>{title}</b>\n\n"
            f"{message}\n\n"
            f"<i>🕐 {now}</i>"
        )

        return await self.send_message(formatted)

    def send_system_alert_sync(
        self,
        title: str,
        message: str,
        level: str = "info",
    ) -> bool:
        """
        Synchronous wrapper for send_system_alert().

        Args:
            title (str): Alert title.
            message (str): Detailed message.
            level (str): Alert level. Default: "info".

        Returns:
            bool: True if alert was sent successfully.
        """
        try:
            return asyncio.run(self.send_system_alert(title, message, level))
        except RuntimeError:
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(
                    asyncio.run, self.send_system_alert(title, message, level)
                )
                return future.result(timeout=15)

    # ────────────────────────────────────────────────────────────
    # PUBLIC API — DAILY SUMMARY
    # ────────────────────────────────────────────────────────────

    async def send_daily_summary(self, summary: Dict[str, Any]) -> bool:
        """
        Send a formatted daily trading summary.

        Args:
            summary (dict): Daily summary with keys:
                - date (str): Trading date
                - capital (float): Current capital
                - starting_capital (float): Starting capital
                - daily_pnl (float): Today's P&L
                - total_trades (int): Number of trades today
                - wins (int): Number of winning trades
                - losses (int): Number of losing trades
                - win_rate (float): Win rate percentage
                - open_positions (int): Currently open positions
                - largest_win (float): Biggest winning trade
                - largest_loss (float): Biggest losing trade

        Returns:
            bool: True if summary was sent successfully.
        """
        date_str = summary.get("date", datetime.now(IST).strftime("%d %b %Y"))
        capital = summary.get("capital", 0)
        starting_capital = summary.get("starting_capital", 0)
        daily_pnl = summary.get("daily_pnl", 0)
        total_trades = summary.get("total_trades", 0)
        wins = summary.get("wins", 0)
        losses = summary.get("losses", 0)
        win_rate = summary.get("win_rate", 0)
        open_positions = summary.get("open_positions", 0)
        largest_win = summary.get("largest_win", 0)
        largest_loss = summary.get("largest_loss", 0)

        # P&L emoji and sign
        pnl_emoji = EMOJI["arrow_up"] if daily_pnl >= 0 else EMOJI["arrow_down"]
        pnl_sign = "+" if daily_pnl >= 0 else ""

        # Capital change
        capital_change = capital - starting_capital
        capital_pct = (capital_change / starting_capital * 100) if starting_capital else 0
        cap_emoji = "📈" if capital_change >= 0 else "📉"
        cap_sign = "+" if capital_change >= 0 else ""

        message = (
            f"{EMOJI['chart']} <b>DAILY TRADING SUMMARY</b>\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"📅 <b>Date:</b> {date_str}\n\n"
            f"{pnl_emoji} <b>Today's P&L:</b> {pnl_sign}₹{daily_pnl:,.2f}\n"
            f"{cap_emoji} <b>Capital:</b> ₹{capital:,.2f} "
            f"({cap_sign}{capital_pct:.1f}%)\n\n"
            f"📊 <b>Trade Stats:</b>\n"
            f"  • Total Trades: {total_trades}\n"
            f"  • Wins: {wins} | Losses: {losses}\n"
            f"  • Win Rate: {win_rate:.1f}%\n"
            f"  • Largest Win: ₹{largest_win:,.2f}\n"
            f"  • Largest Loss: ₹{largest_loss:,.2f}\n\n"
            f"🔓 <b>Open Positions:</b> {open_positions}\n\n"
            f"<i>🕐 {datetime.now(IST).strftime('%H:%M:%S IST')}</i>"
        )

        return await self.send_message(message)

    def send_daily_summary_sync(self, summary: Dict[str, Any]) -> bool:
        """
        Synchronous wrapper for send_daily_summary().

        Args:
            summary (dict): Daily summary data.

        Returns:
            bool: True if summary was sent successfully.
        """
        try:
            return asyncio.run(self.send_daily_summary(summary))
        except RuntimeError:
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, self.send_daily_summary(summary))
                return future.result(timeout=15)

    # ────────────────────────────────────────────────────────────
    # PUBLIC API — TEST
    # ────────────────────────────────────────────────────────────

    async def send_test(self) -> bool:
        """
        Send a test message to verify bot configuration.

        Returns:
            bool: True if the test message was sent successfully.
        """
        now = datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S IST")
        message = (
            f"{EMOJI['success']} <b>DDLJ Telegram Bot — Test Message</b>\n\n"
            f"✅ Bot is configured correctly!\n"
            f"✅ Chat ID is valid!\n"
            f"✅ Messages will be delivered here.\n\n"
            f"<i>Sent at: {now}</i>"
        )
        return await self.send_message(message)

    def send_test_sync(self) -> bool:
        """
        Synchronous wrapper for send_test().

        Returns:
            bool: True if the test message was sent successfully.
        """
        try:
            return asyncio.run(self.send_test())
        except RuntimeError:
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, self.send_test())
                return future.result(timeout=15)

    # ────────────────────────────────────────────────────────────
    # PRIVATE METHODS — FORMATTING
    # ────────────────────────────────────────────────────────────

    def _format_entry_alert(self, trade_data: Dict[str, Any]) -> str:
        """
        Format a trade entry alert message.

        Args:
            trade_data (dict): Trade entry information.

        Returns:
            str: Formatted HTML message for Telegram.
        """
        symbol = trade_data.get("symbol", "???")
        direction = trade_data.get("direction", "???")
        entry_price = trade_data.get("entry_price", 0)
        sl = trade_data.get("sl", 0)
        target = trade_data.get("target", 0)
        qty = trade_data.get("qty", 0)
        option_type = trade_data.get("option_type", "")
        option_strike = trade_data.get("option_strike", 0)
        option_premium = trade_data.get("option_premium", 0)

        dir_emoji = EMOJI["arrow_up"] if direction == "LONG" else EMOJI["arrow_down"]

        # Build option details if applicable
        option_line = ""
        if option_type:
            option_line = (
                f"\n  📌 Option: {option_type} {option_strike:.0f} @ ₹{option_premium:.2f}"
            )

        # Risk-reward calculation
        risk = abs(entry_price - sl) if sl else 0
        reward = abs(target - entry_price) if target else 0
        rr = f"{reward / risk:.1f}" if risk > 0 else "N/A"

        now = datetime.now(IST).strftime("%H:%M:%S IST")

        return (
            f"{EMOJI['entry']} <b>TRADE ENTRY</b>\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"{dir_emoji} <b>{direction}</b> {symbol}\n"
            f"  📍 Entry: {entry_price:.2f}\n"
            f"  🛡️ SL: {sl:.2f}\n"
            f"  🎯 Target: {target:.2f}\n"
            f"  📊 R:R = 1:{rr}\n"
            f"  📦 Qty: {qty}{option_line}\n\n"
            f"<i>🕐 {now}</i>"
        )

    def _format_exit_alert(self, trade_data: Dict[str, Any]) -> str:
        """
        Format a trade exit alert message.

        Args:
            trade_data (dict): Trade exit information.

        Returns:
            str: Formatted HTML message for Telegram.
        """
        symbol = trade_data.get("symbol", "???")
        direction = trade_data.get("direction", "???")
        entry_price = trade_data.get("entry_price", 0)
        exit_price = trade_data.get("exit_price", 0)
        pnl = trade_data.get("pnl", 0)
        exit_reason = trade_data.get("exit_reason", "N/A")
        held_bars = trade_data.get("held_bars", 0)

        # Determine exit emoji based on P&L
        if pnl > 0:
            exit_emoji = EMOJI["exit_profit"]
            pnl_str = f"+₹{pnl:,.2f}"
        elif pnl < 0:
            exit_emoji = EMOJI["exit_loss"]
            pnl_str = f"-₹{abs(pnl):,.2f}"
        else:
            exit_emoji = EMOJI["exit_be"]
            pnl_str = "₹0.00 (BE)"

        now = datetime.now(IST).strftime("%H:%M:%S IST")

        return (
            f"{exit_emoji} <b>TRADE EXIT</b>\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"{'📈' if direction == 'LONG' else '📉'} <b>{direction}</b> {symbol}\n"
            f"  📍 Entry: {entry_price:.2f}\n"
            f"  📍 Exit: {exit_price:.2f}\n"
            f"  💰 P&L: {pnl_str}\n"
            f"  📋 Reason: {exit_reason}\n"
            f"  ⏱️ Held: {held_bars} bars\n\n"
            f"<i>🕐 {now}</i>"
        )

    # ────────────────────────────────────────────────────────────
    # PRIVATE METHODS — RATE LIMITING
    # ────────────────────────────────────────────────────────────

    async def _check_rate_limit(self) -> bool:
        """
        Check if we're within the rate limit before sending.

        Uses a sliding window of 60 seconds. If we've sent
        MAX_MESSAGES_PER_MINUTE messages in the last 60 seconds,
        we drop the message.

        Returns:
            bool: True if we can send, False if rate limited.
        """
        now = time.monotonic()
        one_minute_ago = now - 60

        # Remove timestamps older than 1 minute
        while self._message_timestamps and self._message_timestamps[0] < one_minute_ago:
            self._message_timestamps.popleft()

        # Check if we're at the limit
        if len(self._message_timestamps) >= MAX_MESSAGES_PER_MINUTE:
            return False

        # Record this message timestamp
        self._message_timestamps.append(now)
        return True

    # ────────────────────────────────────────────────────────────
    # PRIVATE METHODS — HTTP CLIENT
    # ────────────────────────────────────────────────────────────

    async def _get_client(self):
        """
        Get or create the httpx async client (lazy initialization).

        Returns:
            httpx.AsyncClient: The HTTP client for Telegram API calls.

        Raises:
            ImportError: If httpx is not installed.
        """
        if self._client is None or self._client.is_closed:
            try:
                import httpx
                self._client = httpx.AsyncClient(timeout=MESSAGE_TIMEOUT_SECONDS)
            except ImportError:
                # Fallback: use urllib if httpx is not available
                log.warning(
                    "TelegramNotifier: httpx not installed — "
                    "install with: pip install httpx"
                )
                raise ImportError("httpx is required for Telegram notifications")

        return self._client

    async def close(self) -> None:
        """Close the HTTP client (call on shutdown)."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            log.info("TelegramNotifier: HTTP client closed")

    # ────────────────────────────────────────────────────────────
    # PUBLIC API — STATUS
    # ────────────────────────────────────────────────────────────

    def get_status(self) -> Dict[str, Any]:
        """
        Get the current status of the Telegram notifier.

        Returns:
            dict: Status information including enabled state, rate limit
                usage, and configuration.
        """
        now = time.monotonic()
        one_minute_ago = now - 60
        recent_messages = sum(
            1 for ts in self._message_timestamps if ts > one_minute_ago
        )

        return {
            "enabled": self.enabled,
            "bot_token_set": bool(self.bot_token),
            "chat_id_set": bool(self.chat_id),
            "rate_limit": {
                "messages_last_minute": recent_messages,
                "max_per_minute": MAX_MESSAGES_PER_MINUTE,
                "limit_reached": recent_messages >= MAX_MESSAGES_PER_MINUTE,
            },
        }
