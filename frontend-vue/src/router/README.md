# router

## 1. 模块定位

`src/router` 是 Vue admin 的固定路由定义层，负责给全局守卫、动态菜单注入和主布局提供初始路由壳。

## 2. 子模块清单

- `index.ts`：固定路由、`createRouter(...)` 与滚动恢复策略。
- `public-routes.ts`：守卫与 App 共用的公开路由匹配真值。

## 3. 子模块职责摘要

| 子模块 | 当前职责 |
| --- | --- |
| `index.ts` | 定义公开入口、OAuth 回调页、首页、个人中心、错误页和重定向页 |

## 4. 依赖方向

- `router/index.ts` 依赖 `layout/index.vue` 与 `views/*` 中的固定页面。
- 上游由 `main.ts` 和 `permission.ts` 共同使用。
- 动态路由注册和移除由 `store/modules/permission.ts` 管理；`permission.ts` 等待 user store 的资料/路由 bootstrap。

## 5. 典型调用链

```text
main.ts
-> router/index.ts
-> permission.ts
-> store/modules/permission.ts
-> router.addRoute(...)
```

## 6. 公共约束

- `/login`、`/oauth/callback`、`/register`、`/forgot-password`、`/401`、`/index` 等固定路由必须稳定存在；是否免登录由 `public-routes.ts` 白名单决定。
- 本目录只维护固定路由，不在这里手写完整后台菜单树。
- 动态路由映射依赖 `src/views` 的实际文件路径。
- `createWebHistory` 使用 Vite 的 `import.meta.env.BASE_URL`，与已验证的 `VITE_APP_CONTEXT_PATH` 构建 base 一致；菜单和应用内导航不手工拼接部署前缀。
- 全局守卫保留完整回跳；密码登录、OAuth 授权及 ticket 兑换在副作用前通过 `utils/auth-redirect.ts` 校验目标。只有未提供 `redirect` 时使用 `/index`；空值、数组和非法目标显示错误。
- API 交换不含 origin、带当前部署前缀一次的安全站内路径，例如 `/vue/user/profile`。Router 导航前移除一次前缀，由 history base 生成最终地址；query/hash 保留安全编码，不无条件二次解码。
- 首个受保护路由先等待 GET CSRF→POST 恢复→getInfo→getRouters。恢复仅 401 跳登录并保留完整 redirect；403/503/网络失败展示错误并停止自动重试。OAuth callback 直接处理新 ticket，不先恢复旧身份。

## 7. 已知边界

- 这里不承载鉴权守卫实现；守卫逻辑在 `src/permission.ts`。
- 这里不承载后端菜单转换；该职责在 `store/modules/permission.ts`。

## 8. 下钻阅读路径

1. 固定路由：`index.ts`
2. 全局守卫：`../permission.ts`
3. 动态注入：`../store/modules/permission.ts`

## 9. 固定消息中心路由

`/message-center` 是与 `/user/profile` 同类的固定受保护路由，不依赖后端菜单。全局守卫仍会先恢复用户资料和权限，因此匿名访问不能查询个人消息。
