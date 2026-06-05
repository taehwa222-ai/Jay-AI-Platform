#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f ".env" ]; then
  cp .env.production.example .env
  echo "Created .env from .env.production.example."
  echo "Edit .env first and set CORS_ORIGINS."
  exit 1
fi

ensure_env_value() {
  local key="$1"
  local value="$2"
  if ! grep -q "^${key}=" .env; then
    printf "%s=%s\n" "$key" "$value" >>.env
    echo "Added ${key} to .env."
  fi
}

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    date +%s | sha256sum | awk '{print $1}'
  fi
}

ensure_env_value "DATA_DIR" "/app/data"
ensure_env_value "AUTH_SECRET_KEY" "$(generate_secret)"
ensure_env_value "ACCESS_TOKEN_MINUTES" "720"

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  DOCKER=(docker)
else
  DOCKER=(sudo docker)
fi

echo "Pulling latest code..."
git pull --ff-only

echo "Building and starting containers..."
"${DOCKER[@]}" compose up -d --build

echo ""
echo "Containers"
"${DOCKER[@]}" compose ps

echo ""
echo "Health"
curl -fsS http://localhost/api/v1/health || true
echo ""
echo "Deployment complete."
