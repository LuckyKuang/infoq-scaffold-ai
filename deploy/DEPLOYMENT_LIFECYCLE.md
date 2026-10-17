# 部署生命周期

本文件说明本机与单机部署从准备到卸载的生命周期。执行细节以
`deploy/APPLE_CONTAINER.md`、`deploy/DOCKER.md`、`deploy/VERIFICATION.md` 为准；
运行态编排入口是 `deploy-cli`。

## 1. 生命周期

| 阶段 | Apple container | WSL2 / Linux Docker |
| --- | --- | --- |
| 准备 | `deploy-cli init` 生成 `deploy/.env` | `deploy/install.sh` 生成环境文件与目录 |
| 构建 | `deploy-cli build` | `deploy/install.sh` 内构建 |
| 启动 | `deploy-cli up` | `deploy-cli up --execute` |
| 验证 | `deploy-cli status` / `smoke` | `deploy-cli status` / `smoke` |
| 停止 | `deploy-cli down` | `deploy-cli down --execute` |
| 删除容器 | `deploy-cli destroy --yes` | `deploy/uninstall.sh` |
| 删除数据 | `deploy-cli destroy --volumes --yes` | 按 `deploy/uninstall.sh` 逐项确认 |

## 2. 安装

### Apple container

- 首次：`container system start`，确认 `container --version`。
- 生成环境：`node skills/deploy-cli/scripts/deploy_cli.mjs init`。
- 构建并启动：`node skills/deploy-cli/scripts/deploy_cli.mjs up`。
- 默认地址：`http://127.0.0.1:19090`。
- 只操作 `infoq-apple*` 资源；禁止触碰其他项目或未标记为本栈的资源。

### Docker

- WSL2 内使用 Docker CE；Linux 使用 Docker Engine + Compose v2；macOS 默认不用
  Docker Desktop。
- 准备 `/tmp/infoq-deploy` 与 `${INFOQ_DEPLOY_ROOT}/server/temp`。
- 执行 `bash deploy/install.sh`，保存生成的 `deploy.env` 与凭据。
- 状态与 smoke：`node skills/deploy-cli/scripts/deploy_cli.mjs status`。

## 3. 升级

1. 读取当前版本与目标版本，确认 SQL 增量脚本、配置变更与回滚路径。
2. 备份数据库与关键配置；确认当前栈健康。
3. 构建新镜像/产物；保留旧镜像或旧 jar 作为恢复点。
4. 替换应用容器或进程，保留数据卷与 bind 目录。
5. 执行 readiness、liveness、登录页与关键 API smoke。
6. 成功后再清理旧应用镜像；失败时保留恢复资源并回退。

升级不得删除 MySQL/Redis/MinIO 数据目录，不得修改冻结 SQL 基线。

## 4. 回滚

| 场景 | 动作 |
| --- | --- |
| 应用启动失败 | 恢复上一镜像/jar，保留数据卷，重新执行 smoke |
| 配置错误 | 恢复上一 `deploy.env`/配置文件，重启应用 |
| 数据库迁移失败 | 停止应用，按迁移脚本的回滚说明恢复；不得直接改冻结基线 |
| Apple container 状态异常 | `deploy-cli down` 后恢复上一镜像，再 `up` |
| Release 后发现问题 | 不回滚 tag；发布 patch 版本 |

回滚只恢复应用与配置，不自动回滚已提交的数据变更。数据回滚必须有独立脚本与确认。

## 5. 停止与清理

- `deploy-cli down`：停止应用与依赖容器，保留数据。
- `deploy-cli destroy --yes`：删除本栈容器与网络，保留卷。
- `deploy-cli destroy --volumes --yes`：删除本栈验证数据，不可恢复。
- Docker：先 `deploy/uninstall.sh --dry-run`，再按逐项确认执行实际卸载。
- 清理不得触碰其他项目容器、共享镜像缓存、全局 builder 或无关网络。

## 6. 数据与秘密

- `deploy/.env`、`/etc/infoq-scaffold-ai/deploy.env` 与 `credentials.txt` 不提交、
  不打印、不写入验证日志。
- MySQL/Redis/MinIO 数据卷和 bind 目录在停止与普通清理中必须保留。
- 生产使用仓库既有默认密码策略或显式注入的秘密；不得把占位符当作生产密码。
- `VITE_APP_ENCRYPT/TARO_APP_ENCRYPT=true` 时构建环境必须提供对应 RSA 公私钥。

## 7. 验证证据

- `tmp/deploy-cli/state.json`：状态、pid、port、日志、时间戳。
- `tmp/deploy-cli/deploy.log`：命令与输出。
- `tmp/deploy-verify/<run-id>/`：Docker 部署的 curl、容器状态与诊断输出。
- 证据至少保留到发布结论确认；失败证据在阻塞项关闭前不得删除。

## 8. 发布前检查

- 当前版本与目标版本一致，SQL/配置/依赖影响已确认。
- 备份与回滚路径可执行。
- 端口、数据目录、秘密文件与运行时可用。
- 监控/日志入口可访问；readiness 与 liveness 语义未被混淆。
- 未检查项列入 residual risk，并在发布说明中说明。
