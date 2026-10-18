# WSL2 / Linux Docker 部署参考

本文件只补充 `skills/deploy-cli` 在 Windows WSL2 与 Linux 上的执行细节；完整真值在
`deploy/VERIFICATION.md`、`deploy/DOCKER.md` 与 `deploy/README.md`。

## 运行时

| 平台 | 要求 |
| --- | --- |
| Windows | Docker CE 运行在 WSL2 Debian/Ubuntu 内；不要使用 Windows 宿主机 Docker Desktop |
| Linux | Docker Engine + Compose v2 |
| macOS | 完整栈使用 Colima + Docker；Apple container 只提供后端栈 |

## 前置条件

- Docker 使用 `INFOQ_ENV_FILE` 指向的部署环境文件（默认 `/etc/infoq-scaffold-ai/deploy.env`），并包含必需秘密；`deploy/.env` 是 Apple 路径文件。
- `sql/infoq_scaffold_3.0.0.sql` 存在；初始化基线不得修改。
- Compose 默认后端端口 `9090`，网关 `80/443`；前端目标由 `INFOQ_FRONTEND_TARGET`
  控制（`vue`、`react` 或 `all`）。
- WSL2 中保持一个长生命周期 shell，避免 distro 自动退出导致容器重启。

## 标准流程

```bash
# 1. 生成部署环境与宿主机目录（用户显式执行）
bash deploy/install.sh

# 2. 只读状态 + HTTP smoke
node skills/deploy-cli/scripts/deploy_cli.mjs status
node skills/deploy-cli/scripts/deploy_cli.mjs smoke

# 3. 停止应用与前端容器
node skills/deploy-cli/scripts/deploy_cli.mjs down --execute
```

- `up --execute` 调用 `deploy/install.sh`；`down --execute` 调用
  `deploy/bin/infoq.sh stop` 与 `deploy/bin/deploy-frontend.sh stop <target>`。
- 未加 `--execute` 时只打印计划，不改变运行态。
- `status` / `smoke` 只读，不执行安装或删除。

## 冒烟探针

默认基址来自 `INFOQ_PUBLIC_BASE_URL`（通常 `http://127.0.0.1`）：

- `:9090/monitor/health/readiness` 与 `:9090/monitor/health/liveness`
- `/prod-api/monitor/health/readiness`（nginx 反代）
- `INFOQ_FRONTEND_TARGET=all|vue`：`/vue/`
- `INFOQ_FRONTEND_TARGET=all|react`：`/react/`

localhost 走 HTTP 代理时使用 `curl --noproxy '*'`；本技能使用 Node `fetch`，默认不读取
`HTTP_PROXY`。

## 清理

- 优先 `deploy/uninstall.sh --dry-run` 预览，再按用户确认执行实际卸载。
- MySQL/Redis/MinIO 容器与数据目录分别确认；不得为了“干净”无条件删除数据。
- 保留镜像与依赖缓存，删除本栈容器、网络与临时目录。
