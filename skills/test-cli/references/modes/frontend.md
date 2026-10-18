# 前端验证模式（test-cli / frontend）

# InfoQ 前端验证

本技能负责 React/Vue admin 的前端单测、构建和运行态验证。它是前端验证领域型 SOP；验证码种子登录由 Admin 工作流复用，不替代产品单测。

## 浏览器验证前置：安装 Playwright 浏览器

首次运行界面测试，或 Playwright 升级后，先安装 Chromium：

```bash
pnpm --dir skills/test-cli/scripts install
pnpm --dir skills/test-cli/scripts exec playwright install chromium
```

纯单测、lint 和构建不需要 Playwright。缺少浏览器时 E2E 最终会失败，但可能已启动栈并完成 API 登录；先安装浏览器再执行。不能用单测或构建结果替代界面测试。

## 客户端选择

- `react-admin`: `frontend-react`
- `vue-admin`: `frontend-vue`

admin 本地栈脚本通过 `--client react|vue` 选择管理端。

## 执行顺序

1. 判定范围：先确认目标是 admin、单测、coverage、lint/build、本地栈、路由截图还是 console 检查。
2. 只读探测：先读取就近 `AGENTS.md`、package scripts、现有状态文件和目标路由来源；不要猜测路由或直接改配置。
3. 最小闭环：先运行最小相关命令或单一路由/单客户端验证，再扩展到完整矩阵。
4. 写入门禁：涉及 `.env`、客户端 ID、构建产物、测试数据、导出文件或本地栈端口时，先列出目标文件/端口/产物、影响范围和恢复方式。
5. 执行验证：检查退出码、截图、console/pageerror、构建输出、状态文件和 owned 进程收口。
6. 失败处理：浏览器缺失、后端不可达、验证码种子写入或登录失败、客户端 ID 配置错误、console error 和 pageerror 都必须显式失败。

## Admin 工作流

本地栈有两条路径：

- **E2E 自管栈**（登录态、动态路由与截图证据推荐）：`run_admin_e2e.mjs` 会启动 backend + admin、真实登录、按 `--route-limit` / `--include-route` / `--exclude-route` 巡检并输出截图与 console 证据，完成、失败或中断后按 `tmp/test-cli/e2e/stack/<client>/state.json` 收口 owned 端口。
- **手动启动**（需要真实接口的交互联调）：按 `references/runtime/admin-commands.md` 的 Backend 与 Admin 命令自行启动，进程由开发者自行收口。纯单测、lint 和构建不需要启动 backend 或 dev server。

```bash
node skills/test-cli/scripts/run_admin_e2e.mjs --client vue --route-limit 1
node skills/test-cli/scripts/run_admin_e2e.mjs --client react --route-limit 1
```

需要验证真实登录或获取后端路由清单时：

```bash
node skills/test-cli/scripts/captcha_login.mjs --backend-url http://127.0.0.1:8080 --json
node skills/test-cli/scripts/playwright_cli.mjs admin-route-probe --list-routes
```

验证码种子登录、登录态和动态路由 smoke 以 `run_admin_e2e.mjs` / `captcha_login.mjs` 为准，不要用关闭验证码的诊断后端替代验收。

验证码 CLI 只输出脱敏结果；旧 `--print-token` 已移除并显式拒绝。runner 在进程内接收 token，用同源 CSRF 引导和绑定接口把 HttpOnly cookie 写入浏览器 cookie jar，然后导航真实页面。`--client react|vue` 必须匹配应用 scope，`--api-prefix /dev-api|/prod-api` 与目标代理一致；不能再注入 localStorage 的 `Admin-Token`。

`admin-route-probe --list-routes` 也会调用验证码种子登录，不能作为生产只读检查。执行范围与 runner 尚未覆盖的断言见 `docs/TESTING.md` 第 6.5 节。

## 单测和构建

以下命令均从仓库根目录执行。React admin：

```bash
pnpm --dir frontend-react run test
pnpm --dir frontend-react run test:coverage
pnpm --dir frontend-react run lint
pnpm --dir frontend-react run build:prod
```

Vue admin：

```bash
pnpm --dir frontend-vue run test:unit
pnpm --dir frontend-vue run test:unit:coverage
pnpm --dir frontend-vue run lint:eslint
pnpm --dir frontend-vue run build:prod
```

构建前执行 `node tools/validate_utf8.mjs`。dev 环境在 `VITE_APP_ENCRYPT=true` 时提供与目标后端协议对应的前端 RSA 配置。production build 强制受控来源和加密：将 `INFOQ_PRODUCTION_CONFIG_FILE` 指向绝对路径的私有 dotenv，包含两组至少 2048 位 RSA 的四向配置（前端请求公钥对应后端请求私钥，前端响应私钥对应后端响应公钥）；或显式使用受管环境来源。`node tools/production_config.mjs check --scope frontend --env-file <绝对配置路径>` 只读校验，不打印值。禁止缺配置就关闭加密或把仓库示例 key 用于 production build。Node 使用 `24.18.0`，pnpm 使用根 `packageManager` 固定版本。

通过 `VITE_APP_CONTEXT_PATH=/react/` 或 `/vue/` 构建所需部署前缀；Router 使用 Vite `BASE_URL` 与资源前缀一致。具体受控来源与构建入口见 [`DEV_GUIDE.md`](../../../../DEV_GUIDE.md)。合成配置必须标明 `INFOQ_CONFIG_SOURCE=isolated-test`，产物 `production-build.json` 的 `deployable=false`；`check-artifact --allow-isolated` 只供隔离测试，不能据此发布。

## 认证回跳回归 SOP

会话存储、用户名记忆、glob 或对象合并变更时，先验证两端正常登录与刷新、`*`/`**` 和嵌套/数组合并，再执行相应边界回归：

```bash
pnpm --dir frontend-react exec vitest --run tests/utils/validate.test.ts tests/utils/scaffold.test.ts tests/pages/login.test.tsx tests/api/login.test.ts tests/utils/request.test.ts
pnpm --dir frontend-vue exec vitest --config vitest.config.ts --run tests/utils/validate.test.ts tests/utils/scaffold.test.ts tests/views/login.test.ts tests/api/login.test.ts tests/utils/request.test.ts
node skills/test-cli/scripts/test_browser_session.mjs
node skills/test-cli/scripts/test_browser_runtime.mjs
node skills/test-cli/scripts/test_redis_captcha_seed.mjs
```

必须覆盖元字符字面量、危险键在任意深度和数组中的拒绝、继承属性不读取、原型保持与 getter 异常显式传播；登录初始化删除旧密码且不读不写、取消记忆立即清理、失败不持久化。浏览器会话回归使用真实 loopback HTTP 与 Playwright cookie jar 核验 CSRF/Origin/scope/外部路径、失败脱敏和禁止重定向外发凭据。旧 token stdout 选项在网络/Redis访问前拒绝；实际页面另需真实 backend 的登录/刷新/退出证据。反模式：吞 getter 异常、只检查顶层危险键、换用 sessionStorage 保存秘密、将 HTTP fixture 当成实际认证通过。

触发条件：修改 Router base、登录守卫、密码登录、OAuth 授权/回调或个人中心身份绑定。

1. 读取 `src/utils/auth-redirect.ts`、真实页面和 backend 的 `OAuthRedirectValidator`；明确 API 使用带部署前缀一次的站内浏览器路径，Router 导航使用应用内路径。query/hash 保留原编码，URLSearchParams/Router 已解析的值不无条件再次 decode。
2. 先验证合法 `/user/profile?name=a%26b#identity` 主流程及缺省 `/index`；然后分别在根路径和应用子路径验证未登录回跳、已登录刷新、API 返回的动态菜单、授权、callback 和绑定。拒绝绝对/协议相对/反斜杠/控制字符/点段、错码、多层编码、重复/数组参数和显式空目标。
3. 运行两端安全回跳、页面 callback/login/profile、Router/guard 定向测试。断言非法输入未调用登录、授权地址或 ticket 兑换，不能只断言工具函数抛错。Vue query mock 应使用 Router 已解码值，不能预先 encode 后靠页面二次 decode 通过。
4. 完成 lint 和受控 production build；浏览器运行态使用真实构建产物和显式枚举 API 的 owned HTTP fixture 可验证 DOM、资源前缀及导航，但须标明没有验证真实认证/Provider/DB/Redis。fixture 未配置的 API、console error、pageerror、导航失败均应失败，记录 `tmp/` 状态、截图和端口关闭证据。

```bash
pnpm --dir frontend-react exec vitest --run tests/utils/auth-redirect.test.ts tests/router/app-router.test.tsx tests/router/auth-permission.test.tsx tests/pages/login.test.tsx tests/pages/oauth-callback.test.tsx tests/pages/system/user/profile/oauth-identity.test.tsx
pnpm --dir frontend-vue exec vitest --config vitest.config.ts --run tests/utils/auth-redirect.test.ts tests/router/index.test.ts tests/permission.guard.test.ts tests/views/login.test.ts tests/views/oauth-callback.test.ts tests/views/system/user/profile/index.test.ts
# artifact-root 下放置真实生产构建的 react-root-dist/react-sub-dist/vue-root-dist/vue-sub-dist
node skills/test-cli/scripts/test_admin_routing.mjs --artifact-root tmp/routing-builds --output-dir tmp/test-cli/e2e/routing
```

`test_admin_routing.mjs` 支持 `--client react|vue|both`，逐端验证根路径和固定 `/react/`、`/vue/` 子路径，校验产物 metadata 与 base 一致。测试 HTTP 层精确配置 API 与 Provider 替身，显式拦截外部网络；验证码作为 fixture 输入保留，不关闭应用加密。状态记录 runner PID、实际 loopback 端口、截图、请求类型、失败和 owned 端口关闭；SIGINT/SIGTERM/SIGHUP 记 interrupted 并清理。浏览器或资源清理失败不可算 passed。目标 nginx/HTTPS、真实验证码/票据和 Provider 验收另行执行。

反模式：将无效输入静默送首页、允许绝对 URL 修复绑定、把前缀在 API 和 Router 两处重复添加、改写 `%26` 改变 query 语义、削弱导航断言或将 HTTP fixture 当成真实 Provider 验收。

## 护栏

- 当后端路由 API 可查询时，禁止猜测 admin 路由。
- 浏览器或开发者工具启动失败时，禁止标记运行态验证通过。
- 不用运行态 smoke 替代缺失的单测覆盖。
- 禁止通过弱化断言、放宽 mock、伪造成功路径来硬凑覆盖率。
- 涉及环境文件、客户端 ID、端口、构建产物或测试数据的写入必须先明确目标和恢复方式。
- 自管 backend/admin dev server 的状态和日志在 `tmp/test-cli/e2e/stack/<client>/`；浏览器状态路径见 `references/modes/browser.md`。状态缺失时不得声称 owned 资源已清理。Maven 构建及就绪探针可取消，中断后进入 owned 进程收口。

## 参考

- 运行态命令（双端共用）：`references/runtime/admin-commands.md`
- React 参考：`references/react/`
- Vue 参考：`references/vue/`
- 共享运行时：`tools/lib/admin_dev_stack.mjs`
