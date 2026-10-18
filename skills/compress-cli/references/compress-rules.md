> 来源说明：本文件融合通用 `agents-md-compress` 的压缩写作方法与仓库治理规则，作为 `compress-cli` 的压缩与校验契约。

# 压缩与校验契约

## 1. 格式契约

- 第一行固定为 `# AGENTS.md`。
- 其后每个非空行必须匹配 `^\|Category:value$`，即 `|` 开头、包含 `:` 分隔、category 在该行内唯一。
- category 全局唯一：同一个 category 不允许出现两行，合并时必须显式说明合并去向。
- 行内可用 `|` 继续串联同级规则，但不得出现空 category 或空 value。
- 文件为 UTF-8 without BOM；不得出现行尾空白。

## 2. 受保护类别（结构校验与语义评审）

以下类别在任何压缩后都必须仍然存在且语义不被削弱：

- Security And Validation
- Failure Policy
- Root Cause Fix Policy
- Redisson OSS Policy
- SQL Migration Policy
- Release Guardrails
- Acceptance Contract
- Execution Loop
- Spec Workflow
- Repo Skill Policy
- Skill Runtime Policy
- Encoding Gate
- Docs Sync
- MCP Config Truth

新增敏感类别时，必须同时更新 `scripts/agents_check.mjs` 的 `PROTECTED_CATEGORIES` 与本节。

脚本检查类别存在性，不解析规则的业务语义。类别缺失由脚本拒绝；语义弱化必须通过上下文与 diff 人工评审识别并拒绝，不能因脚本通过就宣称语义完整。该工具仅检查根 `AGENTS.md`，近层规约需另外读取和核对。

## 3. 路由一致性契约

`agents_check.mjs check` 校验四条路由真值必须互相一致：

1. `|Local Skills:skills:{...}` 列出的 skill 集合。
2. `skills/` 下的真实 skill 目录集合。
3. `docs/SKILLS.md` 「当前关键 skills」表格里反引号包裹的 skill 名集合。
4. `|Skill Trigger:` 与 `|Skill Priority:` 中出现的 `*-cli` skill 引用。

每条规则：

- 列出的 skill 必须存在对应目录，且目录内必须有 `SKILL.md` 与 `agents/openai.yaml`。
- `agents/openai.yaml` 的 `default_prompt` 必须显式包含 `$<skill-name>`。
- 目录存在但未被 Local Skills 或 docs/SKILLS.md 收录 → 失败（防止"幽灵 skill"）。
- 引用不存在的 skill → 失败（防止"失效路由"）。

## 4. 引用路径契约

`AGENTS.md` 中被反引号包裹的仓库内路径必须真实存在：

- 允许的根前缀：`tools/`、`docs/`、`deploy/`、`skills/`、`sql/`、`openspec/`、`.codex/`、`backend/`、`frontend-vue/`、`frontend-react/`、`tmp/`、`README.md`、`README_CN.md`、`README_JA.md`、`README_ZH_TW.md`、`AGENTS.md`、`DEV_GUIDE.md`、`CONTRIBUTING.md`、`SECURITY.md`、`Makefile`。
- 带通配符（`*`、`YYYYMMDD`、`x.y.z`、`<...>`）的路径按模式跳过。
- 仅 `docs/plan/` 与 `openspec/changes/` 允许尚未创建，校验器通过 `git check-ignore --no-index` 核验其忽略策略并在结果中列出；已存在时必须是目录。具体计划文件引用不享受此例外。目录可继续写入本地计划，由用户手动清理，校验器不创建或删除计划。
- 路径检查不校验文件内容正确性。

## 5. 预算契约

`agents_check.mjs budget` 输出（不作为失败条件，仅作评审输入）：

- 总行数、非空行数、字节数。
- 每个 category 的 value 长度排名（Top N）。
- 单行长度超过 400 字符的条目列表（提示可下钻到 docs）。
- 重复片段检测：同一 value 出现在多个 category 时提示。

## 6. 失败语义

- 任一契约失败 → 非零退出码 + 明确失败条目，禁止静默通过。
- 校验器只读：不得提供自动改写或自动删除规则的模式。
- 压缩提交前必须运行 `check` + `test_agents_check.mjs`；两者结果写入交付证据。
