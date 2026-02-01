# Установка ngrok

## Способ 1: Через Homebrew (рекомендуется)

```bash
brew install ngrok/ngrok/ngrok
```

Или используйте скрипт:
```bash
./scripts/install_ngrok.sh
```

## Способ 2: Прямая загрузка

1. Перейдите на https://ngrok.com/download
2. Скачайте версию для macOS
3. Распакуйте архив
4. Переместите `ngrok` в `/usr/local/bin/`:
   ```bash
   sudo mv ngrok /usr/local/bin/
   ```

## Проверка установки

```bash
ngrok version
```

## Настройка (опционально)

Для использования ngrok с аутентификацией:

1. Зарегистрируйтесь на https://ngrok.com
2. Получите authtoken
3. Выполните:
   ```bash
   ngrok config add-authtoken YOUR_TOKEN
   ```

## После установки

Запустите Mini App:
```bash
./scripts/start_miniapp_ngrok.sh
```
