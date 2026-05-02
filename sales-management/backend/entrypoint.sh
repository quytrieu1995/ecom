#!/bin/sh
set -e

echo "⏳ Waiting for PostgreSQL..."
until nc -z "${DB_HOST:-postgres}" "${DB_PORT:-5432}"; do
  echo "  DB not ready, retrying in 2s..."
  sleep 2
done
echo "✅ PostgreSQL is up!"

echo "📦 Running prisma db push..."
npx prisma db push --accept-data-loss

echo "🌱 Running seed..."
node src/scripts/seed.js || echo "⚠️  Seed skipped (already seeded)"

echo "🚀 Starting server..."
exec node src/app.js
