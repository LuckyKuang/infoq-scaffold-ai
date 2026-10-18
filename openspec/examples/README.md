# OpenSpec 示例

本目录保存纳入版本控制的模板，不是 active change。优先执行
`node tools/init_change_dir.mjs <change-id>` 初始化，或将 `demo-change/`
复制到 `openspec/changes/<change-id>/` 后替换占位内容。活跃变更保持本地，
不得将 `openspec/changes/` 放入提交或 PR。

实现前与交付前执行 `node tools/openspec_check.mjs <change-id>`。模板与初始化器
必须保持相同的必需章节、验收约定字段和六个交付面；结构校验通过仅说明格式满足要求。

耐久行为写入对应可复用 `docs/` 文档、`docs/specs/` 规格与自动化测试；具体执行计划
只保留在本地，`docs/plan/` 与 `openspec/changes/` 均由 Git 忽略，不提交或进入 PR。后续执行计划继续写入 `docs/plan/`，按需创建目录，由用户手动清理。
本地 `design.md` 用于必要的技术或 UI 决策；
重大 UI 任务仍须执行 `docs/UI-WORKFLOW.md` 的审批门禁。
