# Mapper 测试模式

## 适用范围

适用于以下目录下的接口：
- `infoq-core/infoq-core-data/src/main/java/cc/infoq/system/mapper`

仅对包含 Java 侧逻辑或委派的 mapper `default` 方法编写单测。
纯 SQL 声明方法不做单测，应放入集成测试覆盖。

## 模板（default 委派）

```java
@Tag("dev")
class MapperDefaultMethodTest {

    @Test
    void shouldDelegateToBaseMapperMethod() {
        SysMenuMapper mapper = mock(SysMenuMapper.class, withSettings().defaultAnswer(CALLS_REAL_METHODS));
        List<SysMenu> expected = List.of(new SysMenu());
        when(mapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(expected);

        List<SysMenu> actual = mapper.selectMenuTreeAll();

        assertSame(expected, actual);
        verify(mapper).selectList(any(LambdaQueryWrapper.class));
    }
}
```

## 决策规则

- 应写单测：
  - `default` 方法委派到 `selectList/selectVoList/selectVoPage/selectCount/delete/selectVoById`。
  - `default` 方法包含可用 mock 验证的 Java 聚合/转换逻辑。
- 不写单测：
  - 无方法体（`abstract`）且仅承载 SQL 契约的接口方法。
  - 依赖 MyBatis 运行时缓存、在纯 Mockito 场景下不稳定的方法。
  - 纯 SQL 契约改用 `references/mapper-integration-pattern.md`。

## 项目特定说明

- 稳定的 `default` 方法已在 `MapperDefaultMethodTest` 中覆盖。
- 部分方法因 MyBatis lambda 缓存耦合，刻意不在纯单测范围内，应通过集成测试验证。
