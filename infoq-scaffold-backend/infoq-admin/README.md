# infoq-admin

## 1. 模块职责

`infoq-admin` 是 backend 的启动与打包入口，不承载独立业务逻辑。它负责把 `infoq-system`、`infoq-core/*`、`infoq-plugin/*` 通过 Spring Boot 启动类和 profile 资源装进同一个运行单元。

## 2. 关键入口

- 启动类：[`SysAdminApplication`](./src/main/java/cc/infoq/admin/SysAdminApplication.java)
- 构建入口：[`pom.xml`](./pom.xml)
- profile 资源：[`src/main/resources/application.yml`](./src/main/resources/application.yml)、[`application-dev.yml`](./src/main/resources/application-dev.yml)、[`application-local.yml`](./src/main/resources/application-local.yml)、[`application-prod.yml`](./src/main/resources/application-prod.yml)
- 日志配置：[`src/main/resources/logback-plus.xml`](./src/main/resources/logback-plus.xml)

## 3. 核心类 / 文件

- `SysAdminApplication`：`@SpringBootApplication(scanBasePackages = "cc.infoq")`，把 `cc.infoq` 下所有模块统一纳入 Spring 容器，并排除 `UserDetailsServiceAutoConfiguration`，避免 token 鉴权下生成默认内存用户。
- `application*.yml`：定义 profile 分层、数据源、Redis、Quartz、mail、SSE、WebSocket、Springdoc 等运行开关。
- `logback-plus.xml`：当前后端日志输出规则，默认把文件日志写到仓库根 `logs/`，容器场景通过 `INFOQ_LOG_PATH` 覆盖。
- `banner.txt`、`i18n/*.properties`、`ip2region_v4.xdb`：启动展示、多语言消息与 IPv4 归属地内置资源。
- IPv6 归属地地址库不再打包进 `infoq-admin.jar`，部署源文件位于仓库根 [`script/docker/server/ip2region/ip2region_v6.xdb`](../../script/docker/server/ip2region/ip2region_v6.xdb)，运行时通过 `INFOQ_IP2REGION_V6_PATH` 指向外置挂载文件。

## 4. 上游依赖

- 开发、测试、部署命令最终都从 `infoq-admin` 启动 jar 或 package 产物。
- 根 `infoq-scaffold-backend/pom.xml` 通过 Maven reactor 把它作为最终可运行模块。

## 5. 下游依赖

- 编译期直接依赖：`infoq-system`
- 运行期间接依赖：`infoq-system` 再拉起 `infoq-core/*` 与 `infoq-plugin/*`

## 6. 关键配置

- profile 叠加顺序以 `application.yml + application-{env}.yml` 为主。
- 当前 README 与顶层 AGENTS 已确认常见入口使用 `dev` / `local` / `prod` 三种 profile。
- 运行命令和打包命令以 [`../AGENTS.md`](../AGENTS.md) 中的 `Commands` 为准。

## 7. 关键数据流

1. `java -jar infoq-admin.jar` 或 `mvn spring-boot:run` 进入 `SysAdminApplication`。
2. Spring Boot 加载 `application*.yml` 与 classpath 中各插件的自动装配入口。
3. `scanBasePackages = "cc.infoq"` 让 `infoq-system` 控制器、服务、Mapper、插件配置全部进入同一应用上下文。
4. 对外 HTTP、SSE、WebSocket、Quartz 与健康检查能力最终都通过这个模块打包后的应用暴露。

## 8. 扩展点

- 通过新增 `application-{profile}.yml` 或补充现有 profile 配置扩展运行环境。
- 通过 `pom.xml` 调整最终打包依赖集合。

## 9. 日志 / 监控切入点

- `logback-plus.xml` 是日志输出真值入口，默认文件日志目录是仓库根 `logs/`。
- `application*.yml` 里的 Web、SSE、WebSocket 与监控相关配置会影响健康检查暴露方式。
- 具体监控接口实现仍在 `infoq-system` 与 `infoq-plugin-web` / `infoq-plugin-security`。

## 10. 已知边界

- 该模块只有一个 Java 源文件，不承载业务 Controller、Service、Mapper。
- 启动后真正的业务逻辑请继续下钻 [`../infoq-modules/infoq-system/README.md`](../infoq-modules/infoq-system/README.md)。
