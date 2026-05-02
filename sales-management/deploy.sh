#!/bin/bash
set -e

DOMAIN="ql.thuanchay.vn"
EMAIL="admin@thuanchay.vn"
COMPOSE_FILE="docker-compose.prod.yml"

echo "============================================"
echo " 🚀 Sales Management System — Deploy Script"
echo " 📦 Domain: $DOMAIN"
echo "============================================"

# ─── 1. Check Docker ─────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "📥 Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  echo "⚠️  Docker installed. Log out and back in, then rerun this script."
  exit 0
fi

if ! docker compose version &>/dev/null; then
  echo "📥 Installing Docker Compose plugin..."
  sudo apt-get update -y
  sudo apt-get install -y docker-compose-plugin
fi

echo "✅ Docker $(docker --version)"
echo "✅ Docker Compose $(docker compose version)"

# ─── 2. Check .env ───────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo ""
    echo "⚠️  .env file created from .env.example"
    echo "⚠️  Please edit .env with your actual values before continuing:"
    echo "    nano .env"
    echo ""
    exit 1
  else
    echo "❌ .env.example not found. Aborting."
    exit 1
  fi
fi

# ─── 3. Install Nginx if needed ───────────────────────────────────────────────
if ! command -v nginx &>/dev/null; then
  echo "📥 Installing Nginx..."
  sudo apt-get update -y
  sudo apt-get install -y nginx
fi

# ─── 4. Copy Nginx config ────────────────────────────────────────────────────
echo "📝 Configuring Nginx for $DOMAIN..."
sudo cp nginx/conf.d/sales.conf /etc/nginx/conf.d/ql-thuanchay.conf

# ─── 5. SSL Certificate ──────────────────────────────────────────────────────
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  echo "🔒 Installing SSL Certificate via Certbot..."
  sudo apt-get install -y certbot python3-certbot-nginx

  # Temporarily use HTTP for ACME challenge
  sudo sed -i 's/listen 443 ssl/listen 80/' /etc/nginx/conf.d/ql-thuanchay.conf
  sudo sed -i '/ssl_/d' /etc/nginx/conf.d/ql-thuanchay.conf
  sudo nginx -t && sudo systemctl reload nginx

  sudo certbot --nginx -d "$DOMAIN" --non-interactive \
    --agree-tos -m "$EMAIL"

  # Restore HTTPS config
  sudo cp nginx/conf.d/sales.conf /etc/nginx/conf.d/ql-thuanchay.conf
else
  echo "✅ SSL certificate already exists for $DOMAIN"
fi

# ─── 6. Test Nginx config ─────────────────────────────────────────────────────
sudo nginx -t
echo "✅ Nginx config OK"

# ─── 7. Build Docker images ───────────────────────────────────────────────────
echo "🐳 Building Docker images..."
docker compose -f "$COMPOSE_FILE" build --no-cache

# ─── 8. Start services ───────────────────────────────────────────────────────
echo "⬆️  Starting services..."
docker compose -f "$COMPOSE_FILE" up -d

# ─── 9. Wait for database ─────────────────────────────────────────────────────
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U salesuser -d salesdb; do
  sleep 2
done
echo "✅ PostgreSQL ready"

# ─── 10. Run migrations ───────────────────────────────────────────────────────
echo "🗄️  Running database migrations..."
docker compose -f "$COMPOSE_FILE" exec -T backend npx prisma migrate deploy

# ─── 11. Seed initial data ────────────────────────────────────────────────────
echo "🌱 Seeding initial data (roles + admin user)..."
docker compose -f "$COMPOSE_FILE" exec -T backend node src/scripts/seed.js

# ─── 12. Reload Nginx ────────────────────────────────────────────────────────
sudo systemctl reload nginx

# ─── 13. Setup SSL auto-renew cron ───────────────────────────────────────────
CRON_JOB="0 3 * * * certbot renew --quiet && systemctl reload nginx"
(sudo crontab -l 2>/dev/null | grep -v "certbot renew"; echo "$CRON_JOB") | sudo crontab -
echo "✅ SSL auto-renew cron configured"

echo ""
echo "============================================"
echo " ✅ DEPLOY THÀNH CÔNG!"
echo "============================================"
echo " 🌐 Website:       https://$DOMAIN"
echo " 🔗 Webhook URL:   https://$DOMAIN/webhooks/nhanhvn"
echo " 📊 API Docs:      (only in dev mode)"
echo " 👤 Admin:         admin@thuanchay.vn"
echo " 🔑 Password:      Admin@2024!"
echo ""
echo " ⚠️  QUAN TRỌNG: Đổi mật khẩu admin ngay sau khi đăng nhập!"
echo "============================================"
