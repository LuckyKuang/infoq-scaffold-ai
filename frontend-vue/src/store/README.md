# store

## 1. 模块定位

`src/store` 是 Vue admin 的 Pinia 状态层，负责登录态、动态路由、界面偏好、标签页、字典和通知状态。

## 2. 子模块清单

- `modules/user.ts`
- `modules/permission.ts`
- `modules/app.ts`
- `modules/settings.ts`
- `modules/tagsView.ts`
- `modules/dict.ts`
- `modules/notice.ts`
- `index.ts`

## 3. 子模块职责摘要

| 模块 | 当前职责 |
| --- | --- |
| `user` | token、用户信息、角色权限、password/OAuth ticket 登录登出、SSE 清理、退出失败时的本地会话清理 |
| `permission` | 动态菜单拉取、路由转换、侧栏/顶栏缓存 |
| `app` | 语言、设备、界面偏好等应用级状态 |
| `settings` | 主题、布局与显示设置 |
| `tagsView` | 已访问标签页与缓存视图 |
| `dict` | 字典相关前端缓存 |
| `notice` | 公告/消息相关前端状态 |

## 4. 依赖方向

- 上游依赖主要来自 `permission.ts`、`views/*` 和 `layout/*`。
- `user` 依赖 `api/login.ts` 与 `utils/auth.ts`。
- `permission` 依赖 `api/menu.ts`、`router`、`layout` 和 `views` 组件解析。

## 5. 典型调用链

```text
登录成功
-> user.login() / user.loginByOAuthTicket()
-> token 持久化
-> permission.ts 调 user.getInfo()
-> permission.generateRoutes()
-> router / layout / views 使用 store 结果
```

```text
会话退出或过期重登
-> user.logout()
-> closeSSE()
-> 尝试 POST /auth/logout
-> 无论后端退出是否成功，都清理本地 token / 用户信息 / 角色权限
```

## 6. 公共约束

- 影响主链路的 store 变更，至少要同步 `README.md`、`doc/data-flow.md` 和本文件。
- `user` 与 `permission` 的职责分界应保持明确：前者管会话，后者管路由。
- `dict`、`notice` 等辅助状态不应混入路由装配职责。

## 7. 已知边界

- `index.ts` 只负责 Pinia 注册与统一导出，不承担业务语义。
- 本目录不记录每个 state 字段的实现细节，关注点是职责与主链路位置。

## 8. 下钻阅读路径

1. 登录态：`modules/user.ts`
2. 动态路由：`modules/permission.ts`
3. 界面偏好：`modules/app.ts`、`modules/settings.ts`
4. 字典与通知：`modules/dict.ts`、`modules/notice.ts`

## 9. 持久化消息状态

`modules/notice.ts` 从 `api/system/message` 刷新个人消息与未读数，并供导航栏、通知弹层和 `/message-center` 共用。SSE/WebSocket 仅在收到 `type=message` 时触发刷新，不缓存事件正文；离线读取、已读和软删除由后端持久化收件箱保证。
