---
name: deploy-cli
description: 在本机部署并冒烟验证 InfoQ-Scaffold-AI：macOS 使用 Apple container（infoq-apple* 隔离资源），Windows 在 WSL2 Debian/Ubuntu 内使用 Docker，Linux 使用本地 Docker。覆盖 init/build/up/down/restart/status/smoke/logs/destroy、状态文件收口与端口归属；不负责发布 tag/Release、PR 合并或业务数据修复。
---

# Deploy CLI

本技能只负责一件事：把仓库部署到本机并证明运行态可用。发布、PR 合并与业务数据修复
分别走 `release-cli`、`push-cli` 与 `docs/DATA-OPS.md`。

## 运行时选择

| 平台 | 运行时 | 入口 |
| --- | --- | --- |
| macOS | Apple container | `deploy/apple-container.sh`（本技能自动调度） |
| Windows | WSL2 Debian/Ubuntu 内 Docker | 在 WSL2 中运行本技能 |
| Linux | 本地 Docker Engine + Compose v2 | `deploy/install.sh` / `deploy/bin/infoq.sh` |

- 用户明确要求 Apple container 时才走 Apple 路径；默认不要切换到 Docker Desktop。
- 只允许操作 `infoq-apple*` 容器、网络与卷；发现其他非本栈资源
  时必须停止。
- Windows 原生 shell 不支持生命周期操作；本技能会显式失败并要求进入 WSL2。

## 执行顺序

1. 判定范围：全新部署、已有栈复核、失败诊断、停止/清理，还是仅做 smoke。
2. 只读探测：读取 `deploy/.env`（或 `INFOQ_ENV_FILE`）、端口、运行时可用性与现有容器；
   Apple 路径先确认 `container --version` 与 `container system status`。
3. 预检：确认 JDK 21/Maven 3.9.x（Apple 构建需要）、Docker/Compose（Docker 路径）、
   `deploy/.env`、`sql/infoq_scaffold_3.0.0.sql` 存在；缺失时显式失败，不静默生成生产秘密。
4. 执行：按 `init -> build -> up -> smoke` 的顺序操作；失败时保留现有栈并输出日志。
5. 验证：readiness、liveness、验证码接口；Docker 路径额外验证 nginx 反代与双前端入口。
6. 收口：成功写 `tmp/deploy-cli/state.json` 为 `passed`；停止/销毁写 `stopped`；
   失败写 `failed` 并保留 `tmp/deploy-cli/deploy.log`。

## 默认命令

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

- `up` 默认先构建镜像；已有产物时用 `--no-build`，复用现有 jar 时用 `build --from-existing-jar`。
- `destroy --yes` 只删除容器与网络；删除卷必须显式追加 `--volumes`。
- Docker 路径的 `up`/`down` 默认只打印计划，必须显式追加 `--execute` 才执行。
- `status`/`smoke` 只做只读探测，不改变运行态。

## 状态与端口

- 状态文件：`tmp/deploy-cli/state.json`，包含 `status`、`pid`、`port`、`log`、时间戳。
- 日志：`tmp/deploy-cli/deploy.log`。
- Apple 默认端口 `19090`（来自 `APPLE_CONTAINER_HOST_PORT`），默认部署根目录
  `$HOME/infoq-apple`；禁止复用 `/infoq` 或 `$HOME/infoq`。
- Docker 默认后端端口 `9090`，网关默认 `80/443`；以 `deploy/.env` 与 Compose 为准。
- 验证结束、失败或中断时，必须把本技能启动的资源停掉或记录为 `stopped`；不得留下
  无人认领的端口。

## 护栏

- 不得把 `deploy/.env`、`/etc/infoq-scaffold-ai/deploy.env` 或任何秘密写入日志。
- 不得用 `status` 的 HTTP 成功代替容器状态检查；Apple 路径必须同时检查
  `deploy/apple-container.sh status`。
- readiness 失败时先看 `logs` 与 `tmp/deploy-cli/deploy.log`，不要反复重建数据卷。
- 不自动删除 MySQL/Redis/MinIO 数据卷；`destroy --volumes` 必须由用户显式确认。
- 本技能不创建 tag、不发布 Release、不推送镜像。

## 参考

- Apple container 细节：`references/apple-containers.md`
- WSL2/Linux Docker 细节：`references/docker.md`
- 部署真值：`deploy/README.md`、`deploy/VERIFICATION.md`、`deploy/DEPLOYMENT_LIFECYCLE.md`
- 运行时矩阵：`deploy/runtime-matrix.md`
