# 组件选型手册

请在阅读 `component-overview-zh-cn.md` 后使用本手册。

## 典型需求 -> 推荐组件

1. 构建 CRUD 管理页
- `Table` + `Pagination` + `Form` + `Modal`/`Drawer` + `message` + `Popconfirm`

2. 构建设置/偏好页
- `Form` + `Input`/`Select`/`Switch` + `Card` + `Divider`

3. 构建向导/步骤流
- `Steps` + `Form` + `Button`
- 完成态使用 `Result`

4. 构建数据看板
- `Card` + `Statistic` + `Progress` + `Table` or `Descriptions`
- 加载态使用 `Skeleton`，空数据使用 `Empty`

5. 构建侧边栏编辑
- `Drawer` + `Form`
- 仅在需要严格阻塞焦点时使用 `Modal`

6. 构建搜索/筛选工具栏
- `Form` (inline) + `Input` + `Select` + `DatePicker`
- 活跃筛选项使用 `Tag`

## 决策启发

- 需要严格表单校验时：
- 使用 `Form` 校验规则与官方状态反馈模式。

- 需要破坏性操作保护时：
- 行内操作使用 `Popconfirm`，阻塞确认使用 `Modal.confirm`。

- 需要异步调用后的全局反馈时：
- 短成功/失败用 `message`，较长通知用 `notification`。

- 需要超大列表性能时：
- 优先使用 `Table`、`Tree`、`TreeSelect`、`Select` 的内建虚拟滚动模式。

- 需要列表流式 UI 时：
- 新需求优先 `Table`/`Card` 组合；当前总览文档中 `List` 标记为 deprecated。

- 需要全局主题/国际化行为时：
- 在应用边界使用 `ConfigProvider`。

- 需要高级图表/地图/AI UI 时：
- 直接转向重型组件生态（`Ant Design Charts`、`AntV L7`、`AntV G2`、`AntV S2`、`Ant Design X`），不要强塞核心组件。

## React 实现检查清单

编码前：
- 确认官方文档存在该组件。
- 确认本地 `antd` 版本支持所选组件。

编码中：
- 优先使用官方 token/theme API，避免深层样式覆盖。
- 自定义 CSS 保持最小且局部。
- 保持 `Modal` 与 `Drawer` 的焦点与键盘行为完整。

最终回复前：
- 给出组件列表 + 关键 API 选择。
- 说明版本假设。
- 仅在用户请求范围内提供简洁 React 示例。

## 版本检查命令

```bash
rg '"antd"|@ant-design' package.json pnpm-lock.yaml yarn.lock package-lock.json
```

若 lock 文件中无结果，请检查当前使用的包管理器，并同时检查工作区根目录及应用子目录。
