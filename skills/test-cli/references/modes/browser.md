# 通用浏览器模式（test-cli / browser）

# InfoQ 浏览器自动化

将 `test-cli` 作为本仓库真实浏览器交互的默认技能。
当前默认主路径是仓库内 `scripts/` 目录提供的 repo-owned、跨平台 Node CLI：

- `playwright-cli`：主流程浏览器自动化
- `chrome-devtools-cli`：本地 DevTools CLI 包装入口

这两个 CLI 在 Windows / macOS / Linux 下都应通过 `pnpm --dir skills/test-cli/scripts run <cli-name> ...` 调用。
为兼容不同平台和 `pnpm` 参数透传差异，也接受 `run <cli-name> -- ...` 形式，但文档默认推荐无 `--` 写法。
未显式传入 `--screenshot-path` / `--console-log-path` 时，`playwright-cli` 的截图与 console 证据默认写入 `tmp/test-cli/browser/<flow|admin-route-probe>/`。
本技能不再维护 `.sh` / `.ps1` 包装器，主文档入口始终是跨平台 `pnpm --dir ... run ...`。

## 执行顺序

1. 判定范围：先确认任务是页面流程、受保护路由探测、截图、console/pageerror 采集、渲染校验，还是 DevTools 深度诊断。
2. CLI-first：优先运行 `playwright-cli` 或 `chrome-devtools-cli`；MCP 只作为明确 fallback 或交互探索。
3. 只读探测：先检查配置、已有矩阵、状态文件及目标 URL；`--list-routes` 会写验证码种子和登录会话，确认已授权测试环境后才执行。
4. 目标枚举：涉及批量路由、截图矩阵、登录态注入或导出证据时，先列出路由、账号、storage key、输出目录和失败门禁。
5. 执行验证：检查退出码、等待条件、截图路径、console 日志、pageerror 和网络/性能证据。
6. 失败处理：CLI 失败时保留命令、错误摘要和证据路径；不要静默切换 MCP 或把空白截图当作通过。

## 默认路径

### 1. 安装依赖

```powershell
pnpm --dir skills/test-cli/scripts install
```

首次缺少浏览器二进制时执行：

```powershell
pnpm --dir skills/test-cli/scripts exec playwright install chromium
```

### 2. 最小页面流程

```bash
pnpm --dir skills/test-cli/scripts run playwright-cli flow --url "https://example.com" --wait-for-text "Example Domain"
```

### 3. 管理端受保护路由验证

该命令是快速路由探测。它直接调用 `test-cli/scripts/captcha_login.mjs`（Redis 连接通过 `INFOQ_TEST_REDIS_*` 环境变量提供），走 `/auth/code` + Redis 种子答案 + `/auth/login` 获取真实 token。完整验证码路由矩阵和 CRUD E2E 仍使用 `test-cli`。

在已授权测试环境获取登录态并列出后端真实返回路由（不启动浏览器，但会写 Redis 并创建会话）：

```bash
pnpm --dir skills/test-cli/scripts run playwright-cli admin-route-probe --backend-url "http://127.0.0.1:8080" --list-routes
```

再对目标路由执行浏览器探测：

```bash
pnpm --dir skills/test-cli/scripts run playwright-cli admin-route-probe --client react --frontend-origin "http://127.0.0.1:5174" --route "/index"
```

示例使用 React E2E 自管栈端口 `5174`；手动 `pnpm run dev` 默认端口是 `80`，请按实际 origin 调整。

该命令会：

1. 在进程内复用 `captcha_login.mjs` 的 `loginWithRealCaptcha`，通过 Redis 种子答案获取真实 token，脱敏证据写入 `tmp/test-cli/e2e/captcha-login/`；token 不经命令行或 stdout。
2. 使用浏览器 cookie jar 经同源 `GET /auth/browser-session/csrf` → `PUT /auth/browser-session` 建立受保护的 HttpOnly 会话；不写入 `Admin-Token`。`--client` 选择应用 scope，`--api-prefix` 默认 `/dev-api`，部署产物使用 `/prod-api`，均须与后端受控 Origin 和 Cookie Path 一致。
3. 打开目标前端路由。
4. 输出截图与 console 日志路径。
5. 默认把 `console error` / `pageerror` 视为失败。

当前执行器拒绝失败的导航 HTTP 状态，但不自动判定截图空白或 HTTP 200 的错误页 DOM；必须补充业务可见元素断言并审阅截图。URL 匹配与 console 无错不足以证明页面正确。状态落在 `tmp/test-cli/browser/states/`，包括 runner PID、`port=null`、pipe 通信、console 路径和 `browserClosed`；正常、失败及可捕获中断都等待浏览器关闭。完整边界见 `docs/TESTING.md` 第 6.5 节。

### 浏览器凭据证据回归 SOP

触发条件：修改管理端会话播种、实时连接、console/pageerror 采集、Playwright 异常或 CRUD 报告。浏览器自身的 WebSocket 握手错误也会包含带 token 的完整 URL，不能只检查应用是否调用 `console.log(token)`。

1. 使用已授权的隔离 fixture，记录本轮取得的管理端与在线强退测试 token；token 清除或失效后，脱敏集合仍保留到本轮结束。
2. 认证浏览器证据统一经过 `tools/lib/browser_evidence.mjs`：在 console text/location、pageerror、异常 message/stack/cause、状态与 JSON/Markdown 报告落盘前替换已知 token 原文和 URL 编码形式。保留错误类别、数量、状态及失败退出；不因脱敏跳过检查。在线测试用户的会话编号截图使用 Playwright mask。
3. 先运行 `node tools/test_browser_evidence.mjs`，用真实 Chromium 的 WebSocket 401、脚本错误和 locator 超时检查秘密缺失、错误仍失败、owned 浏览器 PID 退出及 HTTP 端口重绑。再运行 `node skills/test-cli/scripts/test_browser_runtime.mjs`，检查 CRUD 临时 token、console location、清理失败、取消与返回 JSON 边界。
4. 证据保留在 `tmp/test-cli/browser/browser-evidence-*/`；只说明实际执行范围。fixture 通过不等于真实后端、OAuth Provider 或生产验收通过。

常见反模式：原样存 `message.text()` / `error.stack`；只过滤 `Bearer ` 而漏掉 URL 编码或纯 token；token 失效后丢失脱敏记录；为使日志“干净”而丢弃错误、放宽断言或自动接受 console error；新增带凭据的 trace、HAR 或公开 `storageState`。

### 4. DevTools CLI

```bash
pnpm --dir skills/test-cli/scripts run chrome-devtools-cli --help
```

该入口是本地 `chrome-devtools-mcp` 的服务启动包装器，启动后通过 MCP 协议接收调用；它不是带截图/性能子命令的交互 CLI。由 `.codex/config.toml` 配置的 MCP 客户端调用实际诊断工具，手动启动会保持进程等待客户端连接。

状态和生命周期日志在 `tmp/test-cli/browser/chrome-devtools-mcp/`，记录子进程 PID、`port=null`（stdio）、owned 和终态。收到 SIGINT/SIGTERM/SIGHUP 时关闭 owned 进程树并核验退出；失败不能写成正常完成。隔离进程回归命令见 `references/crud/crud-patterns.md`。

## 前置条件

- `node` 与 `pnpm` 可用。
- 若任务依赖本地 admin 栈，先确认 backend / frontend 已启动。
- backend 构建优先使用 `node tools/backend_mvn.mjs -- ...`；若必须直接用 `mvn`，先确认 JDK 21 与 Maven 3.9.x，不要在 JDK 8 shell 中继续执行。
- 当前路径不依赖 `bash` 或 PowerShell；若 `node` / `pnpm` 不可用，应先修复本机环境后再继续使用跨平台 CLI。

## 参数约定

`playwright-cli flow` 常用参数：

- `--url`：目标 URL，必填。
- `--storage-key` / `--storage-value`：页面加载前写入 localStorage。
- `--wait-for-text`：等待页面出现的文本。
- `--wait-for-url`：等待 URL 模式。
- `--screenshot-path`：截图输出路径。
- `--console-log-path`：console / pageerror 输出路径。
- `--timeout-ms`：等待超时。
- `--headed`：显示浏览器窗口。
- `--ignore-https-errors`：忽略证书错误。
- `--allow-console-errors`：仅在明确接受时关闭 console 失败门禁。

`playwright-cli admin-route-probe` 额外参数：

- `--frontend-origin`：管理端站点 origin，例如 E2E 自管栈的 `http://127.0.0.1:5174`；手动 dev 默认 `http://127.0.0.1`。
- `--route`：目标受保护路由，默认 `/index`。
- `--backend-url`：后端地址，默认 `http://127.0.0.1:8080`。
- `--client-id`：登录 client id。
- `--username` / `--password`：显式覆盖默认候选账号。
- `--list-routes`：真实登录后输出路由列表，不启动浏览器；仍会写验证码种子与登录会话。

## MCP Fallback 条件

- 使用 `playwright` MCP：
  - 需要临时交互探索；
  - 需要现场找元素或快速试定位器；
  - 任务更像一次性人工排查，而不是可复跑脚本。
- 使用 `chrome-devtools` MCP：
  - 需要 Network / Console / Performance 深度诊断；
  - 需要 Lighthouse、request body、性能 trace 等 CLI 默认不提供的证据。

## 护栏

- 默认优先复跑 CLI，不要先上 MCP。
- CLI 失败时必须保留失败命令、错误摘要与证据路径，禁止静默切走 MCP。
- backend 未运行、验证码种子登录失败、或前端站点不可达时，必须显式失败。
- 不要把 `admin-route-probe` 当成完整验证码 E2E 验收；验证码路由矩阵和写入型链路使用 `test-cli`。
- 批量截图、路由矩阵和登录态注入必须先列出目标路由、storage key、输出目录和失败条件。
- `console error`、`pageerror`、等待条件超时、截图为空白或证据路径缺失时，不能标记浏览器验证通过。
- skill 文档树只保留当前 CLI-first 入口与现行约束，不保留任何历史浏览器入口说明。

## 参考

- Playwright CLI：`scripts/playwright_cli.mjs`
- DevTools CLI：`scripts/chrome_devtools_cli.mjs`
- 依赖清单：`scripts/package.json`
