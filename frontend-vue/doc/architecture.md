# frontend-vue 架构说明

本文档是对当前 Vue admin 代码结构的保守描述。

- 只写仓库里已经能直接确认的模块关系和装配行为。
- 不把未验证的插件、指令或动态路由链路包装成通用平台能力。
- 如果未来页面目录或 Pinia 边界变化，应把这里视为“当前实现说明”。

## 0. 下钻阅读入口

- 工作区总览：[`../README.md`](../README.md)
- `src/` 聚合入口：[`../src/README.md`](../src/README.md)
- 请求层：[`../src/api/README.md`](../src/api/README.md)
- 路由层：[`../src/router/README.md`](../src/router/README.md)
- 状态层：[`../src/store/README.md`](../src/store/README.md)
- 页面层：[`../src/views/README.md`](../src/views/README.md)

## 1. 模块分层

当前 Vue admin 的主分层可以直接概括为：

```text
main.ts
-> App.vue
-> router/index.ts
-> permission.ts
-> layout/index.vue + views/*
-> api/* + utils/request.ts
-> backend
```

辅助层还包括：

- `store/modules/*`：承载用户、权限、标签页、设置、字典与通知状态
- `layout/*`：主布局壳、侧栏、导航栏、设置与标签页
- `plugins/*`：auth、cache、download、modal、svgicon、tab 等全局插件能力
- `utils/*`：请求、鉴权、缓存、加密、SSE、主题、字典、WebSocket 等辅助

## 2. 各模块当前职责

| 模块 | 当前职责 | 当前证据 |
| --- | --- | --- |
| `main.ts` | 注册 router、Pinia、i18n、插件、指令与开发者工具保护 | `app.use(...)`、`directive(app)`、`initDevToolsProtection()` |
| `router/index.ts` | 固定认证入口、受保护页面、错误及重定向路由 | `constantRoutes` |
| `permission.ts` | 等待会话/资料/动态路由恢复，白名单及回跳 | `router.beforeEach(...)` |
| `store/modules/user.ts` | 内存 token、绑定、去重恢复、资料/路由 bootstrap、退出与实时清理 | `login()`、`bootstrap()`、`logout()` |
| `store/modules/permission.ts` | 拉取后端菜单并解析成 Vue Router 路由对象 | `generateRoutes()`、`filterAsyncRouter()` |
| `utils/request.ts` | 统一请求头、重复提交拦截、可选加解密、401 处理和下载 | axios request/response interceptors |
| `views/*` | 登录、首页、系统管理、监控、错误页和跳转页 | `src/views/**` |

## 3. 路由与装配路径

### 3.1 固定路由

`src/router/index.ts` 当前固定定义了：

- `/login`
- `/oauth/callback`
- `/register`
- `/forgot-password`
- `/redirect/:path(.*)`
- `/401`
- `/:pathMatch(.*)*`
- `/index`
- `/user/profile`
- `/message-center`

固定路由不等于公开路由。`permission.ts` 只对白名单中的登录、自助认证与 OAuth 回调入口免登录放行；首页、个人中心、消息中心及错误/重定向路由仍受全局守卫约束。

history base 与资源前缀均读取 Vite `BASE_URL`。`utils/auth-redirect.ts` 校验认证回跳的安全解码变体但返回原编码，并在 API 浏览器路径与应用内导航之间添加/移除当前前缀一次。不得用 origin 拼接绑定回跳，也不得再次解码 Router query 改变原参数语义。

### 3.2 动态菜单路由

真正的后台页面路由来自 `usePermissionStore().generateRoutes()`：

- 先通过 `getRouters()` 拉取后端菜单
- 再在 `filterAsyncRouter()` 中把 `Layout`、`ParentView`、`InnerLink` 和业务页面组件映射到真实组件
- 最终调用 `router.addRoute(...)` 注入访问路由

页面组件解析依赖：

```ts
const modules = import.meta.glob('./../../views/**/*.vue')
```

因此当前 Vue admin 的动态页面可达性，直接依赖后端菜单 `component` 字符串与 `src/views` 目录结构的一致性。

## 4. 请求与鉴权边界

### 4.1 登录前后

`src/api/login.ts` 会为登录与注册请求补齐：

- `clientId`
- `grantType`
- `isToken: false`
- `isEncrypt: true`
- `repeatSubmit: false`

`utils/request.ts` 仅在 `VITE_APP_ENCRYPT=true` 且请求声明 `isEncrypt: true` 时，为 `POST/PUT` 请求附加 `encrypt-key` 并加密请求体，不会自动加密所有写请求。`login.ts` 还承载邮件验证码与忘记密码接口，`GET /auth/code` 提供公开认证能力位。

### 4.2 统一请求出口

`utils/request.ts` 负责：

- 补 `Authorization` 与 `clientid`
- GET 参数串行化
- 500ms 内重复提交拦截
- 401 与原请求 Bearer 相关后立即清理和路由跳转
- 下载流处理

因此 `src/api/*` 主要负责 URL、方法与类型约束，不重复实现异常处理。

专用 `/auth/browser-session` 使用独立同源 fetch，不附旧 Bearer、不进入重复提交缓存或普通 401 弹窗。GET 返回仅存内存的 CSRF；PUT 绑定显式新 Bearer 成功后才提交登录状态；POST 通过 HttpOnly cookie 恢复原 token；DELETE 无 Bearer 注销。全部带 `clientid` 与 `X-InfoQ-Browser-Session: vue`，写方法另带 `X-XSRF-TOKEN`，HTTP 与 ApiResult 同时验证。

access token 仅存内存，旧 `Admin-Token` 启动时直接删除。首载共享一个 `unknown/restoring/authenticated/anonymous/failed` bootstrap，GET csrf→POST 恢复→getInfo→getRouters 完成后才渲染布局并初始化 SSE/WebSocket。401 匿名，403/503/网络失败显式停止并允许重试。OAuth callback 先交换并绑定新 ticket，不恢复旧账号。仅支持相对 `VITE_APP_BASE_API` 的同源代理，生产 HTTPS 与受控 cookie Origin/Path/Secure 配置必须同时满足。

## 5. 状态边界

当前 Pinia 模块可以粗分为两类：

- 主链路状态：
  - `user`
  - `permission`
  - `tagsView`
- 辅助状态：
  - `app`
  - `settings`
  - `dict`
  - `notice`

其中 `permission` 模块同时承担路由转换与可访问菜单缓存，不只是纯 UI 状态。

## 6. 公共约束

- 后端路由组件名必须能在 `src/views` 中解析到真实页面。
- 登录、注册与写请求的加密能力依赖 `VITE_APP_CLIENT_ID`、`VITE_APP_BASE_API` 和 RSA/AES 配置。
- DELETE 浏览器会话失败仍清本地 token、角色权限、owned 动态路由、消息、标签页和实时连接，但明确提示服务端注销未确认。同 vue scope/clientId 的 tab 只发无凭据通知，React 和其他 clientId 保持隔离。
- 本工作区默认使用 Element Plus、Pinia 与 Vue Router 的既有模式，不套用 React admin 的状态实现。

## 7. 已知边界

- `src/layout`、`src/plugins`、`src/utils` 当前没有独立 README；这里仅做父层职责摘要。
- 本文档只覆盖当前仓库中已经存在的路由与 store 模块，不预判未来页面矩阵。
