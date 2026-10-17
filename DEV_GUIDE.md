# Developer Guide

This guide covers local setup, common commands, and troubleshooting. Mandatory
repository rules are in [`AGENTS.md`](AGENTS.md). Command selection and review
flow are in [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Toolchain

Use the versions declared by the repository. Do not copy tool versions into
extra policy documents.

- JDK 21 and Maven 3.9.x: `backend/pom.xml`
- Node.js `24.18.0`: `.node-version` and `.nvmrc`
- pnpm `10.34.1`: root `package.json` `packageManager`, mirrored by each workspace

## Local Services

Development requires MySQL 8 and Redis 7. You can use local services or Compose:

```bash
cp deploy/.env.example deploy/docker/.env
cd deploy/docker
docker compose up -d mysql redis
```

Keep local credentials in ignored `.env` or profile files. Do not add developer
machine paths, passwords, or production data to tracked documentation.

Import the frozen baseline before the first login:

```bash
mysql -u root -p infoq < sql/infoq_scaffold_3.0.0.sql
```

Create the database first if it does not exist. Fresh-environment login data
comes from that SQL file; do not guess passwords for an existing environment.

## Install and Build

```bash
node tools/backend_mvn.mjs -- clean install -DskipTests

pnpm --dir frontend-vue install
pnpm --dir frontend-react install
```

The root Makefile also provides:

```bash
make build
make test-docs
```

## Run in Development

Backend:

```bash
java -jar backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=local
```

`dev` is the default Spring profile in config. Use `local` for machine-specific
datasource and Redis overrides.

Vue admin:

```bash
pnpm --dir frontend-vue run dev
```

React admin:

```bash
pnpm --dir frontend-react run dev
```

Both admin apps default to port `80` and proxy `/dev-api` to
`http://localhost:8080`. Override with `VITE_APP_PORT` and
`VITE_APP_PROXY_TARGET`. `VITE_APP_ENCRYPT`, RSA keys, and backend decrypt
settings must match, and `clientId` must match initialized `sys_client` data.

Admin E2E scripts manage their own local stack (start, verify, then close owned ports):

```bash
node skills/test-cli/scripts/run_admin_e2e.mjs --client vue --route-limit 1
node skills/test-cli/scripts/run_admin_e2e.mjs --client react --route-limit 1
```

## Verification

Backend:

```bash
node tools/backend_mvn.mjs -- test
node tools/backend_mvn.mjs -- -pl infoq-modules/infoq-system -am test
```

Vue:

```bash
pnpm --dir frontend-vue run lint:eslint
pnpm --dir frontend-vue run test:unit
pnpm --dir frontend-vue run build:prod
```

React:

```bash
pnpm --dir frontend-react run lint
pnpm --dir frontend-react run test
pnpm --dir frontend-react run build:prod
```

Encoding and README sync:

```bash
node tools/validate_utf8.mjs
node tools/check_readme_sync.mjs
```

GitHub `CI Build` runs the repository gates (UTF-8, README structure, release
version), backend package, and admin frontend checks on pull requests and
pushes. Security Scan adds CodeQL and dependency review. Deployment runtime
verification uses `deploy-cli`; Docker-specific steps are in
`deploy/VERIFICATION.md`.

## Common Problems

### Frozen lockfile failure

If a frontend `package.json` changes, run `pnpm install` in that workspace and
commit the resulting `pnpm-lock.yaml`. Do not use npm or yarn.

### Maven runner cannot find JDK or Maven

`node tools/backend_mvn.mjs` prefers `.idea` Maven settings, then local
candidates. It requires JDK 21 and Maven 3.9.x.

### UTF-8 encoding

Repository text files must be UTF-8 without BOM:

```bash
node tools/validate_utf8.mjs
```

On Windows PowerShell 5.1, `Get-Content` / `Select-String` must pass
`-Encoding UTF8`. Do not use `>`, `>>`, `Out-File`, or `Set-Content` to write
repository text files.

### Database migration failure

Do not edit an applied baseline or incremental script to repair it. Restore the
released content and add a compensating `sql/infoq_scaffold_update_YYYYMMDD.sql`.
See [`AGENTS.md`](AGENTS.md).

### Redis connection failure

Check `application-local.yml` or `application-dev.yml`:

```yaml
spring:
  data:
    redis:
      host: 127.0.0.1
      port: 6379
```

Start Redis before the backend.

### Frontend cannot reach the backend

Confirm the backend is on `http://127.0.0.1:8080` and `/auth/code` responds.
Proxy config lives in each admin `vite.config.ts`.

## Repository Layout

```text
infoq-scaffold-ai/
├── backend/       Spring Boot backend
├── frontend-vue/  Vue 3 admin
├── frontend-react/ React 19 admin
├── deploy/                       Installer, Compose assets, and deployment guides
├── sql/                          Frozen baseline and incremental scripts
├── docs/                         User documentation and spec truth
├── openspec/                     Change templates and local change plans
├── skills/                       Agent Skills SOP library (all agents)
├── tools/                        Repository validation and MCP helper scripts
└── .codex/                       Codex-specific config and custom agents
```

## Related Documents

- [Contributing](CONTRIBUTING.md)
- [Documentation index](docs/README.md)
- [Deployment guide](deploy/README.md)
- [Apple container](deploy/APPLE_CONTAINER.md)
- [Deployment lifecycle](deploy/DEPLOYMENT_LIFECYCLE.md)
- [Release process](docs/RELEASING.md)
- [CI validation](docs/CI_VALIDATION.md)
- [AGENTS.md](AGENTS.md)
- [FAQ](docs/FAQ.md)
