# 管理端浏览器恢复会话

React/Vue 的 access token 仅在内存保留。浏览器刷新通过专用恢复资源取回既有 JWT，普通业务接口、SSE 和 WebSocket 继续使用原有 Bearer header/query；恢复 cookie 不会建立全局认证身份。

## HTTP 合同

所有请求要求 `clientid`（1–128 位字母、数字、`.`、`_`、`-`，首位字母或数字）和 `X-InfoQ-Browser-Session: react|vue`，响应为现有 `ApiResult`，并带 `Cache-Control: no-store` 与 `Pragma: no-cache`。写方法还必须提供 `X-XSRF-TOKEN`。

| 方法与后端路径 | 行为 |
| --- | --- |
| `GET /auth/browser-session/csrf` | 返回 `data.token` 与 `data.headerName=X-XSRF-TOKEN`，生成 HttpOnly CSRF cookie，不建立登录身份 |
| `PUT /auth/browser-session` | 只接受显式 `Authorization: Bearer`，绑定已认证 JWT，返回空 data；query token 不可代替 |
| `POST /auth/browser-session` | 用恢复 cookie 取回原 JWT，返回 `LoginVo` 的 `access_token`、`expire_in`、`client_id`，不生成有效 refresh token、不续期 |
| `DELETE /auth/browser-session` | 撤销恢复 cookie 对应的 JWT、删除映射并清本 scope 两类 cookie，发布既有 `Logout` 审计；无映射时幂等成功 |

状态码与 `ApiResult.code` 一致：400 表示缺失或非法 clientId，不清 cookie；401 表示无效恢复/认证，清当前 scope 恢复 cookie；403 表示 Origin、scope、CSRF 拒绝，不能清已有 cookie；Redis 等必需依赖失败返回 503。DELETE 的 503 仍清浏览器 cookie，但明确表示服务端撤销尚未确认。不得把网络故障或 503 当作成功退出或普通匿名。

匿名例外仅精确 csrf GET、恢复 POST 和退出 DELETE；PUT 仍经 Bearer filter 认证。其他 `/auth/**` 路径没有因此整体公开。POST/DELETE 不读取 Bearer fallback；业务 API 只带恢复 cookie 必须返回 401。

## 来源、CSRF 与 cookie

只支持同源相对 API 代理。生产浏览器路径为 `/prod-api/auth/browser-session`，本机 Vite 为 `/dev-api/auth/browser-session`；页面 context path 不改变 API 前缀。`ResourcesConfig` 的 CorsFilter 显式先于 Spring Security 执行，以处理合法预检；专用资源优先匹配受控精确 Origin 策略，再匹配普通 Bearer API 既有策略。

写方法必须存在合法 Origin；`Sec-Fetch-Site: cross-site` 总是拒绝。csrf GET 缺 Origin 时仅允许具有 scope 引导 header 且 `Sec-Fetch-Site: same-origin` 的请求。自动化客户端须显式提供合法 Origin。`Host`、`X-Forwarded-*` 不参与推测信任来源或降低 cookie Secure。

Spring `CsrfFilter` 只对该资源写方法检查 CSRF header；不接受 `_csrf` 参数代替 header。两个固定 scope 使用各自预配置的 `CookieCsrfTokenRepository`，不在请求中修改共享 cookie 策略。CSRF token 由 GET JSON 取回并仅在内存使用。stateless Bearer 每次请求不是新的 HTTP session 登录，CSRF 的 session authentication strategy 显式使用 `NullAuthenticatedSessionStrategy`，避免每次 Bearer 请求清掉 SPA 的 CSRF cookie；实际 CSRF filter 保持开启，DELETE 显式清理。

两类 cookie 均 HostOnly、HttpOnly、SameSite=Strict，生产必须 Secure，Path 为上述外部资源路径。恢复 cookie 名按 `scope` 和 clientId 的 SHA-256 前缀区分，CSRF cookie 按 scope 区分；生产使用 `__Secure-` 前缀。清除时使用相同 name/path。React 退出不会删除 Vue 的 cookie 或撤销 Vue 独立 JWT；同 scope 重新绑定不同 JWT 会撤销被替换的旧 JWT。

## 受控配置

| 环境变量 | Spring 属性 `security.browser-session.*` | 约束 |
| --- | --- | --- |
| `INFOQ_DEPLOY_MODE` | `deployment-mode` | 仅 production/development；prod profile 默认 production，显式隔离开发 Compose 可为 development |
| `INFOQ_PUBLIC_BASE_URL` | `public-base-url` | 根 Origin，可带根 `/`；production 必需 HTTPS，且是唯一允许来源 |
| `INFOQ_BROWSER_SESSION_ORIGINS` | `origins` | production 必须为空；development 可显式配置精确 HTTP loopback Origin 列表 |
| `INFOQ_BROWSER_SESSION_COOKIE_PATH` | `cookie-path` | production 为 `/prod-api/auth/browser-session`；development 可为 `/prod-api/...` 或 `/dev-api/...` |
| `INFOQ_BROWSER_SESSION_SECURE` | `secure` | production 必须 true；显式 HTTP loopback 开发可 false |
| `INFOQ_BROWSER_SESSION_TTL_SECONDS` | `ttl-seconds` | 正整数 1..2592000，默认 2592000 |

开发 loopback 限于 `localhost`、合法 `*.localhost` 子域、`127.0.0.1`、`[::1]`；配置中不得使用字面 `*`、`null`、任意 DNS、子路径、userinfo、query 或 fragment。端口参与 Origin 比较，HTTP 80/HTTPS 443 规范化。开发 public URL 与开发 origins 合并后仍逐项校验，不能因 prod profile 被显式 development 覆盖而扩大到公网。

部署和构建先走仓库 `tools/production_config.mjs`。受控配置缺失或不合法时启动失败，不根据请求猜测默认生产 Origin、cookie path 或 Secure。实际配置注入见 [生产部署验收](../../deploy/VERIFICATION.md)。

## Redis、成本与回滚

32 字节密码学随机 opaque 句柄仅放 HttpOnly cookie；Redis key 为 `security:browser-session:<SHA-256(handle)>`，值只含既有 tokenDigest、clientId、scope、绝对到期。映射使用 Redisson OSS 的有界 `setIfAbsent(value, Duration)`，TTL 取 JWT 剩余寿命与最大恢复 TTL 的较小值；无界 JWT 也必须受上限约束。恢复先读取既有 token session 再走 `SecurityTokenService.authenticate`，保留签名、撤销、clientId、绝对/活跃超时验证，不创建新 JWT。

映射是非 final DTO，以兼容现有 Jackson `DefaultTyping.NON_FINAL` Redis codec；单测执行真实配置 codec 往返。新增访问只发生在首载恢复、绑定和退出，不在每个业务请求或列表元素增加映射查询，不涉及 SQL、依赖或 lockfile 变化。日志只含 action、结果分类、clientId、短 digest、requestId 和必要异常类型，禁止 Cookie、完整 JWT、CSRF 或恢复句柄。

用户禁用/恢复状态、密码修改、用户角色改写、用户更新/删除，以及角色数据范围改写，在成功 SQL 写后、同一事务提交前撤销既有 JWT。Redis 撤销失败向外抛出并回滚数据库事务；若 Redis 已部分撤销，这些 JWT 保持失效，只能重新登录，禁止为了回滚恢复已撤销身份。批量用户索引与 token 以每组最多 500 个读取/处理，Redisson OSS `RBatch` 提交撤销、在线态与索引清理，避免逐用户同步 Redis 查询。不会在每次恢复或业务请求读取用户数据库来补偿写边界。

`revokeByUserId`、`revokeByUserIds`、`revokeByRoleId` 只捕获明确的 `RedisException` 并转为 common `SecurityDependencyException`；web 返回 HTTP/业务码 503。异常和日志只保留固定安全消息、operation、依赖异常类型及 requestId，不携 Redis 原消息或 cause，避免命令参数包含 JWT 时外泄。参数错误和其他编程错误继续按其原类型失败，不能统一伪装为依赖故障。角色数据权限主写 0 行或部门关系写失败时显式失败，不撤销未改变账户的会话；数据库事务回滚已执行的更新与关系删除。

出现跨 Origin 读取、CSRF 绕过、cookie 越界、撤销后恢复或 OAuth/刷新回归时停止候选发布。修正本轮错误实现并按精确 name/path 清 cookie；映射按 TTL 自然回收，禁止批量清未知 Redis key。不得回退到明文持久 token 后宣称生产就绪。

## 生产日志可见性

Maven `-Pprod` 将通用 `cc.infoq` 日志基线过滤为 WARN。`application-prod.yml` 只对以下七个精确 logger 启用 INFO，不提高全局或业务模块日志级别：

- `cc.infoq.system.controller.login.BrowserSessionController`
- `cc.infoq.common.security.browser.BrowserSessionGuardFilter`
- `cc.infoq.common.security.handler.SecurityAccessDeniedHandler`
- `cc.infoq.common.security.handler.SecurityAuthenticationEntryPoint`
- `cc.infoq.common.web.config.ResourcesConfig`
- `cc.infoq.common.push.service.DefaultPushService`
- `cc.infoq.system.listener.SysMessagePushListener`

前五个保留 `browser_session` 的成功与认证/Origin/CSRF 拒绝分类；Push 的 disabled、offline、published 分类在生产同样可见，failed/channel_unavailable 沿用既有 WARN。字段继续遵守各日志边界，不增加凭据、原始异常消息或消息正文。published 仅表示已发布，不代表客户端 ACK 或送达。

实际输出由 `logback-plus.xml` 控制，INFO 进入 stdout、`sys-console.log` 与 `sys-info.log`，ERROR 才进入 `sys-error.log`；核验时不能要求 INFO 出现在 error 文件。容器目录由 `INFOQ_LOG_PATH` 指定。仅看到请求 HTTP 成功或在源码中存在 `log.info` 都不能证明生产日志可见。

日志级别、生产 profile、Logback 配置变化时，从仓库根执行真实生产过滤与日志初始化回归：

```bash
node tools/backend_mvn.mjs -- -Pprod -pl infoq-admin -am -DskipTests=false -Dtest=ProductionObservabilityLoggingTest -Dsurefire.failIfNoSpecifiedTests=false test
```

该测试用 `@Tag("prod")` 匹配生产 Surefire 分组，加载 Maven 真实过滤后的 `application.yml` 与 `application-prod.yml`，经 `LoggingApplicationListener` 初始化实际 Logback，逐一验证七个 INFO logger、无关用户业务仍 WARN、实际文件输出及异步 INFO 停机刷新。测试不启动 Web/数据库/Redis，临时日志仅写入仓库 `tmp/`，finally 关闭 appender 并恢复日志级别、初始化状态与系统属性。此定向门禁不能替代开发分组的业务单测或 Linux Docker 真实请求分类证据；生产打包若选择 `prod` 分组，不得把未选择的 `dev` 测试算为执行成功。

## 回归 SOP

触发条件：修改浏览器恢复资源、Cookie/Origin/CORS/CSRF、token 登录与撤销、Redis 映射、部署环境映射时。

1. 先读本文、`SpringSecurityAutoConfiguration`、`BrowserSessionController` 与 `BrowserSessionService`。使用真实 Spring Security filter chain 验证 GET csrf → HEADER Bearer PUT → 无 Bearer POST → cookie-only 业务请求 401 → DELETE → 恢复 401，不能只 mock 控制器成功。
2. 从仓库根目录执行目标测试，核对非零用例数量、退出码及 Surefire 测试总时长少于 60 秒：

```bash
node tools/backend_mvn.mjs -- -pl infoq-plugin/infoq-plugin-security,infoq-modules/infoq-system -am -DskipTests=false -Dtest=BrowserSessionServiceTest,BrowserSessionPropertiesTest,BrowserSessionControllerTest,BrowserSessionSecurityFilterChainTest,UserSessionInvalidationTest,SysUserServiceImplTest,SysRoleServiceImplTest,SecurityTokenResolverTest,SecurityTokenServiceTest,SecurityTokenStoreTest,MiniappSecurityFilterChainTest,ResourcesConfigTest,GlobalExceptionHandlerTest,SecurityAuthenticationEntryPointTest,SecurityAccessDeniedHandlerTest,SpringSecurityAutoConfigurationTest -Dsurefire.failIfNoSpecifiedTests=false test
```

3. 检查合法/非法 Origin、无 Origin 的 same-origin GET、合法预检、缺/错/参数形式 CSRF、403 不清 cookie、客户端和 scope 隔离、原 token 不续期、过期/撤销、同 scope 替换、Redis 503 与 DELETE 未确认撤销。生产属性测试必须断言外部 Path、HttpOnly/Strict/Secure/HostOnly，而非仅看 HTTP 200。

   `UserSessionInvalidationTest` 使用真实 Spring 事务代理与 H2 事务，SQL 边界替身执行实际参数化 SQL；核验成功禁用、改密码、用户批量删除、用户角色和角色数据范围改写后原 JWT/恢复失效，0 行不误撤销，部门关系失败时恢复原关系，以及 Redis 失败/部分撤销时数据库回滚与已撤销身份不复活。`SecurityTokenServiceTest` 核验异常/堆栈不携原 Redis 参数，`GlobalExceptionHandlerTest` 通过实际 MVC 检查 HTTP/业务码 503 和脱敏日志。它们不替代真实 MySQL Mapper XML 与 Redis 运行验收。
4. 再跑编译/相关 package、`node tools/validate_utf8.mjs backend` 与 `git diff --check`；脱敏命令/结果放 `tmp/`。真实浏览器和 Redis 验收由 test-cli 与 Linux Docker 隔离环境补齐，内存替身或 codec 单测不替代运行态。

反模式：将所有 API 改为 cookie 认证；关闭框架 CSRF；放开任意带凭据 Origin；通过 sessionStorage 或固定前端密钥保存 JWT；在 503 后假装匿名/成功退出；只测试 helper、不测试实际 filter 顺序；给 final record 写入非 final 多态 codec；把负例/零用例当绿灯。
