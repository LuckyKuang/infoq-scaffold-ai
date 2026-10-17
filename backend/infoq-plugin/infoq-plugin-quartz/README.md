# infoq-plugin-quartz

## 1. 模块职责

提供 Quartz 托管任务的自动装配、任务分发和任务键构建能力。

## 2. 关键入口

- [`QuartzAutoConfiguration`](./src/main/java/cc/infoq/common/quartz/config/QuartzAutoConfiguration.java)
- [`QuartzManagedProperties`](./src/main/java/cc/infoq/common/quartz/properties/QuartzManagedProperties.java)
- `ManagedQuartzTaskDispatcher` / `ManagedQuartzTaskDispatcherImpl`
- `ManagedQuartzJob*`

## 3. 核心类 / 文件

- `ManagedQuartzKeyBuilder`：任务 key 组织
- `ManagedQuartzTaskHandler`：任务处理抽象
- 自动装配入口：[`AutoConfiguration.imports`](./src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports)

## 4. 上游依赖

- `infoq-system` 的 `SchedulerApplicationRunner`、`SysJobController`、`SysJobServiceImpl` 等调度相关逻辑直接受该模块影响。

## 5. 下游依赖

- 编译期依赖 `infoq-core-common`、`infoq-plugin-jackson`

## 6. 关键配置

- `infoq.quartz.enabled`
- `infoq.quartz.*`

## 7. 关键数据流

1. 启动时检查 `infoq.quartz.enabled`。
2. 开启后装配 Quartz 相关 Bean 和属性。
3. `infoq-system` 的 runner 与任务服务调用这里的调度分发能力。

## 8. 扩展点

- `ManagedQuartzTaskHandler`
- `ManagedQuartzTaskDispatcher`

## 9. 日志 / 监控切入点

- Quartz 是否启用会直接影响任务控制器和 runner 是否生效。
- 任务日志查询接口在 `infoq-system`，调度基础设施在本模块。

## 10. 已知边界

- 该模块只负责调度基础设施，不定义具体业务任务内容。

