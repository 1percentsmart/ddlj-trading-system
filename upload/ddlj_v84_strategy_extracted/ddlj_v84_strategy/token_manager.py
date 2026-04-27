#!/usr/bin/env python3
"""
DDLJ v8.4 Strategy — Kite API Token Manager
=============================================

This module manages the lifecycle of Zerodha Kite Connect API access
tokens. It handles:

  - Auto-loading stored access tokens from disk
  - Validating tokens via kite.profile() on every session request
  - Clear re-login instructions when tokens expire
  - Exchanging request tokens for access tokens and auto-saving
  - Providing a ready-to-use KiteConnect instance

WHY A TOKEN MANAGER?
--------------------
Zerodha's access tokens expire daily (they're valid for one trading
day only). This module automates the token management workflow:

  Day 1: User visits login URL → gets request_token → call
         exchange_request_token() → token saved to disk → ready to trade

  Day 2+: get_kite_session() → reads saved token → validates → ready

  If token expired: Clear instructions printed → user re-logs in

TOKEN LIFECYCLE:
  1. User visits Kite login URL in browser
  2. User logs in with Zerodha credentials
  3. Browser redirects to callback URL with request_token
  4. We call kite.generate_session(request_token, api_secret)
  5. Kite returns access_token (valid for one day)
  6. We save access_token to disk
  7. On subsequent runs, we load and validate the saved token

Author: DDLJ Strategy Team
Version: 8.4 (Production)
"""

import os
import sys
import logging
from datetime import datetime

from .config import KITE_API_KEY, KITE_API_SECRET, KITE_TOKEN_FILE

# ---------------------------------------------------------------------------
# Logging Setup
# ---------------------------------------------------------------------------
logger = logging.getLogger("kite_token_manager")
logger.setLevel(logging.DEBUG)

_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(
    logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
)
logger.addHandler(_handler)

# Login URL for the user to visit
LOGIN_URL = f"https://kite.trade/connect/login?api_key={KITE_API_KEY}&v=3"


# ---------------------------------------------------------------------------
# Internal Helpers
# ---------------------------------------------------------------------------

def _read_stored_token() -> str | None:
    """
    Read the access token from the token file on disk.

    Returns:
        str | None: The stored access token, or None if the file
            doesn't exist or is empty.

    WHY check for empty? Sometimes the file exists but contains
    only whitespace (e.g., if a previous save failed partially).
    """
    try:
        with open(KITE_TOKEN_FILE, "r") as f:
            token = f.read().strip()
        return token if token else None
    except FileNotFoundError:
        logger.debug("Token file not found: %s", KITE_TOKEN_FILE)
        return None
    except OSError as exc:
        logger.warning("Could not read token file: %s", exc)
        return None


def _save_token(access_token: str) -> None:
    """
    Persist the access token to disk (overwrites any previous token).

    WHY overwrite? Only one access token is valid at a time. The
    previous day's token is no longer useful.

    Args:
        access_token (str): The new access token to save.
    """
    token_dir = os.path.dirname(KITE_TOKEN_FILE)
    if token_dir:
        os.makedirs(token_dir, exist_ok=True)
    with open(KITE_TOKEN_FILE, "w") as f:
        f.write(access_token.strip())
    logger.info("Access token saved to %s", KITE_TOKEN_FILE)


def _create_kite_instance(access_token: str | None = None):
    """
    Create a KiteConnect object, optionally setting the access token.

    Args:
        access_token (str | None): Access token to set, or None for
            an unauthenticated instance.

    Returns:
        KiteConnect: A KiteConnect instance (authenticated if token provided).
    """
    try:
        from kiteconnect import KiteConnect
    except ImportError:
        raise ImportError(
            "kiteconnect is required. Install with: pip install kiteconnect"
        )

    kite = KiteConnect(api_key=KITE_API_KEY)
    if access_token:
        kite.set_access_token(access_token)
    return kite


def _validate_token(kite) -> bool:
    """
    Verify the current access token by calling kite.profile().

    WHY validate? A token might look valid (non-empty string) but
    could be expired or revoked. The only way to know is to make
    an API call. kite.profile() is lightweight and always available.

    Args:
        kite: A KiteConnect instance with an access token set.

    Returns:
        bool: True if the token is valid, False otherwise.
    """
    try:
        from kiteconnect.exceptions import KiteException, TokenException
    except ImportError:
        KiteException = Exception
        TokenException = Exception

    try:
        profile = kite.profile()
        logger.info(
            "Token valid — logged in as %s (%s)",
            profile.get("user_name", "unknown"),
            profile.get("email", "unknown"),
        )
        return True
    except TokenException as exc:
        logger.warning("Token is invalid/expired: %s", exc)
        return False
    except KiteException as exc:
        logger.warning("Kite API error during token validation: %s", exc)
        return False
    except Exception as exc:
        logger.warning("Unexpected error validating token: %s", exc)
        return False


def _print_login_instructions() -> None:
    """
    Print clear instructions for the user to generate a new request token.

    This is called when the stored token is missing or expired, so the
    user knows exactly what to do next.
    """
    separator = "=" * 65
    print(f"\n{separator}")
    print("  ACCESS TOKEN EXPIRED OR INVALID")
    print(separator)
    print("  Please visit the following URL to authorise and get a new")
    print("  request token:")
    print()
    print(f"    {LOGIN_URL}")
    print()
    print("  After logging in, copy the request_token from the redirect URL")
    print("  and call:")
    print()
    print("    from ddlj_v84_strategy.token_manager import exchange_request_token")
    print("    exchange_request_token('your_request_token_here')")
    print(f"{separator}\n")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_kite_session():
    """
    Return a ready-to-use KiteConnect instance with a valid access token.

    WORKFLOW:
      1. Read stored token from disk.
      2. If found, validate via kite.profile().
      3. If valid, return the authenticated instance.
      4. If missing or invalid, print re-login instructions and raise.

    Returns:
        KiteConnect: An authenticated KiteConnect instance.

    Raises:
        RuntimeError: If no valid token is available.

    Example:
        >>> kite = get_kite_session()
        >>> # Now you can use kite for API calls
        >>> profile = kite.profile()
    """
    stored_token = _read_stored_token()

    if stored_token:
        kite = _create_kite_instance(access_token=stored_token)
        if _validate_token(kite):
            return kite
        else:
            _print_login_instructions()
            raise RuntimeError(
                "Stored access token is expired or invalid. "
                "Please generate a new request token and call "
                "exchange_request_token(request_token)."
            )
    else:
        logger.info("No stored access token found.")
        _print_login_instructions()
        raise RuntimeError(
            "No access token found. Please generate a request token and call "
            "exchange_request_token(request_token)."
        )


def exchange_request_token(request_token: str):
    """
    Exchange a fresh request token for an access token, save it, and
    return a ready-to-use KiteConnect instance.

    This is called ONCE per day, after the user logs in at the Kite
    login URL and receives a request_token from the redirect.

    Args:
        request_token (str): The request_token obtained from the Kite
            login redirect URL. This is a one-time-use token that's
            valid for only a few minutes.

    Returns:
        KiteConnect: An authenticated KiteConnect instance.

    Raises:
        RuntimeError: If the token exchange fails.

    Example:
        >>> # After visiting login URL and getting request_token from redirect:
        >>> kite = exchange_request_token("abc123xyz789")
        >>> # Token is saved automatically, kite instance is ready
    """
    try:
        from kiteconnect.exceptions import KiteException
    except ImportError:
        KiteException = Exception

    kite = _create_kite_instance()

    try:
        data = kite.generate_session(request_token, api_secret=KITE_API_SECRET)
        access_token = data["access_token"]
        logger.info("Token exchange successful.")
        logger.debug("Full session data: %s", data)

        # Persist the new access token
        _save_token(access_token)

        # Re-create instance with the new token
        kite = _create_kite_instance(access_token=access_token)

        # Quick sanity check
        profile = kite.profile()
        logger.info(
            "Authenticated as %s (%s)",
            profile.get("user_name", "unknown"),
            profile.get("email", "unknown"),
        )
        return kite

    except KiteException as exc:
        logger.error("Token exchange failed (KiteException): %s", exc)
        raise RuntimeError(f"Token exchange failed: {exc}") from exc
    except KeyError as exc:
        logger.error("Unexpected session response — missing access_token: %s", exc)
        raise RuntimeError(f"Unexpected session response: {exc}") from exc
    except Exception as exc:
        logger.error("Token exchange failed: %s", exc)
        raise RuntimeError(f"Token exchange failed: {exc}") from exc


def get_login_url() -> str:
    """
    Return the Kite login URL for manual use.

    Returns:
        str: The full login URL.
    """
    return LOGIN_URL


def token_status() -> dict:
    """
    Check and report the current token status without raising exceptions.

    This is useful for pre-flight checks and UI displays.

    Returns:
        dict: Token status with keys:
            - "stored" (bool): Whether a token file exists
            - "valid" (bool): Whether the token passes kite.profile()
            - "user" (dict | None): Profile data if valid, else None
            - "error" (str | None): Error message if invalid, else None

    Example:
        >>> status = token_status()
        >>> if status["valid"]:
        ...     print(f"Logged in as {status['user']['user_name']}")
        ... else:
        ...     print(f"Token issue: {status['error']}")
    """
    try:
        from kiteconnect.exceptions import KiteException, TokenException
    except ImportError:
        KiteException = Exception
        TokenException = Exception

    result = {"stored": False, "valid": False, "user": None, "error": None}

    stored_token = _read_stored_token()
    if not stored_token:
        result["error"] = "No token file found"
        return result

    result["stored"] = True

    kite = _create_kite_instance(access_token=stored_token)
    try:
        profile = kite.profile()
        result["valid"] = True
        result["user"] = profile
        return result
    except TokenException as exc:
        result["error"] = f"TokenException: {exc}"
    except KiteException as exc:
        result["error"] = f"KiteException: {exc}"
    except Exception as exc:
        result["error"] = f"Error: {exc}"

    return result
