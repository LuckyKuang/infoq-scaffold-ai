# infoq-plugin-mqtt

## 1. 模块定位

`infoq-plugin-mqtt` 提供 MQTT 3.1.1 与 MQTT 5 的中性发布、订阅和状态契约。业务模块只依赖 `MqttPublisher`、`MqttPublishCommand`、`MqttInboundMessage` 和 `MqttMessageHandler`，不引用 Paho 类型。

## 2. 配置与失败语义

```yaml
infoq:
  mqtt:
    enabled: false
    required: false
    v3:
      enabled: false
    v5:
      enabled: false
```

- 总开关关闭时不创建客户端、连接、订阅、重连线程或健康探测；发布接口返回明确的未启用错误。
- v3 与 v5 使用独立 URI、Client ID、认证、TLS、订阅、QoS 和超时配置；两个协议即使连接同一 Broker 也必须使用不同 Client ID。
- 发布请求必须显式选择协议。指定协议关闭或不可用时不会自动降级到另一协议。
- 协议只有在连接并完成配置订阅后才可发布。订阅失败会关闭该协议客户端；`required=true` 阻止应用启动并关闭已创建客户端，`required=false` 允许主应用继续运行但发布明确返回不可用。

## 3. 边界

- Broker 由独立基础设施部署，本模块不嵌入 Broker，也不提供 Broker compose 或账号 ACL。
- MQTT 5 特有属性仅适用于 `V5`，不会降级映射为 MQTT 3.1.1 行为；user property 以有序列表保存，重复 key 不会被静默合并。
- 不记录 payload、凭据或 TLS 材料；状态只包含协议、连接结果、失败类别、计数与发布/消费耗时。
- MQTT 3.1.1 支持 `tcp://`、`ssl://`、`ws://` 和 `wss://`；MQTT 5 只支持 `tcp://` 与 `ssl://`。`tls-enabled` 必须与 URI 的传输安全性匹配，URI 不得携带凭据、查询参数或片段。证书校验使用 JVM 默认 trust store。本轮不提供信任所有证书或内嵌 TLS 材料的配置。
- 两个协议均使用内存持久化并显式 clean session/start：重启后不会恢复 QoS 1/2 的在途消息或持久会话，也不会在主机留下 Paho 文件状态。
- `MqttPublishCommand` 没有独立 correlation 字段；需要 MQTT 5 关联数据时，必须使用 `MqttV5Properties.correlationData`，其值不会写入日志。
