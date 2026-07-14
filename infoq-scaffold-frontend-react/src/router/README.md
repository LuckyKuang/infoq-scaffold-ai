# router

## 1. 模块定位

`src/router` 是 React admin 的路由与动态页面解析层，负责固定路由、公开白名单、鉴权守卫和后端菜单到前端页面组件的装配。

## 2. 子模块清单

- `AppRouter.tsx`：固定路由树与外层 `BrowserRouter` 壳。
- `AuthGuard.tsx`：登录态检查、用户信息初始化、动态路由装配引导、实时通道恢复与初始化失败清理。
- `public-routes.ts`：登录前公开路由白名单匹配。
- `BackendRouteView.tsx`：后端组件名到真实页面组件的解析与 tags view 同步。
- `route-transform.ts`：后端菜单结构转换、组件映射构建、冲突检测。
- `component-map.tsx`、`path-to-component.ts`：组件路径和页面组件解析。

## 3. 子模块职责摘要

| 子模块 | 当前职责 |
| --- | --- |
| `AppRouter.tsx` | 固定公开路由、OAuth 回调页、主布局壳路由和 404 入口 |
| `AuthGuard.tsx` | 有 token 时补齐用户信息和动态菜单，恢复实时通道；初始化失败时清理会话并回登录 |
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
- token 已存在但用户信息或动态路由初始化失败时，守卫必须显式清理本地会话并重定向到登录页，不能继续渲染受保护布局。

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
