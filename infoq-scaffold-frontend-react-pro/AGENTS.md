# AGENTS.md
|IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any project tasks. Read repository files before relying on framework pretraining data.
|Scope:本文件适用于 `infoq-scaffold-frontend-react-pro` 及其子目录。该目录是 `react-ant-design-pro-migration` 的 Ant Design Pro 候选迁移工作区，不是长期并行产品线。
|Status:候选项目由 Ant Design Pro `6.0.2` 官方模板克隆并执行 simple 精简；最终验收通过后才允许接管正式 `infoq-scaffold-frontend-react`。
|Stack:React 19|Ant Design 6|Ant Design Pro / ProComponents 3|Umi Max 4|TypeScript 6|Vitest 4|Biome
|Environment Baseline:沿用旧 React admin 的 `VITE_APP_*` 变量。|dev 默认 `VITE_APP_BASE_API=/dev-api`，production 默认 `/prod-api`，`VITE_APP_CONTEXT_PATH=/`，本地代理默认 `http://127.0.0.1:8080`，可通过 `VITE_APP_PROXY_TARGET` 覆盖。
|Package Manager:使用 pnpm；不要恢复 npm-only 工作流，不要重新引入 `package-lock.json`。
|Commands:install=cd infoq-scaffold-frontend-react-pro && pnpm install|test=cd infoq-scaffold-frontend-react-pro && pnpm run test|lint=cd infoq-scaffold-frontend-react-pro && pnpm run lint|build=cd infoq-scaffold-frontend-react-pro && pnpm run build
|Build Note:`pnpm run build` 使用 Umi / utoopack；当前已通过沙箱内 production build。若后续重新出现创建进程或绑定端口限制，必须按权限流程说明原因并重跑。
|Migration Boundary:后端 API 契约、动态菜单、权限编码和登录链路必须保持与旧 `infoq-scaffold-frontend-react` 等价；禁止用模板静态菜单替代后端菜单。
|Template Cleanup:模板示例、mock、Claude metadata、Cloudflare worker、npm lockfile 均不属于本仓库目标迁移范围；不要恢复这些模板残留。
|OpenSpec:本工作区变更归属 `openspec/changes/react-ant-design-pro-migration/`；实现前和交付前必须运行 `node .codex/skills/infoq-delivery-workflow/scripts/openspec_check.mjs react-ant-design-pro-migration`。
|Verification:按 main-flow verification -> targeted tests -> lint/build -> diff review 顺序执行；若 build 需要提升权限，必须在结果中说明原因。
