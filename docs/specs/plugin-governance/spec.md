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
- 并且必须继续把 `encrypt`、`mail`、`sse`、`websocket`、`doc` 视为可配置插件

### 要求：软开关策略
可配置插件必须保持“依赖保留、配置控开关”的治理方式。

#### 场景：启停可配置插件

- 当维护者启停 `encrypt`、`mail`、`sse`、`websocket` 或 `doc` 时
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
