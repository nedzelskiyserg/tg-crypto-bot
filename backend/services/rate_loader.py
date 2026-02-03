"""Rate loader service - loads Buy/Sell rates from external API or Google Sheet, applies markup formula"""
import os
import json
from typing import Optional

import httpx

from backend.config import settings, BASE_DIR


# External rate API config (mosca.moscow)
EXTERNAL_RATE_API_URL = "https://mosca.moscow/api/v1/rate/"
EXTERNAL_RATE_API_TOKEN = "HZAKlDuHaMD5sRpWgeciz6OxeK8b7h76NJHdeqi_OdurDRJBv1mJy4iuyz53wgZRbEmxCiKTojNYgLmRhIzqlA"

# File-based cache for markup settings (avoids sync DB access issues)
_MARKUP_CACHE_FILE = BASE_DIR / "data" / "rate_markup.json"


def _parse_float(value: str) -> Optional[float]:
    """Parse string to float (e.g. '76,00 ₽', '75,00 ₽', '76'), return None if invalid."""
    if not value:
        return None
    s = str(value).strip()
    s = s.replace("₽", "").replace("\u00a0", " ").strip()
    s = "".join(c for c in s if c in "0123456789,.-")
    s = s.replace(",", ".")
    try:
        return float(s) if s else None
    except (ValueError, TypeError):
        return None


def _load_rates_from_external_api() -> Optional[tuple[float, float]]:
    """Load rates from external API (mosca.moscow)."""
    try:
        response = httpx.get(
            EXTERNAL_RATE_API_URL,
            headers={
                "Accept": "application/json",
                "Accept-Language": "ru",
                "access-token": EXTERNAL_RATE_API_TOKEN,
            },
            timeout=10.0,
        )
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, dict) and "buy" in data and "sell" in data:
                buy = float(data["buy"])
                sell = float(data["sell"])
                if buy > 0 and sell > 0:
                    return (buy, sell)
    except Exception as e:
        print(f"External rate API error: {e}")
    return None


def _load_rates_from_google_sheets() -> Optional[tuple[float, float]]:
    """
    Load Buy and Sell rates from Google Sheet, sheet "Settings".
    Expects keys "Buy"/"Покупка" and "Sell"/"Продажа" in first column, numeric value in second.
    Returns (buy_rate, sell_rate) or None.
    """
    try:
        import gspread
        from google.oauth2.service_account import Credentials
    except ImportError:
        return None

    spreadsheet_id = settings.GOOGLE_SHEETS_ID
    raw_path = settings.GOOGLE_CREDENTIALS_PATH
    credentials_path = raw_path if os.path.isabs(raw_path) else str(BASE_DIR / raw_path)
    if not spreadsheet_id or not os.path.isfile(credentials_path):
        return None

    try:
        scope = [
            "https://spreadsheets.google.com/feeds",
            "https://www.googleapis.com/auth/drive",
        ]
        creds = Credentials.from_service_account_file(str(credentials_path), scopes=scope)
        client = gspread.authorize(creds)
        spreadsheet = client.open_by_key(spreadsheet_id)

        try:
            settings_sheet = spreadsheet.worksheet("Settings")
        except Exception:
            try:
                settings_sheet = spreadsheet.worksheet("Настройки")
            except Exception:
                return None

        all_values = settings_sheet.get_all_values()
        buy_val: Optional[float] = None
        sell_val: Optional[float] = None

        for row in all_values:
            if len(row) < 2:
                continue
            a = str(row[0]).strip() if row[0] else ""
            b = str(row[1]).strip() if len(row) > 1 and row[1] else ""
            key_a, key_b = a.lower(), b.lower()
            if key_a in ("buy", "sell", "покупка", "продажа"):
                key, value = key_a, b
            elif key_b in ("buy", "sell", "покупка", "продажа"):
                key, value = key_b, a
            else:
                continue
            parsed = _parse_float(value)
            if parsed is None:
                continue
            if key in ("buy", "покупка"):
                buy_val = parsed
            elif key in ("sell", "продажа"):
                sell_val = parsed

        if buy_val is not None and sell_val is not None:
            print(f"Rates from Google Sheet Settings: buy={buy_val}, sell={sell_val}")
            return (float(buy_val), float(sell_val))
        return None
    except Exception as e:
        print(f"Error loading rates from Google Sheet: {e}")
        return None


def get_markup_settings() -> tuple[float, float]:
    """Get markup percentages from JSON cache file. Returns (buy_markup, sell_markup)."""
    try:
        if _MARKUP_CACHE_FILE.exists():
            data = json.loads(_MARKUP_CACHE_FILE.read_text())
            return (
                float(data.get("buy_markup_percent", 0.0)),
                float(data.get("sell_markup_percent", 0.0)),
            )
    except Exception as e:
        print(f"Error loading markup cache: {e}")
    return (0.0, 0.0)


def save_markup_settings(buy_markup: float, sell_markup: float) -> None:
    """Save markup percentages to JSON cache file."""
    _MARKUP_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
    _MARKUP_CACHE_FILE.write_text(json.dumps({
        "buy_markup_percent": buy_markup,
        "sell_markup_percent": sell_markup,
    }))


def get_raw_rates() -> tuple[float, float]:
    """Get raw rates from external API or Google Sheets (without markup)."""
    default_buy = 97.50
    default_sell = 96.80

    # Try external API first
    result = _load_rates_from_external_api()
    if result is not None:
        return result

    # Fallback to Google Sheets
    result = _load_rates_from_google_sheets()
    if result is not None:
        return result

    return (default_buy, default_sell)


def get_rates_from_settings() -> tuple[float, float]:
    """
    Get Buy and Sell rates with markup applied.

    Formula:
        final_rate = api_rate * (1 + markup_percent / 100)

    Returns (buy_rate, sell_rate).
    """
    raw_buy, raw_sell = get_raw_rates()
    buy_markup, sell_markup = get_markup_settings()

    final_buy = round(raw_buy * (1 + buy_markup / 100), 2)
    final_sell = round(raw_sell * (1 + sell_markup / 100), 2)

    return (final_buy, final_sell)
