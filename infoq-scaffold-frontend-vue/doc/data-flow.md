# infoq-scaffold-frontend-vue 关键数据流

本文档只记录当前 Vue admin 代码能直接追到的几条主链路：

- 登录与用户信息初始化
- 后端菜单到 Vue Router 动态注入
- 典型页面请求与统一错误处理

## 0. 链路下钻入口

- 工作区总览：[`../README.md`](../README.md)
- 请求层：[`../src/api/README.md`](../src/api/README.md)
- 路由层：[`../src/router/README.md`](../src/router/README.md)
- 状态层：[`../src/store/README.md`](../src/store/README.md)

## 1. 登录与用户信息初始化

登录链路的入口分散在三个位置：

- 页面入口：`src/views/login.vue`
- API 入口：`src/api/login.ts`
- 状态入口：`src/store/modules/user.ts`

当前主链路可以直接概括为：

```text
LoginView
-> api/login.ts login()
-> utils/request.ts
-> POST /auth/login
-> userStore.login()
-> setToken()
```

OAuth 登录沿用同一个 token 落地路径，但授权发起和回调多两段公开接口：

```text
LoginView
-> getOAuthProviders()
-> GET /auth/oauth/providers
-> browser redirect /auth/oauth/{provider}/authorize
-> OAuthCallbackView
-> exchangeOAuthTicket()
-> POST /auth/oauth/ticket
-> userStore.loginByOAuthTicket()
-> setToken()
```

登录成功后，真正把用户资料和动态菜单装进前端状态的动作由全局守卫 `permission.ts` 完成：

```text
router.beforeEach
-> userStore.getInfo()
-> permissionStore.generateRoutes()
-> router.addRoute(...)
-> next(to.fullPath)
```

因此当前 Vue admin 的登录闭环同样是“先拿 token，再由守卫补齐用户信息与动态菜单”。

## 2. 后端菜单到动态路由注入

动态菜单链路的关键入口是 `usePermissionStore().generateRoutes()`：

```text
getRouters()
-> filterAsyncRouter()
-> filterChildren()
-> loadView()
-> setRoutes() / setSidebarRouters() / setTopbarRoutes()
-> router.addRoute(...)
```

`loadView()` 通过 `import.meta.glob('./../../views/**/*.vue')` 查找真实页面组件，因此：

- 后端菜单 `component` 字符串必须与 `src/views` 相对路径保持一致
- `Layout`、`ParentView`、`InnerLink` 属于特殊占位组件

## 3. 典型页面请求链路

以 `src/views/system/*` 和 `src/views/monitor/*` 下的大多数列表页为代表，当前请求链路遵循同一模式：

```text
View Component
-> src/api/system/* or src/api/monitor/*
-> utils/request.ts
-> backend API
-> 成功时更新局部状态或 Pinia
-> 失败时统一弹 ElMessage / ElNotification
```

API 模块本身主要负责：

- URL 与方法声明
- 返回类型绑定
- 个别接口的请求头开关

重复提交拦截、加密、401 处理和下载流处理都由 `utils/request.ts` 统一完成。

## 4. 401 与重新登录链路

`utils/request.ts` 的响应拦截器在收到 `401` 时会：

```text
检测 isRelogin.show
-> ElMessageBox.confirm(...)
-> useUserStore().logout()
-> router.replace('/login?redirect=...')
```

这条链路说明当前 Vue admin 不会静默吞掉过期会话，而是显式提示并跳回登录页。若 token 已被后端撤销，`userStore.logout()` 仍会在 `/auth/logout` 失败后清理本地会话，避免继续携带旧 token 请求受保护接口。

## 5. 登出与副作用清理

登出链路当前是：

```text
userStore.logout()
-> closeSSE()
-> POST /auth/logout
-> finally removeToken()
-> 清空用户状态 / roles / permissions / token
```

因此登录态的主动清理动作挂在 `user` store 上，而不是分散在各个页面。

## 6. 已知边界

- 页面内部局部组件与表单细节没有在这里逐页展开；需要时继续下钻到具体 `views/*` 文件。
- 文档只记录当前已经能由代码直接证实的动态路由和请求主链路，不推断未来插件化方案。

## 7. 身份关系与持久化消息

个人中心从 `/system/user/profile/oauth/identities` 读取当前用户身份。绑定先向 `/system/user/profile/oauth/{provider}/bind/authorize` 取得服务器授权地址，随后复用浏览器 OAuth 回调；客户端不会传入外部 identity ID 完成绑定。

消息铃铛、导航未读角标和固定 `/message-center` 路由共用 Pinia 消息状态：

```text
Notice UI / MessageCenter
-> /system/message/list + /system/message/unread-count
-> 服务端持久化收件箱

SSE / WebSocket { type: "message", messageId }
-> useNoticeStore.refresh()
-> 再请求服务端消息真值
```

实时事件不是消息正文来源，因而关闭通道、离线或刷新页面不会影响读取、已读和软删除。
