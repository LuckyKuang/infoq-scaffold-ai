# infoq-plugin-websocket

## 1. 模块职责

提供 WebSocket 端点、会话管理、拦截器和集群广播支持。

## 2. 关键入口

- [`WebSocketConfig`](./src/main/java/cc/infoq/common/websocket/config/WebSocketConfig.java)
- `PlusWebSocketHandler`
- `PlusWebSocketInterceptor`
- `WebSocketSessionHolder`
- `WebSocketClusterLifecycle`

## 3. 核心类 / 文件

- `WebSocketProperties`
- `WebSocketMessageDto`
- `WebSocketTopicListener`
- `WebSocketClusterUtils`
- 自动装配入口：[`AutoConfiguration.imports`](./src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports)

## 4. 上游依赖

- `infoq-system` 通过编译依赖接入该能力。
- 需要实时双向通信时由业务层继续调用这里的工具和消息对象。

## 5. 下游依赖

- 编译期依赖 `infoq-core-common`、`infoq-plugin-redis`、`infoq-plugin-security`

## 6. 关键配置

- `websocket.enabled`
- `websocket.*`

## 7. 关键数据流

1. `websocket.enabled=true` 时注册 WebSocket 端点和拦截器。
2. 握手阶段通过 header 或 query token 完成认证，连接建立后会话进入 `WebSocketSessionHolder`。
3. 集群消息通过 Redis topic 与 cluster utils 扩散。

## 8. 扩展点

- `PlusWebSocketHandler`
- `PlusWebSocketInterceptor`
- `WebSocketClusterUtils`

## 9. 日志 / 监控切入点

- 连接是否建立、会话是否进入 holder、集群消息是否广播是主要排查点。
- 当前默认是否启用仍要看 profile 配置。

## 10. 已知边界

- 只提供 WebSocket 能力，不替代 SSE。
- 是否真正对外开放仍受运行配置控制。

