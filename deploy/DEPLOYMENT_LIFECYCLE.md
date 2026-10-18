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

升级不得删除 MySQL/Redis/MinIO 数据目录，不得修改冻结 SQL 基线。

安装器复用的环境文件会覆盖同名调用环境变量，但源码选择/下载发生在加载该文件之前。因此升级需同时核对实际 checkout/tag、调用时的 `INFOQ_VERSION` 和环境文件内的版本；不能只编辑版本字段就认为已切换源码。新批次的 `DEPLOY_ID` 必须受控更新。Docker 的 `prepare/start/deploy` 会重新生成网关配置，手工添加的 TLS 等配置会被覆盖，生产应先完成受控配置渲染与保留机制。

## 4. 回滚

| 场景 | 动作 |
| --- | --- |
| 应用启动失败 | 恢复上一镜像/jar，保留数据卷，重新执行 smoke |
| 配置错误 | 恢复上一 `deploy.env`/配置文件，重启应用 |
| 数据库迁移失败 | 停止应用，按迁移脚本的回滚说明恢复；不得直接改冻结基线 |
| Apple container 状态异常 | 保留旧镜像与配置，受控恢复 `APPLE_CONTAINER_ADMIN_IMAGE` 后执行 `deploy-cli up --no-build --recreate`；这会重建三个容器，保留卷但存在停机 |
| Release 后发现问题 | 不回滚 tag；发布 patch 版本 |

回滚只恢复应用与配置，不自动回滚已提交的数据变更。数据回滚必须有独立脚本与确认。

仓库没有自动回滚子命令。回滚前摘流量并确认旧应用兼容当前数据库；Compose 的镜像 tag 是配置中的固定版本，不能只改 `INFOQ_VERSION` 切换应用镜像。应使用已评审的 Compose override 或恢复旧版本 checkout 与配置，核对将使用的镜像 ID 后再启动。不要在恢复旧镜像后重新运行会构建新镜像的 `install.sh/deploy`；Apple 也不要省略 `--no-build`。回滚后重新检查容器、readiness、登录、关键 API 与日志，再恢复流量。

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
- `VITE_APP_ENCRYPT=true` 时，两端构建配置与后端 `api-decrypt` 必须匹配：前端公钥对应后端私钥，前端私钥对应后端公钥，这是两组密钥。前端私钥进入浏览器包，不能提供服务端秘密保护，仍需 HTTPS；安装器不生成 RSA，也不会把宿主 `VITE_APP_RSA_*` 自动传入 Docker builder。受控配置方式见 `README.md` 第 1.4 节。

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

以下是当前实现事实，不代表已经修复或通过生产验收：

- Docker 后端/前端 helper 对运行目录执行 `chmod 777`，Redis 含密码配置设置为 `644`；`prepare/start/deploy` 会再次应用相关权限。生产必须先完成 UID/GID、目录和秘密读取权限治理，不能用一次手工收紧权限掩盖后续覆盖。
- Compose 默认把数据库、Redis、MinIO、后端和前端直连端口发布到所有网卡；默认网关仅监听 HTTP，映射 `443` 或设置 HTTPS 公共地址不会启用 TLS。必须先收紧网络并验证实际 TLS 配置，且防止 helper 重写配置。
- `infoq.sh` 使用浮动 `minio/mc:latest` 初始化 bucket，并执行 `mc anonymous set download`。业务文件不能默认公开；必须评审 bucket 访问策略、固定实际辅助镜像并验证上传/下载授权后上线。
- Compose 使用固定通用容器名；卸载按名字删除，不自动核验 ownership 标签。部署、停止、卸载前必须人工核对实际容器和挂载属于本项目；同名冲突即停止，不得误删其他项目。
- Apple 仅为本机后端验证，不替换基线管理员/RSA、不提供 MinIO 或自动重启。不能把 Apple smoke 通过作为生产凭据或完整栈验收。
- healthcheck 与 smoke 不创建外部告警。上线前需指定日志采集、轮转/保留、磁盘/备份/依赖/HTTP 失败告警及接收人，并留存告警与恢复演练证据。容量、真实跨平台、备份恢复和故障域可用性均需目标环境验证。
