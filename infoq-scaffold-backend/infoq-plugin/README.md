# infoq-plugin

## 1. 模块定位

`infoq-plugin` 是 backend 的横切基础设施父层，负责聚合 Web、安全、Redis、MyBatis、日志、文档、加解密、SSE、WebSocket、Quartz、OSS、Excel、翻译、脱敏等能力。

## 2. 子模块清单

| 子模块 | 形态 | 主要职责 |
| --- | --- | --- |
| [`infoq-plugin-web`](./infoq-plugin-web/README.md) | 自动装配 | Web 基础配置、异常处理、XSS、验证码、静态资源、Undertow |
| [`infoq-plugin-security`](./infoq-plugin-security/README.md) | 自动装配 | Spring Security 鉴权、JWT token、在线会话与健康检查路径放行 |
| [`infoq-plugin-redis`](./infoq-plugin-redis/README.md) | 自动装配 | Redisson、缓存、防重、限流、序列号 |
| [`infoq-plugin-mybatis`](./infoq-plugin-mybatis/README.md) | 自动装配 | MyBatis-Plus、多数据源、分页、数据权限、审计元字段 |
| [`infoq-plugin-doc`](./infoq-plugin-doc/README.md) | 自动装配 | Springdoc OpenAPI |
| [`infoq-plugin-encrypt`](./infoq-plugin-encrypt/README.md) | 自动装配 | API 请求解密、字段加解密、MyBatis 加解密拦截 |
| [`infoq-plugin-log`](./infoq-plugin-log/README.md) | 自动装配 | `@Log` 切面、登录/操作日志事件 |
| [`infoq-plugin-mail`](./infoq-plugin-mail/README.md) | 自动装配 | 邮件配置与发送工具 |
| [`infoq-plugin-quartz`](./infoq-plugin-quartz/README.md) | 自动装配 | Quartz 托管任务调度 |
| [`infoq-plugin-sse`](./infoq-plugin-sse/README.md) | 自动装配 | SSE 控制器、Emitter 管理、Redis topic 监听 |
| [`infoq-plugin-websocket`](./infoq-plugin-websocket/README.md) | 自动装配 | WebSocket 端点、会话管理、集群广播 |
| [`infoq-plugin-push`](./infoq-plugin-push/README.md) | 条件自动装配 | 关闭态默认的实时 Push 契约、通道选择和提交后提醒 |
| [`infoq-plugin-jackson`](./infoq-plugin-jackson/README.md) | 自动装配 | Jackson 序列化与 JSON 校验 |
| [`infoq-plugin-translation`](./infoq-plugin-translation/README.md) | 自动装配 | 返回值翻译与字典/用户/部门/OSS 名称补全 |
| [`infoq-plugin-oss`](./infoq-plugin-oss/README.md) | 库模块 | OSS 客户端与工厂 |
| [`infoq-plugin-excel`](./infoq-plugin-excel/README.md) | 库模块 | Excel 导入导出注解、监听器、转换器、工具 |
| [`infoq-plugin-sensitive`](./infoq-plugin-sensitive/README.md) | 库模块 | 字段脱敏注解与 Jackson 序列化处理 |

## 3. 子模块职责摘要

- 自动装配型插件通过 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` 进入 Spring Boot 运行时。
- 库模块没有独立自动装配入口，通常由 `infoq-system`、`infoq-core-data` 或其他插件直接调用。

## 4. 依赖方向

- 基础依赖层常见组合是 `core-common -> jackson -> redis/security/web/mybatis`。
- `infoq-system` 按业务需要依赖 `oss`、`security`、`web`、`doc`、`encrypt`、`sse`、`push`、`quartz`、`mail`、`websocket`。
- `infoq-core-data` 则在数据层直接接入 `mybatis`、`log`、`sensitive`、`translation`、`excel`、`jackson`。

## 5. 典型调用链

1. `infoq-admin` 启动 Spring Boot。
2. 自动装配型插件先注册容器级能力，例如 Web、鉴权、缓存、MyBatis、日志、OpenAPI。
3. `infoq-system` Controller / Service 在业务流里调用这些能力。
4. 库型插件如 `oss`、`excel`、`sensitive` 再被业务层或数据层直接引用。

## 6. 公共约束

- 不是所有插件都意味着“开关式 runtime feature”；有些只是代码库模块。
- 插件是否真正生效，要同时看依赖声明、自动装配入口和配置开关。
- Redis 相关能力必须保持 Redisson OSS 兼容，不引入 PRO-only API。

## 7. 已知边界

- 本文档只做聚合，不代替每个插件的叶子模块真值文档。
- 某条插件链路若未被源码直接证实，应该回退为“当前实现说明”，不要在这里做跨模块脑补。

## 8. 下钻阅读路径

1. 先判断目标插件是自动装配型还是库模块。
2. 再进入对应叶子 README 查看职责、开关、入口、依赖和边界。
3. 最终若要理解业务接线，回到 [`../infoq-modules/infoq-system/README.md`](../infoq-modules/infoq-system/README.md)。

