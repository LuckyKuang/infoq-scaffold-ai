## ADDED Requirements

### Requirement: 微信小程序使用 miniapp 授权类型

微信小程序 code 登录必须使用 `miniapp` 作为 OAuth 授权类型，客户端授权配置、后端认证策略注册和前端登录请求必须保持一致。

#### Scenario: 小程序登录请求解析

- **WHEN** 微信小程序客户端以有效 code 调用 `POST /auth/login`
- **THEN** 请求必须提交 `grantType=miniapp`
- **AND** 后端必须以 `miniapp` 对应的认证策略处理请求
- **AND** `sys_client` 的 `client_key`、`client_secret`、`device_type` 与授权类型必须为 `miniapp`

#### Scenario: 旧授权类型不受支持

- **WHEN** 登录请求提交 `grantType=xcx`
- **THEN** 后端不得将其解析为微信小程序认证策略
