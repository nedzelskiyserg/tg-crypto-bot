# Инструкция по настройке Google Sheets для CMS

## Быстрая настройка

### Шаг 1: Создание Service Account в Google Cloud

1. Перейдите на [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте новый проект или выберите существующий
3. Включите **Google Sheets API** и **Google Drive API**:
   - Перейдите в "APIs & Services" → "Library"
   - Найдите "Google Sheets API" и нажмите "Enable"
   - Найдите "Google Drive API" и нажмите "Enable"

### Шаг 2: Создание Service Account

1. Перейдите в "APIs & Services" → "Credentials"
2. Нажмите "Create Credentials" → "Service Account"
3. Заполните:
   - **Service account name**: `telegram-bot-cms` (или любое другое)
   - **Service account ID**: автоматически заполнится
4. Нажмите "Create and Continue"
5. Пропустите шаг "Grant this service account access to project" (нажмите "Continue")
6. Нажмите "Done"

### Шаг 3: Создание ключа

1. Найдите созданный Service Account в списке
2. Нажмите на него
3. Перейдите на вкладку "Keys"
4. Нажмите "Add Key" → "Create new key"
5. Выберите формат **JSON**
6. Нажмите "Create"
7. Файл автоматически скачается (например, `your-project-xxxxx.json`)

### Шаг 4: Переименование и размещение файла

1. Переименуйте скачанный JSON файл в `credentials.json`
2. Поместите его в корневую директорию проекта (рядом с `main.py`)

### Шаг 5: Предоставление доступа к Google таблице

1. Откройте вашу Google таблицу: https://docs.google.com/spreadsheets/d/1OVEn5gfgvngL8nBk5iYAHk8AtQN5FgYA4Hxp_l_FKdo/edit
2. Нажмите кнопку **"Share"** (Поделиться) в правом верхнем углу
3. В поле "Add people and groups" вставьте **email вашего Service Account**
   - Email можно найти в скачанном JSON файле в поле `client_email`
   - Пример: `telegram-bot-cms@your-project.iam.gserviceaccount.com`
4. Установите права доступа: **"Editor"** (Редактор)
5. Снимите галочку "Notify people" (чтобы не отправлять уведомление)
6. Нажмите "Share"

### Шаг 6: Получение ID таблицы

ID таблицы уже есть в URL:
```
https://docs.google.com/spreadsheets/d/1OVEn5gfgvngL8nBk5iYAHk8AtQN5FgYA4Hxp_l_FKdo/edit
                                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                    Это и есть ID таблицы
```

ID: `1OVEn5gfgvngL8nBk5iYAHk8AtQN5FgYA4Hxp_l_FKdo`

### Шаг 7: Настройка .env файла

Откройте файл `.env` и добавьте:

```env
# Токен Telegram бота
BOT_TOKEN=your_bot_token_here

# Использовать Google Sheets вместо локального файла
USE_GOOGLE_SHEETS=true

# ID Google таблицы
GOOGLE_SHEETS_ID=1OVEn5gfgvngL8nBk5iYAHk8AtQN5FgYA4Hxp_l_FKdo

# Путь к файлу credentials (по умолчанию credentials.json)
GOOGLE_CREDENTIALS_PATH=credentials.json
```

### Шаг 8: Установка зависимостей

```bash
pip3 install -r requirements.txt
```

### Шаг 9: Запуск бота

```bash
python3 main.py
```

## Структура таблицы в Google Sheets

Таблица должна иметь следующие столбцы:

| Столбец | Описание | Пример |
|---------|----------|--------|
| **A (ID)** | Уникальный идентификатор | `1`, `2` |
| **B (Название)** | Текст кнопки | `Обмен валют` |
| **C (Родитель ID)** | ID родителя (пусто для корня) | `1` или пусто |
| **D (Тип)** | `button` или `message` | `button` |
| **E (Текст)** | Содержимое сообщения | `Информация...` |
| **F (Callback Data)** | (опционально) | Автоматически |
| **G (Порядок)** | Порядок отображения | `1`, `2` |

**Важно:** Первая строка должна содержать заголовки!

## Проверка работы

1. Убедитесь, что файл `credentials.json` находится в корне проекта
2. Проверьте, что Service Account имеет доступ к таблице
3. Запустите бота и проверьте логи:
   ```
   Используется Google Sheets для меню
   Загружено X пунктов меню из Google Sheets
   ```

## Обновление меню

Теперь вы можете редактировать меню прямо в Google Sheets:
1. Откройте таблицу в браузере
2. Внесите изменения
3. Сохраните (автоматически)
4. Бот автоматически загрузит изменения при следующем обращении к меню

**Примечание:** Для немедленного обновления можно перезапустить бота или добавить команду `/reload` (если реализована).

## Решение проблем

### Ошибка: "File not found: credentials.json"
- Убедитесь, что файл `credentials.json` находится в корне проекта
- Проверьте путь в `.env`: `GOOGLE_CREDENTIALS_PATH=credentials.json`

### Ошибка: "Permission denied" или "Access denied"
- Убедитесь, что Service Account имеет доступ к таблице
- Проверьте, что email Service Account добавлен как Editor

### Ошибка: "Spreadsheet not found"
- Проверьте правильность ID таблицы в `.env`
- Убедитесь, что таблица существует и доступна

### Меню не загружается
- Проверьте структуру таблицы (заголовки в первой строке)
- Убедитесь, что данные заполнены правильно
- Проверьте логи бота на наличие ошибок

## Безопасность

⚠️ **ВАЖНО:**
- Никогда не коммитьте файл `credentials.json` в Git!
- Добавьте его в `.gitignore`
- Не делитесь этим файлом с другими
- Если файл был скомпрометирован, удалите Service Account и создайте новый

## Альтернатива: Локальный файл

Если хотите вернуться к локальному XLSX файлу:
1. В `.env` установите: `USE_GOOGLE_SHEETS=false`
2. Убедитесь, что файл `menu.xlsx` существует
3. Перезапустите бота
