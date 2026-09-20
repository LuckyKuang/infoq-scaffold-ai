# Docker Compose

Docker Compose is the recommended way to run the full InfoQ-Scaffold-AI stack:
MySQL, Redis, MinIO, the Spring Boot backend, and the Vue / React admin
gateways.

Application Compose files live in [`script/docker/`](../script/docker/). The
environment template lives in [`.env.example`](.env.example). The long tutorial
is [`doc/devops/docker-compose-tutorial.md`](../doc/devops/docker-compose-tutorial.md).

## Prepare

```bash
cp deploy/.env.example script/docker/.env
chmod 600 script/docker/.env
```

Replace every `change-me-*` value before exposing the stack. Compose reads
`script/docker/.env` for `${VAR}` interpolation. `deploy/install.sh` writes a
different file, `/etc/infoq-scaffold-ai/deploy.env`, with random secrets.

On macOS Colima:

```bash
export INFOQ_DEPLOY_ROOT="$HOME/infoq"
```

## Start

Preferred operator path:

```bash
bash deploy/install.sh
```

Segmented helper path:

```bash
bash script/bin/infoq.sh deploy
bash script/bin/deploy-frontend.sh deploy all
```

`infoq.sh` waits for MySQL and Redis, then loads
`sql/infoq_scaffold_3.0.0.sql` and current `sql/infoq_scaffold_update_*.sql`
scripts when required tables are missing.

## Routes

| Path | Service |
| --- | --- |
| `/vue/` | Vue admin |
| `/react/` | React admin |
| `/prod-api/` | Backend API via Nginx |
| `/console-oss/` | MinIO console |
| `/oss/` | OSS objects |

Direct backend port in Compose is `9090`.

## Verify

```bash
cd script/docker
docker compose ps
curl -fsS http://127.0.0.1:9090/monitor/health/readiness
curl -fsS http://127.0.0.1/prod-api/monitor/health/readiness
```

## Logs and Stop

```bash
cd script/docker
docker compose logs infoq-admin
bash script/bin/deploy-frontend.sh stop all
```

See [`README.md`](README.md) for installer options,
[`APPLE_CONTAINER.md`](APPLE_CONTAINER.md) for the macOS Apple `container`
backend stack, and
[`doc/devops/docker-compose-deploy.md`](../doc/devops/docker-compose-deploy.md)
for the complete scripted flow.
