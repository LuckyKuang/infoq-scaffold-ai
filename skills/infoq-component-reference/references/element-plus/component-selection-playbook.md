# 组件选型手册

请在阅读 `component-overview-zh-cn.md` 后使用本手册。

## 典型需求 -> 推荐组件

1. 构建 CRUD 管理页
- `Table` + `Pagination` + `Dialog` + `Form` + `Message` + `Popconfirm`

2. 构建设置页
- `Form` + `Input`/`Select`/`Switch` + `Card` + `Divider` (optional from Typography/Layout patterns)

3. 构建向导/步骤流
- `Steps` + `Form` + `Button`
- 完成态使用 `Result`

4. 构建数据看板
- `Card` + `Statistic` + `Progress` + `Table` or `Descriptions`
- 加载态使用 `Skeleton`，空数据使用 `Empty`

5. 构建侧边栏编辑
- `Drawer` + `Form`
- 仅在需要强焦点阻塞时优先 `Dialog`

6. 构建搜索/筛选工具栏
- `Form` (inline) + `Input` + `Select` + `Date Picker`
- 活跃筛选项使用 `Tag`

## 决策启发

- 需要严格表单校验时：
- 使用带 rules 的 `Form`；优先避免自建校验框架。

- 需要破坏性操作保护时：
- 行内操作使用 `Popconfirm`，阻塞确认使用 `Message Box`。

- 需要异步调用后的全局反馈时：
- 短成功/失败用 `Message`，较长通知用 `Notification`。

- 需要超大列表渲染性能时：
- 评估 `Virtualized Select`、`Table V2` 或 `Virtualized Tree`。

## 实现检查清单

编码前：
- 确认官方文档存在该组件。
- 确认本地 `element-plus` 版本支持所选组件。

编码中：
- 优先语义化 slots，避免深层 DOM 覆盖。
- 自定义 CSS 保持最小且局部。
- 保持浮层与表单的键盘/焦点行为完整。

最终回复前：
- 给出组件列表 + 关键 API 选择。
- 说明版本假设。
- 仅在用户请求范围内提供简洁 Vue 3 示例。

## 版本检查命令

```bash
rg '"element-plus"' package.json pnpm-lock.yaml yarn.lock package-lock.json
```

若 lock 文件中无结果，请检查当前使用的包管理器，并同时检查工作区根目录及应用子目录。
