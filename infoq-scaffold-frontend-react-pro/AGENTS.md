# AGENTS.md
|IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any project tasks. Read repository files before relying on framework pretraining data.
|Scope:本文件适用于 `infoq-scaffold-frontend-react-pro` 及其子目录。该目录是正式 React Pro 管理端工作区，与 `infoq-scaffold-frontend-react` 和 `infoq-scaffold-frontend-vue` 并行维护。
|Status:项目由 Ant Design Pro `6.0.2` 官方模板克隆并执行 simple 精简后迁移完成；当前作为正式并行管理端保留，不再执行删除、归档或改名接管旧 React 管理端。
|Stack:React 19|Ant Design 6|Ant Design Pro / ProComponents 3|Umi Max 4|TypeScript 6|Vitest 4|Biome
|Environment Baseline:沿用旧 React admin 的 `VITE_APP_*` 变量。|dev 默认 `VITE_APP_BASE_API=/dev-api`，production 默认 `/prod-api`，`VITE_APP_CONTEXT_PATH=/`，本地代理默认 `http://127.0.0.1:8080`，可通过 `VITE_APP_PROXY_TARGET` 覆盖。
|Package Manager:使用 pnpm；不要恢复 npm-only 工作流，不要重新引入 `package-lock.json`。
|Commands:install=cd infoq-scaffold-frontend-react-pro && pnpm install|dev=cd infoq-scaffold-frontend-react-pro && pnpm run dev|test=cd infoq-scaffold-frontend-react-pro && pnpm run test|lint=cd infoq-scaffold-frontend-react-pro && pnpm run lint|build=cd infoq-scaffold-frontend-react-pro && pnpm run build
|Dev Server:`pnpm run dev` 默认使用端口 `80`，并在 Umi Max dev server ready 后自动打开浏览器；可用 `PORT`/`VITE_APP_PORT` 覆盖端口，用 `INFOQ_REACT_PRO_OPEN=false`、`BROWSER=none` 或 `-- --no-open` 禁止自动打开。
|Build Note:`pnpm run build` 使用 Umi / utoopack；当前已通过沙箱内 production build。若后续重新出现创建进程或绑定端口限制，必须按权限流程说明原因并重跑。
|Migration Boundary:后端 API 契约、动态菜单、权限编码和登录链路必须保持与旧 `infoq-scaffold-frontend-react` 等价；禁止用模板静态菜单替代后端菜单。
|Template Cleanup:模板示例、mock、Claude metadata、Cloudflare worker、npm lockfile 均不属于本仓库目标迁移范围；不要恢复这些模板残留。
|OpenSpec:本工作区变更归属 `openspec/changes/react-ant-design-pro-migration/`；实现前和交付前必须运行 `node .codex/skills/infoq-delivery-workflow/scripts/openspec_check.mjs react-ant-design-pro-migration`。
|Verification:按 main-flow verification -> targeted tests -> lint/build -> diff review 顺序执行；若 build 需要提升权限，必须在结果中说明原因。
