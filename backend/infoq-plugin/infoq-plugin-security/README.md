# infoq-plugin-security

## 1. 模块职责

提供 backend 的请求鉴权入口，负责 Spring Security 过滤链、JWT access token 签发与校验、Redis session / revocation / online index、客户端 ID 一致性校验，以及健康检查等免鉴权路径的统一排除。

## 2. 关键入口

- [`SecurityConfig`](./src/main/java/cc/infoq/common/security/config/SecurityConfig.java)
- `SpringSecurityAutoConfiguration`
- `SecurityTokenService` / `SecurityTokenStore` / `SecurityTokenResolver`
- `CurrentUserService`
- [`SecurityProperties`](./src/main/java/cc/infoq/common/security/config/properties/SecurityProperties.java)
- [`SseProperties`](./src/main/java/cc/infoq/common/security/config/properties/SseProperties.java)

## 3. 核心类 / 文件

- 自动装配入口：[`AutoConfiguration.imports`](./src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports)

## 4. 上游依赖

- 所有进入 backend 的受保护 HTTP 请求都会经过这个模块。
- SSE / WebSocket 的 query token 解析复用这里的 token resolver 与 token service。

## 5. 下游依赖

- 编译期依赖 `infoq-core-common`、`infoq-plugin-redis`

## 6. 关键配置

- `security.*`
- `security.token.*`
- `sse.*`

## 7. 关键数据流

1. `SpringSecurityAutoConfiguration` 注册 `SecurityFilterChain`、401/403 JSON handler 和 token filter。
2. 公开路径由 `security.excludes` 与默认 public matcher 合并，`/auth/logout` 与 SSE close 保持受保护。
3. 请求进入后解析 `Authorization: Bearer <token>`，校验 JWT、Redis session、revocation marker 和 `clientid`。
4. 认证成功后把 `LoginUser` 与 token session 写入 Spring Security context，业务侧通过 `CurrentUserService` 读取。

## 8. 扩展点

- `SecurityProperties` 排除路径
- `SecurityTokenProperties` token 名称、前缀、TTL、active timeout、query token 与 clientId 配置

## 9. 日志 / 监控切入点

- 登录态异常、token 撤销、clientId 不一致、权限不足都要从这里切入。
- 当前实现里它是唯一鉴权主入口。

## 10. 已知边界

- 不负责业务权限数据本身，那部分仍在 `infoq-system`。
