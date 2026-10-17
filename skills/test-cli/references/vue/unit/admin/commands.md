# Admin 命令

以下命令优先使用 `pnpm`。若当前环境不可用，可替换为等价 `npm` 命令。

## 安装与初始化

```bash
cd frontend-vue
pnpm install
```

## 运行单个测试文件

```bash
cd frontend-vue
npx vitest --config vitest.config.ts --run tests/utils/request.test.ts
```

## 运行 P1 插件与实时能力批次

```bash
cd frontend-vue
npx vitest --config vitest.config.ts --run \
  tests/plugins/download.test.ts \
  tests/plugins/modal.test.ts \
  tests/plugins/tab.test.ts \
  tests/utils/sse.test.ts \
  tests/utils/websocket.test.ts
```

## 运行 P2 组件与轻量页面

```bash
cd frontend-vue
npx vitest --config vitest.config.ts --run \
  tests/components/Breadcrumb.test.ts \
  tests/components/Pagination.test.ts \
  tests/components/RightToolbar.test.ts \
  tests/components/DictTag.test.ts \
  tests/components/IconSelect.test.ts \
  tests/views/error401.test.ts \
  tests/views/error404.test.ts \
  tests/views/redirect.test.ts \
  tests/views/index.test.ts
```

## 运行 P3 重型系统/监控页面

```bash
cd frontend-vue
npx vitest --config vitest.config.ts --run \
  tests/views/system/menu/index.test.ts \
  tests/views/system/user/index.test.ts \
  tests/views/system/notice/index.test.ts \
  tests/views/system/config/index.test.ts \
  tests/views/system/client/index.test.ts \
  tests/views/system/oss/index.test.ts \
  tests/views/system/oss/config.test.ts \
  tests/views/monitor/online/index.test.ts \
  tests/views/monitor/loginInfo/index.test.ts \
  tests/views/monitor/cache/index.test.ts \
  tests/views/monitor/operLog/index.test.ts \
  tests/views/monitor/operLog/oper-info-dialog.test.ts
```

## 运行态后续验证

```bash
node skills/test-cli/scripts/run_admin_e2e.mjs --client vue --route-limit 1
node skills/test-cli/scripts/captcha_login.mjs --backend-url http://127.0.0.1:8080 --print-token
node skills/test-cli/scripts/playwright_cli.mjs admin-route-probe --list-routes
```

`captcha_login.mjs` 需配置 `INFOQ_TEST_REDIS_*` 或 `--redis-*`，并与后端使用同一 Redis。

`run_admin_e2e.mjs` 自管本地栈，状态写入 `tmp/test-cli/e2e/stack/vue/state.json`，完成、失败或中断后按状态文件收口 owned 端口；手动启动的进程由开发者自行收口。详见 `references/runtime/admin-commands.md`。

## 全量质量门禁

```bash
cd frontend-vue
pnpm run test:unit
pnpm run test:unit:coverage
pnpm run lint:eslint
pnpm run build:prod
```
