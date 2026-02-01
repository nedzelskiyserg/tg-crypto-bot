#!/bin/bash
# Скрипт для остановки TMA системы

echo "🛑 Остановка TMA системы..."

# PID файлы
BACKEND_PID_FILE="/tmp/tma_backend.pid"
MINIAPP_PID_FILE="/tmp/tma_miniapp.pid"
NGROK_PID_FILE="/tmp/tma_ngrok.pid"

# Останавливаем backend
if [ -f "$BACKEND_PID_FILE" ]; then
    PID=$(cat "$BACKEND_PID_FILE")
    if kill -0 $PID 2>/dev/null; then
        kill $PID 2>/dev/null
        echo "✅ Backend остановлен (PID: $PID)"
    fi
    rm -f "$BACKEND_PID_FILE"
fi

# Останавливаем miniapp
if [ -f "$MINIAPP_PID_FILE" ]; then
    PID=$(cat "$MINIAPP_PID_FILE")
    if kill -0 $PID 2>/dev/null; then
        kill $PID 2>/dev/null
        echo "✅ Miniapp остановлен (PID: $PID)"
    fi
    rm -f "$MINIAPP_PID_FILE"
fi

# Останавливаем ngrok
if [ -f "$NGROK_PID_FILE" ]; then
    PID=$(cat "$NGROK_PID_FILE")
    if kill -0 $PID 2>/dev/null; then
        kill $PID 2>/dev/null
        echo "✅ ngrok остановлен (PID: $PID)"
    fi
    rm -f "$NGROK_PID_FILE"
fi

# Дополнительная очистка
pkill -f "uvicorn backend.main" 2>/dev/null && echo "✅ Остановлены uvicorn процессы" || true
pkill -f "http.server.*miniapp" 2>/dev/null && echo "✅ Остановлены http.server процессы" || true
pkill -f "ngrok http" 2>/dev/null && echo "✅ Остановлены ngrok процессы" || true

# Освобождаем порты
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:8080 | xargs kill -9 2>/dev/null || true

echo ""
echo "👋 TMA система остановлена"
