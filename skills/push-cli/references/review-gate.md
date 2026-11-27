# PR 前评审门禁

用于在 `push-cli` 提交 PR 之前做一次只读评审。目标是让问题在本地暴露，而不是等 GitHub 校验或线上故障暴露。评审只出报告，不改代码。

## 何时使用

- 准备 `submit-pr --execute` 之前。
- 修复 PR 校验失败后、再次推送之前。
- 用户要求"评审这次改动""看看有没有过度设计"时。

纯文档改动可只跑 Standards 轴；无 spec 来源时 Spec 轴明确写"无 spec 可对照"，不猜测需求。

## 两条轴，分开报告

**Standards**：代码是否符合本仓库已文档化的规则。规则来源按顺序读取：

1. 根 `AGENTS.md` 的 `Change Discipline`、`Failure Policy`、`Root Cause Fix Policy`、`Security And Validation`。
2. 受影响工作区的 `AGENTS.md`（`backend`、`frontend-react`、`frontend-vue`）。
3. `docs/TESTING.md`、`docs/DATA-OPS.md`、`docs/specs/` 中与本次改动相关的约定。

**Spec**：代码是否忠实实现了来源规格。来源按顺序查找：提交信息里的 issue 号、active change 的 `proposal.md`、`docs/specs/<capability>/spec.md`。找不到就跳过并说明。

两条轴必须分节输出，不合并、不跨轴排序。一条改动可能 Standards 通过而 Spec 不通过，反之亦然。

## 评审范围

读 diff，也读 diff 触达的代码：被改函数的调用方、它调用的函数、相关测试与文档。签名、返回值或行为变化时，逐个 grep 调用方。仓库已有分工不重复展开：

- 代码质量与最小实现：根 `AGENTS.md` 的 `Change Discipline`。
- 根因与回退：`Root Cause Fix Policy`。
- 测试边界：`docs/TESTING.md`。

## 每条发现的格式

四条缺一不可，每条一两句话：

1. **是什么**：这段代码在做什么。
2. **问题**：具体输入或场景导致什么错误结果。没有具体案例就不成立。
3. **修法**：能成立的最小修复；优先删代码而不是加层。
4. **不修的后果**：谁会受影响、以什么方式受影响。

禁止风格偏好、"建议考虑"、无案例的担心。

## 分组与收尾

按严重度分三组，空组省略：

- **Must fix**：错误结果、安全、数据丢失、在预期负载下失效、调用方被破坏。
- **Should fix**：风险逻辑缺测试、真实变慢、重复实现、职责混杂、本不该存在的代码。
- **Nice to have**：小幅性能、可读性。

跨组连续编号，便于用户说"修 2 和 5"。结尾三行：

- `Verdict:` 可以合并，或先修哪几条。
- `Lean:` 可删多少行（有精简类发现时）。
- `Not checked:` 没读到或没跑到的部分。

编译、lint、测试的通过与否不是评审结论的替代品；未执行的验证必须写进 `Not checked`。
