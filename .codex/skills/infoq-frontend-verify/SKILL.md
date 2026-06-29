---
name: infoq-frontend-verify
description: 为本仓库 React/Vue admin 与 weapp 执行前端验证，覆盖单测、coverage、lint/build、admin 本地栈启动、登录态诊断、路由截图、console 检查、小程序 build-open 和 weapp smoke/e2e。适用于 React/Vue 前端测试、运行态验证、路由回归和本地栈启动。
---

# InfoQ 前端验证

本技能只负责一件事：React/Vue admin 与 weapp 的前端测试和运行态验证。它是前端验证领域型 SOP，不负责真实验证码 E2E，也不替代产品单测。

## 客户端选择

- `react-admin`: `infoq-scaffold-frontend-react`
- `vue-admin`: `infoq-scaffold-frontend-vue`
- `react-weapp`: `infoq-scaffold-frontend-weapp-react`
- `vue-weapp`: `infoq-scaffold-frontend-weapp-vue`

统一脚本通过 `--client react|vue` 选择技术栈。

## 执行顺序

1. 判定范围：先确认目标是 admin、weapp、单测、coverage、lint/build、本地栈、路由截图、console 检查还是 WeChat DevTools smoke。
2. 只读探测：先读取就近 `AGENTS.md`、package scripts、现有状态文件和目标路由来源；不要猜测路由或直接改配置。
3. 最小闭环：先运行最小相关命令或单一路由/单客户端验证，再扩展到完整矩阵。
4. 写入门禁：涉及 `.env`、AppID、构建产物、测试数据、导出文件或本地栈端口时，先列出目标文件/端口/产物、影响范围和恢复方式。
5. 执行验证：检查退出码、截图、console/pageerror、构建输出、状态文件和 owned 进程收口。
6. 失败处理：浏览器缺失、后端不可达、验证码未覆盖、AppID 缺失、console error 和 pageerror 都必须显式失败。

## Admin 工作流

启动本地 backend + admin 栈：

```bash
node .codex/skills/infoq-frontend-verify/scripts/start_admin_dev_stack.mjs --client vue
node .codex/skills/infoq-frontend-verify/scripts/start_admin_dev_stack.mjs --client react
```

停止本技能记录的本地栈：

```bash
node .codex/skills/infoq-frontend-verify/scripts/stop_admin_dev_stack.mjs --client vue
node .codex/skills/infoq-frontend-verify/scripts/stop_admin_dev_stack.mjs --client react
```

本地栈状态文件固定写入 `doc/tmp/infoq-frontend-verify/<client>/state.json`，必须记录 backend/frontend 的 pid、port、log、`running`/`stopped`/`failed`/`interrupted` 状态。运行态验证完成或被中断后，必须执行对应 `stop_admin_dev_stack.mjs`，只关闭本 skill 启动或状态文件记录的进程。

快速诊断登录注入片段或动态路由：

```bash
node .codex/skills/infoq-frontend-verify/scripts/print_admin_login_inject_snippet.mjs
node .codex/skills/infoq-frontend-verify/scripts/fetch_admin_routes_with_token.mjs
```

真实验证码、OCR、登录态和动态路由 smoke 使用 `infoq-admin-e2e`，不要用 token 注入 helper 替代。

## Weapp 工作流

```bash
node .codex/skills/infoq-frontend-verify/scripts/run_weapp_smoke.mjs --client react --suite smoke
node .codex/skills/infoq-frontend-verify/scripts/run_weapp_smoke.mjs --client vue --suite smoke
```

在任何 `build-open:weapp` 命令前，确保对应 `.env.development` 中 `TARO_APP_ID` 是自己的小程序 AppID；空值和 `touristappid` 必须显式失败。

## 单测和构建

React admin：

```bash
cd infoq-scaffold-frontend-react
pnpm run test
pnpm run test:coverage
pnpm run lint
pnpm run build:prod
```

Vue admin：

```bash
cd infoq-scaffold-frontend-vue
pnpm run test:unit
pnpm run test:unit:coverage
pnpm run lint:eslint
pnpm run build:prod
```

React weapp：

```bash
cd infoq-scaffold-frontend-weapp-react
pnpm run test
pnpm run test:coverage
pnpm run lint
pnpm run build:weapp:dev
pnpm run build:weapp
```

Vue weapp：

```bash
cd infoq-scaffold-frontend-weapp-vue
pnpm run typecheck
pnpm run test
pnpm run test:coverage
pnpm run build:weapp:dev
pnpm run build:weapp
```

## 护栏

- 当后端路由 API 可查询时，禁止猜测 admin 路由。
- 浏览器或开发者工具启动失败时，禁止标记运行态验证通过。
- 不用运行态 smoke 替代缺失的单测覆盖。
- 禁止通过弱化断言、放宽 mock、伪造成功路径来硬凑覆盖率。
- 涉及环境文件、AppID、端口、构建产物或测试数据的写入必须先明确目标和恢复方式。
- 任何会启动 backend、admin dev server、WeChat DevTools runner 或其他长生命周期进程的验证，必须把状态和日志落在 `doc/tmp/infoq-frontend-verify/`；状态缺失时不得声称端口已清理。
- `run_weapp_smoke.mjs` 不直接占用固定 HTTP 端口，但仍必须记录 `running`、`passed`、`failed` 或 `interrupted`，用于区分真实完成与中断。

## 参考

- React 参考：`references/react/`
- Vue 参考：`references/vue/`
- 共享运行时：`.codex/lib/admin_dev_stack.mjs`、`.codex/lib/weapp_smoke.mjs`
