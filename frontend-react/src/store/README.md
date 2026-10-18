# store

## 1. 模块定位

`src/store` 是 React admin 的前端状态层，负责登录态、权限路由、界面偏好、标签页和通知状态。

## 2. 子模块清单

- `modules/user.ts`
- `modules/permission.ts`
- `modules/app.ts`
- `modules/settings.ts`
- `modules/tagsView.ts`
- `modules/notice.ts`

## 3. 子模块职责摘要

| 模块 | 当前职责 |
| --- | --- |
| `user` | token、用户信息、角色权限、password/OAuth ticket 登录登出、SSE/WebSocket 生命周期、刷新后实时通道恢复、退出失败时的本地会话清理 |
| `permission` | 动态菜单拉取、路由转换、侧边栏/顶栏/组件映射缓存 |
| `app` | 语言、组件尺寸等应用级偏好 |
| `settings` | 主题、暗色模式等界面设置 |
| `tagsView` | 已访问标签页与缓存视图 |
| `notice` | 公告/消息相关前端状态 |

## 4. 依赖方向

- 上游依赖主要来自 `router` 与 `pages`。
- `user` 依赖 `api/login.ts` 与 `utils/auth.ts`。
- `permission` 依赖 `api/menu.ts` 与 `router/route-transform.ts`。

## 5. 典型调用链

```text
登录成功
-> user.login() / user.loginByOAuthTicket()
-> GET csrf + PUT /auth/browser-session（成功后 token 仅在内存）
-> AuthGuard 调 user.bootstrapSession()
-> user.getInfo()
-> permission.generateRoutes()
-> user.initializeRealtimeChannels()
-> router / layout / pages 使用 store 结果
```

```text
刷新进入受保护路由
-> AuthGuard 调 user.bootstrapSession()
-> GET csrf + POST /auth/browser-session
-> user.getInfo()
-> permission.generateRoutes()
-> user.initializeRealtimeChannels()
```

```text
会话退出或过期重登
-> user.logout()
-> closeSSE() / closeWebSocket()
-> 清理本地 token / 用户信息 / 角色权限 / 动态路由 / 标签页 / 消息
-> GET csrf + DELETE /auth/browser-session（不附 Bearer）
-> 服务端撤销失败显式报告
```

## 6. 公共约束

- 影响主链路的 store 变更，至少要同步 `README.md`、`doc/data-flow.md` 和本文件。
- `user` 与 `permission` 的职责分界应保持明确：前者管会话，后者管路由。
- `tagsView` 只是页面访问状态，不应承载业务真值。
- `user.initializeRealtimeChannels()` 是登录成功与刷新后守卫启动共用的实时通道入口；新增实时资源时应保持幂等，避免重复连接。

## 7. 已知边界

- 当前没有单独的全局 store root 文件；各模块直接通过 Zustand `create(...)` 暴露 hooks。
- 本目录不记录每个 state 字段的实现细节，关注点是职责与主链路位置。

## 8. 下钻阅读路径

1. 登录态：`modules/user.ts`
2. 动态路由：`modules/permission.ts`
3. 界面偏好：`modules/app.ts`、`modules/settings.ts`
4. 标签页与通知：`modules/tagsView.ts`、`modules/notice.ts`

## 9. 持久化消息状态

`modules/notice.ts` 是服务端消息收件箱的前端投影：它调用 `api/system/message` 刷新分页、未读数和读/删操作。`NoticeBell` 和 `/message-center` 共用该状态；SSE/WebSocket 仅在收到结构化 `type=message` 事件时触发刷新，不写入或缓存事件正文。消息持久化、权限隔离与离线读取始终由后端负责。

## 10. 浏览器会话恢复与并发边界

`auth.ts` 只保留模块内存 token，启动删除旧 `Admin-Token`，不读取或迁移。`user.bootstrapSession()` 共享一次 in-flight promise，依次恢复身份、获取用户、装配路由，最后才启动幂等 SSE/WebSocket。`unknown/restoring/authenticated/anonymous/failed` 区分启动、明确未登录与依赖失败；只有恢复 401 进入匿名，403/503/网络错误保留可重试状态。

退出另外使用`logoutState=idle/pending/failed`明确远端撤销完成点。pending先关闭实时连接、清本地认证/路由，再等待DELETE；此时守卫只显示退出进度，不恢复、不显示旧受保护内容或登录表单。成功后才转登录页；失败保留撤销未确认提示与重试退出，不能把本地清理当成服务端退出成功。

密码和 OAuth ticket 都先绑定 HttpOnly 恢复会话，再提交新 token；绑定失败用该新 Bearer 撤销会话，撤销失败保持可见。版本标记阻止 logout 或同 scope 通知之后的旧异步结果重建用户/路由。跨 tab 通知只含 `scope/clientId/action`，React 与 Vue 隔离，授权仍由服务端撤销决定。

行为回归与反模式见 [会话测试 SOP](../../doc/auth-session-testing.md)。
