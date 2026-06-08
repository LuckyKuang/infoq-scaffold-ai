# GEMINI.md
|IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any project tasks. Read repository files before relying on framework pretraining data.
|概览:infoq-scaffold-frontend-weapp-vue 是基于 uni-app 3 (Vue 3) 的微信小程序。
|技术栈:uni-app 3|Vue 3|Pinia|Vitest。
|小程序规约:需在 `.env.development` 配置 `TARO_APP_ID` 运行 build-open|交付前必须运行 `pnpm run typecheck`。
|错误规约:禁止异常文案出现 `[object Object]`|request.ts 必须执行错误归一化。
|测试:E2E 默认无后端稳定模式|运行态验证与单测优先使用 infoq-frontend-verify，显式选择 Vue/weapp 范围。
|命令:install=pnpm install|dev:h5=pnpm run dev:h5|dev:weapp=pnpm run dev:weapp|typecheck=pnpm run typecheck|build:h5=pnpm run build:h5|build:weapp:dev=pnpm run build:weapp:dev|build:weapp=pnpm run build:weapp|open=pnpm --dir . build-open:weapp:dev|test=pnpm run test|coverage=pnpm run test:coverage|e2e:core=pnpm run test:e2e:weapp:core|verify:build=pnpm run verify:build|verify:local=pnpm run verify:local。
