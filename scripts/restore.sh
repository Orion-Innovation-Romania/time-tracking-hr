#!/usr/bin/env bash
# Restore the database from a backup file produced by backup.sh.
# WARNING: this overwrites current data. Usage: scripts/restore.sh backups/ttah_YYYYmmdd_HHMMSS.sql.gz
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck disable=SC1091
set -a; [ -f .env ] && . ./.env; set +a

FILE="${1:-}"
if [[ -z "${FILE}" || ! -f "${FILE}" ]]; then
  echo "usage: scripts/restore.sh <backup.sql.gz>"
  exit 1
fi

read -r -p "This will OVERWRITE the '${POSTGRES_DB:-ttah}' database. Continue? [y/N] " ans
[[ "${ans}" == "y" || "${ans}" == "Y" ]] || { echo "aborted."; exit 1; }

echo "[restore] restoring from ${FILE} ..."
gunzip -c "${FILE}" | docker compose exec -T postgres psql -U "${POSTGRES_USER:-ttah}" -d "${POSTGRES_DB:-ttah}"
echo "[restore] done."
