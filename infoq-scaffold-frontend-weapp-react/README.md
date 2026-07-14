# infoq-scaffold-frontend-weapp-react

这份 README 只描述 `infoq-scaffold-frontend-weapp-react` 当前仓库实现，不把它抽象成通用 Taro 模板。

## 当前实现概览

`infoq-scaffold-frontend-weapp-react` 是当前仓库的 Taro + React 小程序工作区，同时覆盖 H5 和微信小程序目标。应用入口是 `src/app.ts`，页面注册入口是 `src/app.config.ts`；请求统一走 `src/api/request.ts`，会话状态集中在 `src/store/session.ts`，页面访问控制目前主要通过各页面主动调用 `loadSession()` 和权限判断完成。

当前代码能直接确认的几个关键事实：

- `src/app.config.ts` 显式注册 `home/login/profile/notices/admin/system-*/monitor-*` 页面。
- `src/api/request.ts` 统一处理 `clientid`、`Authorization`、运行时 `x-client-key` / `x-device-type` 头、可选加密、重复提交拦截和错误归一化。
- `src/store/session.ts` 登录时会先拿 token，再调用 `getInfo()` 补齐用户与权限；登出时会显式清理本地 token。
- 当前没有中心化路由守卫；`home/admin/system/monitor/notice/profile` 等页面会在页面层自行调用 `loadSession()`，并按权限结果决定是否继续。
- `package.json` 内置 `build-open:weapp*`、`test:e2e:weapp:*` 和 `verify:local`，用于小程序 DevTools 与 e2e 验证闭环。

## 模块导航

| 模块 | 当前职责 | 主要证据 |
| --- | --- | --- |
| `src/api` | 请求封装、接口契约与环境桥接 | [`src/api/README.md`](./src/api/README.md) |
| `src/store` | 登录态、用户信息与权限缓存 | [`src/store/README.md`](./src/store/README.md) |
| `src/pages` | 公共页、管理台页、系统管理页、监控页 | [`src/pages/README.md`](./src/pages/README.md) |
| `src/components`、`src/utils` | 底部导航、UI 组件、导航与权限辅助 | [`src/README.md`](./src/README.md) |

## 建议阅读顺序

1. [`doc/architecture.md`](./doc/architecture.md)
   先看页面注册、请求层、会话层和 H5/weapp 运行时分界。
2. [`doc/data-flow.md`](./doc/data-flow.md)
   再看登录、页面级鉴权和典型请求链路。
3. [`src/README.md`](./src/README.md)
   最后按 `src/` 模块入口继续下钻。

## 常用命令

```bash
pnpm install
pnpm run test
pnpm run test:coverage
pnpm run build:h5
pnpm run build:weapp
pnpm run build:weapp:dev
pnpm run dev:weapp
pnpm run build-open:weapp
pnpm run build-open:weapp:dev
pnpm run test:e2e:weapp
pnpm run test:e2e:weapp:core
pnpm run test:e2e:weapp:full
pnpm run verify:local
```

## 运行与验证细节

### 本地测试闭环

- `pnpm run test:e2e:weapp` 是 smoke alias，对应 `tests/e2e/weapp/runner.mjs --suite smoke`。
- `pnpm run test:e2e:weapp:core` 默认关闭后端自动登录（`WEAPP_E2E_AUTO_LOGIN=false`），用于稳定验证“未注入 token 时的公开路由回退”。
- `pnpm run test:e2e:weapp:core:backend` 才会启用真实后端自动登录链路；如果 `/auth/code` 返回 `captchaEnabled=true`，runner 会显式失败并要求临时关闭验证码。
- `pnpm run test:e2e:weapp:full` 会自动开启 report 输出到 `tests/e2e/weapp/reports/`，而且 `full` 套件只要出现 skipped case 就按失败处理。
- `pnpm run verify:local` 是当前工作区最接近完整回归的命令，顺序固定为 `test -> build:weapp:dev -> test:e2e:weapp:core -> build:weapp`。

### WeChat DevTools 与 e2e 前置

- `build-open:weapp*` 和 `tests/e2e/weapp/*` 都依赖真实的 WeChat DevTools CLI；找不到 CLI 时会显式失败。非标准安装路径需要设置 `WECHAT_DEVTOOLS_CLI`。
- `script/build-open-wechat-devtools.mjs` 支持 `--appid <wx...>`、shell 里的 `TARO_APP_ID`，或工作区 `.env.production` / `.env.development` 里的 `TARO_APP_ID`；`touristappid` 会被脚本直接拒绝。
- `WECHAT_DEVTOOLS_URL_CHECK` 默认等价于关闭合法域名校验；脚本会同步补丁到 `dist/project.config.json`、`dist/project.private.config.json` 以及本机 DevTools 项目设置。
- `.env.development` 当前保留 `TARO_APP_BASE_API=/dev-api` 给 H5 代理，同时把 `TARO_APP_MINI_BASE_API` 留空，让小程序直连 `TARO_APP_API_ORIGIN`。
- e2e 关键环境变量集中在 [`tests/e2e/weapp/config.mjs`](./tests/e2e/weapp/config.mjs)：`WEAPP_E2E_TOKEN`、`WEAPP_E2E_AUTO_LOGIN*`、`WEAPP_E2E_KEEP_EXISTING_SESSION`、`WEAPP_E2E_BASE_URL`、`WEAPP_E2E_API_ORIGIN`、`WEAPP_E2E_MINI_BASE_API`、`WEAPP_E2E_CLIENT_ID`、`WEAPP_E2E_RSA_PUBLIC_KEY`、`WEAPP_E2E_REPORT*`、`WEAPP_E2E_EXTRA_ROUTES`、`WEAPP_E2E_FAIL_ON_CONSOLE_ERROR`。
- 当前 `pnpm install` 还会应用本地补丁 `patches/jsencrypt@3.5.4.patch`，因此排查加密或构建差异时不能忽略 `patches/`。

### 显式失败规则

- 缺少 `dist/project.config.json`、不支持的 suite / CLI 参数、或 DevTools runtime 抛出 `console.error` / exception 时，runner 默认直接失败。
- 当 `WEAPP_E2E_TOKEN` 已注入但受保护路由仍回退到公开入口时，e2e 会把它视为鉴权失败而不是容忍 fallback。
- 小程序请求域名、本地 `TARO_APP_API_ORIGIN` / `TARO_APP_MINI_BASE_API` 与自动登录参数不完整时，相关脚本会给出显式配置错误，不会静默跳过。

## 当前实现提醒

- `build-open:weapp*` 依赖真实的 AppID；`touristappid` 只是占位值，不能作为正式启动参数。
- 小程序请求域名校验、本地 `TARO_APP_API_ORIGIN` / `TARO_APP_MINI_BASE_API` 以及 e2e 自动登录细节，仍以 `.env.*`、`package.json` 和 `tests/e2e/weapp/*` 当前实现为准。
- 小程序端错误文案禁止退化成 `[object Object]`；相关归一化逻辑在 `src/api/request.ts`。

## P1-P3 微信登录与消息盒子

- 登录页只在 `weapp` 运行时探测 `GET /auth/wechat-miniapp/enabled`。后端和 Provider 均启用后才显示微信入口，并通过既有加密登录链路提交 `grantType=xcx` 与 `Taro.login()` 的 code；H5 不显示不可用入口。
- `pages/messages` 是个人持久化收件箱，个人资料页提供入口和未读数。消息分页、阅读、全部已读和软删除均调用 `/system/message/*`；应用启动和前台恢复会刷新未读数。
- 小程序不建立 SSE/WebSocket 连接。个人资料上的微信绑定状态和消息未读数都以服务端 API 为准。
