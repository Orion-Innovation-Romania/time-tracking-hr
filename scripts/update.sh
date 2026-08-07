#!/usr/bin/env bash
# Pull latest code and rebuild/restart the stack on the Ubuntu VM.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "[update] pulling latest changes..."
git pull --ff-only

echo "[update] building and restarting containers..."
docker compose --env-file .env up -d --build

echo "[update] applying database migrations..."
docker compose exec -T api node apps/api/dist/prisma/migrate-deploy.js || \
  docker compose exec -T api npx prisma migrate deploy --schema apps/api/prisma/schema.prisma || true

echo "[update] pruning dangling images..."
docker image prune -f

echo "[update] done."
