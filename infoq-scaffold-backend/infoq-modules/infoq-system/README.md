# infoq-system

## 1. 模块职责

`infoq-system` 是当前 backend 唯一的业务模块，承载登录注册、系统管理、监控与调度相关的 Controller 和 Service 实现。

## 2. 关键入口

- 登录入口：[`controller/login/AuthController`](./src/main/java/cc/infoq/system/controller/login/AuthController.java)、[`CaptchaController`](./src/main/java/cc/infoq/system/controller/login/CaptchaController.java)、[`IndexController`](./src/main/java/cc/infoq/system/controller/login/IndexController.java)
- 系统管理入口：[`controller/system`](./src/main/java/cc/infoq/system/controller/system)
- 监控入口：[`controller/monitor`](./src/main/java/cc/infoq/system/controller/monitor)
- 业务实现：[`service/impl`](./src/main/java/cc/infoq/system/service/impl)
- 运行 runner：[`runner`](./src/main/java/cc/infoq/system/runner)
- 事件监听：[`listener`](./src/main/java/cc/infoq/system/listener)

## 3. 核心类 / 文件

- 认证：`AuthStrategy`、`PasswordAuthStrategy`、`EmailAuthStrategy`、`WechatMiniAppAuthStrategy`、`SysLoginServiceImpl`
- 身份关系：`SysOauthIdentityController`、`SysOauthIdentityServiceImpl`、`SysOauthLoginServiceImpl`；绑定只接受后端签发的一次性 ticket，解绑由当前登录用户和最后凭证规则共同校验
- 消息盒子：`SysMessageController`、`SysMessageServiceImpl`、`SysMessagePushListener`、`SysMessageCleanupTaskHandler`；`SysNoticeServiceImpl` 在公告事务内批量创建接收人记录，Push 仅在提交后异步尝试
- 用户与权限：`SysUserServiceImpl`、`SysRoleServiceImpl`、`SysMenuServiceImpl`、`SysPermissionServiceImpl`
- 参数配置：`SysConfigServiceImpl` 负责 `configKey -> configValue` 读取、类型化配置面板、恢复默认、排序和账号敏感配置保护
- 监控：`ServerMonitorServiceImpl`、`DataSourceMonitorServiceImpl`
- 调度：`SchedulerApplicationRunner`、`QuartzBootstrapCoordinator`、`SysJobServiceImpl`
- 插件桥接：`OptionalMailHelper`、`OptionalSseHelper`

## 4. 上游依赖

- `infoq-admin` 启动后直接扫描并暴露这里的 Controller。
- 前端管理端和小程序端主要调用这里提供的登录、菜单、用户、监控等接口。

## 5. 下游依赖

- 数据层：`infoq-core-data` 的 Entity、Bo、Vo、Mapper、XML
- 公共层：`infoq-core-common` 的异常、工具、DTO、服务契约
- 插件层：`oss`、`security`、`web`、`doc`、`encrypt`、`sse`、`push`、`quartz`、`mail`、`websocket`、`mqtt`、`elasticsearch`

## 6. 关键配置

- `AuthController` 登录时要求请求体能解析出 `clientId` 与 `grantType`。
- `grantType=miniapp` 仅在 `infoq.auth.wechat-miniapp.enabled=true` 时注册；策略启动时校验 AppID、Secret 和 session endpoint，关闭时不创建 HTTP 客户端也不发起远端调用。
- `SysConfigController` 的配置中心接口继续保留旧列表/导出语义，同时新增 `panel`、`resetByKey`、`reorder`；`configType` 仍表示是否系统内置，值类型由 `valueType` 表达。
- Quartz 相关 runner、Controller 和部分任务处理通过 `infoq.quartz.enabled` 控制是否装配。
- 登录成功后会经 `OptionalSseHelper` 延迟推送欢迎消息，是否真正推送取决于 SSE 能力是否开启。
- `infoq.push.enabled=false` 时没有 PushService；启用后必须同时启用至少一个底层通道，并与 `sse.enabled` / `websocket.enabled` 一致。消息清理由默认暂停的 `system.message.cleanup` Quartz 任务触发，且还要求 `infoq.message.cleanup.enabled=true`。

## 7. 关键数据流

1. 请求从 `controller/login`、`controller/system`、`controller/monitor` 进入。
2. Service 实现调用 `infoq-core-data` 的 Mapper 和域对象。
3. 安全、加密、日志、缓存、监控等横切语义由插件层介入。
4. 结果再组装成 `Vo` 返回前端，或进入 Quartz / SSE / WebSocket / Push / mail 等外部链路。

## 8. 扩展点

- 认证策略通过 `AuthStrategy` 与具体 `*AuthStrategy` 实现扩展；微信小程序策略固定复用 OAuth identity，不新增平行社交表。
- Quartz 启动与调度行为通过 `runner/*` 和任务处理器扩展。
- 可选插件通过 `OptionalMailHelper`、`OptionalSseHelper` 与关闭态的 `PushService` 以保守方式接线。

## 9. 日志 / 监控切入点

- 登录日志、操作日志、在线用户、任务日志、缓存、服务监控、数据源监控均在当前模块内提供控制器或服务。
- 运行时审计与日志记录由 `infoq-plugin-log`、`infoq-plugin-web`、`infoq-plugin-security` 等插件配合完成。
- `/monitor/health/optional` 只返回当前已装配的 MQTT、Elasticsearch 等可选 provider 的内存状态快照；关闭态 MQTT 与 Elasticsearch 均不注册 provider，因此不会出现在该响应中。该端点不探测外部服务，也不改变数据库/Redis 的 `/monitor/health/readiness` 结果。

## 10. 已知边界

- 当前只有一个业务模块，因此这里既承载系统管理也承载监控接口。
- 插件真实是否启用，仍要以运行配置和插件文档为准，不能仅凭这里的依赖声明做结论。
