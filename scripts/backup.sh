#!/usr/bin/env bash
# Create a compressed database backup. Add to cron for daily backups, e.g.:
#   0 2 * * * /opt/ttah/scripts/backup.sh >> /var/log/ttah-backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
set -a; [ -f .env ] && . ./.env; set +a

STAMP="$(date +%Y%m%d_%H%M%S)"
OUT_DIR="backups"
mkdir -p "$OUT_DIR"
FILE="${OUT_DIR}/ttah_${STAMP}.sql.gz"

echo "[backup] dumping database to ${FILE} ..."
docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-ttah}" "${POSTGRES_DB:-ttah}" | gzip > "${FILE}"

# Retain the 30 most recent backups.
ls -1t "${OUT_DIR}"/ttah_*.sql.gz 2>/dev/null | tail -n +31 | xargs -r rm -f

echo "[backup] done: ${FILE}"
