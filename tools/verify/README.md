> 来源说明：本文件是 `tools/verify` 命令组的能力与边界说明（后端单测、HTTP smoke、集群验证）。

# InfoQ 后端验证

本命令组只负责一件事：后端测试和运行态验证闭环。它是后端领域的可复用脚本集（非 skill 目录），优先复用仓库脚本和 Maven runner，不临时拼接不可复跑命令，也不主导数据库侧数据修复。

## 模式选择

1. 单测、覆盖率、Mapper XML、回归补测或 test-first backend fix，读取 `references/unit/*`。
2. HTTP API smoke、导出、菜单、受保护接口、运行态验证，使用 smoke 脚本并读取 `references/smoke/endpoints.md`。
3. WebSocket 集群、双节点路由或异常退出验证，使用 `run_cluster_smoke.mjs`。
4. SQL、数据库、Redis、数据修复、迁移、测试数据维护或 API/UI/DB 一致性验证，改用 `docs/DATA-OPS.md`。
5. 登录/鉴权验证改用 `test-cli` 的 `captcha_login.mjs`（Redis 种子答案）；本命令组不再维护独立登录脚本。

## 执行顺序

1. 判定范围：先确认是单测、HTTP smoke、WebSocket 集群、Mapper XML，还是 Redisson OSS 兼容性验证。
2. 只读探测：先读取配置、测试命令、端点说明和已有状态文件；不要先启动长生命周期进程。
3. 最小闭环：每类问题先跑最小可复现命令，再扩展到完整 suite。
4. 写入门禁：涉及数据库初始化、测试数据、导出、缓存清理、限流状态或登录态变更时，先列出目标表/键/接口、影响范围、清理方式和回滚条件；数据修复方案转交 `docs/DATA-OPS.md`。
5. 执行验证：检查退出码、HTTP 响应、日志摘要、状态文件、owned 端口收口和 Redisson OSS 报错。
6. 失败处理：产品代码缺陷、环境缺失、脚本缺陷和外部依赖不可达要分开说明，禁止吞错或伪造成功。

## 默认命令

以下命令均从仓库根目录执行。先读取帮助，确认目标和影响后才运行 smoke；裸 smoke 命令会启动应用并访问所选配置指向的 MySQL / Redis，不是只读预览。

```bash
node tools/verify/run_smoke.mjs --help
node tools/verify/run_cluster_smoke.mjs --help
node tools/verify/scan_missing_tests.mjs --help
```

扫描缺失测试：

```bash
node tools/verify/scan_missing_tests.mjs
```

后端 HTTP smoke：

```bash
node tools/verify/run_smoke.mjs
```

双节点 WebSocket cluster smoke：

```bash
node tools/verify/run_cluster_smoke.mjs
```

## 护栏

- 登录验证统一使用 `test-cli` 的 Redis 种子验证码登录；本命令组不再提供独立登录脚本。
- `run_smoke.mjs` / `run_cluster_smoke.mjs` 启动的临时后端会关闭验证码，仅用于后端 API smoke，不作为登录/鉴权验证。
- Redisson PRO-only API 报错必须视为产品缺陷，不当作环境噪声。
- 单测失败先排查产品代码，不通过削弱断言、放宽 mock 或伪造成功路径来过关。
- 后端 Maven 命令优先使用 `node tools/backend_mvn.mjs -- ...`。
- 任何写入数据库、Redis、文件导出或批量状态变更的诊断必须先明确目标和 cleanup。
- 不把后端 smoke 或单测通过当成数据修复完成；数据侧修复、迁移和一致性核对使用 `docs/DATA-OPS.md`。
- 任何由本命令组启动的后端运行态必须写入 `tmp/verify/*.state.json`，状态至少覆盖 `starting`、`running`、`passed`、`failed`、`interrupted`、`stopped`。
- `run_smoke.mjs`、`run_cluster_smoke.mjs` 在验证完成、失败或收到 `SIGINT`/`SIGTERM`/`SIGHUP` 时必须关闭自己启动的端口；下一次运行前必须先清理仍为 `running`/`interrupted` 的旧状态。
- 只有显式 `--keep-server` / `--keep-servers` 才允许保留后端进程，且状态文件必须保留 `running` 与 pid/port/log，便于后续清理。

## 运行前置条件与实际影响

- Node 基线 `24.18.0`；构建使用 `tools/backend_mvn.mjs` 选择 JDK 21 / Maven 3.9.x。启动阶段调用 PATH 中的 `java`，因此还需单独确认 `java -version` 为 21，不能假设 Maven runner 的 JDK 选择会更改父进程 PATH。
- 单节点默认 `127.0.0.1:18080`，双节点默认 `127.0.0.1:19081` / `19082`，与产品默认 `8080` 不同。`--host` / 对应 `*_HOST` 只接受 `127.0.0.1` 或 `localhost`，同时用于 Java `server.address` 和探测；禁用验证码的实例不得绑定公网或通配地址。端口必须为无前导零的 `1..65535` 整数，集群两端口须不同；端口已占用会失败，不复用未确认 ownership 的服务。
- 集群 node ID 为 1–64 位字母、数字、`.`、`_`、`-`，且首位必须为字母或数字；两个 ID 忽略大小写后也必须不同，避免跨平台日志文件冲突。上述监听 host/port、node ID 不合法或参数缺值时，在配置解析、旧状态清理、构建和启动前拒绝。
- 默认 jar 为 `backend/infoq-admin/target/infoq-admin.jar`；缺失或传入 `--build` 时自动构建。默认 profile 在 `application-local.yml` 存在时为 `local`，否则为 `dev`。`--profile` / `SMOKE_SPRING_PROFILES_ACTIVE` / `CLUSTER_SMOKE_SPRING_PROFILES_ACTIVE` 可以显式覆盖 Java 激活 profile；文件必须已打包或通过外部配置加载。
- 只对隔离验证环境执行：应用启动可能运行 runner、初始化配置缓存和 Quartz；登录会修改 token/在线态、失败计数、登录审计和最近登录信息。导出会读取用户数据并可能产生操作审计。默认候选账号来自脚本内的演示列表，不能用来尝试生产账号；优先以受控环境变量提供专用测试账号，并显式设置候选列表，避免无关账号尝试。密码不要写到命令行或证据文件。
- 两个 runner 默认 `--login-mode encrypted`，也可分别通过 `SMOKE_LOGIN_MODE` / `CLUSTER_SMOKE_LOGIN_MODE` 设置。RSA 公钥通过 `SMOKE_RSA_PUBLIC_KEY` / `CLUSTER_SMOKE_RSA_PUBLIC_KEY` 注入并匹配后端解密私钥。只有目标已明确关闭 `api-decrypt.enabled` 时才选择 `plain`；失败不会自动改协议。`--login-mode plain` 不会替你关闭后端解密配置。
- HTTP 检查的单请求期限覆盖响应头和完整响应体，默认 `10000` 毫秒；通过 `SMOKE_HTTP_TIMEOUT_MS` / `CLUSTER_SMOKE_HTTP_TIMEOUT_MS` 设置无前导零的 `1..60000` 整数，非法值在启动前拒绝。超时输出方法、路径、`network=timeout` 和期限后非零退出，runner 按失败路径回收自有实例。启动 readiness 轮询中的每个 HTTP 探测另固定限时 1 秒，保持原重试次数；单请求期限不等于整个 smoke 的总时长限制。
- 集群还需要 Python 3、`redis` 和支持 `additional_headers` 的 `websockets`（14+）依赖。`websocket_cluster_smoke.py` 是 Node runner 的内部 helper，不是独立安全入口；它会连接 Redis、建立 WebSocket，并默认强杀传入的 node B pid。只使用 runner 记录为 owned 的进程，不能把已有服务 pid 传给 helper。
- 集群 `--redis-*` / `CLUSTER_SMOKE_REDIS_*` 只配置 Python 验证端，不覆盖 Java 的 Spring Redis 配置。缺省读取本机 local 优先、否则 dev 的 YAML，解析器不等于 Spring 完整配置解析；显式选择其他 profile、外部 env 或 Secret 时必须逐项核对二者指向同一隔离实例和 database。当前 helper 固定读取未加前缀的 WebSocket Redis key，因此两个 Java 节点的 `redisson.keyPrefix` 必须为空；非空前缀不在该验证器支持范围。helper 要求非空 Redis 密码，不支持无密码验证；需要覆盖配置解析失败时须完整提供四个 `CLUSTER_SMOKE_REDIS_*` 环境字段。不要输出密码。
- Python Redis 客户端的连接与 socket 读写等待分别固定为 5 秒；超时保持失败并交由父 runner 收口，不能无限等待后把空查询当成功。Redis 调用与 WebSocket 轮询仍依次执行，单项超时不等于整个集群验证总期限。
- 集群默认启用 WebSocket，并以 `--infoq.quartz.bootstrap.reconcile-enabled=false` 启动两个节点，但不关闭所有定时任务。默认验证跨节点广播、正常断开和 node B 异常退出清理（可能等待 140 秒）；`--skip-abnormal-exit` 会跳过强杀阶段。成功不代表生产负载、灾备或告警已演练。
- 登录成功的 smoke 只证明本清单中的接口可用；其启动探测使用轻量健康/首页，不替代部署接流量所需 `/monitor/health/readiness`。脚本不撤销验证 token，测试环境的会话和审计应按已确认的数据清理方案处理。

## 私有输出与失败诊断

`smoke_checks.mjs` 是只接受环境变量的内部 HTTP 检查器，没有 CLI `--help`。`BASE_URL` 默认 `http://127.0.0.1:18080`，`LOGIN_MODE` 默认 `encrypted`；`ROLE_ID=3`、`DICT_TYPE=sys_yes_no` 用于受保护接口。它还读取 `CLIENT_ID`、`USERNAME`、`PASSWORD`、`LOGIN_CANDIDATES`、`RSA_PUBLIC_KEY` 与 `HTTP_TIMEOUT_MS`（与上述请求期限相同的默认值和校验）。直接运行会访问目标，不要把 `--help` 当成安全预览。

`PRINT_TOKEN=1` / `PRINT_USER_ID=1` 是集群父子进程间的私有协议。集群捕获这些行，`smoke_output.mjs` 校验字段唯一且非空后剥离，再把 token 仅通过进程环境传给 Python。不得将内部原始 stdout 写到终端、CI 日志或证据文件；单节点 runner 强制把这两个变量设为 `0`，不继承调用者的私有输出开关。登录失败只记录账号、协议、HTTP 和数值业务码，公开/受保护 JSON 接口失败只记录方法、路径、HTTP 或数值业务码；缺失或非数值业务码显示 `invalid-response`，不打印上游 `msg` 或非 JSON 正文。集群子检查失败按退出码/信号报错；进一步定位查看受控节点日志，不输出私有子进程原始结果。

失败需区分：参数/登录协议错误、配置或 jar 缺失、端口占用、依赖不可达、接口权限不足和集群清理未收敛。按 `tmp/verify/*.state.json` 的 pid/port/log 检查 cleanup，仅停止本轮或已记录 owned 的进程；状态为 `failed` / `interrupted` 时不能认定验证完成。回滚脚本修订后重新执行下面的隔离回归，不回滚数据库数据或部署状态。

## 脚本隔离回归 SOP

触发条件：修改 smoke 登录协议、监听地址、私有输出、错误诊断、参数解析、候选账号、运行态编排或覆盖缺口扫描行为时。

1. 先读 runner → `smoke_checks.mjs` → `smoke_output.mjs` 调用链，确认无意外真实地址、启动或秘密输出。
2. 执行 `node tools/verify/test_smoke.mjs`，需 Node 24 与 Python 3；Python fixture 注入假 `redis` / `websockets`，无需安装这两个包。HTTP fixture 只监听 `127.0.0.1` 随机端口，验证加密/明文成功与失败、不跨协议重试、公开/受保护/登录错误正文与异常业务码不泄漏凭据；另核无响应头/响应体悬挂超时、非法期限、Redis 5 秒参数与超时非零退出、私有字段剥离、扫描器帮助、runner 参数拒绝。Node 24 `registerHooks` fixture 仅替换外部 runtime/config 边界，执行真实 runner 编排，检查 Java bind/probe 一致、单节点禁止私有输出，以及成功/失败 cleanup 与显式 keep 状态。测试子进程另有 5 秒上限，防止超时实现回归导致测试自身挂起。测试不启动 Java、连接真实 MySQL/Redis，也不证明实际进程清理或集群运行态。
3. 对修改的 `.mjs` 执行 `node --check <file>`，再运行 `node tools/validate_utf8.mjs tools/verify` 和 `git diff --check`；日志、命令/退出码放到 `tmp/`。
4. fixture 必须关闭自己的连接与监听端口。沙箱禁止回环监听时记录 `EPERM` 并在允许本地 fixture 的权限环境重跑；不得改为跳过测试或连接已有 backend 制造通过。

反模式：把加密失败自动改为明文；记录 `TOKEN=` / 密码；用 mock 返回成功替代 HTTP 正反结果；把类名匹配扫描当覆盖率；把集群 smoke 连接到共享 Redis；只看 liveness 就宣布生产就绪。

## 参考

- 单测模式：`references/unit/`
- Smoke 端点：`references/smoke/endpoints.md`
