---
name: deploy-cli
description: 在本机部署并冒烟验证 InfoQ-Scaffold-AI：macOS 支持 Apple container（仅后端栈）与 Colima + Docker（完整栈），Windows 在 WSL2 Debian/Ubuntu 内使用 Docker，Linux 使用本地 Docker。覆盖 init/build/up/down/restart/status/smoke/logs/destroy、状态文件收口与端口归属；不负责发布 tag/Release、PR 合并或业务数据修复。
---

# Deploy CLI

本技能只负责一件事：把仓库部署到本机并证明运行态可用。发布、PR 合并与业务数据修复
分别走 `release-cli`、`push-cli` 与 `docs/DATA-OPS.md`。

## 运行时选择

| 平台 | 运行时 | 入口 |
| --- | --- | --- |
| macOS | Colima + Docker（完整栈） | `deploy/install.sh` |
| macOS | Apple container（仅后端） | `deploy/apple-container.sh`（本技能自动调度） |
| Windows | WSL2 Debian/Ubuntu 内 Docker | 在 WSL2 中运行本技能 |
| Linux | 本地 Docker Engine + Compose v2 | `deploy/install.sh` / `deploy/bin/infoq.sh` |

macOS 需要完整前端栈时使用 Colima + Docker（`deploy/install.sh`）；Apple container 路径只启动 MySQL、Redis 和后端。仅开发后端或做前后端联调时，见 `deploy/APPLE_CONTAINER.md`。

生产基线为 Linux Docker；Apple 本地栈须显式 `INFOQ_DEPLOY_MODE=development`。
生产安装先准备受控环境文件，默认严格预检，不再自动生成生产凭据。

Node 入口按操作系统选择运行时：macOS 固定为 Apple，Linux 固定为 Docker；没有 `--runtime` 参数。macOS Colima 的状态、日志与验证使用 `deploy/bin/*.sh` 和 `deploy/VERIFICATION.md`，不要调用本入口误操作 Apple 栈。

- 用户明确要求 Apple container 时才走 Apple 路径；默认不要切换到 Docker Desktop。
- Apple 路径只允许操作 `infoq-apple*` 且带 ownership 标签的容器、网络与卷；同名资源不属于本栈时必须停止。其他名称的项目可以并存，禁止操作它们。
- Windows 原生 shell 不支持生命周期操作；本技能会显式失败并要求进入 WSL2。

## 执行顺序

1. 判定范围：全新部署、已有栈复核、失败诊断、停止/清理，还是仅做 smoke。
2. 只读探测：读取 `deploy/.env`（或 `INFOQ_ENV_FILE`）、端口、运行时可用性与现有容器；
   Apple 路径先确认 `container --version` 与 `container system status`。
3. 预检：确认 Node 24.18.0、Python 3/openssl（Apple）、JDK 21/Maven 3.9.x（Apple 构建需要）、Docker/Compose（Docker 路径）、
   运行环境文件与 `sql/infoq_scaffold_3.0.0.sql` 存在。Apple 使用 `deploy/.env`；
   Docker 使用 `INFOQ_ENV_FILE`（默认 `/etc/infoq-scaffold-ai/deploy.env`）；生产缺失时显式失败。Docker 使用 `tools/production_config.mjs` 的纯数据解析器，并合并 `INFOQ_PRODUCTION_CONFIG_FILE` 受控来源，不执行 shell 表达式；Unix 文件权限为 owner-only。Apple env 按未加引号的字面量读取。生产部署先检查独立凭据、两组独立 RSA、TLS 双域证书与路径；前端构建使用 `production_config` BuildKit secret，内部端口默认 loopback。
4. 执行：Apple 按 `init -> up -> smoke`（`up` 默认构建；已单独构建则 `up --no-build`）；Docker 按 `install.sh -> status/smoke` 或 `up --execute`；失败记录日志，不能假设自动恢复旧容器或自动停栈。
5. 验证：Apple 检查 readiness、liveness、验证码接口；Docker 检查本机 API、nginx 反代与所选前端入口。生产验收还需 `deploy/VERIFICATION.md` 的数据库、Redis、OSS 与登录验证。
6. 收口：`up/status/smoke` 的探针通过后写 `tmp/deploy-cli/state.json` 为 `passed`；停止/销毁写 `stopped`；
   失败写 `failed` 并保留 `tmp/deploy-cli/deploy.log`。

## 命令矩阵

| 命令 | Apple container | Docker（WSL2/Linux） |
| --- | --- | --- |
| `init` | 支持，生成 `deploy/.env` | 不支持，使用 `deploy/install.sh` 与 `INFOQ_ENV_FILE` |
| `build` | 支持 | 不支持，使用 `deploy/install.sh` 构建 |
| `up` | 支持 | 支持，必须显式 `--execute` |
| `down` | 支持 | 支持，必须显式 `--execute`，同时停止后端与前端 |
| `restart` | 支持 | 不支持，使用 `deploy/bin/infoq.sh restart` |
| `status` / `smoke` | 支持 | 支持 |
| `logs` | 支持，`--service mysql|redis|admin`，`--follow` 可选 | `--execute --service mysql|redis|minio|infoq-admin`，始终跟随日志 |
| `destroy` | 支持，需 `--yes` | 不支持，使用 `deploy/uninstall.sh` |
| `pull` | 支持 | 不支持，使用 `docker compose pull` |

## 默认命令

Apple container：

```bash
node skills/deploy-cli/scripts/deploy_cli.mjs init
node skills/deploy-cli/scripts/deploy_cli.mjs build
node skills/deploy-cli/scripts/deploy_cli.mjs up
node skills/deploy-cli/scripts/deploy_cli.mjs status
node skills/deploy-cli/scripts/deploy_cli.mjs smoke
node skills/deploy-cli/scripts/deploy_cli.mjs down
node skills/deploy-cli/scripts/deploy_cli.mjs logs --service admin --follow
node skills/deploy-cli/scripts/deploy_cli.mjs destroy --yes
```

Docker：

```bash
# 先按 deploy/.env.example 准备绝对路径的受控生产文件与 TLS 材料。
# 在有部署权限的 Linux shell 设置 INFOQ_ENV_FILE、INFOQ_SOURCE_DIR 和 INFOQ_FRONTEND_TARGET。
bash deploy/install.sh
node skills/deploy-cli/scripts/deploy_cli.mjs status
node skills/deploy-cli/scripts/deploy_cli.mjs smoke
node skills/deploy-cli/scripts/deploy_cli.mjs up --execute
node skills/deploy-cli/scripts/deploy_cli.mjs down --execute
```

- Apple `up` 默认先构建镜像；已有产物时用 `--no-build`，复用现有 jar 时用 `build --from-existing-jar`。
- `destroy --yes` 只删除容器与网络；删除卷必须显式追加 `--volumes`。
- Docker 路径的 `up`/`down` 默认只打印计划，必须显式追加 `--execute` 才执行。
- `smoke` 只做 HTTP 探测并更新本地证据；Docker `status` 额外读取容器状态。Apple `status` 底层会调用 `ensure_system`，daemon 未运行时会启动 Apple 服务；严格只读时使用 `container system status` / `container list` 与 `smoke`。
- Docker 安装需要显式 `INFOQ_FRONTEND_TARGET=all|vue|react`、受控 `INFOQ_ENV_FILE`、`INFOQ_PRODUCTION_CONFIG_FILE`、应用与独立 OSS HTTPS origin、匹配证书，以及适用的 root 权限、Colima socket 或本地验证目录配置，完整命令见 `deploy/README.md`。安装只输出凭据文件路径，禁止输出秘密；本入口强制 `INFOQ_PRINT_SECRETS=0`。

## 状态与端口

- 状态文件：`tmp/deploy-cli/state.json`，包含 `status`、`pid`、`port`、`log`、时间戳；`pid` 是 CLI 进程，不能当作容器 PID 或持续健康状态。
- 日志：`tmp/deploy-cli/deploy.log`。收到 SIGINT/SIGTERM 时终结为 `interrupted`，转发信号并等待自有 shell 子进程组退出，超时强制结束；已部署容器按下述保留/显式收口规则处理。
- Apple 默认端口 `19090`（来自 `APPLE_CONTAINER_HOST_PORT`），默认部署根目录
  `$HOME/infoq-apple`；禁止复用 `/infoq` 或 `$HOME/infoq`。
- Docker 默认后端端口 `9090`，网关默认 `80/443`；以 `INFOQ_ENV_FILE` 与 Compose 为准。
- `up` 成功后保留用户要求的部署服务；一次性验证任务必须记录自有栈并在完成、失败或中断后显式 `down`。脚本不自动清理，不能只把状态改成 `stopped` 代替实际停栈；不能停止任务前已存在的部署。

## 护栏

- 不得把 `deploy/.env`、`/etc/infoq-scaffold-ai/deploy.env` 或任何秘密写入日志。
- 不得用 `status` 的 HTTP 成功代替容器状态检查；Apple 路径必须同时检查
  `deploy/apple-container.sh status`。
- 参数必须适用于当前 command；重复/空值/不适用参数明确失败。`--base-url` 等值中的 `=` 原样保留；HTTP 无条件 GET 仅 `200` 通过。
- readiness 失败时先看 `logs` 与 `tmp/deploy-cli/deploy.log`，不要反复重建数据卷。
- 旧 Redis `requirepass` 配置的迁移必须先按 `deploy/DOCKER.md` 重建认证命令；helper 核验归属/只读挂载/当前密码失败时保留旧配置并停止，禁止先删除认证行再重启旧容器。
- 不自动删除 MySQL/Redis/MinIO 数据卷；`destroy --volumes` 必须由用户显式确认。
- Docker `down --execute` 会停止 MySQL、Redis、MinIO、后端、目标前端与网关；不是只摘应用流量，生产滚动更新不要使用它。
- 本技能不创建 tag、不发布 Release、不推送镜像。
- 私有文件使用保留 Host/原路径的独立 OSS origin；旧 bucket 和数据权限迁移先预览、备份、核归属再显式执行。恢复与应用回滚走 `tools/verify/` 的运维 SOP，不将 fixture 或静态配置标成 Linux 实机验收。

## 参考

- Apple container 细节：`references/apple-containers.md`
- WSL2/Linux Docker 细节：`references/docker.md`
- 部署真值：`deploy/README.md`、`deploy/VERIFICATION.md`、`deploy/DEPLOYMENT_LIFECYCLE.md`
- 运行时矩阵：`deploy/runtime-matrix.md`
