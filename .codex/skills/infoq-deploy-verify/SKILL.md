---
name: infoq-deploy-verify
description: 在本仓库执行可复现的本地、WSL2、macOS 或 Linux Docker Compose 部署验证，覆盖免费商用容器运行时基线：WSL2 内 Docker CE、macOS Colima、原生 Linux Docker CE，以及 Docker MySQL/Redis/MinIO、后端 script/bin/infoq.sh、前端 script/bin/deploy-frontend.sh、nginx 网关、容器健康检查、localhost smoke、日志证据和常见阻断处理。适用于用户要求部署项目、验证部署文档或脚本、在 WSL2 Debian/macOS Colima/Linux Docker CE 中拉起完整栈、排查容器部署失败、确认 Vue/React/React Pro/nginx/backend 是否可访问，或沉淀部署验证结论。
---

# InfoQ 部署验证

本技能只负责一件事：用仓库部署脚本在免费商用容器运行时中拉起完整栈，并用可复跑 smoke 证明部署文档和脚本是否正确。默认支持三类运行时：WSL2 内 Docker CE、macOS Colima、原生 Linux Docker CE；不默认使用 Docker Desktop 或其他许可不明确的容器桌面产品。版本升级归 `infoq-release-ops`，代码级后端测试归 `infoq-backend-verify`，前端单测/lint/build 归 `infoq-frontend-verify`，数据修复归 `infoq-data-ops`。

## 执行顺序

1. 判定范围：确认目标是全新环境部署验证、已有容器复核、部署失败诊断，还是停止/清理本地部署栈。
2. 写清验收约定：功能范围、非目标、异常处理与 blocker、证据路径、回滚或停止条件。
3. 只读探测：读取 `doc/devops/*`、`script/bin/infoq.sh`、`script/bin/deploy-frontend.sh`、`script/docker/docker-compose.yml`、目标工作区 `Dockerfile` 和当前容器/端口状态。
4. 选择运行时：先读取 `references/runtime-matrix.md`，只在 WSL2 内 Docker CE、macOS Colima、原生 Linux Docker CE 三条免费商用路径中选择；如果检测到 Docker Desktop 或其他未确认许可的运行时，先停止并请用户确认是否允许。
5. 环境预检：确认 Docker daemon、Compose、JDK/Maven、Node/pnpm 镜像拉取能力、端口 `80/443/3306/6379/9000/9001/9090/9091/9092/9093`、`INFOQ_DEPLOY_ROOT`，以及安装后 `deploy.env` 中的随机凭据。
6. 目录前置提醒：在执行任何 `deploy` 前，先明确提醒并确认服务器已存在 `/tmp/infoq-deploy` 与 `${INFOQ_DEPLOY_ROOT}/server/temp`；WSL2/Linux 默认 `INFOQ_DEPLOY_ROOT=/infoq`，所以必须确认 `/infoq/server/temp`。macOS Colima 默认用 `$HOME/infoq`，除非用户明确配置 `/infoq` 为 Colima 可挂载路径。权限允许时执行 `mkdir -p /tmp/infoq-deploy "${INFOQ_DEPLOY_ROOT}/server/temp"`，权限不足时停止并请用户创建后继续。
7. 一键部署：优先执行 `deploy/install.sh`，让脚本生成或复用 `deploy.env` 与 `credentials.txt`，并调用后端、前端和 nginx 部署脚本。
8. 分段部署：仅在排查时直接执行 `script/bin/infoq.sh deploy` 与 `script/bin/deploy-frontend.sh deploy`；必须先加载同一个 `INFOQ_ENV_FILE`。
9. smoke 验证：检查容器状态、backend readiness/liveness、nginx `/prod-api` 反代、`/vue/`、`/react/`、`/react-pro/`、`/console-oss/`、`/oss/minio/health/live`、三个直连端口、MySQL 初始化数据、OSS/管理员数据库同步和 Redis。
10. 证据收口：日志、curl 输出、Docker 状态和 blocker 都写入 `doc/tmp/deploy-wsl2/` 或更具体的 `doc/tmp/infoq-deploy-verify/<run-id>/`。
11. 差异审查：若修复脚本或 Dockerfile，执行 UTF-8 校验、`git diff --check`、必要的 OpenSpec/文档同步，再汇总 residual risk。

## 默认命令

WSL2 Debian 从 Windows 侧执行时优先用 Docker CE in WSL2，并显式使用 `/infoq`：

```powershell
wsl.exe -d Debian -- bash -lc 'cd /mnt/c/DevTools/code/github/infoq-scaffold-ai && export INFOQ_DEPLOY_ROOT=/infoq && mkdir -p /tmp/infoq-deploy "${INFOQ_DEPLOY_ROOT}/server/temp" && sudo env INFOQ_SOURCE_DIR="$(pwd)" INFOQ_PUBLIC_BASE_URL=http://127.0.0.1 INFOQ_DEPLOY_ROOT="${INFOQ_DEPLOY_ROOT}" bash deploy/install.sh'
```

Linux shell 内执行时，先按运行时选择部署根目录：WSL2/Linux Docker CE 默认 `/infoq`；macOS Colima 默认 `$HOME/infoq`，除非用户明确配置 `/infoq` 可被 Colima 挂载。

```bash
cd /path/to/infoq-scaffold-ai
export INFOQ_DEPLOY_ROOT=/infoq
mkdir -p /tmp/infoq-deploy "${INFOQ_DEPLOY_ROOT}/server/temp"
sudo env INFOQ_SOURCE_DIR="$(pwd)" INFOQ_PUBLIC_BASE_URL=http://127.0.0.1 INFOQ_DEPLOY_ROOT="${INFOQ_DEPLOY_ROOT}" bash deploy/install.sh
```

macOS Colima 使用：

```bash
cd /path/to/infoq-scaffold-ai
colima status || colima start --runtime docker --cpu 4 --memory 8 --disk 80
docker context use colima
export INFOQ_DEPLOY_ROOT="${HOME}/infoq"
export DOCKER_HOST="unix://${HOME}/.colima/default/docker.sock"
mkdir -p /tmp/infoq-deploy "${INFOQ_DEPLOY_ROOT}/server/temp"
sudo env DOCKER_CONFIG="${DOCKER_CONFIG:-$HOME/.docker}" DOCKER_HOST="${DOCKER_HOST}" INFOQ_SOURCE_DIR="$(pwd)" INFOQ_PUBLIC_BASE_URL=http://127.0.0.1 INFOQ_DEPLOY_ROOT="${INFOQ_DEPLOY_ROOT}" bash deploy/install.sh
```

关键 smoke：

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
docker exec mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -Nse 'SELECT COUNT(*) FROM infoq.sys_menu;'
docker exec mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -Nse "SELECT COUNT(*) FROM infoq.sys_oss_config WHERE config_key IN ('minio','image') AND access_key='${MINIO_ROOT_USER}' AND secret_key='${MINIO_ROOT_PASSWORD}' AND bucket_name='${INFOQ_OSS_BUCKET}' AND endpoint='minio:9000' AND domain='${INFOQ_PUBLIC_BASE_URL}/oss' AND is_https=IF(LEFT('${INFOQ_PUBLIC_BASE_URL}', 6)='https:', 'Y', 'N');"
docker exec mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -Nse "SELECT COUNT(*) FROM infoq.sys_user WHERE user_id=1 AND user_name='${INFOQ_ADMIN_USERNAME}' AND status='0' AND del_flag='0';"
docker exec redis redis-cli -a "${REDIS_PASSWORD}" ping
```

停止本技能验证栈时，不删除数据目录，除非用户明确要求清理：

```bash
cd /path/to/infoq-scaffold-ai
INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env bash script/bin/deploy-frontend.sh stop
INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env bash script/bin/infoq.sh stop
```

## 护栏

- 只默认使用免费商用基线运行时：WSL2 内 Docker CE、macOS Colima、原生 Linux Docker CE；检测到 Docker Desktop 时先停下说明其不在默认基线内，不要继续自动部署。
- 不要把 MySQL 数据目录放在 `/mnt/c/...`、`/mnt/d/...` 等 WSL DrvFS 路径；WSL2/Linux 默认用 Linux 文件系统 `/infoq`，macOS Colima 默认用 `$HOME/infoq`。
- 每次执行部署前都要提醒并确认 `/tmp/infoq-deploy` 和 `${INFOQ_DEPLOY_ROOT}/server/temp` 已创建；WSL2/Linux 默认就是 `/infoq/server/temp`。不能创建时明确请用户在服务器上创建，不要跳过后继续部署。
- WSL2 验证期间保持一个长生命周期 WSL 进程，避免 distro 自动退出导致 Docker daemon 和容器反复重启。
- localhost curl 在代理环境中必须加 `--noproxy '*'`，否则可能被 HTTP proxy 返回伪 502。
- 发现 shell 脚本 CRLF 时，修复为 LF 并用 `.gitattributes` 固化 `*.sh text eol=lf`；不要只在当前 WSL 会话里临时 `dos2unix`。
- macOS Colima 若 Docker/Compose 报 `error getting credentials` 且缺少 `docker-credential-desktop`，说明 `~/.docker/config.json` 残留 Docker Desktop credential helper；不要切到 Docker Desktop。验证时可在 `doc/tmp/` 下创建只含 `{"auths":{}}` 的临时 `DOCKER_CONFIG`，并显式设置 `DOCKER_HOST=unix://${HOME}/.colima/default/docker.sock` 后重试；长期应清理失效的 `credsStore`/`credHelpers` 或安装匹配 helper。
- 前端 Docker build 统一使用固定 `node:24.18.0` builder；若出现 Corepack/packageManager 激活失败，按工作区 `packageManager` 与 lockfile 定位，不要降回 Node 20/22 标记通过。npm 版本不作为本仓库 Docker 构建基线单独固定。
- Docker 镜像源 EOF/short read 不是构建成功；可临时直拉 `registry-1.docker.io/...`，再 `docker tag` 为脚本需要的短名。确认短名与长名 `IMAGE ID` 一致且没有容器引用长名后，执行 `docker rmi registry-1.docker.io/...` 删除辅助 tag，并记录为环境风险。
- Debian 13 默认 apt 源可能没有 `openjdk-17-jdk`；项目基线只有 JDK 17，遇到缺包时应先补齐 JDK 17 安装来源，不要切换项目 Java 基线。
- 任何会删除 `/infoq`、Docker volume、容器数据、MySQL 数据或用户手工目录的操作都必须先确认。

## 参考

- 运行时矩阵与免费商用边界：`references/runtime-matrix.md`
- WSL2/Debian 完整流程：`references/wsl2-docker-compose.md`
