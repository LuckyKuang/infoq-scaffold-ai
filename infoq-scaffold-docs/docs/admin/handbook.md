---
title: "管理端手册"
description: "三套管理端的共通机制与栈内差异。"
outline: [2, 3]
---

> [!TIP]
> 内容真值源：[`doc/admin/handbook.md`](https://github.com/luckykuang/infoq-scaffold-ai/blob/main/doc/admin/handbook.md)
> 本页由 `infoq-scaffold-docs/scripts/sync-from-root-doc.mjs` 自动同步生成；请优先修改根 `doc/` 后再重新同步。

# 管理端手册

本项目同时维护三套管理端：

- `infoq-scaffold-frontend-vue`
- `infoq-scaffold-frontend-react`
- `infoq-scaffold-frontend-react-pro`

三边并不是三套完全无关的产品，而是共享同一套后端、同一套菜单权限和大部分业务模块，只是在技术栈、目录组织和页面实现方式上不同。

## 1. 共通机制

无论是 Vue、React 还是 React Pro 管理端，都有下面几条共同约定。

### 1.1 登录与授权

- 先请求 `GET /auth/code` 获取验证码。
- 再调用 `POST /auth/login` 进行登录。
- 默认会携带 `clientId` 和 `grantType=password`。
- 登录成功后请求 `/system/user/getInfo` 和 `/system/menu/getRouters`。

### 1.2 动态菜单

- 菜单真值来自后端 `sys_menu`。
- 前端不会把所有业务路由写死在本地。
- 新增页面时，除了前端组件，还要考虑菜单数据和权限标识。

### 1.3 请求封装

三套管理端的请求层都做了这些事：

- 自动带 token 和 `clientid`
- 给 GET 请求拼 query string
- 拦截短时间重复的 POST / PUT
- 根据开关对请求体和响应体做 RSA + AES 加解密
- 统一处理 401、超时、服务端错误、文件下载

### 1.4 `/dev-api` 代理

- `.env.development` 中 `VITE_APP_BASE_API` 默认是 `/dev-api`
- `vite.config.ts` 里会把它代理到 `VITE_APP_PROXY_TARGET` 或默认的 `http://localhost:8080`
- 共享默认后端端口是真值 `8080`；如果开发者本地为了避冲突临时改成 `8081`，必须同步显式覆盖 `VITE_APP_PROXY_TARGET`，不要把 `8081` 固化进共享配置

如果代理目标没配对，页面能打开，但所有接口都会失败。

## 2. 管理端差异

| 维度 | Vue 管理端 | React 管理端 | React Pro 管理端 |
| --- | --- | --- | --- |
| 工作区 | `infoq-scaffold-frontend-vue` | `infoq-scaffold-frontend-react` | `infoq-scaffold-frontend-react-pro` |
| UI 组件库 | Element Plus | Ant Design | Ant Design Pro / ProComponents |
| 路由入口 | `src/router/index.ts` | `src/router/AppRouter.tsx` | `config/routes.ts` + `src/app.tsx` |
| 动态路由转换 | Vue Router 原生路由对象 | `route-transform.ts` + `BackendRouteView.tsx` | 后端菜单到 ProLayout / Umi 路由适配 |
| 状态管理 | Pinia | Zustand | Umi initial state + 本地 store |
| 主要页面目录 | `src/views` | `src/pages` | `src/pages` |
| 公共能力目录 | `src/plugins`、`src/utils` | `src/utils`、`src/hooks`、`src/layouts` | `src/api`、`src/components`、`src/utils` |
| 测试命令 | `pnpm run test:unit` | `pnpm run test` | `pnpm run test` |

## 3. Vue 管理端

### 3.1 关键目录

| 目录 | 作用 |
| --- | --- |
| `src/views` | 页面级视图 |
| `src/components` | 复用组件 |
| `src/api` | API 封装 |
| `src/router` | 常量路由和动态路由入口 |
| `src/store` | Pinia store |
| `src/plugins` | `auth`、`cache`、`download`、`modal`、`svgicon`、`tab` 等 |
| `src/utils` | 请求、加密、权限、字典、工具函数 |

### 3.2 固定路由

`src/router/index.ts` 里已经声明了这类常量路由：

- `/login`
- `/register`
- `/index`
- `/user/profile`
- `/401`
- `404`

剩余业务路由依赖后端返回的动态菜单。

### 3.3 请求层特性

`src/utils/request.ts` 里的关键行为：

- 自动补 `Authorization` 和 `clientid`
- 写入 `Content-Language`
- 开启重复提交保护
- 根据 `isEncrypt` 和 `VITE_APP_ENCRYPT` 决定是否加密
- 登录过期时通过对话框引导重新登录

### 3.4 常见业务页面

- `system/user`
- `system/role`
- `system/menu`
- `system/dept`
- `system/post`
- `system/dict`
- `system/config`
- `system/notice`
- `system/oss`
- `system/client`
- `monitor/online`
- `monitor/loginInfo`
- `monitor/operLog`
- `monitor/job`
- `monitor/jobLog`
- `monitor/cache`
- `monitor/server`
- `monitor/dataSource`

新增的系统监控页已经覆盖服务监控和连接池监控；其中连接池监控对应后端 `GET /monitor/dataSource`，展示的是本项目 Hikari 原生连接池安全摘要视图，不是 `Druid` 控制台或 iframe 页面。
前端只展示数据源名、库类型、运行状态、连接数、等待线程、最大池容量和占用率；生产页面不再展示 JDBC URL、账号、驱动类、P6Spy/Seata 标记和详细 timeout/lifetime 参数。

## 4. React 管理端

### 4.1 关键目录

| 目录 | 作用 |
| --- | --- |
| `src/pages` | 页面级组件 |
| `src/layouts` | 主框架布局 |
| `src/api` | API 封装 |
| `src/router` | 路由入口、守卫、动态路由转换、组件映射 |
| `src/store` | Zustand store |
| `src/hooks` | 自定义 hooks |
| `src/utils` | 请求、鉴权、缓存、弹窗、工具函数 |

### 4.2 固定路由

`src/router/AppRouter.tsx` 里固定声明了：

- `/login`
- `/register`
- `/401`
- `/redirect/*`
- `/index`
- `/user/profile`

其他路径统一通过 `BackendRouteView` 接管，再由后端菜单数据匹配到页面组件。

### 4.3 动态路由转换

`src/router/route-transform.ts` 会负责：

- 规范化路径
- 拉平 `ParentView` 子路由
- 处理内链和绝对 URL
- 检查重复路由名称 / 路径冲突
- 构造“路径 -> 组件”映射

这层存在的意义是：后端菜单字段沿用统一约定，React 端再把这些字段解释成 React Router 可用的结构。

### 4.4 请求层特性

`src/utils/request.ts` 的整体能力和 Vue 基本一致：

- 自动带 token、`clientid`
- 重复提交防抖
- 可选加密
- 401 弹窗重登录
- 统一错误提示
- 文件下载

## 5. React Pro 管理端

### 5.1 关键目录

| 目录 | 作用 |
| --- | --- |
| `src/pages` | 页面级组件 |
| `src/components` | 复用组件、业务组件和布局辅助组件 |
| `src/api` | API 封装 |
| `src/utils` | 请求、鉴权、加密、缓存和工具函数 |
| `src/access.ts` | 按钮权限与角色访问判断 |
| `config` | Umi Max 路由、代理、默认设置和构建配置 |

### 5.2 启动入口

```bash
cd infoq-scaffold-frontend-react-pro
pnpm install
pnpm run dev
```

React Pro 默认使用 `VITE_APP_PORT=80`，`pnpm run dev` 会在 Umi Max dev server ready 后自动打开浏览器。需要关闭自动打开时，执行 `pnpm run dev -- --no-open`。

### 5.3 部署入口

Compose 部署中 React Pro 的网关路径是 `/react-pro/`，容器直连端口是 `9093`。它与 `/vue/`、`/react/` 共同使用 `/prod-api/` 访问后端。

## 6. 如何新增一个后台页面

建议按这个顺序做：

1. 后端先补接口和权限。
2. 如需出现在左侧菜单，补 `sys_menu` 数据或菜单管理配置。
3. Vue 端在 `src/views/...` 新建页面，React 和 React Pro 端在 `src/pages/...` 新建页面。
4. 保证后端菜单里的 `component` 字段沿用现有路径约定，例如 `system/user/index`。
5. 如果页面有表格、表单、导出、权限控制，复用当前请求层、字典能力和上传 / 下载工具。
6. 跑对应单测和构建。

## 7. 常用命令

### Vue 管理端

```bash
cd infoq-scaffold-frontend-vue
pnpm install
pnpm run dev
pnpm run test:unit
pnpm run test:unit:coverage
pnpm run lint:eslint
pnpm run build:prod
```

### React 管理端

```bash
cd infoq-scaffold-frontend-react
pnpm install
pnpm run dev
pnpm run test
pnpm run test:coverage
pnpm run lint
pnpm run build:prod
```

### React Pro 管理端

```bash
cd infoq-scaffold-frontend-react-pro
pnpm install
pnpm run dev
pnpm run test
pnpm run test:coverage
pnpm run lint
pnpm run build
```

## 8. 管理端最容易踩的坑

### 8.1 多个管理端默认端口相同

Vue、React 和 React Pro 的 `.env.development` 默认都是 `VITE_APP_PORT=80`。如果你要同时跑多个 dev server，先改其中至少一个端口。

### 8.2 登录失败但后端是正常的

优先检查：

- `VITE_APP_CLIENT_ID`
- `VITE_APP_ENCRYPT`
- RSA 公私钥
- `/auth/code` 是否正常
- `/dev-api` 是否代理到了正确的后端地址

### 8.3 页面文件写了，但菜单点不开

优先检查：

- 后端 `sys_menu.component` 是否匹配现有路径规范
- 用户是否拥有对应菜单权限
- React 端的路径映射或 Vue 端的动态路由装载是否成功

## 9. 相关文档

- 总览：[`project-overview.md`](/guide/project-overview)
- 快速开始：[`quick-start.md`](/guide/quick-start)
- 小程序：[`weapp-handbook.md`](/weapp/handbook)
- FAQ：[`faq.md`](/guide/faq)
