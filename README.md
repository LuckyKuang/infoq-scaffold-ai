<div align="center">

<img src="assets/logo.png" width="120" alt="InfoQ-Scaffold-AI Logo" />

# InfoQ-Scaffold-AI

[![CI](https://github.com/LuckyKuang/infoq-scaffold-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/LuckyKuang/infoq-scaffold-ai/actions/workflows/ci.yml)
![Version](https://img.shields.io/badge/Version-3.0.0-f66a39)
![JDK](https://img.shields.io/badge/JDK-21-1677FF)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.1.1-6DB33F)
![Vue](https://img.shields.io/badge/Vue-3.5.35-42B883)
![React](https://img.shields.io/badge/React-19.2.7-61DAFB)
[![License](https://img.shields.io/badge/License-MIT-F7C948)](LICENSE)

**AI-collaboration full-stack engineering scaffold**

English | [中文](README_CN.md)

Community: [Linux DO](https://linux.do)

</div>

<!-- readme-section:notice -->
## Important Notice

This project is for technical learning, research, and testing. Validate it in a
non-production environment first, and follow the MIT license when you use,
modify, or distribute it. Users are responsible for risk, data loss, and
service interruption.

<!-- readme-section:overview -->
## Overview

`infoq-scaffold-ai` keeps AI collaboration rules, executable skills, OpenSpec,
application code, verification, and delivery evidence in one repository. It
ships a runnable Spring Boot backend plus Vue and React admin consoles.

Supported workspaces:

- `backend`: Spring Boot 4.1 multi-module backend
- `frontend-vue`: Vue 3 + Element Plus admin
- `frontend-react`: React 19 + Ant Design admin

The frozen database baseline is
[`sql/infoq_scaffold_3.0.0.sql`](sql/infoq_scaffold_3.0.0.sql). Later schema or
seed changes must use `sql/infoq_scaffold_update_YYYYMMDD.sql`.

<!-- readme-section:features -->
## Features

- Spring Boot 4.1 backend on JDK 21, MyBatis-Plus, and Spring Security
- Dual admin consoles that share the same backend API contract
- Layered [`AGENTS.md`](AGENTS.md), `skills`, and OpenSpec delivery
- Frozen SQL baseline plus dated incremental scripts
- Docker Compose deployment for MySQL, Redis, MinIO, backend, and admin gateways
- Cross-platform `deploy-cli` for Apple container, WSL2 Docker, and Linux Docker smoke checks
- UTF-8, Maven, pnpm, and admin E2E verification entrypoints

<!-- readme-section:quick-start -->
## Quick Start

Import the SQL baseline and start MySQL 8 plus Redis 7 before login.

### Backend

```bash
node tools/backend_mvn.mjs -- clean install -DskipTests
java -jar backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=local
```

Default URL: `http://127.0.0.1:8080`. Captcha: `http://127.0.0.1:8080/auth/code`.

### Vue admin

```bash
cd frontend-vue
pnpm install
pnpm run dev
```

### React admin

```bash
cd frontend-react
pnpm install
pnpm run dev
```

Both admin apps default to port `80`. Set `VITE_APP_PORT` before starting a
second console. Local setup details are in [`DEV_GUIDE.md`](DEV_GUIDE.md).

Use skills for admin route smoke or captcha login:

```bash
# Captcha-based E2E seeds the answer into the backend Redis.
# Set INFOQ_TEST_REDIS_HOST/PORT/DATABASE/PASSWORD (and optional TLS) first.
node skills/test-cli/scripts/run_admin_e2e.mjs --client vue --route-limit 1
node skills/test-cli/scripts/captcha_login.mjs --backend-url http://127.0.0.1:8080 --print-token

# Local deployment smoke (Apple container / WSL2 Docker / Linux Docker)
node skills/deploy-cli/scripts/deploy_cli.mjs status
```

<!-- readme-section:deployment -->
## Deployment Options

| Method | Documentation |
| --- | --- |
| Linux install script | [Deployment guide](deploy/README.md) |
| Docker Compose | [Docker guide](deploy/DOCKER.md) |
| Apple container | [Apple container](deploy/APPLE_CONTAINER.md) |
| Deployment lifecycle | [Deployment lifecycle](deploy/DEPLOYMENT_LIFECYCLE.md) |
| Compose environment template | [.env.example](deploy/.env.example) |
| Manual deployment | [Manual deploy](deploy/MANUAL.md) |
| Prerequisites | [Deploy prerequisites](deploy/README.md) |

```bash
bash deploy/install.sh
```

Nginx routes for the `all` target: `/vue/`, `/react/`, `/console-oss/`, `/oss/`.

<!-- readme-section:documentation -->
## Documentation

README files provide the overview and quick start. Use the documents below for
detailed configuration and maintenance.

| Document | Description |
| --- | --- |
| [Documentation index](docs/README.md) | User-doc navigation |
| [Contributing](CONTRIBUTING.md) | Toolchain, checks, and PR flow |
| [Developer guide](DEV_GUIDE.md) | Local setup and troubleshooting |
| [Security policy](SECURITY.md) | Vulnerability reporting |
| [AGENTS.md](AGENTS.md) | Repository collaboration rules |
| [Design system](docs/DESIGN.md) | Admin visual language |
| [Release process](docs/RELEASING.md) | Version, tag, release workflow, and rollback |
| [CI validation](docs/CI_VALIDATION.md) | Workflow coverage, local gates, and security scans |

<!-- readme-section:license -->
## License

[MIT License](LICENSE)
