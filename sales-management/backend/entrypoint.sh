#!/bin/sh
set -e

echo "⏳ Waiting for PostgreSQL..."
until npx prisma db execute --stdin <<< "SELECT 1" > /dev/null 2>&1; do
  sleep 2
done

echo "📦 Running prisma db push..."
npx prisma db push --accept-data-loss

echo "🌱 Running seed..."
node src/scripts/seed.js || echo "⚠️ Seed skipped (already seeded)"

echo "🚀 Starting server..."
exec node src/app.js
