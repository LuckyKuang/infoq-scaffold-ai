---
name: infoq-react-runtime-verification
description: 执行本项目 React 家族的仓库专用运行态验证，覆盖 `infoq-scaffold-frontend-react` 管理端与 `infoq-scaffold-frontend-weapp-react` 小程序流程。适用于 React 登录校验、路由校验、本地栈启动/重启、截图、控制台诊断与小程序 smoke/e2e；通用站点浏览器任务优先使用 `infoq-browser-automation`。
---

# InfoQ React 运行态验证

本技能只负责一件事：本仓库 React 家族的运行态验证。

覆盖两个客户端：

- `admin`: `infoq-scaffold-frontend-react`
- `weapp`: `infoq-scaffold-frontend-weapp-react`

## 客户端选择

1. 涉及浏览器登录、路由守卫、页面截图、控制台诊断、本地 backend + React admin 启动时，使用 `admin` 路径。
2. 涉及微信开发者工具打开流程、小程序登录、路由遍历、API 契约覆盖或 e2e 冒烟时，使用 `weapp` 路径。
3. 若是非仓库特定启动流程的通用网站自动化，改用 `infoq-browser-automation`。

## Admin 工作流

1. 默认使用 `scripts/start_admin_dev_stack.mjs` 启动或重启 backend + React admin 栈。
2. 共享默认后端端口是真值 `8080`。若开发者本地为避免冲突临时改到 `8081` 或其他端口，必须显式传 `--backend-port <port>`；该端口只作为本地 override，不应回写成共享默认值。
3. 若改用手动启动，backend 构建优先使用 `node .codex/scripts/backend_mvn.mjs -- ...`；直接用 `mvn` 时先确认 JDK 17 与 Maven 3.9.x。
4. 若任务要求覆盖真实验证码、OCR、登录态和动态路由 smoke，改用 `infoq-admin-e2e-captcha-verification`，不要用 token 注入 helper 替代。
5. `scripts/print_admin_login_inject_snippet.mjs` 与 `scripts/fetch_admin_routes_with_token.mjs` 仅用于快速诊断；默认不关闭验证码，只有显式传 `--allow-captcha-disabled` 时才允许通过临时关闭验证码的方式取 token。
6. 若已经准备好可直接登录的诊断后端，可使用 `infoq-browser-automation` 的跨平台 CLI 对 `http://127.0.0.1:5174` 执行受保护路由探测、截图与 console 检查：

```bash
pnpm --dir .codex/skills/infoq-browser-automation/scripts run playwright-cli admin-route-probe --frontend-origin "http://127.0.0.1:5174" --route "/index"
```

7. 只有在临时交互探索时才改用 Playwright MCP。
8. 使用 `scripts/stop_admin_dev_stack.mjs` 时，只停止本技能启动的进程。
9. 若任务要求验证 Docker 部署路径，先用仓库部署脚本构建并启动前端网关，再通过网关上下文路径验证 React admin：

```bash
bash script/bin/deploy-frontend.sh deploy
pnpm --dir .codex/skills/infoq-browser-automation/scripts run playwright-cli admin-route-probe --backend-url "http://127.0.0.1:9090" --frontend-origin "http://127.0.0.1/react" --route "/index"
```

Docker 模式下不要用 dev server 默认端口 `5174` 作为部署验收入口；React 直连端口为 `9092`，网关入口为 `http://127.0.0.1/react/`。

## Weapp 工作流

1. 在任何 `build-open:weapp` 命令前，把 `infoq-scaffold-frontend-weapp-react/.env.development` 中的 `TARO_APP_ID` 替换成你自己的小程序 AppID。空值和 `touristappid` 会被启动脚本拒绝。
2. 当任务是“自动化启动小程序”或“打开微信开发者工具联调”时，使用：
   - `pnpm --dir infoq-scaffold-frontend-weapp-react build-open:weapp:dev`
3. 进行可复现的 smoke/e2e 验证时，使用 `scripts/run_weapp_smoke.mjs`，并根据范围选择 `--suite smoke|core|full`。
4. 若 smoke 流程依赖后端登录，确保 backend `http://127.0.0.1:8080` 可达且满足该 smoke 的登录前置；真实验证码管理端链路使用 `infoq-admin-e2e-captcha-verification`，快速诊断才显式关闭验证码。
5. 将 smoke 日志里的 `[object Object]` 视为产品缺陷，而不是可容忍测试现象。

## 护栏

- 不要在 `.codex/skills` 下为 React 运行态工作重新引入共享底座 helper skill。
- 当后端路由 API 可查询时，禁止猜测 admin 路由。
- 本地验证时不要把小程序 AppID 硬编码进源码，保留在 `.env.*` 或 shell 环境变量里。
- 浏览器或开发者工具启动失败时，禁止标记运行态验证通过。
- 运行态入口统一使用 `.mjs`；不再保留 `.sh` 包装器。不要因为旧包装器移除而跳过运行态验证。

## 参考

- `references/admin/commands.md`
- `references/weapp/commands.md`
- `references/weapp/endpoints.md`
