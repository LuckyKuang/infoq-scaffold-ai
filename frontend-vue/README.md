# frontend-vue

这份 README 只描述 `frontend-vue` 当前仓库实现，不把它抽象成通用 Vue 管理端模板。

## 当前实现概览

`frontend-vue` 是当前仓库的 Vue 管理端工作区，基于 Vue 3.5、Vite 8、Element Plus 2.14、Vue Router 5 与 Pinia。应用入口是 `src/main.ts -> src/App.vue`；固定路由写在 `src/router/index.ts`，登录后动态菜单路由由 `usePermissionStore().generateRoutes()` 注入到 Vue Router。

当前代码能直接确认的几个关键事实：

- `main.ts` 负责注册 router、Pinia、i18n、自定义指令、插件和开发者工具保护。
- `permission.ts` 是全局前置守卫，等待去重会话恢复、资料/路由装配，再放行受保护页面；OAuth callback 不提前恢复旧身份。
- `src/store/modules/permission.ts` 通过 `import.meta.glob('./../../views/**/*.vue')` 把后端菜单组件名解析为真实页面组件。
- `src/api/login.ts` 的登录、OAuth ticket 和注册请求默认携带 `clientId`，并通过 `utils/request.ts` 统一加密、401 和重复提交处理。
- `/forgot-password` 是固定公开入口；登录、自助注册与密码重置页面通过 `GET /auth/code` 的能力位控制可用流程，邮件验证码和密码重置接口统一由 `src/api/login.ts` 提供。
- `src/store/modules/user.ts` 负责 password/OAuth ticket 绑定后登录、仅内存 token、刷新恢复与资料；退出先清本地权限、动态路由、SSE/WebSocket，再 DELETE 专用浏览器会话，失败明确提示服务端注销未确认。

## 模块导航

| 模块 | 当前职责 | 主要证据 |
| --- | --- | --- |
| `src/api` | 后端接口契约与请求入口 | [`src/api/README.md`](./src/api/README.md) |
| `src/router` | 固定路由定义 | [`src/router/README.md`](./src/router/README.md) |
| `src/store` | 用户、权限、设置、标签页与字典等状态 | [`src/store/README.md`](./src/store/README.md) |
| `src/views` | 登录、首页、系统管理、监控与错误页 | [`src/views/README.md`](./src/views/README.md) |
| `src/layout`、`src/plugins`、`src/utils` | 布局壳、全局插件、请求/权限/缓存/加密工具 | [`src/README.md`](./src/README.md) |

## 建议阅读顺序

1. [`doc/architecture.md`](./doc/architecture.md)
   先看模块分层、守卫、动态路由装配与请求边界。
2. [`doc/data-flow.md`](./doc/data-flow.md)
   再看登录、菜单注入和典型页面请求链路。
3. [`src/README.md`](./src/README.md)
   最后按 `src/` 模块入口继续下钻。

## 源码入口

- 应用入口：
  - `src/main.ts`
  - `src/App.vue`
- 路由与鉴权：
  - `src/router/index.ts`
  - `src/permission.ts`
  - `src/store/modules/permission.ts`
- 登录与请求：
  - `src/api/login.ts`
  - `src/utils/request.ts`
  - `src/store/modules/user.ts`

## 当前实现提醒

- 后端菜单返回的 `component` 字符串必须能在 `src/views` 里解析到真实 `.vue` 页面；否则权限 store 只能返回空组件映射。
- 登录、注册与部分写请求是否加密，取决于 `VITE_APP_ENCRYPT` 和 RSA/AES 环境变量。
- 本工作区的动态路由装配放在 Pinia + Vue Router 里完成，不能直接套用 React admin 的路径解析实现。

## 开发与生产验证前置

从仓库根目录执行 `pnpm --dir frontend-vue install`、`pnpm --dir frontend-vue run dev`；Node 使用 `24.18.0`，pnpm 使用根 `packageManager` 固定版本。开发服务默认端口 `80`、代理后端 `8080`；端口覆盖与测试命令见 [本层规约](./AGENTS.md) 和 [测试政策](../docs/TESTING.md)。

Windows 可直接使用上面的 pnpm 命令。`bin/package.bat`、`bin/run-web.bat`、`bin/build.bat` 分别包装冻结 lockfile 安装、开发服务和生产构建，会切换到工作区并保留 pnpm 退出码；先安装基线 Node/pnpm，构建前准备下述 RSA 配置。本轮静态核对了这些批处理入口，尚未在 Windows 实机执行。

`VITE_APP_ENCRYPT=true` 时，dev/build 进程必须取得与目标后端对应的 `VITE_APP_RSA_PUBLIC_KEY` / `VITE_APP_RSA_PRIVATE_KEY`。浏览器中的私钥不能保护服务端秘密，生产仍须 HTTPS 与受控凭据。构建前执行 `node tools/validate_utf8.mjs`。

Vue Router history 与 Vite 的 `BASE_URL` 一致，支持根及 `/vue/` 等受控子路径。密码/OAuth 登录、回调和身份绑定统一验证站内回跳；API 使用无 origin、带当前前缀一次的浏览器路径，应用内导航由 Router base 生成最终地址。空值、数组、错码、协议相对路径、反斜杠、控制字符和点段在登录/授权/ticket 兑换前明确拒绝；安全 query/hash 保留原编码。真实 Provider、目标 Linux nginx 与生产登录仍需分别验收，构建或 HTTP 替身不能替代这些证据。具体边界见 [测试政策](../docs/TESTING.md) 第 6.5–6.6 节。

## P1-P3 身份与消息边界

- 个人中心通过 `/system/user/profile/oauth/*` 管理当前用户的第三方身份。绑定只使用服务端生成的授权地址和回调 ticket；解绑是否要求当前密码以身份列表返回的 `passwordConfirmationRequired` 为准。
- `src/api/system/message`、`useNoticeStore` 和固定受保护路由 `/message-center` 共同构成个人消息盒子。通知铃铛、导航未读角标和消息中心都以 `/system/message/*` 的服务端结果为真值。
- SSE/WebSocket 只处理 `{ type: "message", messageId }` 刷新事件，不把事件 payload 当作消息正文存储或展示。
- access token 不进入 localStorage/sessionStorage；旧 `Admin-Token` 启动时只删除。刷新使用 HttpOnly 恢复 cookie，专用同源资源以 GET CSRF→POST restore / PUT bind / DELETE logout 保护，写请求带 CSRF header。仅支持相对 API 前缀的同源代理，生产必须 HTTPS。两端 scope 与 clientId 隔离；同 scope tab 的无凭据通知会清状态并重载。
