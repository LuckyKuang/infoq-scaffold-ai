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
- Node 入口在 macOS 固定走 Apple；Colima 按 `deploy/VERIFICATION.md` 使用 shell 入口。环境文件保持 `600`，用已获授权的文件属主/root 执行，不能放宽权限来完成 smoke。
- `sql/infoq_scaffold_3.0.0.sql` 存在；初始化基线不得修改。
- Compose 默认后端端口 `9090`，网关 `80/443`；前端目标由 `INFOQ_FRONTEND_TARGET`
  控制（`vue`、`react` 或 `all`）。
- WSL2 中保持一个长生命周期 shell，避免 distro 自动退出导致容器重启。
- 旧 Redis 配置含 `requirepass` 时，先按 `deploy/DOCKER.md` 的受控步骤重建 Redis 认证命令；helper 核验容器归属、只读挂载和当前密码后才去除配置文件中的密码，失败保留旧配置。

## 标准流程

```bash
# 1. 生成部署环境与宿主机目录（用户显式执行）
sudo env INFOQ_SOURCE_DIR="$(pwd)" INFOQ_FRONTEND_TARGET=all INFOQ_PUBLIC_BASE_URL=http://127.0.0.1 INFOQ_PRINT_SECRETS=0 bash deploy/install.sh

# 2. 以能读取 INFOQ_ENV_FILE 的部署账号执行状态 + HTTP smoke
node skills/deploy-cli/scripts/deploy_cli.mjs status
node skills/deploy-cli/scripts/deploy_cli.mjs smoke

# 3. 仅当任务要求停止时执行：包含 MySQL、Redis、MinIO
node skills/deploy-cli/scripts/deploy_cli.mjs down --execute
```

- `up --execute` 调用 `deploy/install.sh`；`down --execute` 调用
  `deploy/bin/infoq.sh stop` 与 `deploy/bin/deploy-frontend.sh stop <target>`。
- 未加 `--execute` 时只打印计划，不改变运行态。
- `status` / `smoke` 只读，不执行安装或删除。

## 冒烟探针

默认基址来自 `INFOQ_PUBLIC_BASE_URL`（通常 `http://127.0.0.1`）：

- 本机固定 `http://127.0.0.1:9090/monitor/health/readiness` 与 `/monitor/health/liveness`，不继承公网 HTTPS 协议或端口
- `/prod-api/monitor/health/readiness`（nginx 反代）
- `INFOQ_FRONTEND_TARGET=all`：`/vue/` 与 `/react/`
- `INFOQ_FRONTEND_TARGET=vue|react`：`/`

`--base-url` 只覆盖网关地址，直连后端保持本机 `9090`。无条件 GET 探针只接受 HTTP 200，重定向和依赖不可用不能算通过。该 smoke 不替代登录、上传或完整业务验证。

localhost 走 HTTP 代理时使用 `curl --noproxy '*'`；本技能使用 Node `fetch`，默认不读取
`HTTP_PROXY`。

## 清理

- 优先 `deploy/uninstall.sh --dry-run` 预览，再按用户确认执行实际卸载。
- MySQL/Redis/MinIO 容器与数据目录分别确认；不得为了“干净”无条件删除数据。
- 保留镜像与依赖缓存，删除本栈容器、网络与临时目录。

## CLI 回归 SOP

触发条件：修改部署 CLI 的 env、探针、目标选择、信号收口、目录权限、卸载归属或 IT 路径；不需要实际运行容器。

1. 从 Compose 与 shell helper 核对环境文件优先级、端口、单/双前端路径和失败语义。
2. 执行 `node skills/deploy-cli/scripts/test_deploy_cli.mjs`；覆盖 env fixture、HTTP 200/201/204/302/304/503/连接错误、TLS 网关与本机 HTTP API、安装默认不打印秘密，以及卸载交互选择的 yes/no/默认拒绝。交互函数用 stdin fixture 运行，不执行卸载主流程。另用隔离 jar 与替身 `container` 验证 Apple build 将产物和构建上下文放到仓库 `tmp/`；不启动 daemon、不打真实镜像。fixture 只进入 `tmp/deploy-cli-tests/` 并自行清理。
3. 执行 `node skills/deploy-cli/scripts/test_deploy_safety.mjs`：用隔离文件和替身 Docker 验证新/旧权限、符号链接拒绝、无密 Redis 配置/argv、旧 Redis 认证迁移门禁、双 run 隔离、卸载正常/带标记的孤立数据/无标记拒绝/查询失败/归属与挂载不符/网络不符、Apple YAML/SQL 特殊字符，以及 SIGINT/SIGTERM 关闭自有子进程组。测试依赖 Python 3 + PyYAML（仅验证配置结构），fixture 位于 `tmp/deploy-cli-tests/`；不接触真实 Docker/socket/数据。
4. 执行 `node --check skills/deploy-cli/scripts/deploy_cli.mjs`，逐份 `bash -n <受影响脚本>`（`bash -n a.sh b.sh` 只检查第一个脚本），再运行 `node tools/validate_utf8.mjs skills/deploy-cli deploy` 和 `git diff --check`。文档中的 Bash/PowerShell 示例分别在对应解析器核验，未具备解释器时记录未验证。
5. 若修改 Nginx 配置，在目标 Nginx 版本执行 `nginx -t`；静态重复路由检查不能替代真实配置加载，环境缺失时明确记录未验证。

反模式：把 302 登录重定向当健康、吞掉缺失 env、让所有前端一律检查 `/vue/` / `/react/`、为跑测试启动生产栈，或把静态校验写成生产验收。
