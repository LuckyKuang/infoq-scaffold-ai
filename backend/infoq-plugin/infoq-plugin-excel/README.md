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

