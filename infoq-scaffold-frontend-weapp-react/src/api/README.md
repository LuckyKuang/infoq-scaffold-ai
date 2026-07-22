# api

## 1. 模块定位

`src/api` 是 weapp React 的接口与网络层，负责统一请求封装、环境桥接和业务接口入口。

## 2. 子模块清单

- `request.ts`：统一请求与上传入口。
- `auth.ts`、`user.ts`、`notice.ts`、`dict.ts`、`admin.ts`：基础业务接口。
- `system/*`：用户、角色、菜单、部门、岗位等管理接口。
- `monitor/*`：在线用户、登录日志、操作日志、缓存等监控接口。
- `index.ts`：聚合导出。
- `types.ts`：请求/响应类型定义。

## 3. 子模块职责摘要

| 子模块 | 当前职责 |
| --- | --- |
| `request.ts` | 拼装 base URL、请求头、加密、错误归一化与上传 |
| `auth.ts` | 登录、登出、验证码、当前用户信息 |
| `system/*` | 系统管理业务 CRUD 接口 |
| `monitor/*` | 监控页查询接口 |
| `index.ts` | 对 store 和页面暴露统一 API 入口 |

## 4. 依赖方向

- 上游依赖主要是 `pages/*` 与 `store/session.ts`。
- `request.ts` 下游依赖 `utils/env.ts`、`utils/errors.ts`、`utils/crypto.ts`、`utils/rsa.ts`、`utils/helpers.ts`。

## 5. 典型调用链

```text
Page / Session Store
-> api/*
-> request.ts
-> Taro.request()
-> backend API
```

## 6. 公共约束

- 登录请求默认补齐 `clientId` 和 `grantType`。
- 小程序环境必须显式处理 `x-client-key`、`x-device-type` 与合法域名错误。
- 统一错误文案必须优先提取 `errMsg/message/msg`，不能把对象直接透传给 UI。

## 7. 已知边界

- 本目录不负责业务状态缓存，状态写入由页面或 `store/session.ts` 完成。
- 页面级会话判断不在这里完成，`request.ts` 只负责网络与错误边界。

## 8. 下钻阅读路径

1. 请求主干：`request.ts`
2. 会话接口：`auth.ts`
3. 业务接口：`system/*`、`monitor/*`、`notice.ts`

## 9. 微信登录与个人消息接口

- `auth.ts` 提供微信小程序启用探测；仅 WeChat runtime 可在启用后把 `Taro.login()` 返回的 code 作为 `grantType=miniapp` 登录请求的一部分。该请求仍走统一加密与错误归一化路径。
- `message.ts` 提供当前用户的消息分页、未读数、单条/全部已读和软删除接口。它不接收用户 ID，且不依赖或暴露任何实时通道。
