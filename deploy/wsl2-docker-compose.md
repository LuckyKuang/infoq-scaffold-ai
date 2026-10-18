# WSL2 / Debian Docker Compose 部署验证

本文件补充 [完整栈部署验证](VERIFICATION.md) 的 Windows/WSL2 边界；命令是待执行 SOP，不是当前部署成功的记录。先读取 [运行时矩阵](runtime-matrix.md) 与 [生产准备阻塞](DEPLOYMENT_LIFECYCLE.md#9-当前生产准备阻塞)，只使用已选定的 WSL2 Docker CE/Moby，不能把 Windows Docker Desktop context 当作默认路径。

## 预检

- 用 `wsl.exe --list --verbose` 确认实际发行版与 WSL 版本 2；发行版名字不一定是 `Debian`，必须替换示例。
- 仓库可在 `/mnt/c/...`，持久化数据应在 WSL Linux 文件系统（通常 `/infoq`），不能把 MySQL/ES 数据放在 DrvFS。原生 Linux/Colima 使用各自平台规则。
- 在 WSL 内确认 `docker info`、Compose、Buildx、镜像拉取能力，当前账号具有必要权限；Compose 构建不要求宿主 JDK/Maven。
- 检查基础端口 `80/443/3306/6379/9000/9001/9090` 和所选前端 `9091/9092`，确认容器、挂载、环境文件属主/权限及实际部署目录。`443` 映射不等于已启用 TLS。
- 由授权管理员预创建 `/tmp/infoq-deploy` 与 `${INFOQ_DEPLOY_ROOT}/server/temp`，生成的 `deploy.env` / `credentials.txt` 保持 `600`；读取受控文件需要属主/root 权限，不能为了 smoke 放宽权限。

WSL 验证期间保持一个专用前台会话，在另一个终端执行部署/验证；结束后在本会话 `exit`，无需创建无归属的后台 keepalive：

```powershell
wsl.exe -d Debian -- bash
```

若自动化确需后台保活，启动方必须在仓库 `tmp/deploy-verify/<run-id>/` 记录其 PID、日志、端口（无则 null）、状态与 ownership，并在成功、失败或中断后结束自己创建的进程；禁止按名称杀其他 WSL 会话。此 SOP 不自动创建后台进程。

## 执行部署

先进入实际发行版与已审阅 checkout，推荐在 WSL shell 执行以避免 PowerShell 5.1 / WSL 多层引号漂移：

```powershell
wsl.exe -d Debian
```

随后在 WSL Bash（以下路径必须替换为实际位置）执行：

```bash
cd /mnt/c/DevTools/code/github/infoq-scaffold-ai
export INFOQ_DEPLOY_ROOT=/infoq
# 若当前账号不可写，由授权管理员执行目录创建。
mkdir -p tmp/deploy-verify/wsl2-run
sudo mkdir -p /tmp/infoq-deploy "${INFOQ_DEPLOY_ROOT}/server/temp"
sudo env INFOQ_SOURCE_DIR="$(pwd)" INFOQ_FRONTEND_TARGET=all INFOQ_DEPLOY_MODE=development INFOQ_PUBLIC_BASE_URL=http://127.0.0.1 INFOQ_OSS_PUBLIC_ORIGIN=http://oss.localhost INFOQ_DEPLOY_ROOT="${INFOQ_DEPLOY_ROOT}" INFOQ_PRINT_SECRETS=0 bash deploy/install.sh > tmp/deploy-verify/wsl2-run/install.log 2>&1
INFOQ_INSTALL_EXIT=$?
printf '%s\n' "${INFOQ_INSTALL_EXIT}" > tmp/deploy-verify/wsl2-run/install.exit
tail -n 120 tmp/deploy-verify/wsl2-run/install.log
```

`install.exit` 必须为 `0`；外层若使用 `set -e`，由调用方保留失败退出码。安装日志和只显示的凭据文件路径不是健康证明。显式 development 生成独立凭据和两组 RSA，仅用于隔离开发。生产必须使用同源受控配置、TLS 与独立 OSS 域名，旧数据权限/策略需先显式迁移，见 [PRODUCTION.md](PRODUCTION.md)。

## Smoke 与 Windows 访问

在有权读取部署 env 的 WSL shell 按 [部署后检查](VERIFICATION.md#部署后检查) 执行严格 HTTP/结构/Redis 验证并保存退出码。不要在 SQL 中拼接 MinIO 密钥或管理员密码到日志；实际凭据匹配、登录和上传/下载按受控数据操作另行验证。WSL 内通过还须检查 Windows 用户访问路径。

下面在 Windows PowerShell 5.1 中执行（按实际目标设置 `all`、`vue` 或 `react`），每个无条件 GET 显式要求 `200`；不跟随跳转，不用 `-k` 绕过证书：

```powershell
$infoqTarget = 'all'
$infoqPaths = if ($infoqTarget -eq 'all') { @('/vue/', '/react/') } elseif ($infoqTarget -eq 'vue' -or $infoqTarget -eq 'react') { @('/') } else { throw 'Invalid frontend target' }
$infoqPaths += @('/prod-api/monitor/health/readiness', '/console-oss/')
foreach ($infoqPath in $infoqPaths) {
    $infoqStatus = & curl.exe --noproxy '*' --silent --show-error --max-time 15 -o NUL -w '%{http_code}' "http://localhost$infoqPath"
    if ($LASTEXITCODE -ne 0 -or $infoqStatus -ne '200') { throw "HTTP check failed: $infoqPath ($infoqStatus)" }
    Write-Output "PASS $infoqPath $infoqStatus"
}
```

真实公网/HTTPS 入口另按实际域名验证。WSL localhost 转发、防火墙、浏览器登录/静态资源均需当前机器实测，不能从容器 `Up` 推断。

## 常见阻断与恢复

| 现象 | 核查与处理 |
| --- | --- |
| `pipefail` 带 `\r` | `.sh` 须为 LF，按 `.gitattributes` 修复并重跑语法；不只临时 dos2unix |
| MySQL/ES 权限错误 | 确认数据在 WSL Linux 文件系统、UID/GID 与挂载权限；不删除数据重试 |
| 容器反复短暂 Up | 核对 WSL 发行版/Docker daemon 生命周期，保持本轮专用前台会话 |
| localhost 代理 502 | `curl --noproxy '*'`，区分代理失败与服务失败 |
| Redis 配置 Permission denied | 检查容器用户可读性及 owner；helper 的无密码配置只读挂载，旧 `777` 目录会被拒绝；管理员按镜像 UID/GID 迁移权限后重试 |
| 前端直连 200、网关 404/502 | 核对 context 与 upstream；受控前端部署会重建网关刷新 DNS，也会覆盖配置 |
| 镜像 EOF / Corepack 失败 | 按 `DOCKER.md` 区分网络和版本；固定 Node 24.18.0 / pnpm 10.34.1，不降版本伪造通过 |
| Debian 未提供宿主 JDK 21 | Compose 不依赖宿主 JDK；手动/Apple Maven 构建才需宿主工具链 |

恢复旧镜像/配置前确认数据库兼容，保留日志与数据；readiness、登录、代理和关键 API 再通过后恢复流量。停止或卸载只作用本次获授权栈，按 `VERIFICATION.md` 的逐项确认执行；不得主动删除 `/infoq` 或其他项目资源。收口列出发行版、root、镜像/构建、各层 smoke、权限/TLS/凭据与未验证项。

私有 S3 健康使用独立 `INFOQ_OSS_PUBLIC_ORIGIN` 主机的 `/minio/health/live`，不再使用主站 `/oss/`；需要 Windows/WSL 都能解析该主机。WSL/Linux 兼容验证和生产 Linux 实机证据分别记录。
