# VPS Deployment Step By Step

This is the path for running the app away from your local PC.

```text
Local PC -> git push -> GitHub -> Ubuntu VPS -> Docker Compose -> public IP/domain
```

After this deployment, your PC does not need to stay on for the service to run.

## 1. Create A VPS

Choose an Ubuntu server from a provider such as AWS Lightsail, Oracle Cloud,
Vultr, DigitalOcean, or another VPS provider.

Recommended first server:

- Ubuntu 22.04 or 24.04
- 1-2 vCPU
- 1-2 GB RAM
- Open inbound ports `22` and `80`

Keep the server IP address. The examples below use `YOUR_SERVER_IP`.

## 2. Connect To The Server

From PowerShell on your PC:

```powershell
ssh ubuntu@YOUR_SERVER_IP
```

Some providers use `root` instead of `ubuntu`:

```powershell
ssh root@YOUR_SERVER_IP
```

## 3. Clone The Project

On the server:

```bash
sudo apt update
sudo apt install -y git
git clone https://github.com/taehwa222-ai/Jay-AI-Platform.git
cd Jay-AI-Platform
```

If the repository is private, add a GitHub deploy key first and clone with SSH:

```bash
git clone git@github.com:taehwa222-ai/Jay-AI-Platform.git
cd Jay-AI-Platform
```

## 4. Prepare Docker

Run the bootstrap script once:

```bash
bash scripts/bootstrap-ubuntu.sh
```

If Docker group permissions do not apply immediately, either reconnect to SSH
or keep using the deploy script as-is. It falls back to `sudo docker`.

## 5. Create Server Environment

Create the production environment file:

```bash
bash scripts/configure-ubuntu-env.sh
```

The script asks for:

```text
CORS_ORIGINS
```

Do not put real service keys in GitHub, screenshots, chat messages, or commit
history. `.env` is ignored by Git.

## 6. Start The Server

```bash
bash scripts/deploy-ubuntu.sh
```

Open in your browser:

```text
http://YOUR_SERVER_IP
```

API docs:

```text
http://YOUR_SERVER_IP/docs
```

## 7. Update Later

When you change code locally:

```powershell
git add -A
git commit -m "Your change"
git push origin main
```

Then SSH into the server:

```bash
cd Jay-AI-Platform
bash scripts/deploy-ubuntu.sh
```

Or deploy from your local PC in one command:

```powershell
powershell.exe -ExecutionPolicy Bypass -File scripts\deploy-vps.ps1 -ServerHost YOUR_SERVER_IP
```

For full push-to-deploy automation, add the GitHub Actions values below:

```text
Variable:
AUTO_DEPLOY_ENABLED=true

Secrets:
VPS_HOST=YOUR_SERVER_IP
VPS_USER=ubuntu
VPS_DEPLOY_PATH=/home/ubuntu/Jay-AI-Platform
VPS_SSH_KEY=your private deploy key
```

## 8. Domain And HTTPS Later

For the first version, public HTTP is enough to verify deployment. Later, point
a domain to the server IP and add HTTPS with Caddy, Nginx, or a cloud proxy.
