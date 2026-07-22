# router

## 1. 模块定位

`src/router` 是 Vue admin 的固定路由定义层，负责给全局守卫、动态菜单注入和主布局提供初始路由壳。

## 2. 子模块清单

- `index.ts`：固定路由、`createRouter(...)` 与滚动恢复策略。

## 3. 子模块职责摘要

| 子模块 | 当前职责 |
| --- | --- |
| `index.ts` | 定义公开入口、OAuth 回调页、首页、个人中心、错误页和重定向页 |

## 4. 依赖方向

- `router/index.ts` 依赖 `layout/index.vue` 与 `views/*` 中的固定页面。
- 上游由 `main.ts` 和 `permission.ts` 共同使用。
- 动态路由注入逻辑不在本目录，而在 `store/modules/permission.ts` 与 `permission.ts`。

## 5. 典型调用链

```text
main.ts
-> router/index.ts
-> permission.ts
-> store/modules/permission.ts
-> router.addRoute(...)
```

## 6. 公共约束

- `/login`、`/oauth/callback`、`/register`、`/401`、`/index` 等固定路由必须稳定存在。
- 本目录只维护固定路由，不在这里手写完整后台菜单树。
- 动态路由映射依赖 `src/views` 的实际文件路径。

## 7. 已知边界

- 这里不承载鉴权守卫实现；守卫逻辑在 `src/permission.ts`。
- 这里不承载后端菜单转换；该职责在 `store/modules/permission.ts`。

## 8. 下钻阅读路径

1. 固定路由：`index.ts`
2. 全局守卫：`../permission.ts`
3. 动态注入：`../store/modules/permission.ts`

## 9. 固定消息中心路由

`/message-center` 是与 `/profile` 同类的固定受保护路由，不依赖后端菜单。全局守卫仍会先恢复用户资料和权限，因此匿名访问不能查询个人消息。
