#!/bin/bash
# Запуск TG Crypto Bot — Telegram Mini App + Backend (один сервер)
# Использование: ./scripts/start_tma.sh [порт]
# Без аргументов — порт 8000. С аргументом — указанный порт.

set -e
cd "$(dirname "$0")/.."
PORT="${1:-8000}"

if [ ! -f .env ]; then
    echo "Файл .env не найден. Скопируйте .env.example в .env и заполните BOT_TOKEN."
    exit 1
fi

echo "Запуск TMA (API + Mini App) на порту $PORT..."
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port "$PORT"
