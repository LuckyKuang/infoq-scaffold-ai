# Skills 与插件

本文件合并 skills 使用指南与后端插件目录两份文档：前者说明 `skills` 的能力库如何使用与维护，后者固定后端插件的分档与开关矩阵。

## 1. Skills 设计原则

`skills` 是本仓库的能力库。它不是提示词堆积目录，而是把稳定、可复用的研发动作沉淀成仓库内 SOP。

当前仓库级 skill 遵循这些硬约束：

1. 每个 skill 只解决一个工作域。
2. 仓库级 skill 统一使用 `infoq-` 前缀；创建或更新 skill 使用系统级 `skill-creator`。
3. `skills` 下不保留共享底座型、README-only、helper-only 或已被新工作域覆盖的旧 skill 目录。
4. React / Vue 管理端差异通过目标 skill 的 `references/*` 或 `--client react|vue` 参数区分，不再按技术栈碎片化拆 skill。
5. skill 的主执行入口必须兼容 Windows / macOS / Linux；统一使用 repo-owned Node CLI 或 `.mjs`，不再保留 `.sh` / `.ps1` / `.cmd` 作为 skill 入口。若内部仍需 Python 等实现，必须由跨平台 Node 入口调度。
6. 仓库级 skill 默认是领域型可执行 SOP：判定范围 -> 只读探测 / dry-run -> 目标与影响枚举 -> 写入或危险动作门禁 -> 执行验证 -> `tmp/` 证据留存与显式失败。
7. 优先破坏性重构现有领域 skill；只有出现无法归入现有 skill 的新工作域时，才新增 `infoq-*` skill。

## 2. 一个 skill 通常包含什么

| 路径 | 作用 |
| --- | --- |
| `SKILL.md` | 入口说明、触发条件、默认步骤 |
| `agents/openai.yaml` | UI 元数据 |
| `scripts/` | 可直接运行的脚本或 CLI |
| `references/` | 规则、清单、上下文材料 |
| `assets/` | 模板、图标或辅助资源 |

没有 `SKILL.md` 的目录，不应被当作仓库级 skill。

## 3. 当前关键 skills

| Skill | 职责 | 典型场景 |
| --- | --- | --- |
| `infoq-project-reference` | 仓库静态参考 | 目录、入口、命令、工程规则、安全和验证基线 |
| `infoq-delivery-workflow` | 高影响交付流程 | Acceptance Contract、OpenSpec、重大 UI/UX 门禁、跨工作区交付、插件治理计划 |
| `infoq-backend-verify` | 后端验证闭环 | 后端单测、Mapper XML、HTTP smoke、WebSocket cluster smoke、登录/auth、Redisson OSS |
| `infoq-frontend-verify` | 前端验证闭环 | React/Vue 管理端 单测、coverage、lint/build、本地栈、路由和截图验证 |
| `infoq-data-ops` | 数据运维治理 | SQL 增量脚本、数据修复、迁移、MySQL/Redis 只读诊断、回滚脚本和一致性核对 |
| `infoq-admin-e2e` | 管理端 E2E | 测试矩阵、真实验证码登录、动态路由 smoke、CRUD 模式、测试数据和 cleanup |
| `infoq-admin-ops` | 管理端真实操作 | 用户、角色、菜单、字典、参数、公告、OSS、定时任务、权限巡检和页面操作门禁 |
| `infoq-browser-automate` | 通用浏览器执行器 | `playwright-cli` 页面流转、token 注入、截图、console/pageerror 证据 |
| `infoq-component-reference` | 组件库 API 参考 | Ant Design / Element Plus 组件选型、官方 API 核验、版本兼容性 |
| `infoq-release-ops` | 发布与版本操作 | 版本升级、后端 revision、React/Vue package 字段同步、Docker tag、发布文档、发布前检查 |
| `infoq-deploy-verify` | 部署验证闭环 | WSL2 Docker CE、macOS Colima、Linux Docker CE 全栈部署、nginx 网关、容器 smoke 和部署阻断收口 |

## 4. 浏览器 skill 的当前真值

`infoq-browser-automate` 的默认主路径已经切换为仓库内跨平台 CLI：

- `pnpm --dir skills/infoq-browser-automate/scripts run playwright-cli ...`
- `pnpm --dir skills/infoq-browser-automate/scripts run chrome-devtools-cli ...`

说明：

- 这两个 CLI 是 repo-owned 入口，适用于 Windows / macOS / Linux。
- 为兼容不同平台和 `pnpm` 参数透传差异，也接受 `run <cli-name> -- ...` 形式，但默认推荐无 `--` 写法。
- 不再维护平台包装脚本，直接调用仓库内 CLI。
- `playwright-cli admin-route-probe` 先走快速 token 获取；若后端明确返回 `captchaEnabled=true`，会自动调用 `infoq-admin-e2e/scripts/captcha_login.mjs` 识别验证码并获取真实 token。
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

`infoq-delivery-workflow` 当前最小 OpenSpec 命令集合是：

```bash
node skills/infoq-delivery-workflow/scripts/init_change_dir.mjs <change-id>
node skills/infoq-delivery-workflow/scripts/openspec_check.mjs <change-id>
```

## 7. `tools/lib` 共享运行时边界

`tools/lib` 不是 skill 目录，也不对外承诺独立 CLI。它是 repo-owned skills / scripts 的共享运行时层，当前只保留跨 skill 复用模块：

| 路径 | 当前职责 | 当前主要消费者 |
| --- | --- | --- |
| `tools/lib/skill_runtime.mjs` | repo root 解析、`tmp/` 路径、命令执行、进程管理、HTTP/文件辅助等通用运行时能力 | 多数 repo-level skills 与脚本 |
| `tools/lib/admin_dev_stack.mjs` | 本地 admin backend + frontend 栈的启动、停止、状态文件、日志与端口收口管理 | `infoq-frontend-verify` 的 `start_admin_dev_stack.mjs` / `stop_admin_dev_stack.mjs`、`infoq-admin-e2e` |

维护约束：

- 修改 `tools/lib/*` 的 CLI 参数、默认端口、日志落点或 env 语义时，必须同步检查对应 skill 的 `SKILL.md`、`references/*.md`、`README.md` 与相关 `docs/*.md`。
- `tools/lib` 只沉淀跨 skill 复用的运行时能力，不把单个 skill 的私有流程提前抽成共享层。
- 共享 helper 产生的状态文件、日志和一次性产物仍统一落在 `tmp/`。
- 任何启动长生命周期进程的 helper 都必须记录 pid、port、log、owned/reused 关系和 `starting/running/passed/failed/interrupted/stopped` 状态；验证完成、失败或中断时关闭 owned 进程，下一次运行前清理 `running` 或 `interrupted` 的旧状态。

## 8. 各域 skill 速查

### 8.1 管理端 E2E（infoq-admin-e2e）

当任务要求"不要跳过验证码""用 OCR 跑完整登录""启动后端和前端后逐模块 smoke""生成管理端测试矩阵"或"设计 CRUD 浏览器自动化模式"时使用。测试政策与 case 集合见 [TESTING.md](./TESTING.md) 与 `docs/testing/`。

```bash
node skills/infoq-admin-e2e/scripts/generate-case-matrix.mjs
node skills/infoq-admin-e2e/scripts/validate-case-matrix.mjs docs/testing/case-matrix.json
node skills/infoq-admin-e2e/scripts/captcha_login.mjs --backend-url http://127.0.0.1:8080 --print-token
node skills/infoq-admin-e2e/scripts/run_admin_e2e.mjs --client vue
node skills/infoq-admin-e2e/scripts/run_admin_e2e.mjs --client react
node skills/infoq-admin-e2e/scripts/run_admin_crud_e2e.mjs --client vue
node skills/infoq-admin-e2e/scripts/run_admin_crud_e2e.mjs --client react
```

说明：

- 真实验证码 E2E 默认不关闭验证码，必须通过 `/auth/code`、OCR 和 `/auth/login` 获取真实 token。
- `captcha_login.mjs` 是共享验证码登录入口，`run_admin_e2e.mjs` 和 `admin-route-probe` 的验证码 fallback 都复用它。
- 首次运行 OCR 场景需要本机 Python 环境可 import `ddddocr`，浏览器依赖仍复用 `infoq-browser-automate`。
- 证据默认写入 `tmp/infoq-admin-e2e/<run-id>/`。
- `run_admin_e2e.mjs` 默认在完成、失败或中断后停止本次 skill 启动的栈；只有成功且需要保留联调进程时显式传 `--keep-stack-after`，失败或中断仍会关闭 owned 进程。
- `run_admin_crud_e2e.mjs` 仅用于已授权的 `application-local.yml` 测试数据库，默认覆盖 `role,user,menu,dept,post,dict,config,notice,client,invite,ossConfig,job,online`，执行 UI 新增/查询/编辑/删除或模块可用的选择删除/行删除入口；`online` 会创建当前 run 专属 `e2e_` 用户会话并只强退该会话；cleanup 只处理当前 run 的精确 `e2e_` 数据。
- 管理端 E2E 栈状态按 client 稳定写入 `tmp/infoq-admin-e2e/stack/<vue|react>/state.json`，断开后下一次运行会先清理未标记 `keepAlive` 的旧状态。
- 写入型 CRUD、导出、批量操作和权限矩阵必须先定义测试数据、cleanup 和危险动作门禁。

### 8.2 前端验证（infoq-frontend-verify）

React / Vue admin 的运行态、单测、coverage、lint/build 都统一使用 `infoq-frontend-verify`。

```bash
node skills/infoq-frontend-verify/scripts/start_admin_dev_stack.mjs --client vue
node skills/infoq-frontend-verify/scripts/start_admin_dev_stack.mjs --client react
```

真实验证码登录、OCR 和动态路由 smoke 交给 `infoq-admin-e2e`；`infoq-frontend-verify` 只保留快速登录态诊断和前端运行态验证。`start_admin_dev_stack.mjs` 状态文件写入 `tmp/infoq-frontend-verify/<client>/state.json`；运行态验证完成或中断后必须执行对应 `stop_admin_dev_stack.mjs` 收口。

### 8.3 数据运维（infoq-data-ops）

SQL、数据库、Redis、数据修复、迁移、测试数据维护和 API/UI/DB 一致性核对统一使用 `infoq-data-ops`。

- 冻结初始化 SQL `sql/infoq_scaffold_3.0.0.sql` 永远不要修改。
- 新增、修改、删除表结构或初始化数据，只能新增 `sql/infoq_scaffold_update_YYYYMMDD.sql` 增量脚本。
- 数据写入前必须先列出环境、目标表/key/ID、筛选条件、影响范围、幂等性、回滚脚本和验证查询。
- 共享环境默认只读；生产或共享环境数据变更、SQL 迁移和批量修复必须联动 `infoq-delivery-workflow`。
- 管理端页面操作归 `infoq-admin-ops`；后端接口、登录和运行态验证归 `infoq-backend-verify`。

### 8.4 后端验证（infoq-backend-verify）

后端单测、Mapper XML、登录链路、HTTP smoke、WebSocket cluster smoke 统一使用 `infoq-backend-verify`。

```bash
node skills/infoq-backend-verify/scripts/verify_login.mjs
node skills/infoq-backend-verify/scripts/run_smoke.mjs
node skills/infoq-backend-verify/scripts/run_cluster_smoke.mjs
```

这些脚本启动临时后端时会在 `tmp/infoq-backend-verify/` 写入 `*.state.json`。默认在成功、失败或中断后关闭自己启动的端口；显式 keep 参数只用于临时诊断，必须依赖状态文件后续清理。

### 8.5 部署验证（infoq-deploy-verify）

当任务要求"在 WSL2 Debian 部署项目""在 macOS Colima 部署项目""在 Linux Docker CE 部署项目""验证部署文档和脚本""容器部署失败排查"或"确认 nginx / Vue / React / backend 是否可访问"时，使用 `infoq-deploy-verify`。部署文档入口是 `deploy/README.md` 与 `deploy/DOCKER.md`。

默认职责：

- 使用 `deploy/bin/infoq.sh deploy` 部署后端、MySQL、Redis、MinIO。
- 使用 `deploy/bin/deploy-frontend.sh deploy` 部署 Vue、React 和 `nginx-web`。
- 默认只使用免费商用运行时基线：WSL2 内 Docker CE、macOS Colima、原生 Linux Docker CE；不默认使用 Docker Desktop。
- 默认把 WSL2/Linux 部署根目录放在 Linux 文件系统 `/infoq`，macOS Colima 默认使用 `$HOME/infoq`。
- 执行 deploy 前提醒并确认 `/tmp/infoq-deploy` 与 `${INFOQ_DEPLOY_ROOT}/server/temp` 已存在。
- 使用 `curl --noproxy '*'` 验证 backend readiness、`/prod-api`、`/vue/`、`/react/` 和 `9091/9092`。
- 证据写入 `tmp/infoq-deploy-verify/<run-id>/`。

`infoq-deploy-verify` 不负责版本升级；发布版本同步仍使用 `infoq-release-ops`。它也不替代后端单测、前端 lint/build 或写入型数据运维。

## 9. 插件目录与开关策略

### 9.1 目标与范围

统一 `infoq-scaffold-ai` 的插件治理策略，满足以下目标：

1. 框架核心能力固定保留，避免误删导致系统不可用。
2. 可选插件通过配置快速开启/关闭，尽量不改业务代码。
3. 通用插件可被未来新增业务模块直接引用，降低接入成本。

适用目录：后端 `infoq-scaffold-backend/infoq-plugin`、`infoq-core`、`infoq-modules`；前端 `infoq-scaffold-frontend-vue`、`infoq-scaffold-frontend-react`。

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

- `infoq-scaffold-backend/infoq-modules/infoq-system/pom.xml`
- `infoq-scaffold-backend/infoq-core/infoq-core-data/pom.xml`

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

- `infoq-scaffold-backend/infoq-admin/src/main/resources/application.yml`
- `infoq-scaffold-backend/infoq-admin/src/main/resources/application-dev.yml`

前端配置文件：

- `infoq-scaffold-frontend-vue/.env.development`
- `infoq-scaffold-frontend-vue/.env.production`
- `infoq-scaffold-frontend-react/.env.development`
- `infoq-scaffold-frontend-react/.env.production`

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

后端运行示例：

```bash
java -jar infoq-admin/target/infoq-admin.jar \
  --server.port=18080 \
  --captcha.enable=false \
  --api-decrypt.enabled=false \
  --springdoc.api-docs.enabled=false \
  --websocket.enabled=false
```

前端编译：

```bash
cd infoq-scaffold-frontend-vue
pnpm run build:prod
```

### 9.8 维护约定

1. 新增插件时必须先归档到本清单并声明分档（必需/通用/可配置）。
2. 任何"移除插件"改动必须同时说明是软关闭还是硬删除。
3. 影响前后端联动的插件，配置变更必须成对提交。
