# Выкладка TG CRYPTO BOT (Telegram Mini App + Backend) на сервер

Один сервер отдаёт и API, и статику Mini App. Бот и база данных работают внутри того же процесса.

## Быстрая подготовка (локально, один раз)

В корне проекта выполните:

```bash
./scripts/setup_deploy.sh
```

Скрипт создаёт каталог `data/`, создаёт или обновляет `.env` из `.env.example` (скрипт `scripts/generate_env.sh` добавляет новые переменные, не перезаписывая существующие; Google и админы уже подставлены в примере). Отредактируйте `.env` (обязательно `BOT_TOKEN`) и запускайте приложение (см. ниже).

## Настройка сервера (один скрипт)

На **новом сервере** (Ubuntu/Debian) можно один раз запустить скрипт — он установит Docker, Docker Compose, Nginx, Certbot и создаст каталог приложения и скрипты деплоя.

### Вариант A: Cloud-init (при создании сервера)

Если при создании VPS есть поле **Cloud-init** / **User data** (Timeweb Cloud, Selectel и др.):

1. Откройте файл `scripts/cloud-init.yml` в проекте.
2. Если нужен домен с первого запуска — раскомментируйте строку с `/tmp/server_setup.sh your-domain.ru` и подставьте свой домен; закомментируйте строку `- /tmp/server_setup.sh`.
3. Скопируйте **весь** текст из `scripts/cloud-init.yml` и вставьте в поле Cloud-init в панели при создании сервера.
4. Создайте сервер. При первом запуске скрипт установки выполнится сам (подождите 3–5 минут).
5. Зайдите по SSH и проверьте: `ls /root/tg-crypto-bot`, затем создайте `.env` и запустите `deploy.sh` (см. шаги ниже).

### Вариант B: Вручную (скрипт на уже созданный сервер)

1. Скопируйте скрипт на сервер (из корня проекта):
   ```bash
   scp scripts/server_setup.sh user@ВАШ_СЕРВЕР:/tmp/
   ```

2. Подключитесь и запустите **от root** (домен подставьте свой):
   ```bash
   ssh user@ВАШ_СЕРВЕР
   sudo bash /tmp/server_setup.sh example.com
   ```
   Без аргумента домена Nginx-конфиг создастся с заглушкой `YOUR_DOMAIN` — потом подставите домен вручную.

3. Проект уже будет склонирован в `/root/tg-crypto-bot` из GitHub. На сервере создайте `.env` из примера (Google и админы уже в примере), заполните `BOT_TOKEN`, запустите приложение:
   ```bash
   bash /root/tg-crypto-bot/scripts/generate_env.sh   # создать/обновить .env из .env.example
   nano /root/tg-crypto-bot/.env   # BOT_TOKEN=... и при необходимости CORS_ORIGINS=https://example.com
   /root/tg-crypto-bot/deploy.sh
   ```

4. SSL: `certbot --nginx -d example.com`. В BotFather укажите URL Mini App: `https://example.com`.

Обновление после изменений в GitHub: на сервере выполните `/root/tg-crypto-bot/update.sh` (скрипт сделает `git pull` и перезапустит приложение).

## Настройка домена (DNS)

Чтобы сайт открывался по домену, в панели регистратора (например Reg.ru) настройте DNS:

| Тип | Имя | Значение |
|-----|-----|----------|
| A   | @   | IP вашего сервера (например 95.163.244.138) |
| A   | www | тот же IP |
| NS  | @   | ns1.reg.ru, ns2.reg.ru (или NS вашего регистратора) |

После сохранения подождите 5–30 минут, пока записи обновятся. Проверка: `ping ваш-домен.ru` и `ping www.ваш-домен.ru` должны отвечать с IP сервера.

На сервере запустите скрипт развёртки **с именем домена**: `sudo bash /tmp/server_setup.sh ваш-домен.ru`. Nginx будет обслуживать и `ваш-домен.ru`, и `www.ваш-домен.ru`. SSL для обоих выдаётся одной командой: `certbot --nginx -d ваш-домен.ru -d www.ваш-домен.ru`.

## Требования

- Сервер с Docker и Docker Compose (или только Python 3.11+)
- Домен с HTTPS (для Telegram Mini App обязателен HTTPS)
- Токен бота (BotFather) и при необходимости файл админов `admins.xlsx`

## 1. Переменные окружения

Один `.env` для инлайн-бота и Mini App (TMA). В `.env.example` уже подставлены Google-таблица и путь к credentials — достаточно заполнить `BOT_TOKEN` и при необходимости `CORS_ORIGINS`.

Создать или обновить `.env` из примера (новые переменные добавляются, свои не перезаписываются):

```bash
./scripts/generate_env.sh
```

Обязательно:

| Переменная   | Описание                    |
|-------------|-----------------------------|
| `BOT_TOKEN` | Токен бота от BotFather     |

В примере уже заданы (та же таблица, что у инлайн-бота): `USE_GOOGLE_SHEETS`, `GOOGLE_SHEETS_ID`, `GOOGLE_CREDENTIALS_PATH`. Админы TMA берутся с листа **Settings** (ключ `admins`/`админы`).

По желанию:

| Переменная     | По умолчанию | Описание |
|----------------|--------------|----------|
| `DATABASE_URL` | SQLite в `data/app.db` | Строка подключения к БД |
| `CORS_ORIGINS` | `*` | Разрешённые источники для API (через запятую), например `https://your-domain.com` |
| `ADMINS_FILE`  | `backend/admins.xlsx` | Путь к Excel с ID админов (если Google Sheets не задан) |
| `PUBLIC_URL`   | — | Публичный URL приложения (для логов/уведомлений) |

## 2. Запуск через Docker (рекомендуется)

```bash
# Сборка и запуск
docker compose -f docker-compose.tma.yml up -d

# Логи
docker compose -f docker-compose.tma.yml logs -f app

# Остановка
docker compose -f docker-compose.tma.yml down
```

- Приложение слушает порт **8000**.
- Данные SQLite сохраняются в каталог `./data` на хосте (volume).
- Файл админов монтируется с хоста: `./admins.xlsx` → `/app/backend/admins.xlsx`. Создайте `admins.xlsx` в корне проекта или скопируйте из `backend/`, иначе при отсутствии файла volume может создать каталог.

Перед первым запуском создайте каталог и файл при необходимости:

```bash
mkdir -p data
# admins.xlsx — положите в корень проекта или в backend/
```

## 3. Запуск без Docker (systemd / ручной)

На сервере с Python 3.11+:

```bash
cd /path/to/TG-CRYPTO-BOT
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# отредактируйте .env (BOT_TOKEN и при необходимости CORS_ORIGINS)
mkdir -p data
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Для продакшена лучше запускать через gunicorn + uvicorn workers или systemd (см. ниже).

### Пример unit для systemd

Файл `/etc/systemd/system/tma-app.service`:

```ini
[Unit]
Description=TG Crypto Bot TMA (Mini App + API)
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/TG-CRYPTO-BOT
EnvironmentFile=/path/to/TG-CRYPTO-BOT/.env
ExecStart=/path/to/TG-CRYPTO-BOT/.venv/bin/python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable tma-app
sudo systemctl start tma-app
```

## 4. Nginx перед приложением (HTTPS и домен)

Чтобы отдавать приложение по HTTPS и при необходимости кэшировать статику:

1. Настроить SSL (Let's Encrypt: `certbot`).
2. Проксировать запросы на `http://127.0.0.1:8000`.

Скрипт `server_setup.sh` создаёт в Nginx блок `location ^~ /.well-known/acme-challenge/` и каталог `/var/www/certbot`. Если `certbot --nginx` выдаёт ошибку проверки домена, получите сертификат вручную:

```bash
sudo certbot certonly --webroot -w /var/www/certbot -d your-domain.com -d www.your-domain.com
```

После этого добавьте в конфиг Nginx блоки `listen 443 ssl` и пути к сертификатам (или выполните `certbot --nginx` ещё раз — он подставит SSL в существующий конфиг).

Пример конфига Nginx (готовый HTTPS):

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

В `.env` на сервере укажите:

```bash
CORS_ORIGINS=https://your-domain.com
```

## 5. Настройка Mini App в BotFather

1. В BotFather: **Bot Settings** → **Menu Button** / **Mini App**.
2. Укажите URL вашего приложения: `https://your-domain.com` (или полный путь к Mini App, если отдаёте его с другого пути).
3. Приложение и API должны быть доступны по одному домену (как в этом варианте выкладки), тогда запросы к API идут на тот же origin и дополнительная настройка URL в коде не нужна.

## 6. Автономность

- Один процесс: FastAPI + бот (Aiogram) + раздача статики Mini App.
- База по умолчанию — SQLite в `data/app.db` (для больших нагрузок можно перейти на PostgreSQL через `DATABASE_URL`).
- Секреты и домены задаются только через `.env` и Nginx; в коде нет захардкоженных продакшен-URL и токенов.

## 7. Проверка после выкладки

- Открыть в браузере: `https://your-domain.com` — должна открыться главная Mini App.
- Проверить API: `https://your-domain.com/health` — ответ `{"status":"healthy"}`.
- Открыть Mini App из Telegram и проверить создание заявки (форма обмена).
