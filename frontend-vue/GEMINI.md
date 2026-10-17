# GEMINI.md
|IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any project tasks. Read repository files before relying on framework pretraining data.
|概览:frontend-vue 是基于 Vue 3.5 和 Element Plus 2.14 的管理后台。
|技术栈:Vue 3.5.35|Vue Router 5.1.0|Element Plus 2.14.1|Pinia|Vite 8.0.16|Vitest 4.1.8|Vue Test Utils。
|规约:布局见 `src/{views,components,api,store,router,utils,plugins}`|样式遵循 `docs/DESIGN.md` 与 `src/assets/styles/`|`src/api`/`src/plugins`/`src/router`/`src/utils/request*` 改动必须补 targeted Vitest。
|安全:VITE_APP_ENCRYPT=true 时需提供 RSA 公私钥。
|Skill:运行态与单测=test-cli|组件选型与 API 核验=仓库根 `docs/DESIGN.md`「组件选型与 API 核验」。
|命令:install=pnpm install|dev=pnpm run dev|test=pnpm run test:unit|coverage=pnpm run test:unit:coverage|lint=pnpm run lint:eslint|lint:fix=pnpm run lint:eslint:fix|build=pnpm run build:prod。
