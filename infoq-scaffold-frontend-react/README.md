# infoq-scaffold-frontend-react

这份 README 只描述 `infoq-scaffold-frontend-react` 当前仓库实现，不把它抽象成通用 React 管理端模板。

## 当前实现概览

`infoq-scaffold-frontend-react` 是当前仓库的 React 管理端工作区，基于 React 19.2、Vite 8、Ant Design 6.4、React Router 7.16 与 Zustand。应用入口是 `src/main.tsx -> src/RootProviders.tsx -> src/App.tsx -> src/router/AppRouter.tsx`；固定路由覆盖登录、注册、忘记密码、首页和少量壳路由，后台菜单路由依赖 `usePermissionStore().generateRoutes()` 在登录后动态装配。

当前代码能直接确认的几个关键事实：

- `RootProviders.tsx` 负责 Ant Design locale、主题 token、暗色模式和全局样式变量。
- `AuthGuard.tsx` 负责 token 检查、登录后 `getInfo()` 和动态路由装配的引导；若用户初始化失败，会清理本地会话并带 redirect 回登录页。
- `BackendRouteView.tsx` 负责把后端返回的 `component` 字符串解析成真实页面组件，并同步 tags view。
- `src/api/login.ts` 的登录、OAuth ticket、注册和忘记密码公开请求沿用既有加密请求约定；`GET /auth/code` 现在也是登录页公开能力位的真值来源。
- `useUserStore` 在 password/OAuth ticket 登录成功后会初始化 SSE 和 WebSocket；已有 token 刷新进入受保护路由时，`AuthGuard` 会复用同一入口恢复实时通道。登出时会显式关闭连接，并且 `/auth/logout` 失败也会清理本地会话。

## 模块导航

| 模块 | 当前职责 | 主要证据 |
| --- | --- | --- |
| `src/api` | 后端接口契约与请求入口 | [`src/api/README.md`](./src/api/README.md) |
| `src/router` | 固定路由、鉴权守卫、动态组件解析 | [`src/router/README.md`](./src/router/README.md) |
| `src/store` | 用户、权限、设置、标签页等前端状态 | [`src/store/README.md`](./src/store/README.md) |
| `src/pages` | 登录、首页、系统管理、监控与错误页 | [`src/pages/README.md`](./src/pages/README.md) |
| `src/layouts`、`src/components`、`src/utils` | 布局壳、通用组件、请求/权限/缓存/加密工具 | [`src/README.md`](./src/README.md) |

## 建议阅读顺序

1. [`doc/architecture.md`](./doc/architecture.md)
   先看模块分层、动态路由装配和请求/鉴权边界。
2. [`doc/data-flow.md`](./doc/data-flow.md)
   再看登录、菜单路由和典型页面请求链路。
3. [`src/README.md`](./src/README.md)
   最后按 `src/` 模块入口继续下钻。

## 源码入口

- 应用入口：
  - `src/main.tsx`
  - `src/RootProviders.tsx`
  - `src/App.tsx`
- 路由与鉴权：
  - `src/router/AppRouter.tsx`
  - `src/router/AuthGuard.tsx`
  - `src/router/public-routes.ts`
  - `src/router/BackendRouteView.tsx`
  - `src/store/modules/permission.ts`
- 登录与请求：
  - `src/api/login.ts`
  - `src/utils/request.ts`
  - `src/store/modules/user.ts`

## 当前实现提醒

- 后端菜单返回的 `component` 字符串必须能被前端组件映射解析；否则 `BackendRouteView` 只能按 fallback 规则处理。
- 请求加密、SSE、WebSocket 都受环境变量控制；文档里只记录当前代码中已经能直接确认的行为，不把可选链路写成默认能力。
- `AGENTS.md` 只负责登记阅读入口和同步门禁，不代替这些正文说明。

## P1-P3 身份与消息边界

- 个人中心通过 `/system/user/profile/oauth/*` 管理当前用户的第三方身份。绑定操作先向后端取得 Provider 授权地址并消费一次性绑定 ticket；客户端不会提交外部 identity ID 或目标用户 ID。是否需要当前密码由服务端列表项的 `passwordConfirmationRequired` 返回值决定。
- `src/api/system/message` 与 `useNoticeStore` 使用 `/system/message/*` 的分页、未读数、已读、全部已读和软删除接口；`/message-center` 是固定受保护路由。通知铃铛和消息中心均以服务端收件箱为真值。
- SSE/WebSocket 只识别 `{ type: "message", messageId }` 一类刷新事件，并刷新服务端消息状态；实时 payload 不保存为消息正文，也不能替代离线消息读取。
