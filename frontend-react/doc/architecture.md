# frontend-react 架构说明

本文档是对当前 React admin 代码结构的保守描述。

- 只写仓库里已经能直接确认的模块关系和装配行为。
- 不把未验证的动态路由或消息链路包装成通用平台能力。
- 如果未来页面目录或状态边界变化，应把这里视为“当前实现说明”。

## 0. 下钻阅读入口

- 工作区总览：[`../README.md`](../README.md)
- `src/` 聚合入口：[`../src/README.md`](../src/README.md)
- 请求层：[`../src/api/README.md`](../src/api/README.md)
- 路由层：[`../src/router/README.md`](../src/router/README.md)
- 状态层：[`../src/store/README.md`](../src/store/README.md)
- 页面层：[`../src/pages/README.md`](../src/pages/README.md)

## 1. 模块分层

当前 React admin 的主分层可以直接概括为：

```text
main.tsx
-> RootProviders.tsx
-> App.tsx
-> router/AppRouter.tsx
-> AuthGuard + MainLayout + BackendRouteView
-> pages/*
-> api/* + utils/request.ts
-> backend
```

辅助层还包括：

- `store/modules/*`：承载用户、权限、标签页、设置、通知等前端状态
- `layouts/*`：主布局、标签页、设置抽屉和 keep-alive 壳
- `utils/*`：请求、鉴权、缓存、加密、SSE、WebSocket、权限辅助

## 2. 各模块当前职责

| 模块 | 当前职责 | 当前证据 |
| --- | --- | --- |
| `RootProviders.tsx` | 注入 Ant Design 主题、语言、暗色模式和全局样式变量 | `ConfigProvider`、`theme.getDesignToken(...)` |
| `router/AppRouter.tsx` | 建立固定路由树并装配 `AuthGuard`/`MainLayout`/`BackendRouteView` | `BrowserRouter`、`Routes` |
| `router/AuthGuard.tsx` | 等待共享浏览器恢复、`getInfo()` 与 `generateRoutes()`，成功后启动实时通道；匿名回登录，失败可重试 | `useUserStore.getState().getInfo()`、`usePermissionStore.getState().generateRoutes()`、`useUserStore.getState().initializeRealtimeChannels()` |
| `router/public-routes.ts` | 登录前公开认证路径白名单匹配 | `isWhiteListRoute()` |
| `router/BackendRouteView.tsx` | 根据路径或后端 `component` 值解析页面组件，并同步 tags view | `resolvePageComponent()`、`convertPathToComponent()` |
| `store/modules/user.ts` | 登录、拉取用户信息、登出、SSE/WebSocket 生命周期、退出失败本地清理 | `login()`、`getInfo()`、`logout()` |
| `store/modules/permission.ts` | 获取后端菜单、转换路由、构建侧边栏与组件映射 | `generateRoutes()`、`buildRouteComponentMap()` |
| `utils/request.ts` | 统一请求头、重复提交拦截、可选加解密、401 处理和下载 | axios request/response interceptors |
| `pages/*` | 登录、首页、系统管理、监控、错误页和跳转页 | `src/pages/**` |

## 3. 路由与装配路径

### 3.1 固定路由

`AppRouter.tsx` 当前内建了这些固定入口：

- `/login`
- `/oauth/callback`
- `/register`
- `/forgot-password`
- `/401`
- `/redirect/*`
- `/index`
- `/user/profile`
- `/message-center`
- `*` -> 404

其中 `/index`、`/user/profile`、`/message-center` 位于 `AuthGuard` 保护的布局内。固定路由不等于公开路由；登录前白名单以 `public-routes.ts` 为准。

路由 base 取自 Vite `BASE_URL`，与 `VITE_APP_CONTEXT_PATH` 的资源前缀共用构建真值。`utils/auth-redirect.ts` 是认证回跳边界：检查解码后的危险变体但保留原编码，区分应用内路径与带部署前缀的站内浏览器路径。页面不得手工添加 origin 或再次解码 Router 已解析的 query。

### 3.2 动态菜单路由

登录后真正的后台页面入口来自 `usePermissionStore().generateRoutes()`：

- 先通过 `getRouters()` 拉取后端菜单
- 再经过 `filterAsyncRouter()`、`withAbsoluteRoutePaths()`、`buildRouteComponentMap()` 等转换
- 最终得到 `sidebarRouters`、`topbarRouters`、`routes` 与 `routeComponentMap`

这说明当前 React admin 不是在前端手写完整菜单树，而是以“固定壳路由 + 后端动态页面映射”为主。

## 4. 请求与鉴权边界

### 4.1 登录前后

`src/api/login.ts` 明确给登录、注册与公开认证请求补齐或约束：

- `clientId`
- `grantType`
- `isToken: false`
- `isEncrypt: true`
- `repeatSubmit: false`

同时，`GET /auth/code` 也是登录前公开认证能力的真值来源，除了验证码图片本身，还会驱动注册和忘记密码入口的展示与公开页停留条件。

对应地，`utils/request.ts` 仅在 `VITE_APP_ENCRYPT=true` 且请求声明 `isEncrypt: true` 时，为 `POST/PUT` 请求追加 `encrypt-key` 请求头并加密请求体。公开 GET 请求不继承这些写请求头。

### 4.2 统一请求出口

`utils/request.ts` 负责：

- 补 `Authorization` 和 `clientid`
- GET 参数串行化
- 500ms 内重复提交拦截
- 401 过期会话弹窗与重新登录跳转
- 下载流处理

因此前端 API 文件大多只保留 URL、方法和类型声明，不再重复实现这些通用逻辑。

## 5. 状态边界

当前 Zustand 模块可以粗分为两类：

- 会影响主链路的状态：
  - `user`
  - `permission`
  - `tagsView`
- 界面偏好或辅助状态：
  - `app`
  - `settings`
  - `notice`

其中 `permission` 模块不仅缓存路由结果，还维护 `routeComponentMap`，所以它本身就属于动态页面装配的一部分，而不只是 UI 偏好状态。

## 6. 公共约束

- 后端路由组件名必须能映射到 `src/pages` 中的真实页面组件。
- 登录、注册、忘记密码等加密请求默认依赖 `VITE_APP_CLIENT_ID`、`VITE_APP_BASE_API` 和可选 RSA/AES 环境变量。
- access token 仅在内存；密码/OAuth成功先绑定 HttpOnly 浏览器恢复会话，刷新通过同源CSRF协议恢复。SSE / WebSocket 只在用户与路由初始化后启动；退出关闭owned连接并清本地状态，DELETE失败仍显式报告。

## 7. 已知边界

- 本文档只覆盖当前仓库里已经存在的页面和 store 模块，不预判未来功能。
- `src/components`、`src/layouts`、`src/utils` 当前没有独立 README；涉及它们的职责只在架构摘要里做保守说明。
