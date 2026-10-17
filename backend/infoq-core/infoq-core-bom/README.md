# infoq-core-bom

## 1. 模块职责

`infoq-core-bom` 是 backend 的依赖管理 BOM，只负责统一 `infoq-core-*` 与 `infoq-plugin-*` 的版本坐标，不提供运行时代码。

## 2. 关键入口

- POM 文件：[`pom.xml`](./pom.xml)

## 3. 核心类 / 文件

- 当前模块没有 `src/main/java` 和 `src/main/resources`。
- `pom.xml` 的 `dependencyManagement` 是唯一真值入口。

## 4. 上游依赖

- 根 `backend/pom.xml` 在 `dependencyManagement` 中导入该 BOM。
- 其他 backend 模块通过父 POM 继承这里的版本管理。

## 5. 下游依赖

- 被管理的主要坐标包括 `infoq-core-common`、`infoq-core-data` 以及一组 `infoq-plugin-*` 模块。

## 6. 关键配置

- 当前模块没有独立运行配置。
- 变更这里只会影响依赖解析与版本，不会直接生成新的运行入口。

## 7. 关键数据流

1. Maven 解析 backend 根 POM。
2. 根 POM 导入 `infoq-core-bom`。
3. 子模块在不显式声明版本号时，使用这里提供的版本真值。

## 8. 扩展点

- 新增 `infoq-core-*` 或 `infoq-plugin-*` 叶子模块时，可在这里补齐统一版本管理。

## 9. 日志 / 监控切入点

- 无独立日志或监控切入点。
- 变更影响面应通过构建和依赖解析结果观察，而不是运行态接口。

## 10. 已知边界

- 它不是运行时模块，不能单独启动。
- 需要理解业务或插件行为时，应回到具体叶子模块文档。

