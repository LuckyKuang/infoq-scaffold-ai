---
name: infoq-admin-crud-e2e-patterns
description: 为本仓库 React/Vue 管理端 CRUD 浏览器自动化沉淀测试模式。适用于设计用户、角色、菜单、部门、字典、配置、公告、OSS、定时任务等管理模块的新增、编辑、删除、导入导出、权限按钮、测试数据、cleanup 和危险动作门禁策略。
---

# InfoQ 管理端 CRUD E2E 模式

本技能只负责管理端写入型浏览器自动化的模式设计，不直接启动浏览器。

## 适用场景

- 为 React/Vue 管理端模块补 P1/P2 浏览器 E2E。
- 设计新增、编辑、删除、导入、导出、批量操作等测试步骤。
- 定义 `e2e_` 测试数据、cleanup 和人工回滚提示。
- 设计权限按钮显示/隐藏断言。
- 判断某个操作是否需要危险动作门禁。

## 工作流

1. 先读取 `infoq-admin-web-test-case-generator` 生成的 `case-matrix.json`。
2. 只选择 `priority=P1|P2` 且确有业务价值的模块。
3. 按 `references/crud-patterns.md` 选择场景模板。
4. 按 `references/test-data-policy.md` 定义测试数据。
5. 按 `references/cleanup-policy.md` 定义清理或回滚。
6. 按 `references/selector-policy.md` 设计稳定选择器。
7. 如需真实浏览器执行，交给 `infoq-admin-e2e-captcha-verification` 或后续专门执行器。

## 默认边界

- 不修改产品代码绕过权限。
- 不默认执行批量删除、用户强退、缓存清理、OSS 配置切换、定时任务立即执行。
- 不把测试数据写入冻结初始化 SQL。
- 不用修改测试隐藏产品缺陷。

## 参考

- CRUD 模式：`references/crud-patterns.md`
- 测试数据策略：`references/test-data-policy.md`
- 清理策略：`references/cleanup-policy.md`
- 选择器策略：`references/selector-policy.md`
