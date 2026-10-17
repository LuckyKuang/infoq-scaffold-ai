# infoq-core-common

## 1. 模块职责

`infoq-core-common` 提供 backend 的基础类型、常量、异常、工具类、线程池与校验配置，以及一组被业务模块和插件共同依赖的服务接口。

## 2. 关键入口

- 配置类：[`ApplicationConfig`](./src/main/java/cc/infoq/common/config/ApplicationConfig.java)、[`ThreadPoolConfig`](./src/main/java/cc/infoq/common/config/ThreadPoolConfig.java)、[`ValidatorConfig`](./src/main/java/cc/infoq/common/config/ValidatorConfig.java)
- 公共返回体：[`ApiResult`](./src/main/java/cc/infoq/common/domain/ApiResult.java)
- 登录模型：[`LoginBody`](./src/main/java/cc/infoq/common/domain/model/LoginBody.java)、[`RegisterBody`](./src/main/java/cc/infoq/common/domain/model/RegisterBody.java)、[`LoginUser`](./src/main/java/cc/infoq/common/domain/model/LoginUser.java)
- 服务契约：`ConfigService`、`DeptService`、`DictService`、`OssService`、`PermissionService`、`PostService`、`RoleService`、`UserService`

## 3. 核心类 / 文件

- `common/constant/*`：缓存名、系统常量、HTTP 状态码、正则常量。
- `common/domain/dto/*`：跨模块传递的 DTO。
- `common/exception/*`：业务异常、文件异常、用户异常。
- `common/utils/*`：日期、字符串、MapStruct、Servlet、SQL、IP、树形构建等工具；其中 IP 归属地查询由 `RegionUtils` 提供，IPv4 使用 `infoq-admin` classpath 中的 `ip2region_v4.xdb`，IPv6 使用 `INFOQ_IP2REGION_V6_PATH` 或 `-Dinfoq.ip2region.v6.path=...` 指向的外置 `ip2region_v6.xdb`。
- `common/validate/*` 与 `common/xss/*`：参数分组校验和 XSS 注解校验。

## 4. 上游依赖

- `infoq-system` 直接使用公共模型、异常、工具和服务接口。
- 多个插件模块依赖这里的常量、工具、服务契约或配置能力。

## 5. 下游依赖

- 该模块没有内部的 `infoq-*` 编译依赖，属于 backend 较底层的共享代码层。
- 运行时会被 `infoq-system` 与 `infoq-plugin-*` 共同装配和调用。

## 6. 关键配置

- `ApplicationConfig` 带 `@EnableAsync(proxyTargetClass = true)`，说明公共异步能力从这里打开。
- 该模块没有独立 `resources` 目录真值文件，更多是 Java 配置与工具类集合。

## 7. 关键数据流

1. 登录、注册、用户、角色、部门等请求先在 `infoq-system` 中解析。
2. 公共输入输出模型、异常和工具由 `infoq-core-common` 提供。
3. 插件层再在这些公共模型和工具之上叠加日志、安全、序列化、加解密等行为。

## 8. 扩展点

- `common/service/*` 是最明确的扩展契约层，允许业务模块提供具体实现。
- `common/validate/*` 与 `common/xss/*` 允许在参数校验和输入过滤层继续扩展。

## 9. 日志 / 监控切入点

- 该模块本身没有独立监控控制器。
- 公共异常、工具和服务契约会被 `infoq-plugin-log`、`infoq-plugin-web`、`infoq-plugin-security` 等插件接入日志与异常处理链。

## 10. 已知边界

- 不包含 Controller、Mapper XML 或业务 Service 实现。
- 这里定义的是公共语义，不等于最终业务行为；真正的落地实现需要看 `infoq-system` 和相关插件。
