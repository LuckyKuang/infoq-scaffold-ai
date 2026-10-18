# InfoQ 部署验证

本文核对完整 Compose 栈的部署与 smoke，适用 WSL2 Debian/Ubuntu Docker CE、macOS Colima、Linux Docker CE。版本发布归 `release-cli`，业务后端测试归 `tools/verify/`，前端测试归 `test-cli`，数据操作归 [DATA-OPS.md](../docs/DATA-OPS.md)。本流程不是已执行结果，历史运行不能代替当前环境证据。

## 执行前门禁

1. 明确全新部署、已有栈复核、诊断或停止/卸载，写清验收范围、异常、证据及回滚条件。已有授权按目标动作判断；部署状态/数据高风险操作先获得明确确认，不因审计而执行。
2. 阅读 [运行时矩阵](runtime-matrix.md)、[部署指南](README.md)、[Docker 流程](DOCKER.md) 和 [生命周期](DEPLOYMENT_LIFECYCLE.md)。先只读检查运行时版本、当前 context、容器/挂载归属、端口和配置字段，不打印秘密。`colima start`、`docker context use`、安装和启动均会修改状态，不属于只读探测。
3. 确认 Docker daemon、Compose、Buildx 与镜像/依赖下载能力。Compose 在 Maven 3.9.12 / JDK 21 builder 内打包，宿主不要求 Java/Maven；前端 builder 固定 Node 24.18.0，pnpm 10.34.1。Docker 权限等同主机高权限，不随意放宽 socket 权限。
4. 显式选 `INFOQ_DEPLOY_ROOT`；WSL2/Linux 通常 `/infoq`，Colima 通常 `$HOME/infoq`，WSL 数据禁止 DrvFS。预创建 `/tmp/infoq-deploy` 和 `${INFOQ_DEPLOY_ROOT}/server/temp`；权限不足由授权管理员处理，不能跳过。
5. 核对 `INFOQ_FRONTEND_TARGET=all|vue|react`、公共 URL、端口与秘密来源。环境文件/凭据文件必须 `600`，由有权限的属主/root 执行；生命周期 helper 将其作为数据解析并与构建同源，禁止注入 PATH/NODE_OPTIONS 等运行时控制字段。不要用打印文件或 `set -x` 诊断。目标目录或通用容器名与其他项目冲突即停止。
6. 先按 [PRODUCTION.md](PRODUCTION.md) 验证生产同源配置、两组独立 RSA、主站和独立 S3 域名、匹配且有效的 TLS 及旧 bucket/目录迁移。辅助端口默认 loopback。配置预检通过仍需本节实际运行；不把映射 443 或 fixture 当受信 HTTPS 证据。

## 部署与运行时

从已审阅的 release checkout 根目录执行，详细平台命令见 [README.md](README.md) 与 [DOCKER.md](DOCKER.md)：

```bash
sudo env INFOQ_SOURCE_DIR="$(pwd)" INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env INFOQ_PRODUCTION_CONFIG_FILE=/etc/infoq-scaffold-ai/deploy.env INFOQ_PRINT_SECRETS=0 bash deploy/install.sh
```

WSL2 Windows 入口见 [专项步骤](wsl2-docker-compose.md)。macOS Colima 需先获得启动/切换 context 的授权，并在 root 安装进程显式传递用户的 `DOCKER_HOST` / `DOCKER_CONFIG`，不能直接套 Linux 示例。安装器无安全的 `--help` 或 dry-run，源码与已有 env 覆盖时序见生命周期。

Node `deploy-cli` 在 macOS 固定使用 Apple 后端栈，Colima 必须走 Docker shell 入口；WSL2/Linux 才能使用 Node 的 Docker 分支。Apple `status` 会在 daemon 停止时启动系统服务；严格只读用 `container system status` 与 `smoke`，不能将其当作完整栈验收。

## 部署后检查

在部署账号可读环境文件且可操作 Docker 的 shell 中执行。按实际已部署地址调整 `INFOQ_VERIFY_GATEWAY`；HTTPS 必须校验真实证书，不用 `-k`。先枚举本项目容器与挂载，确认没有操作其他项目。以下自动检查使用本地固定后端端口 `9090`，网关 `INFOQ_PUBLIC_BASE_URL`（HTTPS）；不适用于远程 daemon。

```bash
mkdir -p tmp/deploy-verify/current
(
  set -euo pipefail
  set +x
  export INFOQ_ENV_FILE=/etc/infoq-scaffold-ai/deploy.env
  SCRIPT_DIR="$(pwd)/deploy/bin"
  . "${SCRIPT_DIR}/runtime-env.sh"
  load_runtime_env_data "${INFOQ_ENV_FILE}"
  node tools/production_config.mjs check --scope deploy
  INFOQ_VERIFY_GATEWAY="${INFOQ_VERIFY_GATEWAY:-${INFOQ_PUBLIC_BASE_URL}}"
  INFOQ_VERIFY_GATEWAY="${INFOQ_VERIFY_GATEWAY%/}"
  case "${INFOQ_FRONTEND_TARGET}" in all|vue|react) ;; *) exit 2 ;; esac

  http200() {
    local code
    code="$(curl --noproxy '*' --silent --show-error --max-time 15 -o /dev/null -w '%{http_code}' "$1")"
    printf 'HTTP %s %s\n' "${code}" "$1"
    [[ "${code}" == 200 ]] || return 1
  }

  docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
  http200 http://127.0.0.1:9090/monitor/health/readiness
  http200 http://127.0.0.1:9090/monitor/health/liveness
  http200 "${INFOQ_VERIFY_GATEWAY}/prod-api/monitor/health/readiness"
  if [[ "${INFOQ_FRONTEND_TARGET}" == all ]]; then
    http200 "${INFOQ_VERIFY_GATEWAY}${INFOQ_VUE_CONTEXT_PATH:-/vue/}"
    http200 "${INFOQ_VERIFY_GATEWAY}${INFOQ_REACT_CONTEXT_PATH:-/react/}"
  else
    http200 "${INFOQ_VERIFY_GATEWAY}/"
  fi
  case "${INFOQ_FRONTEND_TARGET}" in
    all) http200 http://127.0.0.1:9091/; http200 http://127.0.0.1:9092/ ;;
    vue) http200 http://127.0.0.1:9091/ ;;
    react) http200 http://127.0.0.1:9092/ ;;
  esac
  http200 "${INFOQ_VERIFY_GATEWAY}/console-oss/"
  http200 "${INFOQ_OSS_PUBLIC_ORIGIN}/minio/health/live"
  http200 http://127.0.0.1:9000/minio/health/live

  # 使用容器已有环境认证，秘密不进入命令行 SQL 或输出。
  menu_count="$(docker exec mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot -Nse "SELECT COUNT(*) FROM infoq.sys_menu;"')"
  [[ "${menu_count}" =~ ^[0-9]+$ && "${menu_count}" -gt 0 ]]
  tables="$(docker exec mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot -Nse "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=0x696e666f71 AND LOWER(table_name) IN (0x7379735f6a6f62,0x7172747a5f6c6f636b73,0x7379735f6f617574685f70726f7669646572,0x7379735f6f617574685f6964656e74697479);"')"
  [[ "${tables}" == 4 ]]
  pong="$(docker exec redis sh -c 'REDISCLI_AUTH="$REDIS_PASSWORD" exec redis-cli --no-auth-warning ping')"
  [[ "${pong}" == PONG ]]
  printf 'PASS structure and Redis checks\n'
) > tmp/deploy-verify/current/smoke.log 2>&1
INFOQ_VERIFY_EXIT=$?
printf '%s\n' "${INFOQ_VERIFY_EXIT}" > tmp/deploy-verify/current/smoke.exit
cat tmp/deploy-verify/current/smoke.log
```

将 `current` 换成实际 run-id，避免覆盖上轮证据。`smoke.exit` 必须为 `0`，日志中各无条件 GET 必须 `200`；`302`/`304`、超时、查询失败、错误计数、非 PONG 均失败。外层交互 shell 若已启用 `set -e`，失败可能直接退出，退出码需由调用方保存，不能只看最后打印的状态。容器 `healthy`、readiness body 的 database/redis `UP` 与上面 HTTP 结果还须人工对应，`docker ps` 的退出码本身不检查健康状态。

SQL 示例只验证结构，不验证安装器凭据与数据库记录的相等关系。管理员、OSS 配置及授权须在受控会话按 [DATA-OPS.md](../docs/DATA-OPS.md) 核验，并实际完成登录、菜单、关键 API 与授权上传/下载；日志只保存脱敏结论，禁止把密码/secret_key 拼入可留存 SQL 或结果。不得仅凭这些查询或 HTTP 200 宣称业务与生产安全通过。

## 日志与失败处理

- readiness 失败先查看 `INFOQ_ENV_FILE=... bash deploy/bin/infoq.sh logs infoq-admin`、MySQL/Redis 与 Nginx 日志；`logs` 持续跟随，`Ctrl-C` 只退出查看。后端日志在 `${INFOQ_DEPLOY_ROOT}/server/logs/`，网关在 `nginx/log/`，目标前端在 `vue/logs/` / `react/logs/`。
- Redis 权限错误核对 owner/UID 与配置读取权限；helper 使用无密码只读配置并拒绝 other-writable 目录；管理员核验镜像 UID/GID 后迁移旧权限，不用开放全部目录或删除持久化数据解决。
- 前端直连成功、网关 404/502 时核对 context、目标前端和 upstream DNS；重建前端后需受控刷新 Nginx。重跑 `deploy` 会重建与写配置，不是只读诊断。
- Docker credential helper 错误按 `DOCKER.md` 核对；临时 `DOCKER_CONFIG` 放在 `tmp/`，记录并恢复原 context/env，不因失败切换到其他未经选定的运行时。
- 保存命令、平台、脱敏日志和退出状态；镜像拉取 EOF、构建失败、坏配置、SQL 部分迁移分别记录原因。按生命周期恢复旧镜像/配置并重新 smoke；不删除数据重试，不把失败当作完成。

## 停止、卸载与收口

只在任务要求停止时执行，先停止前端/网关，再后端及 MySQL/Redis/MinIO；普通停止保留数据。一次性验证必须记录本次创建的栈，结束、失败或中断后显式收口自有资源；不能停止开始前已有服务。生产滚动更新先摘流量，不能用停整栈替代。

卸载先 `bash deploy/uninstall.sh --dry-run`；它仍会读取可信 env 并询问每项选择。实际卸载需明确授权与固定确认短语，独立确认应用、MySQL、Redis、MinIO、配置与空根目录；任何删除前脚本批量核验所选容器的 Compose 标签/部署挂载与默认网络标签，按核验 ID 删除；查询失败或归属未知即停止，孤立目录必须有匹配 project 的 `.infoq-deploy-owner`；无标记的旧数据需另行证明归属，保留项不停止不删除。可选中间件由 `deploy-middleware.sh <component> <topology> stop` 单独管理，不在基础卸载范围内。

收口报告包含运行时/root/目标、容器健康、readiness/liveness、网关与直连、结构与登录/OSS、失败与恢复证据、停止/保留状态，以及未验证的容量、告警、TLS、跨平台、备份恢复。没有执行的步骤明确写未验证。脚本修改先通过 `node deploy/bin/test-production-runtime.mjs`、`node skills/deploy-cli/scripts/test_deploy_safety.mjs` 与 `node skills/deploy-cli/scripts/test_deploy_cli.mjs`，再执行语法、UTF-8 与 diff 检查；不以真实部署替代隔离回归。

## Linux 生产补证

除上面 smoke 外，必须使用受控 CA 检验 HTTPS（不用 `-k`），核实外网无法直连辅助端口；完成双端根/子路径与 OAuth、精确匿名小程序探测、真实文件上传和约 120 秒签名 URL、匿名和过期拒绝。旧公开 bucket 先预览/备份/显式迁移，目录按真实镜像用户做权限迁移及重启写入验证，命令见 [PRODUCTION.md](PRODUCTION.md)。恢复、回滚、告警与容量工具见 [生产运维 SOP](../docs/PRODUCTION-OPS.md)。若 Docker/CA/凭据/告警目的地或验收目标缺失，分别记 blocked；不能用 Apple 替代 Linux，也不能将生成的 workflow 当作已执行证据。
