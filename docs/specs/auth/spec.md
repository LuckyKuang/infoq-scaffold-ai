# 认证与会话规范

## 目标

定义当前仓库认证入口、客户端授权校验、登录后会话引导，以及登录成功后的实时欢迎消息行为。

## 要求

### 要求：验证码与登录入口
后台会话必须通过统一的验证码与登录接口建立。

#### 场景：管理端密码或邮箱登录页初始化

- 当客户端需要建立后台会话时
- 则必须先调用 `GET /auth/code`
- 并且必须调用 `POST /auth/login`
- 并且登录请求体必须包含 `clientId` 与 `grantType`
- 并且密码登录使用 `grantType=password`，邮箱登录使用 `grantType=email`；后端不替缺失的 `grantType` 填默认值

微信小程序 code 登录按下文场景先探测功能开关；该场景不要求调用图形验证码接口。

#### 场景：加密登录请求

- 当后端 `api-decrypt.enabled=true` 且接口带 `@ApiEncrypt` 时
- 则 `POST /auth/login` 与 `POST /auth/register` 必须按当前加密约定提交
- 并且缺少合法加密头时不得静默进入控制器

### 要求：客户端授权校验
登录必须以 `sys_client` 配置和授权类型校验为前提。

#### 场景：客户端或授权类型不合法

- 当 `sys_client` 不存在、状态非正常或 `grantType` 不匹配时
- 则登录必须失败

### 要求：登录后会话引导
成功登录后的权限和动态路由必须由后续接口装载。

#### 场景：登录成功

- 当后端登录成功返回 token 后
- 则浏览器管理端必须先成功绑定受保护的 HttpOnly 恢复会话，之后只在内存保留 access token
- 则客户端必须继续使用该 token 请求 `/system/user/getInfo`
- 并且 admin 客户端必须继续请求 `/system/menu/getRouters`
- 并且后续权限、角色和动态路由必须以后续接口返回值为准

### 要求：浏览器恢复资源严格隔离

仅同源代理下的 `GET /auth/browser-session/csrf` 与 `PUT/POST/DELETE /auth/browser-session` 承担浏览器绑定、恢复和退出。所有请求须带有效 `clientid` 和 `X-InfoQ-Browser-Session: react|vue`，写方法另须框架校验的 `X-XSRF-TOKEN` 与精确受控 Origin；CSRF 引导缺 Origin 时仅允许 `Sec-Fetch-Site: same-origin`。普通业务 API 继续只接受既有 header/query Bearer，恢复 cookie 不能直接认证业务请求。

恢复句柄必须为密码学安全随机 opaque 值，服务端只以其摘要定位原 token 会话，绑定 clientId、应用 scope 和有界 TTL；不得签发新 JWT 或续期原 JWT。Cookie 必须 HostOnly、HttpOnly、SameSite=Strict，生产 Secure，Path 对应外部 API 前缀下的 `/auth/browser-session`。生产 Origin 仅来自 `INFOQ_PUBLIC_BASE_URL`；`INFOQ_BROWSER_SESSION_COOKIE_PATH`、`INFOQ_BROWSER_SESSION_SECURE`、`INFOQ_BROWSER_SESSION_TTL_SECONDS` 须通过生产预检与实际代理一致性验证。

#### 场景：刷新、撤销和依赖故障

- 有效恢复返回原 `access_token`、`client_id` 和正剩余 `expire_in`，不延长会话寿命；角色、用户或管理员撤销后不得恢复。
- 只有恢复 HTTP401 表示匿名并清理无效恢复 cookie；Origin/CSRF HTTP403 不清 cookie，避免跨站强制注销；网络或依赖 HTTP503 明确失败，不伪装匿名或成功。
- DELETE 撤销对应原会话并保留退出审计，清本 scope cookie；已失效会话幂等。撤销依赖故障必须报告未获确认。
- 用户禁用、删除、密码修改、用户角色调整和角色数据范围变更必须在成功写入边界撤销受影响的现有会话；撤销依赖失败须明确失败并回滚数据库事务，已撤销的 token 不得复活。批量用户操作须批量读取会话索引，不得每次恢复新增数据库查询。
- React/Vue 的 cookie 与映射按 scope 隔离；同 scope 替换或退出的通知不包含任何凭据。首载恢复与权限/路由加载须去重，认证失效与退出关闭自有 SSE/WebSocket 和重连计时器。
- 同 tab 的 CSRF 引导与会话资源操作必须按序完成，防止旧 DELETE 或恢复失败的 Set-Cookie 晚到清除新绑定；恢复 HTTP401 清理服务端 CSRF cookie 后，客户端必须在本次有序操作失败前清除缓存，下一个绑定重新引导 CSRF。403/503 不自动重试或清除仍有效的 CSRF。旧 Bearer 请求的晚到 401 不得清除后续建立的新身份。

### 要求：登录副作用不得破坏主成功路径
欢迎消息属于登录后的附加动作，不得反向污染登录结果。

#### 场景：发送欢迎消息

- 当登录成功后
- 则后端必须在约 5 秒后尝试向当前用户推送欢迎消息
- 并且当 `sse.enabled=false` 时，欢迎消息链路不得导致登录失败

### 要求：用户管理已绑定外部身份
系统必须在现有 OAuth 身份模型上提供当前用户的身份列表、绑定、解绑和换绑能力。

#### 场景：绑定外部身份

- 当已登录用户通过一次性绑定 ticket 完成 Provider 授权时
- 则系统必须将该外部身份绑定到当前用户
- 并且不得允许同一 `(provider_code, provider_key, provider_subject)` 绑定到第二个用户
- 并且不得接受客户端直接指定 identity ID 或目标用户 ID 完成绑定

#### 场景：解绑最后一种凭证

- 当用户请求解绑身份且该操作将导致其不再有可用登录凭证时
- 则系统必须明确拒绝请求
- 并且不得删除或禁用该身份关系

### 要求：微信小程序 code 登录
系统必须在配置启用时使用微信小程序 code 解析身份，并复用既有 token 会话链路。

#### 场景：已绑定微信小程序身份登录

- 当微信小程序客户端提交有效 code 且对应身份已绑定启用用户时
- 则系统必须使用 `provider_code=wechat_miniapp`、appid 与 openid 定位身份
- 并且必须按既有登录成功链路签发 token
- 并且不得记录 code、session key、token 或完整 openid

#### 场景：微信小程序登录关闭

- 当 `infoq.auth.wechat-miniapp.enabled=false` 时
- 则系统不得创建微信认证客户端或执行远端调用
- 并且小程序客户端不得展示可用的微信登录入口

## 核查依据与验证边界

当前接口与会话依据为 `AuthController`、`CaptchaController`、`PasswordAuthStrategy`、`EmailAuthStrategy`、`WechatMiniAppAuthStrategy` 及 `SecurityTokenService` / `SecurityTokenStore`。受保护请求须提交与登录一致的 `clientid`，公开 SSE 连接路径由控制器再次校验 token 与 clientId。文档核查不代表已执行真实 Provider、验证码登录或 Redis OSS 运行验证。

`GET /auth/wechat-miniapp/enabled` 的匿名例外仅限该 GET，其他方法和路径继续经过严格认证；测试覆盖实际 Spring Security filter chain。真实 Provider 和 Redis OSS 运行验证须单独取得证据。

### 要求：匿名小程序能力探测精确公开

严格认证启用时，系统必须允许匿名读取 `GET /auth/wechat-miniapp/enabled`，响应必须仅表示功能开关，不泄露 appid、secret、session key 或 Provider 配置；公开规则必须不扩展为 `/auth/wechat-miniapp/**` 或整体关闭认证。

#### 场景：匿名探测开关

- 当无 token 客户端读取小程序能力探测，开关分别为 true 和 false。
- 则系统必须返回对应布尔值，而不是认证失败。
- 并且关闭时必须不创建微信客户端或执行远程身份交换。

#### 场景：匿名访问受保护接口

- 当无 token 客户端访问管理端用户数据或未定义的小程序受保护路径。
- 则系统必须仍拒绝请求，必须 不因新增精确探测例外而放宽认证。

### 要求：英文认证校验消息完整

`messages_en_US.properties`必须提供 `email.code.scene.not.blank`、`email.code.scene.not.valid`、`user.email.already.exists`、`user.forgot.password.invalid` 对应英文消息。

#### 场景：英文认证边界响应

- 当英文 locale 下触发对应验证码场景、重复邮箱或密码找回校验。
- 则系统必须返回可理解的英文消息，必须 不输出未解析消息键或错误语言的 fallback。

### Requirement: 管理端只记用户名并清理历史密码

React 与 Vue 管理端 MUST 将现有记住登录信息交互限定为用户主动选择的用户名；密码 SHALL NOT 被应用写入 `localStorage`、`sessionStorage`、cookie 或其他持久存储。登录页初始化 MUST 清除既有 `password` 项且 MUST NOT 将其读入表单、迁移或编码保存。文案 MUST 明确只记用户名。

#### Scenario: 存在旧的记住密码数据

- **WHEN** 任一管理端登录页初始化，浏览器中已有旧 `username`、`password` 与 `rememberMe`。
- **THEN** 旧密码 MUST 被删除，密码输入 MUST 保持空值，用户名只可按记住用户名语义恢复。
- **AND** 勾选或取消后重新登录与重新加载均 MUST NOT 再写入密码；取消选择 MUST 清理记住的用户名标记。

### Requirement: 双端会话安全修复保持一致生命周期

React 与 Vue MUST 使用一致的、经设计评审的会话安全语义；可用的 bearer token MUST NOT 以明文或可由固定浏览器密钥还原的形式进入持久应用存储。安全修复 MUST 保留有效会话的刷新恢复、密码/OAuth ticket 登录、clientId 校验、退出与既有实时通道合同；`sessionStorage`、base64 或非 HttpOnly cookie MUST NOT 被认定为该风险的完整修复。

管理端 access token SHALL 仅在内存保留，刷新恢复 SHALL 通过范围明确的专用浏览器会话恢复协议完成。既有外部 Bearer API 和 SSE/header/query 认证合同 MUST 保留，普通业务接口 MUST NOT 因该修复自动接受恢复 cookie 作为认证来源；该恢复资源 MUST 校验完整的来源、会话和 CSRF 边界。

#### Scenario: 密码或 OAuth 登录后刷新并退出

- **WHEN** 用户在任一管理端以密码或有效 OAuth ticket 登录，完成用户/权限/路由装载后重新加载，再执行退出。
- **THEN** 有效会话 MUST 按受保护的恢复方案继续认证，MUST 只创建当前会话拥有的实时连接；退出 MUST 清除本地认证状态并关闭连接。
- **AND** 无效、过期、撤销、clientId 不匹配MUST 明确进入未认证流程；403、网络或依赖故障 MUST 显式进入可重试失败状态，MUST NOT 使用旧明文存储回退。

#### Scenario: 最小安全方案需要自动携带 cookie 或新恢复协议

- **WHEN** 修复方案引入 HttpOnly cookie、服务端会话恢复接口或浏览器自动携带凭据。
- **THEN** 设计 MUST 明确 CSRF、同源/跨域 Origin/CORS、Secure/SameSite/Path/TTL、会话撤销和过期、logout、clientId、OAuth/set-token、初次路由异步恢复、受控生产配置、SSE/WebSocket 的行为和验证，MUST 核验原有全局 CSRF 禁用配置的适用性，MUST 保留生产 HTTPS 要求。
- **AND** 超出现有修复授权的信任边界变化 MUST 由主线程明确提出，未获必要确认或缺失主流程证据时 MUST 阻塞 RC；实现 MUST NOT 默默牺牲刷新合同或关闭安全查询。
