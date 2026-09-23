# Docker Compose

Docker Compose is the recommended way to run the full InfoQ-Scaffold-AI stack:
MySQL, Redis, MinIO, the Spring Boot backend, and the Vue / React admin
gateways.

Application Compose files live in [`deploy/docker/`](../deploy/docker/). The
environment template lives in [`.env.example`](.env.example). Prerequisites
(versions, ports, directories, config checklist) are in [README.md](README.md).

本文件合并了 Compose 教程与脚本化部署流程：首次部署按第 1 - 6 节顺序执行；
日常运维看第 7 - 9 节；可选中间件与排障看第 10 - 14 节。

当前文档对应项目基线版本为 `3.0.0`。

## 1. 教程目标

默认只覆盖三类免费商用容器运行时：

| 场景 | 默认运行时 | 部署根目录 |
| --- | --- | --- |
| Windows + WSL2 Debian / Ubuntu | WSL2 子系统内的 Docker CE / Moby Engine | `/infoq` |
| macOS | Colima + Docker runtime + Docker CLI / Compose | `$HOME/infoq` |
| 原生 Linux 服务器 | Docker CE / Moby Engine | `/infoq` |

本文不把 Docker Desktop 作为默认教程路径，也不默认支持 Rancher Desktop、Podman、OrbStack 等其他运行时。许可边界请以你所在组织的当前政策和运行时安装来源为准。

完成后，你应该能访问：

```text
INFOQ_FRONTEND_TARGET=all:
  http://localhost/vue/
  http://localhost/react/

INFOQ_FRONTEND_TARGET=react|vue:
  http://localhost/

http://localhost/prod-api/monitor/health/readiness
http://localhost/console-oss/
http://localhost/oss/
```

同时，基础服务直连端口应可用；前端直连端口按 `INFOQ_FRONTEND_TARGET` 决定：

```text
Backend:   9090
Vue:       9091
React:     9092
MinIO API: 9000
MinIO Console: 9001
MySQL:     3306
Redis:     6379
Nginx:     80 / 443
```

## 2. 先确认运行时

进入服务器或目标 shell 后，先执行只读探测：

```bash
uname -s
uname -r
docker version
docker buildx version
docker compose version || docker-compose version
docker context show || true
docker context ls || true
docker info --format '{{.OperatingSystem}} | {{.ServerVersion}} | {{.Name}}' || true
```

### 2.1 WSL2 Debian / Ubuntu

在 WSL 内确认当前是 WSL2，并且 Docker daemon 在 WSL 内可用：

```bash
grep -qi microsoft /proc/version && echo wsl2
docker ps
docker compose version || docker-compose version
```

要求：

- `docker ps` 能正常返回。
- 当前 Docker 不是 Windows Docker Desktop 暴露进 WSL 的 context。
- 数据目录不要放在 `/mnt/c`、`/mnt/d` 等 DrvFS 路径下。

如果从 Windows PowerShell 侧执行 WSL 命令，仓库路径在 WSL 内通常对应 `/mnt/c/...`。代码可以在 `/mnt/c/...` 下构建验证，但 Docker 持久化数据建议放在 WSL Linux 文件系统的 `/infoq` 下。

### 2.2 macOS Colima

先确认 Colima 和 Docker CLI 可用：

```bash
command -v colima
colima status || colima start --runtime docker --cpu 4 --memory 8 --disk 80
docker context use colima
docker ps
docker compose version || docker-compose version
```

如果这台机器曾安装或卸载 Docker Desktop，先检查 Docker credential helper：

```bash
grep -nE '"credsStore"|"credHelpers"' "${DOCKER_CONFIG:-$HOME/.docker}/config.json" 2>/dev/null || true
```

当后续 Docker/Compose 拉取 public image 时出现 `error getting credentials`，并提示 `docker-credential-desktop` 不存在，说明当前 Docker config 仍引用 Docker Desktop helper。一次性本地验证可使用临时 Docker config 继续走 Colima：

```bash
export INFOQ_TEMP_DOCKER_CONFIG="$(pwd)/tmp/deploy-verify/docker-config"
mkdir -p "${INFOQ_TEMP_DOCKER_CONFIG}"
printf '{"auths":{}}\n' > "${INFOQ_TEMP_DOCKER_CONFIG}/config.json"
export DOCKER_CONFIG="${INFOQ_TEMP_DOCKER_CONFIG}"
export DOCKER_HOST="unix://${HOME}/.colima/default/docker.sock"
```

长期做法是清理 `~/.docker/config.json` 中失效的 `credsStore` / `credHelpers`，或安装当前配置声明的 credential helper；不要因为该错误切换到 Docker Desktop。

macOS 默认使用：

```bash
export INFOQ_DEPLOY_ROOT="${HOME}/infoq"
```

不要直接套用 Linux 的 `/infoq`，除非你已经确认 Colima VM 可以挂载这个目录。需要使用 `/infoq` 时，先做挂载验证：

```bash
mkdir -p /infoq/server/temp
docker run --rm -v /infoq:/infoq alpine:3.20 sh -lc 'test -d /infoq/server/temp && echo ok'
```

验证失败时，回到 `$HOME/infoq`，或者先调整 Colima mount 配置。

### 2.3 原生 Linux

在 Linux 服务器上确认 Docker daemon 和 Compose：

```bash
systemctl is-active docker || service docker status || true
docker ps
docker compose version || docker-compose version
```

要求当前部署账号能执行 Docker 命令。如果需要 `sudo docker`，建议先把部署账号加入合适的 Docker 用户组，并重新登录后再部署。

## 3. 执行前必须创建的目录

部署前必须明确确认这两个目录存在：

```bash
/tmp/infoq-deploy
${INFOQ_DEPLOY_ROOT}/server/temp
```

WSL2 / 原生 Linux 默认：

```bash
export INFOQ_DEPLOY_ROOT=/infoq
mkdir -p /tmp/infoq-deploy "${INFOQ_DEPLOY_ROOT}/server/temp"
```

macOS Colima 默认：

```bash
export INFOQ_DEPLOY_ROOT="${HOME}/infoq"
mkdir -p /tmp/infoq-deploy "${INFOQ_DEPLOY_ROOT}/server/temp"
```

如果当前账号没有权限创建 `${INFOQ_DEPLOY_ROOT}/server/temp`，先让服务器管理员创建并授权，不要跳过这个步骤继续部署。脚本后续还会补齐其他目录，完整目录清单见 [README.md](README.md) 第 1.3 节。

## 4. 一键安装入口

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

`INFOQ_FRONTEND_TARGET` 是必填的前端安装目标，取值为 `react`、`vue` 或 `all`。选择单个前端时只构建并启动目标前端，网关根路径 `/` 直接进入该管理端。

本地源码验证可显式指定源码路径：

```bash
sudo env INFOQ_SOURCE_DIR="$(pwd)" INFOQ_FRONTEND_TARGET=all INFOQ_PUBLIC_BASE_URL=http://127.0.0.1 INFOQ_DEPLOY_ROOT=/infoq bash deploy/install.sh
```

安装脚本会创建或复用：

```text
/etc/infoq-scaffold-ai/deploy.env
/etc/infoq-scaffold-ai/credentials.txt
```

两个文件权限必须是 `600`。重复执行安装脚本会复用已有 `deploy.env`，不会静默轮换 MySQL、Redis、MinIO 或管理员凭据。如果 `${INFOQ_DEPLOY_ROOT}/mysql/data` 已有数据但 `deploy.env` 缺失，脚本会停止，避免生成新密码后无法连接旧数据。

安装脚本内部会调用仓库部署脚本：

```bash
bash deploy/bin/infoq.sh deploy
bash deploy/bin/deploy-frontend.sh deploy "${INFOQ_FRONTEND_TARGET}"
```

除非正在排查脚本问题，否则不要用手写 `docker compose up --build` 替代脚本主流程。脚本会处理目录准备、配置模板、SQL 初始化校验、后端构建、前端顺序构建、Nginx 配置同步、前端容器启动后强制重建网关，以及容器启动。

Docker Compose 教程路径不要求宿主机安装 JDK 或 Maven。后端 Maven prod 打包在 Docker builder 镜像 `maven:3.9.12-eclipse-temurin-21` 中完成，最终运行镜像保持 `bellsoft/liberica-openjdk-rocky:21.0.12-cds`。

## 5. 各运行时部署示例

### 5.1 WSL2

如果从 Windows PowerShell 调用 WSL2 Debian：

```powershell
wsl.exe -d Debian -- bash -lc 'cd /mnt/c/DevTools/code/github/infoq-scaffold-ai && export INFOQ_DEPLOY_ROOT=/infoq && mkdir -p /tmp/infoq-deploy "${INFOQ_DEPLOY_ROOT}/server/temp" && sudo env INFOQ_SOURCE_DIR="$(pwd)" INFOQ_FRONTEND_TARGET=all INFOQ_PUBLIC_BASE_URL=http://127.0.0.1 INFOQ_DEPLOY_ROOT="${INFOQ_DEPLOY_ROOT}" bash deploy/install.sh'
```

如果已经在 WSL shell 内：

```bash
cd /mnt/c/DevTools/code/github/infoq-scaffold-ai
export INFOQ_DEPLOY_ROOT=/infoq
mkdir -p /tmp/infoq-deploy "${INFOQ_DEPLOY_ROOT}/server/temp"
sudo env INFOQ_SOURCE_DIR="$(pwd)" INFOQ_FRONTEND_TARGET=all INFOQ_PUBLIC_BASE_URL=http://127.0.0.1 INFOQ_DEPLOY_ROOT="${INFOQ_DEPLOY_ROOT}" bash deploy/install.sh
```

如果 WSL distro 容易自动退出，可以先临时保持一个 WSL 会话：

```bash
nohup bash -c 'while true; do sleep 3600; done' >/tmp/infoq-wsl-keepalive.log 2>&1 &
```

### 5.2 macOS Colima

```bash
cd /path/to/infoq-scaffold-ai
colima status || colima start --runtime docker --cpu 4 --memory 8 --disk 80
docker context use colima
export INFOQ_DEPLOY_ROOT="${HOME}/infoq"
export DOCKER_HOST="unix://${HOME}/.colima/default/docker.sock"
mkdir -p /tmp/infoq-deploy "${INFOQ_DEPLOY_ROOT}/server/temp"
sudo env DOCKER_CONFIG="${DOCKER_CONFIG:-$HOME/.docker}" DOCKER_HOST="${DOCKER_HOST}" INFOQ_SOURCE_DIR="$(pwd)" INFOQ_FRONTEND_TARGET=all INFOQ_PUBLIC_BASE_URL=http://127.0.0.1 INFOQ_DEPLOY_ROOT="${INFOQ_DEPLOY_ROOT}" bash deploy/install.sh
```

Colima 的 CPU、内存和磁盘参数按机器资源调整。首次构建前端镜像和后端镜像会占用较多 CPU、内存和磁盘空间；`INFOQ_FRONTEND_TARGET=all` 时会构建两个前端镜像，资源太小容易出现构建中断。

### 5.3 原生 Linux

```bash
cd /path/to/infoq-scaffold-ai
export INFOQ_DEPLOY_ROOT=/infoq
mkdir -p /tmp/infoq-deploy "${INFOQ_DEPLOY_ROOT}/server/temp"
sudo env INFOQ_SOURCE_DIR="$(pwd)" INFOQ_FRONTEND_TARGET=all INFOQ_PUBLIC_BASE_URL=http://SERVER_IP INFOQ_DEPLOY_ROOT="${INFOQ_DEPLOY_ROOT}" bash deploy/install.sh
```

如果是远程服务器，部署前还要确认安全组、防火墙、反向代理和域名证书策略。默认教程只证明本机 `localhost` 和容器内服务链路，不代替生产发布评审。

## 6. 部署环境文件

生产或准生产发布可以在首次安装前显式指定 `INFOQ_PUBLIC_BASE_URL`、`INFOQ_DEPLOY_ROOT`、`INFOQ_VERSION` 和 `INFOQ_OSS_BUCKET`。不设置 `DEPLOY_ID` 时，安装脚本会生成并持久化当前批次号。同一批滚动发布的所有后端节点必须使用同一个 `DEPLOY_ID`；同一版本再次发布时应换新值。

如果需要直接调用底层脚本，先加载同一个环境文件：

```bash
export INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env
set -a
. "${INFOQ_ENV_FILE}"
set +a
```

脚本默认固定 `COMPOSE_PROJECT_NAME=infoq-scaffold-ai`，避免使用 Compose 文件目录名生成 `docker_default` 这类过于通用的网络名；确需覆盖时可显式设置 `INFOQ_COMPOSE_PROJECT_NAME` 或 `COMPOSE_PROJECT_NAME`。脚本优先使用 `docker compose`，当前环境缺少 Docker Compose plugin 时回退到 standalone `docker-compose`。

如果只是一次性本地验证，并且确认该路径能被当前 Docker runtime 稳定挂载，也可以显式设置独立临时目录（WSL2 不要把 MySQL 数据目录放在 DrvFS 路径下）：

```bash
export INFOQ_DEPLOY_ROOT="$(pwd)/tmp/infoq-deploy"
```

## 7. 脚本化部署流程

### 7.1 首次部署后端

```bash
export INFOQ_DEPLOY_ROOT=/infoq
export INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env
set -a
. "${INFOQ_ENV_FILE}"
set +a
bash deploy/bin/infoq.sh prepare
bash deploy/bin/infoq.sh deploy
```

常用命令：

```bash
bash deploy/bin/infoq.sh status
bash deploy/bin/infoq.sh logs infoq-admin
bash deploy/bin/infoq.sh restart
bash deploy/bin/infoq.sh stop
```

说明：

- 首次空数据目录启动时，MySQL 容器会按顺序自动执行冻结初始化基线 `sql/infoq_scaffold_3.0.0.sql` 与当前增量 SQL `sql/infoq_scaffold_update_*.sql`
- 如果数据目录已存在，但 `infoq` 库表或增量结构未初始化，`deploy` / `start` 也会补导缺失 SQL 并做关键表/列校验
- `deploy` 会生成或校验本次 `DEPLOY_ID`，然后准备宿主机目录、通过 Docker builder 构建后端镜像、启动依赖服务、同步随机凭据并拉起 `infoq-admin`
- `deploy` 默认不会覆盖用户已修改的管理员账号或非默认 OSS 配置；需要重置时显式设置 `INFOQ_RESET_ADMIN=1` 或 `INFOQ_RESET_OSS=1`
- `infoq-admin` 容器 healthcheck 使用 `/monitor/health/readiness`；DB 或 Redis 不可用时容器会进入 unhealthy，而 `/monitor/health/liveness` 仅表示进程可响应 HTTP
- 同一版本在同一天需要再次发布时，应使用新的 `DEPLOY_ID` 并重新执行 `deploy`，不要复用上一批次号

### 7.2 首次部署前端

```bash
export INFOQ_DEPLOY_ROOT=/infoq
export INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env
bash deploy/bin/deploy-frontend.sh prepare "${INFOQ_FRONTEND_TARGET}"
bash deploy/bin/deploy-frontend.sh deploy "${INFOQ_FRONTEND_TARGET}"
```

`deploy` 会先生成 `${INFOQ_DEPLOY_ROOT}/nginx/conf/nginx.conf`，再按目标顺序构建前端镜像，最后启动目标前端容器并强制重建 `nginx-web`，确保前端容器重建后的 upstream DNS 被刷新。本机 Docker 验证时不要直接用 `docker compose up --build ...` 并行构建替代脚本。

常用命令：

```bash
bash deploy/bin/deploy-frontend.sh status "${INFOQ_FRONTEND_TARGET}"
bash deploy/bin/deploy-frontend.sh logs all
bash deploy/bin/deploy-frontend.sh restart "${INFOQ_FRONTEND_TARGET}"
bash deploy/bin/deploy-frontend.sh stop "${INFOQ_FRONTEND_TARGET}"
```

前端访问方式：

- `INFOQ_FRONTEND_TARGET=all`：`http://host/vue/`、`http://host/react/`
- `INFOQ_FRONTEND_TARGET=react|vue`：`http://host/`
- MinIO Console：`http://host/console-oss/`；MinIO OSS：`http://host/oss/`
- Vue 直连端口：`9091`；React 直连端口：`9092`

前端日志目录：Vue `${INFOQ_DEPLOY_ROOT}/vue/logs`（仅 `vue` 或 `all` 目标创建）、React `${INFOQ_DEPLOY_ROOT}/react/logs`（仅 `react` 或 `all` 目标创建）、网关 Nginx `${INFOQ_DEPLOY_ROOT}/nginx/log`。

### 7.3 日常启动与停止

如果镜像已经构建过，且宿主机目录、数据库数据都还在，只需要执行启动命令：

```bash
bash deploy/bin/infoq.sh start
bash deploy/bin/deploy-frontend.sh start "${INFOQ_FRONTEND_TARGET}"
```

`start` 适用于"启动已有容器"，会复用已经持久化的 `DEPLOY_ID`，不会生成新的部署批次。如果是发布新包、希望生产环境重新执行一次受控 Quartz reconcile，应使用新的 `DEPLOY_ID` 执行 `deploy`。

停止顺序建议先前端和网关，再后端和基础服务：

```bash
bash deploy/bin/deploy-frontend.sh stop "${INFOQ_FRONTEND_TARGET}"
bash deploy/bin/infoq.sh stop
```

停止命令不会主动删除 `${INFOQ_DEPLOY_ROOT}` 下的数据目录。不要为了"重新部署"直接删除 `/infoq`、`$HOME/infoq`、Docker volume 或 MySQL 数据，除非已经确认备份和回滚策略。

### 7.4 卸载本地部署栈

如需清理本地或自管测试环境，使用 `deploy/uninstall.sh`，不要用 `docker compose down -v` 替代。脚本会读取 `deploy.env` 中的 `INFOQ_FRONTEND_TARGET` 生成应用删除范围，随后逐项确认应用、MySQL、Redis、MinIO、配置目录和空部署根目录是否删除；实际删除前还必须输入固定确认短语 `DELETE INFOQ DEPLOYMENT`。

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

删除语义：选择删除应用时，始终删除 `infoq-admin`、`nginx-web`、`${INFOQ_DEPLOY_ROOT}/server` 和 `${INFOQ_DEPLOY_ROOT}/nginx`，并只删除 `INFOQ_FRONTEND_TARGET` 对应的前端容器与目录；MySQL、Redis、MinIO 的选择是独立的；配置目录与空的 `${INFOQ_DEPLOY_ROOT}` 是独立确认项；脚本不删除 Docker 镜像。

## 8. 部署后 smoke 验证

部署完成后，至少执行以下 smoke。代理环境中访问本机地址时必须加 `--noproxy '*'`，避免 localhost 请求被系统代理转发后得到伪 502。

```bash
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'

export INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env
set -a
. "${INFOQ_ENV_FILE}"
set +a

curl --noproxy '*' -i --max-time 15 http://127.0.0.1:9090/monitor/health/readiness
curl --noproxy '*' -i --max-time 15 http://127.0.0.1/prod-api/monitor/health/readiness

if [[ "${INFOQ_FRONTEND_TARGET}" == "all" ]]; then
  curl --noproxy '*' -sS -o /dev/null -w '%{http_code}\n' --max-time 15 http://127.0.0.1/vue/
  curl --noproxy '*' -sS -o /dev/null -w '%{http_code}\n' --max-time 15 http://127.0.0.1/react/
else
  curl --noproxy '*' -sS -o /dev/null -w '%{http_code}\n' --max-time 15 http://127.0.0.1/
fi
curl --noproxy '*' -sS -o /dev/null -w '%{http_code}\n' --max-time 15 http://127.0.0.1/console-oss/
curl --noproxy '*' -i --max-time 15 http://127.0.0.1/oss/minio/health/live

case "${INFOQ_FRONTEND_TARGET}" in
  all)
    curl --noproxy '*' -sS -o /dev/null -w '%{http_code}\n' --max-time 15 http://127.0.0.1:9091/
    curl --noproxy '*' -sS -o /dev/null -w '%{http_code}\n' --max-time 15 http://127.0.0.1:9092/
    ;;
  vue)
    curl --noproxy '*' -sS -o /dev/null -w '%{http_code}\n' --max-time 15 http://127.0.0.1:9091/
    ;;
  react)
    curl --noproxy '*' -sS -o /dev/null -w '%{http_code}\n' --max-time 15 http://127.0.0.1:9092/
    ;;
esac

curl --noproxy '*' -i --max-time 15 http://127.0.0.1:9000/minio/health/live

docker exec mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -Nse 'SELECT COUNT(*) FROM infoq.sys_menu;'
docker exec mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -Nse "SELECT COUNT(*) FROM infoq.sys_oss_config WHERE config_key IN ('minio','image') AND access_key='${MINIO_ROOT_USER}' AND secret_key='${MINIO_ROOT_PASSWORD}' AND bucket_name='${INFOQ_OSS_BUCKET}' AND endpoint='minio:9000' AND domain='${INFOQ_PUBLIC_BASE_URL}/oss' AND is_https=IF(LEFT('${INFOQ_PUBLIC_BASE_URL}', 6)='https:', 'Y', 'N');"
docker exec mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -Nse "SELECT COUNT(*) FROM infoq.sys_user WHERE user_id=1 AND user_name='${INFOQ_ADMIN_USERNAME}' AND status='0' AND del_flag='0';"
docker exec redis redis-cli -a "${REDIS_PASSWORD}" ping
```

期望结果：

- `infoq-admin` 容器为 `healthy`，readiness 返回 `200`。
- `/prod-api/monitor/health/readiness` 通过 Nginx 也返回 `200`。
- `INFOQ_FRONTEND_TARGET=all` 时 `/vue/`、`/react/` 通过网关返回 `200` 或 `304`；单前端目标时 `/` 返回 `200` 或 `304`。
- `/console-oss/` 可访问 MinIO Console，`/oss/minio/health/live` 返回 `200`。
- `all` 目标时 `9091`、`9092` 两个直连端口有响应；单前端目标时仅对应直连端口有响应。
- MinIO live health 返回 `200`。
- MySQL 能查到初始化菜单数据。
- `sys_oss_config` 同步计数返回 `2`，表示 `minio` 和 `image` 的 MinIO 凭据与 `deploy.env` 一致。
- 管理员同步计数返回 `1`，表示 `sys_user.user_id=1` 的用户名是安装脚本生成的管理员账号。
- Redis 返回 `PONG`。

如果从 Windows 浏览器访问 WSL2 部署，还可以在 Windows PowerShell 验证：

```powershell
curl.exe --noproxy * -sS -o NUL -w "%{http_code}\n" --max-time 15 http://localhost/vue/
curl.exe --noproxy * -sS -o NUL -w "%{http_code}\n" --max-time 15 http://localhost/react/
curl.exe --noproxy * -i --max-time 15 http://localhost/prod-api/monitor/health/readiness
curl.exe --noproxy * -sS -o NUL -w "%{http_code}\n" --max-time 15 http://localhost/console-oss/
```

## 9. 日志、状态与重建

查看后端和依赖服务：

```bash
bash deploy/bin/infoq.sh status
bash deploy/bin/infoq.sh logs infoq-admin
```

查看前端和 Nginx：

```bash
bash deploy/bin/deploy-frontend.sh status "${INFOQ_FRONTEND_TARGET}"
bash deploy/bin/deploy-frontend.sh logs all
```

macOS Colima 把 `INFOQ_DEPLOY_ROOT` 改成 `$HOME/infoq`。排查时建议把关键输出保存到 `tmp/`，例如：

```bash
mkdir -p tmp/deploy-verify
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' > tmp/deploy-verify/docker-ps.log
```

升级镜像或配置后的重建，例如升级 MinIO、Nginx 或前端运行时镜像后，优先继续使用仓库脚本重建。脚本会读取 `INFOQ_FRONTEND_TARGET`，只重建并启动当前目标前端：

```bash
bash deploy/bin/deploy-frontend.sh deploy "${INFOQ_FRONTEND_TARGET}"
```

如果同时升级 MinIO 镜像，可单独受控重建 MinIO，再重新执行前端脚本刷新 nginx upstream：

```bash
docker compose -f deploy/docker/docker-compose.yml up -d --no-deps --force-recreate minio
bash deploy/bin/deploy-frontend.sh deploy "${INFOQ_FRONTEND_TARGET}"
```

重建后重新执行第 8 节 smoke。对 MySQL、Redis、MinIO 数据目录的删除或迁移都属于高风险操作，必须先备份并确认。

## 10. 可选 MQTT / Elasticsearch：单节点与三节点集群部署

MQTT 与 Elasticsearch 不是基础部署的必选项。`deploy/docker/docker-compose.yml`、`deploy/install.sh`、`deploy/bin/infoq.sh deploy` 与 `deploy/bin/deploy-frontend.sh deploy` 均不会合并或启动它们。只有运维显式调用 `deploy/bin/deploy-middleware.sh` 选择组件与拓扑时，才会使用对应 production overlay。

生产编排与本地/CI 测试严格分离：

| 场景 | MQTT | Elasticsearch | 是否包含工具 / 测试材料 |
| --- | --- | --- | --- |
| 单节点生产 | `docker-compose.mqtt.yml` | `docker-compose.elasticsearch.yml` | 否，仅实际节点 |
| 三节点集群生产 | `docker-compose.mqtt-cluster.yml` | `docker-compose.elasticsearch-cluster.yml` | 否，仅实际节点 |
| 本地 / CI 集成测试 | `docker-compose.mqtt-it.yml` | `docker-compose.elasticsearch-it.yml` | 是，且仅限测试 |

所有 production overlay 只使用实际的 `emqx/emqx:5.8.9` 或 `docker.elastic.co/elasticsearch/elasticsearch:8.18.8` 服务；它们不包含 `mqtt-tools`、`elasticsearch-tools`、自签证书生成、测试账户、测试 ACL、测试 Topic/索引、`MIDDLEWARE_*` 变量或 Maven verifier。

### 10.1 生产环境变量与外置材料

必须从受保护的 `${INFOQ_ENV_FILE}`（通常是 `/etc/infoq-scaffold-ai/deploy.env`，权限 `600`）加载基础 Compose 已有变量，并按所选组件提供以下变量。缺失时选择脚本或 Compose 会明确失败。

```text
# MQTT single 或 cluster
INFOQ_DEPLOY_ROOT
MQTT_NODE_COOKIE
MQTT_ADMIN_USERNAME
MQTT_ADMIN_PASSWORD

# Elasticsearch single 或 cluster
INFOQ_DEPLOY_ROOT
ES_BOOTSTRAP_PASSWORD
```

生产安全材料由运维/组织 PKI 提供，不能复用 `tmp/`、`${INFOQ_DEPLOY_ROOT}/mqtt-it/` 或 `${INFOQ_DEPLOY_ROOT}/elasticsearch-it/` 的测试 run 材料。私钥应只允许最小必要的容器用户读取；ES 数据目录必须允许容器用户 `1000:0` 写入。选择脚本只会在 root 身份下创建缺失数据目录并设置为 `1000:0`、`0750`；非 root 必须由运维先创建，已有目录绝不自动修改 owner 或权限。脚本绝不生成证书、账户、ACL 或私钥。

单节点所需路径：`${INFOQ_DEPLOY_ROOT}/mqtt/certs/{ca,tls}.crt`、`tls.key`、`data`，以及 `${INFOQ_DEPLOY_ROOT}/elasticsearch/certs/{ca,tls}.crt`、`tls.key`、`data`。

三节点 cluster 所需路径：`${INFOQ_DEPLOY_ROOT}/mqtt/certs/` 下逐节点 `mqtt-broker-{1,2,3}/tls.{crt,key}` 与 `data/mqtt-broker-{1,2,3}`；`${INFOQ_DEPLOY_ROOT}/elasticsearch/certs/` 下逐节点 `es0{1,2,3}/tls.{crt,key}` 与 `data/es0{1,2,3}`。

MQTT 生产基线配置在 [`deploy/docker/mqtt/production/base.hocon`](../deploy/docker/mqtt/production/base.hocon)：它只启用 TLS `8883`、关闭明文 `1883`、启用 built-in database 认证并默认拒绝未匹配授权。上线前必须通过受控运维流程创建业务账户与最小权限 ACL。

### 10.2 拓扑选择脚本

唯一受支持的选择入口为：

```bash
bash deploy/bin/deploy-middleware.sh <mqtt|elasticsearch> <single|cluster> <prepare|config|deploy|bootstrap|status|stop>
```

`prepare` 只创建缺失数据目录；`config` 只校验并渲染；`deploy` 只启动所选节点；`status` 和 `stop` 也只作用于所选节点，`stop` 不使用 `down -v`；`bootstrap` 仅允许 `elasticsearch cluster` 的首次建群使用。

先加载环境文件，再执行，例如单节点：

```bash
bash deploy/bin/deploy-middleware.sh mqtt single prepare
bash deploy/bin/deploy-middleware.sh mqtt single config
bash deploy/bin/deploy-middleware.sh mqtt single deploy

bash deploy/bin/deploy-middleware.sh elasticsearch single prepare
bash deploy/bin/deploy-middleware.sh elasticsearch single config
bash deploy/bin/deploy-middleware.sh elasticsearch single deploy
```

三节点 cluster：

```bash
# MQTT：三个 EMQX Community 节点以 static discovery 组成集群。
bash deploy/bin/deploy-middleware.sh mqtt cluster prepare
bash deploy/bin/deploy-middleware.sh mqtt cluster config
bash deploy/bin/deploy-middleware.sh mqtt cluster deploy

# Elasticsearch：首次建群仅使用一次 bootstrap；之后的启动、重启或扩容前检查必须使用 deploy。
bash deploy/bin/deploy-middleware.sh elasticsearch cluster prepare
bash deploy/bin/deploy-middleware.sh elasticsearch cluster config
bash deploy/bin/deploy-middleware.sh elasticsearch cluster bootstrap
```

### 10.3 三节点 cluster 的安全与运行边界

MQTT cluster 固定为 `mqtt-broker-1`、`mqtt-broker-2`、`mqtt-broker-3`，并在 Compose 网络中分别使用 FQDN 别名作为 EMQX Erlang 节点名和静态发现地址。三个节点使用同一个 `MQTT_NODE_COOKIE`、TLS-only `8883`、独立数据目录和逐节点证书。每张节点证书的 SAN 至少应包含对应的 FQDN 别名；默认只把节点一的 TLS listener 发布到 `127.0.0.1:8883`，节点二、三只在 Compose 网络内通信。

Elasticsearch cluster 固定为 `es01`、`es02`、`es03`：启用认证、HTTP TLS、transport TLS、节点发现和独立数据目录/证书，默认仅把 `es01` 的 HTTP endpoint 发布到 `127.0.0.1:9200`。逐节点证书 SAN 必须包含节点服务名。生产应用必须使用受控创建的业务 role/user，不能使用 `elastic` bootstrap 用户。

首次执行 `elasticsearch cluster bootstrap` 时，脚本要求三个数据目录均为空；任一目录已有内容时脚本会明确拒绝并提示使用 `deploy`。ES 部署/首次 bootstrap 还会检查 Linux `vm.max_map_count` 至少为 `262144`；该内核参数由运维在宿主机修复，脚本不会修改它。

这套三节点编排运行在**同一个 Docker Compose 主机**上，能提供三节点发现、持久化和 TLS/认证拓扑验证，但不能替代跨物理主机、跨可用区或跨故障域的高可用。停止时只使用选择脚本的目标 `stop` 操作；不使用 `down -v`，不删除数据目录或 Docker volume。

## 11. 直接使用 Docker Compose CLI

常规部署不要直接用 `docker compose up --build` 替代仓库脚本。只有在排查 Compose 本身问题时才直接调用 Docker Compose CLI。直接调用前必须加载安装脚本生成的环境文件：

```bash
export INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env
set -a
. "${INFOQ_ENV_FILE}"
set +a
docker compose -f deploy/docker/docker-compose.yml ps
docker compose -f deploy/docker/docker-compose.yml logs -f infoq-admin
```

如果当前环境只有 standalone CLI，则使用等价的 `docker-compose -f deploy/docker/docker-compose.yml ...`。直接使用 Docker Compose CLI 时，建议保证 `${INFOQ_DEPLOY_ROOT}/mysql/data` 为空目录，以便 MySQL 首次启动时自动执行 `sql/` 目录内的基础 SQL 与当前增量 SQL。

## 12. 镜像 tag 收口与 credential helper 排查

有时网络不稳定，短名镜像拉取失败，需要临时直拉完整 registry tag：

```bash
docker pull registry-1.docker.io/library/nginx:1.30.3
docker tag registry-1.docker.io/library/nginx:1.30.3 nginx:1.30.3
```

如果两个 tag 的 `IMAGE ID` 一致，且没有容器引用完整 registry tag，可以只保留仓库 Dockerfile / Compose 使用的短名：

```bash
docker image inspect nginx:1.30.3 --format '{{.Id}}'
docker image inspect registry-1.docker.io/library/nginx:1.30.3 --format '{{.Id}}'
docker ps -a --format '{{.Image}}' | grep -Fx registry-1.docker.io/library/nginx:1.30.3
docker rmi registry-1.docker.io/library/nginx:1.30.3
```

同样适用于 `bellsoft/liberica-openjdk-rocky:21.0.12-cds`、`node:24.18.0`、`nginx:1.30.3`。原则：Dockerfile 和 Compose 引用短名时保留短名；完整 `registry-1.docker.io/...` 只作为辅助拉取 tag；删除辅助 tag 前必须确认 `IMAGE ID` 一致且没有容器正在引用它。

Docker credential helper 排查见第 2.2 节：macOS Colima 环境如果曾安装或卸载 Docker Desktop，`~/.docker/config.json` 可能残留 `credsStore` 或 `credHelpers` 指向 `desktop`，导致拉取 public image 失败。部署脚本会在 `deploy` / `build` 路径进入镜像拉取或构建前检查 Docker credential helper 是否存在；`status`、`stop`、`logs` 等不拉取镜像的命令不会因该检查被拦截。

## 13. 排障经验

本仓库的 Compose 部署在 WSL2 Debian 中已经验证过完整链路。以下经验应作为后续部署排障优先检查项：

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| shell 报 `pipefail` 或类似错误 | `.sh` 文件是 CRLF | 脚本保持 LF，并用 `.gitattributes` 固化 `*.sh text eol=lf` |
| MySQL 初始化或私钥权限异常 | 数据目录放在 `/mnt/c` 等 DrvFS 路径 | 数据目录使用 `/infoq` 等 Linux 文件系统路径 |
| `curl 127.0.0.1` 得到代理 502 | localhost 请求被 HTTP proxy 拦截 | 使用 `curl --noproxy '*'` |
| `error getting credentials` 且缺少 `docker-credential-desktop` | Docker config 残留 Docker Desktop credential helper | Colima 验证时临时设置独立 `DOCKER_CONFIG` 和 `DOCKER_HOST`；长期清理失效的 `credsStore`/`credHelpers` 或安装匹配 helper |
| 镜像列表出现短名和 `registry-1.docker.io/...` 双 tag | 直拉完整 tag 后又 tag 回短名 | 确认 `IMAGE ID` 一致且无容器引用长名后删除辅助 tag |
| 前端构建出现 Corepack/packageManager 激活失败 | Node 镜像内 Corepack 或包管理器激活异常 | 先确认 Dockerfile 使用固定 `node:24.18.0`，再按工作区 `packageManager` 与 lockfile 定位；不要降回 Node 20/22 标记通过 |
| React 在 `/react/` 下请求 `/logo.svg` 404 | 静态资源使用了根路径 | 使用 `VITE_APP_CONTEXT_PATH` 生成 `/react/logo.svg` |
| WSL 容器反复重启 | WSL distro 退出导致 Docker daemon 生命周期不稳定 | 部署验证期保持一个 WSL 会话或 keepalive |

当前 Compose 部署不依赖宿主机 JDK/Maven；后端 Dockerfile 使用 Temurin 21 builder 与 Liberica 21 runtime 镜像。只有手动部署或本机直接 Maven 构建时，才需要在宿主机准备 JDK 21 与 Maven 3.9+。

## 14. 生产化前的最小检查

本教程主要验证脚本和本地 Compose 栈。进入生产或准生产环境前，至少再确认：

- 已替换默认数据库密码、Redis 密码、MinIO 密钥、`SECURITY_TOKEN_SECRET` 和 RSA 私钥。
- `DEPLOY_ID` 在同一批后端节点中一致，并且新批次发布会换新值。
- MySQL 数据有备份和回滚点。
- Nginx HTTPS 证书、域名、安全组和防火墙策略已准备。
- `/monitor/health/readiness` 作为接流量门禁，DB 或 Redis 不可用时能返回失败。
- 滚动更新顺序明确：先摘流量，再停旧节点，新节点 readiness 通过后再接流量。
- 前端 `VITE_APP_CONTEXT_PATH`、`VITE_APP_BASE_API`、加密开关和 RSA key 与后端匹配。

完整发布前验收清单见 [README.md](README.md) 第 8 节。如果以上任一项不明确，不建议直接把本文件命令用于生产上线。
