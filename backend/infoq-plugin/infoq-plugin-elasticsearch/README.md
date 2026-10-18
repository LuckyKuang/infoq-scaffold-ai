# infoq-plugin-elasticsearch

## 1. 模块定位

`infoq-plugin-elasticsearch` 使用 Elastic 官方 Java API Client 管理可关闭的 Elasticsearch 连接与基础操作边界。它通过中性、不可变的 JSON-compatible `ElasticsearchIndexDefinition` 表达索引 settings/mappings，并提供明确的初始 Alias 绑定与原子切换；它不拥有任何业务索引 schema、查询语义或 MySQL 同步任务。

## 2. 配置与失败语义

```yaml
infoq:
  elasticsearch:
    enabled: false
    required: false
```

- 关闭时不创建 `ElasticsearchClient`、不探测节点、不注册健康检查、不创建索引或同步任务。
- 启用后 URI、账号和密码只能从环境变量或部署 Secret 注入。TLS 使用 `https` URI 与部署进程配置的 JDK trust store；应用级自定义 trust store 不在本模块范围内。
- `required=true` 时连接、认证或 TLS 失败阻止启动；`required=false` 时主应用可运行，但插件状态和操作调用会明确标识不可用。
- 仅连接或 I/O 传输失败会将插件标为不可用并抛出 `ElasticsearchUnavailableException`；mapping、索引/别名冲突或 bulk item 错误抛出 `ElasticsearchOperationException`，不会把健康节点误报为不可用。

## 3. 基础操作边界

- `createIndex(ElasticsearchIndexDefinition)` 在一次 Create Index 请求中传递中性 JSON-compatible settings/mappings。公共接口不暴露 `co.elastic.clients.*` 类型；官方请求类型只在插件内部转换。
- `bindAlias(alias, index)` 仅用于明确的单索引初始绑定；`switchAlias(alias, sourceIndex, targetIndex)` 通过一次 `_aliases` 请求同时移除 source 的 alias 并添加到 target。
- Mapping 字段、业务索引名、源数据快照、回填、同步、Outbox、重试和发布校验仍须由独立业务 OpenSpec 定义。

## 4. 边界

- 本模块不引入 Easy-ES 或 Spring Data Elasticsearch，不将 Elasticsearch 作为主数据源。
- 首个业务索引必须在独立 OpenSpec 中定义事务后同步或 Outbox、幂等 key、回填、重建和别名切换。
- 不记录凭据、Authorization、证书或文档正文；状态只包含可用性、失败类别、批量失败 item 计数与基础操作耗时。
