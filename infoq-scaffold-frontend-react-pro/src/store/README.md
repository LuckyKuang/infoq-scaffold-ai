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
-> token 持久化
-> AuthGuard 调 user.getInfo()
-> permission.generateRoutes()
-> user.initializeRealtimeChannels()
-> router / layout / pages 使用 store 结果
```

```text
已有 token 刷新进入受保护路由
-> AuthGuard 调 user.getInfo()
-> permission.generateRoutes()
-> user.initializeRealtimeChannels()
```

```text
会话退出或过期重登
-> user.logout()
-> closeSSE() / closeWebSocket()
-> 尝试 POST /auth/logout
-> 无论后端退出是否成功，都清理本地 token / 用户信息 / 角色权限
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
