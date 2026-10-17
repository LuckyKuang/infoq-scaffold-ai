# infoq-plugin-doc

## 1. 模块职责

提供 Springdoc OpenAPI 文档能力，把 backend 当前暴露的接口整理成可访问的 API 文档。

## 2. 关键入口

- [`SpringDocConfig`](./src/main/java/cc/infoq/common/doc/config/SpringDocConfig.java)
- [`SpringDocProperties`](./src/main/java/cc/infoq/common/doc/config/properties/SpringDocProperties.java)
- [`OpenApiHandler`](./src/main/java/cc/infoq/common/doc/handler/OpenApiHandler.java)
- 自动装配入口：[`AutoConfiguration.imports`](./src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports)

## 3. 核心类 / 文件

- `SpringDocConfig`：文档自动配置主入口。
- `SpringDocProperties`：`springdoc` 前缀配置承载类。
- `OpenApiHandler`：OpenAPI 输出相关处理。

## 4. 上游依赖

- `infoq-system` 通过编译依赖把文档能力带入业务模块。

## 5. 下游依赖

- 编译期依赖 `infoq-core-common`。

## 6. 关键配置

- `springdoc.api-docs.enabled`
- `springdoc.*`

## 7. 关键数据流

1. Spring Boot 启动时加载 `SpringDocConfig`。
2. 当 `springdoc.api-docs.enabled=true` 时，文档相关 Bean 生效。
3. 已注册的控制器接口被聚合成 OpenAPI 输出。

## 8. 扩展点

- 可通过 `springdoc.*` 配置继续调整文档展示细节。

## 9. 日志 / 监控切入点

- 该模块本身没有独立监控控制器。
- API 文档是否可访问，可作为接口暴露面的辅助检查点。

## 10. 已知边界

- 只提供文档能力，不负责鉴权、业务路由或接口实现。

