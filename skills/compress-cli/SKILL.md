---
name: compress-cli
description: 维护仓库根 AGENTS.md 的规约压缩与一致性，校验格式、行数预算、Local Skills 与 skills/ 目录和 docs/SKILLS.md 的路由、引用路径及受保护类别存在性。适用于创建、压缩、更新或校验根规约，或排查路由漂移；规则语义是否保持须结合上下文人工评审。
---

# InfoQ AGENTS 规约压缩

本技能只处理仓库根 `AGENTS.md` 及其路由一致性。压缩的优先级是**语义完整 > 行数**：任何规则在被用户显式替换前都不得删除或弱化。

## 工作流

1. 先读 `AGENTS.md` 与被它引用的真值文件（`docs/AI-COLLABORATION.md`、`docs/SKILLS.md`、`docs/MCP-SERVERS.md`、各工作区 `AGENTS.md`）。
2. 保留所有既有规则，除非本次需求显式替换；不得在压缩中弱化安全、失败策略、SQL 迁移、发布护栏、Redisson OSS、编码与验收约定等类别。
3. 校验 `AGENTS.md` 引用的脚本、`tools/` 命令与文档路径真实存在，并优先保留仓库维护的入口（如 `tools/backend_mvn.mjs`、`tools/validate_utf8.mjs`）。仅 `docs/plan/` 与 `openspec/changes/` 两个本地计划目录允许尚未创建，仍须由 Git 忽略；目录下具体文件引用仍须存在。后续计划可继续写入，由用户手动清理。
4. 保持格式契约：第一行必须是 `# AGENTS.md`；其后每个非空行必须是 `|Category:value`，且 category 唯一。
5. 详细命令与解释留在被引用的文档里，不写回 `AGENTS.md`；不强制固定行数目标。
6. 每次改动后运行校验器与测试：

```bash
node skills/compress-cli/scripts/agents_check.mjs check
node skills/compress-cli/scripts/agents_check.mjs budget
node skills/compress-cli/scripts/test_agents_check.mjs
```

校验器是**只读**的：不提供自动改写模式，只检查受保护类别存在性等结构条件，不能证明规则语义未被弱化。安全与发布类规则的压缩必须结合仓库上下文人工评审；更近工作区规约也需单独核对，不在本工具的根文件检查范围内。

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
