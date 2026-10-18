# Mapper XML 集成测试模式

## 目录

- 适用范围
- 依赖
- 模板
- 命名与拆分规则
- SQL Fixture 规则
- Page 返回方法

## 适用范围

适用于以下目录中仅声明型 mapper 方法：
- `infoq-core/infoq-core-data/src/main/java/cc/infoq/system/mapper`

这类方法是由 XML 驱动的 SQL 契约，应通过集成测试验证，不适合仅用 Mockito 单测。

## 依赖

`backend/infoq-modules/infoq-system/pom.xml` 已包含以下测试依赖。复用现有配置，不要重复添加；MyBatis starter 与当前 Spring Boot 4 基线配套使用 `4.0.0`：

```xml
<dependency>
  <groupId>com.h2database</groupId>
  <artifactId>h2</artifactId>
  <scope>test</scope>
</dependency>
<dependency>
  <groupId>org.mybatis.spring.boot</groupId>
  <artifactId>mybatis-spring-boot-starter</artifactId>
  <version>4.0.0</version>
  <scope>test</scope>
</dependency>
<dependency>
  <groupId>org.mybatis.spring.boot</groupId>
  <artifactId>mybatis-spring-boot-starter-test</artifactId>
  <version>4.0.0</version>
  <scope>test</scope>
</dependency>
```

## 模板

组合注解已在 `backend/infoq-modules/infoq-system/src/test/java/cc/infoq/system/mapper/support/MapperXmlIT.java` 实现，以下为其结构说明。新增测试直接复用 `@MapperXmlIT`，无需再建一份注解。

```java
// src/test/java/cc/infoq/system/mapper/support/MapperXmlIT.java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@Tag("dev")
@MybatisTest
@Import(MapperXmlIT.MapperXmlScanConfig.class)
@TestPropertySource(properties = {
    "spring.datasource.url=jdbc:h2:mem:mapper_it;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "mybatis.mapper-locations=classpath*:mapper/system/*Mapper.xml",
    "mybatis.configuration.map-underscore-to-camel-case=true",
    "mybatis-plus.mapper-locations=classpath*:mapper/system/*Mapper.xml",
    "mybatis-plus.configuration.map-underscore-to-camel-case=true"
})
@Sql(
    scripts = {
        "classpath:sql/mapper-it/schema.sql",
        "classpath:sql/mapper-it/data.sql"
    },
    executionPhase = Sql.ExecutionPhase.BEFORE_TEST_METHOD
)
public @interface MapperXmlIT {

    @TestConfiguration(proxyBeanMethods = false)
    @MapperScan("cc.infoq.system.mapper")
    class MapperXmlScanConfig {
    }
}
```

```java
// src/test/java/cc/infoq/system/mapper/xml/SysDictDataMapperXmlIntegrationTest.java
@MapperXmlIT
class SysDictDataMapperXmlIntegrationTest {

    @Autowired
    private SysDictDataMapper sysDictDataMapper;

    @Test
    void selectDictDataByTypeShouldReturnSortedRows() {
        List<SysDictDataVo> rows = sysDictDataMapper.selectDictDataByType("sys_yes_no");

        assertThat(rows).hasSize(2);
        assertThat(rows).extracting(SysDictDataVo::getDictValue).containsExactly("Y", "N");
    }
}
```

## 命名与拆分规则

- mapper XML 集成测试放在 `src/test/java/cc/infoq/system/mapper/xml`。
- 每个 mapper 契约对应一个测试类：`Sys<Domain>MapperXmlIntegrationTest`。
- 断言尽量聚焦单 mapper（若查询跨两个强耦合 mapper，可在一个类内联合断言）。

## SQL Fixture 规则

- 创建隔离测试脚本：
  - `src/test/resources/sql/<suite>/schema.sql`
  - `src/test/resources/sql/<suite>/data.sql`
- 仅保留目标查询所需表/列。
- 仅注入必要数据行，用于验证筛选、排序、关联、空值/空集分支。
- 本仓默认 fixture 路径是 `sql/mapper-it/{schema.sql,data.sql}`（由 `@MapperXmlIT` 指定）；仅在断言冲突时切换为专用 suite fixtures。

## Page 返回方法

对于 mapper 签名返回 `Page<T>` 的 XML 语句，`@MybatisTest` 切片可能缺失 MyBatis-Plus 分页运行时行为。
此时可通过 `SqlSessionTemplate` 验证 SQL 语义：

```java
List<SysUserVo> rows = sqlSessionTemplate.selectList(
    "cc.infoq.system.mapper.SysUserMapper.selectAllocatedList",
    Map.of("ew", wrapper)
);
```

该方式可验证 XML SQL 与 wrapper 行为，且不绑定运行时分页拦截器。
