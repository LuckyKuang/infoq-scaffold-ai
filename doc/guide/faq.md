# 常见问题

## 1. 后端能启动，但登录一直失败

优先检查这四项：

1. `/auth/code` 是否正常返回验证码。
2. 前端或小程序的 `clientId` 是否和 `sys_client` 数据一致。
3. 前后端加密开关是否一致。
4. 当前使用的 profile 是否加载了正确的数据库和 Redis 配置。

如果你改过 `VITE_APP_ENCRYPT`、`TARO_APP_ENCRYPT`、RSA 密钥或 `api-decrypt.enabled`，先假设是配置不一致，不要先怀疑页面代码。

## 2. 多个管理端为什么不能同时启动

因为 Vue、React 和 React Pro 管理端的 `.env.development` 默认都把 `VITE_APP_PORT` 设成了 `80`。如果你需要同时启动多个 dev server，先修改其中至少一个端口，再分别运行。

React Pro 的 `pnpm run dev` 会在 Umi Max dev server ready 后自动打开浏览器；如需关闭，执行 `pnpm run dev -- --no-open`。

## 3. 管理端页面能打开，但接口全是 404 或网络错误

优先检查：

- `VITE_APP_BASE_API` 是否仍是 `/dev-api`
- `VITE_APP_PROXY_TARGET` 是否指向了正确的后端地址
- 后端是否真的运行在共享默认端口 `8080`
- 如果你本地为了避开冲突临时把 backend 改到 `8081` 或其他端口，前端代理是否也一起显式改掉了

这类问题通常不是页面逻辑 bug，而是代理目标没对齐。

## 4. 我改了 `application-local.yml`，为什么启动时没生效

如果你是手动直跑 `java -jar`，不显式传 `--spring.profiles.active=local` 时仍会落到 `dev`。如果你是用仓库本地联调脚本，`start_admin_dev_stack.mjs` 和 `run_admin_e2e.mjs` 会在存在 `application-local.yml` 时优先选择 `local`。

错误示例：

```bash
node .codex/scripts/backend_mvn.mjs -- clean install -DskipTests
java -jar infoq-scaffold-backend/infoq-admin/target/infoq-admin.jar
```

正确示例：

```bash
node .codex/scripts/backend_mvn.mjs -- clean install -DskipTests
java -jar infoq-scaffold-backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=local
```

若你本地还临时避开了 `8080` 端口冲突，再继续显式传端口，并同步前端代理：

```bash
java -jar infoq-scaffold-backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=local --server.port=8081 --captcha.enable=false
```

这类 `8081` 只是本地 override，不是共享真值。提交前要恢复共享默认 `8080`，并让运行态脚本通过 `--backend-port` 之类的显式参数处理本地差异。

## 5. 小程序端为什么报缺少 `TARO_APP_API_ORIGIN`

当 `TARO_APP_MINI_BASE_API` 不是绝对 URL 时，小程序端必须知道后端的完整域名或地址，这就是 `TARO_APP_API_ORIGIN` 的作用。没有它，请求层不知道该把相对地址拼到哪里，所以会直接失败。

## 6. `build-open:weapp:dev` 为什么报 AppID 非法

`script/build-open-wechat-devtools.mjs` 会显式校验 AppID：

- 空值不行
- `touristappid` 不行
- 非真实小程序 AppID 不行

解决方式：

- 在 `.env.development` 写真实 `TARO_APP_ID`
- 或命令行显式传 `--appid <wx...>`

## 7. 微信开发者工具提示“请求域名不在合法域名列表”

这通常和代码本身无关，优先检查：

- `TARO_APP_API_ORIGIN`
- 小程序后台合法域名配置
- 微信开发者工具本地项目的域名校验设置

如果只是本地联调，需要明确知道当前环境是否允许关闭 `urlCheck`。不要一边要求严格域名校验，一边又用未备案的本地地址。

## 8. 初始化 SQL 里有 `admin` 用户，为什么文档不直接写默认密码

因为仓库里没有单独给出“用户口令真值文档”，而真实环境可能不是全新 SQL 导入，也可能已经改过密码。文档不应该猜密码；如果你需要可登录账号，请以当前数据库数据或实际初始化流程为准。

## 9. 管理端菜单为空，但登录成功了

优先检查：

- `/system/menu/getRouters` 是否返回了数据
- 当前用户角色是否有菜单权限
- `sys_menu` 数据是否完整
- 前端是否能把 `component` 字段映射到实际页面组件

## 10. 小程序端 build 成功，但 DevTools 打不开

`build-open-weapp` 不是只 build 一次就结束，它还要：

- 定位构建产物
- 生成或修补 `project.config.json`
- 找到微信开发者工具 CLI
- 调用 CLI 打开项目

所以这里的故障点通常是：

- CLI 没装或路径不可见
- 构建产物目录不对
- AppID 不合法
- `project.config.json` 被 DevTools 覆盖后设置不一致

## 11. 我只改了文档，需要跑单元测试吗

纯文档变更一般没有对应的单元测试目标，但仍然建议至少做：

- 文档链接自检
- 文件存在性检查
- diff review

如果文档里包含命令、端口、环境变量或部署路径，必须以真实文件和脚本为准，不能手写猜测值。

## 12. 我要继续深挖哪个文档

- 环境和启动：[`quick-start.md`](./quick-start.md)
- 后端结构：[`backend-handbook.md`](../backend/handbook.md)
- 管理端结构：[`admin-handbook.md`](../admin/handbook.md)
- 小程序结构：[`weapp-handbook.md`](../weapp/handbook.md)
- 协作规则：[`development-workflow.md`](../collaboration/development-workflow.md)
