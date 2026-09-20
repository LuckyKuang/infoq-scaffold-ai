# 快速开始

本文档覆盖当前仓库的三个受支持工作区：Spring Boot 后端、React 管理端和 Vue 管理端。

## 1. 环境准备

| 组件 | 建议版本 |
| --- | --- |
| JDK | 21 |
| Maven | 3.9.x |
| Node.js | 24.18.0 |
| pnpm | >= 10.0.0 |
| MySQL | 8.x |
| Redis | 7.x |

部署时还需要 Docker Compose、Nginx 和 MinIO，详见 [deploy-prerequisites.md](../devops/deploy-prerequisites.md)。

## 2. 初始化数据库

1. 创建 MySQL 数据库，例如 `infoq`。
2. 导入冻结初始化基线：`sql/infoq_scaffold_3.0.0.sql`。
3. 准备 Redis。
4. 按使用的 profile 修改后端配置中的数据库和 Redis 连接信息。

初始化数据包含 `sys_client`、菜单、角色和用户等基础数据。全新环境的登录信息以实际导入数据为准，不要猜测已有环境的密码。

## 3. 启动后端

```bash
node .codex/scripts/backend_mvn.mjs -- clean install -DskipTests
java -jar infoq-scaffold-backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=dev
```

本地联调也可以使用 `local` profile：

```bash
java -jar infoq-scaffold-backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=local
```

启动后先检查首页 `http://127.0.0.1:8080/` 和验证码接口 `http://127.0.0.1:8080/auth/code`。验证码接口不通时，先修复后端依赖再启动前端。

## 4. 启动管理端

Vue 和 React 管理端都通过 `/dev-api` 访问后端，默认代理目标为 `http://localhost:8080`，可用 `VITE_APP_PROXY_TARGET` 覆盖。

### Vue 管理端

```bash
cd infoq-scaffold-frontend-vue
pnpm install
pnpm run dev
```

### React 管理端

```bash
cd infoq-scaffold-frontend-react
pnpm install
pnpm run dev
```

两个前端默认使用端口 `80`。同时启动时，请先通过环境变量为其中一个配置不同端口。`VITE_APP_ENCRYPT`、RSA 密钥和后端解密配置必须保持一致，登录请求的 `clientId` 与初始化数据也必须匹配。

## 5. 第一轮验证

后端应能连接 MySQL 和 Redis，且启动日志没有 profile、连接或 Bean 装配异常。两个管理端都应能打开登录页、显示验证码、完成登录、请求 `/system/menu/getRouters` 并渲染首页和系统菜单。

## 6. 常用命令

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

## 7. 常见问题入口

| 问题类型 | 先看哪里 |
| --- | --- |
| 后端起不来 | `application-*.yml`、控制台日志、数据库 / Redis 连通性 |
| 管理端 401 或登录失败 | 前端 env、后端 `sys_client`、加密开关、`/auth/code` |
| Vue / React 页面白屏 | `pnpm run dev` 控制台、浏览器 Console、路由组件路径 |
| 部署跑不通 | [deploy-prerequisites.md](../devops/deploy-prerequisites.md)、[docker-compose-deploy.md](../devops/docker-compose-deploy.md)、[manual-deploy.md](../devops/manual-deploy.md) |

## 8. 下一步阅读

- 后端：[backend/handbook.md](../backend/handbook.md)
- 管理端：[admin/handbook.md](../admin/handbook.md)
- 协作规则：[development-workflow.md](../collaboration/development-workflow.md)
