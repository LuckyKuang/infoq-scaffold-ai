# 模块分类

## 固定入口

- `auth.login`
- `auth.register`
- `auth.forgot-password`
- `auth.oauth-callback`
- `home.index`
- `error.401`
- `error.404`
- `route.redirect`

## 系统管理

- `system.user`
- `system.role`
- `system.menu`
- `system.dept`
- `system.post`
- `system.dict`
- `system.dict.data`
- `system.config`
- `system.notice`
- `system.client`
- `system.invite`
- `system.oss`
- `system.oss.config`
- `system.user.profile`

## 系统监控

- `monitor.online`
- `monitor.loginInfo`
- `monitor.operLog`
- `monitor.cache`
- `monitor.dataSource`
- `monitor.server`
- `monitor.job`
- `monitor.jobLog`

## 分类规则

- 菜单 `component` 优先转换为模块键。
- `system/user/index` 转为 `system.user`。
- `system/dict/data` 转为 `system.dict.data`。
- `monitor/jobLog/index` 转为 `monitor.jobLog`。
- 权限按钮继承父菜单模块键。
- 固定公开路由使用显式模块键。
