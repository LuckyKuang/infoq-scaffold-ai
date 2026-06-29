# Weapp 命令

## 全量验证

```bash
cd infoq-scaffold-frontend-weapp-vue
pnpm run typecheck
pnpm run test
pnpm run test:coverage
pnpm run build:weapp:dev
pnpm run build:weapp
```

## 定向测试

```bash
cd infoq-scaffold-frontend-weapp-vue
pnpm exec vitest --run --config vitest.config.ts tests/core/request.test.ts
```

## 本地运行态后续验证

```bash
cd infoq-scaffold-frontend-weapp-vue
pnpm run verify:local
```

## 精确 DevTools 打开命令

```bash
pnpm --dir infoq-scaffold-frontend-weapp-vue build-open:weapp:dev
```

执行前先将 `infoq-scaffold-frontend-weapp-vue/.env.development` 中 `TARO_APP_ID` 改为你自己的 AppID。

## 运行态冒烟技能入口

```bash
node .codex/skills/infoq-frontend-verify/scripts/run_weapp_smoke.mjs --client vue --suite core
```
