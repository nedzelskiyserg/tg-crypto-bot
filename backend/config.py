"""Configuration settings for the backend"""
import os
from pathlib import Path
from dotenv import load_dotenv
from typing import List, Optional

# Load environment variables
load_dotenv()

# Base directory (project root: parent of backend/)
BASE_DIR = Path(__file__).resolve().parent.parent
# Directory with Mini App static files (for production single-server deploy)
MINIAPP_DIR = BASE_DIR / "miniapp"
BACKEND_DIR = Path(__file__).resolve().parent

_cors_env = os.getenv("CORS_ORIGINS", "").strip()


def _default_database_url() -> str:
    db_path = BASE_DIR / "data" / "app.db"
    return f"sqlite+aiosqlite:///{db_path}"


class Settings:
    """Application settings"""

    # Telegram Bot
    BOT_TOKEN: str = os.getenv("BOT_TOKEN", "")

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", _default_database_url())

    # API Settings
    API_PREFIX: str = os.getenv("API_PREFIX", "/api")

    # CORS: from env comma-separated, or ["*"] if empty
    CORS_ORIGINS: List[str] = (
        [o.strip() for o in _cors_env.split(",") if o.strip()]
        if _cors_env
        else ["*"]
    )

    # Admin Excel file
    ADMINS_FILE: str = os.getenv("ADMINS_FILE", str(BACKEND_DIR / "admins.xlsx"))

    # Public URL (optional)
    PUBLIC_URL: Optional[str] = os.getenv("PUBLIC_URL") or None

    @classmethod
    def validate(cls) -> None:
        """Validate required settings"""
        if not cls.BOT_TOKEN:
            raise ValueError("BOT_TOKEN is not set in environment variables")


settings = Settings()
