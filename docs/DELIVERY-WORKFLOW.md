> 来源说明：本文件承接交付工作流治理规则，覆盖 Acceptance Contract、OpenSpec 门禁、UI 四阶段与插件治理计划。

# InfoQ 交付工作流

本文件只负责一件事：为高影响或跨工作区变更建立可验证的交付流程。

## 场景选择

1. 新功能、API 契约变更、跨工作区交付或用户明确要求 OpenSpec 时，走 OpenSpec。
2. 单工作区但影响用户可见行为且范围不小的改动，可走 OpenSpec Lite。
3. 重大 UI/UX、布局审批、`LAYOUT APPROVED` 或 `DEMO APPROVED` 门禁，读取 `docs/UI-WORKFLOW.md`，并按四阶段执行。
4. 插件新增、插件开关化、插件治理或插件分类判断，读取 `docs/SKILLS.md` 第 9 节插件矩阵，必要时运行插件计划脚本。
5. 生产或共享环境数据变更、SQL 迁移、批量修复、权限/菜单/任务基础数据调整，必须联动 `docs/DATA-OPS.md`；不确定分级时按 OpenSpec Lite 或 L3。
6. L1 小修复可不建 OpenSpec，但实现前必须写清 Acceptance Contract。
7. 本机部署、Apple container 启停、WSL2/Linux Docker 启停与容器 smoke，使用 `deploy-cli` 并读取 `deploy/DEPLOYMENT_LIFECYCLE.md`。

## 默认命令

初始化 active change：

```bash
node tools/init_change_dir.mjs <change-id>
```

校验 active change：

```bash
node tools/openspec_check.mjs <change-id>
```

生成插件接入计划：

```bash
node tools/generate_plugin_plan.mjs --name infoq-plugin-xxx --class toggle --frontend auto
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

active change 的 OpenSpec 结构校验必须在实现前和交付前通过，不代替以下验证闭环：

1. 主流程验证。
2. 定向测试。
3. 受影响工作区 lint/build 或等价检查。
4. Diff review。

交付前显式检查性能影响、日志/告警覆盖、回滚路径，以及 config/SQL/依赖影响。任何未执行或无法执行的必要检查必须记录为阻塞或残余风险；文档核对不能替代生产环境运行验收。

## 参考

- OpenSpec 工作流：`docs/OPENSPEC-WORKFLOW.md`
- UI/UX 设计辅助层：`docs/UI-WORKFLOW.md`
- 插件治理矩阵：`docs/SKILLS.md` 第 9 节
- 部署生命周期：`deploy/DEPLOYMENT_LIFECYCLE.md`
- OpenSpec 长期项目上下文：`openspec/config.yaml`（context 段）
- 当前规格真值：`docs/specs/`
