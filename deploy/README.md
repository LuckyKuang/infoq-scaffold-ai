# Deployment Guide

This directory is the operator entry for installation and Compose environment
templates. Compose files and runtime config still live under `script/docker/`.

## Deployment Methods

| Method | Best for | Documentation |
| --- | --- | --- |
| Linux install script | Server install, generated secrets | this file |
| Docker Compose | Local or self-hosted full stack | [DOCKER.md](DOCKER.md) |
| Apple container | macOS local backend stack | [APPLE_CONTAINER.md](APPLE_CONTAINER.md) |
| Manual JVM + Nginx | Non-container hosts | [Manual deploy](../doc/devops/manual-deploy.md) |

## Files

| File | Description |
| --- | --- |
| `install.sh` | One-click Linux installer |
| `uninstall.sh` | Uninstall helper |
| `DOCKER.md` | Compose deployment notes |
| `APPLE_CONTAINER.md` | Apple `container` local stack |
| `apple-container.sh` | Isolated MySQL, Redis, and backend helper |
| `.env.example` | Environment template for Compose interpolation |
| `../script/docker/docker-compose.yml` | Full-stack Compose file |
| `../script/bin/deploy-frontend.sh` | Frontend / gateway deploy helper |
| `../script/bin/infoq.sh` | Backend and middleware helper |

## Linux Installer

```bash
bash deploy/install.sh
```

The installer expects Docker, Docker Compose, and Buildx. It writes random
secrets to `/etc/infoq-scaffold-ai/deploy.env` by default and deploys into
`/opt/infoq-scaffold-ai`. Do not reuse `.env.example` placeholders in a shared
environment.

Uninstall:

```bash
bash deploy/uninstall.sh
```

## Docker Compose

Copy the environment template, then edit secrets:

```bash
cp deploy/.env.example script/docker/.env
chmod 600 script/docker/.env
```

Deploy all admin consoles plus the Nginx gateway:

```bash
bash script/bin/deploy-frontend.sh deploy all
```

Target a single console:

```bash
bash script/bin/deploy-frontend.sh deploy vue
bash script/bin/deploy-frontend.sh deploy react
```

Stop:

```bash
bash script/bin/deploy-frontend.sh stop all
```

On macOS Colima set `INFOQ_DEPLOY_ROOT="$HOME/infoq"` before starting.

## Apple Container

For a local Apple `container` backend stack that stays isolated from other
Apple container projects:

```bash
bash deploy/apple-container.sh init
bash deploy/apple-container.sh up
curl --noproxy '*' -fsS http://127.0.0.1:19090/monitor/health/readiness
```

See [APPLE_CONTAINER.md](APPLE_CONTAINER.md). Do not reuse `$HOME/infoq` or
stop unrelated containers such as `sub2api-apple*`.

## Gateway Routes

The `all` target exposes:

- `/vue/` Vue admin
- `/react/` React admin
- `/prod-api/` backend API
- `/console-oss/` MinIO console
- `/oss/` OSS file access

A single-target deploy mounts that admin at `/`.

## Verification

Use the `infoq-deploy-verify` skill for a full Compose smoke. A minimal check:

```bash
cd script/docker
docker compose ps
curl -fsS http://127.0.0.1:9090/monitor/health/readiness
curl -fsS http://127.0.0.1/prod-api/monitor/health/readiness
```

Local `java -jar` with the `local` profile still uses `http://127.0.0.1:8080`.

## Troubleshooting

Container logs:

```bash
cd script/docker
docker compose logs infoq-admin
docker compose logs mysql
docker compose logs redis
```

## Detailed Documents

| Document | Description |
| --- | --- |
| [Deploy prerequisites](../doc/devops/deploy-prerequisites.md) | Environment and dependency checks |
| [Docker Compose tutorial](../doc/devops/docker-compose-tutorial.md) | WSL2 / macOS / Linux container setup |
| [Docker Compose deploy](../doc/devops/docker-compose-deploy.md) | Scripted deploy flow |
| [Manual deploy](../doc/devops/manual-deploy.md) | Non-container deploy |
| [Security policy](../SECURITY.md) | Vulnerability reporting |
