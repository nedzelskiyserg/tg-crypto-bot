"""Rate loader service - loads Buy/Sell rates from Google Sheet (Settings) or defaults"""
import os
from typing import Optional

from backend.config import settings, BASE_DIR


def _parse_float(value: str) -> Optional[float]:
    """Parse string to float (e.g. '76,00 ₽', '75,00 ₽', '76'), return None if invalid."""
    if not value:
        return None
    s = str(value).strip()
    s = s.replace("₽", "").replace("\u00a0", " ").strip()
    # Оставляем только цифры, запятую и точку (и минус в начале)
    s = "".join(c for c in s if c in "0123456789,.-")
    s = s.replace(",", ".")
    try:
        return float(s) if s else None
    except (ValueError, TypeError):
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
            # Ключ может быть в первой или второй колонке (BUY/SELL в A или в B)
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


def get_rates_from_settings() -> tuple[float, float]:
    """
    Get Buy and Sell rates: from Google Sheet Settings if configured, else defaults.
    Returns (buy_rate, sell_rate). Defaults: 97.50, 96.80.
    """
    default_buy = 97.50
    default_sell = 96.80

    result = _load_rates_from_google_sheets()
    if result is not None:
        return result
    return (default_buy, default_sell)
