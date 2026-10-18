# 常见问题

## 1. 后端能启动，但登录一直失败

优先检查：

1. `/auth/code` 是否正常返回验证码。
2. React 或 Vue 管理端的 `clientId` 是否和 `sys_client` 数据一致。
3. 前后端加密开关是否一致。
4. 当前 profile 是否加载了正确的数据库和 Redis 配置。

如果改过 `VITE_APP_ENCRYPT`、RSA 密钥或 `api-decrypt.enabled`，先检查配置是否一致。

## 2. 两个管理端为什么不能同时启动

Vue 和 React 管理端的 `.env.development` 默认都把 `VITE_APP_PORT` 设成 `80`。手动同时启动时，先为其中一个配置不同端口；E2E 自管栈使用 `5173` / `5174`，不冲突。

## 3. 管理端页面能打开，但接口全是 404 或网络错误

优先检查：

- `VITE_APP_BASE_API` 是否仍是 `/dev-api`
- `VITE_APP_PROXY_TARGET` 是否指向正确的后端地址
- 后端是否运行在共享默认端口 `8080`
- 如果本地临时使用其他后端端口，前端代理是否也显式修改

## 4. 我改了 `application-local.yml`，为什么启动时没生效

手动运行 `java -jar` 时，应显式传入 profile：

`application-local.yml` 是可选且被 Git 忽略的本机文件。先确认它已存在，并在修改后重新打包，或通过 Spring 外部配置加载；选择 `local` 不会自动继承 `application-dev.yml` 的依赖连接配置。

```bash
node tools/backend_mvn.mjs -- clean install -DskipTests
java -jar backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=local
```

本地临时端口也必须显式传入，并同步前端代理：

```bash
java -jar backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=local --server.port=8081
```

## 5. 初始化 SQL 里有 `admin` 用户，为什么文档不直接写默认密码

仓库没有单独的用户口令真值文档，真实环境也可能已经修改密码。请以当前数据库数据或实际初始化流程为准，文档不会猜测密码。

## 6. 管理端菜单为空，但登录成功了

优先检查：

- `/system/menu/getRouters` 是否返回数据
- 当前用户角色是否有菜单权限
- `sys_menu` 数据是否完整
- 前端是否能把 `component` 字段映射到实际页面组件

## 7. 我只改了文档，需要跑单元测试吗

纯 Markdown 变更通常没有对应的产品单元测试目标，交付时说明不适用的原因；仍须完成 UTF-8、链接、文件存在性、命令与端口事实核对及 diff review。若同时修改校验器、技能或部署脚本行为，必须执行其相关回归，不能按“纯文档”跳过。全仓方法与已知限制见 [文档审计](./DOCUMENTATION-AUDIT.md)。

## 8. 下一步阅读

- 环境和启动：[`DEV_GUIDE.md`](../DEV_GUIDE.md) 与 [`README.md`](../README.md)
- 架构总览：[`ARCHITECTURE.md`](./ARCHITECTURE.md)
- 协作规则：[`AI-COLLABORATION.md`](./AI-COLLABORATION.md)
