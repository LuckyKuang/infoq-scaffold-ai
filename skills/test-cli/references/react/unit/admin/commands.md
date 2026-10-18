# Admin 命令

各代码块独立从仓库根目录开始；进入工作区后使用本地 pnpm 依赖。仅 pnpm 不可用时才使用等价 npm 命令。

## 安装与初始化

```bash
cd frontend-react
pnpm install
```

## 运行单个测试文件

```bash
cd frontend-react
pnpm exec vitest --run tests/utils/request.test.ts
```

## 运行 P0 基线批次

```bash
cd frontend-react
pnpm exec vitest --run \
  tests/utils/auth.test.ts \
  tests/utils/crypto.test.ts \
  tests/utils/request.test.ts \
  tests/store/layout-store.test.ts \
  tests/store/permission-store.test.ts \
  tests/router/auth-permission.test.tsx \
  tests/router/backend-route-view.test.tsx \
  tests/router/path-to-component.test.ts \
  tests/router/route-transform.test.ts
```

## 运行 P1 布局与复用组件

```bash
cd frontend-react
pnpm exec vitest --run \
  tests/components/bridge-components.test.tsx \
  tests/components/common-components.test.tsx \
  tests/components/svg-icon.test.tsx \
  tests/components/upload-editor.test.tsx \
  tests/layout/keep-alive.test.tsx \
  tests/layout/main-layout-icons.test.tsx \
  tests/layout/tags-view-bar.test.tsx
```

## 运行 P2 代表性页面

```bash
cd frontend-react
pnpm exec vitest --run \
  tests/pages/login.test.tsx \
  tests/pages/home.test.tsx \
  tests/pages/cache-page.test.tsx \
  tests/pages/system-pages.test.tsx \
  tests/pages/ops-pages.test.tsx \
  tests/pages/monitor-auth-profile.test.tsx
```

## 运行态后续验证

回到仓库根目录执行；以下命令会写 Redis 验证码种子与会话，只用于已授权测试环境。

```bash
node skills/test-cli/scripts/run_admin_e2e.mjs --client react --route-limit 1
node skills/test-cli/scripts/captcha_login.mjs --backend-url http://127.0.0.1:8080 --json
node skills/test-cli/scripts/playwright_cli.mjs admin-route-probe --list-routes
```

`captcha_login.mjs` 需配置 `INFOQ_TEST_REDIS_*` 或 `--redis-*`，并与后端使用同一 Redis。

`run_admin_e2e.mjs` 自管本地栈，状态写入 `tmp/test-cli/e2e/stack/react/state.json`，完成、失败或中断后按状态文件收口 owned 端口；手动启动的进程由开发者自行收口。详见 `references/runtime/admin-commands.md`。

## 全量质量门禁

```bash
cd frontend-react
pnpm run test
pnpm run test:coverage
pnpm run lint
pnpm run build:prod
```

构建前先从仓库根目录执行 `node tools/validate_utf8.mjs`，并在 `VITE_APP_ENCRYPT=true` 时提供与后端对应的 `VITE_APP_RSA_PUBLIC_KEY` / `VITE_APP_RSA_PRIVATE_KEY`。完整前置与验收边界见 `docs/TESTING.md`。
