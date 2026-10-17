# api

## 1. 模块定位

`src/api` 是 Vue admin 的接口契约层，负责把页面与状态层需要调用的后端接口组织成稳定入口。

## 2. 子模块清单

- `login.ts`、`menu.ts`：登录、OAuth provider 列表与 ticket 换 token、验证码、用户信息、动态菜单相关接口。
- `system/*`：用户、角色、菜单、部门、岗位、字典、配置、公告、客户端、OSS 等管理接口。
- `monitor/*`：在线用户、登录日志、操作日志、缓存、数据源、任务、服务监控等运行态接口。
- `types.ts` 与各子目录 `types.ts`：接口请求/响应类型。

## 3. 子模块职责摘要

| 子模块 | 当前职责 |
| --- | --- |
| `login.ts` | 登录、OAuth provider 列表与 ticket 换 token、注册、验证码、登出、当前用户信息 |
| `menu.ts` | 后端菜单与前端动态路由来源 |
| `system/*` | 管理台业务 CRUD 接口；`system/config` 额外提供配置中心 `panel`、按 key 恢复默认和显示顺序调整接口 |
| `monitor/*` | 监控页查询接口 |

## 4. 依赖方向

- 上游依赖主要是 `views/*` 与 `store/modules/*`。
- 下游统一依赖 `../utils/request.ts`。
- 类型定义与返回体约束来自本目录 `types.ts` 或各子模块 `types.ts`。

## 5. 典型调用链

```text
View / Store
-> api/*
-> utils/request.ts
-> backend API
-> 页面局部状态或 Pinia
```

## 6. 公共约束

- 登录与注册请求默认补齐 `clientId` 和 `grantType`。
- OAuth ticket 登录请求固定补齐 `grantType=oauth`，并沿用公开加密请求头。
- `GET /auth/oauth/providers` 是登录页第三方入口的公开真值；`POST /auth/oauth/ticket` 只消费后端回调签出的短期 ticket。
- 需要跳过 token、关闭重复提交拦截或启用请求加密时，优先通过请求头开关表达。
- 统一错误处理不在 API 文件里重复实现，而是下沉到 `utils/request.ts`。

## 7. 已知边界

- 本目录不负责业务状态缓存，状态写入仍在页面或 store 中完成。
- 下载流等特殊处理由 `utils/request.ts` 暴露公共能力，本目录只负责调用。

## 8. 下钻阅读路径

1. 登录/用户信息：`login.ts`
2. 动态菜单：`menu.ts`
3. 业务 CRUD：`system/*`
4. 运行态监控：`monitor/*`

## 9. 身份与个人消息接口

- `system/user` 个人资料接口提供 OAuth 身份列表、绑定授权地址和解绑请求。绑定由后端短期 ticket 保护，解绑请求的当前密码字段只在服务端要求时提交。
- `system/message` 是当前登录用户的收件箱契约，提供分页、未读数、单条/全部已读与软删除。它不接收用户 ID，页面和 Pinia 只消费服务端消息数据。
