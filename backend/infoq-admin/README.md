# infoq-admin

## 1. 模块职责

`infoq-admin` 是 backend 的启动与打包入口，不承载独立业务逻辑。它负责把 `infoq-system`、`infoq-core/*`、`infoq-plugin/*` 通过 Spring Boot 启动类和 profile 资源装进同一个运行单元。

## 2. 关键入口

- 启动类：[`SysAdminApplication`](./src/main/java/cc/infoq/admin/SysAdminApplication.java)
- 构建入口：[`pom.xml`](./pom.xml)
- 受管 profile 资源：[`src/main/resources/application.yml`](./src/main/resources/application.yml)、[`application-dev.yml`](./src/main/resources/application-dev.yml)、[`application-prod.yml`](./src/main/resources/application-prod.yml)；`application-local.yml` 是可选、被 Git 忽略的本机覆盖文件。
- 日志配置：[`src/main/resources/logback-plus.xml`](./src/main/resources/logback-plus.xml)

## 3. 核心类 / 文件

- `SysAdminApplication`：`@SpringBootApplication(scanBasePackages = "cc.infoq")`，把 `cc.infoq` 下所有模块统一纳入 Spring 容器，并排除 `UserDetailsServiceAutoConfiguration`，避免 token 鉴权下生成默认内存用户。
- `application*.yml`：定义 profile 分层、数据源、Redis、Quartz、mail、SSE、WebSocket、Springdoc 等运行开关。
- `logback-plus.xml`：文件日志默认写到进程工作目录的 `../logs/`；从 `backend/` 启动时对应仓库根 `logs/`。从仓库根直接启动 jar 时应显式设置 `INFOQ_LOG_PATH`，容器也通过该变量覆盖。
- `banner.txt`、`i18n/*.properties`、`ip2region_v4.xdb`：启动展示、多语言消息与 IPv4 归属地内置资源。
- IPv6 归属地地址库不再打包进 `infoq-admin.jar`，部署源文件位于仓库根 [`deploy/docker/server/ip2region/ip2region_v6.xdb`](../../deploy/docker/server/ip2region/ip2region_v6.xdb)，运行时通过 `INFOQ_IP2REGION_V6_PATH` 指向外置挂载文件。

## 4. 上游依赖

- 开发、测试、部署命令最终都从 `infoq-admin` 启动 jar 或 package 产物。
- 根 `backend/pom.xml` 通过 Maven reactor 把它作为最终可运行模块。

## 5. 下游依赖

- 编译期直接依赖：`infoq-system`
- 运行期间接依赖：`infoq-system` 再拉起 `infoq-core/*` 与 `infoq-plugin/*`

## 6. 关键配置

- profile 叠加顺序以 `application.yml + application-{env}.yml` 为主。
- 当前 README 与顶层 AGENTS 已确认常见入口使用 `dev` / `local` / `prod` 三种 profile。
- 运行命令和打包命令以 [`../AGENTS.md`](../AGENTS.md) 中的 `Commands` 为准。

## 7. 关键数据流

1. 按 [`../AGENTS.md`](../AGENTS.md) 构建后，从仓库根执行 `java -jar backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=dev` 进入 `SysAdminApplication`；PATH 中的 `java` 必须为 JDK 21，日志目录按前述 `INFOQ_LOG_PATH` 设置。
2. Spring Boot 加载 `application*.yml` 与 classpath 中各插件的自动装配入口。
3. `scanBasePackages = "cc.infoq"` 让 `infoq-system` 控制器、服务、Mapper、插件配置全部进入同一应用上下文。
4. 对外 HTTP、SSE、WebSocket、Quartz 与健康检查能力最终都通过这个模块打包后的应用暴露。

## 8. 扩展点

- 通过新增 `application-{profile}.yml` 或补充现有 profile 配置扩展运行环境。
- 通过 `pom.xml` 调整最终打包依赖集合。

## 9. 日志 / 监控切入点

- `logback-plus.xml` 是日志输出真值入口；核对 `INFOQ_LOG_PATH` 与进程工作目录后确定实际文件日志目录。
- `application*.yml` 里的 Web、SSE、WebSocket 与监控相关配置会影响健康检查暴露方式。
- 具体监控接口实现仍在 `infoq-system` 与 `infoq-plugin-web` / `infoq-plugin-security`。

## 10. 已知边界

- 该模块只有一个 Java 源文件，不承载业务 Controller、Service、Mapper。
- 启动后真正的业务逻辑请继续下钻 [`../infoq-modules/infoq-system/README.md`](../infoq-modules/infoq-system/README.md)。

## 生产安全配置

浏览器恢复配置位于 `security.browser-session`，由 `INFOQ_DEPLOY_MODE`、`INFOQ_PUBLIC_BASE_URL` 和四个 `INFOQ_BROWSER_SESSION_*` 环境变量注入。prod profile 默认要求 production/HTTPS/Secure；显式 development 仍仅支持受控 HTTP loopback，不从代理 header 推测安全属性。部署端必须注入实际外部 `/prod-api/...` 或 `/dev-api/...` cookie Path，详见 [配置合同与验证 SOP](../doc/browser-session.md)。

`application-prod.yml` 为七个会话安全/Push logger 精确启用 INFO，保留其他业务 WARN。`ProductionObservabilityLoggingTest` 使用真实 prod 过滤配置及 Logback 验证同步/异步输出；它属于 prod 组，不能替代 dev 完整业务单测，CI/发布均分别执行两组。

prod 通过必需环境变量 `INFOQ_API_REQUEST_PRIVATE_KEY` 与 `INFOQ_API_RESPONSE_PUBLIC_KEY` 注入请求解密私钥和响应加密公钥；分别匹配前端请求公钥与响应私钥，不能当成同一组。启动期检查 RSA 格式与至少 2048 位，四方向配对/受控来源由生产预检完成。英文认证四键由真实 MessageSource 回归，详见 [后端生产边界回归](../doc/production-verification.md)。

Compose 后端构建 context 为 `backend/`；该目录的 `.dockerignore` 排除本机 `application-local*`、`.env*`、证书/私钥和 credentials 文件，保留受管的 `application.yml`、`application-dev.yml` 与 `application-prod.yml`。本机构建不得依赖把受控配置复制进镜像层；实际镜像层复核仍需 Linux Docker 验收。
