# infoq-plugin-push

## 1. 模块定位

`infoq-plugin-push` 提供与具体实时协议解耦的 Push 契约。它不保存消息正文、不创建消息接收人记录，也不承担离线可达性；这些职责由 `infoq-system` 的消息盒子持久化服务承担。

## 2. 入口与契约

- 自动装配：`PushAutoConfiguration`，仅当 `infoq.push.enabled=true` 时生效。
- 服务接口：`PushService#push(PushRequest)`，返回 `PushResult`。
- 请求模型：`PushRequest` 传递 correlation ID、message ID、结构化 `PushRecipient` 和事件负载；`PushChannel` 描述通道。
- 当前业务接线：`SysMessagePushListener` 在消息事务 `AFTER_COMMIT` 后异步发送只含 `{ type: "message", messageId }` 的刷新事件。

## 3. 配置与失败语义

```yaml
infoq:
  push:
    enabled: false
    sse-enabled: false
    websocket-enabled: false
```

- 默认关闭时不创建 PushService 或通道适配器。
- 启用时必须至少选择一个通道；`sse-enabled=true` 要求 `sse.enabled=true`，`websocket-enabled=true` 要求 `websocket.enabled=true`。任一组合不一致均在启动期明确失败。
- `DefaultPushService` 每个通道独立尝试并返回 `PushResult.outcomes`：`disabled`、`channel_unavailable`、`no_recipients`、`published`、`offline` 或 `failed`；一条通道失败不跳过另一条。`channels()` 仅列已发布通道。日志包含 correlation ID、message ID、接收人数、通道、分类、连接状态及安全异常类别，不记录正文、用户列表或异常 message。
- `published` 只证明发布调用完成，不代表客户端收到，连接状态记 `unknown`。WebSocket 无存活节点注册路由时记 `offline`；该判断受注册及心跳时效约束。SSE 跨节点连接未知，不通过逐用户远程探测冒充离线判断。通道接收端传递相同关联字段，客户端发送失败单独记录。
- `SysMessagePushListener` 保留 `AFTER_COMMIT` 与 `@Async`；关闭时记录 `disabled`，服务获取或调用异常记安全失败，均不反转已提交消息。事务和日志回归见 [生产边界验证](../../doc/production-verification.md)。

## 4. 边界

- Push 失败、用户离线或实时通道关闭不得回滚已经提交的消息。
- 本模块不接入 MQTT、厂商移动推送、邮件、短信、消息队列或 Elasticsearch。
- 新业务消息生产者应先落库并在事务提交后发布事件，不得在事务内直接依赖实时通道成功。
