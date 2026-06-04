#!/usr/bin/env bash
set -euo pipefail

echo "Installing server dependencies..."
sudo apt update
sudo apt install -y ca-certificates curl gnupg git

echo "Adding Docker apt repository..."
sudo install -m 0755 -d /etc/apt/keyrings
sudo rm -f /etc/apt/keyrings/docker.asc
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

UBUNTU_CODENAME="$(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")"
ARCH="$(dpkg --print-architecture)"
echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${UBUNTU_CODENAME} stable" |
  sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

echo "Installing Docker Engine..."
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

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
sudo docker --version
sudo docker compose version
echo "Next: run: bash scripts/configure-ubuntu-env.sh"
