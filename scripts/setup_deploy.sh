#!/bin/bash
# Подготовка проекта к выкладке на сервер (один раз)
# Создаёт каталоги, .env из примера при отсутствии, делает скрипты исполняемыми.

set -e
cd "$(dirname "$0")/.."

echo "Подготовка к выкладке TG CRYPTO BOT (TMA)..."

# Каталог для БД
mkdir -p data
echo "  ✓ data/"

# .env: создание или слияние с .env.example (новые переменные добавляются, свои не перезаписываются)
if [ -f scripts/generate_env.sh ]; then
    bash scripts/generate_env.sh
    echo "  ✓ .env создан/обновлён из .env.example — заполните BOT_TOKEN при первом запуске"
else
    [ ! -f .env ] && cp .env.example .env && echo "  ✓ .env создан — заполните BOT_TOKEN"
fi

# Исполняемые скрипты
chmod +x scripts/start_tma.sh 2>/dev/null || true
chmod +x scripts/start_miniapp_ngrok.sh 2>/dev/null || true
chmod +x scripts/stop_miniapp.sh 2>/dev/null || true
echo "  ✓ скрипты сделаны исполняемыми"

# Файл админов для Docker (volume ожидает файл в корне)
if [ ! -f admins.xlsx ] && [ -f backend/admins.xlsx ]; then
    cp backend/admins.xlsx admins.xlsx 2>/dev/null || true
fi
if [ -f admins.xlsx ]; then
    echo "  ✓ admins.xlsx"
fi

echo ""
echo "Готово. Дальше:"
echo "  1. Отредактируйте .env (обязательно BOT_TOKEN; Google и админы уже из .env.example)."
echo "  2. Запуск локально:  ./scripts/start_tma.sh"
echo "  3. Или через Docker: docker compose -f docker-compose.tma.yml up -d"
echo "  4. Обновить .env из примера (добавить новые переменные): ./scripts/generate_env.sh"
echo "  5. Подробно: docs/DEPLOY.md"
echo ""
