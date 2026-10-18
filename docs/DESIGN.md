# 设计系统与组件选型

本文记录两套 Web 管理端的现有样式来源与设计约束。页面以简洁排版、明确层级和可见状态反馈为目标；具体值由各工作区代码决定，不能把设计目标当作所有页面已实现的结论。重大布局变更遵循 [UI 工作流](./UI-WORKFLOW.md) 的布局、静态演示、实现和运行态验证门禁。

## 1. 核心设计原则

- 用标题、间距和分组区分信息层级，优先内容与操作可辨认性。
- 复用各端现有组件、主题变量和表单/列表模式。
- 明确加载、空、错误、禁用及破坏性操作状态；有意义的反馈优先于装饰动效。

## 2. 色彩与主题来源

| 项目 | React | Vue |
| --- | --- | --- |
| 主题入口 | `frontend-react/src/RootProviders.tsx` | `frontend-vue/src/layout/components/Settings/index.vue`、`src/utils/theme.ts` |
| 全局样式 | `frontend-react/src/styles/index.scss` | `frontend-vue/src/assets/styles/index.scss`、`variables.scss`、`element-ui.scss`、`scaffold.scss` |
| 品牌色默认值 | settings store 的 `#409EFF` | `src/settings.ts` 的 `#409EFF` |
| 主题机制 | Ant Design token 与 `theme.defaultAlgorithm` / `theme.darkAlgorithm` | Element Plus CSS variables；`handleThemeStyle` 更新主色明暗阶 |
| 表头颜色 | `--table-header-bg` / `--table-header-text` | `--tableHeaderBg` / `--tableHeaderTextColor` |

两端浅色表头的现有值为 `#f8f8f9` / `#515a6e`，深色值由各端主题变量覆盖。React 的布局背景在 `RootProviders` 中使用浅色 `#f5f7f9` 或暗色 token；不要把 stylesheet 中的初始 body 值当作最终运行值。

侧栏的 `theme-light` / `theme-dark` 是壳层偏好，与整站深色模式有区别。React 菜单使用 `--menu-*` 变量，Vue 使用 `--menuBg` / `--menuColor` 等；不得直接在另一端复用变量名或声称两端每个颜色完全一致。

## 3. 排版

两端全局字体栈均以 `Helvetica Neue, Helvetica, PingFang SC, Hiragino Sans GB, Microsoft YaHei, Arial, sans-serif` 为基础，全局 label 加粗为 `700`。具体标题字号、行高和控件间距仍由页面/组件样式决定；新增页面应沿用所在工作区的相邻实现。

## 4. 布局与容器

两端全局 `.app-container` 当前内边距为 `20px`，`.panel` / `.search` 使用 `0.75rem` 内边距和圆角，hover 阴影为 `0 4px 16px rgba(0, 0, 0, 0.08)`。React 全局卡片与 Vue Element Plus 卡片覆盖有 `12px` 圆角；控件圆角和页面专属容器以真实组件/样式为准，不假定存在统一 `.app-card`。

TagsView 位于导航栏下方，用于切换访问过的页面。是否缓存由路由 metadata、标签状态和各端缓存实现共同决定。

## 5. 组件样式边界

- React `ConfigProvider` 设置 `form={{ colon: false }}`；Vue 按 `el-form` 的真实属性配置，不能套用 Ant Design 的 `colon` API。
- Vue 按钮可使用 `plain`；React 复用现有 `btn-plain-*` 样式或 Ant Design 对应属性，不假定两端 API 相同。
- 表格与表单优先复用当前页面的查询、操作栏、分页及错误反馈方式，保留横向滚动与窄屏可用性。

## 6. 动效与缓存

路由进度条由 React `AppRouter.tsx` 和 Vue `permission.ts` 接入 NProgress；这不等于所有异步数据请求都有进度条。

React 认证页使用 `AuthPageShell`；Vue 认证页使用各自 SFC 中的布局。React `KeepAliveView` 保存访问页节点并隐藏非激活视图，Vue `AppMain.vue` 使用 `keep-alive` 与 `cachedViews`。缓存不保证所有页面无重载或无闪烁，须对具体页面验证。现有 panel 动画使用 `0.3s cubic-bezier(0.4, 0, 0.2, 1)`，不要要求每张卡片统一添加 `transition: all`。

## 7. 深色模式与无障碍

React 在 `RootProviders.tsx` 同时切换 `html.dark`、`data-theme-mode` 和 `color-scheme`，并更新 Ant Design token；自定义覆盖主要使用 `html[data-theme-mode='dark']`。Vue 通过 `useDark` 切换 `html.dark`，并从 `src/main.ts` 引入 Element Plus 的 `dark/css-vars.css`。

当前没有仓库级 WCAG 达标报告，不能宣称已符合 WCAG。交付受影响页面前需核对明暗主题对比度、键盘操作、焦点可见性、表单标签与错误提示；组件库默认能力不能替代页面验收。

## 8. 小屏 Web 范围

本仓库维护 React / Vue Web 管理端，没有小程序前端工作区。样式使用 CSS 单位（如 `px`、`rem`、百分比）；不在本规范引入不存在的 `rpx` 卡片或 FAB 组件约定。

## 9. 响应式与适配

两端主布局均以 `992px` 为设备模式断点，窄屏时使用覆盖式侧栏与遮罩；具体行为见 React `MainLayout.tsx` 与 Vue `layout/index.vue`。页面表格、弹窗、筛选区和卡片仍需逐页验证，不把壳层适配表述为所有页面自动完成移动端适配。按 [测试政策](./TESTING.md) 在实际 DOM 与截图中核对受影响视口。

## 10. 组件选型与 API 核验 (Component Selection)

本仓库两个管理端分别使用 Ant Design（React admin）与 Element Plus（Vue admin）。本节是组件选型、API 核验与版本兼容的唯一入口；组件库版本以各工作区 `package.json` 与 lockfile 为准，本文不写死版本号。

### 10.1 选型流程

1. 按 UI 需求分类组件（数据录入、数据展示、反馈、导航、布局）。
2. 从官方组件总览选择候选组件：Ant Design `https://ant.design/components/overview-cn/`、Element Plus `https://element-plus.org/zh-CN/component/overview`。
3. 编码前核对官方 API 与本地实际版本兼容性。
4. 验证加载态、空态、错误态、禁用态和破坏性操作态。
5. 优先复用组件库能力，减少自定义 CSS 覆盖。

### 10.2 需求到组件映射

| 需求 | React（Ant Design） | Vue（Element Plus） |
| --- | --- | --- |
| CRUD 管理页 | `Table` + `Pagination` + `Form` + `Modal`/`Drawer` + `message` + `Popconfirm` | `el-table` + `el-pagination` + `el-form` + `el-dialog`/`el-drawer` + `ElMessage` + `el-popconfirm` |
| 设置 / 偏好页 | `Form` + `Input`/`Select`/`Switch` + `Card` + `Divider` | `el-form` + `el-input`/`el-select`/`el-switch` + `el-card` + `el-divider` |
| 向导 / 步骤流 | `Steps` + `Form` + `Button`，完成态用 `Result` | `el-steps` + `el-form` + `el-button`，完成态用 `el-result` |
| 数据看板 | `Card` + `Statistic` + `Progress` + `Table`/`Descriptions`，加载态 `Skeleton`，空态 `Empty` | `el-card` + `el-statistic` + `el-progress` + `el-table`/`el-descriptions`，加载态 `el-skeleton`，空态 `el-empty` |
| 侧边栏编辑 | `Drawer` + `Form`；仅在需要严格阻塞焦点时用 `Modal` | `el-drawer` + `el-form`；仅在需要严格阻塞焦点时用 `el-dialog` |
| 搜索 / 筛选工具栏 | `Form` (inline) + `Input` + `Select` + `DatePicker`，活跃筛选用 `Tag` | `el-form` (inline) + `el-input` + `el-select` + `el-date-picker`，活跃筛选用 `el-tag` |

### 10.3 决策启发

- 需要严格表单校验：使用 `Form` 校验规则与官方状态反馈模式，不要手写错误态。
- 需要破坏性操作保护：行内操作使用 `Popconfirm` / `el-popconfirm`，阻塞确认使用 `Modal.confirm` / `ElMessageBox.confirm`。
- 需要异步调用后的全局反馈：短成功 / 失败用 `message` / `ElMessage`，较长通知用 `notification` / `ElNotification`。
- 需要超大列表性能：先确认组件及本地版本的虚拟滚动能力和限制。Ant Design 的对应组件按官方 API 配置；Element Plus 的 `el-table-v2`、`el-tree-v2` 等是独立组件，不能假定普通 `el-table` / `el-tree` 具有同样 API。
- 需要列表流式 UI：按业务语义选择列表、`Table` 或 `Card`，先核对本地版本及官方迁移说明，不以未经核实的弃用判断替换现有组件。
- 需要全局主题或国际化行为：在应用边界使用 `ConfigProvider` / `el-config-provider`。
- 需要图表时优先复用仓库 ECharts 封装；地图、AI UI 等新依赖先评估业务需求、包体和兼容性，不把未安装的组件生态当作现有能力。

### 10.4 编码检查清单

编码前：

- 确认官方文档存在该组件。
- 确认本地组件库版本支持所选组件与特性。

编码中：

- 优先使用官方 token / theme API，避免深层样式覆盖。
- 自定义 CSS 保持最小且局部。
- 保持 `Modal` / `Drawer` / `el-dialog` / `el-drawer` 的焦点与键盘行为完整。
- 覆盖加载态、空态、错误态、禁用态与破坏性操作态。

最终回复前：

- 给出组件列表与关键 API 选择。
- 说明版本假设。

### 10.5 版本与 API 核验

```bash
rg '"antd"|@ant-design' frontend-react/package.json frontend-react/pnpm-lock.yaml
rg '"element-plus"' frontend-vue/package.json frontend-vue/pnpm-lock.yaml
```

若 lock 文件中无结果，检查当前使用的包管理器，并同时检查工作区根目录与应用子目录。涉及构建体积、chunk warning 或分包策略时，以 `docs/ARCHITECTURE.md` 的 React 构建与分包真值为准。
