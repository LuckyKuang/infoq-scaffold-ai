# infoq-plugin-jackson

## 1. 模块职责

统一 backend 的 Jackson 3 序列化、时间处理、大数值处理和 JSON 模式校验。

Spring Boot 4 MVC、业务 `JsonUtils` 与 Redis codec 全部使用 Jackson 3，不再保留 Jackson 2 数据绑定兼容层。

## 2. 关键入口

- [`Jackson3Customizer`](./src/main/java/cc/infoq/common/json/config/Jackson3Customizer.java)：统一的 `JsonMapperBuilderCustomizer`
- [`Jackson3BigNumberSerializer`](./src/main/java/cc/infoq/common/json/handler/Jackson3BigNumberSerializer.java)
- [`CustomDateDeserializer`](./src/main/java/cc/infoq/common/json/handler/CustomDateDeserializer.java)
- [`JsonUtils`](./src/main/java/cc/infoq/common/json/utils/JsonUtils.java)
- `JsonPattern`、`JsonPatternValidator`、`JsonType`：JSON 校验注解与校验器。

## 3. 核心类 / 文件

- 自动装配入口：[`AutoConfiguration.imports`](./src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports)
- 大数值、日期、未知字段和空 Bean 规则统一由 `Jackson3Customizer` 注册。

## 4. 上游依赖

- `web`、`redis`、`log`、`translation`、`excel`、`oss` 等多个插件直接依赖该模块。
- `sensitive` 只依赖 Jackson 3 API，不直接依赖本自动装配模块。
- `AuthController` 等业务代码也会直接调用 `JsonUtils`。

## 5. 下游依赖

- 编译期依赖 `infoq-core-common`。
- 运行时使用 Spring Boot 4 自动配置的 Jackson 3 `JsonMapper`。

## 6. 关键配置

- 当前模块没有独立配置前缀或开关。
- 只要模块在 classpath 上，`Jackson3Customizer` 就会进入自动装配。
- `spring.jackson.*` 配置与 `Jackson3Customizer` 共同作用于同一套 Jackson 3 `JsonMapper`。

## 7. 关键数据流

1. Spring Boot 4 构建 Jackson 3 `JsonMapper`，`Jackson3Customizer` 注册大数值、日期、未知字段和空 Bean 规则。
2. MVC 请求/响应、业务 `JsonUtils` 与 Redis codec 全部复用 Jackson 3。
3. 大数值、日期和 JSON 校验规则在以上链路保持一致。

## 8. 扩展点

- 可继续新增 Jackson 3 `ValueSerializer`、`ValueDeserializer` 和校验注解。

## 9. 日志 / 监控切入点

- 该模块本身没有监控接口。
- 当请求体 JSON 结构异常或时间解析异常时，常会从这里的序列化规则开始排查。

## 10. 已知边界

- 只处理 JSON 相关语义，不处理权限、缓存或业务逻辑。
- 项目模块的 JSON 数据绑定统一使用 Jackson 3；禁止在业务模块直接引入 Jackson 2 `databind`/`core`/`datatype`。
- 例外：Springdoc/Swagger 的 `swagger-core` 仍传递 Jackson 2，仅用于 OpenAPI 文档内部，不参与业务 JSON；若要求依赖树零 Jackson 2，需要移除或替换 Springdoc。
