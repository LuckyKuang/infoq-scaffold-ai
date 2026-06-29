---
title: "Skills 指南"
description: "仓库级 skills 的职责与使用方式。"
outline: [2, 3]
---

> [!TIP]
> 内容真值源：[`doc/collaboration/skills-guide.md`](https://github.com/luckykuang/infoq-scaffold-ai/blob/main/doc/collaboration/skills-guide.md)
> 本页由 `infoq-scaffold-docs/scripts/sync-from-root-doc.mjs` 自动同步生成；请优先修改根 `doc/` 后再重新同步。

# Skills 指南

`.codex/skills` 是本仓库的能力库。
它不是提示词堆积目录，而是把稳定、可复用的研发动作沉淀成仓库内 SOP。

## 1. 设计原则

当前仓库级 skill 遵循这些硬约束：

1. 每个 skill 只解决一个工作域。
2. 仓库级 skill 统一使用 `infoq-` 前缀；创建或更新 skill 使用系统级 `skill-creator`。
3. `.codex/skills` 下不保留共享底座型、README-only、helper-only 或已被新工作域覆盖的旧 skill 目录。
4. React / Vue 与 admin / weapp 差异通过目标 skill 的 `references/*` 或 `--client react|vue` 参数区分，不再按技术栈碎片化拆 skill。
5. skill 的主执行入口必须兼容 Windows / macOS / Linux；统一使用 repo-owned Node CLI 或 `.mjs`，不再保留 `.sh` / `.ps1` / `.cmd` 作为 skill 入口。若内部仍需 Python 等实现，必须由跨平台 Node 入口调度。
6. 仓库级 skill 默认是领域型可执行 SOP：判定范围 -> 只读探测 / dry-run -> 目标与影响枚举 -> 写入或危险动作门禁 -> 执行验证 -> `doc/tmp/` 证据留存与显式失败。
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
| `infoq-frontend-verify` | 前端验证闭环 | React/Vue admin 与 weapp 单测、coverage、lint/build、本地栈、路由和截图验证 |
| `infoq-data-ops` | 数据运维治理 | SQL 增量脚本、数据修复、迁移、MySQL/Redis 只读诊断、回滚脚本和一致性核对 |
| `infoq-admin-e2e` | 管理端 E2E | 测试矩阵、真实验证码登录、动态路由 smoke、CRUD 模式、测试数据和 cleanup |
| `infoq-admin-ops` | 管理端真实操作 | 用户、角色、菜单、字典、参数、公告、OSS、定时任务、权限巡检和页面操作门禁 |
| `infoq-browser-automate` | 通用浏览器执行器 | `playwright-cli` 页面流转、token 注入、截图、console/pageerror 证据 |
| `infoq-component-reference` | 组件库 API 参考 | Ant Design / Element Plus 组件选型、官方 API 核验、版本兼容性 |
| `infoq-release-ops` | 发布与版本操作 | 版本升级、package / 小程序 manifest 字段同步、Docker tag、发布文档、发布前检查 |

## 4. 浏览器 skill 的当前真值

`infoq-browser-automate` 的默认主路径已经切换为仓库内跨平台 CLI：

- `pnpm --dir .codex/skills/infoq-browser-automate/scripts run playwright-cli ...`
- `pnpm --dir .codex/skills/infoq-browser-automate/scripts run chrome-devtools-cli ...`

说明：

- 这两个 CLI 是 repo-owned 入口，适用于 Windows / macOS / Linux。
- 为兼容不同平台和 `pnpm` 参数透传差异，也接受 `run <cli-name> -- ...` 形式，但默认推荐无 `--` 写法。
- 不再维护平台包装脚本，直接调用仓库内 CLI。
- `playwright-cli admin-route-probe` 先走快速 token 获取；若后端明确返回 `captchaEnabled=true`，会自动调用 `infoq-admin-e2e/scripts/captcha_login.mjs` 识别验证码并获取真实 token。
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
- 可以通过重构现有领域 skill 的触发条件、默认步骤、references 或 CLI 参数解决的问题

## 7. 新增或修改 skill 的同步要求

当新增或更新 skill 时，通常还要同步检查：

1. `AGENTS.md` 是否需要新增或调整路由。
2. `README.md` 与 `doc/*.md` 是否仍然准确。
3. 如果 skill 依赖仓库级 MCP，`.codex/config.toml` 与 `doc/collaboration/mcp-servers.md` 是否仍然一致。
4. 若变更了命令、环境变量、入口路径或默认行为，是否已执行 docs 站点同步。
5. `agents/openai.yaml` 的 `default_prompt` 是否显式包含 `$skill-name`，且 `display_name`、`short_description` 是否仍与 `SKILL.md` 一致。
6. 若 skill 会启动 backend、frontend dev server、浏览器 runner、WeChat DevTools runner 或其他长生命周期进程，是否已写入 `doc/tmp/` 状态文件并覆盖端口收口。

`infoq-delivery-workflow` 当前最小 OpenSpec 命令集合是：

```bash
node .codex/skills/infoq-delivery-workflow/scripts/init_change_dir.mjs <change-id>
node .codex/skills/infoq-delivery-workflow/scripts/openspec_check.mjs <change-id>
```

## 8. `.codex/lib` 共享运行时边界

`.codex/lib` 不是 skill 目录，也不对外承诺独立 CLI。
它是 repo-owned skills / scripts 的共享运行时层，当前只保留 3 个跨 skill 复用模块：

| 路径 | 当前职责 | 当前主要消费者 |
| --- | --- | --- |
| `.codex/lib/skill_runtime.mjs` | repo root 解析、`doc/tmp/` 路径、命令执行、进程管理、HTTP/文件辅助等通用运行时能力 | 多数 repo-level skills 与脚本 |
| `.codex/lib/admin_dev_stack.mjs` | 本地 admin backend + frontend 栈的启动、停止、状态文件、日志与端口收口管理 | `infoq-frontend-verify` 的 `start_admin_dev_stack.mjs` / `stop_admin_dev_stack.mjs`、`infoq-admin-e2e` |
| `.codex/lib/weapp_smoke.mjs` | weapp 构建、backend 健康探测、WeChat DevTools smoke runner 编排和运行态状态记录 | `infoq-frontend-verify` 的 `run_weapp_smoke.mjs` |

维护约束：

- 修改 `.codex/lib/*` 的 CLI 参数、默认端口、日志落点或 env 语义时，必须同步检查对应 skill 的 `SKILL.md`、`references/*.md`、`README.md` 与相关 `doc/*.md`。
- `.codex/lib` 只沉淀跨 skill 复用的运行时能力，不把单个 skill 的私有流程提前抽成共享层。
- 共享 helper 产生的状态文件、日志和一次性产物仍统一落在 `doc/tmp/`。
- 任何启动长生命周期进程的 helper 都必须记录 pid、port、log、owned/reused 关系和 `starting/running/passed/failed/interrupted/stopped` 状态；验证完成、失败或中断时关闭 owned 进程，下一次运行前清理 `running` 或 `interrupted` 的旧状态。

## 9. 管理端 E2E

当任务要求“不要跳过验证码”“用 OCR 跑完整登录”“启动后端和前端后逐模块 smoke”“生成管理端测试矩阵”或“设计 CRUD 浏览器自动化模式”时，使用 `infoq-admin-e2e`。

默认命令：

```bash
node .codex/skills/infoq-admin-e2e/scripts/generate-case-matrix.mjs
node .codex/skills/infoq-admin-e2e/scripts/validate-case-matrix.mjs doc/test/frontend-web-automation/case-matrix.json
node .codex/skills/infoq-admin-e2e/scripts/captcha_login.mjs --backend-url http://127.0.0.1:8080 --print-token
node .codex/skills/infoq-admin-e2e/scripts/run_admin_e2e.mjs --client vue
node .codex/skills/infoq-admin-e2e/scripts/run_admin_e2e.mjs --client react
node .codex/skills/infoq-admin-e2e/scripts/run_admin_e2e.mjs --client react-pro
```

说明：

- 真实验证码 E2E 默认不关闭验证码，必须通过 `/auth/code`、OCR 和 `/auth/login` 获取真实 token。
- `captcha_login.mjs` 是共享验证码登录入口，`run_admin_e2e.mjs` 和 `admin-route-probe` 的验证码 fallback 都复用它。
- 首次运行 OCR 场景需要本机 Python 环境可 import `ddddocr`，浏览器依赖仍复用 `infoq-browser-automate`。
- 证据默认写入 `doc/tmp/infoq-admin-e2e/<run-id>/`。
- `run_admin_e2e.mjs` 默认在完成、失败或中断后停止本次 skill 启动的栈；只有成功且需要保留联调进程时显式传 `--keep-stack-after`，失败或中断仍会关闭 owned 进程。
- 管理端 E2E 栈状态按 client 稳定写入 `doc/tmp/infoq-admin-e2e/stack/<vue|react|react-pro>/state.json`，断开后下一次运行会先清理未标记 `keepAlive` 的旧状态。
- 写入型 CRUD、导出、批量操作和权限矩阵必须先定义测试数据、cleanup 和危险动作门禁。

## 10. 前端验证

React / Vue admin 与 weapp 的运行态、单测、coverage、lint/build 都统一使用 `infoq-frontend-verify`。

常用命令：

```bash
node .codex/skills/infoq-frontend-verify/scripts/start_admin_dev_stack.mjs --client vue
node .codex/skills/infoq-frontend-verify/scripts/start_admin_dev_stack.mjs --client react
node .codex/skills/infoq-frontend-verify/scripts/run_weapp_smoke.mjs --client vue --suite smoke
node .codex/skills/infoq-frontend-verify/scripts/run_weapp_smoke.mjs --client react --suite smoke
```

真实验证码登录、OCR 和动态路由 smoke 交给 `infoq-admin-e2e`；`infoq-frontend-verify` 只保留快速登录态诊断和前端运行态验证。
`start_admin_dev_stack.mjs` 状态文件写入 `doc/tmp/infoq-frontend-verify/<client>/state.json`；运行态验证完成或中断后必须执行对应 `stop_admin_dev_stack.mjs` 收口。

## 11. 数据运维

SQL、数据库、Redis、数据修复、迁移、测试数据维护和 API/UI/DB 一致性核对统一使用 `infoq-data-ops`。

说明：

- 冻结初始化 SQL `sql/infoq_scaffold_2.0.0.sql` 永远不要修改。
- 新增、修改、删除表结构或初始化数据，只能新增 `sql/infoq_scaffold_update_YYYYMMDD.sql` 增量脚本。
- 数据写入前必须先列出环境、目标表/key/ID、筛选条件、影响范围、幂等性、回滚脚本和验证查询。
- 共享环境默认只读；生产或共享环境数据变更、SQL 迁移和批量修复必须联动 `infoq-delivery-workflow`。
- 管理端页面操作归 `infoq-admin-ops`；后端接口、登录和运行态验证归 `infoq-backend-verify`。

## 12. 后端验证

后端单测、Mapper XML、登录链路、HTTP smoke、WebSocket cluster smoke 统一使用 `infoq-backend-verify`。

常用命令：

```bash
node .codex/skills/infoq-backend-verify/scripts/verify_login.mjs
node .codex/skills/infoq-backend-verify/scripts/run_smoke.mjs
node .codex/skills/infoq-backend-verify/scripts/run_cluster_smoke.mjs
```

这些脚本启动临时后端时会在 `doc/tmp/infoq-backend-verify/` 写入 `*.state.json`。默认在成功、失败或中断后关闭自己启动的端口；显式 keep 参数只用于临时诊断，必须依赖状态文件后续清理。
