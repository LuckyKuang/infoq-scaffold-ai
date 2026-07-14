# store

## 1. 模块定位

`src/store` 是 weapp React 的会话状态层，当前只维护一个 `session` store。

## 2. 子模块清单

- `session.ts`

## 3. 子模块职责摘要

| 模块 | 当前职责 |
| --- | --- |
| `session` | token、用户信息、权限集合、初始化状态、登录登出与权限判断 |

## 4. 依赖方向

- 上游依赖主要来自 `pages/*`。
- 下游依赖 `src/api/index.ts` 聚合导出的 `login/getInfo/logout/permission` 能力。

## 5. 典型调用链

```text
登录页
-> session.signIn()
-> token + getInfo()
-> user / permissions

受保护页面
-> session.loadSession()
-> hasPermission()
-> 页面继续或跳转
```

## 6. 公共约束

- 当前会话真值集中在一个 store 里，新增状态前应先确认是否真的需要拆分。
- 无会话或无权限时，页面层必须显式处理跳转，不依赖隐式 fallback。

## 7. 已知边界

- 当前 store 不负责页面局部表单状态。
- 本目录只聚焦会话与权限，不承担导航或请求职责。

## 8. 下钻阅读路径

1. `session.ts`

## 9. 未读消息状态

`session` 额外维护 `unreadMessageCount` 与刷新动作。应用启动、回到前台或个人资料页触发时，已认证会话可请求服务端未读数；消息列表、正文和读/删操作仍由 `pages/messages` 通过 `api/message.ts` 获取，避免把收件箱内容塞进会话 store。
