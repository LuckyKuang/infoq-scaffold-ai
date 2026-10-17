# infoq-plugin-oauth

## 1. 模块职责

`infoq-plugin-oauth` 提供 OAuth/OIDC 登录协议能力，包括 provider adapter、授权地址构造、pending state、PKCE、userinfo 标准化和一次性 login ticket。

## 2. 边界

- 本模块不查询或创建本地用户。
- 本模块不保存第三方长期 token。
- 本模块不签发本系统 token。
- 本模块不依赖 `infoq-system` 的 entity、mapper 或 service。

本地用户、provider DB 开关、自动注册、身份绑定和 `SecurityTokenService` 签发由 `infoq-system` 负责。

## 3. 开关

配置键为 `oauth.enabled`，默认 `false`。关闭时业务接口必须显式失败或不展示入口。

GitHub adapter 会读取 `/user` 与 `/user/emails`，邮箱只采信 `primary=true` 且 `verified=true` 的地址；隐藏邮箱或未验证邮箱不会影响基于 numeric id 的身份绑定。

## 4. Redisson OSS

pending state 与 login ticket 使用 Redisson OSS 兼容 API。消费操作必须使用原子语义，不得拆成非原子的 `get` 后 `delete`。
