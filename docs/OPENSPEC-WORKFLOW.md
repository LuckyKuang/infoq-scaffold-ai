# InfoQ OpenSpec 交付流程

## 目的

本文档用于规范 Codex 如何通过 OpenSpec 产物、稳定规格与显式校验推进功能交付。默认按根 `AGENTS.md` 的专家职责顺序协作，主线程负责范围、依赖关系与最终验收。

## 目录规则

- 长期项目上下文放在 `openspec/config.yaml` 的 context 段
- 当前真值 specs 放在 `docs/specs/`
- 进行中的 change 产物放在 `openspec/changes/<change-id>/`
- 仓库级自定义 agent 真值放在 `.codex/agents/`
- `openspec/changes/` 与 `docs/plan/` 仅供本地计划使用，均由 Git 忽略，不提交、不进 PR；后续执行计划继续写入 `docs/plan/`，目录不存在时按需创建，由用户手动清理；版本控制仅保留可复用流程、已接受的 `docs/specs/` 规格与测试

## 执行模式

- 默认职责顺序：`requirements_expert -> technical_designer -> code_implementer -> auto_fixer`，不得在依赖的需求与任务产物完成前启动实现。
- 主线程先确认当前会话可用角色与工具；若运行环境限制子代理，则按相同职责顺序亲自完成并记录限制，不凭角色文件存在就假设某个宿主一定已加载。
- 文件可独立认领的任务可并行；明确每位参与者的可写路径，禁止覆盖他人的改动。
- 实现前创建或更新 `proposal.md`、`tasks.md` 与相关 spec delta，并通过 `node tools/openspec_check.mjs <change-id>`。

## 专家职责

| Agent | Primary output |
| --- | --- |
| `requirements_expert` | `proposal.md` + spec deltas |
| `technical_designer` | `tasks.md` |
| `code_implementer` | repository code + task checklist updates |
| `auto_fixer` | repository code fixes + verification reruns |

重大 UI/UX 改动必须执行 `docs/UI-WORKFLOW.md` 的四阶段门禁。主线程维护 `design.md` 不能替代 `LAYOUT APPROVED` 与 `DEMO APPROVED`。

`materials.md` 与 `review.md` 可选保留，仅在变更确实需要时由父线程创建。

## 跨工作区规则

每个 change 都必须显式评估以下工作区或交付面：

- `backend`
- `frontend-react`
- `frontend-vue`
- `docs`
- `script / deploy`
- `skills`

若某个工作区或交付面不受影响，必须在 `tasks.md` 中写明原因。

## 规划规则

当用户要求暂不实现后续阶段时，应在 active OpenSpec 产物中保留为 deferred scope，禁止静默删除。

`proposal.md` 最低应包含：

- `背景`
- `问题陈述`
- `目标与成功指标`
- `用户故事`
- `范围`
- `非目标`
- `约束`
- `验收约定`
- `延期范围`
- `风险与待确认`

章节级别与固定标题以 `openspec/examples/demo-change/proposal.md` 为准；验收约定必须包含功能范围、非目标、异常与阻塞、必需证据和回滚触发条件。

`tasks.md` 最低应包含：

- `交付概览`
- `影响矩阵`
- `实施任务`
- `验证映射`
- `延期范围`
- `阻塞与残余风险`

`验证映射` 下必须包含 `主流程验证`、`定向测试`、`lint / build`、`差异审查` 四节，并使用任务复选项记录真实进展。模板中的占位符通过结构检查不代表内容已完成，进入实现前必须替换为具体任务与验收依据。

## 验证规则

交付闭环只有在 active change 显式记录以下内容后才算完成：

- `openspec-check` 通过
- verification commands
- verification outcomes
- residual risks or blockers
- rollback trigger or rollback conditions

结构校验在实现前与交付前执行；运行验证顺序固定为主流程验证 → 定向测试 → lint/build 或等价检查 → 差异审查。必需检查受阻时保留 active 状态并记录具体阻塞，不以勾选清单替代执行证据。
