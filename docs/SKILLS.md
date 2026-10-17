# Skills 与插件

本文件合并 skills 使用指南与后端插件目录两份文档：前者说明 `skills` 的能力库如何使用与维护，后者固定后端插件的分档与开关矩阵。

## 1. Skills 设计原则

`skills` 是本仓库的能力库。它不是提示词堆积目录，而是把稳定、可复用的研发动作沉淀成仓库内 SOP。

当前仓库级 skill 遵循这些硬约束：

1. **只保留 5 个 CLI 型工作域**：`test-cli`（Web 测试）、`compress-cli`（AGENTS 规约）、`push-cli`（推送与 PR）、`release-cli`（版本与 Release）、`deploy-cli`（本机部署与运行态）。
2. 仓库级 skill 统一使用 `*-cli` 后缀；创建或更新 skill 使用系统级 `skill-creator`。
3. `skills` 下不保留共享底座型、README-only、helper-only 或已被新工作域覆盖的旧 skill 目录。
4. 一个 skill 一个工作域；域内用子命令或 mode 表达子场景，细节放 `references/`。React / Vue 管理端差异通过 `references/*` 或 `--client react|vue` 区分。
5. skill 的主执行入口必须兼容 Windows / macOS / Linux；统一使用 repo-owned Node CLI 或 `.mjs`，不再保留 `.sh` / `.ps1` / `.cmd` 作为 skill 入口。若内部仍需 Python 等实现，必须由跨平台 Node 入口调度。
6. 仓库级 skill 是 CLI 型可执行 SOP：判定范围 -> 只读探测 / dry-run -> 目标与影响枚举 -> 写入或危险动作门禁 -> 执行验证 -> `tmp/` 证据留存与显式失败。远程写操作默认 dry-run。
7. 工作域之外的能力不新建 skill：backend 验证与 OpenSpec 校验放 `tools/`，数据运维与交付工作流放 `docs/`，部署脚本与运行时矩阵放 `deploy/`；部署生命周期编排由 `deploy-cli` 承担。

## 2. 一个 skill 通常包含什么

| 路径 | 作用 |
| --- | --- |
| `SKILL.md` | 入口说明、触发条件、默认步骤 |
| `agents/openai.yaml` | UI 元数据 |
| `scripts/` | 可直接运行的脚本或 CLI（主入口，跨平台 Node） |
| `scripts/test_*.mjs` | 该 skill 的回归测试（写入 `tmp/` fixture） |
| `references/` | 规则、清单、模式说明（mode）与上下文材料 |
| `assets/` | 模板、图标或辅助资源 |

没有 `SKILL.md` 的目录，不应被当作仓库级 skill。

## 3. 当前关键 skills

`skills/` 当前保留 5 个仓库级 skill：CLI 型可执行 SOP 优先；稳定的参考性内容归 `docs/`，域外验证能力归 `tools/`，部署脚本真值归 `deploy/`。

| Skill | 职责 | 典型场景 |
| --- | --- | --- |
| `test-cli` | Web 测试与运行态 | 浏览器流程与 DevTools 诊断、受保护路由探测、Redis 种子验证码登录、动态路由 smoke、case matrix、CRUD E2E、页面运维门禁、前端单测/coverage/lint/build 与本地栈 |
| `compress-cli` | AGENTS 规约压缩与校验 | 压缩根 `AGENTS.md`、格式与唯一类别校验、Local Skills 路由一致性、引用路径存在性、受保护类别断言、行数预算 |
| `push-cli` | 推送与 PR 闭环 | 本地校验矩阵、默认分支保护、自动工作分支、提交与推送、PR 创建/复用、GitHub 校验轮询、失败日志回流、受控合并 |
| `release-cli` | 版本与 GitHub Release | 版本现状核对（含最新远程 tag）、受管文件同步、标注 tag、Release 发布与发布后校验 |
| `deploy-cli` | 本机部署与运行态 | Apple container / WSL2 Docker / Linux Docker 的 init/build/up/down/status/smoke、状态文件与端口收口 |

## 4. 浏览器 skill 的当前真值

`test-cli` 的默认主路径已经切换为仓库内跨平台 CLI：

- `pnpm --dir skills/test-cli/scripts run playwright-cli ...`
- `pnpm --dir skills/test-cli/scripts run chrome-devtools-cli ...`

说明：

- 这两个 CLI 是 repo-owned 入口，适用于 Windows / macOS / Linux。
- 为兼容不同平台和 `pnpm` 参数透传差异，也接受 `run <cli-name> -- ...` 形式，但默认推荐无 `--` 写法。
- 不再维护平台包装脚本，直接调用仓库内 CLI。
- `playwright-cli admin-route-probe` 直接调用 `test-cli/scripts/captcha_login.mjs`，写入 Redis 种子答案并获取真实 token。
- `playwright` MCP 只用于临时交互探索。
- `chrome-devtools` MCP 只用于深度诊断。

## 5. skill 如何被触发与何时不该新建

触发来源三类：用户显式点名 skill；`AGENTS.md` 的 `Skill Trigger` 命中语义；Codex 读取规则后按任务类型主动选择最合适的 skill。因此 skill 的有效性不只取决于脚本，还取决于 `SKILL.md` 是否描述清楚触发场景、`AGENTS.md` 是否正确路由、`README.md` 与 `docs/*.md` 是否与 skill 实际入口一致。

以下情况通常不值得单独沉淀为 skill：

- 只会执行一次的临时任务
- 没有复用价值的个人化流程
- 只有说明、没有输入输出和动作闭环的"文档片段"
- 本质上只是现有 skill 的一个 `references/<variant>`
- 可以通过重构现有领域 skill 的触发条件、默认步骤、references 或 CLI 参数解决的问题

## 6. 新增或修改 skill 的同步要求

当新增或更新 skill 时，通常还要同步检查：

1. `AGENTS.md` 是否需要新增或调整路由。
2. `README.md` 与 `docs/*.md` 是否仍然准确。
3. 如果 skill 依赖仓库级 MCP，`.codex/config.toml` 与 `docs/MCP-SERVERS.md` 是否仍然一致。
4. 若变更了命令、环境变量、入口路径或默认行为，是否已执行 docs 站点同步。
5. `agents/openai.yaml` 的 `default_prompt` 是否显式包含 `$skill-name`，且 `display_name`、`short_description` 是否仍与 `SKILL.md` 一致。
6. 若 skill 会启动 backend、frontend dev server、浏览器 runner 或其他长生命周期进程，是否已写入 `tmp/` 状态文件并覆盖端口收口。

`docs/DELIVERY-WORKFLOW.md` 当前最小 OpenSpec 命令集合是：

```bash
node tools/init_change_dir.mjs <change-id>
node tools/openspec_check.mjs <change-id>
```

## 7. `tools/lib` 共享运行时边界

`tools/lib` 不是 skill 目录，也不对外承诺独立 CLI。它是 repo-owned skills / scripts 的共享运行时层，当前只保留跨 skill 复用模块：

| 路径 | 当前职责 | 当前主要消费者 |
| --- | --- | --- |
| `tools/lib/skill_runtime.mjs` | repo root 解析、`tmp/` 路径、命令执行、进程管理、HTTP/文件辅助等通用运行时能力 | 多数 repo-level skills 与脚本 |
| `tools/lib/admin_dev_stack.mjs` | 本地 admin backend + frontend 栈的启动、停止、状态文件、日志与端口收口管理 | `test-cli` 的 `run_admin_e2e.mjs` / `run_admin_crud_e2e.mjs` |

维护约束：

- 修改 `tools/lib/*` 的 CLI 参数、默认端口、日志落点或 env 语义时，必须同步检查对应 skill 的 `SKILL.md`、`references/*.md`、`README.md` 与相关 `docs/*.md`。
- `tools/lib` 只沉淀跨 skill 复用的运行时能力，不把单个 skill 的私有流程提前抽成共享层。
- 共享 helper 产生的状态文件、日志和一次性产物仍统一落在 `tmp/`。
- 任何启动长生命周期进程的 helper 都必须记录 pid、port、log、owned/reused 关系和 `starting/running/passed/failed/interrupted/stopped` 状态；验证完成、失败或中断时关闭 owned 进程，下一次运行前清理 `running` 或 `interrupted` 的旧状态。

## 8. 各域 skill 速查

### 8.1 Web 测试与运行态（test-cli）

当任务要求"不要跳过验证码""用 Redis 种子答案跑完整登录""启动后端和前端后逐模块 smoke""生成管理端测试矩阵"或"设计 CRUD 浏览器自动化模式"时使用。测试政策与 case 集合见 [TESTING.md](./TESTING.md) 与 `docs/testing/`。

```bash
node skills/test-cli/scripts/generate-case-matrix.mjs
node skills/test-cli/scripts/validate-case-matrix.mjs docs/testing/case-matrix.json
# 先配置 INFOQ_TEST_REDIS_* 或 --redis-*，且与后端使用同一 Redis
node skills/test-cli/scripts/captcha_login.mjs --backend-url http://127.0.0.1:8080 --print-token
node skills/test-cli/scripts/run_admin_e2e.mjs --client vue
node skills/test-cli/scripts/run_admin_e2e.mjs --client react
node skills/test-cli/scripts/run_admin_crud_e2e.mjs --client vue
node skills/test-cli/scripts/run_admin_crud_e2e.mjs --client react
```

说明：

- 验证码 E2E 默认不关闭验证码，必须通过 `/auth/code`、Redis 种子答案和 `/auth/login` 获取真实 token。
- `captcha_login.mjs` 是共享验证码登录入口，`run_admin_e2e.mjs` 和 `admin-route-probe` 都直接复用它。
- 种子模式要求测试进程与后端使用同一个 Redis 实例/DB；通过 `INFOQ_TEST_REDIS_*` 或 `--redis-*` 提供连接，禁止指向生产 Redis。浏览器依赖仍复用 `test-cli`。
- 证据默认写入 `tmp/test-cli/e2e/<run-id>/`。
- `run_admin_e2e.mjs` 默认在完成、失败或中断后停止本次 skill 启动的栈；只有成功且需要保留联调进程时显式传 `--keep-stack-after`，失败或中断仍会关闭 owned 进程。
- `run_admin_crud_e2e.mjs` 仅用于已授权的 `application-local.yml` 测试数据库，默认覆盖 `role,user,menu,dept,post,dict,config,notice,client,invite,ossConfig,job,online`，执行 UI 新增/查询/编辑/删除或模块可用的选择删除/行删除入口；`online` 会创建当前 run 专属 `e2e_` 用户会话并只强退该会话；cleanup 只处理当前 run 的精确 `e2e_` 数据。
- 管理端 E2E 栈状态按 client 稳定写入 `tmp/test-cli/e2e/stack/<vue|react>/state.json`，断开后下一次运行会先清理未标记 `keepAlive` 的旧状态。
- 写入型 CRUD、导出、批量操作和权限矩阵必须先定义测试数据、cleanup 和危险动作门禁。
- 真实管理端页面运营维护、权限巡检和写入型操作门禁见 `skills/test-cli/references/ops/page-ops-guardrails.md`；页面运维证据写入 `tmp/test-cli/e2e/page-ops/`。

### 8.2 前端验证（test-cli，mode: frontend）

React / Vue admin 的运行态、单测、coverage、lint/build 都统一使用 `test-cli`。

```bash
node skills/test-cli/scripts/run_admin_e2e.mjs --client vue --route-limit 1
node skills/test-cli/scripts/run_admin_e2e.mjs --client react --route-limit 1
```

验证码种子登录和动态路由 smoke 见 `skills/test-cli/references/modes/e2e.md`。本地栈由 `run_admin_e2e.mjs` 自管，状态写入 `tmp/test-cli/e2e/stack/<client>/state.json`，完成、失败或中断后按状态文件收口 owned 端口；纯单测 / 构建迭代可手动启动，命令见 `skills/test-cli/references/runtime/admin-commands.md`。

### 8.3 数据运维（docs/DATA-OPS.md）

SQL、数据库、Redis、数据修复、迁移、测试数据维护和 API/UI/DB 一致性核对统一使用 `docs/DATA-OPS.md`。

- 冻结初始化 SQL `sql/infoq_scaffold_3.0.0.sql` 永远不要修改。
- 新增、修改、删除表结构或初始化数据，只能新增 `sql/infoq_scaffold_update_YYYYMMDD.sql` 增量脚本。
- 数据写入前必须先列出环境、目标表/key/ID、筛选条件、影响范围、幂等性、回滚脚本和验证查询。
- 共享环境默认只读；生产或共享环境数据变更、SQL 迁移和批量修复必须联动 `docs/DELIVERY-WORKFLOW.md`。
- 管理端页面操作与权限巡检归 `test-cli` 的页面运维门禁（`skills/test-cli/references/ops/page-ops-guardrails.md`）；后端接口与运行态验证归 `tools/verify`，登录/鉴权验证归 `test-cli`。

### 8.4 后端验证（tools/verify）

后端单测、Mapper XML、HTTP smoke、WebSocket cluster smoke 统一使用 `tools/verify`；登录/鉴权验证统一使用 `test-cli` 的 `captcha_login.mjs`（Redis 种子答案），不再维护独立登录脚本。

```bash
node tools/verify/run_smoke.mjs
node tools/verify/run_cluster_smoke.mjs
```

这些脚本启动临时后端时会在 `tmp/verify/` 写入 `*.state.json`。默认在成功、失败或中断后关闭自己启动的端口；显式 keep 参数只用于临时诊断，必须依赖状态文件后续清理。

### 8.5 部署与运行态（deploy-cli）

当任务要求"在本机部署项目""用 Apple container 起栈""在 WSL2 / Linux Docker 部署""运行态 smoke""部署失败诊断"或"停止/清理本地栈"时使用。部署脚本真值在 `deploy/`，运行态编排入口是 `deploy-cli`。

```bash
node skills/deploy-cli/scripts/deploy_cli.mjs init
node skills/deploy-cli/scripts/deploy_cli.mjs build
node skills/deploy-cli/scripts/deploy_cli.mjs up
node skills/deploy-cli/scripts/deploy_cli.mjs status
node skills/deploy-cli/scripts/deploy_cli.mjs smoke
node skills/deploy-cli/scripts/deploy_cli.mjs down
node skills/deploy-cli/scripts/deploy_cli.mjs destroy --yes
```

说明：

- macOS 需要完整栈时使用 Colima + Docker；Apple container 仅启动 MySQL、Redis 和后端，默认端口 `19090`，只操作 `infoq-apple*` 资源。Apple 细节见 `skills/deploy-cli/references/apple-containers.md`。
- Windows 必须在 WSL2 Debian/Ubuntu 内执行；Linux 使用本地 Docker。Docker 细节见 `skills/deploy-cli/references/docker.md` 与 `deploy/VERIFICATION.md`。
- `status` / `smoke` 只读；`up` / `down` 是运行态变更；Docker 路径的写操作必须显式 `--execute`。
- 状态写入 `tmp/deploy-cli/state.json`，日志写入 `tmp/deploy-cli/deploy.log`；完成、失败或中断都要收口。
- 默认只使用免费商用运行时基线：WSL2 内 Docker CE、macOS Colima、原生 Linux Docker CE；不默认使用 Docker Desktop。
- 证据写入 `tmp/deploy-cli/` 或 `tmp/deploy-verify/<run-id>/`。

### 8.6 AGENTS 规约压缩（compress-cli）

当任务涉及压缩或更新根 `AGENTS.md`、怀疑 Local Skills 路由漂移、或需要校验引用路径与受保护类别时使用。

```bash
node skills/compress-cli/scripts/agents_check.mjs check
node skills/compress-cli/scripts/agents_check.mjs budget
node skills/compress-cli/scripts/test_agents_check.mjs
```

说明：

- 校验器只读：不提供自动改写模式；压缩安全与发布类规则必须人工评审。
- `check` 覆盖四类契约：`|Category:value` 格式与唯一类别、受保护类别完整性、路由一致性（Local Skills ↔ `skills/` 目录 ↔ `docs/SKILLS.md` 表 ↔ Skill Trigger 引用）、AGENTS.md 引用路径存在性。
- `budget` 输出行数、超长类别与重复片段，作为压缩评审输入，不作为失败条件。
- 通用 `agents-md-compress` 仅提供压缩写作方法；仓库特有真值以本 skill 为准。

### 8.7 推送与 PR（push-cli）

当任务要求推送代码、提交或更新 PR、修复 PR 校验失败或合并 PR 时使用。

```bash
node skills/push-cli/scripts/push_cli.mjs ensure
node skills/push-cli/scripts/push_cli.mjs check --profile docs
node skills/push-cli/scripts/push_cli.mjs check --profile ci
node skills/push-cli/scripts/push_cli.mjs submit-pr --message "fix: xxx"
node skills/push-cli/scripts/push_cli.mjs watch --pr <number>
node skills/push-cli/scripts/push_cli.mjs merge --pr <number> --yes
```

说明：

- 默认分支（`master`）禁止直推；在本分支上执行 `submit-pr` 时会自动 `git fetch` 最新默认分支并创建 `auto/<yyyymmdd-hhmmss>` 工作分支。
- `submit-pr` = 本地校验矩阵 -> 提交 -> 推送 -> 创建或复用 PR -> 自动 `watch`；失败时输出失败 check 与失败日志摘要，修复后重跑即复用同一 PR。
- `merge` 需要全绿 + 显式 `--yes`；禁止 `--admin` 绕过保护。
- 校验矩阵：`docs`（UTF-8、README 同步、版本一致性、文档链接、AGENTS 校验、active change 的 OpenSpec 校验）、`ci`（对齐 `.github/workflows/ci.yml` 的双管理端 lint/test/build）、`full`（追加 backend 测试）。
- 证据写入 `tmp/push-cli/<run-id>/`。

### 8.8 版本与 Release（release-cli）

当任务要求版本升级、确认版本是否最新、创建 tag 或发布 GitHub Release 时使用。

```bash
node skills/release-cli/scripts/release_cli.mjs plan
node skills/release-cli/scripts/release_cli.mjs bump --version 3.0.1
node skills/release-cli/scripts/release_cli.mjs tag --version 3.0.1
node skills/release-cli/scripts/release_cli.mjs publish --version 3.0.1
node skills/release-cli/scripts/release_cli.mjs verify --version 3.0.1
node skills/release-cli/scripts/test_bump_version.mjs
```

说明：

- `plan` 会把「当前版本 <= 最新远程 tag」判为需要先 bump 并显式失败；版本升级需通过 `push-cli` 合并后再打 tag。
- tag 必须在 `HEAD == origin/<default>` 时创建，已存在的 tag 拒绝复用；Release 已存在时 `publish` 失败（更新说明用 `gh release edit`）。
- 远程写操作默认 dry-run；受管文件清单见 `skills/release-cli/references/targets.md`。

### 8.9 域外能力（不在 `skills/` 下的验证与运维）

| 域 | 入口 | SOP |
| --- | --- | --- |
| backend 单测 / smoke / 集群 | `tools/verify/*.mjs` | `tools/verify/README.md` |
| backend 登录 / 鉴权 | `skills/test-cli/scripts/captcha_login.mjs` | `docs/TESTING.md` 第 5 节 |
| OpenSpec 结构校验与 change 初始化 | `tools/openspec_check.mjs`、`tools/init_change_dir.mjs` | `docs/OPENSPEC-WORKFLOW.md` |
| SQL / 数据修复 / 迁移 / 一致性核对 | 无脚本（只读 MCP + SQL 增量脚本） | `docs/DATA-OPS.md` |
| 交付门禁 / Acceptance Contract / UI 四阶段 / 插件治理 | `tools/generate_plugin_plan.mjs` | `docs/DELIVERY-WORKFLOW.md`、`docs/UI-WORKFLOW.md`、`docs/SKILLS.md` §9 |
| 容器部署与 smoke | `skills/deploy-cli/scripts/deploy_cli.mjs`、`deploy/install.sh`、`deploy/bin/*` | `deploy/VERIFICATION.md`、`deploy/runtime-matrix.md` |

## 9. 插件目录与开关策略

### 9.1 目标与范围

统一 `infoq-scaffold-ai` 的插件治理策略，满足以下目标：

1. 框架核心能力固定保留，避免误删导致系统不可用。
2. 可选插件通过配置快速开启/关闭，尽量不改业务代码。
3. 通用插件可被未来新增业务模块直接引用，降低接入成本。

适用目录：后端 `backend/infoq-plugin`、`infoq-core`、`infoq-modules`；前端 `frontend-vue`、`frontend-react`。

### 9.2 插件分档

框架必需插件（固定保留，不建议做开关化删除）：

- `infoq-plugin-web`
- `infoq-plugin-security`
- `infoq-plugin-mybatis`
- `infoq-plugin-redis`
- `infoq-plugin-jackson`
- `infoq-plugin-oss`（业务明确要求固定保留）

通用能力插件（保留为可复用能力，走"按模块依赖接入"模式，不建议纯运行时开关）：

- `infoq-plugin-translation`
- `infoq-plugin-sensitive`
- `infoq-plugin-excel`
- `infoq-plugin-log`

可配置插件（默认关闭或按需，通过配置启停）：

- `infoq-plugin-encrypt`
- `infoq-plugin-mail`
- `infoq-plugin-sse`
- `infoq-plugin-websocket`
- `infoq-plugin-doc`

关键原则：

1. 依赖保留在 `infoq-system`，保证可随时启用。
2. 配置默认置为 `false`，生产按需开启。
3. 需要前后端联动的插件必须同步配置（如 encrypt/sse/websocket）。

### 9.3 当前依赖基线

后端系统模块依赖入口：

- `backend/infoq-modules/infoq-system/pom.xml`
- `backend/infoq-core/infoq-core-data/pom.xml`

当前策略：

1. `infoq-system`：保留基座依赖 + 可配置插件依赖。
2. `infoq-core-data`：保留 `log/sensitive/translation/excel` 通用能力依赖。

### 9.4 可配置插件开关矩阵

| 插件 | 后端配置键 | 前端配置键 | 默认值 | 备注 |
|---|---|---|---|---|
| encrypt | `api-decrypt.enabled` / `mybatis-encryptor.enable` | `VITE_APP_ENCRYPT` | `api-decrypt.enabled=true`，`mybatis-encryptor.enable=false` | 需要前后端同步 |
| mail | `mail.enabled` | 无 | false | 仅后端 |
| sse | `sse.enabled` | `VITE_APP_SSE` | true | 需要前后端同步 |
| websocket | `websocket.enabled` | `VITE_APP_WEBSOCKET` | false | 需要前后端同步 |
| doc | `springdoc.api-docs.enabled` | 无 | true | 仅后端 |

后端配置文件：

- `backend/infoq-admin/src/main/resources/application.yml`
- `backend/infoq-admin/src/main/resources/application-dev.yml`

前端配置文件：

- `frontend-vue/.env.development`
- `frontend-vue/.env.production`
- `frontend-react/.env.development`
- `frontend-react/.env.production`

### 9.5 通用插件接入规范（新业务模块）

- Translation：模块 `pom.xml` 引入 `infoq-plugin-translation`，在返回 VO 字段上使用 `@Translation`；新增翻译类型时实现 `TranslationInterface<T>` 并用 `@TranslationType(type = "...")` 标注，注册为 Spring Bean。
- Sensitive：引入 `infoq-plugin-sensitive`，在敏感字段使用 `@Sensitive`；模块可选实现 `SensitiveService` 定义本模块脱敏策略。
- Excel：引入 `infoq-plugin-excel`，导入导出 VO 使用 `ExcelProperty`、`ExcelDictFormat` 等注解，控制层通过 `ExcelUtil` 执行导入导出。
- Log：引入 `infoq-plugin-log`，需要记录操作日志的接口加 `@Log` + `BusinessType`；登录日志可通过事件机制记录（`LoginInfoEvent`）。

### 9.6 软关闭与删除建议

软关闭（推荐）：保留依赖不动，把对应 `enabled` 配置置为 `false`，若有前端开关前端同步置 `false`，执行编译与冒烟验证。适用于 `encrypt/mail/sse/websocket/doc`。

硬删除（仅明确不再需要时）：删除模块 `pom.xml` 依赖，删除直接调用代码（注解/工具类/接口），清理配置项与前端开关，执行全量编译和登录冒烟。

### 9.7 验证命令基线

```bash
node tools/backend_mvn.mjs -- clean package -P dev -pl infoq-admin -am
```

后端运行示例（仅用于插件/API 诊断；登录与路由验收使用 `captcha_login` 的种子登录）：

```bash
java -jar backend/infoq-admin/target/infoq-admin.jar \
  --server.port=18080 \
  --captcha.enable=false \
  --api-decrypt.enabled=false \
  --springdoc.api-docs.enabled=false \
  --websocket.enabled=false
```

前端编译：

```bash
cd frontend-vue
pnpm run build:prod
```

### 9.8 维护约定

1. 新增插件时必须先归档到本清单并声明分档（必需/通用/可配置）。
2. 任何"移除插件"改动必须同时说明是软关闭还是硬删除。
3. 影响前后端联动的插件，配置变更必须成对提交。
