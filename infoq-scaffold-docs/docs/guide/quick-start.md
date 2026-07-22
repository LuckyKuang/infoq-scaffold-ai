---
title: "快速开始"
description: "环境准备、本地启动和最小验证闭环。"
outline: [2, 3]
---

> [!TIP]
> 内容真值源：[`doc/guide/quick-start.md`](https://github.com/luckykuang/infoq-scaffold-ai/blob/main/doc/guide/quick-start.md)
> 本页由 `infoq-scaffold-docs/scripts/sync-from-root-doc.mjs` 自动同步生成；请优先修改根 `doc/` 后再重新同步。

# 快速开始

本文档的目标不是“把所有细节都讲完”，而是让你用当前仓库的真实命令，在最短路径内把后端、管理端和小程序端跑起来，并知道第一轮该验证什么。

## 1. 环境准备

建议先满足以下基线：

| 组件 | 建议版本 |
| --- | --- |
| JDK | 17 |
| Maven | 3.9.x |
| Node.js | 24.18.0 |
| pnpm | >= 10.0.0 |
| MySQL | 8.x |
| Redis | 7.x |
| WeChat DevTools | 小程序调试时需要 |

如果你后面要做部署，再额外准备 Docker Compose、Nginx 和 MinIO。部署细节不在本文展开，见 [`deploy-prerequisites.md`](/devops/deploy-prerequisites)。

## 2. 先理解 profile 和环境文件

### 后端

- 直接使用 Maven 或 `java -jar` 时，默认 Maven profile 仍是 `dev`。
- 仓库本地联调脚本 `start_admin_dev_stack.mjs` / `run_admin_e2e.mjs` 会在存在 `application-local.yml` 时优先选择 `local`。
- 若要稳定命中指定 profile，优先使用 `java -jar` 显式传入 `--spring.profiles.active=...`。
- 本仓库当前推荐的确定性运行路径是先 `node .codex/scripts/backend_mvn.mjs -- clean install -DskipTests`，再运行 `infoq-scaffold-backend/infoq-admin/target/infoq-admin.jar`。

### 管理端

- Vue / React / React Pro 管理端都通过 `.env.development` 控制端口、代理、客户端 ID、加密和 SSE / WebSocket 开关。
- 三个管理端默认都把 `VITE_APP_PORT` 设成了 `80`。如果你想同时起多个 dev server，记得先改其中至少一个端口。

### 小程序端

- Vue / React 小程序都通过 `.env.development` 提供 `TARO_APP_ID`、`TARO_APP_API_ORIGIN`、`TARO_APP_CLIENT_ID` 和加密密钥。
- `build-open-weapp` 系列脚本要求真实 AppID；`touristappid` 或空值会直接失败。

## 3. 初始化数据库

最小闭环建议先把后端依赖准备好：

1. 创建 MySQL 数据库，例如 `infoq`。
2. 导入初始化 SQL：`sql/infoq_scaffold_2.0.0.sql`。
3. 准备 Redis。
4. 根据你选择的 profile，修改对应的后端配置文件中的数据库和 Redis 连接信息。

说明：

- `sql/infoq_scaffold_2.0.0.sql` 会插入 `sys_client`、菜单、角色、用户等基础数据。
- 初始化数据里存在 `admin` 用户和 PC / miniapp 客户端定义，但仓库没有单独提供“统一默认密码文档”。如果你的环境不是全新导入，请以实际数据库数据为准，不要猜密码。

## 4. 启动后端

### 4.1 使用默认 `dev` profile

```bash
node .codex/scripts/backend_mvn.mjs -- clean install -DskipTests
java -jar infoq-scaffold-backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=dev
```

> 说明：上面是手动直跑示例。仓库本地联调脚本会在存在 `application-local.yml` 时优先切到 `local`，以减少本地联调时的数据库和 Redis 错配。

### 4.2 使用 `local` profile

```bash
java -jar infoq-scaffold-backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=local
```

如需继续执行浏览器自动化登录或受保护路由探测，临时追加：

```bash
java -jar infoq-scaffold-backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=local --captcha.enable=false
```

启动后优先验证两个入口：

- 首页：`http://127.0.0.1:8080/`
- 验证码接口：`http://127.0.0.1:8080/auth/code`

如果验证码接口不通，先不要急着起前端，后面的登录一定也不通。

## 5. 启动管理端

Vue、React 和 React Pro 管理端都依赖后端的 `/dev-api` 代理。默认代理目标是 `http://localhost:8080`，也可以通过 `VITE_APP_PROXY_TARGET` 覆盖。

### 5.1 Vue 管理端

```bash
cd infoq-scaffold-frontend-vue
pnpm install
pnpm run dev
```

### 5.2 React 管理端

```bash
cd infoq-scaffold-frontend-react
pnpm install
pnpm run dev
```

### 5.3 React Pro 管理端

```bash
cd infoq-scaffold-frontend-react-pro
pnpm install
pnpm run dev
```

React Pro 默认使用端口 `80`，并在 Umi Max dev server ready 后自动打开浏览器。需要关闭自动打开时，执行 `pnpm run dev -- --no-open`。

### 5.4 管理端启动前必须知道的两件事

1. `VITE_APP_ENCRYPT` 默认开启。前端加密开关、RSA 密钥必须和后端 `api-decrypt.enabled` / RSA 配置保持一致，否则登录会直接失败。
2. 前端登录默认会带 `clientId` 和 `grantType=password`。这些值必须和初始化 SQL 里的 `sys_client` 数据对应。

## 6. 启动小程序端

### 6.1 React 小程序端

先修改 `infoq-scaffold-frontend-weapp-react/.env.development` 中的 `TARO_APP_ID`，再执行：

```bash
pnpm --dir infoq-scaffold-frontend-weapp-react build-open:weapp:dev
```

### 6.2 Vue 小程序端

先修改 `infoq-scaffold-frontend-weapp-vue/.env.development` 中的 `TARO_APP_ID`，再执行：

```bash
pnpm --dir infoq-scaffold-frontend-weapp-vue build-open:weapp:dev
```

小程序额外注意：

- 如果 `TARO_APP_MINI_BASE_API` 不是绝对 URL，必须配置 `TARO_APP_API_ORIGIN`。
- `build-open-weapp` 会自动构建产物、补写 `project.config.json`，并尝试控制 `urlCheck` 行为。
- 如果微信开发者工具报“合法域名”错误，说明当前请求域名不在白名单内，优先检查 `TARO_APP_API_ORIGIN` 和 DevTools 域名校验配置。

## 7. 第一轮验证建议

### 后端

- 能访问 `/auth/code`
- 能正常连上数据库和 Redis
- 启动日志中没有 profile、连接或 Bean 装配异常

### 管理端

- 登录页能打开
- 验证码能显示
- 登录后能请求 `/system/menu/getRouters`
- 首页和系统菜单能渲染

### 小程序端

- `build-open:weapp:dev` 不因 AppID 缺失而失败
- 开发者工具能打开构建产物
- 登录和基础页面能请求到后端

## 8. 常用命令

### 后端

```bash
node .codex/scripts/backend_mvn.mjs -- clean package -P dev
node .codex/scripts/backend_mvn.mjs -- clean package -P prod -pl infoq-admin -am
node .codex/scripts/backend_mvn.mjs -- -pl infoq-modules/infoq-system -am -DskipTests=false test
```

### Vue 管理端

```bash
cd infoq-scaffold-frontend-vue
pnpm run test:unit
pnpm run test:unit:coverage
pnpm run lint:eslint
pnpm run build:prod
```

### React 管理端

```bash
cd infoq-scaffold-frontend-react
pnpm run test
pnpm run test:coverage
pnpm run lint
pnpm run build:prod
```

### React Pro 管理端

```bash
cd infoq-scaffold-frontend-react-pro
pnpm run test
pnpm run test:coverage
pnpm run lint
pnpm run build
```

### React 小程序端

```bash
cd infoq-scaffold-frontend-weapp-react
pnpm run test
pnpm run lint
pnpm run build:weapp:dev
pnpm run verify:local
```

### Vue 小程序端

```bash
cd infoq-scaffold-frontend-weapp-vue
pnpm run typecheck
pnpm run test
pnpm run build:weapp:dev
pnpm run verify:local
```

## 9. 你卡住时先看哪里

| 问题类型 | 先看哪里 |
| --- | --- |
| 后端起不来 | `application-*.yml`、控制台日志、数据库 / Redis 连通性 |
| 管理端 401 / 登录失败 | 前端 env、后端 `sys_client`、加密开关、`/auth/code` |
| Vue / React / React Pro 页面白屏 | `pnpm run dev` 控制台、浏览器 Console、路由组件路径 |
| 小程序请求失败 | `TARO_APP_API_ORIGIN`、合法域名、DevTools Network |
| 部署跑不通 | [`deploy-prerequisites.md`](/devops/deploy-prerequisites)、[`docker-compose-deploy.md`](/devops/docker-compose-deploy)、[`manual-deploy.md`](/devops/manual-deploy) |

## 10. 下一步读什么

- 需要理解后端：看 [`backend-handbook.md`](/backend/handbook)
- 需要改管理端：看 [`admin-handbook.md`](/admin/handbook)
- 需要改小程序：看 [`weapp-handbook.md`](/weapp/handbook)
- 需要理解仓库协作规则：看 [`development-workflow.md`](/collaboration/development-workflow)
