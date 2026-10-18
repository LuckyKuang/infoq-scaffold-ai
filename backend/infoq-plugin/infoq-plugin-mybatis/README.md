# infoq-plugin-mybatis

## 1. 模块职责

统一 backend 的 MyBatis-Plus、多数据源、分页、数据权限、事务和元字段填充能力。

## 2. 关键入口

- [`MybatisPlusConfig`](./src/main/java/cc/infoq/common/mybatis/config/MybatisPlusConfig.java)
- `BaseEntity`、`BaseMapperPlus`
- `PageQuery`、`TableDataInfo`
- `DataPermissionAdvice`、`PlusDataPermissionInterceptor`

## 3. 核心类 / 文件

- `MybatisPlusConfig`：`@EnableTransactionManagement` 与 `@MapperScan("${mybatis-plus.mapperPackage}")`
- `InjectionMetaObjectHandler`：填充公共字段
- `MybatisExceptionHandler`：MyBatis 异常处理
- `DataPermission*`：数据权限注解、切点、拦截器
- 资源文件：[`common-mybatis.yml`](./src/main/resources/common-mybatis.yml)、[`spy.properties`](./src/main/resources/spy.properties)

## 4. 上游依赖

- `infoq-core-data` 直接依赖该模块提供的 BaseMapper、BaseEntity 和持久化基础设施。
- `infoq-system` 的所有持久化链路最终都会走这里的配置。

## 5. 下游依赖

- 编译期依赖 `infoq-core-common`、`infoq-plugin-security`
- 依赖 dynamic-datasource、MyBatis-Plus、p6spy

## 6. 关键配置

- `mybatis-plus.mapperPackage`
- `common-mybatis.yml` 与 `spy.properties`
- 数据源与 p6spy 相关配置由上层 `application*.yml` 配合提供

## 7. 关键数据流

1. 启动时自动扫描 Mapper 包。
2. Service 调用 Mapper 时统一走 MyBatis-Plus 配置。
3. 数据权限、分页、异常处理、元字段填充在这一层接入。

## 8. 扩展点

- `BaseMapperPlus`
- `BaseEntity`
- `DataPermission` 注解与数据权限处理链

## 9. 日志 / 监控切入点

- SQL 行为、异常处理和多数据源接线从这里进入。
- 数据源监控接口虽在 `infoq-system`，但底层连接池与 Mapper 扫描规则依赖这里。

## 10. 已知边界

- 它负责持久化基础设施，不负责具体业务 SQL；真实 SQL 仍在 `infoq-core-data` 的 Mapper XML。

