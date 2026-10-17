# infoq-plugin-translation

## 1. 模块职责

提供返回值翻译能力，把 ID、字典值或外键补齐成可读名称，例如部门名、字典名、用户昵称、OSS URL。

## 2. 关键入口

- [`TranslationConfig`](./src/main/java/cc/infoq/common/translation/config/TranslationConfig.java)
- [`Translation`](./src/main/java/cc/infoq/common/translation/annotation/Translation.java)
- [`TranslationHandler`](./src/main/java/cc/infoq/common/translation/core/handler/TranslationHandler.java)
- [`TranslationBeanSerializerModifier`](./src/main/java/cc/infoq/common/translation/core/handler/TranslationBeanSerializerModifier.java)

## 3. 核心类 / 文件

- `DeptNameTranslationImpl`
- `DictTypeTranslationImpl`
- `OssUrlTranslationImpl`
- `UserNameTranslationImpl`
- `NicknameTranslationImpl`
- 自动装配入口：[`AutoConfiguration.imports`](./src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports)

## 4. 上游依赖

- `infoq-core-data` 的 VO/返回对象可通过注解接入翻译语义。
- `infoq-system` 返回给前端的数据在序列化时会受这里影响。

## 5. 下游依赖

- 编译期依赖 `infoq-plugin-jackson`

## 6. 关键配置

- 当前模块没有独立配置前缀或启停开关。
- 是否翻译取决于 VO 字段注解和对应翻译实现是否存在。

## 7. 关键数据流

1. 返回对象字段使用翻译注解。
2. 序列化阶段进入 `TranslationHandler`。
3. 对应的 `*TranslationImpl` 查询并补齐展示值。

## 8. 扩展点

- `TranslationInterface`
- 自定义 `TranslationType`
- 新的 `*TranslationImpl`

## 9. 日志 / 监控切入点

- 当前模块没有独立监控接口。
- 若返回对象展示值缺失，应优先检查注解和对应实现是否都在 classpath 中。

## 10. 已知边界

- 只处理展示值翻译，不负责原始数据存储。

