# infoq-plugin-redis

## 1. 模块职责

统一 backend 的 Redisson、Spring Cache、防重提交、限流、序列号和 Redis 工具能力。

## 2. 关键入口

- [`RedisConfig`](./src/main/java/cc/infoq/common/redis/config/RedisConfig.java)
- [`CacheConfig`](./src/main/java/cc/infoq/common/redis/config/CacheConfig.java)
- [`IdempotentConfig`](./src/main/java/cc/infoq/common/redis/config/IdempotentConfig.java)
- [`RateLimiterConfig`](./src/main/java/cc/infoq/common/redis/config/RateLimiterConfig.java)

## 3. 核心类 / 文件

- `RedissonProperties`
- `CacheUtils`、`RedisUtils`、`SequenceUtils`
- `@RepeatSubmit`、`RepeatSubmitAspect`
- `@RateLimiter`、`RateLimiterAspect`
- 资源文件：[`spel-extension.json`](./src/main/resources/spel-extension.json)

## 4. 上游依赖

- 登录验证码、Spring Security token session / revocation / online index、OSS 配置缓存、限流、防重提交等链路都依赖这个模块。
- `infoq-plugin-security`、`infoq-plugin-sse`、`infoq-plugin-websocket`、`infoq-plugin-oss` 都继续构建在这里之上。

## 5. 下游依赖

- 编译期依赖 `infoq-core-common`、`infoq-plugin-jackson`
- 运行时依赖 Redisson、Lock4j、Caffeine

## 6. 关键配置

- `redisson.*`
- Spring Redis 配置
- Redisson 单机 / 集群配置

## 7. 关键数据流

1. 启动时 `RedisConfig` 构建 Redisson 自定义 codec 和连接参数。
2. `CacheConfig` 打开 Spring Cache。
3. 业务调用 `CacheUtils` / `RedisUtils`，或通过防重 / 限流切面进入 Redis 能力。

## 8. 扩展点

- `KeyPrefixHandler`
- 自定义缓存 key、限流策略和防重提交表达式

## 9. 日志 / 监控切入点

- `RedisConfig` 初始化时会输出 Redis 配置初始化日志。
- Redis 相关故障会同时影响登录、缓存、OSS、SSE、WebSocket 等多条链路。

## 10. 已知边界

- 该模块必须保持 Redisson OSS 兼容，不能引入 PRO-only API。
- 具体业务缓存键和值语义仍要以调用端代码为准。

