# Deployment Guide

This directory is the operator entry for installation, environment templates, and
deployment guides. Compose files and runtime config still live under
`deploy/docker/`.

本目录是运维入口：安装脚本、环境模板与部署文档都在这里。Compose 文件与运行
配置仍在 `deploy/docker/`。

## Deployment Methods

| Method | Best for | Documentation |
| --- | --- | --- |
| Linux install script | Server install, generated secrets | this file |
| Docker Compose | Local or self-hosted full stack | [DOCKER.md](DOCKER.md) |
| Colima + Docker | macOS full stack and isolated acceptance | [COLIMA.md](COLIMA.md) |
| Apple container | macOS local backend stack | [APPLE_CONTAINER.md](APPLE_CONTAINER.md) |
| Manual JVM + Nginx | Non-container hosts | [MANUAL.md](MANUAL.md) |

## 按平台选择

| 平台 | 目标 | 推荐方式 | 入口 |
| --- | --- | --- | --- |
| Linux | 完整栈 | Docker Engine + Compose | `deploy/install.sh` |
| Windows | 完整栈 | WSL2 Debian/Ubuntu + Docker CE | 在 WSL2 内执行 `deploy/install.sh` |
| macOS | 完整栈 / 兼容验证 | Colima + Docker | [COLIMA.md](COLIMA.md) |
| macOS | 仅后端开发 | Apple container | `deploy-cli init/up` |
| macOS | 前后端联调 | Apple container + Vue/React dev server | `deploy-cli` + 两个 `pnpm run dev` |
| 任意 | 非容器部署 | JVM + Nginx | [MANUAL.md](MANUAL.md) |

“完整栈”指 MySQL、Redis、MinIO、后端、Vue/React 管理端和 Nginx 网关。Apple container 只启动 MySQL、Redis 和后端；前后端联调时前端以 dev server 连接 `http://127.0.0.1:19090`，该模式不包含 MinIO 与 Nginx，详见 [APPLE_CONTAINER.md](APPLE_CONTAINER.md#full-stack-local-development)。

生产首先按 [Linux 生产配置与迁移](PRODUCTION.md) 准备受控输入，完成 [目标环境验收](DEPLOYMENT_LIFECYCLE.md#9-当前生产准备阻塞)。脚本预检和本机安装成功不等于生产验收。

Install, upgrade, rollback, stop, and data-retention boundaries are documented in
[DEPLOYMENT_LIFECYCLE.md](DEPLOYMENT_LIFECYCLE.md). The cross-platform runtime entry is
`node skills/deploy-cli/scripts/deploy_cli.mjs`.

## Files

| File | Description |
| --- | --- |
| `install.sh` | One-click Linux installer |
| `uninstall.sh` | Uninstall helper |
| `.env.example` | Environment template for Compose interpolation |
| `DOCKER.md` | Docker Compose 全栈部署（教程 + 脚本化流程） |
| `APPLE_CONTAINER.md` | Apple `container` local stack |
| `DEPLOYMENT_LIFECYCLE.md` | Install, upgrade, rollback, stop, and cleanup |
| `MANUAL.md` | 非容器化 JVM + Nginx 部署 |
| `Dockerfile.apple` | Apple container runtime image |
| `apple-container.sh` | Isolated MySQL, Redis, and backend helper |
| `examples/nginx/` | HTTP / HTTPS Nginx 配置示例 |
| `examples/systemd/` | systemd 服务单元示例 |
| `../deploy/docker/docker-compose.yml` | Full-stack Compose file |
| `../deploy/bin/infoq.sh` | Backend and middleware helper |
| `../deploy/bin/deploy-frontend.sh` | Frontend / gateway deploy helper |

## 1. 前置条件

部署产物说明：仓库不发布预构建应用镜像。Docker 路径在 `infoq-admin` 镜像的 builder 阶段编译 jar，并在前端镜像中构建 `dist`；Apple container 路径先在宿主机打包 jar，再复制到仅包含 MySQL、Redis 和后端 API 的运行时镜像。Release 产物是 `infoq-admin.jar` 与管理端 `dist` 压缩包，不是容器镜像。

### 1.1 软件与版本基线

| 组件 | 基线 |
| --- | --- |
| Docker / Compose | Docker CE / Moby / Colima + `docker compose` 或 `docker-compose`，并启用 `docker buildx` |
| 后端构建镜像 | `maven:3.9.12-eclipse-temurin-21` |
| 后端运行镜像 | `bellsoft/liberica-openjdk-rocky:21.0.12-cds` |
| 手动部署 JDK | 21 |
| 手动部署 Maven | 3.9.x |
| Node.js | 24.18.0 |
| pnpm | 10.34.1（根 `package.json` 的 `packageManager`） |
| MySQL | 8.x |
| Redis | 7.x |
| Nginx | 1.30.x |
| MQTT（可选） | EMQX 社区版 5.8.9 |
| Elasticsearch（可选） | 8.18.8 |

说明：

- Docker Compose / 脚本化部署不要求宿主机安装 JDK 或 Maven；后端 Maven 打包在 Docker builder 镜像 `maven:3.9.12-eclipse-temurin-21` 内完成，最终运行镜像仍是 `bellsoft/liberica-openjdk-rocky:21.0.12-cds`。后端 Dockerfile 使用 BuildKit `RUN --mount`，因此 Docker CLI 必须支持 `docker buildx`：[`backend/infoq-admin/Dockerfile`](../backend/infoq-admin/Dockerfile)
- 手动部署或本机直接执行 Maven 构建时，仍需要宿主机 JDK 21 与 Maven 3.9.x。
- 前端本机开发、CI 和 Docker 构建镜像统一固定基于 Node 24.18.0：[`frontend-vue/Dockerfile`](../frontend-vue/Dockerfile) [`frontend-react/Dockerfile`](../frontend-react/Dockerfile)。npm 版本不作为仓库构建基线单独固定，包管理器遵循各工作区 `packageManager` 与 lockfile。
- Docker Compose 默认依赖 MySQL 8.0、Redis 7.2、MinIO `RELEASE.2026-06-18T00-00-00Z`、Nginx 1.30：[`deploy/docker/docker-compose.yml`](../deploy/docker/docker-compose.yml)

### 1.2 端口与网络准备

默认会占用以下端口。基础服务端口始终需要空闲；前端直连端口按 `INFOQ_FRONTEND_TARGET` 决定，`all` 才需要两个前端端口都空闲。

| 服务 | 默认端口 |
| --- | --- |
| nginx 网关 | 公网 80 重定向 HTTPS；443 TLS |
| 后端 `infoq-admin` | 127.0.0.1:9090 |
| Vue 前端直连 | 127.0.0.1:9091 |
| React 前端直连 | 127.0.0.1:9092 |
| MySQL | 127.0.0.1:3306 |
| Redis | 127.0.0.1:6379 |
| MinIO API | 127.0.0.1:9000 |
| MinIO Console | 127.0.0.1:9001 |
| MQTT TLS（可选） | single / cluster 均默认节点一 `127.0.0.1:8883` |
| Elasticsearch HTTPS（可选） | single / cluster 均默认节点一 `127.0.0.1:9200` |

前端目标与直连端口关系：

- `INFOQ_FRONTEND_TARGET=vue`：只需要 `9091`
- `INFOQ_FRONTEND_TARGET=react`：只需要 `9092`
- `INFOQ_FRONTEND_TARGET=all`：需要 `9091`、`9092`

生产对外入口走 HTTPS Nginx：MinIO Console 为主站 `/console-oss/`，S3 使用独立 `INFOQ_OSS_PUBLIC_ORIGIN` 根路径，不能使用 `/oss/` 前缀替换签名路径。

部署前至少确认：

- 基础服务端口和目标前端直连端口未被其他进程占用
- 服务器安全组、防火墙、反向代理策略允许目标端口访问
- 如需公网 HTTPS，证书和域名已准备完成
- 如启用可选 MQTT / Elasticsearch，已通过 `deploy-middleware.sh` 选择 `single` 或 `cluster`，并按 [DOCKER.md](DOCKER.md) 的可选中间件章节准备 `deploy.env` 变量；不得使用 `*-it` 测试材料
- 选择 Elasticsearch cluster 时，宿主机 `vm.max_map_count` 至少为 `262144`
- 生产安装须先提供受控 `/etc/infoq-scaffold-ai/deploy.env`；隔离 development 首次安装才生成随机配置。配置及 `credentials.txt` 都必须保留且权限为 `600`

Compose 辅助端口默认仅 loopback；公网入口为网关。生产受控渲染校验证书链内签名、有效期、两域名与私钥匹配，先预检再写入；prepare/start/redeploy 保留 HTTPS。具体 env 和旧状态迁移见 [PRODUCTION.md](PRODUCTION.md)。

### 1.3 目录与权限准备

WSL2 / 原生 Linux 部署根目录建议统一为 `/infoq`；macOS Colima 建议使用 `$HOME/infoq`。执行部署前，必须先确认以下目录存在：

```text
/tmp/infoq-deploy
${INFOQ_DEPLOY_ROOT}/server/temp
```

脚本约定的宿主机目录还包括：

```text
${INFOQ_DEPLOY_ROOT}/mysql/data
${INFOQ_DEPLOY_ROOT}/mysql/conf
${INFOQ_DEPLOY_ROOT}/redis/conf
${INFOQ_DEPLOY_ROOT}/redis/data
${INFOQ_DEPLOY_ROOT}/minio/data
${INFOQ_DEPLOY_ROOT}/server/config
${INFOQ_DEPLOY_ROOT}/server/logs
${INFOQ_DEPLOY_ROOT}/server/temp
${INFOQ_DEPLOY_ROOT}/server/ip2region
${INFOQ_DEPLOY_ROOT}/nginx/cert
${INFOQ_DEPLOY_ROOT}/nginx/conf
${INFOQ_DEPLOY_ROOT}/nginx/log
${INFOQ_DEPLOY_ROOT}/vue/logs        # INFOQ_FRONTEND_TARGET=vue 或 all
${INFOQ_DEPLOY_ROOT}/react/logs      # INFOQ_FRONTEND_TARGET=react 或 all
```

部署账号需要对这些目录具备读写权限，尤其是后端日志目录、临时文件目录、IPv6 地址库目录、Nginx 静态资源目录和日志目录。

后端与前端 helper 初始创建目录为 `0755`；pull/build 后、启动前核验不可变镜像实际 UID/GID，并仅对本轮新建 owned 空目录设置最小 owner/`0750`，实际写入读回后才启动。已有目录 owner/权限保留，详见 [PRODUCTION.md](PRODUCTION.md)；遇到 other-writable 目录、非规范绝对路径或符号链接时明确停止，不递归修改业务数据。旧版 `777` 目录须由管理员先核实实际镜像 UID/GID、收紧权限并验证挂载写入，再重试。不要对整个部署根目录递归 chmod/chown。后端外置配置为 `0600`，当前后端镜像以 root 读取；改用非 root 镜像时须先评审读取权限。Redis `redis.conf` 不包含密码，权限 `0644`、只读挂载；密码通过 Compose argv/env 注入，仍须限制 Docker socket 与 env 文件访问。

旧 Redis 配置仍含 `requirepass` 时，helper 会先核验已重建容器的归属、只读挂载及当前认证命令，不匹配或查询失败则保留旧配置并退出；升级步骤见 [DOCKER.md](DOCKER.md#71-首次部署后端)。不得先删认证配置再重启旧容器。

### 1.4 配置检查项

后端重点检查：数据库地址/账号/密码、Redis 地址/端口/密码、`spring.servlet.multipart.location`、`security.token.secret`（推荐通过 `SECURITY_TOKEN_SECRET` 提供）、`api-decrypt` 公私钥、`DEPLOY_ID`、IPv6 地址库外置路径、邮件/OSS 等插件配置。

主要配置来源：

- 默认生产配置：[`backend/infoq-admin/src/main/resources/application-prod.yml`](../backend/infoq-admin/src/main/resources/application-prod.yml)
- 通用配置：[`backend/infoq-admin/src/main/resources/application.yml`](../backend/infoq-admin/src/main/resources/application.yml)
- Compose 覆盖模板：[`deploy/docker/server/application-prod.yml`](../deploy/docker/server/application-prod.yml)

生产环境不要直接保留仓库内默认密钥、默认数据库密码和示例邮箱配置。生产 `prod` profile 开启 Quartz bootstrap guard 时，`DEPLOY_ID` 不能为空；同一批滚动发布的所有 backend 节点必须使用同一个 `DEPLOY_ID`，新批次发布必须换新值。

多节点部署前，至少逐项核对：所有节点 `SECURITY_TOKEN_SECRET` 完全一致；`api-decrypt.enabled` 与公私钥和前端加密配置匹配；所有节点连接同一组 MySQL、Redis/Redisson 与 OSS 配置，`redisson.keyPrefix` 不因节点隔离 token、缓存、Quartz marker、WebSocket/SSE 注册表；共享同一个 `DEPLOY_ID`。

前端重点检查：`VITE_APP_CONTEXT_PATH`、`VITE_APP_BASE_API`、`VITE_APP_ENCRYPT`、RSA 公私钥、`VITE_APP_CLIENT_ID`。配置入口为 `frontend-vue/.env.production` 与 `frontend-react/.env.production`。

生产必须从 `INFOQ_PRODUCTION_CONFIG_FILE` 提供与运行环境同源的独立凭据和两组至少 2048 位 RSA。BuildKit secret 注入前端构建，中央预检交叉核验；前端公钥对应后端请求私钥，前端私钥对应后端响应公钥。BuildKit secret 内容变化不会自动使缓存失效，因此前端部署入口每次自动计算浏览器构建输入的 `INFOQ_FRONTEND_CONFIG_DIGEST` 并在构建后复核，密钥轮换会重新生成浏览器包；无需手工维护摘要，直接 Docker 排障命令见 [DOCKER.md](DOCKER.md#11-直接使用-docker-compose-cli)。后端通过最后载入的 managed-security.yml 环境占位符使用受控值。浏览器协议私钥属于公开产物，公网必须 HTTPS。详见 [PRODUCTION.md](PRODUCTION.md)。

网关确认：`INFOQ_FRONTEND_TARGET=all` 时 `/vue/`、`/react/` 分别指向 Vue、React 静态资源；单目标时 `/` 指向被选中的前端；`/prod-api/` 反代到后端 `9090`；HTTPS 证书路径和域名配置正确。受控渲染真值见 [`deploy/bin/render-gateway.mjs`](bin/render-gateway.mjs)，运维示例见 `examples/nginx/` 与 `examples/systemd/`。

### 1.5 数据初始化准备

- 冻结初始化基线：[`sql/infoq_scaffold_3.0.0.sql`](../sql/infoq_scaffold_3.0.0.sql)
- 增量脚本：`sql/infoq_scaffold_update_*.sql`

部署前确认：目标数据库字符集支持 `utf8mb4`；目标库名是否使用 `infoq`；已有库是否允许导入；非首次部署是否有可用备份与回滚点；多节点滚动发布前数据库增量必须先完成。当前部署完成后应能查到 `sys_job`、`QRTZ_LOCKS`、`sys_oauth_provider`、`sys_oauth_identity`，且 `sys_client` 的 `e5cd7e4891bf95d1d19206ce24a7b32e` 客户端包含 `oauth` 授权类型。

### 1.6 构建产物准备

Compose / 脚本化部署不需要提前在宿主机准备 jar；`infoq-admin` 镜像会在 Docker builder 阶段执行 Maven prod 打包。手动部署时，构建后 jar 产物路径为 `backend/infoq-admin/target/infoq-admin.jar`。Vue 与 React 生产构建后产出各自工作区的 `dist/` 目录。

生产安装从已审阅 checkout 执行（所有生产输入在同一个 0600 受控文件，不向 shell 命令行传秘密）：

```bash
sudo env INFOQ_SOURCE_DIR="$(pwd)" INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env INFOQ_PRODUCTION_CONFIG_FILE=/etc/infoq-scaffold-ai/deploy.env bash deploy/install.sh
```

以下带 `INFOQ_DEPLOY_MODE=development` 的 HTTP 示例只用于明确隔离开发；不能用于生产结论。

## 2. Linux Installer

远程安装应固定已审核 tag，并在执行前审阅下载脚本（从仓库根目录运行，替换 `v3.0.0` 为实际目标 tag）：

```bash
mkdir -p tmp/install
curl -fSL https://raw.githubusercontent.com/LuckyKuang/infoq-scaffold-ai/v3.0.0/deploy/install.sh -o tmp/install/install.sh
# 审阅脚本并确认目标后执行
sudo env INFOQ_VERSION=v3.0.0 INFOQ_FRONTEND_TARGET=all INFOQ_DEPLOY_MODE=development INFOQ_PUBLIC_BASE_URL=http://SERVER_IP INFOQ_OSS_PUBLIC_ORIGIN=http://oss.localhost INFOQ_PRINT_SECRETS=0 bash tmp/install/install.sh
```

From a local checkout:

```bash
sudo env INFOQ_SOURCE_DIR="$(pwd)" INFOQ_FRONTEND_TARGET=all \
  INFOQ_DEPLOY_MODE=development INFOQ_PUBLIC_BASE_URL=http://SERVER_IP INFOQ_OSS_PUBLIC_ORIGIN=http://oss.localhost INFOQ_DEPLOY_ROOT=/infoq bash deploy/install.sh
```

`INFOQ_FRONTEND_TARGET` is required (`all`, `vue`, or `react`). The installer
expects Docker, Docker Compose, and Buildx. It writes random secrets to
`/etc/infoq-scaffold-ai/deploy.env` by default and deploys into
`/opt/infoq-scaffold-ai`. Do not reuse `.env.example` placeholders in a shared
environment.

安装默认只显示凭据文件路径，`INFOQ_PRINT_SECRETS=1` 只用于不会被采集的私密终端；禁止把秘密写入发布日志。已有环境文件会覆盖调用环境中的同名值；源码选择/下载却发生在加载该文件前，升级必须核对实际 checkout/tag、调用版本和环境文件内版本/批次，见 [DEPLOYMENT_LIFECYCLE.md](DEPLOYMENT_LIFECYCLE.md)。下载的安装器没有安全的 `--help`/dry-run；不要把这两个参数当作预览运行。

Uninstall（先预览，实际删除仍需逐项确认）：

```bash
sudo bash deploy/uninstall.sh --dry-run
```

选择删除容器/数据时，预览也要求 Docker 可达。脚本在任何删除前批量核验全部所选容器的 Compose project/service 标签、部署挂载及默认网络标签，按已核验容器 ID 删除；查询失败或归属不符即停止。仅在列表查询成功时才把缺失容器认定为不存在；残留目录还必须包含匹配 project 的 `.infoq-deploy-owner`。helper 只为新建服务目录写该标记，不自动认领旧数据；旧目录无容器可核验、也无标记时拒绝卸载，须由运维独立证明归属并评审清理。

## 3. Docker Compose

Copy the environment template, then edit secrets:

```bash
cp deploy/.env.example deploy/docker/.env
chmod 600 deploy/docker/.env
```

编辑 `.env` 所有占位凭据、管理员密码、公共地址和部署根目录后，明确传给 shell helper。helper 不自动读取 `deploy/docker/.env`；必须先部署后端依赖，再部署前端：

```bash
export INFOQ_ENV_FILE="$(pwd)/deploy/docker/.env"
bash deploy/bin/infoq.sh deploy
bash deploy/bin/deploy-frontend.sh deploy all
```

Target a single console:

```bash
bash deploy/bin/deploy-frontend.sh deploy vue
bash deploy/bin/deploy-frontend.sh deploy react
```

Stop:

```bash
bash deploy/bin/deploy-frontend.sh stop all
bash deploy/bin/infoq.sh stop
```

On macOS Colima set `INFOQ_DEPLOY_ROOT="$HOME/infoq"` before starting. Full
tutorial, scripted flow, and optional MQTT / Elasticsearch overlays are in
[DOCKER.md](DOCKER.md).

## 4. Apple Container

For a local Apple `container` backend stack that stays isolated from other
Apple container projects. This path starts MySQL, Redis, and the backend only;
it does not build or serve the Vue/React admins or the Nginx gateway.

```bash
node skills/deploy-cli/scripts/deploy_cli.mjs init
node skills/deploy-cli/scripts/deploy_cli.mjs up
node skills/deploy-cli/scripts/deploy_cli.mjs status
```

The underlying entry remains `deploy/apple-container.sh`; see
[APPLE_CONTAINER.md](APPLE_CONTAINER.md) for direct shell usage. Do not reuse
`$HOME/infoq` or stop containers owned by other projects.

## 5. Manual Deploy

Non-container JVM + Nginx deployment is documented in [MANUAL.md](MANUAL.md),
including systemd and nginx examples under `examples/`.

## 6. Gateway Routes

The `all` target exposes:

- `/vue/` Vue admin
- `/react/` React admin
- `/prod-api/` backend API
- `/console-oss/` MinIO console；S3 使用 `INFOQ_OSS_PUBLIC_ORIGIN` 根路径
- `INFOQ_OSS_PUBLIC_ORIGIN` 独立主机根路径的私有 S3 签名访问

A single-target deploy mounts that admin at `/`.

## 7. Verification

Use [`deploy/VERIFICATION.md`](./VERIFICATION.md) for a full Compose smoke. A minimal check:

```bash
INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env bash deploy/bin/infoq.sh status
curl -fsS http://127.0.0.1:9090/monitor/health/readiness
curl -fsS https://app.example.com/prod-api/monitor/health/readiness
```

Local `java -jar` with the `local` profile still uses `http://127.0.0.1:8080`.

## 8. 发布前最小验收清单

进入正式部署前，至少确认以下项目：

- 外部依赖已就绪：MySQL、Redis、Nginx、可选 MinIO
- 部署目录与权限已确认
- 生产配置已替换默认值
- 证书、域名、端口策略已确认
- 初始化 SQL 使用策略已确认
- `DEPLOY_ID`、`SECURITY_TOKEN_SECRET`、`api-decrypt` keys、Redis/Redisson 配置一致性已确认
- `/monitor/health/readiness` 在待接流量节点上返回 2xx，DB/Redis 不可用时能返回失败
- 滚动更新顺序已确认：先摘流量，再确认负载均衡不再转发到旧节点或连接排空，再停止旧节点
- 回滚方案已准备：上一个 jar、上一个前端静态包、数据库备份
- 日志查看路径已明确

以上任一项未确认，或生命周期文档的生产阻塞未关闭时，停止上线部署并记录具体缺失条件。

## 9. Troubleshooting

Container logs:

```bash
INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env bash deploy/bin/infoq.sh logs infoq-admin
```

更多排障（镜像 tag 收口、Docker credential helper、WSL2 keepalive、Corepack
激活失败等）见 [DOCKER.md](DOCKER.md) 的排障章节。

上述命令需由能读取 `600` 环境文件且能访问 Docker socket 的部署账号执行；root 创建的文件通常需要授权 root shell。`logs` 持续跟随，可用 `Ctrl-C` 退出，服务不受影响。查看其他服务时将 `infoq-admin` 替换为 `mysql`、`redis` 或 `minio`。

## 10. Detailed Documents

| Document | Description |
| --- | --- |
| [DOCKER.md](DOCKER.md) | WSL2 / macOS / Linux 容器部署全流程 |
| [APPLE_CONTAINER.md](APPLE_CONTAINER.md) | macOS Apple `container` 本机后端栈 |
| [DEPLOYMENT_LIFECYCLE.md](DEPLOYMENT_LIFECYCLE.md) | 安装、升级、回滚、停止与数据保留 |
| [MANUAL.md](MANUAL.md) | 非容器化部署 |
| [VERIFICATION.md](VERIFICATION.md) | 容器部署 smoke 与阻断收口 |
| [runtime-matrix.md](runtime-matrix.md) | 运行时选择矩阵 |
| [Security policy](../SECURITY.md) | Vulnerability reporting |
