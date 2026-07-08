# Docker Compose 部署说明

本文档以当前仓库的 `script/docker/docker-compose.yml` 为准，只保留现有工程真正可执行的部署入口。
当前文档对应项目基线版本为 `2.1.8`。

如果你是第一次用 Docker Compose 部署本项目，建议先阅读教程，再回到本文查看脚本细节：

- [Docker Compose 部署教程](./docker-compose-tutorial.md)
- [项目部署前准备](./deploy-prerequisites.md)
- [手动部署说明](./manual-deploy.md)

默认宿主机根目录按运行时选择：WSL2 / 原生 Linux 使用 `/infoq`，macOS Colima 使用 `$HOME/infoq`。始终显式设置 `INFOQ_DEPLOY_ROOT`，不要依赖脚本自动判断。

Docker Compose / 脚本化部署不要求宿主机安装 JDK 或 Maven。后端 prod 打包在 Docker builder 镜像 `maven:3.9.12-eclipse-temurin-17` 中执行，最终 `infoq-admin` 运行镜像保持 `bellsoft/liberica-openjdk-rocky:17.0.16-cds`。后端 Dockerfile 使用 BuildKit `RUN --mount`，因此 Docker CLI 必须支持 `docker buildx`。

如果只是一次性本地验证，并且确认该路径能被当前 Docker runtime 稳定挂载，也可以显式设置为独立临时目录；WSL2 不要把 MySQL 数据目录放在 `/mnt/c`、`/mnt/d` 等 DrvFS 路径下。

```bash
export INFOQ_DEPLOY_ROOT="$(pwd)/doc/tmp/infoq-deploy"
```

然后再执行后续脚本或 Docker Compose 命令。脚本会优先使用 `docker compose`，当前环境缺少 Docker Compose plugin 时回退到 standalone `docker-compose`。脚本默认固定 `COMPOSE_PROJECT_NAME=infoq-scaffold-ai`，避免使用 Compose 文件目录名生成 `docker_default` 这类过于通用的网络名；确需覆盖时可显式设置 `INFOQ_COMPOSE_PROJECT_NAME` 或 `COMPOSE_PROJECT_NAME`。

## 0. 推荐一键安装入口

首次部署推荐使用 `deploy/install.sh`，它会生成并持久化 MySQL、Redis、MinIO、后端安全密钥和默认管理员账号密码，随后调用后端、前端和 Nginx 部署脚本：

```bash
curl -sSL https://raw.githubusercontent.com/LuckyKuang/infoq-scaffold-ai/main/deploy/install.sh | sudo env INFOQ_FRONTEND_TARGET=all bash
```

该入口的宿主机前置命令是 `curl`、`tar`、`openssl`、`docker`、`docker buildx` 和 Docker Compose；Java 与 Maven 由 Docker 镜像提供。

生产或准生产环境建议固定 tag：

```bash
curl -fsSLO https://raw.githubusercontent.com/LuckyKuang/infoq-scaffold-ai/<tag>/deploy/install.sh
chmod +x install.sh
sudo env INFOQ_VERSION=<tag> INFOQ_FRONTEND_TARGET=all INFOQ_PUBLIC_BASE_URL=http://SERVER_IP ./install.sh
```

`INFOQ_FRONTEND_TARGET` 是必填的前端安装目标，取值为 `react`、`react-pro`、`vue` 或 `all`。选择 `all` 时保留 `/vue/`、`/react/`、`/react-pro/` 三个网关入口；选择单个前端时只部署目标前端，并把管理端挂到网关根路径 `/`。

安装脚本会创建或复用：

```text
/etc/infoq-scaffold-ai/deploy.env
/etc/infoq-scaffold-ai/credentials.txt
```

两个文件权限必须是 `600`。重复执行安装脚本会复用已有 `deploy.env`；如果 `${INFOQ_DEPLOY_ROOT}/mysql/data` 已有数据但 `deploy.env` 缺失，脚本会停止，避免随机生成的新密码与旧数据目录不匹配。

本地源码验证可显式指定源码路径：

```bash
sudo env INFOQ_SOURCE_DIR="$(pwd)" INFOQ_FRONTEND_TARGET=all INFOQ_PUBLIC_BASE_URL=http://127.0.0.1 INFOQ_DEPLOY_ROOT="${HOME}/infoq" bash deploy/install.sh
```

## 1. 准备宿主机目录

先按 [script/docker/redis/data/README.md](../../script/docker/redis/data/README.md) 创建 `${INFOQ_DEPLOY_ROOT:-/infoq}/...` 目录。

最少要有：

```text
/infoq/mysql/data
/infoq/mysql/conf
/infoq/redis/conf
/infoq/redis/data
/infoq/minio/data
/infoq/server/config
/infoq/server/logs
/infoq/server/temp
/infoq/server/ip2region
/infoq/nginx/cert
/infoq/nginx/conf
/infoq/nginx/log
/infoq/vue/logs        # INFOQ_FRONTEND_TARGET=vue 或 all
/infoq/react/logs      # INFOQ_FRONTEND_TARGET=react 或 all
/infoq/react-pro/logs  # INFOQ_FRONTEND_TARGET=react-pro 或 all
```

Redis 数据目录会同时挂载到容器内 `/redis/data` 和官方镜像默认的 `/data`。前者由 `script/docker/redis/conf/redis.conf` 使用，后者用于覆盖镜像声明的默认 volume，避免 Docker 在每次创建 Redis 容器时额外生成匿名卷。

其中 `${INFOQ_DEPLOY_ROOT:-/infoq}/redis/conf/redis.conf` 会在 `prepare` 时由 `script/docker/redis/conf/redis.conf` 模板渲染，`requirepass` 使用 `deploy.env` 中的随机 `REDIS_PASSWORD`，不要提交渲染后的生产配置。
其中 `${INFOQ_DEPLOY_ROOT:-/infoq}/server/config/application-prod.yml` 会在首次执行 `bash script/bin/infoq.sh prepare` 时自动生成一份 Docker Compose 默认模板，数据库账号和 Redis 密码通过环境变量注入，不在模板内硬编码。
其中 `${INFOQ_DEPLOY_ROOT:-/infoq}/server/ip2region/ip2region_v6.xdb` 会在 `prepare` 时从 [script/docker/server/ip2region/ip2region_v6.xdb](../../script/docker/server/ip2region/ip2region_v6.xdb) 初始化；如果目标文件已存在，脚本会保留外置磁盘上的现有文件。`infoq-admin` 容器会把 `${INFOQ_DEPLOY_ROOT:-/infoq}/server/ip2region/` 只读挂载到 `/infoq/server/ip2region/`，并设置 `INFOQ_IP2REGION_V6_PATH=/infoq/server/ip2region/ip2region_v6.xdb`。
`bash script/bin/infoq.sh deploy` 会在启动 MySQL / Redis 后等待依赖就绪，并校验基础表、Quartz 调度表、监控菜单、配置元数据列和 OAuth 表/授权类型；缺失时会按顺序补导 `sql/infoq_scaffold_2.0.0.sql` 与当前 `sql/infoq_scaffold_update_*.sql` 增量脚本。
`bash script/bin/infoq.sh deploy` 还会创建 MySQL 业务账号，更新 `sys_user.user_id=1` 的随机管理员账号密码，更新 `sys_oss_config` 中 `minio` 和 `image` 的 MinIO 凭据、bucket、endpoint、domain 和 HTTPS 标记，并确认 MinIO bucket 存在。
当前仓库的 Quartz bootstrap `deploy-id` 由 `DEPLOY_ID` 注入。脚本化 `deploy` 在未显式设置 `DEPLOY_ID` 时会生成一次当前批次号并写入 `${INFOQ_DEPLOY_ROOT:-/infoq}/server/config/deploy-id`；同一批滚动发布的所有 backend 节点必须使用同一个值。

## 2. 首次部署后端

```bash
export INFOQ_DEPLOY_ROOT="$(pwd)/doc/tmp/infoq-deploy"
export INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env
set -a
. "${INFOQ_ENV_FILE}"
set +a
bash script/bin/infoq.sh prepare
bash script/bin/infoq.sh deploy
```

常用命令：

```bash
bash script/bin/infoq.sh status
bash script/bin/infoq.sh logs infoq-admin
bash script/bin/infoq.sh restart
bash script/bin/infoq.sh stop
```

后端服务端口：

- `infoq-admin`: `9090`

说明：

- 首次空数据目录启动时，MySQL 容器会按顺序自动执行基础 SQL 与当前增量 SQL
- 如果数据目录已存在，但 `infoq` 库表或增量结构未初始化，`deploy` / `start` 也会补导缺失 SQL 并做关键表/列校验
- `deploy` 会生成或校验本次 `DEPLOY_ID`，然后准备宿主机目录、通过 Docker builder 构建后端镜像、启动依赖服务、同步随机凭据并拉起 `infoq-admin`
- `deploy` 默认不会覆盖用户已修改的管理员账号或非默认 OSS 配置；需要重置时显式设置 `INFOQ_RESET_ADMIN=1` 或 `INFOQ_RESET_OSS=1`
- `prepare` / `deploy` / `start` 会确保 `${INFOQ_DEPLOY_ROOT:-/infoq}/server/ip2region/ip2region_v6.xdb` 存在；如果后续单独替换该文件，需要重启 `infoq-admin` 才会生效
- `start` 与 `restart` 会复用 `${INFOQ_DEPLOY_ROOT:-/infoq}/server/config/deploy-id`；如果文件不存在，先执行 `deploy` 或显式设置 `DEPLOY_ID`
- 如果同一版本在同一天需要再次发布，应使用新的 `DEPLOY_ID` 并重新执行 `deploy`，不要复用上一批次号
- `infoq-admin` 容器 healthcheck 使用 `/monitor/health/readiness`；DB 或 Redis 不可用时容器会进入 unhealthy，而 `/monitor/health/liveness` 仅表示进程可响应 HTTP

## 3. 首次部署前端

```bash
export INFOQ_DEPLOY_ROOT="$(pwd)/doc/tmp/infoq-deploy"
export INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env
bash script/bin/deploy-frontend.sh prepare "${INFOQ_FRONTEND_TARGET}"
bash script/bin/deploy-frontend.sh deploy "${INFOQ_FRONTEND_TARGET}"
```

`deploy` 会先生成 `${INFOQ_DEPLOY_ROOT:-/infoq}/nginx/conf/nginx.conf`，再按目标顺序构建前端镜像，最后启动目标前端容器并强制重建 `nginx-web`，确保前端容器重建后的 upstream DNS 被刷新。本机 Docker 验证时不要直接用 `docker compose up --build ...` 并行构建替代脚本。

常用命令：

```bash
bash script/bin/deploy-frontend.sh status "${INFOQ_FRONTEND_TARGET}"
bash script/bin/deploy-frontend.sh logs all
bash script/bin/deploy-frontend.sh restart "${INFOQ_FRONTEND_TARGET}"
bash script/bin/deploy-frontend.sh stop "${INFOQ_FRONTEND_TARGET}"
```

前端访问方式：

- `INFOQ_FRONTEND_TARGET=all`：`http://host/vue/`、`http://host/react/`、`http://host/react-pro/`
- `INFOQ_FRONTEND_TARGET=react|react-pro|vue`：`http://host/`
- MinIO Console：`http://host/console-oss/`
- MinIO OSS：`http://host/oss/`
- Vue 直连端口：`9091`
- React 直连端口：`9092`
- React Pro 直连端口：`9093`

单前端部署只会启动并暴露目标前端对应的直连端口；`all` 才会同时暴露 `9091`、`9092`、`9093`。

前端日志目录：

- Vue：`/infoq/vue/logs`，仅 `vue` 或 `all` 目标创建
- React：`/infoq/react/logs`，仅 `react` 或 `all` 目标创建
- React Pro：`/infoq/react-pro/logs`，仅 `react-pro` 或 `all` 目标创建
- 网关 Nginx：`/infoq/nginx/log`

## 4. 日常启动步骤

如果镜像已经构建过，且宿主机目录、数据库数据都还在，只需要执行启动命令，不必重新 `deploy`。

```bash
export INFOQ_DEPLOY_ROOT="$(pwd)/doc/tmp/infoq-deploy"
export INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env

# 先启动后端依赖与 infoq-admin
bash script/bin/infoq.sh start

# 再启动目标前端 / nginx-web
bash script/bin/deploy-frontend.sh start "${INFOQ_FRONTEND_TARGET}"
```

启动完成后可访问：

- `INFOQ_FRONTEND_TARGET=all`：`http://host/vue/`、`http://host/react/`、`http://host/react-pro/`
- `INFOQ_FRONTEND_TARGET=react|react-pro|vue`：`http://host/`
- `http://host/prod-api/`

说明：

- `bash script/bin/infoq.sh start` 适用于“启动已有容器”，会复用已经持久化的 `DEPLOY_ID`，不会生成新的部署批次。
- 如果你是发布新包、希望生产环境重新执行一次受控 Quartz reconcile，应使用新的 `DEPLOY_ID` 执行 `bash script/bin/infoq.sh deploy`。

## 5. 日常停止步骤

建议先停前端和网关，再停后端与基础服务：

```bash
export INFOQ_DEPLOY_ROOT="$(pwd)/doc/tmp/infoq-deploy"
export INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env

# 先停止目标前端 / nginx-web
bash script/bin/deploy-frontend.sh stop "${INFOQ_FRONTEND_TARGET}"

# 再停止 infoq-admin / mysql / redis / minio
bash script/bin/infoq.sh stop
```

`infoq-admin` 已配置 Spring Boot graceful shutdown 和 Compose `stop_grace_period`。滚动更新时应先从负载均衡或 Nginx upstream 摘除旧节点，确认旧节点不再接收新流量或长连接排空，再停止旧容器；新节点必须在 `/monitor/health/readiness` 返回 2xx 后再纳入流量。WebSocket/SSE 客户端断线重连能力仍需按前端专项验证确认。

## 6. 卸载本地部署栈

如需清理本地或自管测试环境，使用 `deploy/uninstall.sh`，不要用 `docker compose down -v` 替代。脚本会读取 `deploy.env` 中的 `INFOQ_FRONTEND_TARGET` 生成应用删除范围，随后逐项确认应用、MySQL、Redis、MinIO、配置目录和空部署根目录是否删除；实际删除前还必须输入固定确认短语。

先预览计划：

```bash
export INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env
bash deploy/uninstall.sh --dry-run
```

确认后执行：

```bash
sudo env INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env bash deploy/uninstall.sh
```

macOS Colima 通过 `sudo` 执行时需要继续传入用户态 Docker socket：

```bash
export DOCKER_HOST="unix://${HOME}/.colima/default/docker.sock"
sudo env DOCKER_CONFIG="${DOCKER_CONFIG:-$HOME/.docker}" DOCKER_HOST="${DOCKER_HOST}" INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env bash deploy/uninstall.sh
```

删除语义如下：

- 选择删除应用时，始终删除 `infoq-admin`、`nginx-web`、`${INFOQ_DEPLOY_ROOT}/server` 和 `${INFOQ_DEPLOY_ROOT}/nginx`，并只删除 `INFOQ_FRONTEND_TARGET` 对应的前端容器与目录；`all` 目标才会删除 `infoq-frontend-vue`、`infoq-frontend-react`、`infoq-frontend-react-pro` 以及 `${INFOQ_DEPLOY_ROOT}/vue`、`${INFOQ_DEPLOY_ROOT}/react`、`${INFOQ_DEPLOY_ROOT}/react-pro`。
- 选择删除 MySQL 时，会删除 `mysql` 容器和 `${INFOQ_DEPLOY_ROOT}/mysql`；选择保留时，容器和目录都不会被删除。
- 选择删除 Redis 时，会删除 `redis` 容器和 `${INFOQ_DEPLOY_ROOT}/redis`；选择保留时，容器和目录都不会被删除。
- 选择删除 MinIO 时，会删除 `minio` 容器和 `${INFOQ_DEPLOY_ROOT}/minio`；选择保留时，容器和目录都不会被删除。
- 配置目录 `${INFOQ_CONFIG_DIR:-/etc/infoq-scaffold-ai}` 与空的 `${INFOQ_DEPLOY_ROOT}` 是独立确认项。
- 执行过容器删除动作后，脚本会删除空的 Compose 项目网络 `${INFOQ_COMPOSE_PROJECT_NAME:-infoq-scaffold-ai}_default`。若用户选择保留 MySQL、Redis 或 MinIO，对应容器仍在网络内，网络会保留。
- 脚本不删除 Docker 镜像。

自动化验证可显式传入选择项，例如：

```bash
INFOQ_UNINSTALL_APPS=yes \
INFOQ_UNINSTALL_MYSQL=no \
INFOQ_UNINSTALL_REDIS=no \
INFOQ_UNINSTALL_MINIO=no \
INFOQ_UNINSTALL_CONFIG=no \
INFOQ_UNINSTALL_EMPTY_ROOT=no \
bash deploy/uninstall.sh --dry-run
```

实际删除的自动化执行还必须额外传入 `INFOQ_UNINSTALL_CONFIRM='DELETE INFOQ DEPLOYMENT'`。

## 7. 常用运维命令

查看状态：

```bash
export INFOQ_DEPLOY_ROOT="$(pwd)/doc/tmp/infoq-deploy"
export INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env
bash script/bin/infoq.sh status
bash script/bin/deploy-frontend.sh status "${INFOQ_FRONTEND_TARGET}"
```

查看日志：

```bash
export INFOQ_DEPLOY_ROOT=doc/tmp/infoq-deploy
export INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env
bash script/bin/infoq.sh logs infoq-admin
bash script/bin/deploy-frontend.sh logs all
```

重启服务：

```bash
export INFOQ_DEPLOY_ROOT=doc/tmp/infoq-deploy
export INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env
bash script/bin/infoq.sh restart
bash script/bin/deploy-frontend.sh restart "${INFOQ_FRONTEND_TARGET}"
```

镜像 tag 收口：

如果为处理镜像源 EOF/short read 临时直拉 `registry-1.docker.io/...`，只能把它作为辅助 tag。仓库 Dockerfile 和 Compose 使用 `bellsoft/...`、`node:*`、`nginx:*` 等短名；执行 `docker tag` 回短名后，确认两者 `IMAGE ID` 一致且没有容器引用长名，再删除辅助 tag：

```bash
docker image ls --format '{{.Repository}}:{{.Tag}} {{.ID}}' | grep 'registry-1.docker.io'
docker ps -a --format '{{.Names}} {{.Image}}'
# 按 docker image ls 输出中的实际长名执行，例如：
docker rmi registry-1.docker.io/library/node:24.18.0
```

Docker credential helper 排查：

macOS Colima 环境如果曾安装或卸载 Docker Desktop，`~/.docker/config.json` 可能残留 `credsStore` 或 `credHelpers` 指向 `desktop`。此时 Docker/Compose 拉取 public image 也可能失败，并出现 `error getting credentials`、`docker-credential-desktop` 不存在等错误。一次性本地验证可使用临时 Docker config：

```bash
export INFOQ_TEMP_DOCKER_CONFIG="$(pwd)/doc/tmp/infoq-deploy-verify/docker-config"
mkdir -p "${INFOQ_TEMP_DOCKER_CONFIG}"
printf '{"auths":{}}\n' > "${INFOQ_TEMP_DOCKER_CONFIG}/config.json"
export DOCKER_CONFIG="${INFOQ_TEMP_DOCKER_CONFIG}"
export DOCKER_HOST="unix://${HOME}/.colima/default/docker.sock"
```

长期处理应清理失效的 `credsStore` / `credHelpers`，或安装当前配置声明的 credential helper。部署脚本会在 `deploy` / `build` 路径进入镜像拉取或构建前检查 Docker credential helper 是否存在，避免把该问题延迟到镜像拉取阶段才暴露；`status`、`stop`、`logs` 等不拉取镜像的命令不会因该检查被拦截。

## 8. 如需直接使用 Docker Compose CLI

常规部署不要直接用 `docker compose up --build` 替代仓库脚本。Compose 文件本身定义了三个前端服务，直接全量 `up` 会绕过 `INFOQ_FRONTEND_TARGET` 的安装范围，容易在单前端部署中把未选择的前端也构建并启动。优先使用：

```bash
export INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env
set -a
. "${INFOQ_ENV_FILE}"
set +a
bash script/bin/infoq.sh deploy
bash script/bin/deploy-frontend.sh deploy "${INFOQ_FRONTEND_TARGET}"
```

只有在排查 Compose 本身问题时才直接调用 Docker Compose CLI。直接调用前必须加载安装脚本生成的环境文件，至少包含 MySQL root 密码、MySQL 应用账号、Redis 密码、MinIO 凭据、公开 URL、`SECURITY_TOKEN_SECRET` 和 `DEPLOY_ID`：

```bash
export INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env
set -a
. "${INFOQ_ENV_FILE}"
set +a
docker compose -f script/docker/docker-compose.yml ps
docker compose -f script/docker/docker-compose.yml logs -f infoq-admin
```

如果当前环境只有 standalone CLI，则使用等价的 `docker-compose -f script/docker/docker-compose.yml ...`。

直接使用 Docker Compose CLI 时，建议保证 `${INFOQ_DEPLOY_ROOT:-/infoq}/mysql/data` 为空目录，以便 MySQL 首次启动时自动执行 `sql/` 目录内的基础 SQL 与当前增量 SQL。
如果是多节点部署，同一批节点应共享同一组 MySQL、Redis/Redisson、`SECURITY_TOKEN_SECRET`、`api-decrypt` keys 和 `DEPLOY_ID`；新批次发布必须换新 `DEPLOY_ID`。
