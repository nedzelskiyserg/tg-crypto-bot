#!/bin/bash
# Скрипт для установки ngrok

echo "📦 Установка ngrok..."

# Проверяем Homebrew
if ! command -v brew &> /dev/null; then
    echo "❌ Homebrew не установлен!"
    echo "📋 Установите Homebrew: https://brew.sh"
    exit 1
fi

# Устанавливаем ngrok
echo "⏳ Установка через Homebrew..."
brew install ngrok/ngrok/ngrok

# Проверяем установку
if command -v ngrok &> /dev/null; then
    echo ""
    echo "✅ ngrok успешно установлен!"
    ngrok version
    echo ""
    echo "🚀 Теперь можно запустить:"
    echo "   ./scripts/start_miniapp_ngrok.sh"
else
    echo ""
    echo "⚠️  ngrok установлен, но не найден в PATH"
    echo "📋 Попробуйте перезапустить терминал или выполните:"
    echo "   source ~/.zshrc"
fi
