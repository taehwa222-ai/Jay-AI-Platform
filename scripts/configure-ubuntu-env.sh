#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DEFAULT_PUBLIC_IP="$(curl -fsS --max-time 3 http://checkip.amazonaws.com 2>/dev/null | tr -d '[:space:]' || true)"
DEFAULT_CORS="http://${DEFAULT_PUBLIC_IP:-YOUR_SERVER_IP}"

read -r -p "CORS_ORIGINS [${DEFAULT_CORS}]: " CORS_ORIGINS
CORS_ORIGINS="${CORS_ORIGINS:-$DEFAULT_CORS}"
AUTH_SECRET_KEY="$(openssl rand -hex 32 2>/dev/null || date +%s | sha256sum | awk '{print $1}')"

cat >.env <<EOF
APP_NAME=Jay AI Platform
APP_ENV=production
API_HOST=0.0.0.0
API_PORT=8000
CORS_ORIGINS=${CORS_ORIGINS}
DATA_DIR=/app/data
AUTH_SECRET_KEY=${AUTH_SECRET_KEY}
ACCESS_TOKEN_MINUTES=720
EOF

chmod 600 .env
echo ".env updated."
echo "Next: run: bash scripts/deploy-ubuntu.sh"
