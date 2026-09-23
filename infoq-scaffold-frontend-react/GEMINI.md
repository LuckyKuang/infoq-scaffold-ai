# GEMINI.md
|IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any project tasks. Read repository files before relying on framework pretraining data.
|概览:infoq-scaffold-frontend-react 是基于 React 19 和 Ant Design 6 的管理后台。
|技术栈:React 19.2.7|React Router 7.16.0|Ant Design 6.4.3|Zustand|Vite 8.0.16|Vitest 4.1.8|Testing Library。
|规约:布局见 `src/{pages,components,api,store,router,utils,hooks}`|样式遵循 `docs/DESIGN.md` 与 `src/styles/index.scss`|`src/api`/`src/router`/`src/store`/`src/utils/request*` 改动必须补 targeted Vitest。
|安全:VITE_APP_ENCRYPT=true 时需提供 RSA 公私钥。
|Skill:运行态与单测=infoq-test|组件选型与 API 核验=仓库根 `docs/DESIGN.md`「组件选型与 API 核验」。
|命令:install=pnpm install|dev=pnpm run dev|test=pnpm run test|coverage=pnpm run test:coverage|lint=pnpm run lint|lint:fix=pnpm run lint:fix|build=pnpm run build:prod。
