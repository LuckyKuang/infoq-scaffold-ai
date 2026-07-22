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
- 当前 `DefaultPushService` 只在传输边界映射接收人用户 ID，并记录 correlation ID、message ID、通道、接收人数、结果和失败类别。消息正文与事件业务 payload 不进入日志。

## 4. 边界

- Push 失败、用户离线或实时通道关闭不得回滚已经提交的消息。
- 本模块不接入 MQTT、厂商移动推送、邮件、短信、消息队列或 Elasticsearch。
- 新业务消息生产者应先落库并在事务提交后发布事件，不得在事务内直接依赖实时通道成功。
