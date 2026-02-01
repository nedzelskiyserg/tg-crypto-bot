#!/usr/bin/env python3
"""
Скрипт для проверки настроек Google Sheets
"""
import os
import json
import sys
from dotenv import load_dotenv

load_dotenv()

print("🔍 Проверка настроек Google Sheets\n")

# Проверка .env
print("1. Проверка .env файла...")
use_google_sheets = os.getenv('USE_GOOGLE_SHEETS', 'false').lower() == 'true'
google_sheets_id = os.getenv('GOOGLE_SHEETS_ID')
credentials_path = os.getenv('GOOGLE_CREDENTIALS_PATH', 'credentials.json')
bot_token = os.getenv('BOT_TOKEN')

if use_google_sheets:
    print("   ✅ USE_GOOGLE_SHEETS=true")
else:
    print("   ⚠️  USE_GOOGLE_SHEETS=false (должно быть true)")

if google_sheets_id:
    print(f"   ✅ GOOGLE_SHEETS_ID={google_sheets_id}")
else:
    print("   ❌ GOOGLE_SHEETS_ID не указан")

if credentials_path:
    print(f"   ✅ GOOGLE_CREDENTIALS_PATH={credentials_path}")
else:
    print("   ❌ GOOGLE_CREDENTIALS_PATH не указан")

if bot_token and bot_token != 'your_bot_token_here':
    print("   ✅ BOT_TOKEN указан")
else:
    print("   ⚠️  BOT_TOKEN не указан или использует значение по умолчанию")

print()

# Проверка credentials.json
print("2. Проверка credentials.json...")
if os.path.exists(credentials_path):
    print(f"   ✅ Файл {credentials_path} найден")
    try:
        with open(credentials_path, 'r') as f:
            creds = json.load(f)
        
        client_email = creds.get('client_email', '')
        project_id = creds.get('project_id', '')
        
        print(f"   ✅ Email: {client_email}")
        print(f"   ✅ Project ID: {project_id}")
        
        expected_email = "telegram-bot-cms@fluted-bit-439519-k2.iam.gserviceaccount.com"
        if client_email == expected_email:
            print("   ✅ Email совпадает с ожидаемым")
        else:
            print(f"   ⚠️  Email не совпадает. Ожидается: {expected_email}")
        
    except json.JSONDecodeError:
        print("   ❌ Файл credentials.json поврежден (неверный JSON)")
    except Exception as e:
        print(f"   ❌ Ошибка при чтении файла: {e}")
else:
    print(f"   ❌ Файл {credentials_path} не найден")
    print("   📋 Скачайте credentials.json из Google Cloud Console")

print()

# Проверка зависимостей
print("3. Проверка зависимостей...")
try:
    import gspread
    print("   ✅ gspread установлен")
except ImportError:
    print("   ❌ gspread не установлен. Выполните: pip3 install -r requirements.txt")

try:
    from google.oauth2.service_account import Credentials
    print("   ✅ google-auth установлен")
except ImportError:
    print("   ❌ google-auth не установлен. Выполните: pip3 install -r requirements.txt")

print()

# Проверка подключения к Google Sheets
if use_google_sheets and os.path.exists(credentials_path):
    print("4. Проверка подключения к Google Sheets...")
    try:
        # Добавляем корневую директорию в путь для импорта
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        sys.path.insert(0, project_root)
        from bot.cms.google_sheets import GoogleSheetsCMS
        cms = GoogleSheetsCMS()
        print("   ✅ Подключение успешно!")
        print(f"   ✅ Загружено {len(cms.menu_items)} пунктов меню")
        
        # Проверяем структуру меню
        root_items = cms.get_root_items()
        if root_items:
            print(f"   ✅ Найдено {len(root_items)} корневых элементов")
        else:
            print("   ⚠️  Корневые элементы не найдены")
            
    except FileNotFoundError as e:
        print(f"   ❌ Файл не найден: {e}")
    except Exception as e:
        print(f"   ❌ Ошибка подключения: {e}")
        print("   💡 Убедитесь, что:")
        print("      - Service Account имеет доступ к таблице")
        print("      - Таблица существует и доступна")
        print("      - Google Sheets API и Drive API включены")
else:
    print("4. Пропуск проверки подключения (настройки неполные)")

print()
print("=" * 50)
print()

if use_google_sheets and os.path.exists(credentials_path) and bot_token:
    print("✅ Все настройки выглядят правильно!")
    print("🚀 Можно запускать бота: python3 -m bot.main")
else:
    print("⚠️  Некоторые настройки требуют внимания")
    print("📋 См. инструкции выше")

print()
