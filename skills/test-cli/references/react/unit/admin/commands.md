# Admin 命令

以下命令优先使用 `pnpm`。若当前环境不可用，可替换为等价 `npm` 命令。

## 安装与初始化

```bash
cd frontend-react
pnpm install
```

## 运行单个测试文件

```bash
cd frontend-react
npx vitest --run tests/utils/request.test.ts
```

## 运行 P0 基线批次

```bash
cd frontend-react
npx vitest --run \
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
npx vitest --run \
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
npx vitest --run \
  tests/pages/login.test.tsx \
  tests/pages/home.test.tsx \
  tests/pages/cache-page.test.tsx \
  tests/pages/system-pages.test.tsx \
  tests/pages/ops-pages.test.tsx \
  tests/pages/monitor-auth-profile.test.tsx
```

## 运行态后续验证

```bash
node skills/test-cli/scripts/run_admin_e2e.mjs --client react --route-limit 1
node skills/test-cli/scripts/captcha_login.mjs --backend-url http://127.0.0.1:8080 --print-token
node skills/test-cli/scripts/playwright_cli.mjs admin-route-probe --list-routes
```

`run_admin_e2e.mjs` 自管本地栈，状态写入 `tmp/test-cli/e2e/stack/react/state.json`，完成、失败或中断后按状态文件收口 owned 端口；手动启动的进程由开发者自行收口。详见 `references/runtime/admin-commands.md`。

## 全量质量门禁

```bash
cd frontend-react
pnpm run test
pnpm run test:coverage
pnpm run lint
pnpm run build:prod
```
