# infoq-modules

## 1. 模块定位

`infoq-modules` 是 backend 的业务模块父层，当前只包含 `infoq-system`，用于承载对外 Controller、业务 Service 实现、监听器、启动 runner 和与插件能力的业务级接线。

## 2. 子模块清单

- [`infoq-system`](./infoq-system/README.md)：当前唯一的系统管理与监控业务模块。

## 3. 子模块职责摘要

| 子模块 | 当前职责 |
| --- | --- |
| `infoq-system` | 登录、注册、OAuth 身份关系、微信小程序认证、个人消息盒子、首页、用户角色菜单部门岗位、字典参数通知、OSS、客户端、在线用户、日志、缓存、服务监控、数据源监控、定时任务 |

## 4. 依赖方向

- `infoq-system` 直接依赖 `infoq-core-common`、`infoq-core-data`。
- 业务能力再按需接入 `oss`、`security`、`web`、`doc`、`encrypt`、`sse`、`push`、`quartz`、`mail`、`websocket` 等插件。
- `infoq-admin` 只直接依赖 `infoq-system`，说明业务模块是启动入口与基础设施之间的业务桥梁。

## 5. 典型调用链

1. `infoq-admin` 启动 Spring 容器。
2. HTTP 请求先进入 `infoq-system/controller/*`。
3. 业务 Service 实现调用 `infoq-core-data` Mapper 与 `infoq-core-common` 工具/契约。
4. 安全、日志、缓存、加解密、监控等横切能力由 `infoq-plugin-*` 在运行时介入。

## 6. 公共约束

- 当前 `infoq-modules` 只有 `infoq-system` 一个子模块，不应在聚合文档里假设还有其他业务域。
- 是否启用 Quartz 相关控制器和 runner，需要以 `infoq.quartz.enabled` 的当前配置值为准。

## 7. 已知边界

- 父模块本身没有业务代码，只承载 reactor 结构。
- 未来新增业务模块时，应先在这里新增子模块，再补聚合文档，而不是直接修改本文档做前瞻假设。

## 8. 下钻阅读路径

- 业务接口、服务实现、监听器与运行时接线：读 [`infoq-system/README.md`](./infoq-system/README.md)

