# Design System: Cohere Editorial Design

本脚手架采用 **Cohere 风格的编辑感设计 (Editorial Design)**。这种风格强调极简主义、高对比度排版、宽裕的呼吸感空间以及细腻的交互反馈，旨在为后台管理系统提供如同精品期刊般的阅读与操作体验。

## 1. 核心设计原则 (Design Principles)

- **极简主义 (Minimalism)**: 移除不必要的装饰，专注于内容。
- **编辑感排版 (Editorial Typography)**: 通过字体大小、粗细和间距建立清晰的信息层级。
- **呼吸感空间 (Airy Spacing)**: 慷慨的留白，防止界面拥挤。
- **细腻交互 (Subtle Interaction)**: 柔和的阴影切换与平滑的过渡动画 (0.3s ease)。

## 2. 色彩系统 (Color Palette)

系统支持动态主题切换，核心色彩基于 Ant Design 和 Element Plus 的 Token 系统，并通过 Vanilla CSS 进行极简编辑感定制。

### 2.1 模式基准 (Theme Modes)

| 资源 / 模式 | Light Mode (默认) | Dark Mode |
| :--- | :--- | :--- |
| **Layout Background** | `#f5f7fb` | `#141414` (Antd Default Dark) |
| **Container Background** | `#ffffff` | `#1f1f1f` |
| **Primary Text** | `#303133` | `rgba(255, 255, 255, 0.88)` |
| **Regular Text** | `#606266` | `rgba(255, 255, 255, 0.65)` |
| **Border Color** | `#e4e7ed` | `rgba(255, 255, 255, 0.15)` |
| **Table Header BG** | `#f8f8f9` | `#28282a` |

### 2.2 导航系统专用色 (Navigation)

导航项 (Nav Items) 统一采用 `8px` 圆角。

| 导航元素 | Light Theme (Shell) | Dark Theme (Shell) |
| :--- | :--- | :--- |
| **Menu Background** | `#ffffff` | `#1f2d3d` |
| **Menu Text** | `#303133` | `rgba(255, 255, 255, 0.85)` |
| **Hover Background** | `#f5f7fa` | `#263445` |
| **Selected Background** | `#ecf5ff` | `var(--current-color)` |
| **Selected Text** | `var(--current-color)` | `#ffffff` |

### 2.3 品牌与语义 (Brand & Semantics)
- **Primary Color**: `#409eff` (品牌蓝，支持运行时自定义)
- **Success**: `#67c23a` | **Warning**: `#e6a23c` | **Danger**: `#f56c6c`

## 3. 排版系统 (Typography)

### 3.1 字体栈
```css
font-family: Helvetica Neue, Helvetica, PingFang SC, Hiragino Sans GB, Microsoft YaHei, Arial, sans-serif;
```

### 3.2 规范
- **标题**: 加粗 (`700`)，使用深炭灰。
- **标签**: 表单 Label 统一加粗 (`700`)。
- **间距**: 列表行高通常为 `1.4` 至 `1.6`。

## 4. 布局与容器 (Layout & Containers)

### 4.1 页面容器 (.app-container)
- 标准内边距: `24px`，确保充足的呼吸感。
- 底层背景: `#f6f8fb` (Light) / `#141414` (Dark)，为悬浮卡片提供层次基础。

### 4.2 卡片面板与组件载体 (.panel, .app-card)
- **视觉特征**: 
  - 边框: 极淡或隐藏（例如 `1px solid rgba(15, 23, 42, 0.08)` 或通过背景色区分）。
  - 圆角: 内容卡片统一 `12px`，内部表单/按钮控件统一 `8px`。
  - 背景: 纯白 `#ffffff` (Light) / `#1f1f1f` (Dark)。
- **状态反馈**: 
  - 静态阴影: 极柔和的底层投影 `box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06)`。
  - Hover 阴影: 提升悬浮感 `box-shadow: 0 12px 32px rgba(15, 23, 42, 0.10)`。
  - 交互过渡: 全局卡片交互必须包含 `transition: all 0.3s ease`。

### 4.3 标签栏 (TagsViewBar)
- 位于 Header 下方的窄条，用于快速切换历史页面。
- 激活状态使用品牌色填充，非激活状态保持淡雅。

## 5. 组件规范 (Components)

### 5.1 按钮 (Buttons)
- **Plain 模式**: 推荐在非主操作时使用 Plain 模式（白底带边框），保持页面清爽。
- **圆角**: 统一 `8px`。

### 5.2 表格 (Tables)
- **Header**: 背景色 `#f8f8f9`，文字色 `#515a6e`，加粗。
- **单元格**: 紧凑但清晰，移除多余的纵向分割线。

### 5.3 表单 (Forms)
- **配置**: 关闭冒号显示 (`colon: false`)。
- **Label**: 位于输入框左侧或上方，统一右对齐且加粗。

## 6. 页面动效与交互体验 (Page Effects & UX)

本系统不仅追求视觉的编辑感，更通过细腻的动效提升操作的确定感与流畅度。

### 6.1 全局进度反馈 (Loading Progress)
- **nprogress**: 在路由跳转与大数据量加载时，顶部显示细窄的品牌色进度条，消除等待焦虑。

### 6.2 沉浸式认证页面 (Immersive Auth)
- **AuthPageShell**: 登录与注册页面采用独立于主框架的沉浸式布局，强调视觉重心。
- **表单交互**: 
  - 输入框 Prefix 图标采用中性灰 (`#bfbfbf`)，减少干扰。
  - 按钮加载状态 (`loading`): 提交时按钮文字平滑切换为 Loading 图标，提供即时反馈。

### 6.3 页面缓存与平滑切换
- **Keep-Alive**: 支持多标签页状态保持，切换标签时无闪烁加载，维持用户操作上下文。
- **字间距微调**: 关键标题 (如首页 H2) 应用 `letter-spacing: 0.2px`，增强编辑排版的精致感。

## 7. 暗黑模式 (Dark Mode)

脚手架原生支持暗黑模式，通过 `html[data-theme-mode='dark']` 切换。
- **背景**: 自动调整为深色调，减少高频对比，保护视力。
- **对比度**: 保持文字与背景间的足够对比度，符合 WCAG 标准。

## 8. 移动端设计 (Mobile & Mini-program)

移动端设计在延续编辑感的同时，针对触摸交互和小屏显示进行了优化。

### 8.1 核心特征
- **背景**: 使用更柔和的背景色 `#f7f8fa`。
- **圆角**: 采用适中的圆角 `12rpx` (6px)，保持精致且犀利的视觉张力。
- **阴影**: 使用极柔和的投影 `0 4rpx 20rpx rgba(0, 0, 0, 0.04)`，模拟物理层级而不增加视觉负担。

### 8.2 关键组件
- **卡片 (.card-container, .record-card-modern)**: 
  - 侧边状态条: 使用 `status-accent` 提供直观的状态反馈。
  - 呼吸感: 内边距统一采用 `32rpx`，确保文字不拥挤。
- **状态标签 (Status Tags)**: 药丸形状，配合浅色背景与深色文字。
- **悬浮按钮 (FAB)**: 使用品牌渐变色，增强视觉吸引力，并提供明确的主操作入口。

## 9. 响应式与适配

- **桌面端**: 侧边栏支持折叠，在不同分辨率下自动调整内容宽度。
- **移动端**: 自动切换为抽屉式导航，卡片布局由多列转为单列，优化触控热区。
