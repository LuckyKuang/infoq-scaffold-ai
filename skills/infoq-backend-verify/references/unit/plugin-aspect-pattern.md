# Plugin 与 Aspect 测试模式

## 适用范围

用于无需完整运行时装配即可测试的 `infoq-plugin-*` 工具类与 aspect 类。

## Plugin 工具类模板

```java
@Tag("dev")
class PageAndTableDataInfoTest {

    @Test
    void pageQueryBuildShouldUseDefaults() {
        PageQuery query = new PageQuery(null, null);
        Page<String> page = query.build();
        assertEquals(PageQuery.DEFAULT_PAGE_NUM, page.getCurrent());
    }
}
```

## Aspect 辅助方法模板

```java
@Tag("dev")
class RepeatSubmitAspectTest {

    private final RepeatSubmitAspect aspect = new RepeatSubmitAspect();

    @Test
    void isFilterObjectShouldReturnTrueForMultipart() {
        MultipartFile file = mock(MultipartFile.class);
        assertTrue(aspect.isFilterObject(file));
    }
}
```

## 检查清单

- 优先覆盖纯方法（`build`、辅助谓词、格式化方法）。
- 对依赖运行时上下文的 AOP 切点逻辑，先拆分并验证辅助方法。
- 仅当辅助层测试不足以覆盖核心风险时，再补集成测试。
