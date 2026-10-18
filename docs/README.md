# Documentation

README files provide the project overview and quick start. Use the documents
below for detailed configuration and maintenance. All content describes the
current repository; it does not retell third-party framework tutorials.

根 README 只保留总览。详细操作放在 `docs/` 与 `deploy/`。

<!-- doc-section:root -->
## Root Documents

| Document | Description |
| --- | --- |
| [README](../README.md) | English overview and quick start |
| [README 中文](../README_CN.md) | 中文总览与快速开始 |
| [README 繁體中文](../README_ZH_TW.md) | 繁體中文總覽與快速開始 |
| [README 日本語](../README_JA.md) | 日本語概要とクイックスタート |
| [Contributing](../CONTRIBUTING.md) | Toolchain, checks, and PR flow |
| [Developer guide](../DEV_GUIDE.md) | Local setup and troubleshooting |
| [Security policy](../SECURITY.md) | Vulnerability reporting |
| [Deployment](../deploy/README.md) | Installer, Compose, and manual entry |
| [AGENTS.md](../AGENTS.md) | Repository collaboration rules |

<!-- doc-section:reading-paths -->
## 推荐阅读路径

**首次接手仓库**
[架构总览](./ARCHITECTURE.md) → [开发指南](../DEV_GUIDE.md) → [FAQ](./FAQ.md)

**部署上线**
[部署指南](../deploy/README.md) → [部署生命周期](../deploy/DEPLOYMENT_LIFECYCLE.md) → [Docker Compose](../deploy/DOCKER.md) → [Apple container](../deploy/APPLE_CONTAINER.md) → [手动部署](../deploy/MANUAL.md)

**AI 协作**
[AI 协作规范](./AI-COLLABORATION.md) → [Skills 与插件](./SKILLS.md) → [MCP Servers](./MCP-SERVERS.md)

<!-- doc-section:navigation -->
## 文档导航

### 架构与开发

| 文档 | 说明 |
| --- | --- |
| [架构总览](./ARCHITECTURE.md) | 工作区、技术基线、后端模块、登录与菜单链路、双管理端结构 |
| [设计系统](./DESIGN.md) | 管理端视觉语言与组件选型 |
| [数据运维](./DATA-OPS.md) | SQL 增量脚本、冻结基线保护、数据修复、迁移与一致性核对 |
| [发布流程](./RELEASING.md) | 版本格式、发布 PR、tag、Release workflow、产物与回滚 |
| [CI 验证](./CI_VALIDATION.md) | 工作流覆盖、本地等价命令、发布门禁与安全扫描 |
| [FAQ](./FAQ.md) | 常见问题和排障 |
| [文档审计记录](./DOCUMENTATION-AUDIT.md) | 全量覆盖方法、修正结果、工具回归与生产验收阻塞 |

### 部署运维

| 文档 | 说明 |
| --- | --- |
| [部署指南](../deploy/README.md) | 部署方式、前置条件、端口与目录准备、发布前检查 |
| [Docker Compose](../deploy/DOCKER.md) | WSL2 / macOS Colima / Linux 全栈 Compose 与脚本化部署 |
| [部署生命周期](../deploy/DEPLOYMENT_LIFECYCLE.md) | 安装、升级、回滚、停止与数据保留边界 |
| [部署验证 SOP](../deploy/VERIFICATION.md) | 免费商用容器运行时、smoke 清单与阻断收口 |
| [运行时矩阵](../deploy/runtime-matrix.md) | 运行时选择流程与必须停止询问的情况 |
| [WSL2 全流程](../deploy/wsl2-docker-compose.md) | WSL2 Debian 内 Docker CE 的完整步骤 |
| [Apple container](../deploy/APPLE_CONTAINER.md) | macOS Apple `container` 本机后端栈 |
| [手动部署](../deploy/MANUAL.md) | 非容器化 JVM + Nginx 部署 |

### AI 协作

| 文档 | 说明 |
| --- | --- |
| [AI 协作规范](./AI-COLLABORATION.md) | AGENTS 分层、subagents、研发工作流、模块文档治理 |
| [Skills 与插件](./SKILLS.md) | 5 个仓库级 skill 的使用与后端插件开关矩阵 |
| [交付工作流](./DELIVERY-WORKFLOW.md) | Acceptance Contract、OpenSpec 门禁、UI 四阶段与插件治理 |
| [OpenSpec 流程](./OPENSPEC-WORKFLOW.md) | change 生命周期与结构校验 |
| [UI 工作流](./UI-WORKFLOW.md) | 重大 UI/UX 四阶段设计辅助层 |
| [MCP Servers](./MCP-SERVERS.md) | MCP server 配置与只读边界 |

### 测试与规格

| 文档 | 说明 |
| --- | --- |
| [管理端 E2E 测试](./TESTING.md) | case 矩阵、政策与入口 |
| [规格真值](./specs/README.md) | 各 capability 的稳定需求规格 |

### 工作区文档

| 工作区 | 文档入口 |
| --- | --- |
| **Vue 管理端** | [README](../frontend-vue/README.md) · [架构](../frontend-vue/doc/architecture.md) · [数据流](../frontend-vue/doc/data-flow.md) |
| **React 管理端** | [README](../frontend-react/README.md) · [架构](../frontend-react/doc/architecture.md) · [数据流](../frontend-react/doc/data-flow.md) |
| **Backend** | [README](../backend/README.md) · [架构](../backend/doc/architecture.md) · [数据流](../backend/doc/data-flow.md) |

<!-- doc-section:structure -->
## 目录结构

```text
docs/
├── README.md            # 文档导航（当前文件）
├── ARCHITECTURE.md      # 架构与开发总览
├── AI-COLLABORATION.md  # AI 协作规范
├── SKILLS.md            # skills 与插件治理
├── DELIVERY-WORKFLOW.md # 交付门禁与工作流
├── OPENSPEC-WORKFLOW.md # OpenSpec 流程
├── UI-WORKFLOW.md       # UI 四阶段设计辅助层
├── DATA-OPS.md          # 数据运维与 SQL 迁移
├── MCP-SERVERS.md       # MCP 配置说明
├── TESTING.md           # 管理端 E2E 测试
├── FAQ.md               # 常见问题
├── DESIGN.md            # 设计系统与组件选型
├── RELEASING.md         # 发布流程与回滚
├── CI_VALIDATION.md     # CI 覆盖与发布门禁
├── DOCUMENTATION-AUDIT.md # 文档审计方法、结果与剩余阻塞
├── specs/               # 规格真值（capability 需求）
├── testing/             # E2E case 集合
└── images/              # 文档配图
```

<!-- doc-section:workspaces -->
## 工作区总览

| 工作区 | 作用 | 技术栈 |
| --- | --- | --- |
| `backend` | Spring Boot 后端 | JDK 21, Spring Boot 4.1.1 |
| `frontend-vue` | Vue 管理端 | Vue 3.5, Element Plus 2.14 |
| `frontend-react` | React 管理端 | React 19.2, Ant Design 6.4 |
| `deploy` | 部署脚本、运行时矩阵与容器编排 | Bash, Docker Compose, Apple container |
| `sql` | 数据库脚本 | MySQL 8 |
| `skills` | 仓库级 CLI 工作域 | Node.js |
| `tools` | 仓库校验脚本 | Node.js |

<!-- doc-section:scope -->
## 文档覆盖范围

本文档涵盖：

- 项目定位、目录结构、技术栈与模块边界
- 后端 profile、登录授权、动态菜单、插件配置
- Vue/React 管理端路由、请求封装、构建测试
- AI 协作资产（AGENTS.md、`skills`、OpenSpec、MCP）

本文档不涵盖：

- 第三方框架的基础教程（Spring Boot、Vue、React）
- 逐字段的 API 响应说明（使用接口平台）
- 页面原型或视觉设计稿
- 未在仓库中声明的密码、密钥或生产地址

<!-- doc-section:maintenance -->
## 维护建议

- **用户手册**：真值源放在 `docs/` 的主题文档与 `deploy/`
- **规格真值**：放在 `docs/specs/<capability>/spec.md`
- **任务计划**：`openspec/changes/` 与 `docs/plan/` 仅供本地使用，由 Git 忽略，不提交；后续计划继续写入 `docs/plan/`，按需创建目录，由用户手动清理；公共文档保留已接受的规格与可复用流程
- **根 README**：保持总览，不重复展开长篇内容
- **AGENTS.md**：只保留机器协作约束，不混入用户手册
- **同步更新**：命令、环境变量、路径变化时及时更新相关文档
- **README 对齐**：修改根 README 后运行 `node tools/check_readme_sync.mjs`
