# 项目概览

## 1. 项目是什么

`infoq-scaffold-ai` 是一套把 AI 协作规约、工程自动化 SOP、规格资产和业务代码放在同一仓库的全栈脚手架。仓库不只包含前后端代码，还把“如何做需求、如何验证、如何部署、如何让 AI 按规矩工作”一起固化下来。

这意味着本项目有两层结构：

- 业务交付层：Spring Boot 后端、Vue / React / React Pro 管理端、Vue / React 小程序端。
- 协作治理层：`AGENTS.md`、`.codex/skills`、`OpenSpec`、`.codex/config.toml`、部署脚本、运行验证脚本、文档。

## 2. 仓库结构

```text
infoq-scaffold-ai
├── AGENTS.md
├── .codex/skills
├── .codex/config.toml
├── openspec
├── infoq-scaffold-backend
├── infoq-scaffold-frontend-vue
├── infoq-scaffold-frontend-react
├── infoq-scaffold-frontend-react-pro
├── infoq-scaffold-frontend-weapp-vue
├── infoq-scaffold-frontend-weapp-react
├── infoq-scaffold-docs
├── script
├── sql
└── doc
```

## 3. 工作区职责

| 目录 | 主要职责 | 你通常在这里做什么 |
| --- | --- | --- |
| `infoq-scaffold-backend` | 认证、权限、菜单、系统管理、监控、OSS、客户端、插件能力 | Controller / Service / Mapper / Entity、配置、后端测试 |
| `infoq-scaffold-frontend-vue` | Vue 管理端 | 页面、组件、状态管理、Element Plus 表单表格、Vitest |
| `infoq-scaffold-frontend-react` | React 管理端 | 页面、布局、路由转换、Ant Design、Vitest |
| `infoq-scaffold-frontend-react-pro` | React Pro 管理端 | Ant Design Pro、Umi Max、ProLayout、ProComponents、Vitest |
| `infoq-scaffold-frontend-weapp-vue` | uni-app Vue 小程序端 | 页面路由、移动端请求封装、构建产物、DevTools |
| `infoq-scaffold-frontend-weapp-react` | Taro React 小程序端 | 页面路由、移动端请求封装、构建产物、DevTools |
| `infoq-scaffold-docs` | VitePress 文档站展示层 | 站点导航、主题样式、正文同步、链接校验、构建与部署 |
| `openspec` | 规格真值与进行中的变更 | `proposal.md`、`tasks.md`、`design.md` |
| `script` | 部署、镜像、网关、开发者工具辅助 | `infoq.sh`、`deploy-frontend.sh`、`build-open-wechat-devtools.mjs` |
| `sql` | 初始化与升级脚本 | 新环境建库、版本升级 |
| `doc` | 文档正文真值源、部署说明、协作说明 | 维护 Markdown 正文、示例资源、UI Demo 与阅读入口 |

## 4. 技术栈总览

| 维度 | 技术栈 |
| --- | --- |
| 后端 | JDK 17、Spring Boot 3.5.14、Spring Security、MyBatis-Plus 3.5.16、Springdoc |
| Vue 管理端 | Vue 3.5.35、Vite 8.0.16、Element Plus 2.14.1、Vue Router 5.1.0、Pinia、Vitest 4.1.8 |
| React 管理端 | React 19.2.7、Vite 8.0.16、Ant Design 6.4.3、React Router 7.16.0、Zustand、Vitest 4.1.8 |
| React Pro 管理端 | React 19.2.5、Umi Max 4.6.57、Ant Design 6.4.3、ProComponents 3.1.12-0、Vitest 4.1.8 |
| Vue 小程序端 | uni-app 3、Vue 3、Pinia、Vitest、微信开发者工具 |
| React 小程序端 | Taro 4、React 18、Zustand、Vitest、微信开发者工具 |
| 中间件 | MySQL 8、Redis 7、MinIO |
| 自动化 | Maven、pnpm、Playwright、Chrome DevTools MCP、OpenAI Docs skill |

## 5. 业务能力地图

从后端控制器、初始化菜单和前端页面可以看出，当前项目已经固化了以下主模块。

### 5.1 认证与用户会话

- `/auth/code`：获取验证码。
- `/auth/login`：登录，按 `clientId + grantType` 校验客户端，并走加密请求体。
- `/auth/logout`：退出登录。
- `/auth/register`：注册，是否开放由系统配置控制。
- `/system/user/getInfo`：登录后的用户信息与权限装载入口。

### 5.2 系统管理

- 用户管理
- 角色管理
- 菜单管理
- 部门管理
- 岗位管理
- 字典管理
- 参数设置
- 通知公告
- 文件管理
- 客户端管理
- 个人中心

### 5.3 系统监控

- 在线用户
- 登录日志
- 操作日志
- 定时任务
- 定时任务日志
- 缓存监控
- 服务监控
- 连接池监控

其中连接池监控基于本项目 `Hikari + dynamic-datasource` 原生实现，开发环境兼容 `p6spy` 包装链，不依赖 `Druid` 控制台。
生产可见数据已经收敛为安全摘要指标，不再向前端暴露 JDBC URL、账号、驱动类或连接池实现细节。

### 5.4 插件能力

- 接口加密 `encrypt`
- 邮件 `mail`
- SSE `sse`
- WebSocket `websocket`
- 文档 `doc`
- 翻译、敏感词、Excel、日志、OSS 等插件

插件并不是“演示目录”，而是后端结构的一部分。哪些是固定基座、哪些是软开关，见 [`plugin-catalog.md`](../collaboration/plugin-catalog.md)。

### 5.5 小程序端能力

两套小程序端已经落了移动管理入口，页面覆盖：

- 首页
- 管理台
- 登录
- 公告列表 / 详情 / 编辑
- 个人中心 / 编辑资料
- 用户、角色、部门、岗位、菜单、字典
- 在线用户、登录日志、操作日志、缓存概览

## 6. 运行入口和默认端口

| 场景 | 默认入口 | 说明 |
| --- | --- | --- |
| 后端本地开发 | `http://127.0.0.1:8080` | `application.yml` 中固定端口 |
| Compose 后端 | `http://127.0.0.1:9090` | `infoq.sh deploy` 产物 |
| Vue 管理端 dev | `VITE_APP_PORT`，默认 `80` | 通过 `/dev-api` 代理后端 |
| React 管理端 dev | `VITE_APP_PORT`，默认 `80` | 通过 `/dev-api` 代理后端 |
| React Pro 管理端 dev | `VITE_APP_PORT`，默认 `80` | 通过 `/dev-api` 代理后端，`pnpm run dev` 默认自动打开浏览器 |
| Vue 前端容器直连 | `9091` | Compose 部署 |
| React 前端容器直连 | `9092` | Compose 部署 |
| React Pro 前端容器直连 | `9093` | Compose 部署 |
| Nginx 聚合入口 | `/vue/`、`/react/`、`/react-pro/`、`/prod-api/` | Compose / 手动部署统一入口 |

注意：

- Vue、React 和 React Pro 管理端的 `.env.development` 默认都把 `VITE_APP_PORT` 设为 `80`。如果你打算同时在同一台机器直接启动多个 dev server，必须先调整其中至少一个端口。
- 小程序端不是靠固定 HTTP 端口访问，而是通过 H5 预览或微信开发者工具加载构建产物。

## 7. 配置真值源

| 主题 | 真值文件 |
| --- | --- |
| 后端基础配置 | `infoq-scaffold-backend/infoq-admin/src/main/resources/application.yml` |
| 后端 dev/local/prod 差异 | `application-dev.yml`、`application-local.yml`、`application-prod.yml` |
| Vue 管理端环境变量 | `infoq-scaffold-frontend-vue/.env.*` |
| React 管理端环境变量 | `infoq-scaffold-frontend-react/.env.*` |
| React Pro 管理端环境变量 | `infoq-scaffold-frontend-react-pro/.env.*` |
| Vue 小程序端环境变量 | `infoq-scaffold-frontend-weapp-vue/.env.*` |
| React 小程序端环境变量 | `infoq-scaffold-frontend-weapp-react/.env.*` |
| MCP server 配置 | `.codex/config.toml` |
| Docker / 网关 / 依赖服务 | `script/docker/docker-compose.yml`、`script/docker/nginx/conf/nginx.conf` |
| 初始化数据 | `sql/infoq_scaffold_2.0.0.sql` |

## 8. 典型访问链路

### 管理端

1. 浏览器加载 Vue 或 React 前端。
2. 前端先请求 `/auth/code` 获取验证码。
3. 登录表单提交到 `/auth/login`，请求体默认启用加密，且带 `clientId`、`grantType=password`。
4. 后端校验 `sys_client`、用户、验证码和密码，返回 token。
5. 前端请求 `/system/user/getInfo` 和 `/system/menu/getRouters`，拼装用户信息和动态菜单。
6. 后续页面按权限渲染，并通过统一请求封装处理过期登录、重复提交、下载和国际化头。

### 小程序端

1. 构建阶段从 `.env.*` 注入 `TARO_APP_*` 环境变量。
2. 运行时请求封装根据当前目标平台决定 H5 或微信小程序的 base URL。
3. 请求头补充 `x-client-key`、`x-device-type`、token 和加密头。
4. 若 `TARO_APP_MINI_BASE_API` 不是绝对 URL，则必须额外提供 `TARO_APP_API_ORIGIN`。

## 9. 先读哪篇文档

- 想尽快联调：看 [`quick-start.md`](./quick-start.md)
- 想理解后端：看 [`backend-handbook.md`](../backend/handbook.md)
- 想改管理端页面：看 [`admin-handbook.md`](../admin/handbook.md)
- 想改小程序：看 [`weapp-handbook.md`](../weapp/handbook.md)
- 想理解仓库规约：看 [`development-workflow.md`](../collaboration/development-workflow.md)
