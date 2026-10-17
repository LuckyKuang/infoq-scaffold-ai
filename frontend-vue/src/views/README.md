# views

## 1. 模块定位

`src/views` 是 Vue admin 的页面层，承载固定公开页、系统管理页、监控页和少量跳转/错误页。

## 2. 子模块清单

- `login.vue`、`oauth-callback.vue`、`register.vue`、`index.vue`
- `system/*`
- `monitor/*`
- `redirect/*`
- `error/*`

## 3. 子模块职责摘要

| 页面分组 | 当前职责 |
| --- | --- |
| `login`、`oauth-callback`、`register` | 登录前公开入口、第三方登录回调；`register` 会根据 backend 能力位决定是否展示邀请码校验与验证码发送门禁 |
| `index` | 登录后的首页入口 |
| `system/*` | 用户、角色、菜单、部门、岗位、字典、配置、邀请码、公告、客户端、OSS、个人中心；`system/config` 使用后端 `panel` 接口渲染类型化配置中心，OSS 页面读取 `sys.oss.previewListResource` 保持预览开关一致 |
| `monitor/*` | 在线用户、登录日志、操作日志、缓存、数据源、服务、任务与任务日志 |
| `redirect/*`、`error/*` | 路由跳转和错误展示 |

## 4. 依赖方向

- 页面依赖 `api/*` 获取后端数据。
- 页面依赖 `store/*` 获取登录态、权限、标签页和字典状态。
- 动态管理页实际入口由 `permission store + router.addRoute(...)` 装配后进入。

## 5. 典型调用链

```text
Route match
-> layout/index.vue or fixed route
-> views/*
-> api/*
-> utils/request.ts
-> backend
```

## 6. 公共约束

- 页面目录结构要与后端菜单 `component` 字段映射保持一致。
- 错误页与登录页属于固定页面，不能依赖后端动态菜单才可访问。
- 页面内部若只是局部 UI 调整，通常不需要层层同步到工作区总览；若影响入口、职责或链路，则需要同步。

## 7. 已知边界

- 页面级局部组件（如对话框、子表单）仍然散落在页面目录内部，本文件只做父层聚合。
- 这里只记录当前已有页面分组，不推断未来页面矩阵。

## 8. 下钻阅读路径

1. 公开入口：`login.vue`、`oauth-callback.vue`、`register.vue`（含邀请码注册门禁）
2. 首页：`index.vue`
3. 业务页：`system/*`（重点关注 `system/config/index.vue`、`system/invite/index.vue`）
4. 监控页：`monitor/*`

## 9. 个人身份与消息中心

- `system/user/profile` 包含 OAuth 身份管理页签，绑定复用浏览器 OAuth 回调链路，解绑的当前密码确认由服务端规则决定。
- `message-center/index.vue` 展示个人持久化收件箱，支持读取、全部已读和软删除。它与公告管理 `system/notice` 的后台 CRUD 保持职责分离。
