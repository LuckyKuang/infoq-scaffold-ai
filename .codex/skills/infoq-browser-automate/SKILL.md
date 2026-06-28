---
name: infoq-browser-automate
description: 本仓库通用浏览器自动化技能。凡涉及网页交互、登录态注入、受保护路由访问、截图、console/pageerror 采集、渲染校验与浏览器证据留存时均应使用。默认执行路径为仓库内跨平台 `playwright-cli` / `chrome-devtools-cli`，MCP 仅作显式 fallback。
---

# InfoQ 浏览器自动化

将 `infoq-browser-automate` 作为本仓库真实浏览器交互的默认技能。
当前默认主路径是仓库内 `scripts/` 目录提供的 repo-owned、跨平台 Node CLI：

- `playwright-cli`：主流程浏览器自动化
- `chrome-devtools-cli`：本地 DevTools CLI 包装入口

这两个 CLI 在 Windows / macOS / Linux 下都应通过 `pnpm --dir .codex/skills/infoq-browser-automate/scripts run <cli-name> ...` 调用。
为兼容不同平台和 `pnpm` 参数透传差异，也接受 `run <cli-name> -- ...` 形式，但文档默认推荐无 `--` 写法。
本技能不再维护 `.sh` / `.ps1` 包装器，主文档入口始终是跨平台 `pnpm --dir ... run ...`。

## 执行顺序

1. 判定范围：先确认任务是页面流程、受保护路由探测、截图、console/pageerror 采集、渲染校验，还是 DevTools 深度诊断。
2. CLI-first：优先运行 `playwright-cli` 或 `chrome-devtools-cli`；MCP 只作为明确 fallback 或交互探索。
3. 只读探测：涉及管理端路由时先 `--list-routes`，确认 backend、frontend、token、验证码状态和目标 URL 后再打开页面。
4. 目标枚举：涉及批量路由、截图矩阵、登录态注入或导出证据时，先列出路由、账号、storage key、输出目录和失败门禁。
5. 执行验证：检查退出码、等待条件、截图路径、console 日志、pageerror 和网络/性能证据。
6. 失败处理：CLI 失败时保留命令、错误摘要和证据路径；不要静默切换 MCP 或把空白截图当作通过。

## 默认路径

### 1. 安装依赖

```powershell
pnpm --dir .codex/skills/infoq-browser-automate/scripts install
```

首次缺少浏览器二进制时执行：

```powershell
pnpm --dir .codex/skills/infoq-browser-automate/scripts exec playwright install chromium
```

### 2. 最小页面流程

```bash
pnpm --dir .codex/skills/infoq-browser-automate/scripts run playwright-cli flow --url "https://example.com" --wait-for-text "Example Domain"
```

### 3. 管理端受保护路由验证

该命令是快速路由探测。它会先通过 `infoq-backend-verify` 的无验证码快路径获取 token；如果后端明确返回 `captchaEnabled=true`，会自动调用 `infoq-admin-e2e/scripts/captcha_login.mjs` 走 `/auth/code` + OCR + `/auth/login` 获取真实 token。完整真实验证码路由矩阵和 CRUD E2E 仍使用 `infoq-admin-e2e`。

先只列出后端真实返回路由：

```bash
pnpm --dir .codex/skills/infoq-browser-automate/scripts run playwright-cli admin-route-probe --backend-url "http://127.0.0.1:8080" --list-routes
```

再对目标路由执行浏览器探测：

```bash
pnpm --dir .codex/skills/infoq-browser-automate/scripts run playwright-cli admin-route-probe --frontend-origin "http://127.0.0.1:5174" --route "/index"
```

该命令会：

1. 通过 `.codex/skills/infoq-backend-verify/scripts/login_check.mjs` 获取 backend token。
2. 若检测到 `captchaEnabled=true`，自动调用 `.codex/skills/infoq-admin-e2e/scripts/captcha_login.mjs --print-token` 获取真实验证码 token，并把证据写入 `doc/tmp/infoq-admin-e2e/captcha-login/`。
3. 在页面加载前写入 `Admin-Token`。
4. 打开目标前端路由。
5. 输出截图与 console 日志路径。
6. 默认把 `console error` / `pageerror` 视为失败。

### 4. DevTools CLI

```bash
pnpm --dir .codex/skills/infoq-browser-automate/scripts run chrome-devtools-cli --help
```

该入口是本地 `chrome-devtools-mcp` 的 repo-owned 包装器，用于在需要时直接启用 DevTools 级诊断。

## 前置条件

- `node` 与 `pnpm` 可用。
- 若任务依赖本地 admin 栈，先确认 backend / frontend 已启动。
- backend 构建优先使用 `node .codex/scripts/backend_mvn.mjs -- ...`；若必须直接用 `mvn`，先确认 JDK 17 与 Maven 3.9.x，不要在 JDK 8 shell 中继续执行。
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

- `--frontend-origin`：管理端站点 origin，例如 `http://127.0.0.1:5174`。
- `--route`：目标受保护路由，默认 `/index`。
- `--backend-url`：后端地址，默认 `http://127.0.0.1:8080`。
- `--client-id`：登录 client id。
- `--username` / `--password`：显式覆盖默认候选账号。
- `--list-routes`：只输出路由列表，不启动浏览器。

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
- backend 未运行、验证码 OCR 登录失败、或前端站点不可达时，必须显式失败。
- 不要把 `admin-route-probe` 当成完整真实验证码 E2E 验收；真实验证码路由矩阵和写入型链路使用 `infoq-admin-e2e`。
- 批量截图、路由矩阵和登录态注入必须先列出目标路由、storage key、输出目录和失败条件。
- `console error`、`pageerror`、等待条件超时、截图为空白或证据路径缺失时，不能标记浏览器验证通过。
- skill 文档树只保留当前 CLI-first 入口与现行约束，不保留任何历史浏览器入口说明。

## 参考

- Playwright CLI：`scripts/playwright_cli.mjs`
- DevTools CLI：`scripts/chrome_devtools_cli.mjs`
- 依赖清单：`scripts/package.json`
