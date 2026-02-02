"""Admin loader service - loads admin IDs from Google Sheet (Settings) or Excel file"""
import os
from pathlib import Path

from backend.config import settings, BASE_DIR


def _load_admin_ids_from_google_sheets() -> list[int]:
    """
    Load admin Telegram IDs from Google Sheet, sheet "Settings".
    Expects key "admins" or "админы" in first column, comma-separated IDs in second column.
    """
    try:
        import gspread
        from google.oauth2.service_account import Credentials
    except ImportError:
        print("Warning: gspread or google-auth not installed, cannot load admins from Google Sheet")
        return []

    spreadsheet_id = settings.GOOGLE_SHEETS_ID
    raw_path = settings.GOOGLE_CREDENTIALS_PATH
    credentials_path = raw_path if os.path.isabs(raw_path) else str(BASE_DIR / raw_path)
    if not spreadsheet_id or not os.path.isfile(credentials_path):
        return []

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
        except gspread.exceptions.WorksheetNotFound:
            try:
                settings_sheet = spreadsheet.worksheet("Настройки")
            except gspread.exceptions.WorksheetNotFound:
                print("Warning: Sheet 'Settings' or 'Настройки' not found in Google Sheet")
                return []

        all_values = settings_sheet.get_all_values()
        for row in all_values:
            if len(row) >= 2:
                key = str(row[0]).strip().lower() if row[0] else ""
                value = str(row[1]).strip() if len(row) > 1 and row[1] else ""
                if key in ("admins", "админы", "admin", "админ") and value:
                    raw_ids = [x.strip() for x in value.split(",") if x.strip()]
                    admin_ids = []
                    for raw in raw_ids:
                        try:
                            admin_ids.append(int(raw))
                        except ValueError:
                            pass
                    return admin_ids
        return []
    except Exception as e:
        print(f"Error loading admins from Google Sheet: {e}")
        return []


def _load_admin_ids_from_file() -> list[int]:
    """Load admin Telegram IDs from Excel file (column telegram_id)."""
    import pandas as pd

    admins_file = Path(settings.ADMINS_FILE)
    if not admins_file.exists():
        return []

    try:
        df = pd.read_excel(admins_file, engine="openpyxl")
        id_column = None
        for col in df.columns:
            if col and str(col).lower() in ("telegram_id", "id", "admin_id"):
                id_column = col
                break
        if id_column is None:
            return []
        return df[id_column].dropna().astype(int).tolist()
    except Exception as e:
        print(f"Error loading admins file: {e}")
        return []


def load_admin_ids() -> list[int]:
    """
    Load admin Telegram IDs.

    If GOOGLE_SHEETS_ID and credentials file are set, loads from Google Sheet
    (sheet "Settings", key "admins"/"админы", value = comma-separated IDs).
    Otherwise loads from Excel file (ADMINS_FILE, column telegram_id).

    Returns:
        List of admin Telegram IDs
    """
    raw_path = settings.GOOGLE_CREDENTIALS_PATH
    credentials_path = raw_path if os.path.isabs(raw_path) else str(BASE_DIR / raw_path)
    if settings.GOOGLE_SHEETS_ID and os.path.isfile(credentials_path):
        ids = _load_admin_ids_from_google_sheets()
        if ids:
            return ids
    return _load_admin_ids_from_file()
