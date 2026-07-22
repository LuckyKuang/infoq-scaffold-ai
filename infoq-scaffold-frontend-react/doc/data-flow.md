# infoq-scaffold-frontend-react 关键数据流

本文档只记录当前 React admin 代码能直接追到的几条主链路：

- 登录与用户信息初始化
- 登录前公开认证能力与自助认证页
- 后端菜单到动态页面装配
- 典型页面请求与统一错误处理

## 0. 链路下钻入口

- 工作区总览：[`../README.md`](../README.md)
- 请求层：[`../src/api/README.md`](../src/api/README.md)
- 路由层：[`../src/router/README.md`](../src/router/README.md)
- 状态层：[`../src/store/README.md`](../src/store/README.md)

## 1. 登录与用户信息初始化

登录链路的入口分散在三个位置：

- 页面入口：`src/pages/login.tsx`
- API 入口：`src/api/login.ts`
- 状态入口：`src/store/modules/user.ts`

当前主链路可以直接概括为：

```text
LoginPage
-> api/login.ts login()
-> utils/request.ts
-> POST /auth/login
-> userStore.login()
-> setToken()
-> initSSE()
-> initWebSocket()
```

OAuth 登录沿用同一个 token 落地路径，但授权发起和回调多两段公开接口：

```text
LoginPage
-> getOAuthProviders()
-> GET /auth/oauth/providers
-> browser redirect /auth/oauth/{provider}/authorize
-> OAuthCallbackPage
-> exchangeOAuthTicket()
-> POST /auth/oauth/ticket
-> userStore.loginByOAuthTicket()
-> setToken()
-> initSSE()
-> initWebSocket()
```

登录成功后，真正把当前用户资料和动态菜单装进前端状态的动作并不发生在登录页面本身，而是在 `AuthGuard.tsx`：

```text
AuthGuard
-> userStore.getInfo()
-> permissionStore.generateRoutes()
-> userStore.initializeRealtimeChannels()
-> MainLayout / BackendRouteView
```

因此当前 React admin 的登录闭环是“两段式”的：先拿 token，再由守卫补齐用户信息与动态路由。
当浏览器刷新后本地已有 token 时，`AuthGuard` 也会沿用这条守卫启动路径，并在用户信息和动态路由恢复成功后重新初始化 SSE/WebSocket。若用户信息或动态路由初始化失败，守卫会提示错误、执行本地会话清理，并带当前路径 redirect 回到登录页，不继续渲染受保护布局。

## 1.1 登录前公开认证能力与自助认证页

登录页、注册页和忘记密码页共享同一个公开能力探针：

```text
login / register / forgot-password page
-> api/login.ts getCodeImg()
-> GET /auth/code
-> captchaEnabled + registerEnabled + forgotPasswordEnabled + mailEnabled
```

这条链路决定三件事：

- 登录页是否展示“立即注册”“忘记密码”入口
- 注册页是否允许继续停留
- 忘记密码页是否允许继续停留

邮件验证码相关的公开自助链路继续收敛在 `src/api/login.ts`：

```text
RegisterPage / ForgotPasswordPage
-> sendEmailCode()
-> POST /auth/email/code
-> register() or forgotPassword()
-> POST /auth/register or POST /auth/forgot-password
```

## 2. 后端菜单到动态页面装配

当前菜单链路的关键入口是 `usePermissionStore().generateRoutes()`：

```text
getRouters()
-> res.data
-> filterAsyncRouter()
-> withAbsoluteRoutePaths()
-> buildRouteComponentMap()
-> sidebarRouters / topbarRouters / routeComponentMap
```

页面真正渲染时，`BackendRouteView.tsx` 会按以下顺序解析：

1. 先按当前 pathname 查 `routeComponentMap`
2. 查不到时按路径推导 `component` 名
3. 对 `Layout`、`ParentView`、`InnerLink` 做特殊分支
4. 最终调用 `resolvePageComponent(componentName)` 懒加载页面

这意味着当前前端“菜单是什么”和“页面组件在哪里”的桥梁，不是单一文件，而是 `permission store + route transform + BackendRouteView` 三段协作。

## 3. 典型页面请求链路

以 `src/pages/system/*` 和 `src/pages/monitor/*` 下的大多数列表页为代表，当前请求链路遵循同一模式：

```text
Page Component
-> src/api/system/* or src/api/monitor/*
-> utils/request.ts
-> backend API
-> 成功时更新页面本地状态
-> 失败时统一弹 toast / notification
```

API 模块本身主要承担：

- URL 与方法声明
- 返回类型绑定
- 个别接口的请求头开关

重复提交拦截、加密、401 处理、下载流处理都在 `utils/request.ts` 统一完成。

## 4. 401 与重新登录链路

`utils/request.ts` 的响应拦截器在收到 `401` 时会：

```text
检测 isRelogin.show
-> modal.confirm(...)
-> userStore.logout()
-> navigateTo('/login')
```

这条链路说明当前 React admin 不会静默吞掉过期会话，而是显式弹窗并让用户决定是否重新登录。若 token 已被后端撤销，`userStore.logout()` 仍会在 `/auth/logout` 失败后清理本地会话，避免继续携带旧 token 请求受保护接口。

## 5. 登出与消息通道关闭

登出不只是清 token：

```text
userStore.logout()
-> closeSSE()
-> closeWebSocket()
-> POST /auth/logout
-> finally removeToken()
-> 清空用户状态
```

因此当前登录态相关的副作用资源都挂在 `user` store 生命周期上。
登录成功与刷新后守卫启动共用 `userStore.initializeRealtimeChannels()`，避免登录路径和刷新路径出现不同的 SSE/WebSocket 行为。

## 6. 已知边界

- 页面内部局部状态和表单交互没有在这里逐页展开；需要时继续下钻到对应页面文件。
- 文档只记录当前已经能由代码直接证实的动态路由与消息链路，不推断未来页面扩展方案。

## 7. 身份关系与持久化消息

个人中心加载后从 `/system/user/profile/oauth/identities` 读取当前用户身份。绑定先请求 `/system/user/profile/oauth/{provider}/bind/authorize` 并进入现有浏览器 OAuth 回调链路，解绑请求始终由当前登录用户和服务端最后凭证规则校验。

管理端消息主链路不再把 SSE/WebSocket 文本当作消息存储：

```text
NoticeBell / MessageCenter
-> /system/message/list + /system/message/unread-count
-> 服务端持久化收件箱

SSE / WebSocket { type: "message", messageId }
-> useNoticeStore.refresh()
-> 再请求服务端消息真值
```

因此关闭实时通道、用户离线或刷新页面都不影响既有消息的读取、已读和删除。
