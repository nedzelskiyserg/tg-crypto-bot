"""
Migration script to add bank_card column to orders table.
Run this once after updating the code.

Usage: python -m backend.migrate_add_bank_card
"""
import asyncio
import sqlite3
from pathlib import Path

# Database path (same as in config.py)
BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "data" / "app.db"


def migrate():
    """Add bank_card column to orders table if it doesn't exist"""
    if not DB_PATH.exists():
        print(f"Database not found at {DB_PATH}")
        print("It will be created on first run with the new schema.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Check if column already exists
    cursor.execute("PRAGMA table_info(orders)")
    columns = [col[1] for col in cursor.fetchall()]

    if 'bank_card' in columns:
        print("Column 'bank_card' already exists in 'orders' table.")
    else:
        print("Adding 'bank_card' column to 'orders' table...")
        cursor.execute("ALTER TABLE orders ADD COLUMN bank_card VARCHAR(50) DEFAULT ''")
        conn.commit()
        print("Done!")

    # Also make wallet_address nullable if needed
    # (SQLite doesn't support changing column constraints, but we can check)

    conn.close()


if __name__ == "__main__":
    migrate()
