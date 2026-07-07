# WSL2 / Debian Docker Compose 部署验证

## 适用场景

用户要求“开始部署”“验证部署文档和脚本”“在 WSL2 Debian 中部署本项目”“MySQL/Redis 用 Docker 安装”时使用本参考。目标是用真实脚本跑完整后端、数据库、缓存、对象存储、三个管理端前端和 nginx，不用手工替代脚本主流程。执行前先读取 `runtime-matrix.md`，确认当前运行时属于免费商用基线。

## 预检清单

- 当前 repo 路径在 Windows 侧通常是 `C:\DevTools\code\github\infoq-scaffold-ai`，WSL 内对应 `/mnt/c/DevTools/code/github/infoq-scaffold-ai`。
- Docker daemon 必须已启动，`docker ps` 能返回。
- 部署根目录默认使用 Linux 文件系统 `/infoq`；不要把 `INFOQ_DEPLOY_ROOT` 指到 `/mnt/c/...`。macOS Colima 不使用本 WSL2 专项默认值，按 `runtime-matrix.md` 选择 `$HOME/infoq`。
- 执行 deploy 前必须提醒并确认服务器已存在 `/tmp/infoq-deploy` 和 `/infoq/server/temp`；权限允许时先执行 `mkdir -p /tmp/infoq-deploy /infoq/server/temp`，权限不足时请用户手动创建后继续。
- 一键安装会生成或复用 `/etc/infoq-scaffold-ai/deploy.env`，不要再使用固定 MySQL、Redis、MinIO 或管理员密码。
- 若 WSL2 没有常驻会话，先启动 keepalive：

```bash
nohup bash -c 'while true; do sleep 3600; done' >/tmp/infoq-wsl-keepalive.log 2>&1 &
```

- 端口占用要先只读检查：`80`、`443`、`3306`、`6379`、`9000`、`9001`、`9090`、`9091`、`9092`、`9093`。
- Debian 13 上如果没有 JDK 17，需要先补齐 JDK 17 安装来源；项目基线只有 JDK 17，不要切换项目 Java 基线。

## 一键部署

从 Windows 侧执行：

```powershell
wsl.exe -d Debian -- bash -lc 'cd /mnt/c/DevTools/code/github/infoq-scaffold-ai && mkdir -p doc/tmp/deploy-wsl2 /tmp/infoq-deploy /infoq/server/temp && export INFOQ_DEPLOY_ROOT=/infoq && sudo env INFOQ_SOURCE_DIR="$(pwd)" INFOQ_PUBLIC_BASE_URL=http://127.0.0.1 INFOQ_DEPLOY_ROOT="${INFOQ_DEPLOY_ROOT}" bash deploy/install.sh > doc/tmp/deploy-wsl2/install.log 2>&1; status=$?; echo $status > doc/tmp/deploy-wsl2/install.exit; tail -n 120 doc/tmp/deploy-wsl2/install.log; exit $status'
```

成功后验证：

```bash
curl --noproxy '*' -i --max-time 15 http://127.0.0.1:9090/monitor/health/readiness
curl --noproxy '*' -i --max-time 15 http://127.0.0.1:9090/monitor/health/liveness
```

readiness 需要返回 `200 OK`，body 中 `database.status` 和 `redis.status` 都为 `UP`。成功信号还包括安装日志中输出 `/vue/`、`/react/`、`/react-pro/`、`/console-oss/`、`/oss/` 和凭据文件路径。

## 完整 smoke

将所有输出保存为证据：

```bash
{
  date -Is
  export INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env
  set -a
  . "${INFOQ_ENV_FILE}"
  set +a
  echo '# docker ps'
  docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
  echo '# backend readiness'
  curl --noproxy '*' -sS -i --max-time 15 http://127.0.0.1:9090/monitor/health/readiness
  echo '# nginx prod-api readiness'
  curl --noproxy '*' -sS -i --max-time 15 http://127.0.0.1/prod-api/monitor/health/readiness
  echo '# frontend gateway headers'
  curl --noproxy '*' -sS -I --max-time 15 http://127.0.0.1/vue/
  curl --noproxy '*' -sS -I --max-time 15 http://127.0.0.1/react/
  curl --noproxy '*' -sS -I --max-time 15 http://127.0.0.1/react-pro/
  echo '# minio gateway'
  curl --noproxy '*' -sS -I --max-time 15 http://127.0.0.1/console-oss/
  curl --noproxy '*' -sS -i --max-time 15 http://127.0.0.1/oss/minio/health/live
  echo '# frontend direct headers'
  curl --noproxy '*' -sS -I --max-time 15 http://127.0.0.1:9091/
  curl --noproxy '*' -sS -I --max-time 15 http://127.0.0.1:9092/
  curl --noproxy '*' -sS -I --max-time 15 http://127.0.0.1:9093/
  echo '# mysql sys_menu count'
  docker exec mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -Nse 'SELECT COUNT(*) FROM infoq.sys_menu;'
  echo '# oss config'
  docker exec mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -Nse "SELECT COUNT(*) FROM infoq.sys_oss_config WHERE config_key IN ('minio','image') AND access_key='${MINIO_ROOT_USER}' AND secret_key='${MINIO_ROOT_PASSWORD}' AND bucket_name='${INFOQ_OSS_BUCKET}' AND endpoint='minio:9000' AND domain='${INFOQ_PUBLIC_BASE_URL}/oss' AND is_https=IF(LEFT('${INFOQ_PUBLIC_BASE_URL}', 6)='https:', 'Y', 'N');"
  echo '# admin account'
  docker exec mysql mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" -Nse "SELECT COUNT(*) FROM infoq.sys_user WHERE user_id=1 AND user_name='${INFOQ_ADMIN_USERNAME}' AND status='0' AND del_flag='0';"
  echo '# redis ping'
  docker exec redis redis-cli -a "${REDIS_PASSWORD}" ping
} > doc/tmp/deploy-wsl2/smoke-verify.log 2>&1
```

Windows 主机侧也要验证 `localhost`，因为用户通常从 Windows 浏览器访问：

```powershell
curl.exe --noproxy * -I --max-time 15 http://localhost/vue/
curl.exe --noproxy * -I --max-time 15 http://localhost/react/
curl.exe --noproxy * -I --max-time 15 http://localhost/react-pro/
curl.exe --noproxy * -i --max-time 15 http://localhost/prod-api/monitor/health/readiness
curl.exe --noproxy * -I --max-time 15 http://localhost/console-oss/
```

## 常见阻断与处理

| 现象 | 判断 | 处理 |
| --- | --- | --- |
| `set: pipefail\r: invalid option name` | shell 脚本是 CRLF | 将 `script/bin/*.sh` 转 LF，新增或确认 `.gitattributes` 包含 `*.sh text eol=lf` |
| MySQL 初始化报 private key chmod / errno 1 | 数据目录在 `/mnt/c` 等 DrvFS | 改用 `/infoq` 或其他 Linux 文件系统目录 |
| 部署前目录不存在或不可写 | 缺少 `/tmp/infoq-deploy` 或 `/infoq/server/temp` | 执行前提醒并创建；没有权限时请用户在服务器上创建后继续 |
| 容器一直显示 `Up 3 seconds` | WSL distro 退出导致 Docker daemon 重启 | 启动 keepalive，保持 WSL 会话存在 |
| `curl 127.0.0.1` 得到 proxy 502 | 代理环境拦截 localhost | 使用 `curl --noproxy '*'` |
| BellSoft/OpenJDK 基础镜像 EOF | Docker mirror 不稳定 | 直拉 `registry-1.docker.io/bellsoft/liberica-openjdk-rocky:17.0.16-cds` 后 tag 回 `bellsoft/liberica-openjdk-rocky:17.0.16-cds`；确认 `IMAGE ID` 一致且无容器引用长名后，删除 `registry-1.docker.io/...` 辅助 tag |
| 镜像列表同时出现短名和 `registry-1.docker.io/...` | 直拉后又 tag 回短名，长名只是辅助 tag | 保留 Dockerfile/Compose 引用的短名；确认两者 `IMAGE ID` 一致且没有容器引用长名后，执行 `docker rmi <registry-1完整tag>` |
| 前端 build 中 Corepack/packageManager 激活失败 | Node 24 builder 内 Corepack 或工作区 packageManager 激活异常 | 确认 Dockerfile 使用固定 `node:24.18.0`，再按工作区 `packageManager` 与 lockfile 定位；不要降回 Node 20/22 标记通过 |
| Debian 13 找不到 `openjdk-17-jdk` | apt 源不提供 JDK 17 | 先补齐 JDK 17 安装来源；项目基线只有 JDK 17 |

## 收口报告要点

最终回复至少说明：

- 使用的 `INFOQ_DEPLOY_ROOT`、WSL distro、JDK/Maven 和 Docker 前置条件。
- 后端部署是否成功，readiness/liveness 结果。
- Vue、React、React Pro、nginx 是否启动，gateway 与直连端口 smoke 结果。
- MySQL 初始化数据、OSS 配置、随机管理员账号与 Redis ping 结果。
- 修复过的部署脚本或 Dockerfile diff 摘要。
- 残余风险和是否需要用户介入。
- 停止命令，但不要主动删除 `/infoq` 或 Docker 数据。
