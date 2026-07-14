# infoq-scaffold-backend

这份 README 只描述 `infoq-scaffold-backend` 当前仓库实现，不试图抽象成一套通用架构蓝图。

如果后续代码结构继续演进，应优先以源码为准，再回写本文档。

## 当前实现概览

`infoq-scaffold-backend` 是一个 Maven 多模块 Spring Boot 后端，启动入口在 `infoq-admin`，业务主体在 `infoq-modules/infoq-system`，公共类型与数据访问定义分别落在 `infoq-core-common`、`infoq-core-data`，横切基础设施通过 `infoq-plugin/*` 自动装配。

当前代码直接体现出的几个核心事实：

- 启动入口是 [SysAdminApplication](./infoq-admin/src/main/java/cc/infoq/admin/SysAdminApplication.java)，`scanBasePackages = "cc.infoq"` 会把 admin、system、core、plugin 全部纳入同一个 Spring 容器。
- 对外控制器集中在 `infoq-system`，按目录分成 `controller/login`、`controller/system`、`controller/monitor` 三组。
- 持久化主干是 MyBatis-Plus + Mapper XML，实体、VO、Mapper 与 XML 主要在 `infoq-core-data`。
- 认证主干是 Spring Security + JWT access token + Redis session / revocation / online index，登录时会把 `clientId` 写入 token session，后续请求再由安全过滤器做一致性校验。
- Redis 参与验证码、登录失败计数、在线用户、限流、防重提交和若干缓存组。
- 配置按 `application.yml + application-{dev,prod,local}.yml` 叠加：
  - `application.yml` 承载通用运行时行为配置，包括 Undertow、captcha、Spring Security token、`api-decrypt`、SpringDoc、SSE、WebSocket、`infoq.quartz`、MyBatis-Plus、Jackson、XSS、lock4j、security excludes 等。
  - `application-dev.yml` 是默认激活 profile，主要补充/覆写 datasource、Redis、Redisson、Quartz 开发环境差异、`infoq.quartz.bootstrap` 和 mail。
  - `application-prod.yml` 补充/覆写 datasource、Redis、Redisson、Quartz 生产环境差异、`infoq.quartz.bootstrap`、graceful shutdown 和 mail；`application-local.yml` 补充/覆写 datasource、Redis、Redisson、mail，但不重写 Quartz。
- 第三方身份、微信小程序登录、实时 Push 与消息清理均是关闭态默认能力：`infoq.auth.wechat-miniapp.enabled=false`、`infoq.push.enabled=false`、`infoq.message.cleanup.enabled=false`；启用微信登录必须同时提供部署侧 AppID/Secret 并启用 Provider，启用 Push 必须显式选择已开启的 SSE 或 WebSocket 通道。

## 模块导航

| 模块 | 当前职责 | 主要证据 |
| --- | --- | --- |
| `infoq-admin` | 启动、打包、对外 API 聚合 | `infoq-admin/pom.xml`、`SysAdminApplication` |
| `infoq-core/infoq-core-bom` | 统一 core 与 plugin 依赖版本坐标 | `infoq-core/infoq-core-bom/pom.xml` |
| `infoq-modules/infoq-system` | 登录、身份关系、个人消息、系统管理、监控接口与业务服务实现 | `controller/*`、`service/impl/*` |
| `infoq-core/infoq-core-common` | 常量、DTO、异常、工具类、线程池/校验等基础配置 | `common/constant/*`、`common/config/*` |
| `infoq-core/infoq-core-data` | 实体、BO/VO、Mapper、Mapper XML | `system/domain/*`、`system/mapper/*`、`resources/mapper/system/*` |
| `infoq-plugin/*` | Web、安全、Redis、MyBatis、日志、文档、加解密、SSE、Push、Quartz、OSS 等横切能力 | `infoq-plugin/pom.xml` 与各插件配置类 |

## 模块下钻文档

- [`infoq-admin/README.md`](./infoq-admin/README.md)：启动入口、profile 资源、打包边界。
- [`infoq-core/README.md`](./infoq-core/README.md)：`bom/common/data` 三层职责与依赖方向。
- [`infoq-modules/README.md`](./infoq-modules/README.md)：当前业务模块聚合与下钻路径。
- [`infoq-plugin/README.md`](./infoq-plugin/README.md)：插件矩阵、自动装配型插件与库型插件的区别，以及各叶子插件 README 入口。

如果需要继续下钻，优先从上面四份聚合文档进入，再进入对应叶子模块 README，而不是直接靠目录名猜模块职责。

## 建议阅读顺序

1. [doc/README.md](./doc/README.md)
   先看 backend 文档导航和主题下钻路径。
2. [doc/architecture.md](./doc/architecture.md)
   再看模块边界、装配关系、安全与异常处理。
3. [doc/data-flow.md](./doc/data-flow.md)
   最后看登录、菜单路由、用户 CRUD、日志监控这些真实链路。

## 源码入口

- 启动与基础配置：
  [infoq-admin/src/main/java/cc/infoq/admin/SysAdminApplication.java](./infoq-admin/src/main/java/cc/infoq/admin/SysAdminApplication.java)
  [infoq-admin/src/main/resources/application.yml](./infoq-admin/src/main/resources/application.yml)
  [infoq-admin/src/main/resources/application-dev.yml](./infoq-admin/src/main/resources/application-dev.yml)
  [infoq-admin/src/main/resources/application-prod.yml](./infoq-admin/src/main/resources/application-prod.yml)
  [infoq-admin/src/main/resources/application-local.yml](./infoq-admin/src/main/resources/application-local.yml)
  [infoq-admin/src/main/resources/logback-plus.xml](./infoq-admin/src/main/resources/logback-plus.xml)
- 认证与首页：
  [AuthController](./infoq-modules/infoq-system/src/main/java/cc/infoq/system/controller/login/AuthController.java)
  [CaptchaController](./infoq-modules/infoq-system/src/main/java/cc/infoq/system/controller/login/CaptchaController.java)
  [IndexController](./infoq-modules/infoq-system/src/main/java/cc/infoq/system/controller/login/IndexController.java)
  [CryptoFilter](./infoq-plugin/infoq-plugin-encrypt/src/main/java/cc/infoq/common/encrypt/filter/CryptoFilter.java)
- 权限与菜单：
  [SecurityConfig](./infoq-plugin/infoq-plugin-security/src/main/java/cc/infoq/common/security/config/SecurityConfig.java)
  [SpringSecurityAutoConfiguration](./infoq-plugin/infoq-plugin-security/src/main/java/cc/infoq/common/security/config/SpringSecurityAutoConfiguration.java)
  [SecurityTokenService](./infoq-plugin/infoq-plugin-security/src/main/java/cc/infoq/common/security/auth/SecurityTokenService.java)
  [SysMenuController](./infoq-modules/infoq-system/src/main/java/cc/infoq/system/controller/system/SysMenuController.java)
  [SysMenuServiceImpl](./infoq-modules/infoq-system/src/main/java/cc/infoq/system/service/impl/SysMenuServiceImpl.java)
- 用户与审计：
  [SysUserController](./infoq-modules/infoq-system/src/main/java/cc/infoq/system/controller/system/SysUserController.java)
  [SysUserServiceImpl](./infoq-modules/infoq-system/src/main/java/cc/infoq/system/service/impl/SysUserServiceImpl.java)
  [LogAspect](./infoq-plugin/infoq-plugin-log/src/main/java/cc/infoq/common/log/aspect/LogAspect.java)
  [SysLoginInfoServiceImpl](./infoq-modules/infoq-system/src/main/java/cc/infoq/system/service/impl/SysLoginInfoServiceImpl.java)
  [SysOperLogServiceImpl](./infoq-modules/infoq-system/src/main/java/cc/infoq/system/service/impl/SysOperLogServiceImpl.java)
- 身份关系与个人消息：
  [SysOauthIdentityController](./infoq-modules/infoq-system/src/main/java/cc/infoq/system/controller/system/SysOauthIdentityController.java)
  [WechatMiniAppAuthStrategy](./infoq-modules/infoq-system/src/main/java/cc/infoq/system/service/impl/WechatMiniAppAuthStrategy.java)
  [SysMessageController](./infoq-modules/infoq-system/src/main/java/cc/infoq/system/controller/system/SysMessageController.java)
  [SysMessagePushListener](./infoq-modules/infoq-system/src/main/java/cc/infoq/system/listener/SysMessagePushListener.java)

## 当前实现提醒

- 这里的“插件”是当前仓库内的模块化基础设施，不等于一定在运行时全量启用。
- 对可选链路，本文档只记录代码里已经能直接确认的状态：`application-dev.yml`、`application-prod.yml`、`application-local.yml` 均显式设置 `mail.enabled=false`；`application.yml` 中 `sse.enabled=true`、`websocket.enabled=false`。
- 个人消息盒子使用 MySQL 作为正文和接收人状态真值。实时事件只用于提示客户端刷新，Push 关闭、用户离线或实时通道失败均不得影响消息已提交的读取、已读和软删除操作。
- 如果你要改动登录、权限、Redis、Quartz、日志或 Mapper XML，建议先把上面两份文档看完再动手。
