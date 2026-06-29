# InfoQ Scaffold 文档中心

本文档中心参考若依文档站“先导航、再分专题”的组织方式，但所有内容都以当前仓库的真实目录、脚本、配置和代码入口为准，不复述第三方框架的通用说明。

## 文档分层

- 根 `doc/`：正文真值源与资源目录，根 `README.md` 只做导航；正文按 `guide / backend / admin / weapp / devops / collaboration` 分类维护，示例、图片和静态 UI demo 继续放在 `examples/`、`images/`、`ui-demos/`。
- `infoq-scaffold-docs/`：VitePress 文档站展示层，负责导航、主题、同步脚本、构建与部署；发布后承载 `https://doc.infoq.cc`。

## 推荐阅读路径

- 第一次接手仓库：[`guide/project-overview.md`](./guide/project-overview.md) -> [`guide/quick-start.md`](./guide/quick-start.md) -> [`backend/handbook.md`](./backend/handbook.md) -> [`admin/handbook.md`](./admin/handbook.md) / [`weapp/handbook.md`](./weapp/handbook.md) -> [`guide/faq.md`](./guide/faq.md)
- 只想把项目跑起来：[`guide/quick-start.md`](./guide/quick-start.md)
- 只关心部署：[`devops/deploy-prerequisites.md`](./devops/deploy-prerequisites.md) -> [`devops/docker-compose-deploy.md`](./devops/docker-compose-deploy.md) 或 [`devops/manual-deploy.md`](./devops/manual-deploy.md)
- 只关心仓库协作规范：[`collaboration/development-workflow.md`](./collaboration/development-workflow.md) -> [`collaboration/agents-guide.md`](./collaboration/agents-guide.md) -> [`collaboration/skills-guide.md`](./collaboration/skills-guide.md) -> [`collaboration/subagents-guide.md`](./collaboration/subagents-guide.md) -> [`collaboration/mcp-servers.md`](./collaboration/mcp-servers.md)

## 文档导航

### 入门

- [`guide/project-overview.md`](./guide/project-overview.md)：项目定位、工作区分工、能力地图、关键入口。
- [`guide/quick-start.md`](./guide/quick-start.md)：环境准备、本地启动、最小验证闭环。
- [`guide/faq.md`](./guide/faq.md)：常见问题和排障入口。
- [`../infoq-scaffold-docs/README.md`](../infoq-scaffold-docs/README.md)：文档站展示层命令与同步约定。

### 架构与开发

- [`backend/handbook.md`](./backend/handbook.md)：Spring Boot 后端结构、认证链路、插件和配置要点。
- [`admin/handbook.md`](./admin/handbook.md)：Vue / React / React Pro 管理端目录、路由、请求封装、页面扩展方式。
- [`weapp/handbook.md`](./weapp/handbook.md)：Vue / React 小程序端环境变量、页面清单、DevTools 和 e2e。
- [`collaboration/development-workflow.md`](./collaboration/development-workflow.md)：AGENTS、OpenSpec、skills、MCP、验证顺序和日常开发闭环。

### 工作区实现入口

- `infoq-scaffold-docs`：[`README.md`](../infoq-scaffold-docs/README.md) -> [`doc/architecture.md`](../infoq-scaffold-docs/doc/architecture.md) -> [`doc/data-flow.md`](../infoq-scaffold-docs/doc/data-flow.md)
- `infoq-scaffold-frontend-react`：[`README.md`](../infoq-scaffold-frontend-react/README.md) -> [`doc/architecture.md`](../infoq-scaffold-frontend-react/doc/architecture.md) -> [`doc/data-flow.md`](../infoq-scaffold-frontend-react/doc/data-flow.md)
- `infoq-scaffold-frontend-react-pro`：[`README.md`](../infoq-scaffold-frontend-react-pro/README.md) -> [`README.zh-CN.md`](../infoq-scaffold-frontend-react-pro/README.zh-CN.md)
- `infoq-scaffold-frontend-vue`：[`README.md`](../infoq-scaffold-frontend-vue/README.md) -> [`doc/architecture.md`](../infoq-scaffold-frontend-vue/doc/architecture.md) -> [`doc/data-flow.md`](../infoq-scaffold-frontend-vue/doc/data-flow.md)
- `infoq-scaffold-frontend-weapp-react`：[`README.md`](../infoq-scaffold-frontend-weapp-react/README.md) -> [`doc/architecture.md`](../infoq-scaffold-frontend-weapp-react/doc/architecture.md) -> [`doc/data-flow.md`](../infoq-scaffold-frontend-weapp-react/doc/data-flow.md)
- `infoq-scaffold-frontend-weapp-vue`：[`README.md`](../infoq-scaffold-frontend-weapp-vue/README.md) -> [`doc/architecture.md`](../infoq-scaffold-frontend-weapp-vue/doc/architecture.md) -> [`doc/data-flow.md`](../infoq-scaffold-frontend-weapp-vue/doc/data-flow.md)

### 部署与运维

- [`devops/deploy-prerequisites.md`](./devops/deploy-prerequisites.md)：部署前硬性检查项。
- [`devops/docker-compose-deploy.md`](./devops/docker-compose-deploy.md)：脚本化 / Compose 部署。
- [`devops/manual-deploy.md`](./devops/manual-deploy.md)：手动部署与运维交付物。

### 协作与自动化

- [`collaboration/agents-guide.md`](./collaboration/agents-guide.md)：`AGENTS.md` 分层说明。
- [`collaboration/skills-guide.md`](./collaboration/skills-guide.md)：仓库级 skills 目录与使用方式。
- [`collaboration/subagents-guide.md`](./collaboration/subagents-guide.md)：subagent 角色与职责边界。
- [`collaboration/mcp-servers.md`](./collaboration/mcp-servers.md)：项目级 MCP server 真值与审批策略。
- [`collaboration/plugin-catalog.md`](./collaboration/plugin-catalog.md)：插件分类和软开关矩阵。
- [`collaboration/module-doc-governance.md`](./collaboration/module-doc-governance.md)：模块文档如何分层、聚合、同步与写入 `AGENTS.md` 路由。

## 根目录约定

- 根 `doc/` 顶层只保留导航入口、正文分类子目录和非正文目录：`README.md`、`guide/`、`backend/`、`admin/`、`weapp/`、`devops/`、`collaboration/`、`examples/`、`images/`、`plan/`、`ui-demos/`。
- 专题正文统一落在 `guide/`、`backend/`、`admin/`、`weapp/`、`devops/`、`collaboration/`。
- 新增正文时先选分类目录，再决定是否需要同步到 `infoq-scaffold-docs` 的栏目映射。
- `doc/plan/` 存放 repo-level 或高风险治理变更的执行计划，属于受版本控制资产，不作为临时目录使用。
- 仓库内工具、验证、脚本的一次性输出继续统一放在 `doc/tmp/`，该目录才是默认忽略的临时产物目录。

## 文档覆盖范围

- 项目定位、目录结构、技术栈与模块边界。
- 后端 `dev/local/prod` profile、登录授权、动态菜单、插件开关与调试入口。
- Vue / React / React Pro 管理端的路由、请求封装、代理、构建和测试，以及系统监控页面（在线用户、任务调度、缓存、服务监控、Hikari 连接池监控）。
- Vue / React 小程序端的环境变量、AppID、API 域名、构建打开开发者工具与 e2e。
- 仓库特有的 AI 协作资产：`AGENTS.md`、`.codex/skills`、`OpenSpec`、`.codex/config.toml`。

## 这套文档不做什么

- 不代替接口平台，不逐字段解释所有 API 响应。
- 不代替页面原型或视觉设计稿。
- 不试图覆盖第三方框架的基础语法教程。
- 不猜测未在仓库中显式声明的密码、部署密钥或生产地址。

## 工作区总览

| 工作区 | 作用 | 关键入口 |
| --- | --- | --- |
| `infoq-scaffold-backend` | Spring Boot 3 多模块后端 | `infoq-admin/src/main/java/cc/infoq/admin/SysAdminApplication.java` |
| `infoq-scaffold-frontend-vue` | Vue 3 + Element Plus 管理端 | `src/main.ts`、`src/router/index.ts` |
| `infoq-scaffold-frontend-react` | React 19 + Ant Design 管理端 | `src/main.tsx`、`src/router/AppRouter.tsx` |
| `infoq-scaffold-frontend-react-pro` | React 19 + Ant Design Pro 管理端 | `config/config.ts`、`config/routes.ts`、`src/app.tsx` |
| `infoq-scaffold-frontend-weapp-vue` | uni-app Vue 小程序端 | `src/pages.json`、`src/api/request.ts` |
| `infoq-scaffold-frontend-weapp-react` | Taro React 小程序端 | `src/app.config.ts`、`src/api/request.ts` |
| `openspec` | 规格、变更、设计资产 | `project.md`、`specs/`、`changes/` |
| `script` | 部署、构建、DevTools 打开辅助脚本 | `script/bin/`、`script/docker/` |
| `sql` | 初始化 SQL 与升级脚本 | `infoq_scaffold_2.0.0.sql` |
| `doc` | 使用者和交付文档 | 当前目录 |

## 建议维护方式

- 用户手册真值源放在 `doc/` 的分类子目录里，面向“如何使用项目、如何启动、如何排障”。
- 根 `README.md` 保持总览，不重复展开长篇专题内容。
- `AGENTS.md` 只保留机器协作约束，不混入用户手册。
- 当命令、环境变量、目录入口或部署路径发生变化时，优先同步更新受影响专题文档与本 `README.md`。
