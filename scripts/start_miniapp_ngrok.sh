#!/bin/bash
# Скрипт для запуска всей системы TMA (Backend + Miniapp + ngrok)

set -e

cd "$(dirname "$0")/.."
PROJECT_DIR=$(pwd)

echo "🚀 Запуск TMA системы..."
echo "📁 Директория проекта: $PROJECT_DIR"
echo ""

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# PID файлы
BACKEND_PID_FILE="/tmp/tma_backend.pid"
MINIAPP_PID_FILE="/tmp/tma_miniapp.pid"
NGROK_PID_FILE="/tmp/tma_ngrok.pid"

# Порты
BACKEND_PORT=8000
MINIAPP_PORT=8080

# Функция для остановки всех процессов
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Остановка всех процессов...${NC}"

    # Останавливаем backend
    if [ -f "$BACKEND_PID_FILE" ]; then
        PID=$(cat "$BACKEND_PID_FILE")
        if kill -0 $PID 2>/dev/null; then
            kill $PID 2>/dev/null
            echo -e "${GREEN}✅ Backend остановлен (PID: $PID)${NC}"
        fi
        rm -f "$BACKEND_PID_FILE"
    fi

    # Останавливаем miniapp
    if [ -f "$MINIAPP_PID_FILE" ]; then
        PID=$(cat "$MINIAPP_PID_FILE")
        if kill -0 $PID 2>/dev/null; then
            kill $PID 2>/dev/null
            echo -e "${GREEN}✅ Miniapp остановлен (PID: $PID)${NC}"
        fi
        rm -f "$MINIAPP_PID_FILE"
    fi

    # Останавливаем ngrok
    if [ -f "$NGROK_PID_FILE" ]; then
        PID=$(cat "$NGROK_PID_FILE")
        if kill -0 $PID 2>/dev/null; then
            kill $PID 2>/dev/null
            echo -e "${GREEN}✅ ngrok остановлен (PID: $PID)${NC}"
        fi
        rm -f "$NGROK_PID_FILE"
    fi

    # Дополнительная очистка портов
    lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null || true
    lsof -ti:$MINIAPP_PORT | xargs kill -9 2>/dev/null || true

    echo -e "${GREEN}👋 Все процессы остановлены${NC}"
    exit 0
}

# Установка обработчика сигналов
trap cleanup INT TERM

# Функция для освобождения порта
free_port() {
    local PORT=$1
    if lsof -ti:$PORT > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Порт $PORT занят, освобождаем...${NC}"
        lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
}

# Проверяем ngrok
echo -e "${BLUE}🔍 Проверка зависимостей...${NC}"
if ! command -v ngrok &> /dev/null; then
    echo -e "${RED}❌ ngrok не установлен!${NC}"
    echo "📦 Установите через Homebrew:"
    echo "   brew install ngrok/ngrok/ngrok"
    echo ""
    echo "Или скачайте с https://ngrok.com/download"
    exit 1
fi
echo -e "${GREEN}✅ ngrok найден${NC}"

# Проверяем Python зависимости
if ! python3 -c "import fastapi, uvicorn, aiogram, sqlalchemy" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Устанавливаем Python зависимости...${NC}"
    pip3 install -r requirements.txt -q
fi
echo -e "${GREEN}✅ Python зависимости установлены${NC}"
echo ""

# ===============================
# 1. Запуск Backend (FastAPI + Bot)
# ===============================
echo -e "${BLUE}📡 Запуск Backend (FastAPI + Aiogram)...${NC}"

free_port $BACKEND_PORT

# Создаем директорию для БД если не существует
mkdir -p "$PROJECT_DIR/data"

# Запускаем backend
cd "$PROJECT_DIR"
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port $BACKEND_PORT > /tmp/tma_backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > "$BACKEND_PID_FILE"

# Ждем запуска
sleep 3

# Проверяем
if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}❌ Ошибка запуска Backend!${NC}"
    echo "Логи: tail -f /tmp/tma_backend.log"
    cat /tmp/tma_backend.log
    exit 1
fi

# Проверяем health endpoint
if curl -s http://localhost:$BACKEND_PORT/health | grep -q "healthy"; then
    echo -e "${GREEN}✅ Backend запущен (PID: $BACKEND_PID)${NC}"
    echo "   API: http://localhost:$BACKEND_PORT"
    echo "   Логи: /tmp/tma_backend.log"
else
    echo -e "${RED}❌ Backend не отвечает!${NC}"
    cat /tmp/tma_backend.log
    exit 1
fi
echo ""

# ===============================
# 2. Запуск Miniapp Server
# ===============================
echo -e "${BLUE}📱 Запуск Miniapp Server...${NC}"

free_port $MINIAPP_PORT

# Запускаем miniapp сервер
cd "$PROJECT_DIR"
python3 -m http.server $MINIAPP_PORT --directory miniapp > /tmp/tma_miniapp.log 2>&1 &
MINIAPP_PID=$!
echo $MINIAPP_PID > "$MINIAPP_PID_FILE"

sleep 2

if ! kill -0 $MINIAPP_PID 2>/dev/null; then
    echo -e "${RED}❌ Ошибка запуска Miniapp Server!${NC}"
    cat /tmp/tma_miniapp.log
    cleanup
    exit 1
fi

echo -e "${GREEN}✅ Miniapp Server запущен (PID: $MINIAPP_PID)${NC}"
echo "   URL: http://localhost:$MINIAPP_PORT"
echo "   Логи: /tmp/tma_miniapp.log"
echo ""

# ===============================
# 3. Запуск ngrok
# ===============================
echo -e "${BLUE}🌐 Запуск ngrok туннеля...${NC}"

# Останавливаем существующий ngrok
pkill -f "ngrok http" 2>/dev/null || true
sleep 1

# Запускаем ngrok для miniapp
ngrok http $MINIAPP_PORT > /tmp/tma_ngrok.log 2>&1 &
NGROK_PID=$!
echo $NGROK_PID > "$NGROK_PID_FILE"

sleep 4

# Получаем URL туннеля
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | \
    python3 -c "import sys, json; \
    data = json.load(sys.stdin); \
    tunnels = [t for t in data.get('tunnels', []) if 'https' in t.get('public_url', '')]; \
    print(tunnels[0]['public_url'] if tunnels else '')" 2>/dev/null)

if [ -z "$NGROK_URL" ]; then
    echo -e "${YELLOW}⚠️  Не удалось получить ngrok URL автоматически${NC}"
    echo "   Откройте http://localhost:4040 для просмотра URL"
else
    echo -e "${GREEN}✅ ngrok туннель создан (PID: $NGROK_PID)${NC}"
    echo ""
    echo "================================================"
    echo -e "${GREEN}🎉 TMA система запущена!${NC}"
    echo "================================================"
    echo ""
    echo -e "${BLUE}📱 Miniapp URL (для BotFather):${NC}"
    echo -e "   ${GREEN}$NGROK_URL${NC}"
    echo ""
    echo -e "${BLUE}🔗 Локальные адреса:${NC}"
    echo "   Backend API:  http://localhost:$BACKEND_PORT"
    echo "   Miniapp:      http://localhost:$MINIAPP_PORT"
    echo "   ngrok UI:     http://localhost:4040"
    echo ""

    # Обновляем конфигурацию API в miniapp
    # Для production нужно использовать ngrok URL для backend тоже
    echo -e "${YELLOW}⚠️  Важно: Для работы в Telegram обновите BACKEND_API_CONFIG${NC}"
    echo "   в файле miniapp/app.js на публичный URL backend"
    echo ""
fi

echo "================================================"
echo -e "${BLUE}📋 Логи:${NC}"
echo "   Backend: tail -f /tmp/tma_backend.log"
echo "   Miniapp: tail -f /tmp/tma_miniapp.log"
echo "   ngrok:   tail -f /tmp/tma_ngrok.log"
echo ""
echo -e "${YELLOW}🛑 Для остановки нажмите Ctrl+C${NC}"
echo "================================================"
echo ""

# Ждем сигнала остановки
wait
