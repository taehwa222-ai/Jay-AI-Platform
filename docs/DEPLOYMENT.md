# Deployment Guide

This is the recommended first deployment path:

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
cp .env.production.example .env
nano .env
```

Fill these values:

```text
OPENAI_API_KEY=
OPENAI_MODEL=
CORS_ORIGINS=http://YOUR_DOMAIN
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

## 6. Update After New Code

```bash
git pull
docker compose up -d --build
```

Or:

```bash
bash scripts/deploy-ubuntu.sh
```

## 7. HTTPS Later

For the first version, plain HTTP is enough to verify the system. After that,
put a reverse proxy such as Caddy or host Nginx in front of this app and issue
Let's Encrypt certificates for your domain.
