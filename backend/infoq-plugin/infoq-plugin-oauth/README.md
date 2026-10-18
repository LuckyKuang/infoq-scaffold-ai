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

## 站内回跳与双端部署

`redirect` 是不含 origin 的浏览器站内路径，可包含当前应用部署前缀一次（例如 `/react/user/profile`）。仅缺省 `null` 使用 `/index`；空白、绝对地址、协议相对地址、点段、反斜杠、控制字符、无效 UTF-8 和多层解码后危险路径均拒绝。校验最多检查 8 层，返回原始 query/hash 编码，不把 `%26` 改写为参数。非法路径不能创建 state 或绑定票据。

双端部署用受控 base 到 callback 的映射，Spring Map 键使用 bracket notation 保留斜杠：

```yaml
oauth:
  frontend-callback-paths:
    '[/react/]': /react/oauth/callback
    '[/vue/]': /vue/oauth/callback
```

按 segment 边界匹配最长前缀，landing 只能来自配置值；非空映射没有匹配项时明确失败。根部署可配置 `'[/]': /oauth/callback`。映射为空时使用单端 `oauth.frontend-callback-path`。多端且没有根映射时，客户端必须提交带应用前缀的目标；未提供目标产生的 `/index` 无法识别所属应用，会在创建 state/ticket 前失败。Provider 拒绝、state 失效等错误在无法安全识别来源端时返回安全通用错误，不猜测另一应用，不再次消费 state；单端仍进入受控错误页。公开错误与日志不包含 Provider 异常 message、token 或凭据。

验证见 [后端生产边界回归](../../doc/production-verification.md)；真实 Provider 与浏览器落地仍需目标环境验收。

## 4. Redisson OSS

pending state 与 login ticket 使用 Redisson OSS 兼容 API。消费操作必须使用原子语义，不得拆成非原子的 `get` 后 `delete`。
