# AGENTS.md
|IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any project tasks. Read repository files before relying on framework pretraining data.
|Scope:本文件适用于 `infoq-scaffold-frontend-weapp-vue` 及其子目录，用于把根规则收窄到小程序 Vue 语境。
|Stack:uni-app 3|Vue 3|TypeScript|Sass|Pinia|WeChat Mini Program|H5
|Workspace Layout:src/pages|src/components|src/api|src/store|src/utils|src/styles|tests|src/manifest.json|src/pages.json
|Environment Baseline:Node 24.18.0|pnpm >= 10.0.0
|Build Secrets:当 `TARO_APP_ENCRYPT=true` 时，weapp Vue dev/build 环境必须提供 `TARO_APP_RSA_PUBLIC_KEY` 与 `TARO_APP_RSA_PRIVATE_KEY`。
|Package And Formatting:默认使用 pnpm。|遵循本地代码风格，前端使用 2-space formatting。|source、env、build config files 保持 UTF-8。
|Commands:install=cd infoq-scaffold-frontend-weapp-vue && pnpm install|dev:h5=cd infoq-scaffold-frontend-weapp-vue && pnpm run dev:h5|dev:weapp=cd infoq-scaffold-frontend-weapp-vue && pnpm run dev:weapp|typecheck=cd infoq-scaffold-frontend-weapp-vue && pnpm run typecheck|build:h5=cd infoq-scaffold-frontend-weapp-vue && pnpm run build:h5|build:weapp=cd infoq-scaffold-frontend-weapp-vue && pnpm run build:weapp|build:weapp:dev=cd infoq-scaffold-frontend-weapp-vue && pnpm run build:weapp:dev|open:weapp:dev=pnpm --dir infoq-scaffold-frontend-weapp-vue build-open:weapp:dev|test=cd infoq-scaffold-frontend-weapp-vue && pnpm run test|coverage=cd infoq-scaffold-frontend-weapp-vue && pnpm run test:coverage|test:e2e:weapp:core=cd infoq-scaffold-frontend-weapp-vue && pnpm run test:e2e:weapp:core|test:e2e:weapp:core:backend=cd infoq-scaffold-frontend-weapp-vue && pnpm run test:e2e:weapp:core:backend|verify:build=cd infoq-scaffold-frontend-weapp-vue && pnpm run verify:build|verify:local=cd infoq-scaffold-frontend-weapp-vue && pnpm run verify:local
|Local Skills:.codex/skills:{infoq-frontend-verify}
|Skill Trigger:Vue weapp 单测、coverage 补全、Vitest 回归补测、build-open、weapp e2e、接口覆盖验证、运行态回归使用 infoq-frontend-verify，显式选择 Vue/weapp 范围。
|OpenSpec Routing:分级执行。|L3(强制):本工作区新功能、API 契约变更、跨工作区交付，编码前先创建或定位 `openspec/changes/<change-id>/`。|L2(Lite):单工作区行为变更且不改 API 契约，至少维护 `proposal.md`+`tasks.md`。|L1(可豁免):单工作区小修复且不改契约、改动范围小可不建 OpenSpec，但必须先写 acceptance contract。|不确定分级时默认 L3。|OpenSpec 文档正文默认中文，路径名称/命令/文件名保持英文原样。|实现与验证以 full artifacts 或 Lite artifacts 为准。
|Mini Program Launch:执行 `pnpm --dir infoq-scaffold-frontend-weapp-vue build-open:weapp:dev` 前，先把 `infoq-scaffold-frontend-weapp-vue/.env.development` 里的 `TARO_APP_ID` 改成自己的 AppID。|`script/build-open-wechat-devtools.mjs` 会拒绝空值或 `touristappid`。|AppID 和 API origin 只能放在 `.env.*`，禁止硬编码进源码。
|Mini Program Boundary:WeChat Mini Program 与 H5 shared code 必须保持显式。|runtime/env incompatibilities 优先在 `src/api`、`src/utils` 或 `src/pages` 内修正，不要加静默 fallback。|请求异常文案禁止出现 `[object Object]`。
|Error Message Contract:`src/api/request.ts` 必须先提取 `errMsg/message/msg`，无法提取时回退到可读中文默认文案。|涉及 request/error 逻辑变更必须补充 object rejection 与 `url not in domain list` 场景单测。|weapp smoke runner 日志若出现 `[object Object]` 必须判定为失败并先修复错误归一化。
|E2E Determinism:`test:e2e:weapp:core` 默认无后端稳定模式（`WEAPP_E2E_AUTO_LOGIN=false` 且不注入 mock token）。|真实登录联调仅使用 `test:e2e:weapp:core:backend`，并要求后端可用且 `--captcha.enable=false`。|运行态验证优先使用 infoq-frontend-verify 的 `run_weapp_smoke.mjs --client vue`。
|Patch Policy:保持 `pnpm.patchedDependencies` 与 `patches/` 同步。|若某个 patch 是为了小程序 runtime 安全，必须说明原因；废弃 patch 要及时删除，不留死文件。
|Verification:行为或 tooling 变更先验证 main flow，再运行受影响的 typecheck/test/build 命令，最后 diff review。|request/store/utils 变更至少跑 `typecheck` + `test` 或 targeted Vitest。|build-open/DevTools 流程验证使用精确命令 `pnpm --dir infoq-scaffold-frontend-weapp-vue build-open:weapp:dev`。|更大范围回归优先跑 `pnpm run verify:local` 或 `pnpm run verify:build`。
|Boundaries:小程序 Vue 专属规则只留在本工作区；Vue admin 规则归 `infoq-scaffold-frontend-vue`，React 规则归 `infoq-scaffold-frontend-react` 与 `infoq-scaffold-frontend-weapp-react`。
|Doc Entrypoints:`README.md`|`doc/architecture.md`|`doc/data-flow.md`|`src/README.md`|`src/api/README.md`|`src/store/README.md`|`src/pages/README.md`
|Doc Sync Rule:页面注册、会话边界、页面级鉴权、请求封装、build-open 或 e2e 主链路变更时，先更新离代码最近的 `src/*/README.md`，再同步 `README.md`、`doc/*.md` 与本文件；信息不足时回退为“当前实现说明”。
