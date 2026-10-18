# 生产保障与隔离恢复

Linux Docker 是生产验收基线。本页的可执行工具仅接受显式隔离目标；共享/生产恢复仍遵守 [数据运维门禁](DATA-OPS.md)。2026-10-18 已在 macOS 的独立 Colima Ubuntu VM 中通过真实整栈验收和 owned 清理；安装与环境处理见 [Colima SOP](../deploy/COLIMA.md)。这是本机兼容验证，新 Linux workflow 尚未远程执行，真实生产条件仍须独立验收。

## 入口与影响

```bash
node tools/verify/production_ops.mjs --help
node tools/verify/linux_acceptance.mjs --help
node tools/verify/linux_acceptance.mjs --run-id acceptance-001
```

`production_ops.mjs` 支持 `inspect`、`backup`、`verify-backup`、`restore`、`rollback`、`checks`、`alert`、`capacity`、`cleanup`。命令默认预览：可读取受控配置、备份校验和及 Docker inspect/config，**不写文件、不访问 HTTP、不启停资源**。追加 `--execute` 才执行并在当前 run root 的 `evidence/` 写状态；同一 run 不并行执行运维命令。

执行目标必须为 `infoq-verify-*` project，所有服务、实际容器及已有卷/网络必须匹配 `com.infoq.ops.run` 和 Compose project 标签；名字相似不等于归属。工具还批量 inspect 其他容器，拒绝它们共享/重叠当前数据卷或 bind mount。只连接本机 Linux Docker context，不接受 `DOCKER_HOST` / `DOCKER_CONTEXT` 覆盖、远程 daemon、external volume/network、跨 run bind mount、特权容器或共享 namespace。所有已发布端口必须显式 loopback。HTTP/S3 URL 端口还须对应当前 owned service 的端口，不能借隔离配置访问无关服务。

配置、秘密、备份和证据均在仓库 `tmp/`；拒绝路径越界、符号链接、硬链接、空配置和宽权限秘密文件。POSIX 秘密文件须 `0600`；Windows Node CLI 回归不等于 Linux 容器权限验证。不要上传整个 `tmp/`，其中可能含数据库、对象、密钥及会话。

## 受控配置

Linux 验收 runner 自动生成完整配置，可用其 `ops.json` 理解字段；手工运行时 JSON 结构如下，实际路径须存在并属于该 run：

```json
{
  "version": 1,
  "runId": "run-example",
  "project": "infoq-verify-example",
  "root": "tmp/production-readiness/example",
  "composeFile": "tmp/production-readiness/example/compose.json",
  "environmentFile": "tmp/production-readiness/example/production.env",
  "secretsFile": "tmp/production-readiness/example/ops-secrets.json",
  "services": {"mysql": "mysql", "minio": "minio", "application": "infoq-admin"},
  "database": "infoq",
  "sqlChecks": [
    {"name": "user-relations", "sql": "SELECT user_id,role_id FROM sys_user_role ORDER BY user_id,role_id"}
  ],
  "checks": [
    {"name": "readiness-check", "kind": "readiness", "url": "http://127.0.0.1:19090/monitor/health/readiness", "status": 200, "timeoutMs": 10000, "json": {"status": "UP"}},
    {"name": "protected-menu", "kind": "business", "url": "http://127.0.0.1:19090/system/menu/getRouters", "status": 200, "timeoutMs": 10000, "authorizationKey": "bearer", "headers": {"clientid": "e5cd7e4891bf95d1d19206ce24a7b32e"}, "json": {"code": 200}}
  ],
  "s3": {"origin": "http://127.0.0.1:19000", "bucket": "infoq", "maxObjects": 100, "maxBytes": 134217728}
}
```

`secretsFile` 是 `0600` JSON，字段为 `accessKey`、`secretKey`、`databaseUser`、`databasePassword`，以及授权检查需要的 `bearer`。数据库密码接受 24–128 位字母、数字、`@#_+.-`，防止恢复 SQL 插值突破边界。真实验证码登录的恢复配置还需要 `services.redis`、`authentication.backendUrl`、`authentication.redisPort`，秘密文件提供 `adminUsername`、`adminPassword`、`requestPublicKey`、`redisPassword`；runner 已接线。秘密不可放在 argv、日志、manifest 或 Git。

`sqlChecks` 是运维审阅的单条 `SELECT`，工具禁止多语句、注释、写文件和已知阻塞函数。必须根据业务补充关键计数、字段、关联及排序；默认摘要不能证明未列入的业务数据。SQL 结果只保存 SHA-256 和行数，不保存字段值。选择可预期、低成本且有序的查询，工具输出上限和超时不能代替生产查询计划审查。

## 备份与隔离恢复

```bash
node tools/verify/production_ops.mjs backup --config tmp/production-readiness/example/ops.json --backup tmp/production-readiness/example-backup
node tools/verify/production_ops.mjs backup --config tmp/production-readiness/example/ops.json --backup tmp/production-readiness/example-backup --execute
node tools/verify/production_ops.mjs verify-backup --config tmp/production-readiness/example/ops.json --backup tmp/production-readiness/example-backup
node tools/verify/production_ops.mjs restore --config tmp/production-readiness/new-target/ops.json --backup tmp/production-readiness/example-backup
node tools/verify/production_ops.mjs restore --config tmp/production-readiness/new-target/ops.json --backup tmp/production-readiness/example-backup --execute
```

备份会暂时停止 owned application，使用容器内既有 `MYSQL_ROOT_PASSWORD` 执行 `mysqldump --single-transaction`，并通过 SigV4 分页列出/读取整个目标 bucket。MySQL 凭据不进入宿主 argv；dump、对象及 manifest 是受控备份数据。应用外的写入方必须先停止；工具仅停止一个声明的 application 服务，不能宣称跨外部写入方获得原子快照。多副本应用不在本工具范围，必须先按独立停写方案收口。

manifest 保存来源 project/run、镜像 ID、时间、工具版本、数据库/bucket 范围、每文件大小/SHA-256、对象 key/内容元数据和数据查询摘要。空数据库导出、损坏、文件类型/链接越界、分页异常、超过对象/字节预算都失败；合法零字节对象保留。对象版本历史、未完成 multipart、bucket IAM/生命周期/复制规则不在逻辑对象备份范围，须单独导出并验证；本项目默认私有 bucket 的权限迁移另见部署文档。当前工具拒绝 URL 会归一化的 `.`/`..` 对象 key，必须单独迁移，不悄悄漏备份。

S3 continuation token 是不透明协议值，只做一次 XML 实体解码，支持五种预定义实体及合法十进制/十六进制数字实体；不递归解码，`&amp;lt;` 保持为 `&lt;`。未知/损坏实体、XML 非法字符、缺少 token 或跨页循环均失败。修改分页时运行 `node tools/verify/test_production_ops.mjs`，核验第二页实际请求 token、正常对象列表与上述拒绝场景，禁止只测字符串替换或把失败当空 bucket。

restore 必须使用完全新的 project、卷、网络、目录和数据库账号，拒绝源目标相同或采用已有资源。导入后重新创建目标数据库应用账号/权限，核验 SQL 字段/关联摘要、对象数量/内容 checksum、readiness 与关键业务 JSON；配置认证时真实验证码登录重新获取目标会话。任何阶段失败都会保留证据并只清理本轮 owned 恢复资源，清理失败使整体失败。恢复资源在成功后同样删除，源数据库和对象不会删除。

结果记录 `backupAgeSeconds`，它只是备份年龄，不能代表业务实际丢失窗口。`rtoSeconds` 可显式限制本轮恢复耗时；未给目标则报告 blocked。RPO 即使配置 `rpoSeconds`，仍需独立核业务提交水位/恢复点和故障时刻，工具不会把年龄冒充 RPO 达标。共享环境恢复点、丢失窗口、责任人和保留/销毁期限须另行审批。

## 应用回滚

在 ops JSON 中增加 `rollback.image`（`repository@sha256:...` 或本机不可变 `sha256:...` image ID）、`rollback.configSha256`（当前 Compose 文件摘要）、`rollback.schemaSha256`（当前 `mysqldump --no-data --skip-comments --compact` 摘要）。这三个值须来自已经验证的旧版本兼容性记录，不能在故障时凭空声称兼容。

```bash
node tools/verify/production_ops.mjs rollback --config tmp/production-readiness/example/ops.json
node tools/verify/production_ops.mjs rollback --config tmp/production-readiness/example/ops.json --execute
```

工具先核本机旧镜像存在和配置/schema 兼容摘要，再确认 readiness 或关键业务失败；健康时不回滚。只替换 application 镜像，不自动拉取、不修改持久数据、不逆向 SQL。启动后核实际镜像 ID、readiness 和关键业务；失败保留失败状态及证据，不能将容器进程存在当作可用。真实回滚还须执行独立登录和关键写入的业务验收，Linux runner 的隔离登录步骤已在 Colima VM 运行通过。schema 摘要是明确兼容性批准的绑定条件，不能自动证明旧代码理解所有新数据。

## 告警与有界容量

`alert` 配置要求 `ruleId`、`receiver`，及 `signal`、`trigger`、`received`、`recovered` 四个独立 HTTP check；每个 JSON 必须精确匹配 `runId`/`ruleId`，接收阶段另匹配 `receiver`。全部阶段存在性、关联和格式在写证据/停服务前完成校验。这些端点应由真实监控规则/接收通道的审计接口提供，不允许用 readiness/stderr 或临时返回成功的服务冒充。没有接收人/回执时明确 blocked。可以设置 `injectService` 暂停一个已核验正在运行的 owned 服务，恢复阶段及 finally 会重启；不注入共享或未枚举资源。告警后端延迟需由审计端保留，当前 CLI 不替通道伪造回执。

`capacity` 必须明确 `url`、预期 `status/json`、`concurrency`（1–64）、`ratePerSecond`（1–100）、`durationSeconds`（1–300）、`maxRequests`（1–10000）、`timeoutMs`（1–60000）；只对当前 application loopback 端口发 GET。完整请求体读取同样受超时约束，运行期限后最多等待单请求期限，不继续发新负载；中断会停止调度、取消请求并等待在途收口。

输出吞吐、p50/p95/p99、错误率、请求数和实际峰值并发；可用 `capacity.slo.p95Ms/maxErrorRate` 提供验收目标。缺 SLO 时测量可以完成但 `acceptance` 为 blocked；超 SLO 时状态 failed 且非零退出。此上限适用于隔离回归，不能据此给生产容量定级；更高负载需单独批准目标、预算和清理措施。

## Linux Docker 全栈验收

```bash
pnpm --dir skills/test-cli/scripts install --frozen-lockfile
pnpm --dir skills/test-cli/scripts exec playwright install --with-deps chromium
node tools/verify/linux_acceptance.mjs --run-id acceptance-001
node tools/verify/linux_acceptance.mjs --run-id acceptance-001 --execute
```

仅在明确可丢弃的本机 Linux 环境执行；要求 Docker Compose v2、BuildKit、openssl、Node 24.18.0、pnpm 10.34.1、可拉取固定依赖镜像。工具不会自动安装 daemon。80/443/19090/19000/16379 和恢复目标对应端口必须空闲。run root 不得已存在，`infoq-verify-*` project 也不得已有容器/卷/网络。生产证书/凭据不作为隔离输入。

runner 使用两组临时 RSA/随机凭据和双域自签证书，执行以下真实步骤；任何失败或缺前置条件非零退出：

| 验收面 | 实际检查 |
| --- | --- |
| 构建 | 当前 Compose 真实 BuildKit/Maven/Vite 构建，前端 strict secret 输入 |
| TLS/端口 | 校验自签链/域名/HTTPS，重渲染 hash 稳定；实际 inspect 端口/归属，所有测试发布端口 loopback |
| 鉴权 | 精确小程序禁用探测、邻近路径/管理数据匿名拒绝；同实例 Redis 种子验证码真实加密登录/菜单 |
| React/Vue | 子路径真实 DOM 受保护页面→登录、授权会话下 profile/刷新；另各做根路径真实构建和 DOM/刷新 |
| 私有存储 | 实际 S3 vhost TLS 代理、签名 Host/path、匿名拒绝、签名有效访问、到期拒绝、匿名 OSS API 拒绝 |
| 容器权限 | 从实际 daemon `/proc` 读取有效 UID/GID，用 `docker exec --user uid:gid` 对其数据/日志目录执行 `test -w`、临时文件创建/删除；MySQL/Redis/MinIO 数据目录在本 runner 中转换为 owned named volumes，不覆盖生产 bind mount 首装初始化 |
| 备份/恢复 | 整库/对象备份、独立 project 还原，字段/关联摘要、对象 hash、真实登录和关键 API |
| 回滚 | 已验证镜像固定 ID，隔离错误候选配置触发失败，再恢复基线配置/镜像并复测 readiness/菜单/登录 |
| 收口 | finally 关闭浏览器，检查 owned 资源后删除容器/网络/卷并复查不存在；失败保留非成功状态 |

OAuth Provider 真连接、外部告警回执、生产信任链/域名/秘密来源、生产负载和业务 RTO/RPO 仍需要目标环境证据。Provider 替身路由验证由 test-cli 对真实前端产物执行，不冒充真实 Provider。该 runner 的回滚是同一已验证镜像与故障候选配置的演练，跨实际版本兼容性须另用真实旧 digest 及兼容批准记录验收。

生产 Compose 保留 MySQL/Redis/MinIO 数据 bind mounts；其新建空目录由 `deploy/bin/prepare-volume-users.mjs` 按目标镜像用户准备。该首装 helper 必须在目标 Linux 使用真实镜像和全新 owned bind 目录单独验收，检查初始 UID/GID、权限、服务写入及重启；named volume 验收通过不能关闭此项。2026-10-18 的 `first-install-bind-first-003` 已在 Colima VM 原生 ext4 上直接调用 `install.sh` 通过：无前置 prepare、无 Compose 改写，实际 daemon UID/GID/0750 目录与读写正确；中间件、后端和前端重启后，SQL 摘要、对象 hash、TLS 和同凭据真实登录/菜单保持；owned 容器/网络/匿名卷清理已核验。目标生产文件系统仍需复验，部署 fixture 不能代替实机结果。首装入口与命令见 [生产配置 SOP](../deploy/PRODUCTION.md#首次部署的镜像用户与新目录)。

runner 将四种真实镜像前端产物提取到 run root 的 `artifacts/`。需要复核 OAuth/回跳时运行 `node skills/test-cli/scripts/test_admin_routing.mjs --artifact-root tmp/production-readiness/linux-acceptance-001/artifacts --output-dir tmp/production-readiness/linux-acceptance-001/routing`；HTTP/API/Provider 为明确受控替身，和前述真实 DB/Redis/TLS 验收分别留证。手动 Linux workflow 已接该步骤。

`.github/workflows/linux-docker-acceptance.yml` 仅手动触发，使用同一入口；本轮不远程触发。workflow 只上传脱敏 `acceptance.state.json`，不上传 env/keys/dump/object/log。失败后检查 state 的 cleanup，若未 verified，只清理其明确记录且归属核验通过的目标，禁止全局 prune。

## 单元与隔离回归 SOP

触发条件：修改运维 CLI、备份格式/恢复、目标归属、回滚、告警、容量或 Linux runner/CI。

1. 先运行 help/preview，审阅目标、端口、目录、秘密来源和 mutation；实际 Linux 执行必须确认无共享资源。
2. 运行 `node tools/verify/test_production_ops.mjs`。Docker/S3 是显式 fixture 边界，执行真实编排；另用真实回环 HTTP 测有界吞吐。覆盖主闭环后再测 preview 零写、损坏、链接、陌生目标、中断、清理失败、兼容摘要/旧镜像、readiness/业务、告警接收与 SLO 失败。
3. 运行 `node tools/verify/test_linux_acceptance.mjs`，核 CLI 参数、Compose 隔离变换、辅助端口默认、S3 预签名契约。此命令不启动 Docker。
4. 对新增 `.mjs` 做 `node --check`，运行 `node tools/validate_utf8.mjs tools/verify docs/PRODUCTION-OPS.md docs/CI_VALIDATION.md .github/workflows`，审阅 diff。证据在 `tmp/production-readiness/ops-tests-*/result.json`，真实 Linux state 分开记录。

反模式：用 fixture 冒充 Linux 通过；preview 偷写 evidence；源目标相同；按名字猜 ownership；HTTP 200 不核业务；备份存在即宣称能恢复；把备份年龄当 RPO；启动即宣称回滚成功；失败/中断/清理错误写 passed；吞掉子进程非零；上传整个 tmp 或把秘密放 argv；全局删除容器/卷。
