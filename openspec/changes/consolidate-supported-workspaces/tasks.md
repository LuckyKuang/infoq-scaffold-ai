# 实施任务：consolidate-supported-workspaces

## 交付概览

本 change 将维护范围收敛为一个后端和 React/Vue 两个管理端。验收约定以 `proposal.md` 为唯一来源；实施只覆盖目录退役、文档、工具和部署入口清理，不改变保留工作区业务行为。

### 支持基线与删除清单

- [x] 将受支持工作区固定为 `infoq-scaffold-backend`、`infoq-scaffold-frontend-react`、`infoq-scaffold-frontend-vue`，并在根 README、`GEMINI.md`、`openspec/project.md`、`openspec/specs/platform-governance/spec.md` 的工作区清单中保持同一顺序和命名。
- [x] 完成并复核以下退役目录的删除（实现阶段不得恢复当前已暂存的删除）：`infoq-scaffold-frontend-react-pro`、`infoq-scaffold-frontend-weapp-react`、`infoq-scaffold-frontend-weapp-vue`、`infoq-scaffold-docs`。确认无空目录、占位入口或残留专属构建产物。
- [x] 对删除目录曾提供的 README、`AGENTS.md`、配置、测试、页面和文档链接作一次反向引用扫描；无法确认归属的共享文件先显式记录阻塞，禁止静默保留或删除。

## 影响矩阵

| 工作区 | 受影响模块、路由、API、store、页面入口 | 实施动作 | API/权限/失败行为约束 | 定向验证 |
| --- | --- | --- | --- | --- |
| `infoq-scaffold-backend` | `infoq-admin` 启动入口；`infoq-modules/infoq-system` 系统管理 Controller/Service/Mapper；`infoq-plugin` 与 `infoq-core` 公共基础设施。现有 REST 路由、鉴权、菜单权限、SSE/WebSocket、store 无本次变更。 | [x] 仅更新根文档和部署矩阵中对后端的描述；保持源码、配置、SQL、依赖和模块边界不变。 | [x] 不新增或删除 REST API；保留现有认证与权限校验、错误码和日志语义。任何因文档清理导致启动/构建失败必须显式失败并记录文件与命令。 | `node .codex/scripts/backend_mvn.mjs -- -pl infoq-modules/infoq-system -am -DskipTests=false test`；必要时 `node .codex/scripts/backend_mvn.mjs -- -DskipTests=false test`；按 backend `AGENTS.md` 先主流程再测试。 |
| `infoq-scaffold-frontend-react` | `src/pages` 页面入口、`src/router` 动态路由与守卫、`src/api` 请求契约、`src/store` Zustand 状态、`src/components` 共享组件；登录、系统管理、监控等现有路由/API 保持不变。 | [x] 修正文档、脚本和部署配置中的 React 工作区路径；不迁移 React Pro 页面或改动现有实现。 | [x] 不改变 API 请求、菜单权限、route guard 或失败提示；引用已删除工作区时命令应返回非零并带路径信息。 | `cd infoq-scaffold-frontend-react && pnpm run test`；`pnpm run lint`；`pnpm run build:prod`。 |
| `infoq-scaffold-frontend-vue` | `src/views` 页面入口、`src/router` 路由/守卫、`src/api` 请求契约、`src/store` Pinia 状态、`src/components` 共享组件；登录、系统管理、监控等现有路由/API 保持不变。 | [x] 修正文档、脚本和部署配置中的 Vue 工作区路径；不引入小程序或文档站入口。 | [x] 不改变 API 请求、权限指令、路由守卫或错误处理；缺失工作区、依赖或配置时显式失败。 | `cd infoq-scaffold-frontend-vue && pnpm run test:unit`；`pnpm run lint:eslint`；`pnpm run build:prod`。 |
| `infoq-scaffold-frontend-react-pro` | 工作区整体退役，原 `config/routes.ts`、`src/pages`、API/store 与测试入口不再维护。 | [x] 保持目录删除并清理外部引用；无需实现或迁移页面。 | 不接受 `react-pro` 作为当前工具/部署目标。 | 目录不存在；部署与测试工具不再解析到该路径。 |
| `infoq-scaffold-frontend-weapp-react` | 工作区整体退役，原 Taro 页面、API/store、DevTools 和 weapp 测试入口不再维护。 | [x] 保持目录删除并清理专属脚本、文档、图片引用；无需实现替代移动端。 | 不修改后端已有小程序授权能力或 SQL。 | 目录不存在；无当前导航或命令指向该路径。 |
| `infoq-scaffold-frontend-weapp-vue` | 工作区整体退役，原 uni-app 页面、API/store、DevTools 和 weapp 测试入口不再维护。 | [x] 保持目录删除并清理专属脚本、文档、图片引用；无需实现替代移动端。 | 不修改后端已有小程序授权能力或 SQL。 | 目录不存在；无当前导航或命令指向该路径。 |
| `infoq-scaffold-docs` | 工作区整体退役，原 VitePress 路由、同步脚本、构建和发布入口不再维护。 | [x] 保持目录删除，文档导航回到根 `doc/`；无需新增文档框架。 | 当前文档检查不得依赖已删除脚本。 | 目录不存在；根 `doc/` 的链接和命令可独立使用。 |
| `script / deploy` | Compose build context、nginx 路由、前端目标枚举、安装/卸载帮助与本地工具入口。 | [x] 仅保留后端和 React/Vue 部署目标，删除专属退役入口。 | 非法目标或缺失路径必须显式失败；不改共享环境状态。 | Shell/Node 语法检查、配置解析、目标枚举和拒绝退役目标的定向测试。 |

后端没有 API 契约变更；本 change 的 REST 合同是“现有接口集合、请求/响应结构、鉴权和权限语义保持不变”。任何实现若需要修改 Controller、DTO、Mapper、前端 `src/api` 或 route/store，应停止并重新评估 proposal 范围。

## 实施任务

### 根文档、规范与导航

- [x] 更新 `README.md`：目录树、支持矩阵、安装/开发/测试/部署命令、环境变量、工作区级 `AGENTS.md` 链接和文档入口只指向后端、React、Vue；删除 React Pro、小程序和 `infoq-scaffold-docs` 命令及链接。
- [x] 更新 `GEMINI.md`：删除小程序和文档站命令，保留后端及 React/Vue 的 Node/pnpm/Maven 基线。
- [x] 更新 `openspec/project.md` 工作区映射、默认 tasks 影响矩阵和文档站描述；保留 `script / deploy` 作为共享基础设施项。
- [x] 保留 `doc/plan/2026-09-16-consolidate-supported-workspaces-plan.md` 仓库级执行计划；已检查 `.gitignore` 当前对 `openspec/changes/*/` 的忽略，并为本 change 增加显式例外。
- [x] 更新 `openspec/specs/platform-governance/spec.md` 及其他稳定规格中受支持工作区枚举；历史变更文档可保留审计记录，但不得被当前入口描述为可维护工作区。
- [x] 更新 `doc/README.md`、`doc/module-doc-governance.md`、`doc/guide/project-overview.md`、`doc/guide/quick-start.md`、`doc/admin/handbook.md`、`doc/backend/handbook.md`、`doc/devops/*`、`doc/collaboration/*`，移除退役工作区路径、技术栈、命令、服务名和文档站同步流程。
- [x] 将 `doc/` 明确设为唯一正文来源；删除“同步到 `infoq-scaffold-docs`”的导航和发布要求，修正所有相对链接到现存文件。
- [x] 处理 `doc/test/frontend-web-automation` 的 case matrix、gaps、cleanup/test-data 文档：移除 React Pro 和小程序测试条目，保留 React/Vue admin 条目并验证 JSON/Markdown 格式可解析。

### 脚本、部署与 CI

- [x] 检查 `.github/workflows/ci.yml`、`script/bin/*`、`script/docker/*`、`deploy/*`、`script/run-env.mjs`、`script/generate-app-icon.js`、`script/build-open-wechat-devtools.mjs` 的路径拼接和服务矩阵；删除退役工作区分支，或在确有共享用途时改为仅接受三个保留工作区并对非法值显式报错。
- [x] 更新 `script/docker/docker-compose.yml`、nginx 示例和 `deploy` 文档中的服务名、构建 context、产物目录与网关路由，使其只构建/发布 React 与 Vue 管理端及后端；不得留下 `react-pro`、`weapp-*` 或 docs service。
- [x] 保持 CI admin-frontend 矩阵只有 React/Vue；确认 Node 24.18.0、pnpm 版本、lockfile 路径和后端 Maven runner 与根规则一致。
- [x] 对不再适用的微信 DevTools、文档站同步/链接检查脚本及其帮助文案执行删除或明确退休；删除前确认没有被三个保留工作区或 `script / deploy` 调用。

### 仓库 skills 与测试工具引用

- [x] 更新 `.codex/skills/infoq-admin-e2e`、`infoq-frontend-verify`、`infoq-project-reference`、`infoq-delivery-workflow` 的 `SKILL.md`、`references/*`、`agents/openai.yaml` 和脚本默认值，移除 React Pro、小程序、文档站工作区枚举；保留 React/Vue admin 与 backend 验证入口。
- [x] 检查 `generate-case-matrix.mjs`、`run_admin_e2e.mjs`、`run_admin_crud_e2e.mjs`、`run_notice_crud_e2e.mjs`、`start_admin_dev_stack.mjs` 等脚本：默认 client 只能为 `react` 或 `vue`，路径不存在或传入退役 client 时返回非零并输出可定位错误。
- [x] 同步 skill 描述、默认 prompt、帮助文案与 `.codex/config.toml`/文档中的实际入口；禁止保留只为已删除工作区服务的 helper 或 README。
- [x] 对历史 OpenSpec `tasks.md` 中指向退役工作区的条目做一致性处理：保留历史审计所需的完成记录，避免当前导航或新 change 复制过期矩阵。

### 日志、可观测性与异常处理

- [x] 文档/脚本清理不改变业务日志、审计日志、访问日志、指标或 tracing 配置；脚本拒绝退役工作区时会输出参数、解析后的路径和修复提示。
- [x] 记录删除目录、受影响引用文件、扫描命令及失败原因；验证输出统一写入 `doc/tmp/`，不得散落临时文件。
- [x] 检查未发现保留工作区构建、启动、部署或核心文档链接受影响的回滚触发条件；验证证据已保留。

## 验证映射

### 主流程验证

- [x] 主流程：确认四个退役目录不存在；从根 README 和 `doc/guide/quick-start.md` 按现存命令可定位后端、React、Vue 入口；静态检查 compose/deploy 配置确认仅包含保留服务。
- [x] 定向扫描：使用 `rg -n --hidden` 扫描 `README.md`、`GEMINI.md`、`doc/`、`openspec/`、`script/`、`deploy/`、`.github/`、`.codex/skills/` 中的 `infoq-scaffold-frontend-react-pro|infoq-scaffold-frontend-weapp-react|infoq-scaffold-frontend-weapp-vue|infoq-scaffold-docs`；结果仅允许历史审计说明，并逐条人工确认。
- [x] OpenSpec 门禁：`node .codex/skills/infoq-delivery-workflow/scripts/openspec_check.mjs consolidate-supported-workspaces`（实现前与交付前各执行一次）。

### 定向测试

- [x] 执行受影响 Node CLI 的现有测试与参数解析测试，验证 React/Vue 目标有效、退役目标被显式拒绝；case matrix 生成与消费只覆盖两个管理端。
- [ ] 保留工作区验证：执行 backend、React、Vue 影响矩阵中的定向测试。若确认某工作区没有代码、构建配置或依赖变化，可记录该工作区单测不适用及证据；不得把未执行写成通过。
- [x] 任何无法运行的必需命令必须把环境 blocker、日志路径和影响写入 `doc/tmp/consolidate-supported-workspaces-verification.md`。

### lint / build

- [x] 编码门禁：`node .codex/scripts/validate_utf8.mjs`。
- [x] 对修改的 `.mjs`/`.js` 执行 `node --check <path>`；对修改的部署 shell 执行 `bash -n <path>`；对 Compose 执行静态配置检查而不启动或修改环境。
- [ ] 对受影响前端执行影响矩阵中的 lint 与 build 命令；如果只改文档则记录不适用原因和实际替代检查。Node/pnpm/RSA 配置缺失必须明确记录，不能通过关闭加密或改依赖版本绕过。

### 差异审查

- [x] 差异评审：检查 `git diff --stat`、删除清单、脚本/CI 变更、文档链接和 UTF-8 状态；确认未修改 `sql/infoq_scaffold_2.0.0.sql`、API、数据库、业务页面或共享默认端口。
- [x] 完成交付前检查 performance impact、alerting/observability、rollback path、config/SQL/dependency impact，并将未适用项记录为“无变更”或 residual risk。

## 延期范围

本次不延期目录删除和当前入口修复。历史镜像/外部站点清理、新文档站或移动端替代方案不在本 change 范围内。

## 阻塞与残余风险

- 当前 active change 与本次执行计划已通过 `.gitignore` 显式解除忽略；当前环境创建 `.git/index.lock` 受限，因此尚未执行 staging。
- 长期历史记录允许提及退役工作区，但必须明确为历史说明，且不得被当前命令、导航或测试工具使用。
- 本机缺失 Node 24.18.0、pnpm、JDK 17、Maven 3.9.x、RSA 构建配置或 Compose 时，受影响验证需记录具体 blocker；不因此扩大部署范围或改动业务配置。
- 当前引用扫描只能证明仓库内入口一致；外部发布页面和既有镜像不由本 change 自动修改。
