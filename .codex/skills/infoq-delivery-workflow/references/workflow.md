# InfoQ OpenSpec 交付流程

## 目的

此技能用于规范 Codex 如何通过 OpenSpec 产物、稳定规格与显式校验推进功能交付；当用户明确要求时，可切换到 subagent 多专家模式。

## 目录规则

- 长期项目上下文放在 `openspec/project.md`
- 当前真值 specs 放在 `openspec/specs/`
- 进行中的 change 产物放在 `openspec/changes/<change-id>/`
- 仓库级自定义 agent 真值放在 `.codex/agents/`
- repo-level 或高风险治理变更的执行计划放在 `doc/plan/`

## 执行模式

- 默认模式：主线程先在本地创建或更新 `proposal.md`、`tasks.md` 与相关 spec delta，并在实现前跑 `openspec-check`
- 多专家模式：当用户明确要求 subagent 或多专家执行时，使用下方专家职责模型

## 专家职责

| Agent | Primary output |
| --- | --- |
| `requirements_expert` | `proposal.md` + spec deltas |
| `technical_designer` | `tasks.md` |
| `code_implementer` | repository code + task checklist updates |
| `auto_fixer` | repository code fixes + verification reruns |

UI 密集型改动应使用 `infoq-delivery-workflow` 的四阶段 UI 门禁，或由父线程直接维护 `design.md`。

`materials.md` 与 `review.md` 可选保留，仅在变更确实需要时由父线程创建。

## 跨工作区规则

每个 change 都必须显式评估以下工作区或交付面：

- `infoq-scaffold-backend`
- `infoq-scaffold-frontend-react`
- `infoq-scaffold-frontend-react-pro`
- `infoq-scaffold-frontend-vue`
- `infoq-scaffold-frontend-weapp-react`
- `infoq-scaffold-frontend-weapp-vue`
- `infoq-scaffold-docs`
- `script / deploy`

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

`tasks.md` 最低应包含：

- `交付概览`
- `影响矩阵`
- `实施任务`
- `验证映射`
- `延期范围`
- `阻塞与残余风险`

## 验证规则

交付闭环只有在 active change 显式记录以下内容后才算完成：

- `openspec-check` 通过
- verification commands
- verification outcomes
- residual risks or blockers
- rollback trigger or rollback conditions
