# infoq-plugin-log

## 1. 模块职责

提供操作日志与登录日志的切面入口，通过事件把日志语义传递给业务层或持久化层。

## 2. 关键入口

- [`Log`](./src/main/java/cc/infoq/common/log/annotation/Log.java)
- [`LogAspect`](./src/main/java/cc/infoq/common/log/aspect/LogAspect.java)
- [`LoginInfoEvent`](./src/main/java/cc/infoq/common/log/event/LoginInfoEvent.java)
- [`OperLogEvent`](./src/main/java/cc/infoq/common/log/event/OperLogEvent.java)

## 3. 核心类 / 文件

- `BusinessType`、`BusinessStatus`、`OperatorType`：日志语义枚举。
- 自动装配入口：[`AutoConfiguration.imports`](./src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports)

## 4. 上游依赖

- `infoq-system` 的登录、用户、角色、菜单、监控等业务接口可通过 `@Log` 接入。

## 5. 下游依赖

- 编译期依赖 `infoq-plugin-security` 与 `infoq-plugin-jackson`。

## 6. 关键配置

- 当前模块没有独立配置前缀或显式启停开关。
- 是否真正记录某条业务日志，取决于调用点是否使用 `@Log` 或显式发布日志事件。

## 7. 关键数据流

1. Controller 或 Service 方法被 `@Log` 标注。
2. `LogAspect` 在调用前后收集业务上下文。
3. 生成 `OperLogEvent` 或 `LoginInfoEvent`，再交由下游持久化处理。

## 8. 扩展点

- 新的业务日志类型可通过扩展枚举或新增事件消费者实现。

## 9. 日志 / 监控切入点

- 这是 backend 操作日志和登录日志的代码入口之一。
- 真正的日志查询接口与持久化在 `infoq-system` 中。

## 10. 已知边界

- 只负责日志切面与事件，不直接实现日志页面或查询接口。

