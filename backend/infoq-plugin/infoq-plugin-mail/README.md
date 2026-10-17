# infoq-plugin-mail

## 1. 模块职责

提供邮件发送配置与工具能力，按配置决定是否进入运行时。

## 2. 关键入口

- [`MailConfig`](./src/main/java/cc/infoq/common/mail/config/MailConfig.java)
- [`MailProperties`](./src/main/java/cc/infoq/common/mail/config/properties/MailProperties.java)
- [`MailUtils`](./src/main/java/cc/infoq/common/mail/utils/MailUtils.java)

## 3. 核心类 / 文件

- 自动装配入口：[`AutoConfiguration.imports`](./src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports)

## 4. 上游依赖

- `infoq-system` 通过编译依赖接入邮件能力，并在业务层以可选方式调用。

## 5. 下游依赖

- 编译期依赖 `infoq-core-common`。

## 6. 关键配置

- `mail.enabled`
- `mail.*`

## 7. 关键数据流

1. Spring Boot 启动时检查 `mail.enabled`。
2. 开启后装配 `MailConfig` 和相关属性。
3. 业务层通过 `MailUtils` 发送邮件。

## 8. 扩展点

- 新增邮件发送策略或模板工具时，可继续在该模块扩展。

## 9. 日志 / 监控切入点

- 当前模块没有独立监控接口。
- 邮件是否真正可发，需要结合运行配置和业务调用点共同验证。

## 10. 已知边界

- 这里只提供基础邮件能力，不定义业务通知规则。

