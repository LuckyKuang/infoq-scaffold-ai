# Admin 命令

## 启动 Backend + Vue Admin

```bash
node .codex/skills/infoq-frontend-verify/scripts/start_admin_dev_stack.mjs --client vue
```

共享默认口径保持为 backend `8080` + Vue admin `5173`。如果你只是本机为避免端口冲突，临时把 backend 改到 `8081`，不要把 `8081` 回写成共享默认；改用显式 override：

```bash
node .codex/skills/infoq-frontend-verify/scripts/start_admin_dev_stack.mjs --client vue --backend-port 8081 --profile local
```

若不使用 skill 主入口，可改用工作区原生命令手动启动。backend 构建优先使用 `node .codex/scripts/backend_mvn.mjs -- ...`；直接用 `mvn` 时先确认 JDK 17 与 Maven 3.9.x。

Backend：

```bash
cd infoq-scaffold-backend
node .codex/scripts/backend_mvn.mjs -- clean install -DskipTests
java -jar infoq-admin/target/infoq-admin.jar --spring.profiles.active=local --server.port=8080
```

仅在快速 token 注入或路由探测诊断时，才显式关闭验证码：

```bash
java -jar infoq-admin/target/infoq-admin.jar --spring.profiles.active=local --server.port=8080 --captcha.enable=false
```

真实验证码登录和动态路由 smoke 使用 `infoq-admin-e2e`，不要用关闭验证码的诊断后端替代验收。

Vue Admin：

手动启动时，不要依赖 `pnpm run dev -- --port ...` 去覆盖 `.env.development` 中的 `VITE_APP_PORT=80`。优先使用 skill 主入口；若必须手动启动，请先显式设置 `VITE_APP_PORT` 与 `VITE_APP_PROXY_TARGET`，再执行 `pnpm run dev`。

## 仅停止本技能启动的进程

```bash
node .codex/skills/infoq-frontend-verify/scripts/stop_admin_dev_stack.mjs --client vue
```

状态文件为 `doc/tmp/infoq-frontend-verify/vue/state.json`，记录 backend/frontend 的 pid、port 与日志。验证完成、失败或中断后必须执行 stop 命令；stop 只关闭本 skill 启动或状态文件记录为 owned 的进程，不强杀外部已有服务。

## 打印 Token 注入片段

```bash
node .codex/skills/infoq-frontend-verify/scripts/print_admin_login_inject_snippet.mjs
node .codex/skills/infoq-frontend-verify/scripts/print_admin_login_inject_snippet.mjs --allow-captcha-disabled
```

## 从后端抓取真实路由

```bash
node .codex/skills/infoq-frontend-verify/scripts/fetch_admin_routes_with_token.mjs
node .codex/skills/infoq-frontend-verify/scripts/fetch_admin_routes_with_token.mjs --allow-captcha-disabled
```

## 默认 Admin URL

- 登录页：`http://127.0.0.1:5173/login`
- 首页壳：`http://127.0.0.1:5173/index`
- 后端验证码探针：`http://127.0.0.1:8080/auth/code`

## 浏览器验证模式

1. 启动本地栈，或至少确保 backend `http://127.0.0.1:8080` 与 Vue admin `http://127.0.0.1:5173` 已可访问。
   若本地临时把 backend 改到了其他端口，先通过 `--backend-port <port>` 或 `VITE_APP_PROXY_TARGET` 显式对齐。
2. 若只需要快速查看诊断后端返回的受保护路由列表，确认后端可无验证码登录后执行：

```bash
pnpm --dir .codex/skills/infoq-browser-automate/scripts run playwright-cli admin-route-probe --backend-url "http://127.0.0.1:8080" --list-routes
```

3. 对目标受保护路由执行 CLI-first 浏览器探测：

```bash
pnpm --dir .codex/skills/infoq-browser-automate/scripts run playwright-cli admin-route-probe --frontend-origin "http://127.0.0.1:5173" --route "/index"
```

4. 若要覆盖真实验证码登录，请改用 `infoq-admin-e2e`。
5. 只有在需要临时交互探索或定位器发现时，才改用 Playwright MCP。

## Docker 部署验证模式

当验收目标是 Docker 部署产物时，使用仓库统一部署脚本，不要改用 `pnpm run dev` 或 `5173` 端口替代。

```bash
export INFOQ_DEPLOY_ROOT="$(pwd)/doc/tmp/infoq-deploy"
export SECURITY_TOKEN_SECRET=replace-with-at-least-32-chars-secret
bash script/bin/deploy-frontend.sh deploy
```

Vue admin Docker 入口：

- 网关路径：`http://127.0.0.1/vue/`
- 直连端口：`http://127.0.0.1:9091/`

受保护路由探测优先走网关上下文路径：

```bash
pnpm --dir .codex/skills/infoq-browser-automate/scripts run playwright-cli admin-route-probe --backend-url "http://127.0.0.1:9090" --frontend-origin "http://127.0.0.1/vue" --route "/index"
```
