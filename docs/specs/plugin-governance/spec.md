# 插件治理规范

## 目标

定义当前仓库插件分档、软开关策略、硬删除守则，以及 OSS / Redis 相关治理护栏。

## 要求

### 要求：插件分档
插件必须继续按“固定保留 / 通用复用 / 可配置软开关”治理。

#### 场景：维护插件目录

- 当维护者调整插件依赖或文档时
- 则必须继续把 `infoq-plugin-web`、`infoq-plugin-security`、`infoq-plugin-mybatis`、`infoq-plugin-redis`、`infoq-plugin-jackson`、`infoq-plugin-oss` 视为固定保留
- 并且必须继续把 `translation`、`sensitive`、`excel`、`log` 视为通用复用插件
- 并且必须继续把 `encrypt`、`mail`、`sse`、`websocket`、`doc`、`quartz`、`oauth`、`push`、`mqtt`、`elasticsearch` 视为可配置插件

### 要求：软开关策略
可配置插件必须保持“依赖保留、配置控开关”的治理方式。

#### 场景：启停可配置插件

- 当维护者启停上述可配置插件时
- 则必须保留对应依赖
- 并且必须通过配置键控制启停
- 并且 `encrypt`、`sse`、`websocket` 的前后端开关必须同步调整

#### 场景：沿用当前默认值

- 当仓库按当前默认配置运行时
- 则 `api-decrypt.enabled` 必须默认为 `true`
- 并且 `sse.enabled` 必须默认为 `true`
- 并且 `websocket.enabled` 必须默认为 `false`
- 并且 `mail.enabled` 必须默认为 `false`
- 并且 `springdoc.api-docs.enabled` 必须默认为 `true`
- 并且 `infoq.quartz.enabled` 必须默认为 `true`
- 并且 `oauth.enabled`、`infoq.auth.wechat-miniapp.enabled`、`infoq.push.enabled`、`infoq.mqtt.enabled`、`infoq.elasticsearch.enabled` 必须默认为 `false`

关闭不等于所有配置 Bean 都消失：OAuth 协议 Bean 仍装配，业务入口按开关拒绝；MQTT 保留会显式返回未启用错误的 `MqttPublisher`，不创建客户端或健康 provider。Push 和 Elasticsearch 的条件自动配置关闭时不创建对应服务。开关组合依据 `application.yml`、各插件 `AutoConfiguration.imports` 和配置类；启用 Push 还要求选择并启用至少一种 SSE / WebSocket 通道。`mybatis-encryptor.enable` 与 API 请求解密是独立开关，当前默认 `false`。

### 要求：硬删除守则
只有在明确不再需要某插件时，才允许走硬删除。

#### 场景：硬删除插件

- 当维护者明确执行硬删除时
- 则必须同时清理依赖、调用代码、配置项和前端配套开关
- 并且必须执行编译与登录冒烟等验证

### 要求：OSS 与 Redis 护栏
固定基座插件和 Redis 能力必须继续遵守仓库级护栏。

#### 场景：调整 OSS 或 Redis 相关能力

- 当维护者调整 OSS 能力时
- 则 `infoq-plugin-oss` 不得被误删或降级为可选插件
- 并且涉及 Redis / 鉴权 token / 限流 / 缓存能力时，必须保持 Redisson OSS 兼容
