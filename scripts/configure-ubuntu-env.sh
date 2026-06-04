#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DEFAULT_PUBLIC_IP="$(curl -fsS --max-time 3 http://checkip.amazonaws.com 2>/dev/null | tr -d '[:space:]' || true)"
DEFAULT_CORS="http://${DEFAULT_PUBLIC_IP:-YOUR_SERVER_IP}"

read -r -p "CORS_ORIGINS [${DEFAULT_CORS}]: " CORS_ORIGINS
CORS_ORIGINS="${CORS_ORIGINS:-$DEFAULT_CORS}"

read -r -p "OPENAI_MODEL [gpt-4o-mini]: " OPENAI_MODEL
OPENAI_MODEL="${OPENAI_MODEL:-gpt-4o-mini}"

echo "Enter a new OpenAI API key. Leave empty to run in local-demo mode."
read -r -s -p "OPENAI_API_KEY: " OPENAI_API_KEY
echo ""

cat >.env <<EOF
APP_NAME=Jay Stock AI Server
APP_ENV=production
API_HOST=0.0.0.0
API_PORT=8000
CORS_ORIGINS=${CORS_ORIGINS}
DEFAULT_TICKERS=AAPL,MSFT,NVDA,TSLA,AMD,META,GOOGL,AMZN
DEFAULT_VOLUME_MULTIPLIER=2.0

OPENAI_API_KEY=${OPENAI_API_KEY}
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=${OPENAI_MODEL}
EOF

chmod 600 .env
echo ".env updated."
echo "Next: run: bash scripts/deploy-ubuntu.sh"
