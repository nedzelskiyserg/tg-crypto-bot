#!/bin/bash
# Запуск приложения БЕЗ Docker (если сборка образа падает из‑за таймаутов PyPI)
# На сервере: sudo bash scripts/run-without-docker.sh
# Или: cd /opt/tg-crypto-bot && sudo -u www-data bash scripts/run-without-docker.sh

set -e
cd "$(dirname "$0")/.."

APP_DIR="$(pwd)"
VENV_DIR="$APP_DIR/.venv"

echo "=== Запуск TG CRYPTO BOT без Docker ==="

# Python 3.11
if ! command -v python3.11 &>/dev/null; then
  echo "Установка Python 3.11..."
  apt-get update -qq && apt-get install -y -qq python3.11 python3.11-venv python3.11-dev python3-pip
fi

PYTHON="${PYTHON:-python3.11}"

# venv
if [ ! -d "$VENV_DIR" ]; then
  echo "Создание виртуального окружения..."
  $PYTHON -m venv "$VENV_DIR"
fi

echo "Установка зависимостей (зеркало PyPI, таймаут 300 с)..."
"$VENV_DIR/bin/pip" install --timeout 300 --retries 5 \
  -i https://pypi.tuna.tsinghua.edu.cn/simple \
  -r requirements.txt

# .env
if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  echo "Создан .env — заполните BOT_TOKEN: nano $APP_DIR/.env"
fi

echo "Запуск приложения на порту 8000..."
exec "$VENV_DIR/bin/python" -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
