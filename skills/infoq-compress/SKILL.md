---
name: infoq-compress
description: 维护并校验仓库根 AGENTS.md 的规约压缩与一致性，覆盖行数与分节预算、Local Skills 与 skills/ 目录和 docs/SKILLS.md 的路由一致性、Skill Trigger 引用完整性、被引用路径存在性校验，以及受保护规则类别的语义完整性断言。适用于创建、压缩、更新或校验 AGENTS.md，或怀疑 AI 路由与真实 skill/文档发生漂移时。
---

# InfoQ AGENTS 规约压缩

本技能只处理仓库根 `AGENTS.md` 及其路由一致性。压缩的优先级是**语义完整 > 行数**：任何规则在被用户显式替换前都不得删除或弱化。

## 工作流

1. 先读 `AGENTS.md` 与被它引用的真值文件（`docs/AI-COLLABORATION.md`、`docs/SKILLS.md`、`docs/MCP-SERVERS.md`、各工作区 `AGENTS.md`）。
2. 保留所有既有规则，除非本次需求显式替换；不得在压缩中弱化安全、失败策略、SQL 迁移、发布护栏、Redisson OSS、编码与验收约定等类别。
3. 校验 `AGENTS.md` 引用的脚本、`tools/` 命令与文档路径真实存在，并优先保留仓库维护的入口（如 `tools/backend_mvn.mjs`、`tools/validate_utf8.mjs`）。
4. 保持格式契约：第一行必须是 `# AGENTS.md`；其后每个非空行必须是 `|Category:value`，且 category 唯一。
5. 详细命令与解释留在被引用的文档里，不写回 `AGENTS.md`；不强制固定行数目标。
6. 每次改动后运行校验器与测试：

```bash
node skills/infoq-compress/scripts/agents_check.mjs check
node skills/infoq-compress/scripts/agents_check.mjs budget
node skills/infoq-compress/scripts/test_agents_check.mjs
```

校验器是**只读**的：不提供自动改写模式。安全与发布类规则的压缩必须结合仓库上下文人工评审。

## 与通用 `agents-md-compress` 的分工

- 通用 `agents-md-compress`：负责压缩写作方法与压缩动作本身。
- 本技能（仓库版）：负责**仓库特有真值**——路由一致性、引用路径存在性、受保护类别断言、预算报告与失败关闭。两者配合使用，不互相替代。

## 护栏

- 只读校验：`agents_check.mjs` 不写文件、不改 `AGENTS.md`。
- 不得为了减少行数删除类别；类别合并必须显式说明合并去向。
- 校验失败必须显式失败（非零退出码），禁止把失败当环境噪声。
- 不得把 `AGENTS.md` 的强制规则挪到未纳入版本控制的本地脚手架里。

## 参考

- 压缩与校验契约：`references/compress-rules.md`
- 校验器：`scripts/agents_check.mjs`
- 回归测试：`scripts/test_agents_check.mjs`
- 协作规则总说明：`docs/AI-COLLABORATION.md`
