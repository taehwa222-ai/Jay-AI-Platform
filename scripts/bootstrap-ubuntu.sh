#!/usr/bin/env bash
set -euo pipefail

echo "Installing server dependencies..."
sudo apt update
sudo apt install -y git docker.io docker-compose-plugin curl

echo "Starting Docker..."
sudo systemctl enable --now docker

if id -nG "$USER" | grep -qw docker; then
  echo "User already belongs to the docker group."
else
  sudo usermod -aG docker "$USER"
  echo "Added $USER to the docker group."
  echo "Log out and back in later to use docker without sudo."
fi

echo ""
echo "Bootstrap complete."
echo "Next: create .env, then run: bash scripts/deploy-ubuntu.sh"
