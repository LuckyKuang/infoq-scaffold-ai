# AGENTS.md
|IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any project tasks. Read repository files before relying on framework pretraining data.
|Scope:本文件适用于 `infoq-scaffold-frontend-react` 及其子目录，用于把根规则收窄到 React admin 语境。
|Stack:React 19.2.7|TypeScript 6.0.3|Vite 8.0.16|Ant Design 6.4.3|React Router 7.16.0|Zustand|Vitest 4.1.8|Testing Library
|Workspace Layout:src/pages|src/components|src/api|src/store|src/router|src/utils|src/hooks|tests
|Environment Baseline:Node ^20.19.0 || ^22.13.0 || >=24.0.0|pnpm >= 10.0.0|packageManager pnpm@10.34.1
|Build Secrets:当 `VITE_APP_ENCRYPT=true` 时，React admin dev/build 环境必须提供 `VITE_APP_RSA_PUBLIC_KEY` 与 `VITE_APP_RSA_PRIVATE_KEY`。
|Runtime Baseline:React admin 联调默认以后端 `http://127.0.0.1:8080` 为共享真值。|若开发者本地为避开冲突临时把 backend 改到 `8081` 或其他端口，必须显式设置 `VITE_APP_PROXY_TARGET` 或使用 runtime skill `--backend-port <port>` 对齐。|不得把一次性本地端口固化进共享默认配置。
|Package And Formatting:默认使用 pnpm。|遵循本地 eslint 与 prettier 配置，前端使用 2-space formatting。|source、env、test files 保持 UTF-8。
|Commands:install=cd infoq-scaffold-frontend-react && pnpm install|dev=cd infoq-scaffold-frontend-react && pnpm run dev|test=cd infoq-scaffold-frontend-react && pnpm run test|coverage=cd infoq-scaffold-frontend-react && pnpm run test:coverage|lint=cd infoq-scaffold-frontend-react && pnpm run lint|lint:fix=cd infoq-scaffold-frontend-react && pnpm run lint:fix|build=cd infoq-scaffold-frontend-react && pnpm run build:prod
|OpenSpec Routing:分级执行。|L3(强制):React admin 新功能、API 契约变更、跨工作区交付，编码前先创建或定位 `openspec/changes/<change-id>/`。|L2(Lite):单 React admin 行为变更且不改 API 契约，至少维护 `proposal.md`+`tasks.md`。|L1(可豁免):单 React admin 小修复且不改契约、改动范围小可不建 OpenSpec，但必须先写 acceptance contract。|不确定分级时默认 L3。|OpenSpec 文档正文默认中文，路径名称/命令/文件名保持英文原样。|实现与验证以 full artifacts 或 Lite artifacts 为准。
|Component Boundary:优先使用 Ant Design 和现有 React patterns，再考虑自定义组件。|组件 API 或版本支持检查使用 infoq-component-reference 的 Ant Design 参考。|本工作区不要套用 Vue 或 Element Plus 规则。
|Testing Boundary:React admin 单测与 coverage 工作使用 infoq-frontend-verify；本工作区只加载其 React admin 相关参考。|`src/api/**/*.ts`、`src/router/**/*`、`src/store/**/*`、`src/utils/request*` 改动必须补 targeted tests。|优先 Vitest + Testing Library 的行为断言、MemoryRouter helpers 与直接 Zustand store setup，不做实现细节测试。
|Verification:React 行为变更先验证 main flow，再根据影响范围跑 targeted 或 full unit tests，然后 lint，最后 production build。|渲染流程如 `/login`、route guards、request interceptors、页面首屏渲染 受影响时使用 infoq-frontend-verify。|本地 backend + React admin 栈启动或重启也归 infoq-frontend-verify，显式传 `--client react`。|若本地临时改 backend 端口，运行态验证必须显式传递 override，不能假定 helper 会从共享配置文件自动猜出开发者私人端口。
|Boundaries:React admin 专属规则只留在本工作区；weapp React 细则归 `infoq-scaffold-frontend-weapp-react`，Vue 规则归 `infoq-scaffold-frontend-vue`。
|Doc Entrypoints:`README.md`|`doc/architecture.md`|`doc/data-flow.md`|`src/README.md`|`src/api/README.md`|`src/router/README.md`|`src/store/README.md`|`src/pages/README.md`
|Doc Sync Rule:工作区定位、动态路由装配、请求封装、登录链路、页面分组或 store 边界变更时，先更新离代码最近的 `src/*/README.md`，再同步 `README.md`、`doc/*.md` 与本文件；信息不足时回退为“当前实现说明”。
