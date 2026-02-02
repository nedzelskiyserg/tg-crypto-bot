#!/bin/bash
#
# Настройка сервера для TG CRYPTO BOT (Telegram Mini App + Backend)
# Запускать на сервере: sudo bash server_setup.sh [домен]
#
# Что делает:
#   - Ставит Docker, Docker Compose, Nginx, Certbot
#   - Клонирует репозиторий в /root/tg-crypto-bot
#   - Создаёт скрипты deploy.sh, stop.sh, update.sh
#   - Настраивает Nginx (прокси на приложение). SSL: certbot --nginx -d домен
#

set -e

# --- Настройки (можно задать через переменные окружения или первый аргумент) ---
APP_DIR="${APP_DIR:-/root/tg-crypto-bot}"
DOMAIN="${1:-$DOMAIN}"
REPO_URL="${REPO_URL:-https://github.com/nedzelskiyserg/tg-crypto-bot.git}"
APP_USER="${APP_USER:-root}"

# --- Проверка root ---
if [ "$(id -u)" -ne 0 ]; then
  echo "Запустите скрипт с правами root: sudo bash $0 [домен]"
  exit 1
fi

echo "=== Настройка сервера TG CRYPTO BOT (TMA) ==="
echo "  Каталог приложения: $APP_DIR"
echo "  Репозиторий: $REPO_URL"
echo "  Домен: ${DOMAIN:-не задан (укажите для Nginx и SSL)}"
echo ""

# --- Определение ОС (скрипт рассчитан на Ubuntu/Debian) ---
if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS_ID="${ID:-unknown}"
fi
if [ "$OS_ID" != "ubuntu" ] && [ "$OS_ID" != "debian" ]; then
  echo "Внимание: скрипт рассчитан на Ubuntu/Debian. У вас: $OS_ID."
  if [ -t 0 ]; then
    read -r -p "Продолжить? (y/N) " yn
    case "$yn" in [yY]) ;; *) exit 1 ;; esac
  fi
fi

install_docker_ubuntu() {
  echo "[1/4] Установка Docker (Ubuntu/Debian)..."
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/${OS_ID}/gpg" | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${OS_ID} $(. /etc/os-release && echo "${VERSION_CODENAME:-jammy}") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  echo "  ✓ Docker установлен"
}

install_nginx_certbot_ubuntu() {
  echo "[2/4] Установка Nginx и Certbot..."
  apt-get install -y -qq nginx certbot python3-certbot-nginx
  systemctl enable --now nginx
  echo "  ✓ Nginx и Certbot установлены"
}

install_docker_ubuntu
install_nginx_certbot_ubuntu

# --- Каталог приложения ---
echo "[3/4] Каталог приложения..."
mkdir -p "$APP_DIR"
chown "$APP_USER":"$APP_USER" "$APP_DIR" 2>/dev/null || true

# --- Клонирование репозитория ---
echo "  Клонирование репозитория: $REPO_URL"
apt-get install -y -qq git 2>/dev/null || true
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR/.repo_tmp" 2>/dev/null || true
  if [ -d "$APP_DIR/.repo_tmp" ]; then
    shopt -s dotglob 2>/dev/null || true
    mv "$APP_DIR/.repo_tmp"/* "$APP_DIR/" 2>/dev/null || true
    [ -d "$APP_DIR/.repo_tmp/.git" ] && mv "$APP_DIR/.repo_tmp/.git" "$APP_DIR/" 2>/dev/null || true
    rm -rf "$APP_DIR/.repo_tmp" 2>/dev/null || true
    chown -R "$APP_USER":"$APP_USER" "$APP_DIR" 2>/dev/null || true
    echo "  ✓ Репозиторий склонирован в $APP_DIR"
  else
    echo "  ⚠ Не удалось клонировать. Загрузите проект вручную (rsync/scp) в $APP_DIR"
  fi
else
  echo "  ✓ В $APP_DIR уже есть репозиторий (git pull для обновления)"
fi

# --- Скрипты деплоя (создаём после клонирования, чтобы не перезаписать) ---
cat > "$APP_DIR/deploy.sh" << 'DEPLOY_SCRIPT'
#!/bin/bash
set -e
cd "$(dirname "$0")"
if [ ! -f docker-compose.tma.yml ]; then
  echo "В каталоге нет docker-compose.tma.yml. Загрузите проект (git clone или rsync) в $(pwd)"
  exit 1
fi
docker compose -f docker-compose.tma.yml up -d --build
echo "Приложение запущено. Логи: docker compose -f docker-compose.tma.yml logs -f app"
DEPLOY_SCRIPT

cat > "$APP_DIR/stop.sh" << 'STOP_SCRIPT'
#!/bin/bash
cd "$(dirname "$0")"
docker compose -f docker-compose.tma.yml down
STOP_SCRIPT

cat > "$APP_DIR/update.sh" << 'UPDATE_SCRIPT'
#!/bin/bash
set -e
cd "$(dirname "$0")"
if [ -d .git ]; then
  git pull
fi
exec ./deploy.sh
UPDATE_SCRIPT

chmod +x "$APP_DIR/deploy.sh" "$APP_DIR/stop.sh" "$APP_DIR/update.sh"
chown "$APP_USER":"$APP_USER" "$APP_DIR/deploy.sh" "$APP_DIR/stop.sh" "$APP_DIR/update.sh" 2>/dev/null || true
echo "  ✓ $APP_DIR/deploy.sh, stop.sh, update.sh созданы"

# --- Nginx: каталог для ACME challenge (Certbot webroot) ---
CERTBOT_WEBROOT="/var/www/certbot"
mkdir -p "$CERTBOT_WEBROOT/.well-known/acme-challenge"
chown -R www-data:www-data "$CERTBOT_WEBROOT" 2>/dev/null || true

# --- Nginx: конфиг для домена ---
echo "[4/4] Nginx: конфиг приложения..."
NGINX_SITE="tma"
if [ -n "$DOMAIN" ]; then
  cat > "/etc/nginx/sites-available/$NGINX_SITE" << NGINX_CONF
# TG CRYPTO BOT — Mini App + API (прокси на Docker)
# Домен и www указывают на один сервер (A @ и A www → IP сервера)
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    client_max_body_size 10M;

    # Let's Encrypt ACME challenge (certbot certonly --webroot -w $CERTBOT_WEBROOT -d ...)
    location ^~ /.well-known/acme-challenge/ {
        alias $CERTBOT_WEBROOT/.well-known/acme-challenge/;
        default_type text/plain;
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
NGINX_CONF
  ln -sf "/etc/nginx/sites-available/$NGINX_SITE" "/etc/nginx/sites-enabled/$NGINX_SITE" 2>/dev/null || true
  nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null || true
  echo "  ✓ Nginx: сайт $NGINX_SITE для $DOMAIN и www.$DOMAIN (порт 80)"
else
  # Без домена — только заглушка, чтобы пользователь подставил server_name
  cat > "/etc/nginx/sites-available/$NGINX_SITE" << NGINX_CONF
# TG CRYPTO BOT — замените YOUR_DOMAIN на ваш домен и включите: ln -sf /etc/nginx/sites-available/tma /etc/nginx/sites-enabled && nginx -t && systemctl reload nginx
server {
    listen 80;
    server_name YOUR_DOMAIN;
    location ^~ /.well-known/acme-challenge/ {
        alias $CERTBOT_WEBROOT/.well-known/acme-challenge/;
        default_type text/plain;
    }
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX_CONF
  echo "  ✓ Nginx: создан /etc/nginx/sites-available/$NGINX_SITE (подставьте домен и включите сайт)"
fi

# --- Итог ---
echo ""
echo "=== Готово ==="
echo ""
echo "1. Создайте .env и заполните BOT_TOKEN:"
echo "   sudo -u $APP_USER cp $APP_DIR/.env.example $APP_DIR/.env"
echo "   sudo -u $APP_USER nano $APP_DIR/.env   # BOT_TOKEN=... и при необходимости CORS_ORIGINS=https://$DOMAIN"
echo ""
echo "2. Запустите приложение:"
echo "   sudo -u $APP_USER $APP_DIR/deploy.sh"
echo ""
if [ -n "$DOMAIN" ]; then
  echo "3. Получите SSL (Let's Encrypt) для домена и www:"
  echo "   certbot --nginx -d $DOMAIN -d www.$DOMAIN"
  echo "   Если certbot --nginx выдаёт ошибку, используйте webroot:"
  echo "   certbot certonly --webroot -w $CERTBOT_WEBROOT -d $DOMAIN -d www.$DOMAIN"
  echo ""
  echo "4. В BotFather укажите URL Mini App: https://$DOMAIN"
else
  echo "3. Задайте домен в Nginx (см. /etc/nginx/sites-available/$NGINX_SITE), затем:"
  echo "   certbot --nginx -d YOUR_DOMAIN -d www.YOUR_DOMAIN"
  echo "   или: certbot certonly --webroot -w $CERTBOT_WEBROOT -d YOUR_DOMAIN -d www.YOUR_DOMAIN"
  echo "   В BotFather укажите URL Mini App: https://YOUR_DOMAIN"
fi
echo ""
echo "Обновление с GitHub: sudo -u $APP_USER $APP_DIR/update.sh"
echo ""
