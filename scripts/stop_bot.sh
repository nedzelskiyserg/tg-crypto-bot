#!/bin/bash
# Скрипт для остановки бота

echo "Остановка бота..."

# Находим и останавливаем все процессы бота
pids=$(pgrep -f "python.*bot/main.py\|python.*-m bot.main" 2>/dev/null)

if [ -z "$pids" ]; then
    echo "Бот не запущен"
    exit 0
fi

for pid in $pids; do
    echo "Остановка процесса с PID: $pid"
    kill -TERM $pid 2>/dev/null
done

# Ждем завершения процессов
sleep 2

# Если процессы все еще запущены, принудительно завершаем
remaining=$(pgrep -f "python.*bot/main.py\|python.*-m bot.main" 2>/dev/null)
if [ ! -z "$remaining" ]; then
    echo "Принудительная остановка процессов..."
    pkill -9 -f "python.*bot/main.py\|python.*-m bot.main" 2>/dev/null
fi

echo "Бот остановлен"
