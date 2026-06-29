# Subagents 使用指南

## 1. 文档目标

本文档说明如何在 `infoq-scaffold-ai` 仓库内使用 Codex subagents 配合 `OpenSpec` 完成需求交付闭环。流程说明可以用中文，但 agent 名、change 产物文件名和命令保持原文更稳。

适用范围：

- 在仓库内通过 Codex 协作完成需求分析、设计、技术方案、代码实现、自动修复与最终验收
- 覆盖 `infoq-scaffold-backend`、React/Vue/React Pro 管理端、React/Vue 小程序端

## 2. 什么是 Subagents

multi-agent 的价值不是“多开几个 agent”，而是把高噪声、边界清晰的任务交给专门的子 agent，让主线程只保留需求、约束、决策和最终结论。

在本仓库里，subagents 围绕一个 `OpenSpec` change 做最小闭环分工：

1. 需求与规格澄清
2. 技术任务拆解
3. 代码实现
4. 自动修复与验证
5. 主线程验收

## 3. 当前主流程

- 项目级上下文：`openspec/project.md`
- 当前真相规格：`openspec/specs/`
- 活跃变更目录：`openspec/changes/<change-id>/`
- 统一入口 skill：`.codex/skills/infoq-delivery-workflow/`
- repo 级 custom agents 真值：`.codex/agents/`

## 4. 当前可用的专家

| Agent | 责任 |
| --- | --- |
| `requirements_expert` | 分析需求，输出 `proposal.md` 和 spec delta |
| `technical_designer` | 输出 `tasks.md`，明确 backend/admin/weapp 实现矩阵和验证命令 |
| `code_implementer` | 依据 `proposal.md`、`design.md`、`tasks.md` 和 spec delta 落代码 |
| `auto_fixer` | 运行验证并修复真实错误 |

补充约束：

- `design.md` 由主线程按需维护；重大 UI/UX 任务优先切换到 `infoq-delivery-workflow` 的四阶段 UI 门禁
- `materials.md` 只在确有文案、mock data、图标建议价值时由主线程补充
- 最终验收、blocker 总结与是否需要 `review.md` 由主线程负责

## 5. 一次标准使用流程

### 5.1 先准备 change id

推荐格式：

```text
verb-noun
```

示例：

```text
enhance-user-import
```

### 5.2 初始化 change 目录

```bash
node .codex/skills/infoq-delivery-workflow/scripts/init_change_dir.mjs enhance-user-import
```

初始化后先执行：

```bash
node .codex/skills/infoq-delivery-workflow/scripts/openspec_check.mjs enhance-user-import
```

### 5.3 明确告诉 Codex 使用 subagents

推荐提示词：

```text
请使用 infoq-delivery-workflow 工作流处理这个需求。
change id: enhance-user-import

要求：
1. spawn requirements_expert 生成 proposal.md 和 spec deltas
2. spawn technical_designer 生成 tasks.md
3. 如涉及明显 UI/交互决策，主线程先补 design.md，或改走 infoq-delivery-workflow 的四阶段 UI 门禁
4. spawn code_implementer 按计划实现 backend、admin、weapp 需要改动的部分
5. spawn auto_fixer 跑相关验证并修复真实问题
6. 主线程基于验证证据做最终验收；必要时写 review.md 记录 blocker
```

## 6. 推荐执行顺序

```text
requirements_expert
  -> technical_designer
    -> code_implementer
      -> auto_fixer
        -> parent-agent acceptance
```

## 7. Active Change 应该怎么写

### `proposal.md`

必须说清楚：

- 背景与问题陈述
- 核心业务目标与成功指标
- 用户角色与场景
- 本次范围与非目标
- 约束与延期范围
- 验收契约
- 风险、阻塞、待确认问题

### `design.md`

只在需要时创建，必须说清楚：

- 页面或交互入口
- 布局结构
- 用户操作流程
- 加载、空态、错误态、无权限态
- 对 backend/admin/weapp 的设计约束

### `tasks.md`

必须说清楚：

- backend、React admin、Vue admin、React weapp、Vue weapp、docs、script/deploy 的实现矩阵
- 哪些端不改，以及原因
- 验证命令
- 观测点、日志与回滚条件

### spec delta

放在：

```text
openspec/changes/<change-id>/specs/<capability>/spec.md
```

## 8. 多工作区闭环要求

本仓库的 subagent 工作流默认评估七个交付面：

- `infoq-scaffold-backend`
- `infoq-scaffold-frontend-react`
- `infoq-scaffold-frontend-vue`
- `infoq-scaffold-frontend-weapp-react`
- `infoq-scaffold-frontend-weapp-vue`
- `infoq-scaffold-docs`
- `script / deploy`

这不代表每个需求都必须同时改完所有交付面，而是：

- 每个需求都必须显式评估统一交付面是否受影响
- 如果不改某一端，必须在 `tasks.md` 里写出理由
- 不允许“默认跳过某个端但文档里不说明”

## 9. 验证与归档要求

建议按以下顺序验证：

1. 主流程验证
2. 针对性测试
3. lint/build
4. diff review

按工作区最低建议：

- Backend：受影响模块 Maven 测试与必要编译
- React Admin：`pnpm run test`、`pnpm run build:prod`
- Vue Admin：`pnpm run test:unit`、`pnpm run build:prod`
- React Weapp：`pnpm run test`、`pnpm run build:weapp:dev`，必要时 `pnpm --dir infoq-scaffold-frontend-weapp-react build-open:weapp:dev`
- Vue Weapp：`pnpm run typecheck`、`pnpm run test`、`pnpm run build:weapp:dev`，必要时 `pnpm --dir infoq-scaffold-frontend-weapp-vue build-open:weapp:dev`

只有在验证证据充分时，主线程才应该决定是否归档；如验证受阻，再按需写 `review.md` 明确 blocker。
