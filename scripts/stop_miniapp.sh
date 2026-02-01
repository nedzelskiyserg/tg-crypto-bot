#!/bin/bash
# Скрипт для остановки Mini App и ngrok

echo "🛑 Остановка Mini App и ngrok..."

# Останавливаем процессы по PID файлам
if [ -f /tmp/miniapp_server.pid ]; then
    OLD_PID=$(cat /tmp/miniapp_server.pid 2>/dev/null)
    if kill -0 $OLD_PID 2>/dev/null; then
        echo "🛑 Останавливаем сервер (PID: $OLD_PID)..."
        kill $OLD_PID 2>/dev/null
    fi
fi

if [ -f /tmp/ngrok.pid ]; then
    OLD_NGROK=$(cat /tmp/ngrok.pid 2>/dev/null)
    if kill -0 $OLD_NGROK 2>/dev/null; then
        echo "🛑 Останавливаем ngrok (PID: $OLD_NGROK)..."
        kill $OLD_NGROK 2>/dev/null
    fi
fi

# Останавливаем процессы по порту
if lsof -ti:8080 > /dev/null 2>&1; then
    echo "🛑 Останавливаем процесс на порту 8080..."
    lsof -ti:8080 | xargs kill 2>/dev/null
    sleep 1
    # Принудительная остановка, если не помогло
    if lsof -ti:8080 > /dev/null 2>&1; then
        lsof -ti:8080 | xargs kill -9 2>/dev/null
    fi
fi

# Останавливаем процессы по имени
pkill -f "http.server.*8080" 2>/dev/null
pkill -f "ngrok http" 2>/dev/null

# Удаляем PID файлы
rm -f /tmp/miniapp_server.pid /tmp/ngrok.pid

echo "✅ Остановлено"
