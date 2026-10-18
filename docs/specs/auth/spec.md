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
- 则客户端必须继续使用该 token 请求 `/system/user/getInfo`
- 并且 admin 客户端必须继续请求 `/system/menu/getRouters`
- 并且后续权限、角色和动态路由必须以后续接口返回值为准

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
