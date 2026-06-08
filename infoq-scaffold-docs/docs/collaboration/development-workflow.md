---
title: "研发协作与工作流"
description: "从 acceptance contract 到验证闭环的日常流程。"
outline: [2, 3]
---

> [!TIP]
> 内容真值源：[`doc/collaboration/development-workflow.md`](https://github.com/luckykuang/infoq-scaffold-ai/blob/main/doc/collaboration/development-workflow.md)
> 本页由 `infoq-scaffold-docs/scripts/sync-from-root-doc.mjs` 自动同步生成；请优先修改根 `doc/` 后再重新同步。

# 研发协作与工作流

本仓库的重点不是“命令很多”，而是把规则、脚本、验证和文档收敛到同一条可复现交付链路里。

## 1. 先确认真值来源

| 主题 | 真值文件 |
| --- | --- |
| 协作规则 | `AGENTS.md` 与更近工作区 `AGENTS.md` |
| 仓库级技能 | `.codex/skills/*/SKILL.md` |
| 规格与变更 | `openspec/project.md`、`openspec/specs/`、`openspec/changes/` |
| MCP 配置 | `.codex/config.toml` |
| 项目文档 | `README.md` 与 `doc/*.md` |

## 2. AGENTS 分层

规则读取顺序遵循“就近优先”：

1. 先看根 `AGENTS.md`。
2. 再看当前工作区的 `AGENTS.md`。
3. 更近规则与根规则冲突时，以更近规则为准。

`AGENTS.md` 负责约束“如何工作”；`doc/` 负责说明“项目是什么、如何使用、如何验证”。

## 3. OpenSpec 分级

| 级别 | 适用场景 | 要求 |
| --- | --- | --- |
| L3 强制 | 新功能、API 契约变更、跨工作区交付 | 建立 `openspec/changes/<change-id>/`，维护全套工件，并通过 `openspec-check` |
| L2 Lite | 单工作区行为变更，不改 API 契约 | 至少 `proposal.md` + `tasks.md`，交付前通过 `openspec-check` |
| L1 可豁免 | 小修复、不改契约、范围很小 | 可不建 OpenSpec，但必须先写 acceptance contract |

不确定时按更高一级处理。

repo-level 或高风险治理变更，除 active change 外，还应在 `doc/plan/YYYY-MM-DD-topic-plan.md` 中保留执行计划。

## 4. 默认执行顺序

### 4.1 修改前

1. 读取相关工作区规则和仓库文件。
2. 明确 acceptance contract。
3. 若本次使用 active change，先补 `proposal.md` / `tasks.md` 并执行 `openspec-check`。
4. repo-level 或高风险治理变更，补 `doc/plan/` 计划文档。
5. 不靠记忆假设项目结构、脚本名或环境。

### 4.2 修改中

1. 一次只改一类问题。
2. 优先最小闭环，不绑无关重构。
3. `tasks.md` 默认显式评估 backend、React admin、Vue admin、React weapp、Vue weapp、docs、script/deploy。
4. 任何命令、环境变量、skill 入口、文档站同步链路或 MCP 配置变更，都要同步更新 `README.md` 与 `doc/*.md`。

### 4.3 修改后

验证顺序固定为：

1. `main-flow verification`
2. `targeted tests`
3. `lint/build or equivalent checks`
4. `diff review`

说明：`openspec-check` 是 active change 的结构前置校验，不替代上述运行态或构建验证。

## 5. Backend Maven 预检

backend 工作区基线是 JDK 17 与 Maven 3.9.x。

- 后端 Maven 命令优先使用 `node .codex/scripts/backend_mvn.mjs -- ...`，该入口优先读取 `.idea` 项目配置，并在配置不可用时搜索本机 JDK 17 与 Maven 3.9.x。
- 如果必须直接使用 `mvn`，先确认 `java -version` 指向 Java 17，且 `mvn -version` 指向 Maven 3.9.x 与 Java 17。
- 不允许在错误 JDK 下继续碰运气编译，然后把失败误判为代码问题。

## 6. skills 与 MCP 的配合

`skills` 负责把高频任务沉淀成仓库内 SOP；`MCP` 负责补充交互探索或深度诊断能力。

仓库级 skill 默认是领域型可执行 SOP。维护时优先重构现有领域 skill，不新增职责模糊的泛化 skill；只有出现无法归入现有 skill 的新工作域时才新增。标准执行顺序是：判定范围 -> 只读探测/预览 -> 目标与影响枚举 -> 写入或危险动作门禁 -> 执行验证 -> `doc/tmp/` 证据留存与显式失败。

当前默认组合：

- 浏览器主流程：`infoq-browser-automate` + repo-owned `playwright-cli`
- 真实验证码 admin E2E、测试矩阵和 CRUD E2E 模式：`infoq-admin-e2e`
- 真实管理端页面运营维护、权限巡检和危险操作门禁：`infoq-admin-ops`
- SQL、数据库、Redis、数据修复、迁移和一致性核对：`infoq-data-ops`
- React/Vue admin 与 weapp 单测、构建和运行态：`infoq-frontend-verify`
- 后端登录、smoke 和单测验证：`infoq-backend-verify`
- OpenAI / Codex / AGENTS / MCP 问题：`openai-docs`
- 前端深度调试：`chrome-devtools`

说明：

- `playwright-cli` 与 `chrome-devtools-cli` 是仓库内跨平台 CLI，位于 `.codex/skills/infoq-browser-automate/scripts/`。
- `playwright` MCP 用于临时交互探索。
- `chrome-devtools` MCP 用于 Network / Console / Performance 深度诊断。
- 不要回退到任何历史浏览器入口。

## 7. 文档何时必须同步

出现以下变化时，不能只改代码：

- 启动命令变了
- 浏览器自动化主入口变了
- 环境变量或前置条件变了
- MCP server / tool / 审批模式 / 超时变了
- skill 名称或默认行为变了
- docs 站点镜像需要同步的根文档变了

根文档更新后执行：

```bash
pnpm --dir infoq-scaffold-docs run docs:sync
pnpm --dir infoq-scaffold-docs run docs:check-links
pnpm --dir infoq-scaffold-docs run docs:build
```

## 8. 核心原则

- retrieval-first：先读仓库，再下判断
- explicit failure：宁可显式失败，不做静默 fallback
- smallest useful change：优先最小闭环
- evidence-based verification：用命令输出、截图、日志和构建结果说话
- docs as delivery asset：文档是交付物的一部分，不是附属品
