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

외부 연동을 사용할 때는 `.env.production.example`을 기준으로 `OPENAI_API_KEY`,
`OPENDART_API_KEY`, `AI_DAILY_LIMIT`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`를 추가합니다.
실제 키는 저장소에 커밋하지 않습니다.

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

Compose는 `./data`를 `/app/data`에, Content Ops 저장용 `./content`를 쓰기 가능한
`/app/content`에 마운트합니다. 두 호스트 디렉터리를 재배포 중 삭제하지 마세요. `backup`
서비스가 배포 직후와 이후 24시간마다 DB 무결성 검사·복원 리허설·30일 보관 백업을 수행합니다.
배포 스크립트는 첫 복원 리허설의 성공 로그를 확인한 뒤에만 API/프론트 스모크 테스트로
진행합니다.

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

Public smoke check:

```bash
python3 scripts/smoke-platform.py --base-url http://YOUR_SERVER_IP --frontend-url http://YOUR_SERVER_IP
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

If your SSH key is a local file:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\deploy-vps.ps1 `
  -ServerHost YOUR_SERVER_IP `
  -IdentityFile C:\path\to\your-key.pem
```

This runs checks, pushes to GitHub, SSHes into the VPS, pulls the latest code,
rebuilds containers, and runs public API/frontend smoke checks.

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
