---
title: "Docker Compose 部署教程"
description: "覆盖 WSL2 Docker CE、macOS Colima、Linux Docker CE 的完整部署教程。"
outline: [2, 3]
---

> [!TIP]
> 内容真值源：[`doc/devops/docker-compose-tutorial.md`](https://github.com/luckykuang/infoq-scaffold-ai/blob/main/doc/devops/docker-compose-tutorial.md)
> 本页由 `infoq-scaffold-docs/scripts/sync-from-root-doc.mjs` 自动同步生成；请优先修改根 `doc/` 后再重新同步。

# Docker Compose 部署教程

本文是一份面向框架使用者的完整教程，用于在全新环境中用仓库脚本拉起后端、MySQL、Redis、MinIO、Vue 管理端、React 管理端、React Pro 管理端和 Nginx 网关。

默认只覆盖三类免费商用容器运行时：

| 场景 | 默认运行时 | 部署根目录 |
| --- | --- | --- |
| Windows + WSL2 Debian / Ubuntu | WSL2 子系统内的 Docker CE / Moby Engine | `/infoq` |
| macOS | Colima + Docker runtime + Docker CLI / Compose | `$HOME/infoq` |
| 原生 Linux 服务器 | Docker CE / Moby Engine | `/infoq` |

本文不把 Docker Desktop 作为默认教程路径，也不默认支持 Rancher Desktop、Podman、OrbStack 等其他运行时。许可边界请以你所在组织的当前政策和运行时安装来源为准；本教程的默认策略是避开商业桌面 GUI 和许可不明确的容器运行时。

## 1. 教程目标

完成后，你应该能访问：

```text
http://localhost/vue/
http://localhost/react/
http://localhost/react-pro/
http://localhost/prod-api/monitor/health/readiness
http://localhost/console-oss/
http://localhost/oss/
```

同时，直连端口应可用：

```text
Backend:   9090
Vue:       9091
React:     9092
React Pro: 9093
MinIO API: 9000
MinIO Console: 9001
MySQL:     3306
Redis:     6379
Nginx:     80 / 443
```

首次安装优先使用一键安装脚本。脚本会生成 MySQL、Redis、MinIO、后端安全密钥和默认管理员账号密码，保存到 `/etc/infoq-scaffold-ai/deploy.env` 与 `/etc/infoq-scaffold-ai/credentials.txt`，并在部署完成后打印访问地址和凭据：

```bash
curl -sSL https://raw.githubusercontent.com/LuckyKuang/infoq-scaffold-ai/main/deploy/install.sh | sudo bash
```

生产或准生产环境建议固定 tag 后执行：

```bash
curl -fsSLO https://raw.githubusercontent.com/LuckyKuang/infoq-scaffold-ai/<tag>/deploy/install.sh
chmod +x install.sh
sudo env INFOQ_VERSION=<tag> INFOQ_PUBLIC_BASE_URL=http://SERVER_IP ./install.sh
```

如果你已经有本地源码，并且只是本机验证脚本，可使用本地源码入口：

```bash
sudo env INFOQ_SOURCE_DIR="$(pwd)" INFOQ_PUBLIC_BASE_URL=http://127.0.0.1 INFOQ_DEPLOY_ROOT=/infoq bash deploy/install.sh
```

安装脚本内部会调用仓库部署脚本：

```bash
bash script/bin/infoq.sh deploy
bash script/bin/deploy-frontend.sh deploy
```

除非正在排查脚本问题，否则不要用手写 `docker compose up --build` 替代脚本主流程。脚本会处理目录准备、配置模板、SQL 初始化校验、后端构建、前端顺序构建、Nginx 配置同步和容器启动。

## 2. 先确认运行时

进入服务器或目标 shell 后，先执行只读探测：

```bash
uname -s
uname -r
docker version
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

如果从 Windows PowerShell 侧执行 WSL 命令，仓库路径通常是：

```text
C:\DevTools\code\github\infoq-scaffold-ai
```

在 WSL 内对应：

```text
/mnt/c/DevTools/code/github/infoq-scaffold-ai
```

代码可以在 `/mnt/c/...` 下构建验证，但 Docker 持久化数据建议放在 WSL Linux 文件系统的 `/infoq` 下。

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
export INFOQ_TEMP_DOCKER_CONFIG="$(pwd)/doc/tmp/infoq-deploy-verify/docker-config"
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

也就是必须存在：

```text
/tmp/infoq-deploy
/infoq/server/temp
```

macOS Colima 默认：

```bash
export INFOQ_DEPLOY_ROOT="${HOME}/infoq"
mkdir -p /tmp/infoq-deploy "${INFOQ_DEPLOY_ROOT}/server/temp"
```

也就是必须存在：

```text
/tmp/infoq-deploy
$HOME/infoq/server/temp
```

如果当前账号没有权限创建 `/infoq/server/temp`，先让服务器管理员创建并授权，不要跳过这个步骤继续部署。

脚本后续还会补齐其他目录，例如 MySQL、Redis、MinIO、Nginx、前端日志和后端配置目录。完整目录清单见 [Docker Compose 部署说明](/devops/docker-compose-deploy)。

## 4. 部署环境文件

WSL2 / 原生 Linux：

```bash
cd /path/to/infoq-scaffold-ai
export INFOQ_DEPLOY_ROOT=/infoq
sudo env INFOQ_SOURCE_DIR="$(pwd)" INFOQ_PUBLIC_BASE_URL=http://SERVER_IP INFOQ_DEPLOY_ROOT="${INFOQ_DEPLOY_ROOT}" bash deploy/install.sh
```

macOS Colima：

```bash
cd /path/to/infoq-scaffold-ai
export INFOQ_DEPLOY_ROOT="${HOME}/infoq"
export DOCKER_HOST="unix://${HOME}/.colima/default/docker.sock"
sudo env DOCKER_CONFIG="${DOCKER_CONFIG:-$HOME/.docker}" DOCKER_HOST="${DOCKER_HOST}" INFOQ_SOURCE_DIR="$(pwd)" INFOQ_PUBLIC_BASE_URL=http://127.0.0.1 INFOQ_DEPLOY_ROOT="${INFOQ_DEPLOY_ROOT}" bash deploy/install.sh
```

安装脚本会创建或复用：

```text
/etc/infoq-scaffold-ai/deploy.env
/etc/infoq-scaffold-ai/credentials.txt
```

两个文件权限必须是 `600`。重复执行安装脚本会复用已有 `deploy.env`，不会静默轮换 MySQL、Redis、MinIO 或管理员凭据。如果 `${INFOQ_DEPLOY_ROOT}/mysql/data` 已有数据但 `deploy.env` 缺失，脚本会停止，避免生成新密码后无法连接旧数据。

如果需要直接调用底层脚本，先加载同一个环境文件：

```bash
export INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env
set -a
. "${INFOQ_ENV_FILE}"
set +a
```

生产或准生产发布可以在首次安装前显式指定 `INFOQ_PUBLIC_BASE_URL`、`INFOQ_DEPLOY_ROOT`、`INFOQ_VERSION` 和 `INFOQ_OSS_BUCKET`。不设置 `DEPLOY_ID` 时，安装脚本会生成并持久化当前批次号。同一批滚动发布的所有后端节点必须使用同一个 `DEPLOY_ID`；同一版本再次发布时应换新值。

## 5. WSL2 一键部署示例

如果从 Windows PowerShell 调用 WSL2 Debian：

```powershell
wsl.exe -d Debian -- bash -lc 'cd /mnt/c/DevTools/code/github/infoq-scaffold-ai && export INFOQ_DEPLOY_ROOT=/infoq && mkdir -p /tmp/infoq-deploy "${INFOQ_DEPLOY_ROOT}/server/temp" && sudo env INFOQ_SOURCE_DIR="$(pwd)" INFOQ_PUBLIC_BASE_URL=http://127.0.0.1 INFOQ_DEPLOY_ROOT="${INFOQ_DEPLOY_ROOT}" bash deploy/install.sh'
```

如果已经在 WSL shell 内：

```bash
cd /mnt/c/DevTools/code/github/infoq-scaffold-ai
export INFOQ_DEPLOY_ROOT=/infoq
mkdir -p /tmp/infoq-deploy "${INFOQ_DEPLOY_ROOT}/server/temp"
sudo env INFOQ_SOURCE_DIR="$(pwd)" INFOQ_PUBLIC_BASE_URL=http://127.0.0.1 INFOQ_DEPLOY_ROOT="${INFOQ_DEPLOY_ROOT}" bash deploy/install.sh
```

如果 WSL distro 容易自动退出，可以先临时保持一个 WSL 会话：

```bash
nohup bash -c 'while true; do sleep 3600; done' >/tmp/infoq-wsl-keepalive.log 2>&1 &
```

## 6. macOS Colima 部署示例

```bash
cd /path/to/infoq-scaffold-ai
colima status || colima start --runtime docker --cpu 4 --memory 8 --disk 80
docker context use colima
export INFOQ_DEPLOY_ROOT="${HOME}/infoq"
export DOCKER_HOST="unix://${HOME}/.colima/default/docker.sock"
mkdir -p /tmp/infoq-deploy "${INFOQ_DEPLOY_ROOT}/server/temp"
sudo env DOCKER_CONFIG="${DOCKER_CONFIG:-$HOME/.docker}" DOCKER_HOST="${DOCKER_HOST}" INFOQ_SOURCE_DIR="$(pwd)" INFOQ_PUBLIC_BASE_URL=http://127.0.0.1 INFOQ_DEPLOY_ROOT="${INFOQ_DEPLOY_ROOT}" bash deploy/install.sh
```

Colima 的 CPU、内存和磁盘参数按机器资源调整。首次构建三个前端镜像和后端镜像会占用较多 CPU、内存和磁盘空间，资源太小容易出现构建中断。

## 7. 原生 Linux 部署示例

```bash
cd /path/to/infoq-scaffold-ai
export INFOQ_DEPLOY_ROOT=/infoq
mkdir -p /tmp/infoq-deploy "${INFOQ_DEPLOY_ROOT}/server/temp"
sudo env INFOQ_SOURCE_DIR="$(pwd)" INFOQ_PUBLIC_BASE_URL=http://SERVER_IP INFOQ_DEPLOY_ROOT="${INFOQ_DEPLOY_ROOT}" bash deploy/install.sh
```

如果是远程服务器，部署前还要确认安全组、防火墙、反向代理和域名证书策略。默认教程只证明本机 `localhost` 和容器内服务链路，不代替生产发布评审。

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

curl --noproxy '*' -I --max-time 15 http://127.0.0.1/vue/
curl --noproxy '*' -I --max-time 15 http://127.0.0.1/react/
curl --noproxy '*' -I --max-time 15 http://127.0.0.1/react-pro/
curl --noproxy '*' -I --max-time 15 http://127.0.0.1/console-oss/
curl --noproxy '*' -i --max-time 15 http://127.0.0.1/oss/minio/health/live

curl --noproxy '*' -I --max-time 15 http://127.0.0.1:9091/
curl --noproxy '*' -I --max-time 15 http://127.0.0.1:9092/
curl --noproxy '*' -I --max-time 15 http://127.0.0.1:9093/

curl --noproxy '*' -i --max-time 15 http://127.0.0.1:9000/minio/health/live

docker exec mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -Nse 'SELECT COUNT(*) FROM infoq.sys_menu;'
docker exec mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -Nse "SELECT COUNT(*) FROM infoq.sys_oss_config WHERE config_key IN ('minio','image') AND access_key='${MINIO_ROOT_USER}' AND secret_key='${MINIO_ROOT_PASSWORD}' AND bucket_name='${INFOQ_OSS_BUCKET}' AND endpoint='minio:9000' AND domain='${INFOQ_PUBLIC_BASE_URL}/oss' AND is_https=IF(LEFT('${INFOQ_PUBLIC_BASE_URL}', 6)='https:', 'Y', 'N');"
docker exec mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -Nse "SELECT COUNT(*) FROM infoq.sys_user WHERE user_id=1 AND user_name='${INFOQ_ADMIN_USERNAME}' AND status='0' AND del_flag='0';"
docker exec redis redis-cli -a "${REDIS_PASSWORD}" ping
```

期望结果：

- `infoq-admin` 容器为 `healthy`，readiness 返回 `200`。
- `/prod-api/monitor/health/readiness` 通过 Nginx 也返回 `200`。
- `/vue/`、`/react/`、`/react-pro/` 通过网关返回 `200` 或 `304`。
- `/console-oss/` 可访问 MinIO Console，`/oss/minio/health/live` 返回 `200`。
- `9091`、`9092`、`9093` 三个直连端口有响应。
- MinIO live health 返回 `200`。
- MySQL 能查到初始化菜单数据。
- `sys_oss_config` 同步计数返回 `2`，表示 `minio` 和 `image` 的 MinIO 凭据与 `deploy.env` 一致。
- 管理员同步计数返回 `1`，表示 `sys_user.user_id=1` 的用户名是安装脚本生成的管理员账号。
- Redis 返回 `PONG`。

如果从 Windows 浏览器访问 WSL2 部署，还可以在 Windows PowerShell 验证：

```powershell
curl.exe --noproxy * -I --max-time 15 http://localhost/vue/
curl.exe --noproxy * -I --max-time 15 http://localhost/react/
curl.exe --noproxy * -I --max-time 15 http://localhost/react-pro/
curl.exe --noproxy * -i --max-time 15 http://localhost/prod-api/monitor/health/readiness
curl.exe --noproxy * -I --max-time 15 http://localhost/console-oss/
```

## 9. 日志与状态查看

查看后端和依赖服务：

```bash
export INFOQ_DEPLOY_ROOT=/infoq
export INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env
bash script/bin/infoq.sh status
bash script/bin/infoq.sh logs infoq-admin
```

查看前端和 Nginx：

```bash
export INFOQ_DEPLOY_ROOT=/infoq
export INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env
bash script/bin/deploy-frontend.sh status
bash script/bin/deploy-frontend.sh logs all
```

macOS Colima 把 `INFOQ_DEPLOY_ROOT` 改成 `$HOME/infoq`：

```bash
export INFOQ_DEPLOY_ROOT="${HOME}/infoq"
```

排查时建议把关键输出保存到 `doc/tmp/`，例如：

```bash
mkdir -p doc/tmp/infoq-deploy-verify
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' > doc/tmp/infoq-deploy-verify/docker-ps.log
```

## 10. 停止本地部署栈

停止顺序建议先前端和网关，再后端和基础服务：

```bash
cd /path/to/infoq-scaffold-ai
export INFOQ_DEPLOY_ROOT=/infoq
export INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env
bash script/bin/deploy-frontend.sh stop
bash script/bin/infoq.sh stop
```

macOS Colima：

```bash
export INFOQ_DEPLOY_ROOT="${HOME}/infoq"
```

停止命令不会主动删除 `${INFOQ_DEPLOY_ROOT}` 下的数据目录。不要为了“重新部署”直接删除 `/infoq`、`$HOME/infoq`、Docker volume 或 MySQL 数据，除非已经确认备份和回滚策略。

## 11. 升级镜像或配置后的重建

例如升级 MinIO、Nginx 或前端运行时镜像后，建议用 Compose 的受控重建替换旧容器：

```bash
cd /path/to/infoq-scaffold-ai
export INFOQ_DEPLOY_ROOT=/infoq
export INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env
set -a
. "${INFOQ_ENV_FILE}"
set +a

docker compose -f script/docker/docker-compose.yml build infoq-frontend-vue infoq-frontend-react infoq-frontend-react-pro
docker compose -f script/docker/docker-compose.yml up -d --no-deps --force-recreate --remove-orphans minio infoq-frontend-vue infoq-frontend-react infoq-frontend-react-pro nginx-web
```

如果当前环境只有 standalone Compose：

```bash
docker-compose -f script/docker/docker-compose.yml build infoq-frontend-vue infoq-frontend-react infoq-frontend-react-pro
docker-compose -f script/docker/docker-compose.yml up -d --no-deps --force-recreate --remove-orphans minio infoq-frontend-vue infoq-frontend-react infoq-frontend-react-pro nginx-web
```

重建后重新执行第 8 节 smoke。对 MySQL、Redis、MinIO 数据目录的删除或迁移都属于高风险操作，必须先备份并确认。

## 12. 镜像 tag 收口

有时网络不稳定，短名镜像拉取失败，需要临时直拉完整 registry tag，例如：

```bash
docker pull registry-1.docker.io/library/nginx:1.30.3
docker tag registry-1.docker.io/library/nginx:1.30.3 nginx:1.30.3
```

这会让本机镜像列表同时出现：

```text
nginx:1.30.3
registry-1.docker.io/library/nginx:1.30.3
```

如果两个 tag 的 `IMAGE ID` 一致，且没有容器引用完整 registry tag，可以只保留仓库 Dockerfile / Compose 使用的短名：

```bash
docker image inspect nginx:1.30.3 --format '{{.Id}}'
docker image inspect registry-1.docker.io/library/nginx:1.30.3 --format '{{.Id}}'
docker ps -a --format '{{.Image}}' | grep -Fx registry-1.docker.io/library/nginx:1.30.3
docker rmi registry-1.docker.io/library/nginx:1.30.3
```

同样适用于：

```text
bellsoft/liberica-openjdk-rocky:17.0.16-cds
node:24.18.0
nginx:1.30.3
```

原则是：

- Dockerfile 和 Compose 引用短名时，保留短名。
- 完整 `registry-1.docker.io/...` 只作为辅助拉取 tag。
- 删除辅助 tag 前必须确认 `IMAGE ID` 一致。
- 删除辅助 tag 前必须确认没有容器正在引用它。

## 13. 本次 WSL2 验证沉淀的经验

本仓库的 Compose 部署在 WSL2 Debian 中已经验证过完整链路。以下经验应作为后续部署排障优先检查项：

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| shell 报 `pipefail\r` 或类似错误 | `.sh` 文件是 CRLF | 脚本保持 LF，并用 `.gitattributes` 固化 `*.sh text eol=lf` |
| MySQL 初始化或私钥权限异常 | 数据目录放在 `/mnt/c` 等 DrvFS 路径 | 数据目录使用 `/infoq` 等 Linux 文件系统路径 |
| `curl 127.0.0.1` 得到代理 502 | localhost 请求被 HTTP proxy 拦截 | 使用 `curl --noproxy '*'` |
| `error getting credentials` 且缺少 `docker-credential-desktop` | Docker config 残留 Docker Desktop credential helper | Colima 验证时临时设置独立 `DOCKER_CONFIG` 和 `DOCKER_HOST`；长期清理失效的 `credsStore`/`credHelpers` 或安装匹配 helper |
| 镜像列表出现短名和 `registry-1.docker.io/...` 双 tag | 直拉完整 tag 后又 tag 回短名 | 确认 `IMAGE ID` 一致且无容器引用长名后删除辅助 tag |
| 前端构建出现 Corepack/packageManager 激活失败 | Node 镜像内 Corepack 或包管理器激活异常 | 先确认 Dockerfile 使用固定 `node:24.18.0`，再按工作区 `packageManager` 与 lockfile 定位；不要降回 Node 20/22 标记通过 |
| React Pro 在 `/react-pro/` 下请求 `/logo.svg` 404 | 静态资源使用了根路径 | 使用 `VITE_APP_CONTEXT_PATH` 生成 `/react-pro/logo.svg` |
| WSL 容器反复重启 | WSL distro 退出导致 Docker daemon 生命周期不稳定 | 部署验证期保持一个 WSL 会话或 keepalive |
| Debian 源找不到 `openjdk-17-jdk` | 发行版 apt 源未提供 JDK 17 | 先按当前发行版支持方式安装 JDK 17；不要切换项目 Java 基线 |

当前项目基线只有 JDK 17；部署文档、Dockerfile 和构建环境都应以 JDK 17 为准。

## 14. 生产化前的最小检查

本教程主要验证脚本和本地 Compose 栈。进入生产或准生产环境前，至少再确认：

- 已替换默认数据库密码、Redis 密码、MinIO 密钥、`SECURITY_TOKEN_SECRET` 和 RSA 私钥。
- `DEPLOY_ID` 在同一批后端节点中一致，并且新批次发布会换新值。
- MySQL 数据有备份和回滚点。
- Nginx HTTPS 证书、域名、安全组和防火墙策略已准备。
- `/monitor/health/readiness` 作为接流量门禁，DB 或 Redis 不可用时能返回失败。
- 滚动更新顺序明确：先摘流量，再停旧节点，新节点 readiness 通过后再接流量。
- 前端 `VITE_APP_CONTEXT_PATH`、`VITE_APP_BASE_API`、加密开关和 RSA key 与后端匹配。

如果以上任一项不明确，不建议直接把本教程命令用于生产上线。
