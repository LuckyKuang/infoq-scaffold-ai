# infoq-plugin-jackson

## 1. 模块职责

统一 backend 的 Jackson 序列化、时间反序列化、大数值处理和 JSON 模式校验。

## 2. 关键入口

- [`JacksonConfig`](./src/main/java/cc/infoq/common/json/config/JacksonConfig.java)
- [`JsonUtils`](./src/main/java/cc/infoq/common/json/utils/JsonUtils.java)
- [`BigNumberSerializer`](./src/main/java/cc/infoq/common/json/handler/BigNumberSerializer.java)
- [`CustomDateDeserializer`](./src/main/java/cc/infoq/common/json/handler/CustomDateDeserializer.java)

## 3. 核心类 / 文件

- `JsonPattern`、`JsonPatternValidator`、`JsonType`：JSON 校验注解与校验器。
- 自动装配入口：[`AutoConfiguration.imports`](./src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports)

## 4. 上游依赖

- `web`、`redis`、`log`、`translation`、`excel`、`oss` 等多个插件直接依赖该模块。
- `sensitive` 只依赖 Jackson API，不直接依赖本自动装配模块。
- `AuthController` 等业务代码也会直接调用 `JsonUtils`。

## 5. 下游依赖

- 编译期依赖 `infoq-core-common`。

## 6. 关键配置

- 当前模块没有独立配置前缀或开关。
- 只要模块在 classpath 上，`JacksonConfig` 就会进入自动装配。

## 7. 关键数据流

1. Spring Boot 启动时装配自定义 ObjectMapper 行为。
2. 请求体解析、响应序列化、Redis JSON 编码等链路共用这些规则。
3. 大数值和时间类型按模块定义输出或解析。

## 8. 扩展点

- 可继续新增自定义序列化器、反序列化器和验证注解。

## 9. 日志 / 监控切入点

- 该模块本身没有监控接口。
- 当请求体 JSON 结构异常或时间解析异常时，常会从这里的序列化规则开始排查。

## 10. 已知边界

- 只处理 JSON 相关语义，不处理权限、缓存或业务逻辑。

