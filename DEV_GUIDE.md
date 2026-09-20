# Developer Guide

This guide covers local setup, common commands, and troubleshooting. Mandatory
repository rules are in [`AGENTS.md`](AGENTS.md). Command selection and review
flow are in [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Toolchain

Use the versions declared by the repository. Do not copy tool versions into
extra policy documents.

- JDK 21 and Maven 3.9.x: `infoq-scaffold-backend/pom.xml`
- Node.js `24.18.0`: `.node-version` and `.nvmrc`
- pnpm: frontend workspace `packageManager`

## Local Services

Development requires MySQL 8 and Redis 7. You can use local services or Compose:

```bash
cp deploy/.env.example script/docker/.env
cd script/docker
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
node .codex/scripts/backend_mvn.mjs -- clean install -DskipTests

pnpm --dir infoq-scaffold-frontend-vue install
pnpm --dir infoq-scaffold-frontend-react install
```

The root Makefile also provides:

```bash
make build
make test-docs
```

## Run in Development

Backend:

```bash
java -jar infoq-scaffold-backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=local
```

`dev` is the default Spring profile in config. Use `local` for machine-specific
datasource and Redis overrides.

Vue admin:

```bash
pnpm --dir infoq-scaffold-frontend-vue run dev
```

React admin:

```bash
pnpm --dir infoq-scaffold-frontend-react run dev
```

Both admin apps default to port `80` and proxy `/dev-api` to
`http://localhost:8080`. Override with `VITE_APP_PORT` and
`VITE_APP_PROXY_TARGET`. `VITE_APP_ENCRYPT`, RSA keys, and backend decrypt
settings must match, and `clientId` must match initialized `sys_client` data.

Skill-managed local stack:

```bash
node .codex/skills/infoq-frontend-verify/scripts/start_admin_dev_stack.mjs --client vue
node .codex/skills/infoq-frontend-verify/scripts/start_admin_dev_stack.mjs --client react
```

## Verification

Backend:

```bash
node .codex/scripts/backend_mvn.mjs -- test
node .codex/scripts/backend_mvn.mjs -- -pl infoq-modules/infoq-system -am test
```

Vue:

```bash
pnpm --dir infoq-scaffold-frontend-vue run lint:eslint
pnpm --dir infoq-scaffold-frontend-vue run test:unit
pnpm --dir infoq-scaffold-frontend-vue run build:prod
```

React:

```bash
pnpm --dir infoq-scaffold-frontend-react run lint
pnpm --dir infoq-scaffold-frontend-react run test
pnpm --dir infoq-scaffold-frontend-react run build:prod
```

Encoding and README sync:

```bash
node .codex/scripts/validate_utf8.mjs
node tools/check_readme_sync.mjs
```

GitHub `CI Build` runs the encoding gate, backend package, and admin frontend
checks on pull requests and pushes. Deployment scripts are verified with
`infoq-deploy-verify`.

## Common Problems

### Frozen lockfile failure

If a frontend `package.json` changes, run `pnpm install` in that workspace and
commit the resulting `pnpm-lock.yaml`. Do not use npm or yarn.

### Maven runner cannot find JDK or Maven

`node .codex/scripts/backend_mvn.mjs` prefers `.idea` Maven settings, then local
candidates. It requires JDK 21 and Maven 3.9.x.

### UTF-8 encoding

Repository text files must be UTF-8 without BOM:

```bash
node .codex/scripts/validate_utf8.mjs
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
├── infoq-scaffold-backend/       Spring Boot backend
├── infoq-scaffold-frontend-vue/  Vue 3 admin
├── infoq-scaffold-frontend-react/ React 19 admin
├── script/                       Compose files and deploy helpers
├── deploy/                       Installer and deployment guides
├── sql/                          Frozen baseline and incremental scripts
├── doc/                          User documentation
├── openspec/                     Specs and active changes
├── tools/                        Repository validation scripts
└── .codex/                       Skills, MCP config, and helper scripts
```

## Related Documents

- [Contributing](CONTRIBUTING.md)
- [Documentation index](doc/README.md)
- [Deployment guide](deploy/README.md)
- [Apple container](deploy/APPLE_CONTAINER.md)
- [AGENTS.md](AGENTS.md)
- [FAQ](doc/guide/faq.md)
