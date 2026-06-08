# 插件矩阵（速查）

## 固定基座插件

- `infoq-plugin-web`
- `infoq-plugin-security`
- `infoq-plugin-satoken`
- `infoq-plugin-mybatis`
- `infoq-plugin-redis`
- `infoq-plugin-jackson`
- `infoq-plugin-oss`（由项目决策固定）

## 可复用通用插件

- `infoq-plugin-translation`
- `infoq-plugin-sensitive`
- `infoq-plugin-excel`
- `infoq-plugin-log`

使用模式：
- 保持插件实现可复用。
- 业务模块通过在自身 `pom.xml` 中加依赖按需接入。

## 可配置（软开关）插件

- `infoq-plugin-encrypt`
- `infoq-plugin-mail`
- `infoq-plugin-sse`
- `infoq-plugin-websocket`
- `infoq-plugin-doc`

默认策略：
- 依赖可保留，默认通过后端配置关闭。
- 涉及客户端行为时同步提供前端 env 开关。

## 开关键

后端：
- `api-decrypt.enabled`
- `mybatis-encryptor.enable`
- `mail.enabled`
- `sse.enabled`
- `websocket.enabled`
- `springdoc.api-docs.enabled`

前端：
- `VITE_APP_ENCRYPT`
- `VITE_APP_SSE`
- `VITE_APP_WEBSOCKET`
