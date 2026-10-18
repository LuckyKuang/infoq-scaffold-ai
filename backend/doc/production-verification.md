# 后端生产边界回归

当认证公开路径、OAuth 回跳、字段翻译、提交后通知、OSS 签名或生产 API RSA 配置变更时，按本 SOP 验证。命令从仓库根执行，使用 JDK 21 和 Maven 3.9.x；临时证据放 `tmp/production-readiness/backend/`。

## 标准步骤

1. 先核主流程：精确 GET 探测、根/子路径授权回跳、真实 Jackson 字段序列化、事务提交后提醒、私有文件签名和生产配置注入。
2. 对修改的业务边界执行下列定向测试；检查 Surefire 每类实际用例、非零退出及总时长，每轮后端目标单测不得超过 60 秒。
3. 构建前执行 `node tools/validate_utf8.mjs backend`；复用相同测试选择器将 `test` 换为 `package`，再审查 diff、冻结 SQL、依赖与日志字段。
4. 在 owned Linux Docker 隔离栈补运行态：严格认证、真实 Provider/微信测试环境、SSE/WebSocket + Redis OSS、私有 MinIO HTTPS 代理签名、无权限 API 和过期签名。缺平台、凭据或依赖时记录 blocked，不能把单测标作该项通过。

```bash
node tools/backend_mvn.mjs -- -pl infoq-admin -am -DskipTests=false -Dsurefire.failIfNoSpecifiedTests=false -Dtest=MiniappSecurityFilterChainTest,SpringSecurityAutoConfigurationTest,OAuthRedirectValidatorTest,OAuthCallbackMappingTest,OAuthFlowServiceTest,AuthControllerTest,OAuthControllerTest,SysOauthLoginServiceImplTest,TranslationHandlerTest,TranslationBeanSerializerModifierTest,TranslationSerializationTest,TranslationConfigTest,TranslationImplementationsTest,DefaultPushServiceTest,PushAutoConfigurationTest,WebSocketClusterUtilsTest,WebSocketUtilsTest,WebSocketTopicListenerTest,SseEmitterManagerTest,SseTopicListenerTest,SysMessagePushListenerTest,MessagePushTransactionTest,SysMessageServiceImplTest,SysNoticeServiceImplTest,ProductionApiKeyValidatorTest,OssClientTest,SysOssServiceImplTest,SysOssControllerTest,SecurityTokenStoreTest,RedisUtilsTest,EnglishAuthenticationMessagesTest test
```

`surefire.failIfNoSpecifiedTests=false` 仅使没有指定类的 reactor 依赖模块可通过；必须核每个目标类实际运行，不能把拼错类名和零用例当作成功。

## 行为与边界

| 对象 | 必须断言 |
| --- | --- |
| 严格认证 | 通过真实 `SecurityFilterChain` 访问精确 GET，POST/未知小程序路径/用户与 OSS 接口匿名仍为 401；能力开关只读布尔值 |
| OAuth | 非法输入不得创建 state/绑定票据；多层编码、错码 UTF-8、点段、控制字符与反斜杠拒绝；正常 query/hash 原样保留；受控 callback map 最长 segment 匹配、未知部署明确失败 |
| 翻译 | 实际 Jackson 3 多字段/重复并发序列化不串注解；null/mapper/普通字段正确；缺实现和异常向调用方失败；实际 OSS translator 被调用；日志与异常不含敏感原值或 cause |
| Push | 真实 Spring 事务事件在 rollback 不发送、commit 后发送；通道独立、关闭/空接收人/不可用/离线/失败有分类；不能断言 Redis publish 等同浏览器收到；日志禁止正文与用户明细 |
| Redis OSS | 使用当前 Redisson OSS 的 `RBatch`、`readAllAsync`、`isExistsAsync` 和 `removeAllAsync`；用户注册与节点心跳分批访问，不引入逐用户网络调用；静态核禁止 PRO-only 符号，真实 OSS 运行仍单独验证 |
| OSS | 实际 SDK 签名使用外部 HTTPS origin、原始 Host 和约 120 秒期限；上传走内部显式 HTTP endpoint，数据库保存无签名元数据；不允许通过 URL rewrite/公开 bucket 绕过 |
| RSA / 英文 | prod 请求解密私钥、响应加密公钥各自至少 2048 位，允许两组独立；四方向配对由统一生产预检验证；英文键通过真实 MessageSource 解析 |

`MessagePushTransactionTest` 使用无外部资源的事务管理器验证 Spring 事件阶段；消息批量持久化由服务测试断言。它不能替代 MySQL 提交后实际可读验收。SDK 签名测试不访问 MinIO，也不能证明 nginx/证书/策略正确。

## 常见反模式与回滚

- 放行整个小程序前缀、关闭严格认证、允许绝对 OAuth URL，或非法 redirect 静默回首页。
- 用同一个可变 contextual serializer、翻译失败返回原值，或把原异常及秘密写入日志。
- 用 mock 断言代替 Jackson/FilterChain/事务事件主流程，删弱断言让测试通过，抬高 60 秒门槛。
- 按接收人逐条查 Redis，发布失败终止另一通道，或日志称 `delivered`。
- 仅改变签名 URL 的 Host/path、把前端两把 RSA 当成一对、把浏览器协议私钥当服务端秘密。

认证放宽、正常翻译/登录回归、秘密泄漏、签名越权或目标测试失败时停止交付并回退对应本次代码。应用回滚保留持久数据，不自动逆向 SQL。当前修复不新增 SQL 或依赖。
