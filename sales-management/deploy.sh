#!/bin/bash
set -e

DOMAIN="ql.thuanchay.vn"
COMPOSE_FILE="docker-compose.prod.yml"

echo "============================================"
echo " 🚀 Sales Management System — Deploy Script"
echo " 📦 Domain: $DOMAIN"
echo " ⚡ Reverse Proxy: Traefik (existing)"
echo "============================================"

# ─── 1. Check Docker ─────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "📥 Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  usermod -aG docker "$USER"
fi

if ! docker compose version &>/dev/null; then
  echo "📥 Installing Docker Compose plugin..."
  apt-get update -y && apt-get install -y docker-compose-plugin
fi

echo "✅ Docker: $(docker --version)"

# ─── 2. Check .env ───────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  .env created. Edit it first: nano .env"
  exit 1
fi

# ─── 3. Create shared proxy network (if not exists) ──────────────────────────
if ! docker network ls | grep -q "^.*proxy"; then
  echo "🌐 Creating shared proxy network..."
  docker network create proxy
else
  echo "✅ proxy network exists"
fi

# ─── 4. Connect Traefik to proxy network (if not connected) ──────────────────
TRAEFIK_CONTAINER=$(docker ps --format "{{.Names}}" | grep traefik | head -1)
if [ -n "$TRAEFIK_CONTAINER" ]; then
  if ! docker network inspect proxy | grep -q "$TRAEFIK_CONTAINER"; then
    echo "🔗 Connecting Traefik ($TRAEFIK_CONTAINER) to proxy network..."
    docker network connect proxy "$TRAEFIK_CONTAINER"
    echo "✅ Traefik connected to proxy network"
  else
    echo "✅ Traefik already on proxy network"
  fi
else
  echo "⚠️  Traefik container not found — make sure Traefik is running"
fi

# ─── 5. Build Docker images ───────────────────────────────────────────────────
echo "🐳 Building Docker images..."
docker compose -f "$COMPOSE_FILE" build --no-cache

# ─── 6. Start services ───────────────────────────────────────────────────────
echo "⬆️  Starting services..."
docker compose -f "$COMPOSE_FILE" up -d

# ─── 7. Wait for database ─────────────────────────────────────────────────────
echo "⏳ Waiting for PostgreSQL..."
for i in {1..30}; do
  if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U salesuser -d salesdb 2>/dev/null; then
    break
  fi
  sleep 2
done
echo "✅ PostgreSQL ready"

# ─── 8. Run migrations ───────────────────────────────────────────────────────
echo "🗄️  Running database migrations..."
docker compose -f "$COMPOSE_FILE" exec -T backend npx prisma migrate deploy

# ─── 9. Seed initial data ────────────────────────────────────────────────────
echo "🌱 Seeding initial data..."
docker compose -f "$COMPOSE_FILE" exec -T backend node src/scripts/seed.js

echo ""
echo "============================================"
echo " ✅ DEPLOY THÀNH CÔNG!"
echo "============================================"
echo " 🌐 Website:       https://$DOMAIN"
echo " 🔗 Webhook URL:   https://$DOMAIN/webhooks/nhanhvn"
echo " 👤 Admin:         admin@thuanchay.vn"
echo " 🔑 Password:      Admin@2024!"
echo ""
echo " ⚠️  Đổi mật khẩu admin ngay sau khi đăng nhập!"
echo " ⏳ SSL cert sẽ được Traefik tự cấp trong ~30 giây"
echo "============================================"
