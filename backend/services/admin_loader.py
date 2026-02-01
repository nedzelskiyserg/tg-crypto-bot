"""Admin loader service - loads admin IDs from Excel file"""
import os
from pathlib import Path

import pandas as pd

from backend.config import settings


def load_admin_ids() -> list[int]:
    """
    Load admin Telegram IDs from Excel file.

    The Excel file should have a column 'telegram_id' with admin IDs.

    Returns:
        List of admin Telegram IDs
    """
    admins_file = Path(settings.ADMINS_FILE)

    if not admins_file.exists():
        print(f"Warning: Admins file not found: {admins_file}")
        return []

    try:
        df = pd.read_excel(admins_file, engine="openpyxl")

        # Look for telegram_id column (case-insensitive)
        id_column = None
        for col in df.columns:
            if col.lower() in ("telegram_id", "id", "admin_id"):
                id_column = col
                break

        if id_column is None:
            print(f"Warning: No telegram_id column found in {admins_file}")
            return []

        # Extract IDs and convert to integers
        admin_ids = df[id_column].dropna().astype(int).tolist()
        return admin_ids

    except Exception as e:
        print(f"Error loading admins file: {e}")
        return []
