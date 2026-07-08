# infoq-core

## 1. 模块定位

`infoq-core` 是 backend 的核心公共层父模块，负责聚合依赖版本、基础类型、共享配置、公共服务契约和数据访问对象定义。

## 2. 子模块清单

- [`infoq-core-bom`](./infoq-core-bom/README.md)：依赖版本和模块坐标管理，POM-only。
- [`infoq-core-common`](./infoq-core-common/README.md)：常量、DTO、异常、工具、基础配置、校验与服务接口。
- [`infoq-core-data`](./infoq-core-data/README.md)：系统域实体、BO/VO、Mapper 与 Mapper XML。

## 3. 子模块职责摘要

| 子模块 | 当前职责 |
| --- | --- |
| `infoq-core-bom` | 统一 core 与 plugin 依赖版本，不提供运行时代码 |
| `infoq-core-common` | 提供被 system 与 plugins 共同复用的基础类型和工具 |
| `infoq-core-data` | 提供 `cc.infoq.system` 域对象与持久化接口定义 |

## 4. 依赖方向

- `infoq-core-common` 是最基础的代码层，多个插件和业务模块直接依赖它。
- `infoq-core-data` 依赖 `infoq-plugin-mybatis`、`infoq-plugin-log`、`infoq-plugin-sensitive`、`infoq-plugin-translation`、`infoq-plugin-excel`、`infoq-plugin-jackson`，说明它不是“纯 POJO 仓库”，而是带持久化与序列化语义的领域数据层。
- `infoq-system` 在业务层直接依赖 `infoq-core-common` 和 `infoq-core-data`。

## 5. 典型调用链

1. 控制器和服务入口位于 `infoq-system`。
2. 请求参数、认证模型、公共返回体等类型来自 `infoq-core-common`。
3. 实体、BO、VO、Mapper 和 XML 查询定义来自 `infoq-core-data`。
4. 持久化、脱敏、翻译、Excel、日志等横切语义由 `infoq-plugin-*` 在数据层或序列化层接入。

## 6. 公共约束

- `infoq-core/pom.xml` 当前声明 `maven.compiler.source/target = 17`，与 backend 根 `pom.xml` 的 `java.version = 17` 保持一致；项目基线是 JDK 17。
- `infoq-core` 自己是父模块，不直接对外暴露 HTTP 接口。
- 叶子模块文档优先于这里的聚合摘要；若描述冲突，以源码为准。

## 7. 已知边界

- 当前 `infoq-core` 只覆盖 `common` 与 `system` 域数据，没有额外业务域拆分。
- 如果后续新增业务模块，其实体和 Mapper 是否继续放在 `infoq-core-data`，需要以未来实际目录结构为准，当前文档不预判。

## 8. 下钻阅读路径

1. 只关心基础类型、工具和服务契约：读 [`infoq-core-common/README.md`](./infoq-core-common/README.md)
2. 只关心 Mapper、Entity、VO/BO 和 XML：读 [`infoq-core-data/README.md`](./infoq-core-data/README.md)
3. 只关心依赖管理与版本坐标：读 [`infoq-core-bom/README.md`](./infoq-core-bom/README.md)

