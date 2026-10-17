# infoq-plugin-oss

## 1. 模块职责

提供 OSS 客户端、配置对象和工厂能力，用于把文件存储配置转换成可复用的上传客户端。

## 2. 关键入口

- [`OssFactory`](./src/main/java/cc/infoq/common/oss/factory/OssFactory.java)
- [`OssClient`](./src/main/java/cc/infoq/common/oss/core/OssClient.java)
- [`OssProperties`](./src/main/java/cc/infoq/common/oss/properties/OssProperties.java)
- [`UploadResult`](./src/main/java/cc/infoq/common/oss/entity/UploadResult.java)

## 3. 核心类 / 文件

- `OssFactory`：按配置 key 构建并缓存 `OssClient`
- `OssConstant`：默认配置键等常量
- `AccessPolicyType`：访问策略枚举
- `WriteOutSubscriber`：上传写出辅助类

## 4. 上游依赖

- `infoq-system` 的 OSS 管理和文件上传相关业务会直接使用该模块。

## 5. 下游依赖

- 编译期依赖 `infoq-plugin-jackson`、`infoq-plugin-redis`
- 运行时依赖 AWS S3 SDK 兼容客户端

## 6. 关键配置

- 当前模块没有独立自动装配入口。
- 真实 OSS 配置来自 Redis 中的系统 OSS 配置缓存与默认配置 key。
- `SYS_OSS_CONFIG` 缓存值只保留 `OssProperties` 所需字段，不写入 `SysOssConfig` 主键、默认状态、审计字段或备注。

## 7. 关键数据流

1. 业务层调用 `OssFactory.instance()` 或 `instance(configKey)`。
2. `OssFactory` 先从 Redis / Cache 读取配置 JSON。
3. 反序列化为 `OssProperties` 后构建或复用 `OssClient`。
4. 上传结果以 `UploadResult` 返回业务层。

## 8. 扩展点

- 可新增不同 OSS 厂商兼容逻辑，只要仍落到 `OssClient` 抽象内。

## 9. 日志 / 监控切入点

- `OssFactory` 在创建新客户端时会输出日志。
- 是否能拿到默认配置 key 与配置缓存，是排障首要切入点。

## 10. 已知边界

- 这是库模块，不依赖 `AutoConfiguration.imports` 自动注册。
- 运行效果强依赖 Redis 中的 OSS 配置数据。
