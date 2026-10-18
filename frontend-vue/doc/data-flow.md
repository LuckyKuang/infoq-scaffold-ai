# frontend-vue 关键数据流

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
-> userStore.login()
-> api/login.ts login()
-> utils/request.ts
-> POST /auth/login
-> GET /auth/browser-session/csrf -> PUT /auth/browser-session
-> 绑定成功后 setToken()（仅内存）
```

OAuth 登录沿用同一个 token 落地路径，但授权发起和回调多两段公开接口：

```text
LoginView
-> getOAuthProviders()
-> GET /auth/oauth/providers
-> browser redirect /auth/oauth/{provider}/authorize
-> OAuthCallbackView
-> userStore.loginByOAuthTicket()
-> exchangeOAuthTicket()
-> POST /auth/oauth/ticket
-> GET csrf -> PUT browser-session -> setToken()（仅内存）
```

登录成功后，真正把用户资料和动态菜单装进前端状态的动作由全局守卫 `permission.ts` 完成：

```text
router.beforeEach
-> userStore.bootstrap()（并发去重，OAuth callback 跳过旧身份恢复）
-> 无内存 token 时 GET csrf -> POST browser-session
-> userStore.getInfo()
-> permissionStore.generateRoutes()
-> permissionStore.installRoutes(...)
-> return to.fullPath
```

绑定失败会以新 Bearer 尝试撤销刚创建的会话，且不会写入认证状态；清理失败单独报告。首载只有恢复 401 才匿名跳登录，403/503/网络错误展示失败与重试入口，不循环恢复，也不读取历史 localStorage token。

密码提交、OAuth 授权和 ticket 兑换前先校验 Router 已解析的 `redirect`；缺省目标为 `/index`，非法/空值/数组显式拒绝且不创建会话。授权与绑定 API 使用 `/vue/user/profile` 等安全站内浏览器路径；回调导航移除当前前缀一次交给 history base，query/hash 保留原编码，不重复解码。

登录、注册与忘记密码页面通过 `GET /auth/code` 读取 `registerEnabled`、`forgotPasswordEnabled`、`mailEnabled` 等能力位；自助邮件验证码和密码重置分别调用 `POST /auth/email/code` 与 `POST /auth/forgot-password`。SSE/WebSocket 仅在资料/路由恢复完成后的布局挂载时初始化；布局卸载、退出与认证失效关闭 owned 连接及重连 timer。

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
校验响应原 Bearer 仍等于当前内存 token
-> invalidateSession() 立即清本地状态/路由/实时连接
-> 显式提示会话已失效
-> router.replace('/login?redirect=...')
```

普通 401 不会递归调用专用恢复资源。浏览器恢复请求使用独立同源 fetch，绕过普通拦截器，也不会写入 `sessionObj`；密码和 OAuth ticket 已通过 `repeatSubmit:false` 排除该缓存。

旧 Bearer 请求晚到的 401 不会注销新身份；App 在匿名且当前仍为受保护路由时隐藏旧 DOM，即使导航失败也不会继续显示旧页面。专用恢复/绑定/退出的 cookie 副作用在当前 tab 排队，新密码/OAuth 登录等待 pending logout，避免晚到 DELETE 清掉新 cookie。

## 5. 登出与副作用清理

登出链路当前是：

```text
userStore.logout()
-> 清空内存 token / 用户状态 / roles / permissions / owned 路由 / 消息 / 标签页
-> closeSSE() + closeWebSocket()
-> GET csrf -> DELETE /auth/browser-session（无 Bearer）
-> 同 scope + clientId tab 无凭据通知
```

因此登录态的主动清理动作挂在 `user` store 上，而不是分散在各个页面。

DELETE 失败会明确提示服务端注销未确认，本地仍保持已清理；不会宣称完全退出。恢复 cookie 与 CSRF cookie 由服务端 HttpOnly 管理，生产 Secure/SameSite=Strict，普通 Bearer 业务接口和实时 query 协议保持原有认证来源。只支持相对 API 前缀的同源代理。

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
