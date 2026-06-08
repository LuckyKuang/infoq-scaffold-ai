# 优先级矩阵

## P0：核心运行时与请求分支

- `src/api/request.ts`
- `src/utils/auth.ts`
- `src/utils/crypto.ts`
- `src/utils/rsa.ts`
- `src/utils/env.ts`

关注点：
- Header/token 分支覆盖
- 加密/非加密分支
- 错误映射与抛错类型
- weapp 与 h5 运行时 URL 组装分支

## P1：API Wrapper 契约与权限

- `src/api/**/*.ts`
- `src/utils/permissions.ts`

关注点：
- 每个 API wrapper 导出至少被一个测试覆盖
- Method/url/transport 契约断言
- 权限归一化与通配符行为

## P2：Store 会话行为

- `src/store/session.ts`

关注点：
- `loadSession` 缓存与强制刷新分支
- `signIn` token 持久化与权限归一化
- `signOut` 成功/失败清理行为
- `hasPermission` 委派行为
