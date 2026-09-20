# Documentation

README files provide the project overview and quick start. Use the documents
below for detailed configuration and maintenance. All content describes the
current repository; it does not retell third-party framework tutorials.

根 README 只保留总览。详细操作放在 `doc/` 与 `deploy/`。

<!-- doc-section:root -->
## Root Documents

| Document | Description |
| --- | --- |
| [README](../README.md) | English overview and quick start |
| [README 中文](../README_CN.md) | 中文总览与快速开始 |
| [Contributing](../CONTRIBUTING.md) | Toolchain, checks, and PR flow |
| [Developer guide](../DEV_GUIDE.md) | Local setup and troubleshooting |
| [Security policy](../SECURITY.md) | Vulnerability reporting |
| [Deployment](../deploy/README.md) | Installer and Compose entry |
| [AGENTS.md](../AGENTS.md) | Repository collaboration rules |

<!-- doc-section:reading-paths -->
## 推荐阅读路径

**首次接手仓库**
[项目概览](./guide/project-overview.md) → [快速开始](./guide/quick-start.md) → [后端手册](./backend/handbook.md) → [管理端手册](./admin/handbook.md) → [FAQ](./guide/faq.md)

**快速启动**
[快速开始](./guide/quick-start.md) · [开发指南](../DEV_GUIDE.md)

**部署上线**
[部署前置条件](./devops/deploy-prerequisites.md) → [Docker Compose](../deploy/DOCKER.md) → [Apple container](../deploy/APPLE_CONTAINER.md) → [Docker Compose 部署](./devops/docker-compose-deploy.md)

**协作规范**
[开发工作流](./collaboration/development-workflow.md) → [AGENTS 指南](./collaboration/agents-guide.md) → [Skills 指南](./collaboration/skills-guide.md)

<!-- doc-section:navigation -->
## 文档导航

### 入门指南

| 文档 | 说明 |
| --- | --- |
| [项目概览](./guide/project-overview.md) | 项目定位、工作区分工、能力地图 |
| [快速开始](./guide/quick-start.md) | 环境准备、本地启动、最小验证 |
| [FAQ](./guide/faq.md) | 常见问题和排障 |

### 开发手册

| 文档 | 说明 |
| --- | --- |
| [后端手册](./backend/handbook.md) | Spring Boot 结构、认证链路、插件配置 |
| [管理端手册](./admin/handbook.md) | Vue/React 目录、路由、请求封装 |
| [设计系统](./design/DESIGN.md) | 管理端视觉语言 |
| [开发工作流](./collaboration/development-workflow.md) | AGENTS、OpenSpec、skills、MCP |

### 部署运维

| 文档 | 说明 |
| --- | --- |
| [部署指南](../deploy/README.md) | 安装脚本与 Compose 入口 |
| [Docker Compose](../deploy/DOCKER.md) | 容器编排短文档 |
| [Apple container](../deploy/APPLE_CONTAINER.md) | macOS Apple `container` 本机后端栈 |
| [部署前置条件](./devops/deploy-prerequisites.md) | 环境检查、依赖验证 |
| [Docker Compose 教程](./devops/docker-compose-tutorial.md) | WSL2/macOS/Linux 容器部署 |
| [Docker Compose 部署](./devops/docker-compose-deploy.md) | 脚本化部署流程 |
| [手动部署](./devops/manual-deploy.md) | 非容器化部署 |

### AI 协作

| 文档 | 说明 |
| --- | --- |
| [AGENTS 指南](./collaboration/agents-guide.md) | AGENTS.md 分层说明 |
| [Skills 指南](./collaboration/skills-guide.md) | 仓库级 skills 使用 |
| [Subagents 指南](./collaboration/subagents-guide.md) | Subagent 角色与边界 |
| [MCP Servers](./collaboration/mcp-servers.md) | MCP server 配置 |
| [插件目录](./collaboration/plugin-catalog.md) | 插件分类和开关矩阵 |
| [模块文档治理](./collaboration/module-doc-governance.md) | 模块文档分层与同步 |

### 工作区文档

| 工作区 | 文档入口 |
| --- | --- |
| **React 管理端** | [README](../infoq-scaffold-frontend-react/README.md) · [架构](../infoq-scaffold-frontend-react/doc/architecture.md) · [数据流](../infoq-scaffold-frontend-react/doc/data-flow.md) |
| **Vue 管理端** | [README](../infoq-scaffold-frontend-vue/README.md) · [架构](../infoq-scaffold-frontend-vue/doc/architecture.md) · [数据流](../infoq-scaffold-frontend-vue/doc/data-flow.md) |
| **Backend** | [README](../infoq-scaffold-backend/README.md) · [架构](../infoq-scaffold-backend/doc/architecture.md) · [数据流](../infoq-scaffold-backend/doc/data-flow.md) |

<!-- doc-section:structure -->
## 目录结构

```text
doc/
├── README.md                    # 文档导航（当前文件）
├── guide/                       # 入门指南
├── backend/                     # 后端开发
├── admin/                       # 管理端开发
├── design/                      # 设计系统
├── devops/                      # 部署运维
├── collaboration/               # AI 协作
├── examples/                    # 示例代码
├── images/                      # 文档图片
├── plan/                        # 治理计划
├── ui-demos/                    # UI 演示
└── tmp/                         # 临时产物（已忽略）
```

<!-- doc-section:workspaces -->
## 工作区总览

| 工作区 | 作用 | 技术栈 |
| --- | --- | --- |
| `infoq-scaffold-backend` | Spring Boot 后端 | JDK 21, Spring Boot 4.1.1 |
| `infoq-scaffold-frontend-vue` | Vue 管理端 | Vue 3.5, Element Plus 2.14 |
| `infoq-scaffold-frontend-react` | React 管理端 | React 19.2, Ant Design 6.4 |
| `openspec` | 规格与变更 | OpenSpec |
| `script` / `deploy` | 部署脚本与入口 | Bash, Docker Compose |
| `sql` | 数据库脚本 | MySQL 8 |
| `tools` | 仓库校验脚本 | Node.js |

<!-- doc-section:scope -->
## 文档覆盖范围

本文档涵盖：

- 项目定位、目录结构、技术栈与模块边界
- 后端 profile、登录授权、动态菜单、插件配置
- Vue/React 管理端路由、请求封装、构建测试
- AI 协作资产（AGENTS.md、`.codex/skills`、OpenSpec、MCP）

本文档不涵盖：

- 第三方框架的基础教程（Spring Boot、Vue、React）
- 逐字段的 API 响应说明（使用接口平台）
- 页面原型或视觉设计稿
- 未在仓库中声明的密码、密钥或生产地址

<!-- doc-section:maintenance -->
## 维护建议

- **用户手册**：真值源放在 `doc/` 的分类子目录
- **根 README**：保持总览，不重复展开长篇内容
- **AGENTS.md**：只保留机器协作约束，不混入用户手册
- **同步更新**：命令、环境变量、路径变化时及时更新相关文档
- **README 对齐**：修改根 README 后运行 `node tools/check_readme_sync.mjs`
