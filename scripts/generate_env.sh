#!/bin/bash
# Слияние .env.example в .env: добавляет недостающие переменные, не перезаписывает существующие.
# Запуск из корня проекта: ./scripts/generate_env.sh

set -e
cd "$(dirname "$0")/.."

EXAMPLE=".env.example"
TARGET=".env"

if [ ! -f "$EXAMPLE" ]; then
  echo "Файл $EXAMPLE не найден."
  exit 1
fi

if [ ! -f "$TARGET" ]; then
  cp "$EXAMPLE" "$TARGET"
  echo "Создан $TARGET из $EXAMPLE. Заполните BOT_TOKEN и при необходимости CORS_ORIGINS."
  exit 0
fi

# Собираем ключи, уже заданные в .env (KEY= или KEY="...")
existing_keys=""
while IFS= read -r line; do
  if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
    key="${line%%=*}"
    existing_keys="${existing_keys} ${key}"
  fi
done < "$TARGET"

# Добавляем в .env строки из .env.example, ключи которых ещё нет в .env
added=0
while IFS= read -r line; do
  # Пропускаем пустые строки и комментарии
  [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
  if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
    key="${line%%=*}"
    if [[ " $existing_keys " != *" $key "* ]]; then
      echo "$line" >> "$TARGET"
      added=$((added + 1))
      existing_keys="${existing_keys} ${key}"
    fi
  fi
done < "$EXAMPLE"

if [ "$added" -gt 0 ]; then
  echo "В $TARGET добавлено переменных: $added. Существующие значения не изменены."
else
  echo "В $TARGET уже есть все переменные из $EXAMPLE."
fi
