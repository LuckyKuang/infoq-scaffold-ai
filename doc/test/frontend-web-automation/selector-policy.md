# 管理端自动化选择器策略

## 优先级

1. 可访问名称：按钮文本、表单 label、菜单文本和弹窗标题。
2. 稳定业务文本：表格列名、模块标题、确认/取消按钮组合。
3. 稳定属性：已有 `data-*`、`aria-*` 或业务标识。
4. 局部结构选择器：仅在没有稳定语义时使用，并限制在当前模块容器内。

## React / Ant Design

React 与 React Pro 默认优先使用 Testing Library 和 Playwright 的 role/name 查询。禁止依赖 Ant Design 或 ProComponents 生成的动态 class、内部层级和图标顺序。

## Vue / Element Plus

Vue 默认优先使用按钮文本、表单 label、表格列名和 `el-dialog` 标题。禁止依赖 Element Plus 生成的动态 class 和内部 DOM 层级。

## data-testid 策略

只有当业务语义不足以稳定定位时才补 `data-testid`。补充前必须列出目标模块、目标元素和替代方案；不得为了测试便利大面积重写 UI。

## 点击路径记录

点击路径必须记录 action、selector、label、client、route、case id 和 timestamp。不得只记录坐标。
