# Быстрый старт с Google Sheets

## Что нужно сделать (пошагово)

### 1. Установите зависимости
```bash
pip3 install -r requirements.txt
```

### 2. Создайте Service Account в Google Cloud

1. Откройте [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте проект (если нет)
3. Включите API:
   - Google Sheets API
   - Google Drive API
4. Создайте Service Account:
   - "APIs & Services" → "Credentials" → "Create Credentials" → "Service Account"
5. Создайте ключ (JSON):
   - В созданном Service Account → "Keys" → "Add Key" → "Create new key" → JSON
6. Сохраните скачанный файл как `credentials.json` в корне проекта

### 3. Предоставьте доступ к таблице

1. Откройте вашу таблицу: https://docs.google.com/spreadsheets/d/1OVEn5gfgvngL8nBk5iYAHk8AtQN5FgYA4Hxp_l_FKdo/edit
2. Нажмите "Share" (Поделиться)
3. Вставьте email из `credentials.json` (поле `client_email`)
4. Установите права: **Editor**
5. Нажмите "Share"

### 4. Настройте .env файл

Откройте `.env` и добавьте:

```env
BOT_TOKEN=ваш_токен_бота
USE_GOOGLE_SHEETS=true
GOOGLE_SHEETS_ID=1OVEn5gfgvngL8nBk5iYAHk8AtQN5FgYA4Hxp_l_FKdo
GOOGLE_CREDENTIALS_PATH=credentials.json
```

### 5. Запустите бота

```bash
python3 main.py
```

## Готово! 🎉

Теперь меню загружается из Google Sheets. Редактируйте таблицу онлайн - изменения применятся после перезапуска бота.

## Подробная инструкция

См. файл `GOOGLE_SHEETS_SETUP.md` для детальной инструкции.
