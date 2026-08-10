#!/usr/bin/env bash
# Deploy the local tree to Docker on this machine (no git pull).
# Usage: git pull  (yourself)  →  ./deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

ENV_FILE="${ENV_FILE:-$ROOT/.env}"
COMPOSE=(docker compose --env-file "$ENV_FILE")

log() { printf '[deploy] %s\n' "$*"; }
die() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

# --- preflight ---
command -v docker >/dev/null || die "docker not found"
docker compose version >/dev/null 2>&1 || die "docker compose plugin not found"
docker info >/dev/null 2>&1 || die "cannot talk to Docker daemon (are you in the docker group?)"

[[ -f "$ENV_FILE" ]] || die "missing $ENV_FILE (copy .env.example or symlink your env file)"
[[ -f "$ROOT/docker-compose.yml" ]] || die "docker-compose.yml not found in $ROOT"

if command -v git >/dev/null && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  log "deploying local tree: $(git rev-parse --abbrev-ref HEAD) @ $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"
else
  log "deploying local tree from $ROOT"
fi

# --- build & start ---
# Migrations run automatically on API container start (see apps/api/Dockerfile).
log "building images and updating containers..."
"${COMPOSE[@]}" up -d --build --remove-orphans

# --- wait for API health ---
log "waiting for API /api/health ..."
ready=0
for _ in $(seq 1 90); do
  if "${COMPOSE[@]}" exec -T api node -e \
    "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
    >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done

if [[ "$ready" -eq 1 ]]; then
  log "API is healthy"
else
  log "warning: API health check timed out — inspect with: docker compose logs -f api"
fi

# --- cleanup ---
log "pruning dangling images..."
docker image prune -f >/dev/null || true

if [[ -x "$ROOT/scripts/export-ca.sh" ]]; then
  "$ROOT/scripts/export-ca.sh" >/dev/null || log "warning: could not export Caddy CA"
fi

# --- summary ---
SITE_ADDRESS="$(grep -E '^SITE_ADDRESS=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d '"' || true)"
echo
"${COMPOSE[@]}" ps
echo
if [[ -n "${SITE_ADDRESS:-}" && "$SITE_ADDRESS" != :* ]]; then
  log "app URL: https://${SITE_ADDRESS}/"
else
  log "app URL: https://<this-host-ip>/"
fi
log "done."
