# pages

## 1. 模块定位

`src/pages` 是 weapp React 的页面层，承载公开页、管理台页、系统管理页、监控页和表单页。

## 2. 子模块清单

- 公开与基础页：`home`、`login`、`profile`、`profile-edit`、`notices`、`notice-detail`、`notice-form`
- 管理台入口：`admin`
- 系统管理：`system-users`、`system-roles`、`system-depts`、`system-posts`、`system-menus`、`system-dicts`
- 监控：`monitor-online`、`monitor-login-info`、`monitor-oper-log`、`monitor-cache`

## 3. 子模块职责摘要

| 页面分组 | 当前职责 |
| --- | --- |
| 公开与基础页 | 首页、登录、个人资料、公告列表与公告详情/编辑 |
| 管理台入口 | 管理导航与模块入口聚合 |
| 系统管理 | 用户、角色、部门、岗位、菜单、字典 CRUD |
| 监控 | 在线用户、登录日志、操作日志、缓存概览 |

## 4. 依赖方向

- 页面依赖 `store/session.ts` 做会话和权限检查。
- 页面依赖 `api/*` 拉取业务数据。
- 页面依赖 `components/*` 和 `utils/navigation.ts` 处理公共交互与跳转。

## 5. 典型调用链

```text
Page load
-> session.loadSession()
-> permission check
-> api/*
-> request.ts
-> backend
```

## 6. 公共约束

- 新增页面时，需要同步 `app.config.ts` 与本文件。
- 受保护页面必须显式处理无会话、无权限和加载失败路径。
- 页面内部若只是局部 UI 调整，通常不需要同步到工作区总览；若影响入口、链路或权限边界，则需要同步。

## 7. 已知边界

- 页面级表单子目录（如 `form/`）仍然跟随各页面目录，本文件只做父层聚合。
- 当前没有中心化页面守卫文件，访问控制逻辑散布在各页面实现中。

## 8. 下钻阅读路径

1. 公开页：`home`、`login`、`profile`、`notices`
2. 管理台入口：`admin`
3. 系统管理：`system-*`
4. 监控：`monitor-*`

## 9. 微信登录与消息中心

- `login` 只在微信小程序运行时且服务端启用时显示微信登录。调用失败会回到既有显式登录错误处理，不会对 H5 伪造微信能力。
- `messages` 是受会话保护的个人收件箱，支持下拉刷新、详情、已读、全部已读和软删除；新增该页面时已同步 `app.config.ts`。
