"""Telegram initData validation service"""
import hashlib
import hmac
import json
from typing import Optional
from urllib.parse import parse_qs, unquote

from backend.config import settings


def validate_init_data(init_data: str) -> bool:
    """
    Validate Telegram WebApp initData using HMAC-SHA256.

    Algorithm:
    1. Parse init_data as URL params
    2. Extract 'hash' and remove from params
    3. Sort remaining params alphabetically
    4. Create data_check_string: "key=value\\n..."
    5. secret_key = HMAC-SHA256("WebAppData", bot_token)
    6. computed_hash = HMAC-SHA256(secret_key, data_check_string)
    7. Compare computed_hash with received hash
    """
    if not init_data:
        return False

    try:
        # Parse query string
        parsed = parse_qs(init_data, keep_blank_values=True)

        # Get hash value
        received_hash = parsed.get("hash", [None])[0]
        if not received_hash:
            return False

        # Remove hash from data
        data_check_parts = []
        for key, values in sorted(parsed.items()):
            if key == "hash":
                continue
            value = values[0] if values else ""
            data_check_parts.append(f"{key}={value}")

        # Create data check string
        data_check_string = "\n".join(data_check_parts)

        # Create secret key
        secret_key = hmac.new(
            b"WebAppData",
            settings.BOT_TOKEN.encode(),
            hashlib.sha256
        ).digest()

        # Compute hash
        computed_hash = hmac.new(
            secret_key,
            data_check_string.encode(),
            hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(computed_hash, received_hash)

    except Exception:
        return False


def parse_init_data(init_data: str) -> Optional[dict]:
    """
    Parse initData and extract user information.

    Returns dict with:
    - id: int (telegram user id)
    - username: Optional[str]
    - first_name: Optional[str]
    - last_name: Optional[str]
    """
    if not init_data:
        return None

    try:
        parsed = parse_qs(init_data, keep_blank_values=True)
        user_data = parsed.get("user", [None])[0]

        if not user_data:
            return None

        # User data is JSON encoded and URL encoded
        user = json.loads(unquote(user_data))

        return {
            "id": user.get("id"),
            "username": user.get("username"),
            "first_name": user.get("first_name"),
            "last_name": user.get("last_name"),
        }

    except Exception:
        return None
