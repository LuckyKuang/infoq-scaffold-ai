# router

## 1. 模块定位

`src/router` 是 React admin 的路由与动态页面解析层，负责固定路由、公开白名单、鉴权守卫和后端菜单到前端页面组件的装配。

## 2. 子模块清单

- `AppRouter.tsx`：固定路由树与外层 `BrowserRouter` 壳。
- `AuthGuard.tsx`：登录态检查、用户信息初始化、动态路由装配引导、实时通道恢复与初始化失败清理。
- `public-routes.ts`：登录前公开路由白名单匹配。
- `BackendRouteView.tsx`：后端组件名到真实页面组件的解析与 tags view 同步。
- `route-transform.ts`：后端菜单结构转换、组件映射构建、冲突检测。
- `component-map.ts`、`path-to-component.ts`：组件路径和页面组件解析。

## 3. 子模块职责摘要

| 子模块 | 当前职责 |
| --- | --- |
| `AppRouter.tsx` | 固定公开路由、OAuth 回调页、主布局壳路由和 404 入口 |
| `AuthGuard.tsx` | 等待共享恢复与用户/动态菜单初始化；401回登录，依赖或协议失败显示重试 |
| `public-routes.ts` | `/login`、`/register`、`/forgot-password`、`/oauth/callback` 等公开路径匹配 |
| `BackendRouteView.tsx` | 根据路径或组件名渲染真实页面 |
| `route-transform.ts` | 规范化后端菜单并生成 `routeComponentMap` |

## 4. 依赖方向

- `router` 依赖 `pages`、`layouts`、`store/modules/user`、`store/modules/permission`、`store/modules/tagsView`。
- 上游由 `App.tsx` 直接接入。

## 5. 典型调用链

```text
App.tsx
-> AppRouter.tsx
-> AuthGuard.tsx
-> userStore.bootstrapSession()
-> GET csrf + POST restore（内存无 token 时）
-> userStore.getInfo()
-> permissionStore.generateRoutes()
-> userStore.initializeRealtimeChannels()
-> BackendRouteView.tsx
-> 页面组件
```

## 6. 公共约束

- `/login`、`/oauth/callback`、`/register`、`/forgot-password`、`/401`、`/index` 等固定路由必须稳定存在。
- 后端返回的特殊组件名 `Layout`、`ParentView`、`InnerLink` 由本目录做特殊处理。
- 路由冲突需要在 `route-transform.ts` 阶段显式检测，而不是等运行时偶发 404。
- 用户信息或动态路由初始化失败时，守卫必须清理本地会话；只有明确401/匿名才回登录，403/503/网络失败显示错误及显式重试，不能继续渲染受保护布局。
- `BrowserRouter.basename` 使用 Vite 的 `import.meta.env.BASE_URL`；`VITE_APP_CONTEXT_PATH` 经构建配置校验后决定同一个 base，菜单和应用内导航不手工拼接部署前缀。
- `AuthGuard` 保留原路由的 pathname、query 与 hash。密码登录、OAuth 授权和 ticket 兑换在副作用前通过 `utils/auth-redirect.ts` 验证目标；只有未提供 `redirect` 时使用 `/index`，非法/重复参数显式显示错误。
- OAuth API 交换的是无 origin 的站内浏览器路径，例如 `/react/user/profile`；`requireAppRedirect` 在 Router 导航前移除当前前缀一次，`toDeploymentRedirect` 在授权/绑定时添加一次。query/hash 保留原始安全编码，禁止无条件二次解码。

## 7. 已知边界

- 当前动态路由来源完全依赖后端菜单接口；本目录不单独维护完整业务路由树。
- 页面级权限按钮判断不在本目录完成，而是落在页面与权限辅助工具中。

## 8. 下钻阅读路径

1. 固定路由：`AppRouter.tsx`
2. 公开白名单：`public-routes.ts`
3. 守卫初始化：`AuthGuard.tsx`
4. 动态组件解析：`BackendRouteView.tsx`
5. 后端菜单转换：`route-transform.ts`

## 9. 固定消息中心路由

`/message-center` 是固定受保护路由，不依赖后端菜单动态装配。它展示当前用户的个人收件箱；初始化仍经过 `AuthGuard`，因此不带有效 token 时不会暴露消息数据。

`AuthGuard` 不读取持久化 token，也不在 OAuth callback 上恢复旧用户。StrictMode 和并发路由复用 `bootstrapSession()`；未完成恢复时显示 loading，用户和路由成功后才允许布局及实时连接启动。

退出pending期间只展示进度，受保护内容立即隐藏，且不发起bootstrap或提前导航到登录页。DELETE响应确认后才显示登录页；失败显示明确撤销未确认与重试退出，避免用户按“已退出”立即刷新时中断真正的服务端撤销。
