# Deployment Guide

This is the first deployment path:

```text
GitHub repository -> Ubuntu VPS -> Docker Compose -> Nginx container -> FastAPI backend
```

For a beginner-friendly checklist, see
[VPS_DEPLOYMENT_STEP_BY_STEP.md](VPS_DEPLOYMENT_STEP_BY_STEP.md).

## 1. Prepare The Server

On a new Ubuntu server:

```bash
sudo apt update
sudo apt install -y git
```

## 2. Clone The Repository

```bash
git clone https://github.com/taehwa222-ai/Jay-AI-Platform.git
cd Jay-AI-Platform
bash scripts/bootstrap-ubuntu.sh
```

## 3. Create The Environment File

```bash
bash scripts/configure-ubuntu-env.sh
```

The script writes `.env` and asks for:

```text
CORS_ORIGINS=http://YOUR_SERVER_IP
```

## 4. Start The App

```bash
docker compose up -d --build
```

Or use the included deploy script:

```bash
bash scripts/deploy-ubuntu.sh
```

Check status:

```bash
docker compose ps
docker compose logs -f backend
```

## 5. Test

Open:

```text
http://YOUR_SERVER_IP
```

API docs:

```text
http://YOUR_SERVER_IP/docs
```

Health check:

```bash
curl http://YOUR_SERVER_IP/api/v1/health
```

Platform overview:

```bash
curl http://YOUR_SERVER_IP/api/v1/platform/overview
```

## 6. Update After New Code

```bash
git pull
docker compose up -d --build
```

Or:

```bash
bash scripts/deploy-ubuntu.sh
```

## 7. Deploy From Local PC

From your Windows project folder:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\deploy-vps.ps1 -ServerHost YOUR_SERVER_IP
```

This runs checks, pushes to GitHub, SSHes into the VPS, pulls the latest code,
rebuilds containers, and checks `/api/v1/health`.

## 8. Auto Deploy From GitHub

The workflow `.github/workflows/deploy-vps.yml` can deploy automatically after
every push to `main`. Add these GitHub Actions values:

```text
Variable:
AUTO_DEPLOY_ENABLED=true

Secrets:
VPS_HOST=YOUR_SERVER_IP
VPS_USER=ubuntu
VPS_DEPLOY_PATH=/home/ubuntu/Jay-AI-Platform
VPS_SSH_KEY=your private deploy key
```

You can also run the workflow manually from the GitHub Actions tab.

## 9. HTTPS Later

For the first version, plain HTTP is enough to verify the system. After that,
point a domain to the server and add HTTPS through Caddy, Nginx, or a cloud
proxy.
