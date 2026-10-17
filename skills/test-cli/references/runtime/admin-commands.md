# Admin 运行态命令（React / Vue 共用）

## 客户端差异速查

| 项 | Vue | React |
| --- | --- | --- |
| `--client` | `vue` | `react` |
| dev 默认端口 | `5173` | `5174` |
| E2E 自管栈状态 | `tmp/test-cli/e2e/stack/vue/state.json` | `tmp/test-cli/e2e/stack/react/state.json` |
| Docker 网关路径 | `http://127.0.0.1/vue/` | `http://127.0.0.1/react/` |
| Docker 直连端口 | `http://127.0.0.1:9091/` | `http://127.0.0.1:9092/` |

## 启动 Backend + Admin

本 skill 不再提供独立的栈启停包装脚本；本地栈有两种获取方式：

- **E2E 自管栈**：`run_admin_e2e.mjs` / `run_admin_crud_e2e.mjs` 会启动 backend + admin、执行验证，并按状态文件收口 owned 端口。
- **手动启动**：纯单测 / 构建迭代时按下文命令自行启动，进程由开发者自行收口。

Backend：

```bash
cd backend
node tools/backend_mvn.mjs -- clean install -DskipTests
java -jar infoq-admin/target/infoq-admin.jar --spring.profiles.active=local --server.port=8080
```

仅在快速 token 注入或路由探测诊断时，才显式关闭验证码：

```bash
java -jar infoq-admin/target/infoq-admin.jar --spring.profiles.active=local --server.port=8080 --captcha.enable=false
```

真实验证码登录和动态路由 smoke 使用 `run_admin_e2e.mjs` / `captcha_login.mjs`，不要用关闭验证码的诊断后端替代验收。

Admin（Vue `frontend-vue` / React `frontend-react`）：手动启动时不要依赖 `pnpm run dev -- --port ...` 覆盖 `.env.development` 的 `VITE_APP_PORT=80`；先显式设置 `VITE_APP_PORT` 与 `VITE_APP_PROXY_TARGET`，再执行 `pnpm run dev`。

共享默认口径保持为 backend `8080` + Vue admin `5173` / React admin `5174`；本机临时改端口只允许显式 override，不得回写成共享默认配置。E2E 自管栈的状态写入 `tmp/test-cli/e2e/stack/<client>/state.json`，完成、失败或中断后按状态文件关闭 owned 端口。

## 受保护路由与登录态

```bash
node skills/test-cli/scripts/playwright_cli.mjs admin-route-probe --list-routes
node skills/test-cli/scripts/captcha_login.mjs --backend-url http://127.0.0.1:8080 --print-token
node skills/test-cli/scripts/run_admin_e2e.mjs --client vue --route-limit 1
```

- `admin-route-probe --list-routes` 只列后端真实返回的路由，不启动浏览器。
- `captcha_login.mjs --print-token` 输出真实 token（`TOKEN=...`），供脚本或人工核对使用。
- 需要逐路由截图、console 门禁与报告时使用 `run_admin_e2e.mjs`。

## 默认 Admin URL

- Vue：登录页 `http://127.0.0.1:5173/login`，首页壳 `http://127.0.0.1:5173/index`
- React：登录页 `http://127.0.0.1:5174/login`，首页壳 `http://127.0.0.1:5174/index`
- 后端验证码探针：`http://127.0.0.1:8080/auth/code`

## 浏览器验证模式

1. 启动本地栈，或至少确保 backend `http://127.0.0.1:8080` 与对应 admin（Vue `5173` / React `5174`）已可访问。若本地临时把 backend 改到了其他端口，先通过 `--backend-port <port>` 或 `VITE_APP_PROXY_TARGET` 显式对齐。
2. 若只需要快速查看后端返回的受保护路由列表，执行：

```bash
pnpm --dir skills/test-cli/scripts run playwright-cli admin-route-probe --backend-url "http://127.0.0.1:8080" --list-routes
```

3. 对目标受保护路由执行 CLI-first 浏览器探测（Vue 用 `5173`，React 用 `5174`）：

```bash
pnpm --dir skills/test-cli/scripts run playwright-cli admin-route-probe --frontend-origin "http://127.0.0.1:5173" --route "/index"
pnpm --dir skills/test-cli/scripts run playwright-cli admin-route-probe --frontend-origin "http://127.0.0.1:5174" --route "/index"
```

4. `admin-route-probe` 会先走快速 token 获取；若后端返回 `captchaEnabled=true`，会自动调用 `test-cli/scripts/captcha_login.mjs` 识别验证码并获取 token。若要覆盖完整真实验证码路由矩阵，请改用 `test-cli`。
5. 只有在需要临时交互探索或定位器发现时，才改用 Playwright MCP。

## Docker 部署验证模式

当验收目标是 Docker 部署产物时，使用仓库统一部署脚本，不要改用 `pnpm run dev` 或 dev 端口替代。

```bash
export INFOQ_DEPLOY_ROOT="$(pwd)/tmp/infoq-deploy"
export SECURITY_TOKEN_SECRET=replace-with-at-least-32-chars-secret
bash deploy/bin/deploy-frontend.sh deploy
```

Admin Docker 入口：

- Vue：网关路径 `http://127.0.0.1/vue/`，直连端口 `http://127.0.0.1:9091/`
- React：网关路径 `http://127.0.0.1/react/`，直连端口 `http://127.0.0.1:9092/`

受保护路由探测优先走网关上下文路径（Vue 用 `/vue`，React 用 `/react`）：

```bash
pnpm --dir skills/test-cli/scripts run playwright-cli admin-route-probe --backend-url "http://127.0.0.1:9090" --frontend-origin "http://127.0.0.1/vue" --route "/index"
pnpm --dir skills/test-cli/scripts run playwright-cli admin-route-probe --backend-url "http://127.0.0.1:9090" --frontend-origin "http://127.0.0.1/react" --route "/index"
```