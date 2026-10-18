# frontend-react

这份 README 只描述 `frontend-react` 当前仓库实现，不把它抽象成通用 React 管理端模板。

## 当前实现概览

`frontend-react` 是当前仓库的 React 管理端工作区，基于 React 19.2、Vite 8、Ant Design 6.4、React Router 7.16 与 Zustand。应用入口是 `src/main.tsx -> src/RootProviders.tsx -> src/App.tsx -> src/router/AppRouter.tsx`；固定路由覆盖登录、注册、忘记密码、首页和少量壳路由，后台菜单路由依赖 `usePermissionStore().generateRoutes()` 在登录后动态装配。

当前代码能直接确认的几个关键事实：

- `RootProviders.tsx` 负责 Ant Design locale、主题 token、暗色模式和全局样式变量。
- `AuthGuard.tsx` 等待共享会话恢复、`getInfo()` 和动态路由装配；明确401回登录，403/503/网络失败显示可重试错误。
- `BackendRouteView.tsx` 负责把后端返回的 `component` 字符串解析成真实页面组件，并同步 tags view。
- `src/api/login.ts` 的登录、OAuth ticket、注册和忘记密码公开请求沿用既有加密请求约定；`GET /auth/code` 现在也是登录页公开能力位的真值来源。
- `useUserStore` 在 password/OAuth ticket 登录后先绑定 HttpOnly 浏览器恢复会话，access token 只保留内存；刷新通过受保护的同源CSRF恢复资源取回有效身份。用户与路由装载成功后才初始化 SSE/WebSocket；退出关闭连接、清理本地状态并调用专用 DELETE，服务端撤销失败显式报告。回归步骤见 [会话测试 SOP](./doc/auth-session-testing.md)。

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

## 开发与生产验证前置

从仓库根目录执行 `pnpm --dir frontend-react install`、`pnpm --dir frontend-react run dev`；Node 使用 `24.18.0`，pnpm 使用根 `packageManager` 固定版本。开发服务默认端口 `80`、代理后端 `8080`；端口覆盖与测试命令见 [本层规约](./AGENTS.md) 和 [测试政策](../docs/TESTING.md)。

`VITE_APP_ENCRYPT=true` 时，dev/build 进程必须取得与目标后端对应的 `VITE_APP_RSA_PUBLIC_KEY` / `VITE_APP_RSA_PRIVATE_KEY`。浏览器中的私钥不能保护服务端秘密，生产仍须 HTTPS 与受控凭据。构建前执行 `node tools/validate_utf8.mjs`。

`BrowserRouter.basename` 与 Vite `BASE_URL` 一致，支持根及 `/react/` 等受控子路径。密码/OAuth 登录、回调和身份绑定共享安全回跳边界；API 使用无 origin、带前缀一次的站内路径，应用内导航由 Router base 生成浏览器地址。非法编码、协议相对路径、反斜杠、控制字符、点段和重复参数在登录/授权/ticket 兑换前明确拒绝，正常 query/hash 不二次解码。真实 Provider、目标 Linux nginx 与生产登录仍需分别验收，构建或 HTTP 替身不能替代这些证据。具体边界见 [测试政策](../docs/TESTING.md) 第 6.5–6.6 节。

## P1-P3 身份与消息边界

- 个人中心通过 `/system/user/profile/oauth/*` 管理当前用户的第三方身份。绑定操作先向后端取得 Provider 授权地址并消费一次性绑定 ticket；客户端不会提交外部 identity ID 或目标用户 ID。是否需要当前密码由服务端列表项的 `passwordConfirmationRequired` 返回值决定。
- `src/api/system/message` 与 `useNoticeStore` 使用 `/system/message/*` 的分页、未读数、已读、全部已读和软删除接口；`/message-center` 是固定受保护路由。通知铃铛和消息中心均以服务端收件箱为真值。
- SSE/WebSocket 只识别 `{ type: "message", messageId }` 一类刷新事件，并刷新服务端消息状态；实时 payload 不保存为消息正文，也不能替代离线消息读取。
