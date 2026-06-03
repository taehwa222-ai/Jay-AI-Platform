#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f ".env" ]; then
  cp .env.production.example .env
  echo "Created .env from .env.production.example."
  echo "Edit .env first and add OPENAI_API_KEY, OPENAI_MODEL, and CORS_ORIGINS."
  exit 1
fi

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
