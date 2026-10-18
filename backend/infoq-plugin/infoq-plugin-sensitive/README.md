# infoq-plugin-sensitive

## 1. 模块职责

提供字段脱敏注解、脱敏策略接口和 Jackson 序列化处理器，属于库型模块。

## 2. 关键入口

- [`Sensitive`](./src/main/java/cc/infoq/common/sensitive/annotation/Sensitive.java)
- [`SensitiveService`](./src/main/java/cc/infoq/common/sensitive/core/SensitiveService.java)
- [`SensitiveStrategy`](./src/main/java/cc/infoq/common/sensitive/core/SensitiveStrategy.java)
- [`SensitiveHandler`](./src/main/java/cc/infoq/common/sensitive/handler/SensitiveHandler.java)

## 3. 核心类 / 文件

- `SensitiveHandler`：按注解上下文决定是否对字符串做脱敏输出。

## 4. 上游依赖

- `infoq-core-data` 直接依赖这个模块，说明部分返回对象字段已具备脱敏语义。
- 业务层可通过实现 `SensitiveService` 决定是否有权限看明文。

## 5. 下游依赖

- 编译期依赖 `infoq-core-common`、`jackson-databind`、`hutool-core` 和 `lombok`。
- 该模块只依赖 Jackson API，不依赖 `infoq-plugin-jackson` 自动装配模块。

## 6. 关键配置

- 当前模块没有独立配置前缀或自动装配开关。
- 是否生效取决于字段注解与 `SensitiveService` 实现。

## 7. 关键数据流

1. 返回对象字段带 `@Sensitive`。
2. Jackson 序列化时进入 `SensitiveHandler`。
3. `SensitiveHandler` 读取 `SensitiveService` 判断是否需要脱敏。

## 8. 扩展点

- `SensitiveStrategy`
- `SensitiveService`

## 9. 日志 / 监控切入点

- 当前模块没有独立监控接口。
- 若脱敏结果异常，应先检查注解、策略和 `SensitiveService` 实现。

## 10. 已知边界

- 这是库模块，不会自动提供 API 或配置开关。
- 它只处理输出脱敏，不负责数据权限查询本身。

