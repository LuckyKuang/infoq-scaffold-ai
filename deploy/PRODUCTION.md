# Linux Docker 生产配置与安全迁移

Linux Docker Engine + Compose v2 是生产验收基线。以下仓库工具能拒绝无效输入并提供迁移边界，不能代替目标环境的证书链信任、容器用户写入、真实签名访问、备份恢复、告警和容量验收。真实凭据或私钥不得粘贴到对话、提交或日志。

## 受控配置与实际运行注入

使用绝对路径的 `INFOQ_ENV_FILE`，文件权限 `0600`；生产 `INFOQ_PRODUCTION_CONFIG_FILE` 指向同一文件（环境与 credentials.txt 不得同路径），安装器、部署、预检与 BuildKit 使用同源配置。helper 将文件当作 dotenv 数据解析，经私有 NUL pipe 导出，不执行其中 shell 表达式。环境文件覆盖调用环境中的同名配置；不使用 `set -x` 或打印文件诊断。

必须提供独立强凭据、`VITE_APP_ENCRYPT=true`、两组独立 RSA（至少 2048 位）、应用与 OSS 的独立 HTTPS 域名、证书及私钥。`deploy/.env.example` 仅列输入，示例值会被拒绝。生产预检：

```bash
node tools/production_config.mjs check --scope deploy --env-file /etc/infoq-scaffold-ai/deploy.env
```

`INFOQ_PUBLIC_BASE_URL=https://app.example.com` 与 `INFOQ_OSS_PUBLIC_ORIGIN=https://oss.example.com` 使用标准 443、不同主机且无路径。证书需要覆盖两个主机；`INFOQ_TLS_CERT_FILE` 可以包含叶子与中间链，`INFOQ_TLS_KEY_FILE` 为匹配私钥，权限 `0600`。校验覆盖 PEM、链内签名、有效期、主机 SAN 和密钥匹配；真实 production 拒绝自签叶子证书（只有显式 isolated-test 可用于隔离测试）；组织 CA/公网链信任、DNS 与吊销状态仍须在 Linux 实机验证。无 TLS 材料或校验失败时停止，绝不切回 HTTP。

`prepare/start/deploy/restart` 的配置预检先于目录/Compose 写入。前端 helper 将证书及网关配置写入 `${INFOQ_DEPLOY_ROOT}/nginx/`，每个文件使用同文件系统暂存和 rename，失败恢复旧文件；暂存只为原子替换，完成后清理。证书先写、配置最后替换，禁止并发部署或在渲染期间重载 nginx。重跑保留 HTTPS；`nginx -t` 通过后才重建网关。HTTP 仅重定向 HTTPS。已有手工 TLS 配置应先备份并迁移到受控输入，不继续手工维护生成文件。

`managed-security.yml` 是 helper 生成且最后载入的 Spring 配置，只有环境占位符，权限 `0600`；它将经校验 DB/Redis/token/RSA 注入运行配置，覆盖旧应用配置中的同名值。两组 RSA 的方向是：前端请求公钥 ↔ 后端请求私钥；前端响应私钥 ↔ 后端响应公钥。后端请求私钥不会注入前端构建产物；前端协议私钥仍会进入浏览器，公网必须 HTTPS。应用 `start/restart` 保留部署批次并重建应用容器，使 env 与启动时 OSS 缓存同步，不改数据卷。

双端 `all` 允许安全的不同 context path（默认 `/vue/`、`/react/`），builder、网关和 OAuth callback map 使用同源值。单端使用 `/`；生产管理页面仍须通过网关访问。

## 网络与私有存储

Compose 的 MySQL、Redis、MinIO、后端、独立前端端口默认仅绑定 `127.0.0.1`；`INFOQ_INTERNAL_BIND_HOST` 只接受 loopback。公网只开放网关 80/443，80 执行 HTTPS 重定向。Docker socket 属于高权限接口，不通过开放 socket 或 `0777` 修复权限。

MinIO API 由独立 OSS 域名根路径代理，保留原始 `Host` 和 URI；不要增加 `/oss/` 前缀、改写签名 URL，或用公开 bucket 解决签名失败。数据库配置使用内部 `endpoint=http://minio:9000` 与外部 `domain=INFOQ_OSS_PUBLIC_ORIGIN`，两者协议分离。网关访问日志不记录 query，避免临时签名泄漏。Console 仍经主站 `/console-oss/`，生产可以另加组织网络访问控制。

辅助工具由 `deploy/docker/Dockerfile.mc` 构建为本地固定标签 `infoq/infoq-mc:RELEASE.2025-08-13T08-35-41Z`。它下载官方 GitHub release 的 Linux amd64/arm64 二进制，逐架构校验仓库固定 SHA256，并保留官方 LICENSE/CREDITS；下载 stage 为 `node:24.18.0`，运行 stage 为 `busybox:1.37.0`。Dockerfile 经 stdin 构建，没有文件上下文，不把部署配置、证书或秘密送入构建。执行前校验 Docker daemon 架构、镜像归属/版本标签及实际二进制 SHA256/版本，随后使用不可变镜像 ID；本地同名镜像校验失败时拒绝运行和覆盖。

`ensure --execute` 可在镜像缺失时先显式准备工具，再创建缺失 bucket（S3 默认私有）并读取策略；已有匿名或自定义策略明确失败，不自动修改。镜像构建、匿名下载、SHA256、认证和未知响应错误立即失败，不伪装为 bucket 尚未就绪；仅明确的 S3 临时服务错误允许有限重试。只有确认私有后，部署才同步 `sys_oss_config.access_policy='0'`。自定义 OSS 配置保留原有显式覆盖门禁。默认约 120 秒的授权签名访问、匿名拒绝、过期拒绝及 API 权限需实机验证。

## 既有公开 bucket 的显式迁移

在已加载同一受控环境的 shell 中执行。命令只处理当前项目所属 MinIO 容器的指定 bucket；未知策略、挂载或归属不符停止，不删除对象。凭据经容器环境传递，不能拼接进 CLI 参数或日志。

```bash
# 首次使用须显式准备工具；plan/migrate/restore 的预览不会构建或拉取镜像：
node deploy/bin/minio-policy.mjs prepare-tool --execute
node deploy/bin/minio-policy.mjs plan
node deploy/bin/minio-policy.mjs migrate --backup /secure-backups/infoq-policy.json
# 人工核对目标/策略并获环境变更授权后执行：
node deploy/bin/minio-policy.mjs migrate --backup /secure-backups/infoq-policy.json --execute
```

默认只预览；执行时以 `0600`、不覆盖方式保存原策略、资源身份和严格校验和，设置 private 后回读；失败自动恢复并核验原策略，恢复失败阻塞上线。MinIO/mc 在读回相同 S3 `Action` 集合时可能返回不同顺序，运行态等价性比较只允许这一顺序差异；动作、权限、主体、资源、条件和其他字段仍须一致，备份原始 JSON 与校验和不作规范化或改写。恢复原策略本身会重新开放匿名访问，需独立评审与授权：

```bash
node deploy/bin/minio-policy.mjs restore --backup /secure-backups/infoq-policy.json
node deploy/bin/minio-policy.mjs restore --backup /secure-backups/infoq-policy.json --execute
```

迁移后重新运行受控部署以同步数据库策略并重启应用缓存；备份与当前容器身份不匹配时停止，不因名称相同就强制恢复。

修改工具镜像、`mc` 版本或策略协议时，先运行 `node deploy/bin/test-production-runtime.mjs`，再在 owned Linux MinIO 上核验固定二进制版本及 `private/download/upload/public` 的 `anonymous get-json` 响应，最后验证迁移/回读/恢复。`set-json` 使用容器 tmpfs 内的 `0600` 临时普通文件并在退出时移除；固定 `mc` 会两次打开文件，不能替换为 `/dev/stdin`。回归必须覆盖镜像准备错误只失败一次、预览零 build/pull、伪造标签/架构/二进制拒绝、未知策略/协议拒绝、认证失败不重试、原始策略恢复与秘密日志检查；替身不能替代实际 Linux 下载、容器启动与 S3 协议证据。

## 首次部署的镜像用户与新目录

后端 helper 在 pull/build 之后、compose up 之前调用 `prepare-volume-users.mjs`；前端在 build 后、启动前执行。工具内存读取 Compose v2、核验不可变镜像 ID，并在 `--network none` 的短命容器中解析实际 UID/GID。MySQL/Redis 使用镜像业务账户；MinIO 采用镜像 `Config.User`，为空或无法确认时必须先审阅 entrypoint 并显式提供 `INFOQ_MINIO_IMAGE_USER`，不能猜 root。无 shell/id 或账户不可解析时明确失败，不自动降级权限。

工具只对 helper 本轮明确新建、项目 owned、仍为空且未共享挂载的可写目录设置最小 owner/`0750`；已有目录不自动 chown。它按目标 UID/GID 真实写入、读回和删除随机探针文件，再允许服务启动。探针必须位于目标挂载中以验证权限，退出前清除；失败恢复本轮目录原 uid/gid/mode，恢复失败阻塞启动。已有目录不可写时停止并引导下节显式迁移。实际 Docker 容器不可用时此入口不能通过，替身仅验证命令和状态边界。

```bash
# 在已加载同源受控环境的 shell 中，默认只读预览（不启动 id/写入探针容器）：
node deploy/bin/prepare-volume-users.mjs --services mysql,redis,minio,infoq-admin
# 人工授权后验证已有目录；此命令不自动改它们的 owner：
node deploy/bin/prepare-volume-users.mjs --services mysql,redis,minio,infoq-admin --execute
```

首次安装直接执行 helper 的 `deploy`，它在同一进程内准备目录并传递新目录清单。单独运行 `prepare` 后再运行 `start/deploy`，清单不会跨进程保留；工具把这些目录当作已有目录，仅验证读写，非 root 镜像可能明确失败。不能凭“目录为空”自动认领它。

若已单独执行 `prepare`，先按 [DOCKER.md 第 6 节](DOCKER.md#6-部署环境文件) 安全加载同源环境，并核对项目标记、目录确为此次准备创建、仍为空、无其它服务挂载。以下后端示例仅适用于全部条件成立的首次空目录；按实际部署根调整，不得加入旧数据目录。先准备实际镜像，再预览核对，获目标环境操作授权后执行：

```bash
bash deploy/bin/infoq.sh build-image
COMPOSE_PROJECT_NAME="${INFOQ_COMPOSE_PROJECT_NAME:-${COMPOSE_PROJECT_NAME:-infoq-scaffold-ai}}" \
  docker compose -f deploy/docker/docker-compose.yml pull mysql redis minio
volume_init=(--services mysql,redis,minio,infoq-admin
  --new-dir "${INFOQ_DEPLOY_ROOT}/mysql/data"
  --new-dir "${INFOQ_DEPLOY_ROOT}/mysql/conf"
  --new-dir "${INFOQ_DEPLOY_ROOT}/redis/data"
  --new-dir "${INFOQ_DEPLOY_ROOT}/minio/data"
  --new-dir "${INFOQ_DEPLOY_ROOT}/server/logs")
node deploy/bin/prepare-volume-users.mjs "${volume_init[@]}"
node deploy/bin/prepare-volume-users.mjs "${volume_init[@]}" --execute
bash deploy/bin/infoq.sh start
```

前端分开准备时，先执行 `deploy-frontend.sh build <target>` 并 pull `nginx-web`，只枚举目标前端服务与 `nginx-web`；可初始化的新空目录是所选 `${INFOQ_DEPLOY_ROOT}/vue/logs`、`${INFOQ_DEPLOY_ROOT}/react/logs` 与 `${INFOQ_DEPLOY_ROOT}/nginx/log`。`--new-dir /absolute/path` 是显式授权初始化该空目录，仍受归属、空目录和共享检查约束；已有数据或无法证明本次新建的目录走下节迁移，不清空或删除重试。

## 目录权限迁移

helper 创建缺失目录为 `0755`，不会盲目递归改旧 owner。实际镜像可能在 entrypoint 中切换用户，必须核验目标镜像中的真实运行账户；不能把 `Config.User` 为空直接当作业务进程是 root。

权限工具仅处理明确服务的一个数据或日志 bind mount，核验不可变镜像 ID、Compose project/service、规范路径/无链接及镜像账户 UID/GID，批量核验所有容器以拒绝共享或重叠挂载。示例 UID/GID 是占位，必须替换为目标镜像实际结果；不可照抄当作通过证据：

```bash
node deploy/bin/migrate-permissions.mjs --service redis --image-user redis --uid 999 --gid 999 --backup /secure-backups/redis-permissions.json
# 先备份并授权停止该目标服务；实际执行必须是 stopped：
node deploy/bin/migrate-permissions.mjs --service redis --image-user redis --uid 999 --gid 999 --backup /secure-backups/redis-permissions.json --execute
```

预览不写文件；执行核验服务已停止，生成 `0600` 的数据 tar 和 SHA-256、逐项原 uid/gid/mode manifest，再对已枚举且身份未变化的文件修改；目录 `0750`、普通文件 `0640`（已有执行文件保留最小执行位）。不触碰配置目录、部署根、符号链接、硬链接或特殊文件。数据 tar 是此文件范围的完整性备份，不等同于数据库逻辑一致性备份。失败恢复原权限，失败恢复失败时禁止启动。

```bash
node deploy/bin/migrate-permissions.mjs --service redis --image-user redis --uid 999 --gid 999 --backup /secure-backups/redis-permissions.json --restore
node deploy/bin/migrate-permissions.mjs --service redis --image-user redis --uid 999 --gid 999 --backup /secure-backups/redis-permissions.json --restore --execute
```

恢复只恢复权限；校验归属、tar 哈希与文件身份，不覆盖新增/替换文件，不自动恢复数据。迁移和恢复后均须在目标 Linux 重启、真实写入、读回和再次重启验证，未执行即 blocked。首次部署通过上节入口在启动前核验实际 UID/GID 与写入；真实服务 entrypoint、读写和重启还须实机验收，不能因 `0755` 本身判定可写。

## 可复用隔离回归 SOP

触发条件：修改生产预检、TLS 渲染、Compose 端口/secret、MinIO 策略或权限工具。先执行主流程，再覆盖错误边界，最后语法、编码与 diff：

```bash
node deploy/bin/test-production-runtime.mjs
node skills/deploy-cli/scripts/test_deploy_safety.mjs
node skills/deploy-cli/scripts/test_deploy_cli.mjs
node tools/validate_utf8.mjs deploy skills/deploy-cli
git diff --check
```

新回归使用真实临时证书、Node crypto、tar 和目录权限操作，Docker 命令使用有状态隔离替身；证据在 `tmp/production-readiness/deploy/runtime-results.json`。覆盖 TLS 重渲染/失败恢复、错误证书/key/SAN/时间、路径冲突、私有 bucket、策略迁移/恢复与权限迁移/失败恢复。反模式包括只匹配文案、把替身当真实 S3、把 `Config.User` 当 entrypoint 后用户、用宽权限/公开桶绕过测试、只检查文件存在、不核失败恢复，以及把本机 Apple 结果记为 Linux 验收。

目标 Linux 必须另跑 [VERIFICATION.md](VERIFICATION.md) 并验证真实镜像 UID/GID/写入、nginx `-t`、受信 HTTPS、仅网关公网、双端与 OAuth、匿名无签名拒绝、签名约 120 秒有效/过期拒绝、停机备份/隔离恢复和回滚。没有目标 Docker、生产 CA/凭据或容量目标时准确记录 blocker，不宣称生产就绪。

## 原生 bind 首次安装验收 SOP

触发条件：修改安装器、目录准备/镜像用户、数据 bind、运行注入或 helper 重启链路。`linux_acceptance.mjs` 的隔离运维栈会用 named volume 承载部分数据；它不能代替这里的真实首次 bind 安装。此入口直接调用 `deploy/install.sh`，不提前 `prepare`、不改 Compose、不以 named volume 替换生产 bind。

在专用 Linux Docker 主机或授权的 Linux VM 内运行。macOS 使用 Colima 时，先把当前源码复制到 VM 原生 `/home/...`，在 VM 内安装仓库固定 Node 基线并运行；不能从 macOS 侧用共享 checkout 路径或 Docker socket 假装完成 Linux owner/chown 验收。入口用 `findmnt` 拒绝 virtiofs、9p、NFS、FUSE 和未知文件系统；Docker 组权限不能替代宿主 root 的 chown 权限。固定容器名和默认端口必须空闲，同一 VM 内其它全栈验收先按其 owned 边界收口，不并行占用。

先审阅目标 MinIO 不可变镜像 ID、`Config.User`、entrypoint 及实际账户探测结果。`--minio-image-user` 必填，工具不默认猜 root；下面 `0` 只适用于已确认实际以 UID/GID 0 运行的镜像和配置。镜像、entrypoint 或环境变化后必须重查，不能照抄历史结论：

```bash
node tools/verify/first_install_acceptance.mjs --help
node tools/verify/first_install_acceptance.mjs --run-id bind-first-001 --minio-image-user 0
# 审阅目标、端口、影响与 cleanup，获专用环境操作授权后，在 Linux VM 内执行：
sudo -n env PATH="$PATH" node tools/verify/first_install_acceptance.mjs \
  --run-id bind-first-001 --minio-image-user 0 --execute
```

预览不调用 Docker、不生成配置。execute 使用全新 `tmp/production-readiness/first-install-<run-id>/`，生成随机凭据、两组独立 RSA 和双域自签证书；同源 `0600` 文件通过真实安装器进入 build/runtime。已有 run 目录、容器、project 或端口一律拒绝，不自动清空重试。依次核 readiness/HTTPS、精确匿名权限、验证码种子真实加密登录与受保护菜单、私有 S3 的签名成功/匿名拒绝/过期拒绝、实际 daemon UID/GID 与 bind owner/读写删除，再重启基础服务并执行真实 backend/frontend helper 的 `restart`，复验同账号登录、SQL 字段/关联 hash、对象 hash 和网关权限。此处短期签名用 5 秒核实际过期，不替代产品默认约 120 秒的授权 API 验收。

状态为 `first-install.state.json`，含 pid、childPid、port、stage、日志和逐项证据；`install.redacted.log` 按完整行删除本轮已知秘密后保存，禁止复制私有配置或原始构建输出来排障。安装子进程组在超时、中断和失败时真实终止并核验；任何验证或 cleanup 失败均非零。finally 只删除本轮归属核验通过的容器、匿名卷与 network，验证默认端口释放；保留受控配置、证书、bind 数据和脱敏证据，供人工定位/清理。不要把旧 run 改名复用来绕过全新目录约束。

入口安全回归先跑 `node tools/verify/test_first_install_acceptance.mjs`，覆盖预览零写、原生/共享文件系统边界、错误归属/越界 bind 拒绝、实际 shell 跨 chunk 脱敏、非零/超时/中断及进程组退出；再执行 Node syntax、定向 UTF-8 与 diff review。该回归不启动 Docker，只有真实 Linux 运行结果才能填写首装 passed。反模式包括先手工 chown/chmod 再证明首装、使用 `0777`、替换 named volume、关验证码/加密、重用已有数据库、吞掉安装/清理错误，以及把 VM 自签 fixture 通过写成生产证书或真实 Provider 验收通过。恢复、回滚、双端 DOM 和容量的完整验收仍走独立 `linux_acceptance.mjs` 与运维 SOP。
