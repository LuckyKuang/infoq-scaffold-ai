# Service 测试模式

## 适用范围

用于 `cc.infoq.system.service.impl.*` 类，关注 mapper/service 协作与分支条件。

## 模板

```java
@ExtendWith(MockitoExtension.class)
@Tag("dev")
class XxxServiceImplTest {

    @Mock
    private XxxMapper xxxMapper;

    @InjectMocks
    private XxxServiceImpl service;

    @Test
    void shouldReturnNullWhenMissing() {
        when(xxxMapper.selectVoById(1L)).thenReturn(null);
        assertNull(service.queryById(1L));
    }

    @Test
    void shouldHandleBranch() {
        when(xxxMapper.exists(any())).thenReturn(true);
        assertFalse(service.checkUnique(...));
    }
}
```

## 检查清单

- 至少覆盖 1 个正常分支和 1 个异常/空分支。
- 仅在行为依赖时验证 mapper 交互。
- 若测试暴露 `NullPointerException` 或分支泄漏，先修 service 代码再重跑。
