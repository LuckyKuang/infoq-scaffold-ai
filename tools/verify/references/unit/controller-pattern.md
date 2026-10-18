# Controller 测试模式

## 适用范围

用于 `cc.infoq.system.controller.*` 类，重点测试 `ApiResult` 映射与 guard clause。

## 模板

以下是结构示意，`Xxx*`、`bo` 和业务方法须替换为目标真实类型与有效输入；它不是可直接编译的完整测试文件。可复用实例见 `backend/infoq-modules/infoq-system/src/test/java/cc/infoq/system/controller/system/SysMenuControllerTest.java`。

```java
@ExtendWith(MockitoExtension.class)
@Tag("dev")
class XxxControllerTest {

    @Mock
    private XxxService service;

    @InjectMocks
    private XxxController controller;

    @Test
    void addShouldFailWhenDuplicate() {
        when(service.checkUnique(any())).thenReturn(false);
        ApiResult<Void> result = controller.add(bo);
        assertEquals(ApiResult.FAIL, result.getCode());
    }

    @Test
    void addShouldSucceed() {
        when(service.checkUnique(any())).thenReturn(true);
        when(service.insertByBo(any())).thenReturn(true);
        ApiResult<Void> result = controller.add(bo);
        assertEquals(ApiResult.SUCCESS, result.getCode());
    }
}
```

## 检查清单

- 对失败场景同时断言 `code` 与关键 `msg` 片段。
- 每类 endpoint 至少覆盖 1 条成功路径和 1 条失败路径。
- controller 测试保持轻量（默认不引入完整 `@SpringBootTest`）。
