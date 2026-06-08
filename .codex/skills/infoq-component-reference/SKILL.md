---
name: infoq-component-reference
description: 参考 Ant Design 与 Element Plus 官方文档进行 React/Vue 组件选型和 API 核验，确保组件用法、版本兼容性、表格/表单/弹窗和状态设计正确。适用于 React Ant Design 或 Vue Element Plus 页面构建、重构和组件 API 查询。
---

# InfoQ 组件参考

本技能只负责一件事：组件库选型与 API 使用核验。

## 框架选择

1. React admin 使用 Ant Design，读取 `references/antd/*`。
2. Vue admin 使用 Element Plus，读取 `references/element-plus/*`。
3. 若任务涉及构建体积、chunk warning 或分包策略，切换到 `infoq-project-reference` 并以当前 Vite 配置为真值。

## 工作流

1. 根据 UI 需求分类组件。
2. 从对应组件总览选择候选组件。
3. 编码前核对官方 API 与当前 lockfile/package 版本兼容性。
4. 验证加载态、空态、错误态、禁用态和破坏性操作态。
5. 尽量复用组件库能力，减少自定义 CSS 覆盖。

## 参考

- Ant Design：`references/antd/component-overview-zh-cn.md`
- Ant Design playbook：`references/antd/component-selection-playbook.md`
- Element Plus：`references/element-plus/component-overview-zh-cn.md`
- Element Plus playbook：`references/element-plus/component-selection-playbook.md`
