# infoq-plugin-excel

## 1. 模块职责

提供 Excel 导入导出相关注解、转换器、监听器、写入处理器和工具类，属于库型模块。

## 2. 关键入口

- [`ExcelUtil`](./src/main/java/cc/infoq/common/excel/utils/ExcelUtil.java)
- `annotation/*`
- `convert/*`
- `core/*`
- `handler/DataWriteHandler`

## 3. 核心类 / 文件

- `ExcelUtil`：导入导出主工具入口。
- `DefaultExcelListener` / `DefaultExcelResult`：默认导入结果封装。
- `ExcelDictConvert`、`ExcelEnumConvert`、`ExcelBigNumberConvert`：导入导出转换器。
- `ExcelDownHandler`、`CellMergeStrategy`、`DataWriteHandler`：下拉框、合并单元格和写入处理。

## 4. 上游依赖

- `infoq-core-data` 在数据层直接依赖它，说明部分 VO/导出语义已与 Excel 能力绑定。
- 业务导入导出逻辑通常由 `infoq-system` Service 或 Controller 调用。

## 5. 下游依赖

- 编译期依赖 `infoq-plugin-jackson`
- 运行时主要基于 `fastexcel`

## 6. 关键配置

- 当前模块没有独立 `@ConfigurationProperties` 或自动装配开关。
- 是否生效主要取决于业务代码是否调用 `ExcelUtil` 或使用相关注解。

## 7. 关键数据流

1. 业务层传入带 Excel 注解的类型。
2. `ExcelUtil` 读取或输出流。
3. 转换器、监听器、下拉框与单元格处理器参与导入导出过程。

## 8. 扩展点

- `ExcelListener`
- `ExcelOptionsProvider`
- 自定义注解与转换器

## 9. 日志 / 监控切入点

- 当前模块没有独立监控接口。
- 导入导出异常一般在调用端直接暴露。

## 10. 已知边界

- 这是库模块，不会因为 Spring Boot 启动自动注册 HTTP 能力。
- 是否使用以具体业务代码为准。

## 11. 导入与监听器单测 SOP

触发条件：修改 `ExcelUtil`、`DefaultExcelListener`、导入校验、JSON 序列化或其测试上下文时。

默认监听器解析表头会调用 `JsonUtils`，后者在类初始化时从 Spring 获取真实 `tools.jackson.databind.ObjectMapper`；启用导入校验时，`ValidatorUtils` 同样需要真实 `Validator`。测试必须自行注册其依赖，不能依赖其他测试先初始化静态工具，也不能用产品 fallback、静态 mock 或更改日志级别隐藏缺失依赖。

1. 从仓库根先清理 Excel 模块，再在全新测试 JVM 中按 CI 暴露的顺序运行：`ExcelUtilTest` 在 `DefaultExcelListenerTest` 之前。祖先模块只用于解析编译依赖，缺失指定测试不算失败，但 Excel 目标必须实际运行 9 项、零跳过。

```bash
node tools/backend_mvn.mjs -- -Pdev -pl infoq-plugin/infoq-plugin-excel clean
node tools/backend_mvn.mjs -- -Pdev -pl infoq-plugin/infoq-plugin-excel -am -DskipTests=false -Dtest=ExcelUtilTest,DefaultExcelListenerTest -Dsurefire.runOrder=reversealphabetical -Dsurefire.failIfNoSpecifiedTests=false test
```

2. 再运行本模块全部测试，并用正序复核不同类初始化顺序；每个命令启动独立测试 JVM，不能在已经发生 `ExceptionInInitializerError` 的 JVM 内重试。

```bash
node tools/backend_mvn.mjs -- -Pdev -pl infoq-plugin/infoq-plugin-excel -am -DskipTests=false '-Dtest=cc.infoq.common.excel.**.*Test' -Dsurefire.runOrder=alphabetical -Dsurefire.failIfNoSpecifiedTests=false test
```

3. 核对非零测试数量、退出码与总测试时间小于 60 秒，保留导入行数、转换/校验异常内容等业务断言。修改上述两个测试的上下文时，必须在退出时关闭 owned context、关闭创建的 `ValidatorFactory`，并恢复原 `SpringUtils` context 引用，不能留下已关闭的测试容器污染下一类。
4. 执行 `node tools/validate_utf8.mjs backend/infoq-plugin/infoq-plugin-excel` 与 `git diff --check`。命令、红绿结果与 Surefire 数量/时间保存在仓库 `tmp/`；CI 全量构建仍由仓库现有门禁执行。

故障判断：首次漏注册 mapper 会使 `JsonUtils` 初始化失败，随后其他测试的 `NoClassDefFoundError` 是同一次失败的后果；补注册应修在首个拥有上下文的测试。禁止将后续测试挪到前面作为修复、反射重置 static final 字段、跳过监听器或削弱异常断言。

