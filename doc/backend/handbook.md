# 后端手册

## 1. 后端由哪些模块组成

后端工作区是 `infoq-scaffold-backend`，按“入口模块 + 核心模块 + 插件模块 + 业务模块”拆分。

| 模块 | 作用 |
| --- | --- |
| `infoq-admin` | Spring Boot 启动入口、全局配置加载、运行镜像构建 |
| `infoq-core` | BOM、通用常量、DTO、工具类、基础能力 |
| `infoq-plugin` | 加密、邮件、SSE、WebSocket、日志、OSS、文档、Redis 等插件 |
| `infoq-modules` | 业务模块，目前以 `infoq-system` 为主 |

启动类：

- `infoq-scaffold-backend/infoq-admin/src/main/java/cc/infoq/admin/SysAdminApplication.java`

## 2. 关键配置文件

| 文件 | 用途 |
| --- | --- |
| `application.yml` | 全局基础配置：端口、日志、上传、Spring、Spring Security token、加密、Springdoc |
| `application-dev.yml` | 默认开发 profile 的数据库、Redis、邮件等 |
| `application-local.yml` | 本地 profile 的数据库、Redis、邮件等 |
| `application-prod.yml` | 生产部署使用的数据库、Redis、文件落盘等 |
| `logback-plus.xml` | 日志输出规则 |

### profile 约定

- `dev`：默认启用；未显式设置 `spring.profiles.active` 时生效。
- `local`：运行 jar 时显式传 `--spring.profiles.active=local`。
- `prod`：部署和打包时使用。

`application-local.yml` 属于开发者本地配置，允许按个人调试环境指向本地或远端依赖；自动化脚本默认按 `application-local.yml -> application-dev.yml` 顺序解析配置。共享文档、示例命令和 skill 不得暴露个人测试环境的私有地址、账号或密码。

共享真值端口保持为 `8080`。若开发者本地为了避开已有服务冲突，临时把 backend 改到 `8081` 或其他端口，应通过 `--server.port=<port>` 或 runtime skill `--backend-port <port>` 显式覆盖，而不是长期改写共享默认值。

共享示例的推荐基线保持为本地可复现环境：

- MySQL：`127.0.0.1:3306/infoq`
- Redis：`127.0.0.1:6379/0`

## 3. 认证与登录链路

当前登录链路以 `AuthController` 为核心，路径位于：

- `cc.infoq.system.controller.login.AuthController`

### 3.1 公开接口

| 接口 | 作用 |
| --- | --- |
| `GET /auth/code` | 获取验证码 |
| `POST /auth/login` | 登录 |
| `POST /auth/logout` | 退出登录 |
| `POST /auth/register` | 注册 |

### 3.2 登录做了什么

`POST /auth/login` 的关键行为：

1. 请求体按 JSON 解析。
2. 提取 `clientId` 和 `grantType`。
3. 查 `sys_client`，验证客户端存在、状态正常、授权类型匹配。
4. 调用对应认证策略执行登录。
5. 登录成功后，通过 `ScheduledExecutorService` 延迟触发欢迎消息；如果 `sse` 插件开启，会向当前用户推送登录欢迎信息。

### 3.3 和前端的配套约定

- 管理端默认使用 `VITE_APP_CLIENT_ID`。
- 管理端默认使用各自 `.env.development` 中的客户端配置。
- 当前代码里登录请求默认 `grantType=password`。
- 如果你改了 `sys_client`、`clientId`、加密开关或 RSA 密钥，React 与 Vue 管理端也必须同步调整。

## 4. 菜单、权限与路由来源

管理端不是把所有路由硬编码在前端，而是走“后端菜单数据 -> 前端动态路由”的模式。

### 4.1 菜单真值

- 表：`sys_menu`
- 初始数据：`sql/infoq_scaffold_3.0.0.sql`
- 前端获取接口：`GET /system/menu/getRouters`

### 4.2 当前核心菜单

- 系统管理：用户、角色、菜单、部门、岗位、字典、参数、通知、文件、客户端
- 系统监控：在线用户、登录日志、操作日志、定时任务、任务日志、缓存、服务监控、连接池监控
  连接池监控基于 `Hikari + dynamic-datasource` 原生实现，但对外接口已收敛为安全摘要字段，不向前端返回 JDBC URL、账号、驱动类和连接池实现细节。

### 4.3 这意味着什么

- 新增后台页面时，通常不只要写 Controller / Service / 前端页面，还要补菜单数据和权限标识。
- `sys_menu.component` 的值必须和管理端可解析的组件路径约定一致，例如 `system/user/index`、`monitor/cache/index`、`monitor/server/index`、`monitor/dataSource/index`。

## 5. 控制器能力地图

从 `infoq-system` 当前控制器可以看到主要边界如下：

### 登录与基础入口

- `AuthController`
- `CaptchaController`
- `IndexController`

### 系统管理

- `SysUserController`
- `SysRoleController`
- `SysMenuController`
- `SysDeptController`
- `SysPostController`
- `SysDictTypeController`
- `SysDictDataController`
- `SysConfigController`
- `SysNoticeController`
- `SysOssController`
- `SysOssConfigController`
- `SysClientController`
- `SysProfileController`

### 监控

- `SysUserOnlineController`
- `SysLoginInfoController`
- `SysOperLogController`
- `SysJobController`
- `SysJobLogController`
- `CacheController`
- `ServerController`
- `DataSourceController`

其中：

- `GET /monitor/server` 返回 CPU、内存、JVM、服务器信息和磁盘状态。
- `GET /monitor/dataSource` 返回 Hikari 连接池运行态数据；实现基于本项目 `Hikari + dynamic-datasource`，并支持开发环境 `p6spy` 包装链解包，不接 `Druid` 控制台。

## 6. 插件与可配置能力

插件目录位于 `infoq-plugin`，但它们不是都“默认强启”。当前可按配置控制的关键能力包括：

| 能力 | 关键配置 |
| --- | --- |
| API 接口加密 | `api-decrypt.enabled` |
| 字段或数据加密 | `mybatis-encryptor.enable` |
| 邮件 | `mail.enabled` |
| SSE | `sse.enabled` |
| WebSocket | `websocket.enabled` |
| 接口文档 | `springdoc.api-docs.enabled` |

插件治理的详细矩阵见 [`plugin-catalog.md`](../collaboration/plugin-catalog.md)。

## 7. 当前默认的基础安全与校验策略

从 `application.yml` 和公共代码可确认：

- `spring.jackson.deserialization.fail_on_unknown_properties = true`，未知字段会显式失败。
- `xss.enabled = true`，默认启用 XSS 过滤。
- `captcha.enable = true`，默认开启验证码。
- `api-decrypt.enabled = true`，默认开启接口加密。
- `springdoc.api-docs.enabled = true`，默认启用接口文档能力。

这几项都直接影响联调体验：

- 关闭前端加密但保留后端加密，会导致登录失败。
- 直接给后端发结构不对的 JSON，不会被静默吞掉。
- 验证码接口异常时，登录链路大概率一起异常。

## 8. 调试与排障建议

### 8.1 启动失败

优先看：

- `application-*.yml` 是否选对 profile
- 数据库 / Redis 是否可连
- `logback-plus.xml` 输出的异常栈

### 8.2 登录失败

优先检查：

- `/auth/code` 是否正常
- `sys_client` 中的 `clientId`、`grantType`、`status`
- 前端和后端加密开关是否一致
- 验证码、账号状态、密码是否正确

### 8.3 菜单不显示

优先检查：

- `/system/menu/getRouters` 返回值
- `sys_menu` 数据
- 用户角色 / 权限
- 前端页面组件路径是否和 `component` 字段一致

## 9. 后端开发时的最小闭环

1. 修改 Controller / Service / Mapper / Entity 或配置。
2. 先本地跑主流程，确认接口能调用。
3. 跑定向 Maven 测试。
4. 再做打包或更大范围验证。

常用命令：

```bash
node .codex/scripts/backend_mvn.mjs -- clean install -DskipTests
java -jar infoq-scaffold-backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=dev
java -jar infoq-scaffold-backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=local
java -jar infoq-scaffold-backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=local --captcha.enable=false
java -jar infoq-scaffold-backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=local --server.port=8081 --captcha.enable=false  # 本地临时避冲突 override
node .codex/scripts/backend_mvn.mjs -- -pl infoq-modules/infoq-system -am -DskipTests=false test
node .codex/scripts/backend_mvn.mjs -- clean package -P prod -pl infoq-admin -am
```

## 10. 相关文档

- 快速启动：[`quick-start.md`](../guide/quick-start.md)
- 部署前准备：[`deploy-prerequisites.md`](../devops/deploy-prerequisites.md)
- Compose 部署：[`docker-compose-deploy.md`](../devops/docker-compose-deploy.md)
- 插件治理：[`plugin-catalog.md`](../collaboration/plugin-catalog.md)
