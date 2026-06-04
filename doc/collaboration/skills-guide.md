# Skills 指南

`.codex/skills` 是本仓库的能力库。
它不是提示词堆积目录，而是把稳定、可复用的研发动作沉淀成仓库内 SOP。

## 1. 设计原则

当前仓库级 skill 遵循这些硬约束：

1. 每个 skill 只解决一类工作。
2. 除 `skill-creator` 外，仓库级 skill 统一使用 `infoq-` 前缀。
3. `.codex/skills` 下不保留共享底座型、README-only 或 helper-only skill 目录。
4. React 家族和 Vue 家族技能允许通过 `references/admin` 与 `references/weapp` 区分客户端，但仍必须保持单一职责。
5. skill 的主执行入口必须兼容 Windows / macOS / Linux；统一使用 repo-owned Node CLI 或 `.mjs`，不再保留 `.sh` / `.ps1` / `.cmd` 作为 skill 入口。若内部仍需 Python 等实现，必须由跨平台 Node 入口调度。

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
| `infoq-browser-automation` | 通用浏览器自动化 | `playwright-cli` 页面流转、token 注入、截图、console 证据 |
| `infoq-react-runtime-verification` | React 家族运行态验证 | React admin 登录、路由校验、weapp DevTools / smoke |
| `infoq-vue-runtime-verification` | Vue 家族运行态验证 | Vue admin 登录、路由校验、weapp DevTools / smoke |
| `infoq-react-unit-test-patterns` | React 家族单测 | React admin / weapp 单测、coverage、回归补测 |
| `infoq-vue-unit-test-patterns` | Vue 家族单测 | Vue admin / weapp 单测、coverage、回归补测 |
| `infoq-backend-unit-test-patterns` | backend 单测 | service / controller / mapper / plugin / aspect |
| `infoq-backend-smoke-test` | backend 冒烟测试 | HTTP smoke、登录、菜单、导出、受保护接口 |
| `infoq-login-success-check` | 登录链路验证 | `/auth/login`、token、受保护接口 |
| `infoq-admin-e2e-captcha-verification` | 真实验证码管理端 E2E | `ddddocr` 识别 `/auth/code`，真实登录后按动态路由 smoke |
| `infoq-admin-web-test-case-generator` | 管理端 Web 自动化测试矩阵 | 从 `sys_menu`、React/Vue 页面、路由和测试生成 `case-matrix` 与缺口报告 |
| `infoq-admin-crud-e2e-patterns` | 管理端 CRUD E2E 模式 | 写入型浏览器自动化的数据、权限按钮、cleanup 和危险动作门禁 |
| `infoq-openspec-delivery` | OpenSpec 交付编排 | L3 / L2 变更、跨工作区交付、stable spec 回填、`openspec-check` |
| `infoq-project-reference` | 仓库静态参考 | 目录、入口、命令、规范 |

## 4. 浏览器 skill 的当前真值

`infoq-browser-automation` 的默认主路径已经切换为仓库内跨平台 CLI：

- `pnpm --dir .codex/skills/infoq-browser-automation/scripts run playwright-cli ...`
- `pnpm --dir .codex/skills/infoq-browser-automation/scripts run chrome-devtools-cli ...`

说明：

- 这两个 CLI 是 repo-owned 入口，适用于 Windows / macOS / Linux。
- 为兼容不同平台和 `pnpm` 参数透传差异，也接受 `run <cli-name> -- ...` 形式，但默认推荐无 `--` 写法。
- 不再维护平台包装脚本，直接调用仓库内 CLI。
- `playwright` MCP 只用于临时交互探索。
- `chrome-devtools` MCP 只用于深度诊断。

## 5. skill 如何被触发

主要来源有三类：

1. 用户显式点名 skill。
2. `AGENTS.md` 的 `Skill Trigger` 命中语义。
3. Codex 读取规则后，按任务类型主动选择最合适的 skill。

因此 skill 的有效性不只取决于脚本，还取决于：

- `SKILL.md` 是否描述清楚触发场景。
- `AGENTS.md` 是否正确路由。
- `README.md` 与 `doc/*.md` 是否与 skill 实际入口一致。

## 6. 何时不该新建 skill

以下情况通常不值得单独沉淀为 skill：

- 只会执行一次的临时任务
- 没有复用价值的个人化流程
- 只有说明、没有输入输出和动作闭环的“文档片段”
- 本质上只是现有 skill 的一个 `references/<variant>`

## 7. 新增或修改 skill 的同步要求

当新增或更新 skill 时，通常还要同步检查：

1. `AGENTS.md` 是否需要新增或调整路由。
2. `README.md` 与 `doc/*.md` 是否仍然准确。
3. 如果 skill 依赖仓库级 MCP，`.codex/config.toml` 与 `doc/collaboration/mcp-servers.md` 是否仍然一致。
4. 若变更了命令、环境变量、入口路径或默认行为，是否已执行 docs 站点同步。

`infoq-openspec-delivery` 当前最小命令集合是：

```bash
node .codex/skills/infoq-openspec-delivery/scripts/init_change_dir.mjs <change-id>
node .codex/skills/infoq-openspec-delivery/scripts/openspec_check.mjs <change-id>
```

## 8. `.codex/lib` 共享运行时边界

`.codex/lib` 不是 skill 目录，也不对外承诺独立 CLI。
它是 repo-owned skills / scripts 的共享运行时层，当前只保留 3 个跨 skill 复用模块：

| 路径 | 当前职责 | 当前主要消费者 |
| --- | --- | --- |
| `.codex/lib/skill_runtime.mjs` | repo root 解析、`doc/tmp/` 路径、命令执行、进程管理、HTTP/文件辅助等通用运行时能力 | 多数 repo-level skills 与脚本 |
| `.codex/lib/admin_dev_stack.mjs` | 本地 admin backend + frontend 栈的启动、停止、状态文件与日志管理 | `infoq-react-runtime-verification`、`infoq-vue-runtime-verification` 的 `start_admin_dev_stack.mjs` / `stop_admin_dev_stack.mjs` |
| `.codex/lib/weapp_smoke.mjs` | weapp 构建、backend 健康探测、WeChat DevTools smoke runner 编排 | `infoq-react-runtime-verification`、`infoq-vue-runtime-verification` 的 `run_weapp_smoke.mjs` |

维护约束：

- 修改 `.codex/lib/*` 的 CLI 参数、默认端口、日志落点或 env 语义时，必须同步检查对应 skill 的 `SKILL.md`、`references/*.md`、`README.md` 与相关 `doc/*.md`。
- `.codex/lib` 只沉淀跨 skill 复用的运行时能力，不把单个 skill 的私有流程提前抽成共享层。
- 共享 helper 产生的状态文件、日志和一次性产物仍统一落在 `doc/tmp/`。

## 9. 真实验证码管理端 E2E

当任务要求“不要跳过验证码”“用 OCR 跑完整登录”或“启动后端和前端后逐模块 smoke”时，使用 `infoq-admin-e2e-captcha-verification`。

默认命令：

```bash
node .codex/skills/infoq-admin-e2e-captcha-verification/scripts/run_admin_e2e.mjs --client vue
node .codex/skills/infoq-admin-e2e-captcha-verification/scripts/run_admin_e2e.mjs --client react
```

说明：

- 该 skill 默认不关闭验证码，必须通过 `/auth/code`、`ddddocr` 和 `/auth/login` 获取真实 token。
- 首次运行需要本机 Python 环境可 import `ddddocr`，浏览器依赖仍复用 `infoq-browser-automation`。
- 证据默认写入 `doc/tmp/infoq-admin-e2e-captcha-verification/<run-id>/`。
- 默认覆盖动态路由只读 smoke；写入型 CRUD、导出、批量操作和权限矩阵需要单独定义测试数据与清理策略。

## 10. 管理端 Web 自动化测试矩阵

当任务要求“生成各功能前端 Web 自动化测试用例”“刷新 React/Vue 管理端测试矩阵”“找出菜单和页面自动化缺口”时，使用 `infoq-admin-web-test-case-generator`。

默认命令：

```bash
node .codex/skills/infoq-admin-web-test-case-generator/scripts/generate-case-matrix.mjs
node .codex/skills/infoq-admin-web-test-case-generator/scripts/validate-case-matrix.mjs doc/test/frontend-web-automation/case-matrix.json
```

说明：

- 后端 `sys_menu` 是动态管理页的主要真值。
- React `src/pages` 与 Vue `src/views` 用于校验组件存在性和双端差异。
- 默认产物写入 `doc/test/frontend-web-automation/`。
- 该 skill 不启动浏览器、不登录、不写业务数据。

## 11. 管理端 CRUD E2E 模式

当任务要求“为用户/角色/字典等模块设计 CRUD 浏览器自动化”“定义测试数据清理策略”“设计权限按钮断言”时，使用 `infoq-admin-crud-e2e-patterns`。

说明：

- 所有写入型用例必须使用 `e2e_` 前缀数据。
- 删除、批量操作、OSS 配置、定时任务执行、用户强退等场景必须显式标记副作用和门禁。
- 该 skill 只沉淀模式，不替代 `infoq-browser-automation` 或 `infoq-admin-e2e-captcha-verification` 的执行底座。
