# backend 文档导航

本目录承载 `backend` 的顶层聚合文档，目标是先给出整体理解路径，再把阅读者导向更贴近代码的模块文档。

管理端新增的同源浏览器会话资源、框架 CSRF/Origin/CORS、HttpOnly cookie、受控环境映射和单测 SOP 见 [浏览器恢复会话](./browser-session.md)。

## 推荐阅读顺序

1. [`../README.md`](../README.md)
   先看 backend 顶层概览、关键入口和模块导航。
2. [`architecture.md`](./architecture.md)
   再看模块依赖、自动装配关系、安全与运行时边界。
3. [`data-flow.md`](./data-flow.md)
   最后看登录、路由、用户写链路、日志与监控这些关键数据流。
4. 按主题下钻到父模块聚合文档：
   - [`../infoq-admin/README.md`](../infoq-admin/README.md)
   - [`../infoq-core/README.md`](../infoq-core/README.md)
   - [`../infoq-modules/README.md`](../infoq-modules/README.md)
   - [`../infoq-plugin/README.md`](../infoq-plugin/README.md)

## 文档分层

| 层级 | 位置 | 作用 |
| --- | --- | --- |
| 工作区总览 | `../README.md` | backend 总体定位、模块导航、阅读入口 |
| 顶层专题 | `architecture.md`、`data-flow.md` | 模块关系与关键链路摘要 |
| 父模块聚合 | `../infoq-admin/README.md`、`../infoq-core/README.md`、`../infoq-modules/README.md`、`../infoq-plugin/README.md` | 聚合子模块职责、依赖方向和下钻路径 |
| 叶子模块真值 | 各模块目录下 `README.md` | 最贴近源码的职责、入口、配置、数据流、边界说明 |

## 主题下钻路径

- 启动、profile、打包：[`../infoq-admin/README.md`](../infoq-admin/README.md)
- 公共类型、Entity、BO/VO、Mapper、XML：[`../infoq-core/README.md`](../infoq-core/README.md)
- 登录、系统管理、监控、runner、listener：[`../infoq-modules/README.md`](../infoq-modules/README.md)
- Web、安全、Redis、Spring Security、MyBatis、日志、SSE、WebSocket、Quartz、OSS、Excel：[`../infoq-plugin/README.md`](../infoq-plugin/README.md)

## 同步规则摘要

- 影响模块职责、入口、依赖方向、关键数据流、关键配置、自动装配、SQL/持久化语义、现有日志/监控切入点时，先更新叶子模块文档，再更新父模块聚合文档，最后视影响范围更新这里和 backend 顶层 README。
- 纯内部重构、注释、格式化、测试补充或不改变语义的命名微调，不要求层层同步。
- 多层文档冲突时，以源码和离代码最近的叶子模块文档为准。


## 生产边界回归

[production-verification.md](./production-verification.md) 记录安全/OAuth、翻译、提交后 Push、OSS 签名、英文消息和生产 RSA 的复用测试步骤及真实环境边界。
