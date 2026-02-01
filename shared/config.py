"""
Общая конфигурация для всех приложений
"""
import os
from dotenv import load_dotenv
from typing import Optional

# Загружаем переменные окружения
load_dotenv()


class Config:
    """Класс для управления конфигурацией"""
    
    # Telegram Bot
    BOT_TOKEN: Optional[str] = os.getenv('BOT_TOKEN')
    
    # Google Sheets
    USE_GOOGLE_SHEETS: bool = os.getenv('USE_GOOGLE_SHEETS', 'false').lower() == 'true'
    GOOGLE_SHEETS_ID: Optional[str] = os.getenv('GOOGLE_SHEETS_ID')
    GOOGLE_CREDENTIALS_PATH: str = os.getenv('GOOGLE_CREDENTIALS_PATH', 'credentials.json')
    
    # Local CMS
    MENU_FILE: str = os.getenv('MENU_FILE', 'menu.xlsx')
    
    # Logging
    LOG_LEVEL: str = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FORMAT: str = os.getenv(
        'LOG_FORMAT',
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    @classmethod
    def validate(cls) -> None:
        """Проверяет обязательные параметры конфигурации"""
        if not cls.BOT_TOKEN:
            raise ValueError("BOT_TOKEN не найден в переменных окружения. Проверьте файл .env")
        
        if cls.USE_GOOGLE_SHEETS:
            if not cls.GOOGLE_SHEETS_ID:
                raise ValueError("GOOGLE_SHEETS_ID не указан. Укажите в .env")
            if not os.path.exists(cls.GOOGLE_CREDENTIALS_PATH):
                raise FileNotFoundError(
                    f"Файл credentials не найден: {cls.GOOGLE_CREDENTIALS_PATH}\n"
                    "Создайте Service Account в Google Cloud и скачайте JSON ключ"
                )
