# 架构总览

InfoQ-Scaffold-AI 当前由一个后端和两套管理端组成：Spring Boot 后端、Vue 管理端和 React 管理端。`docs/` 是用户文档真值源，`openspec/` 保存变更计划与模板，稳定规格真值在 `docs/specs/`。

## 1. 工作区

```text
infoq-scaffold-ai
├── infoq-scaffold-backend
├── infoq-scaffold-frontend-vue
├── infoq-scaffold-frontend-react
├── script
├── sql
├── deploy
├── docs
└── openspec
```

| 工作区 | 职责 | 关键入口 |
| --- | --- | --- |
| `infoq-scaffold-backend` | Spring Boot 4.1 多模块后端 | `infoq-admin/src/main/java/cc/infoq/admin/SysAdminApplication.java` |
| `infoq-scaffold-frontend-vue` | Vue 3 + Element Plus 管理端 | `src/main.ts`、`src/router/index.ts` |
| `infoq-scaffold-frontend-react` | React 19 + Ant Design 管理端 | `src/main.tsx`、`src/router/AppRouter.tsx` |

## 2. 技术基线

| 层次 | 版本与组件 |
| --- | --- |
| 后端 | Spring Boot 4.1.1、JDK 21、MyBatis-Plus 3.5.17、Spring Security、Redisson |
| Web 容器 | Spring Boot 官方默认 Tomcat |
| Vue 管理端 | Vue 3.5.35、Vite 8.0.16、Element Plus 2.14.1、Pinia、Vitest 4.1.8 |
| React 管理端 | React 19.2.7、Vite 8.0.16、Ant Design 6.4.3、Zustand、Vitest 4.1.8 |
| 基础设施 | MySQL 8、Redis 7、MinIO、Nginx |

前端本机开发、CI 和 Docker builder 统一使用 Node.js `24.18.0`。如需同时启动两套管理端，请先为其中一个 dev server 调整端口。

## 3. 后端由哪些模块组成

后端工作区是 `infoq-scaffold-backend`，按"入口模块 + 核心模块 + 插件模块 + 业务模块"拆分。

| 模块 | 作用 |
| --- | --- |
| `infoq-admin` | Spring Boot 启动入口、全局配置加载、运行镜像构建 |
| `infoq-core` | BOM、通用常量、DTO、工具类、基础能力 |
| `infoq-plugin` | 加密、邮件、SSE、WebSocket、日志、OSS、文档、Redis 等插件 |
| `infoq-modules` | 业务模块，目前以 `infoq-system` 为主 |

### 3.1 关键配置文件

| 文件 | 用途 |
| --- | --- |
| `application.yml` | 全局基础配置：端口、日志、上传、Spring、Spring Security token、加密、Springdoc |
| `application-dev.yml` | 默认开发 profile 的数据库、Redis、邮件等 |
| `application-local.yml` | 本地 profile 的数据库、Redis、邮件等 |
| `application-prod.yml` | 生产部署使用的数据库、Redis、文件落盘等 |
| `logback-plus.xml` | 日志输出规则 |

profile 约定：

- `dev`：默认启用；未显式设置 `spring.profiles.active` 时生效。
- `local`：运行 jar 时显式传 `--spring.profiles.active=local`。
- `prod`：部署和打包时使用。

`application-local.yml` 属于开发者本地配置，允许按个人调试环境指向本地或远端依赖；自动化脚本默认按 `application-local.yml -> application-dev.yml` 顺序解析配置。共享文档、示例命令和 skill 不得暴露个人测试环境的私有地址、账号或密码。

共享真值端口保持为 `8080`。若开发者本地为了避开已有服务冲突，临时把 backend 改到 `8081` 或其他端口，应通过 `--server.port=<port>` 或 runtime skill `--backend-port <port>` 显式覆盖，而不是长期改写共享默认值。

共享示例的推荐基线保持为本地可复现环境：

- MySQL：`127.0.0.1:3306/infoq`
- Redis：`127.0.0.1:6379/0`

## 4. 认证与登录链路

当前登录链路以 `AuthController` 为核心，路径位于 `cc.infoq.system.controller.login.AuthController`。

### 4.1 公开接口

| 接口 | 作用 |
| --- | --- |
| `GET /auth/code` | 获取验证码 |
| `POST /auth/login` | 登录 |
| `POST /auth/logout` | 退出登录 |
| `POST /auth/register` | 注册 |

### 4.2 登录做了什么

`POST /auth/login` 的关键行为：

1. 请求体按 JSON 解析。
2. 提取 `clientId` 和 `grantType`。
3. 查 `sys_client`，验证客户端存在、状态正常、授权类型匹配。
4. 调用对应认证策略执行登录。
5. 登录成功后，通过 `ScheduledExecutorService` 延迟触发欢迎消息；如果 `sse` 插件开启，会向当前用户推送登录欢迎信息。

### 4.3 和前端的配套约定

- 管理端默认使用 `VITE_APP_CLIENT_ID`。
- 管理端默认使用各自 `.env.development` 中的客户端配置。
- 当前代码里登录请求默认 `grantType=password`。
- 如果你改了 `sys_client`、`clientId`、加密开关或 RSA 密钥，React 与 Vue 管理端也必须同步调整。

## 5. 菜单、权限与路由来源

管理端不是把所有路由硬编码在前端，而是走"后端菜单数据 -> 前端动态路由"的模式。

### 5.1 菜单真值

- 表：`sys_menu`
- 初始数据：`sql/infoq_scaffold_3.0.0.sql`
- 前端获取接口：`GET /system/menu/getRouters`

### 5.2 当前核心菜单

- 系统管理：用户、角色、菜单、部门、岗位、字典、参数、通知、文件、客户端
- 系统监控：在线用户、登录日志、操作日志、定时任务、任务日志、缓存、服务监控、连接池监控
  连接池监控基于 `Hikari + dynamic-datasource` 原生实现，但对外接口已收敛为安全摘要字段，不向前端返回 JDBC URL、账号、驱动类和连接池实现细节。

### 5.3 这意味着什么

- 新增后台页面时，通常不只要写 Controller / Service / 前端页面，还要补菜单数据和权限标识。
- `sys_menu.component` 的值必须和管理端可解析的组件路径约定一致，例如 `system/user/index`、`monitor/cache/index`、`monitor/server/index`、`monitor/dataSource/index`。

## 6. 控制器能力地图

从 `infoq-system` 当前控制器可以看到主要边界如下：

- 登录与基础入口：`AuthController`、`CaptchaController`、`IndexController`
- 系统管理：`SysUserController`、`SysRoleController`、`SysMenuController`、`SysDeptController`、`SysPostController`、`SysDictTypeController`、`SysDictDataController`、`SysConfigController`、`SysNoticeController`、`SysOssController`、`SysOssConfigController`、`SysClientController`、`SysProfileController`
- 监控：`SysUserOnlineController`、`SysLoginInfoController`、`SysOperLogController`、`SysJobController`、`SysJobLogController`、`CacheController`、`ServerController`、`DataSourceController`

其中：

- `GET /monitor/server` 返回 CPU、内存、JVM、服务器信息和磁盘状态。
- `GET /monitor/dataSource` 返回 Hikari 连接池运行态数据；实现基于本项目 `Hikari + dynamic-datasource`，并支持开发环境 `p6spy` 包装链解包，不接 `Druid` 控制台。

## 7. 插件与可配置能力

插件目录位于 `infoq-plugin`，但它们不是都"默认强启"。当前可按配置控制的关键能力包括：

| 能力 | 关键配置 |
| --- | --- |
| API 接口加密 | `api-decrypt.enabled` |
| 字段或数据加密 | `mybatis-encryptor.enable` |
| 邮件 | `mail.enabled` |
| SSE | `sse.enabled` |
| WebSocket | `websocket.enabled` |
| 接口文档 | `springdoc.api-docs.enabled` |

插件治理的详细矩阵见 [Skills 与插件](./SKILLS.md) 的插件目录章节。

## 8. 当前默认的基础安全与校验策略

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

## 9. 管理端共通机制

Vue 与 React 管理端共享同一套后端、同一套菜单权限和大部分业务模块，只在技术栈、目录组织和页面实现方式上不同。

### 9.1 登录与授权

- 先请求 `GET /auth/code` 获取验证码。
- 再调用 `POST /auth/login` 进行登录。
- 默认会携带 `clientId` 和 `grantType=password`。
- 登录成功后请求 `/system/user/getInfo` 和 `/system/menu/getRouters`。

### 9.2 动态菜单

- 菜单真值来自后端 `sys_menu`。
- 前端不会把所有业务路由写死在本地。
- 新增页面时，除了前端组件，还要考虑菜单数据和权限标识。

### 9.3 请求封装

两套管理端的请求层都做了这些事：

- 自动带 token 和 `clientid`
- 给 GET 请求拼 query string
- 拦截短时间重复的 POST / PUT
- 根据开关对请求体和响应体做 RSA + AES 加解密
- 统一处理 401、超时、服务端错误、文件下载

### 9.4 `/dev-api` 代理

- `.env.development` 中 `VITE_APP_BASE_API` 默认是 `/dev-api`
- `vite.config.ts` 里会把它代理到 `VITE_APP_PROXY_TARGET` 或默认的 `http://localhost:8080`
- 共享默认后端端口是真值 `8080`；如果开发者本地为了避冲突临时改成 `8081`，必须同步显式覆盖 `VITE_APP_PROXY_TARGET`，不要把 `8081` 固化进共享配置

如果代理目标没配对，页面能打开，但所有接口都会失败。

## 10. 管理端差异

| 维度 | Vue 管理端 | React 管理端 |
| --- | --- | --- |
| 工作区 | `infoq-scaffold-frontend-vue` | `infoq-scaffold-frontend-react` |
| UI 组件库 | Element Plus | Ant Design |
| 路由入口 | `src/router/index.ts` | `src/router/AppRouter.tsx` |
| 动态路由转换 | Vue Router 原生路由对象 | `route-transform.ts` + `BackendRouteView.tsx` |
| 状态管理 | Pinia | Zustand |
| 主要页面目录 | `src/views` | `src/pages` |
| 公共能力目录 | `src/plugins`、`src/utils` | `src/utils`、`src/hooks`、`src/layouts` |
| 测试命令 | `pnpm run test:unit` | `pnpm run test` |

## 11. Vue 管理端

### 11.1 关键目录

| 目录 | 作用 |
| --- | --- |
| `src/views` | 页面级视图 |
| `src/components` | 复用组件 |
| `src/api` | API 封装 |
| `src/router` | 常量路由和动态路由入口 |
| `src/store` | Pinia store |
| `src/plugins` | `auth`、`cache`、`download`、`modal`、`svgicon`、`tab` 等 |
| `src/utils` | 请求、加密、权限、字典、工具函数 |

### 11.2 固定路由

`src/router/index.ts` 里已经声明了这类常量路由：`/login`、`/register`、`/index`、`/user/profile`、`/401`、`404`。剩余业务路由依赖后端返回的动态菜单。

### 11.3 请求层特性

`src/utils/request.ts` 里的关键行为：

- 自动补 `Authorization` 和 `clientid`
- 写入 `Content-Language`
- 开启重复提交保护
- 根据 `isEncrypt` 和 `VITE_APP_ENCRYPT` 决定是否加密
- 登录过期时通过对话框引导重新登录

## 12. React 管理端

### 12.1 关键目录

| 目录 | 作用 |
| --- | --- |
| `src/pages` | 页面级组件 |
| `src/layouts` | 主框架布局 |
| `src/api` | API 封装 |
| `src/router` | 路由入口、守卫、动态路由转换、组件映射 |
| `src/store` | Zustand store |
| `src/hooks` | 自定义 hooks |
| `src/utils` | 请求、鉴权、缓存、弹窗、工具函数 |

### 12.2 固定路由

`src/router/AppRouter.tsx` 里固定声明了 `/login`、`/register`、`/401`、`/redirect/*`、`/index`、`/user/profile`。其他路径统一通过 `BackendRouteView` 接管，再由后端菜单数据匹配到页面组件。

### 12.3 动态路由转换

`src/router/route-transform.ts` 会负责：

- 规范化路径
- 拉平 `ParentView` 子路由
- 处理内链和绝对 URL
- 检查重复路由名称 / 路径冲突
- 构造"路径 -> 组件"映射

这层存在的意义是：后端菜单字段沿用统一约定，React 端再把这些字段解释成 React Router 可用的结构。

### 12.4 请求层特性

`src/utils/request.ts` 的整体能力和 Vue 基本一致：自动带 token、`clientid`；重复提交防抖；可选加密；401 弹窗重登录；统一错误提示；文件下载。

### 12.5 构建与分包真值

React admin 的分包真值在 `infoq-scaffold-frontend-react/vite.config.ts` 的 `build.rollupOptions.output.manualChunks`：

- 当前策略优先稳定 vendor 分组与路由级懒加载：`vendor-react`、`vendor-shared`、`vendor-media`、`vendor-echarts`，以及 `vendor-antd-infra`、`vendor-rc-table`、`vendor-rc-picker`、`vendor-rc-form`、`vendor-rc-tree`、`vendor-rc-overlay`。
- `src/router/AppRouter.tsx` 中的 `AuthGuard`、`MainLayout`、`BackendRouteView`、`login`、`register`、`401`、`redirect` 已改为 `lazy()`；入口首包优化依赖这些真实路由边界。
- 处理 chunk warning 时保留「按路由边界拆 + 按 rc 重模块拆」的思路，不要回到按 `antd/es/*` 或 `antd/lib/*` 细粒度手工拆包；旧策略容易触发 circular chunk warning。
- 验收标准以 `pnpm run build:prod` 输出为准：既要避免 circular chunk warning，也要避免 `Some chunks are larger than 500 kB after minification`。

## 13. 如何新增一个后台页面

建议按这个顺序做：

1. 后端先补接口和权限。
2. 如需出现在左侧菜单，补 `sys_menu` 数据或菜单管理配置。
3. Vue 端在 `src/views/...` 新建页面，React 端在 `src/pages/...` 新建页面。
4. 保证后端菜单里的 `component` 字段沿用现有路径约定，例如 `system/user/index`。
5. 如果页面有表格、表单、导出、权限控制，复用当前请求层、字典能力和上传 / 下载工具。
6. 跑对应单测和构建。

## 14. 调试与排障建议

### 14.1 启动失败

优先看：

- `application-*.yml` 是否选对 profile
- 数据库 / Redis 是否可连
- `logback-plus.xml` 输出的异常栈

### 14.2 登录失败

优先检查：

- `/auth/code` 是否正常
- `sys_client` 中的 `clientId`、`grantType`、`status`
- 前端和后端加密开关是否一致
- 验证码、账号状态、密码是否正确

### 14.3 菜单不显示

优先检查：

- `/system/menu/getRouters` 返回值
- `sys_menu` 数据
- 用户角色 / 权限
- 前端页面组件路径是否和 `component` 字段一致

## 15. 本地入口与最小闭环

| 服务 | 默认地址或命令 |
| --- | --- |
| 后端 | `http://127.0.0.1:8080` |
| Vue 管理端 | `pnpm --dir infoq-scaffold-frontend-vue run dev` |
| React 管理端 | `pnpm --dir infoq-scaffold-frontend-react run dev` |
| Nginx 聚合入口 | `/vue/`、`/react/`、`/prod-api/` |

配置与验证入口：

- 后端环境配置位于 `infoq-scaffold-backend/infoq-admin/src/main/resources/`。
- Vue 环境变量位于 `infoq-scaffold-frontend-vue/.env.*`。
- React 环境变量位于 `infoq-scaffold-frontend-react/.env.*`。
- 使用 `node tools/validate_utf8.mjs` 做仓库编码校验。
- 后端使用 `node tools/backend_mvn.mjs -- ...`，前端使用 pnpm 执行测试、lint 和构建。

后端开发最小闭环：

1. 修改 Controller / Service / Mapper / Entity 或配置。
2. 先本地跑主流程，确认接口能调用。
3. 跑定向 Maven 测试。
4. 再做打包或更大范围验证。

```bash
node tools/backend_mvn.mjs -- clean install -DskipTests
java -jar infoq-scaffold-backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=dev
java -jar infoq-scaffold-backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=local
node tools/backend_mvn.mjs -- -pl infoq-modules/infoq-system -am -DskipTests=false test
node tools/backend_mvn.mjs -- clean package -P prod -pl infoq-admin -am
```

## 16. 相关文档

- 本地搭建与验证：[开发指南](../DEV_GUIDE.md)
- 部署参数：[部署指南](../deploy/README.md)
- 插件治理矩阵：[Skills 与插件](./SKILLS.md)
- 稳定需求规格：[docs/specs](./specs/README.md)
