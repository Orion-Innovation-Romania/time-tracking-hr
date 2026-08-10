#!/usr/bin/env bash
# Back-compat wrapper — prefer ./deploy.sh from the repo root.
set -euo pipefail
exec "$(cd "$(dirname "$0")/.." && pwd)/deploy.sh" "$@"
