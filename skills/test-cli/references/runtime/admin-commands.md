# Admin 运行态命令（React / Vue 共用）

## 客户端差异速查

| 项 | Vue | React |
| --- | --- | --- |
| `--client` | `vue` | `react` |
| 手动 dev 默认端口（`pnpm run dev`） | `80` | `80` |
| E2E 自管栈端口 | `5173` | `5174` |
| E2E 自管栈状态 | `tmp/test-cli/e2e/stack/vue/state.json` | `tmp/test-cli/e2e/stack/react/state.json` |
| Docker 网关路径 | `http://127.0.0.1/vue/` | `http://127.0.0.1/react/` |
| Docker 直连端口 | `http://127.0.0.1:9091/` | `http://127.0.0.1:9092/` |

## 启动 Backend + Admin

本 skill 不再提供独立的栈启停包装脚本；本地栈有两种获取方式：

- **E2E 自管栈**：`run_admin_e2e.mjs` / `run_admin_crud_e2e.mjs` 会启动 backend + admin、执行验证，并按状态文件收口 owned 端口。
- **手动启动**：需要真实接口的交互联调时按下文命令自行启动，进程由开发者自行收口。纯单测 / lint / 构建不需要运行本地栈。

Backend（从仓库根目录执行；先核对 local profile 的数据库、Redis、密钥和 JDK 21）：

```bash
node tools/validate_utf8.mjs
node tools/backend_mvn.mjs -- clean install -DskipTests
java -jar backend/infoq-admin/target/infoq-admin.jar --spring.profiles.active=local --server.port=8080
```

验证码种子登录和动态路由 smoke 使用 `run_admin_e2e.mjs` / `captcha_login.mjs`，不要用关闭验证码的诊断后端替代验收。

Admin（Vue `frontend-vue` / React `frontend-react`）：手动启动时不要依赖 `pnpm run dev -- --port ...` 覆盖 `.env.development` 的 `VITE_APP_PORT=80`；先显式设置 `VITE_APP_PORT` 与 `VITE_APP_PROXY_TARGET`，再执行 `pnpm run dev`。

共享默认口径为 backend `8080`；手动 `pnpm run dev` 默认 `80`；E2E 自管栈使用 Vue `5173` / React `5174`。本机临时改端口只允许显式 override，不得回写成共享默认配置。E2E 自管栈的状态写入 `tmp/test-cli/e2e/stack/<client>/state.json`，完成、失败或中断后按状态文件关闭 owned 端口。

## 受保护路由与登录态

```bash
node skills/test-cli/scripts/playwright_cli.mjs admin-route-probe --list-routes
node skills/test-cli/scripts/captcha_login.mjs --backend-url http://127.0.0.1:8080 --json
node skills/test-cli/scripts/run_admin_e2e.mjs --client vue --route-limit 1
```

- `admin-route-probe --list-routes` 在真实登录后列出后端路由，不启动浏览器；会写 Redis 验证码种子和会话，不能用于生产只读核查。
- `captcha_login.mjs --json` 只输出脱敏登录摘要；旧 `--print-token` 显式拒绝。内部 runner 直接复用 `loginWithRealCaptcha`，有效 token 仅在进程内传递。种子模式需配置 `INFOQ_TEST_REDIS_*` 或 `--redis-*`，且与后端使用同一 Redis。
- 需要逐路由截图、console 门禁与报告时使用 `run_admin_e2e.mjs`。

## 默认 Admin URL

手动 `pnpm run dev`：

- Vue / React：登录页 `http://127.0.0.1/login`，首页壳 `http://127.0.0.1/index`

E2E 自管栈：

- Vue：登录页 `http://127.0.0.1:5173/login`，首页壳 `http://127.0.0.1:5173/index`
- React：登录页 `http://127.0.0.1:5174/login`，首页壳 `http://127.0.0.1:5174/index`

后端验证码探针：`http://127.0.0.1:8080/auth/code`。

## 浏览器验证模式

1. 启动本地栈，或至少确保 backend `http://127.0.0.1:8080` 与对应 admin 已可访问（E2E 自管栈为 Vue `5173` / React `5174`；手动 dev 默认 `80`）。若本地临时把 backend 改到了其他端口，先通过 `--backend-port <port>` 或 `VITE_APP_PROXY_TARGET` 显式对齐。
2. 若只需要快速查看后端返回的受保护路由列表，执行：

```bash
pnpm --dir skills/test-cli/scripts run playwright-cli admin-route-probe --backend-url "http://127.0.0.1:8080" --list-routes
```

3. 对目标受保护路由执行 CLI-first 浏览器探测（以下用 E2E 自管栈端口；手动 dev 默认 `80`）：

```bash
pnpm --dir skills/test-cli/scripts run playwright-cli admin-route-probe --frontend-origin "http://127.0.0.1:5173" --route "/index"
pnpm --dir skills/test-cli/scripts run playwright-cli admin-route-probe --frontend-origin "http://127.0.0.1:5174" --route "/index"
```

4. `admin-route-probe` 直接调用 `test-cli/scripts/captcha_login.mjs`，通过 Redis 种子答案获取 token。需要逐个动态菜单路由取证时使用 `run_admin_e2e.mjs`；它尚不执行完整静态矩阵，不能代替固定路由、登录表单和角色权限用例。
5. 只有在需要临时交互探索或定位器发现时，才改用 Playwright MCP。

## Docker 部署验证模式

当验收目标是 Docker 部署产物时，按 `skills/deploy-cli/SKILL.md`、`deploy/README.md` 与 `deploy/VERIFICATION.md` 完成部署前置条件和运行时选择，再验证已部署站点。不要只设置示例 token secret 就运行部署；数据库、Redis、后端、RSA 构建参数和网关必须对应同一环境。部署生命周期由 deploy-cli 负责。

Admin Docker 入口（生产使用已配置证书和域名的 HTTPS 网关；下列 HTTP loopback 只用于显式 development 隔离环境）：

- Vue：网关路径 `http://127.0.0.1/vue/`，直连端口 `http://127.0.0.1:9091/`
- React：网关路径 `http://127.0.0.1/react/`，直连端口 `http://127.0.0.1:9092/`

在已授权测试部署中，按实际网关上下文路径探测（Vue 用 `/vue`，React 用 `/react`）；这会执行 Redis 种子登录，禁止直接对生产后端/Redis 使用：

```bash
pnpm --dir skills/test-cli/scripts run playwright-cli admin-route-probe --backend-url "http://127.0.0.1:9090" --frontend-origin "http://127.0.0.1/vue" --route "/index"
pnpm --dir skills/test-cli/scripts run playwright-cli admin-route-probe --backend-url "http://127.0.0.1:9090" --frontend-origin "http://127.0.0.1/react" --route "/index"
```

双端 Router base 与 Vite `BASE_URL` 一致，React `BrowserRouter.basename` 与 Vue history 均保留部署前缀。认证回跳经 `utils/auth-redirect.ts` 校验；API 交换带前缀一次且不含 origin 的站内路径，Router navigate 使用应用内路径，不二次解码 query/hash。双端子路径刷新、登录回跳、资源 URL 及 API 反代仍须单独实测，不能用站点 HTTP 200 或直连 `/` 的结果替代。真实构建产物的隔离 HTTP/Provider 替身回归见 `references/modes/frontend.md` 的认证回跳 SOP，不能替代真实认证和生产网关验收。

请求加密公钥通过 `RSA_PUBLIC_KEY`（或登录/E2E runner 的 `--rsa-public-key`）与后端对齐；production build 必须通过 `INFOQ_PRODUCTION_CONFIG_FILE` 私有绝对路径或显式受管环境提供两组至少 2048 位 RSA 四向配对配置，不能使用仓库示例或关闭加密。隔离产物标记 `deployable=false`，生产校验/实际命令见 `DEV_GUIDE.md` 与 frontend SOP。先确认测试账号候选集合、代理和 API/Redis/JDBC 实例一致性，完整已确认限制见 `docs/TESTING.md` 第 6.6 节。手动 dev 绑定 `0.0.0.0`，应限制测试机网络访问；以上默认地址不代表生产开放端口建议。
