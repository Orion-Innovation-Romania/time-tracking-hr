#!/usr/bin/env bash
# Export Caddy's local CA root so client machines can trust HTTPS.
# Usage: ./scripts/export-ca.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$ROOT/certs"
OUT_FILE="$OUT_DIR/caddy-root.crt"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"

mkdir -p "$OUT_DIR"
cd "$ROOT"

CID="$(docker compose --env-file "$ENV_FILE" ps -q caddy 2>/dev/null || true)"
if [[ -z "$CID" ]]; then
  CID="$(docker ps -qf 'name=ttah-caddy' | head -1 || true)"
fi
[[ -n "$CID" ]] || { echo "[export-ca] caddy container is not running" >&2; exit 1; }

docker cp "$CID":/data/caddy/pki/authorities/local/root.crt "$OUT_FILE"
chmod 644 "$OUT_FILE"

SITE_ADDRESS="$(grep -E '^SITE_ADDRESS=' "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"' || true)"

echo "[export-ca] wrote $OUT_FILE"
echo
echo "Install this certificate as a Trusted Root CA on each client PC."
echo
echo "Windows (Brave / Chrome / Edge) — PowerShell as Administrator:"
echo "  Import-Certificate -FilePath .\\caddy-root.crt -CertStoreLocation Cert:\\LocalMachine\\Root"
echo
echo "Or manually:"
echo "  1. Copy certs/caddy-root.crt to the PC"
echo "  2. Double-click → Install Certificate…"
echo "  3. Local Machine → Trusted Root Certification Authorities"
echo "  4. Fully quit and reopen the browser"
if [[ -n "${SITE_ADDRESS:-}" && "$SITE_ADDRESS" != :* ]]; then
  echo "  5. Open https://${SITE_ADDRESS}/"
fi
