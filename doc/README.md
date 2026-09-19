# 文档中心

InfoQ-Scaffold-AI 的完整文档导航。所有内容基于当前仓库的真实实现，不复述第三方框架的通用说明。

<!-- doc-section:reading-paths -->
## 推荐阅读路径

**首次接手仓库**
[项目概览](./guide/project-overview.md) → [快速开始](./guide/quick-start.md) → [后端手册](./backend/handbook.md) → [管理端手册](./admin/handbook.md) → [FAQ](./guide/faq.md)

**快速启动**
[快速开始](./guide/quick-start.md)

**部署上线**
[部署前置条件](./devops/deploy-prerequisites.md) → [Docker Compose 教程](./devops/docker-compose-tutorial.md) → [Docker Compose 部署](./devops/docker-compose-deploy.md)

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
| [开发工作流](./collaboration/development-workflow.md) | AGENTS、OpenSpec、skills、MCP |

### 部署运维

| 文档 | 说明 |
| --- | --- |
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

<!-- doc-section:structure -->
## 目录结构

```text
doc/
├── README.md                    # 文档导航（当前文件）
├── guide/                       # 入门指南
├── backend/                     # 后端开发
├── admin/                       # 管理端开发
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
| `openspec` | 规格与变更 | OpenSpec 标准 |
| `script` | 部署脚本 | Bash, Docker Compose |
| `sql` | 数据库脚本 | MySQL 8 |

<!-- doc-section:scope -->
## 文档覆盖范围

本文档涵盖：

- 项目定位、目录结构、技术栈与模块边界
- 后端 profile、登录授权、动态菜单、插件配置
- Vue/React 管理端路由、请求封装、构建测试
- 系统监控（在线用户、任务调度、缓存、连接池）
- AI 协作资产（AGENTS.md、.codex/skills、OpenSpec、MCP）

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

<!-- doc-section:related -->
## 相关文档

- [根 README](../README.md) - 项目总览
- [贡献指南](../CONTRIBUTING.md) - 参与贡献
- [开发指南](../DEV_GUIDE.md) - 本地开发
- [安全策略](../SECURITY.md) - 安全报告
- [部署指南](../deploy/README.md) - 快速部署
