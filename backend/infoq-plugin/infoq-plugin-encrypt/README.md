# infoq-plugin-encrypt

## 1. 模块职责

提供两类加解密能力：请求级 API 解密，以及字段级 / MyBatis 级数据加解密。

## 2. 关键入口

- [`ApiDecryptAutoConfiguration`](./src/main/java/cc/infoq/common/encrypt/config/ApiDecryptAutoConfiguration.java)
- [`EncryptorAutoConfiguration`](./src/main/java/cc/infoq/common/encrypt/config/EncryptorAutoConfiguration.java)
- [`CryptoFilter`](./src/main/java/cc/infoq/common/encrypt/filter/CryptoFilter.java)
- [`MybatisEncryptInterceptor`](./src/main/java/cc/infoq/common/encrypt/interceptor/MybatisEncryptInterceptor.java)
- [`MybatisDecryptInterceptor`](./src/main/java/cc/infoq/common/encrypt/interceptor/MybatisDecryptInterceptor.java)

## 3. 核心类 / 文件

- `@ApiEncrypt`：标记需要进入请求解密链的接口。
- `EncryptorManager` / `IEncryptor`：加密器注册与调度。
- `AesEncryptor`、`RsaEncryptor`、`Sm2Encryptor`、`Sm4Encryptor`、`Base64Encryptor`：当前内置算法实现。
- 自动装配入口：[`AutoConfiguration.imports`](./src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports)

## 4. 上游依赖

- `infoq-system` 的登录、注册等接口通过 `@ApiEncrypt` 接入请求解密。
- 持久化字段上的 `@EncryptField` 可进入 MyBatis 加解密拦截链。

## 5. 下游依赖

- 编译期依赖 `infoq-core-common`
- 依赖 Spring Web MVC 与 MyBatis Plus 拦截能力

## 6. 关键配置

- `api-decrypt.enabled`
- `mybatis-encryptor.enable`
- `ApiDecryptProperties`、`EncryptorProperties`

## 7. 关键数据流

1. 带 `@ApiEncrypt` 的请求先经过 `CryptoFilter`。
2. 请求体被解密后才进入 Controller。
3. 持久化读写时，MyBatis 拦截器按字段注解执行加密或解密。

## 8. 扩展点

- 新增算法时可实现 `IEncryptor` 并交由 `EncryptorManager` 管理。
- `@EncryptField` 允许把字段级加解密下沉到数据层。

## 9. 日志 / 监控切入点

- 加解密异常最终会在请求链或 MyBatis 链中暴露为显式失败。
- 对登录故障排查时，这个模块是必须优先确认的入口之一。

## 10. 已知边界

- 该模块不负责鉴权，只负责数据加解密。
- 是否真的启用，要同时看注解使用情况和配置开关。

