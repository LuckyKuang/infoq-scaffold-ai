# 部署生命周期

本文件说明本机与单机部署从准备到卸载的生命周期。执行细节以
`deploy/APPLE_CONTAINER.md`、`deploy/DOCKER.md`、`deploy/VERIFICATION.md` 为准；
Apple 与 WSL2/Linux 的运行态编排入口是 `node skills/deploy-cli/scripts/deploy_cli.mjs`
（下文简写为 `deploy-cli`）；macOS Colima 使用 Docker shell 入口，Node 入口在 macOS 固定选择 Apple。

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
- 由能访问 Docker socket 的受权 root/部署账号执行 `deploy/README.md` 的平台安装命令，显式设置 `INFOQ_FRONTEND_TARGET`、`INFOQ_PUBLIC_BASE_URL`、`INFOQ_DEPLOY_ROOT`，保存生成的 `deploy.env` 与凭据。
- 状态与 smoke：`node skills/deploy-cli/scripts/deploy_cli.mjs status`。

## 3. 升级

1. 读取当前版本与目标版本，确认 SQL 增量脚本、配置变更与回滚路径。
2. 备份数据库与关键配置；确认当前栈健康。
3. 构建新镜像/产物；保留旧镜像或旧 jar 作为恢复点。
4. 替换应用容器或进程，保留数据卷与 bind 目录。
5. 执行 readiness、liveness、登录页与关键 API smoke。
6. 成功后再清理旧应用镜像；失败时保留恢复资源并回退。

升级不得删除 MySQL/Redis/MinIO 数据目录，不得修改冻结 SQL 基线。远程 bootstrap 替换安装源码目录前要求 `.infoq-installer-owned` 标记；未标记的旧目录不自动删除，先备份并选择空安装目录，或显式使用已审阅 `INFOQ_SOURCE_DIR` 本地 checkout。环境文件与凭据文件不得同路径。

安装器复用的环境文件会覆盖同名调用环境变量，但源码选择/下载发生在加载该文件之前。因此升级需同时核对实际 checkout/tag、调用时的 `INFOQ_VERSION` 和环境文件内的版本；不能只编辑版本字段就认为已切换源码。新批次的 `DEPLOY_ID` 必须受控更新。Docker 的 `prepare/start/deploy/restart` 使用受控 env 与证书重新渲染，持续保留 HTTPS；手工修改生成文件会被覆盖，应将变更迁移至受控输入和 renderer。

## 4. 回滚

| 场景 | 动作 |
| --- | --- |
| 应用启动失败 | 恢复上一镜像/jar，保留数据卷，重新执行 smoke |
| 配置错误 | 恢复上一 `deploy.env`/配置文件，重启应用 |
| 数据库迁移失败 | 停止应用，按迁移脚本的回滚说明恢复；不得直接改冻结基线 |
| Apple container 状态异常 | 保留旧镜像与配置，受控恢复 `APPLE_CONTAINER_ADMIN_IMAGE` 后执行 `deploy-cli up --no-build --recreate`；这会重建三个容器，保留卷但存在停机 |
| Release 后发现问题 | 不回滚 tag；发布 patch 版本 |

回滚只恢复应用与配置，不自动回滚已提交的数据变更。数据回滚必须有独立脚本与确认。

应用隔离恢复/回滚工具见 [生产运维 SOP](../docs/PRODUCTION-OPS.md)；生产/共享执行仍需独立授权。Compose helper 不自动回滚应用。回滚前摘流量并确认旧应用兼容当前数据库；Compose 的镜像 tag 是配置中的固定版本，不能只改 `INFOQ_VERSION` 切换应用镜像。应使用已评审的 Compose override 或恢复旧版本 checkout 与配置，核对将使用的镜像 ID 后再启动。不要在恢复旧镜像后重新运行会构建新镜像的 `install.sh/deploy`；Apple 也不要省略 `--no-build`。回滚后重新检查容器、readiness、登录、关键 API 与日志，再恢复流量。

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
- 生产必须使用独立、受控且来源可确认的数据库、Redis、MinIO、token、管理员凭据及 RSA 配置。仓库示例值仅限隔离开发/演示；未替换或来源未确认即阻塞上线，不能把文档修订视为已完成凭据轮换。
- `VITE_APP_ENCRYPT=true` 时，两端构建配置与后端 `api-decrypt` 必须匹配：前端公钥对应后端私钥，前端私钥对应后端公钥，这是两组密钥。前端私钥进入浏览器包，不能提供服务端秘密保护，仍需 HTTPS；生产安装须提供同源受控文件；中央预检后通过 BuildKit secret 注入构建与 managed-security 环境占位符注入后端。隔离 development 可生成两组独立 RSA。受控配置方式见 [PRODUCTION.md](PRODUCTION.md)。

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

## 9. 当前生产准备阻塞

仓库修复和目标环境验收分开记录，当前工具行为如下：

- 同源生产配置在安装/helper 副作用前核验，示例凭据或 RSA 不匹配、缺 TLS、错误域名/私钥/有效期均失败；生产输入不得自动降级。Compose 的辅助端口默认 loopback，网关 HTTPS 持续受控渲染，HTTP 重定向 HTTPS。
- MinIO mc 固定版本，新 bucket 私有，已有公开/自定义策略不自动覆盖；显式迁移提供策略备份/恢复，部署确认 private 后才同步数据库私有元数据。S3 使用独立外部域名根路径保留签名 Host/path。
- helper 保留旧目录 owner 并拒绝不安全路径；新建 owned 空目录在实际镜像账户核验后设置最小 owner/mode，并在启动前完成真实写探针；权限迁移提供镜像账户核验、只读预览、停机 tar/hash + owner/mode 快照与失败恢复。真实镜像 entrypoint 用户、挂载写入、升级/重启必须在目标 Linux 实测，不能因目录 `0755` 判定可写。
- 固定通用容器名仍限制并行部署，操作前须核标签与挂载且禁止并发替换；卸载在任何删除前批量核验归属，按核验 ID 删除，孤立数据要求项目 marker。未知归属不自动认领。
- **尚需目标 Linux 证据**：真实 Docker build/Compose/nginx、受信 HTTPS/DNS、仅网关公网、签名有效/匿名拒绝/过期拒绝、实际 UID/GID 与读写、真实登录、回滚和备份恢复。隔离 fixture 只证明工具边界，不替代运行态。
- 真实生产凭据/CA 来源、轮换与当前部署匹配、外部告警接收/恢复，以及用户容量 SLO/RTO/RPO 仍需输入和演练。healthcheck 或 stderr 不等于已发出并收到外部告警。运维工具见 [PRODUCTION-OPS.md](../docs/PRODUCTION-OPS.md)。
- Apple 仅为显式隔离开发后端，不代替 Linux 生产验收；Windows/WSL/Colima 的实际平台结果单独记录，不把本机替身当作这些平台已通过。
