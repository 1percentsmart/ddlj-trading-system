#!/usr/bin/env python3
"""
DDLJ v9 Strategy — Kite API Token Manager
=============================================

Manages the lifecycle of Zerodha Kite Connect API access tokens.
Handles auto-loading, validation, exchange, and persistence.

Author: DDLJ Strategy Team
Version: 9.0 (Paper Trading Production)
"""

import os
import sys
import logging
from datetime import datetime

from .config import KITE_API_KEY, KITE_API_SECRET, KITE_TOKEN_FILE

logger = logging.getLogger("kite_token_manager")
logger.setLevel(logging.DEBUG)

_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(
    logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
)
logger.addHandler(_handler)

LOGIN_URL = f"https://kite.trade/connect/login?api_key={KITE_API_KEY}&v=3"


def _read_stored_token() -> str | None:
    """Read the access token from the token file on disk."""
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
    """Persist the access token to disk (overwrites any previous token)."""
    token_dir = os.path.dirname(KITE_TOKEN_FILE)
    if token_dir:
        os.makedirs(token_dir, exist_ok=True)
    with open(KITE_TOKEN_FILE, "w") as f:
        f.write(access_token.strip())
    logger.info("Access token saved to %s", KITE_TOKEN_FILE)


def _create_kite_instance(access_token: str | None = None):
    """Create a KiteConnect object, optionally setting the access token."""
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
    """Verify the current access token by calling kite.profile()."""
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
    """Print clear instructions for the user to generate a new request token."""
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
    print("    from ddlj_v9.token_manager import exchange_request_token")
    print("    exchange_request_token('your_request_token_here')")
    print(f"{separator}\n")


def get_kite_session():
    """
    Return a ready-to-use KiteConnect instance with a valid access token.

    Returns:
        KiteConnect: An authenticated KiteConnect instance.

    Raises:
        RuntimeError: If no valid token is available.
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

    Args:
        request_token (str): The request_token from the Kite login redirect.

    Returns:
        KiteConnect: An authenticated KiteConnect instance.

    Raises:
        RuntimeError: If the token exchange fails.
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

        _save_token(access_token)

        kite = _create_kite_instance(access_token=access_token)

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
    """Return the Kite login URL for manual use."""
    return LOGIN_URL


def token_status() -> dict:
    """
    Check and report the current token status without raising exceptions.

    Returns:
        dict: Token status with keys: "stored", "valid", "user", "error"
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
