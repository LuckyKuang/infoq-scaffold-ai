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

需要真实 token 或后端路由清单时：

```bash
node skills/test-cli/scripts/captcha_login.mjs --backend-url http://127.0.0.1:8080 --print-token
node skills/test-cli/scripts/playwright_cli.mjs admin-route-probe --list-routes
```

验证码种子登录、登录态和动态路由 smoke 以 `run_admin_e2e.mjs` / `captcha_login.mjs` 为准，不要用关闭验证码的诊断后端替代验收。

`admin-route-probe --list-routes` 也会调用验证码种子登录，不能作为生产只读检查。执行范围与 runner 尚未覆盖的断言见 `docs/TESTING.md` 第 6.5 节。

## 单测和构建

React admin：

```bash
cd frontend-react
pnpm run test
pnpm run test:coverage
pnpm run lint
pnpm run build:prod
```

Vue admin：

```bash
cd frontend-vue
pnpm run test:unit
pnpm run test:unit:coverage
pnpm run lint:eslint
pnpm run build:prod
```

构建前执行 `node tools/validate_utf8.mjs`。当 `VITE_APP_ENCRYPT=true` 时，为 dev/build 进程提供与目标后端协议对应的 `VITE_APP_RSA_PUBLIC_KEY` 与 `VITE_APP_RSA_PRIVATE_KEY`，不要缺配置就关闭加密。Node 使用 `24.18.0`，pnpm 使用根 `packageManager` 固定版本。

## 护栏

- 当后端路由 API 可查询时，禁止猜测 admin 路由。
- 浏览器或开发者工具启动失败时，禁止标记运行态验证通过。
- 不用运行态 smoke 替代缺失的单测覆盖。
- 禁止通过弱化断言、放宽 mock、伪造成功路径来硬凑覆盖率。
- 涉及环境文件、客户端 ID、端口、构建产物或测试数据的写入必须先明确目标和恢复方式。
- 任何会启动 backend、admin dev server 或其他长生命周期进程的验证，必须把状态和日志落在 `tmp/test-cli/e2e/stack/<client>/`；状态缺失时不得声称端口已清理。

## 参考

- 运行态命令（双端共用）：`references/runtime/admin-commands.md`
- React 参考：`references/react/`
- Vue 参考：`references/vue/`
- 共享运行时：`tools/lib/admin_dev_stack.mjs`
