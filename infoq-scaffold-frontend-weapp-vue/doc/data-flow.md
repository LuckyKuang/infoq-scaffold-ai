# infoq-scaffold-frontend-weapp-vue 关键数据流

本文档只记录当前 weapp Vue 代码能直接追到的几条主链路：

- 登录与会话初始化
- 页面级鉴权与权限检查
- 统一请求与错误归一化

## 0. 链路下钻入口

- 工作区总览：[`../README.md`](../README.md)
- 请求层：[`../src/api/README.md`](../src/api/README.md)
- 状态层：[`../src/store/README.md`](../src/store/README.md)
- 页面层：[`../src/pages/README.md`](../src/pages/README.md)

## 1. 登录与会话初始化

登录链路的入口分散在三个位置：

- 页面入口：`src/pages/login/index.vue`
- API 入口：`src/api/auth.ts`
- 状态入口：`src/store/session.ts`

当前主链路可以直接概括为：

```text
Login Page
-> auth.login()
-> api/request.ts
-> POST /auth/login
-> sessionStore.signIn()
-> setToken()
-> auth.getInfo()
-> sessionStore 写入 user / permissions / initialized
```

与 Web admin 不同，这里登录成功后就直接在 `signIn()` 内补齐当前用户信息，而不是交给全局守卫二次初始化。

## 2. 页面级鉴权与权限检查

当前受保护页面通常会在 `onLoad` 或页面初始化阶段主动执行：

```text
ensureAuthenticated()
-> sessionStore.loadSession()
-> 需要更细粒度权限时调用 ensurePermission()
-> 允许则继续加载业务数据
-> 否则 toast + relaunch(fallback)
```

从代码搜索结果可以直接确认，`admin`、`home`、`profile`、`notice-*`、`system-*`、`monitor-*` 等页面都在调用 `ensureAuthenticated()`，部分表单页与详情页还会额外调用 `ensurePermission()`。

## 3. 统一请求链路

所有接口最终都收敛到 `src/api/request.ts`：

```text
api/* business wrapper
-> request(options)
-> resolveUrl()
-> applyRuntimeHeaders()
-> uni.request()
-> decryptPayloadIfNeeded()
-> ensureSuccess()
```

当前实现要点：

- 自动补 `clientid`
- 有 token 时补 `Authorization`
- 小程序环境自动补 `x-client-key=weapp` 和 `x-device-type=weapp`
- 写请求可选 RSA/AES 加密
- 500ms 内相同 `POST/PUT` 视为重复提交

## 4. 错误归一化链路

`api/request.ts` 在失败路径会：

```text
extractFailureMessage()
-> 识别 timeout / domain whitelist / fail
-> normalizeFailure()
-> 抛出 AppError 或 AuthError
```

这条链路的重点不是“让错误更漂亮”，而是保证：

- 401 会显式清 token
- 合法域名失败会返回明确中文文案
- 不会把对象错误直接渲染成 `[object Object]`

## 5. 典型业务页请求链路

以 `pages/system-*`、`pages/monitor-*` 和 `pages/notices/*` 为代表，当前业务页遵循同一模式：

```text
Page
-> ensureAuthenticated() / ensurePermission()
-> sessionStore.loadSession()
-> api/system/* or api/monitor/* or api/notice/*
-> api/request.ts
-> backend API
-> 更新页面局部状态
```

这意味着 Vue 小程序端当前是“composable + session store + 页面局部加载”的组合，而不是统一数据编排层。

## 6. 已知边界

- 页面内部局部交互、表单和 UI 状态没有在这里逐页展开；需要时继续下钻到具体页面文件。
- 文档只记录当前能由代码直接证实的页面级鉴权与请求链路，不推断未来会改成中心化 guard。

## 7. 微信小程序登录与消息收件箱

微信登录只在运行环境为 `weapp` 后执行：

```text
Login Page
-> GET /auth/wechat-miniapp/enabled
-> uni.login()
-> encrypted POST /auth/login { grantType: "xcx", code }
-> sessionStore.signIn()
```

后端关闭该能力或当前为 H5 时，不展示微信按钮。微信 code 不进入页面日志或本地会话状态。

个人消息链路不依赖实时连接：

```text
App onShow / Profile
-> session.refreshUnreadMessageCount()
-> GET /system/message/unread-count

pages/messages
-> /system/message/list, read, read-all, delete
-> 服务端持久化收件箱
```
