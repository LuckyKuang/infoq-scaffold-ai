---
name: infoq-delivery-workflow
description: 编排本仓库高影响交付流程，覆盖 Acceptance Contract、OpenSpec、重大 UI/UX 门禁、跨工作区交付、插件治理计划和 active change 校验。适用于新功能、API 契约变更、跨工作区任务、明确要求 OpenSpec/subagent、多阶段 UI 审批或插件治理方案的场景。
---

# InfoQ 交付工作流

本技能只负责一件事：为高影响或跨工作区变更建立可验证的交付流程。

## 场景选择

1. 新功能、API 契约变更、跨工作区交付或用户明确要求 OpenSpec 时，走 OpenSpec。
2. 单工作区但影响用户可见行为且范围不小的改动，可走 OpenSpec Lite。
3. 重大 UI/UX、布局审批、`LAYOUT APPROVED` 或 `DEMO APPROVED` 门禁，读取 `references/ui-ux/design-intelligence-overlay.md`，并按四阶段执行。
4. 插件新增、插件开关化、插件治理或插件分类判断，读取 `references/plugin/plugin-matrix.md`，必要时运行插件计划脚本。
5. 生产或共享环境数据变更、SQL 迁移、批量修复、权限/菜单/任务基础数据调整，必须联动 `infoq-data-ops`；不确定分级时按 OpenSpec Lite 或 L3。
6. L1 小修复可不建 OpenSpec，但实现前仍必须写清 Acceptance Contract。

## 默认命令

初始化 active change：

```bash
node .codex/skills/infoq-delivery-workflow/scripts/init_change_dir.mjs <change-id>
```

校验 active change：

```bash
node .codex/skills/infoq-delivery-workflow/scripts/openspec_check.mjs <change-id>
```

生成插件接入计划：

```bash
node .codex/skills/infoq-delivery-workflow/scripts/generate_plugin_plan.mjs --name infoq-plugin-xxx --class toggle --frontend auto
```

## Acceptance Contract

实现前必须在当前任务上下文或 `proposal.md` 中定义：

- functional scope
- non-goals
- exception handling and explicit blockers
- required logs or verification evidence
- rollback trigger or rollback conditions

任一项缺失或冲突时，先暴露问题再编码。

## 验证顺序

1. 主流程验证。
2. OpenSpec 结构校验。
3. 定向测试。
4. 受影响工作区 lint/build 或等价检查。
5. Diff review。

## 参考

- OpenSpec 工作流：`references/workflow.md`
- UI/UX 设计辅助层：`references/ui-ux/design-intelligence-overlay.md`
- 插件治理矩阵：`references/plugin/plugin-matrix.md`
- OpenSpec 长期项目上下文：`openspec/project.md`
- 当前规格真值：`openspec/specs/`
