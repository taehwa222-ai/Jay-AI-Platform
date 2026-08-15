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
ensure_env_value "CONTENT_DIR" "/app/content"
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
echo "Backup"
backup_ready=false
for _attempt in $(seq 1 30); do
  backup_logs="$("${DOCKER[@]}" compose logs --no-color --tail=20 backup 2>&1 || true)"
  if grep -q "Backup failed:" <<<"$backup_logs"; then
    printf '%s\n' "$backup_logs"
    exit 1
  fi
  if grep -q "Restore check: passed" <<<"$backup_logs"; then
    printf '%s\n' "$backup_logs"
    backup_ready=true
    break
  fi
  sleep 1
done
if [ "$backup_ready" != "true" ]; then
  printf '%s\n' "$backup_logs"
  echo "Backup restore check did not complete within 30 seconds."
  exit 1
fi

echo ""
echo "Health"
curl -fsS http://localhost/api/v1/health
echo ""
python3 scripts/smoke-platform.py --base-url http://localhost --frontend-url http://localhost
echo ""
echo "Deployment complete."
