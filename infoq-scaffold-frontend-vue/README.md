# infoq-scaffold-frontend-vue

这份 README 只描述 `infoq-scaffold-frontend-vue` 当前仓库实现，不把它抽象成通用 Vue 管理端模板。

## 当前实现概览

`infoq-scaffold-frontend-vue` 是当前仓库的 Vue 管理端工作区，基于 Vue 3.5、Vite 8、Element Plus 2.14、Vue Router 5 与 Pinia。应用入口是 `src/main.ts -> src/App.vue`；固定路由写在 `src/router/index.ts`，登录后动态菜单路由由 `usePermissionStore().generateRoutes()` 注入到 Vue Router。

当前代码能直接确认的几个关键事实：

- `main.ts` 负责注册 router、Pinia、i18n、自定义指令、插件和开发者工具保护。
- `permission.ts` 是全局前置守卫，负责 token 检查、`getInfo()`、`generateRoutes()` 和白名单跳转。
- `src/store/modules/permission.ts` 通过 `import.meta.glob('./../../views/**/*.vue')` 把后端菜单组件名解析为真实页面组件。
- `src/api/login.ts` 的登录、OAuth ticket 和注册请求默认携带 `clientId`，并通过 `utils/request.ts` 统一加密、401 和重复提交处理。
- `src/store/modules/user.ts` 负责 password/OAuth ticket 登录态与用户资料；SSE 关闭动作也挂在登出流程里，并且 `/auth/logout` 失败也会清理本地会话。

## 模块导航

| 模块 | 当前职责 | 主要证据 |
| --- | --- | --- |
| `src/api` | 后端接口契约与请求入口 | [`src/api/README.md`](./src/api/README.md) |
| `src/router` | 固定路由定义 | [`src/router/README.md`](./src/router/README.md) |
| `src/store` | 用户、权限、设置、标签页与字典等状态 | [`src/store/README.md`](./src/store/README.md) |
| `src/views` | 登录、首页、系统管理、监控与错误页 | [`src/views/README.md`](./src/views/README.md) |
| `src/layout`、`src/plugins`、`src/utils` | 布局壳、全局插件、请求/权限/缓存/加密工具 | [`src/README.md`](./src/README.md) |

## 建议阅读顺序

1. [`doc/architecture.md`](./doc/architecture.md)
   先看模块分层、守卫、动态路由装配与请求边界。
2. [`doc/data-flow.md`](./doc/data-flow.md)
   再看登录、菜单注入和典型页面请求链路。
3. [`src/README.md`](./src/README.md)
   最后按 `src/` 模块入口继续下钻。

## 源码入口

- 应用入口：
  - `src/main.ts`
  - `src/App.vue`
- 路由与鉴权：
  - `src/router/index.ts`
  - `src/permission.ts`
  - `src/store/modules/permission.ts`
- 登录与请求：
  - `src/api/login.ts`
  - `src/utils/request.ts`
  - `src/store/modules/user.ts`

## 当前实现提醒

- 后端菜单返回的 `component` 字符串必须能在 `src/views` 里解析到真实 `.vue` 页面；否则权限 store 只能返回空组件映射。
- 登录、注册与部分写请求是否加密，取决于 `VITE_APP_ENCRYPT` 和 RSA/AES 环境变量。
- 本工作区的动态路由装配放在 Pinia + Vue Router 里完成，不能直接套用 React admin 的路径解析实现。

## P1-P3 身份与消息边界

- 个人中心通过 `/system/user/profile/oauth/*` 管理当前用户的第三方身份。绑定只使用服务端生成的授权地址和回调 ticket；解绑是否要求当前密码以身份列表返回的 `passwordConfirmationRequired` 为准。
- `src/api/system/message`、`useNoticeStore` 和固定受保护路由 `/message-center` 共同构成个人消息盒子。通知铃铛、导航未读角标和消息中心都以 `/system/message/*` 的服务端结果为真值。
- SSE/WebSocket 只处理 `{ type: "message", messageId }` 刷新事件，不把事件 payload 当作消息正文存储或展示。
