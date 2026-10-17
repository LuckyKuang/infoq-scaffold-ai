# infoq-plugin-sse

## 1. 模块职责

提供 Server-Sent Events 能力，包括订阅控制器、Emitter 管理、消息 DTO 和 Redis topic 监听。

## 2. 关键入口

- [`SseAutoConfiguration`](./src/main/java/cc/infoq/common/sse/config/SseAutoConfiguration.java)
- [`SseController`](./src/main/java/cc/infoq/common/sse/controller/SseController.java)
- [`SseEmitterManager`](./src/main/java/cc/infoq/common/sse/core/SseEmitterManager.java)
- [`SseTopicListener`](./src/main/java/cc/infoq/common/sse/listener/SseTopicListener.java)

## 3. 核心类 / 文件

- `SseProperties`
- `SseMessageDto`
- `SseMessageUtils`
- 自动装配入口：[`AutoConfiguration.imports`](./src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports)

## 4. 上游依赖

- `AuthController` 登录成功后会通过 `OptionalSseHelper` 尝试向用户推送欢迎消息。
- 需要实时通知的业务链路可继续复用这里的发消息能力。

## 5. 下游依赖

- 编译期依赖 `infoq-core-common`、`infoq-plugin-redis`、`infoq-plugin-security`、`spring-webmvc`

## 6. 关键配置

- `sse.enabled`
- `sse.*`

## 7. 关键数据流

1. `sse.enabled=true` 时装配 SSE 控制器和管理器。
2. 客户端通过 header 或 query token 建立 SSE 连接，认证由 security token service 完成。
3. 业务侧通过消息工具或 Redis topic 把消息送给 `SseEmitterManager`。

## 8. 扩展点

- `SseEmitterManager`
- `SseTopicListener`
- `SseMessageUtils`

## 9. 日志 / 监控切入点

- 登录后欢迎消息能否收到，是验证 SSE 链路的一个直接信号。
- 若连接建立正常但消息不达，需同时排查 Redis topic 和当前 token session。

## 10. 已知边界

- 只负责 SSE 能力，不替代 WebSocket。
- 是否开放路径还受 `security` 模块的 SSE 排除配置影响。

