# Apple container Deployment

InfoQ-Scaffold-AI can run a local backend stack with Apple's `container` CLI.
This path starts MySQL, Redis, and `infoq-admin` without Docker Desktop or a
Docker-compatible daemon.

## Support Level

Apple `container` support is intended for local development and
operator-managed verification on a Mac. Docker Compose remains the recommended
full-stack production path.

Apple `container` 1.1 does not provide restart policies, automatic startup,
workload health scheduling, a Docker API socket, or full Compose orchestration.
`apple-container.sh` supplies ordered startup and readiness checks when you
invoke it.

This path is backend-only: it starts MySQL, Redis, and `infoq-admin`, and does not build or serve the Vue/React admins or an Nginx gateway. Use the Docker Compose path for a full frontend stack.

This stack is isolated from other Apple container projects. Default names use
the `infoq-apple` prefix and network `192.168.66.0/24`. The script refuses to
manage any resource that is not labeled
`org.infoq.stack=apple-container`.

## Requirements

- A Mac with Apple silicon
- macOS 26 or newer
- Apple `container` 1.1.0 or newer
- Host JDK 21 and Maven 3.9.x for image builds, or an existing `infoq-admin.jar`
- `openssl` for generating initial secrets
- Node.js 24.18.0 and Python 3 for the repository wrapper and shell helpers
- Local Network access for `container-runtime-linux` when macOS prompts during
  the first published-container startup

Install Apple `container` from its
[official releases](https://github.com/apple/container/releases), then verify
it:

```bash
container --version
```

## Quick Start

```bash
cd deploy

# Creates .env with random MySQL, Redis, and token secrets.
./apple-container.sh init

# Review optional settings before startup.
nano .env

# Packages the backend, builds the runtime image, waits for MySQL/Redis,
# and starts infoq-admin.
./apple-container.sh up

# Verifies MySQL, Redis, and the application readiness endpoint.
./apple-container.sh status
```

Open `http://127.0.0.1:19090/monitor/health/readiness`. The default host port
is `19090` so a local `8080` application, including another Apple container
stack, can keep running.

A cross-platform wrapper is available at the repository root:

```bash
node skills/deploy-cli/scripts/deploy_cli.mjs up
node skills/deploy-cli/scripts/deploy_cli.mjs status
```

`deploy/apple-container.sh` remains the execution truth; `deploy-cli` adds state
and smoke reporting.

The shell `up` builds only when the image is missing. The Node wrapper `up`
builds on every invocation unless `--no-build` is specified. To apply a new image
to existing containers, use `up --recreate`; building alone does not replace
containers. `status` may start the Apple system service when it is stopped;
use `container system status` and wrapper `smoke` for strictly read-only probes.

## Full-stack local development

This stack is backend-only. For frontend development, keep the Apple backend running and start both admin dev servers against it:

```bash
# Terminal 1: Vue admin
VITE_APP_PROXY_TARGET=http://127.0.0.1:19090 \
VITE_APP_PORT=5173 \
pnpm --dir frontend-vue run dev

# Terminal 2: React admin
VITE_APP_PROXY_TARGET=http://127.0.0.1:19090 \
VITE_APP_PORT=5174 \
pnpm --dir frontend-react run dev
```

Open `http://127.0.0.1:5173/login` or `http://127.0.0.1:5174/login`. This is a development setup, not a production-like full stack: it does not include the Nginx gateway or MinIO. Use Colima + Docker Compose when you need MinIO, OSS, gateway routing, or the complete stack.

`INFOQ_ENV_FILE` can select another protected env file; otherwise `deploy/.env`
is used. The Apple env file uses literal unquoted `KEY=value` syntax without spaces around `=`. Do not use Compose expressions
such as `${VALUE:-default}`. `APPLE_CONTAINER_BIND_HOST` must be an IPv4
address, and `APPLE_CONTAINER_HOST_PORT` must be between 1025 and 65535.
`APPLE_CONTAINER_DEPLOY_ROOT` defaults to `$HOME/infoq-apple` and must not reuse
`/infoq` or `$HOME/infoq`.

## Commands

Start dependencies and the application. Persistent MySQL and Redis volumes are
kept unless you destroy them:

```bash
./apple-container.sh up
```

Replace MySQL, Redis, and application containers while preserving volumes:

```bash
./apple-container.sh up --recreate
```

Build or rebuild only the runtime image:

```bash
./apple-container.sh build
./apple-container.sh build --from-existing-jar
```

Stop containers while preserving all resources and data:

```bash
./apple-container.sh down
```

Restart the stack in dependency order:

```bash
./apple-container.sh restart
```

Show workload state and run the host readiness probe:

```bash
./apple-container.sh status
```

Follow one service's logs:

```bash
./apple-container.sh logs admin -f
./apple-container.sh logs mysql -f
./apple-container.sh logs redis -f
```

Pull MySQL, Redis, and the Liberica JDK 21 runtime base image:

```bash
./apple-container.sh pull
```

Delete owned containers and the network while preserving volumes:

```bash
./apple-container.sh destroy --yes
```

Permanently delete the stack and named-volume data:

```bash
./apple-container.sh destroy --volumes --yes
```

`destroy` never deletes resources owned by other projects, `.env`, host bind
directories, or pulled images. It deletes this stack's network.

After a host reboot or `container system stop`, run `./apple-container.sh up`
again. Apple `container` does not automatically restart persisted containers.

## Images

The default Apple path does not run Maven inside `container build`. The official
backend Dockerfile uses BuildKit cache mounts and remains the Docker Compose
builder. Apple builds:

1. Package `infoq-admin.jar` on the host with JDK 21
2. Copy the jar into `tmp/deploy-cli/apple-build/app.jar`
3. Build `localhost/infoq-admin:3.0.0-apple` from `deploy/Dockerfile.apple`

Runtime base image: `bellsoft/liberica-openjdk-rocky:21.0.12-cds`.
MySQL: `mysql:8.0.42`. Redis: `redis:7.2.8`.

## Verify

```bash
./apple-container.sh status
curl --noproxy '*' -fsS http://127.0.0.1:19090/monitor/health/readiness
```

Readiness requires MySQL and Redis only. MinIO, Nginx, and the Vue/React
gateways stay on the Docker Compose path.

Empty MySQL volumes receive the baseline and SQL updates during first startup;
existing volumes do not automatically apply later migrations. Custom credential values are encoded as YAML strings and SQL literals, including quotes and backslashes; the env file itself remains literal unquoted `KEY=value`. Before an upgrade,
back up the database and apply the applicable updates under
[`docs/DATA-OPS.md`](../docs/DATA-OPS.md). This path does not rotate the baseline
administrator account or configure MinIO. It rewrites the generated backend
configuration at each `up`; retain any required operator configuration separately.

See [`README.md`](README.md) for installer options and
[`DOCKER.md`](DOCKER.md) for Compose.
