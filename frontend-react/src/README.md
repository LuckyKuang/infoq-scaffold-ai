# src

## 1. 模块定位

`src/` 是 React admin 的主实现层，承载应用入口、页面、状态、路由、布局、接口契约与运行时工具。

## 2. 子模块清单

- [`api`](./api/README.md)：后端接口契约与请求入口。
- [`router`](./router/README.md)：固定路由、鉴权守卫、动态页面解析。
- [`store`](./store/README.md)：用户、权限、标签页、设置与通知状态。
- [`pages`](./pages/README.md)：登录、首页、系统管理、监控与错误页。
- `layouts`：主布局、标签页栏、设置抽屉、keep-alive 壳。
- `components`：通用桥接组件、错误边界、内链等。
- `utils`：请求、鉴权、缓存、加密、SSE、WebSocket 与权限辅助。

## 3. 子模块职责摘要

| 子模块 | 当前职责 |
| --- | --- |
| `api` | 定义 URL、方法、类型与少量请求头开关 |
| `router` | 建立固定壳路由，并把后端菜单解析成真实页面 |
| `store` | 维护登录态、权限、侧栏、标签页和界面偏好 |
| `pages` | 承载具体页面实现 |
| `layouts/components/utils` | 承载页面壳和跨页面通用能力 |

## 4. 依赖方向

- `pages` 依赖 `api`、`store`、`components`、`utils`。
- `router` 依赖 `pages`、`layouts`、`store`。
- `api` 统一依赖 `utils/request.ts`。
- `store/modules/user` 与 `store/modules/permission` 反向驱动 `router` 的主链路。

## 5. 典型调用链

```text
main.tsx
-> RootProviders.tsx
-> router/AppRouter.tsx
-> AuthGuard.tsx
-> store/modules/user + permission
-> pages/*
-> api/*
-> utils/request.ts
```

## 6. 公共约束

- 目录级 README 只描述当前实现，不预判未来页面。
- 动态路由与权限链路变化时，优先更新 `router/README.md` 与 `store/README.md`。
- 请求封装变化时，优先更新 `api/README.md` 并在工作区总览中同步主链路摘要。

## 7. 已知边界

- `layouts`、`components`、`utils` 当前没有单独 README；需要深入时直接看源码文件。
- 这里只做 `src/` 聚合，不代替下级目录的详细说明。

## 8. 下钻阅读路径

1. [`api/README.md`](./api/README.md)
2. [`router/README.md`](./router/README.md)
3. [`store/README.md`](./store/README.md)
4. [`pages/README.md`](./pages/README.md)
