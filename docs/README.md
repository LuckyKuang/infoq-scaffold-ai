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
[部署指南](../deploy/README.md) → [Docker Compose](../deploy/DOCKER.md) → [Apple container](../deploy/APPLE_CONTAINER.md) → [手动部署](../deploy/MANUAL.md)

**AI 协作**
[AI 协作规范](./AI-COLLABORATION.md) → [Skills 与插件](./SKILLS.md) → [MCP Servers](./MCP-SERVERS.md)

<!-- doc-section:navigation -->
## 文档导航

### 架构与开发

| 文档 | 说明 |
| --- | --- |
| [架构总览](./ARCHITECTURE.md) | 工作区、技术基线、后端模块、登录与菜单链路、双管理端结构 |
| [设计系统](./DESIGN.md) | 管理端视觉语言 |
| [FAQ](./FAQ.md) | 常见问题和排障 |

### 部署运维

| 文档 | 说明 |
| --- | --- |
| [部署指南](../deploy/README.md) | 部署方式、前置条件、端口与目录准备、发布前检查 |
| [Docker Compose](../deploy/DOCKER.md) | WSL2 / macOS Colima / Linux 全栈 Compose 与脚本化部署 |
| [Apple container](../deploy/APPLE_CONTAINER.md) | macOS Apple `container` 本机后端栈 |
| [手动部署](../deploy/MANUAL.md) | 非容器化 JVM + Nginx 部署 |

### AI 协作

| 文档 | 说明 |
| --- | --- |
| [AI 协作规范](./AI-COLLABORATION.md) | AGENTS 分层、subagents、研发工作流、模块文档治理 |
| [Skills 与插件](./SKILLS.md) | 仓库级 skills 使用与后端插件开关矩阵 |
| [MCP Servers](./MCP-SERVERS.md) | MCP server 配置与只读边界 |

### 测试与规格

| 文档 | 说明 |
| --- | --- |
| [管理端 E2E 测试](./TESTING.md) | case 矩阵、政策与入口 |
| [规格真值](./specs/README.md) | 各 capability 的稳定需求规格 |

### 工作区文档

| 工作区 | 文档入口 |
| --- | --- |
| **Vue 管理端** | [README](../infoq-scaffold-frontend-vue/README.md) · [架构](../infoq-scaffold-frontend-vue/doc/architecture.md) · [数据流](../infoq-scaffold-frontend-vue/doc/data-flow.md) |
| **React 管理端** | [README](../infoq-scaffold-frontend-react/README.md) · [架构](../infoq-scaffold-frontend-react/doc/architecture.md) · [数据流](../infoq-scaffold-frontend-react/doc/data-flow.md) |
| **Backend** | [README](../infoq-scaffold-backend/README.md) · [架构](../infoq-scaffold-backend/doc/architecture.md) · [数据流](../infoq-scaffold-backend/doc/data-flow.md) |

<!-- doc-section:structure -->
## 目录结构

```text
docs/
├── README.md            # 文档导航（当前文件）
├── ARCHITECTURE.md      # 架构与开发总览
├── AI-COLLABORATION.md  # AI 协作规范
├── SKILLS.md            # skills 与插件治理
├── MCP-SERVERS.md       # MCP 配置说明
├── TESTING.md           # 管理端 E2E 测试
├── FAQ.md               # 常见问题
├── DESIGN.md            # 设计系统
├── specs/               # 规格真值（capability 需求）
├── testing/             # E2E case 集合
├── plan/                # 治理执行计划
├── ui-demos/            # UI 演示
└── tmp/                 # 临时产物（已忽略）
```

<!-- doc-section:workspaces -->
## 工作区总览

| 工作区 | 作用 | 技术栈 |
| --- | --- | --- |
| `infoq-scaffold-backend` | Spring Boot 后端 | JDK 21, Spring Boot 4.1.1 |
| `infoq-scaffold-frontend-vue` | Vue 管理端 | Vue 3.5, Element Plus 2.14 |
| `infoq-scaffold-frontend-react` | React 管理端 | React 19.2, Ant Design 6.4 |
| `script` / `deploy` | 部署脚本与入口 | Bash, Docker Compose |
| `sql` | 数据库脚本 | MySQL 8 |
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
- **OpenSpec change**：本地计划脚手架，不提交；耐久沉淀在 `docs/` 与提交信息
- **根 README**：保持总览，不重复展开长篇内容
- **AGENTS.md**：只保留机器协作约束，不混入用户手册
- **同步更新**：命令、环境变量、路径变化时及时更新相关文档
- **README 对齐**：修改根 README 后运行 `node tools/check_readme_sync.mjs`
