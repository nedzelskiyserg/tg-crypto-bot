#!/bin/bash
# Скрипт для настройки Google Sheets

echo "🔧 Настройка Google Sheets для Telegram бота"
echo ""

# Проверяем наличие .env файла
if [ ! -f .env ]; then
    echo "❌ Файл .env не найден. Создаю..."
    cat > .env << 'EOF'
# Токен Telegram бота
BOT_TOKEN=your_bot_token_here

# Использовать Google Sheets вместо локального файла
USE_GOOGLE_SHEETS=true

# ID Google таблицы
GOOGLE_SHEETS_ID=1OVEn5gfgvngL8nBk5iYAHk8AtQN5FgYA4Hxp_l_FKdo

# Путь к файлу credentials (по умолчанию credentials.json)
GOOGLE_CREDENTIALS_PATH=credentials.json
EOF
    echo "✅ Файл .env создан"
else
    echo "✅ Файл .env найден"
fi

# Обновляем .env с правильными настройками
echo ""
echo "📝 Обновляю настройки в .env..."

# Обновляем USE_GOOGLE_SHEETS
if grep -q "USE_GOOGLE_SHEETS" .env; then
    sed -i.bak 's/^USE_GOOGLE_SHEETS=.*/USE_GOOGLE_SHEETS=true/' .env
else
    echo "USE_GOOGLE_SHEETS=true" >> .env
fi

# Обновляем GOOGLE_SHEETS_ID
if grep -q "GOOGLE_SHEETS_ID" .env; then
    sed -i.bak 's|^GOOGLE_SHEETS_ID=.*|GOOGLE_SHEETS_ID=1OVEn5gfgvngL8nBk5iYAHk8AtQN5FgYA4Hxp_l_FKdo|' .env
else
    echo "GOOGLE_SHEETS_ID=1OVEn5gfgvngL8nBk5iYAHk8AtQN5FgYA4Hxp_l_FKdo" >> .env
fi

# Обновляем GOOGLE_CREDENTIALS_PATH
if grep -q "GOOGLE_CREDENTIALS_PATH" .env; then
    sed -i.bak 's|^GOOGLE_CREDENTIALS_PATH=.*|GOOGLE_CREDENTIALS_PATH=credentials.json|' .env
else
    echo "GOOGLE_CREDENTIALS_PATH=credentials.json" >> .env
fi

# Удаляем резервные копии
rm -f .env.bak

echo "✅ Настройки обновлены"
echo ""

# Проверяем наличие credentials.json
if [ ! -f credentials.json ]; then
    echo "⚠️  Файл credentials.json не найден!"
    echo ""
    echo "📋 Инструкция по получению credentials.json:"
    echo ""
    echo "1. Откройте Google Cloud Console: https://console.cloud.google.com/"
    echo "2. Перейдите в ваш проект: fluted-bit-439519-k2"
    echo "3. Перейдите в 'APIs & Services' → 'Credentials'"
    echo "4. Найдите Service Account: telegram-bot-cms"
    echo "5. Нажмите на него → вкладка 'Keys'"
    echo "6. Нажмите 'Add Key' → 'Create new key' → выберите JSON"
    echo "7. Сохраните скачанный файл как 'credentials.json' в эту директорию"
    echo ""
    echo "📧 Email Service Account: telegram-bot-cms@fluted-bit-439519-k2.iam.gserviceaccount.com"
    echo ""
    echo "🔗 Ваша таблица: https://docs.google.com/spreadsheets/d/1OVEn5gfgvngL8nBk5iYAHk8AtQN5FgYA4Hxp_l_FKdo/edit"
    echo ""
    echo "⚠️  Не забудьте предоставить доступ к таблице:"
    echo "   - Откройте таблицу → 'Share' (Поделиться)"
    echo "   - Добавьте email: telegram-bot-cms@fluted-bit-439519-k2.iam.gserviceaccount.com"
    echo "   - Установите права: Editor"
    echo ""
else
    echo "✅ Файл credentials.json найден"
    echo ""
    # Проверяем email в credentials.json
    if grep -q "telegram-bot-cms@fluted-bit-439519-k2.iam.gserviceaccount.com" credentials.json; then
        echo "✅ Email Service Account совпадает"
    else
        echo "⚠️  Email в credentials.json не совпадает с указанным"
        echo "   Ожидается: telegram-bot-cms@fluted-bit-439519-k2.iam.gserviceaccount.com"
    fi
fi

echo ""
echo "✅ Настройка завершена!"
echo ""
echo "📝 Следующие шаги:"
echo "1. Убедитесь, что credentials.json находится в этой директории"
echo "2. Предоставьте доступ к таблице для Service Account"
echo "3. Проверьте, что BOT_TOKEN указан в .env"
echo "4. Запустите бота: python3 main.py"
echo ""
