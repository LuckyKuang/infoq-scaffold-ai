# src

## 1. 模块定位

`src/` 是 Vue admin 的主实现层，承载应用入口、页面、状态、路由、布局、全局插件与运行时工具。

## 2. 子模块清单

- [`api`](./api/README.md)：后端接口契约与请求入口。
- [`router`](./router/README.md)：固定路由定义。
- [`store`](./store/README.md)：用户、权限、标签页、设置、字典与通知状态。
- [`views`](./views/README.md)：登录、首页、系统管理、监控与错误页。
- `layout`：主布局、侧栏、导航栏、设置、标签页等壳层。
- `plugins`：auth、cache、download、modal、svgicon、tab 等全局插件。
- `utils`：请求、鉴权、缓存、加密、SSE、WebSocket、字典、主题辅助。

## 3. 子模块职责摘要

| 子模块 | 当前职责 |
| --- | --- |
| `api` | 定义 URL、方法、类型与少量请求头开关 |
| `router` | 定义固定路由和导航壳入口 |
| `store` | 维护登录态、权限路由、侧栏、标签页和界面偏好 |
| `views` | 承载具体页面实现 |
| `layout/plugins/utils` | 承载页面壳和跨页面通用能力 |

## 4. 依赖方向

- `views` 依赖 `api`、`store`、`layout`、`utils`。
- `permission.ts` 依赖 `router` 与 `store`，负责把动态菜单注入运行中的路由器。
- `api` 统一依赖 `utils/request.ts`。
- `store/modules/permission` 依赖 `router`、`layout` 和 `views` 组件解析。

## 5. 典型调用链

```text
main.ts
-> router/index.ts
-> permission.ts
-> store/modules/user + permission
-> views/*
-> api/*
-> utils/request.ts
```

## 6. 公共约束

- 动态路由与权限链路变化时，优先更新 `router/README.md` 与 `store/README.md`。
- 请求封装变化时，优先更新 `api/README.md` 并在工作区总览中同步主链路摘要。
- 目录级 README 只描述当前实现，不预判未来页面。

## 7. 已知边界

- `layout`、`plugins`、`utils` 当前没有单独 README；需要深入时直接看源码文件。
- 这里只做 `src/` 聚合，不代替下级目录的详细说明。

## 8. 下钻阅读路径

1. [`api/README.md`](./api/README.md)
2. [`router/README.md`](./router/README.md)
3. [`store/README.md`](./store/README.md)
4. [`views/README.md`](./views/README.md)
