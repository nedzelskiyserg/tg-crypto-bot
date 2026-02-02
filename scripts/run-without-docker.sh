#!/bin/bash
# Запуск приложения БЕЗ Docker (если сборка образа падает из‑за таймаутов PyPI)
# На сервере: sudo bash scripts/run-without-docker.sh
# Или: cd /root/tg-crypto-bot && bash scripts/run-without-docker.sh

set -e
cd "$(dirname "$0")/.."

APP_DIR="$(pwd)"
VENV_DIR="$APP_DIR/.venv"

echo "=== Запуск TG CRYPTO BOT без Docker ==="

# Выбор Python: 3.12 → 3.11 → 3.10 → python3 (системный)
if [ -z "$PYTHON" ]; then
  for cand in python3.12 python3.11 python3.10 python3; do
    if command -v "$cand" &>/dev/null; then
      PYTHON="$cand"
      break
    fi
  done
fi
if [ -z "$PYTHON" ] || ! command -v "$PYTHON" &>/dev/null; then
  echo "Установка Python 3 (системный пакет)..."
  apt-get update -qq && apt-get install -y -qq python3 python3-venv python3-dev python3-pip
  PYTHON=python3
fi
echo "Используется: $PYTHON ($($PYTHON --version 2>&1))"

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
