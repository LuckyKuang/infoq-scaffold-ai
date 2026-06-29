# InfoQ Scaffold React Pro

本目录是基于 Ant Design Pro 的正式 React Pro 管理端工作区，与 `infoq-scaffold-frontend-react` 和 `infoq-scaffold-frontend-vue` 并行维护。

## 范围

- React 19
- Ant Design 6
- Ant Design Pro / Umi Max
- ProComponents
- pnpm

本工作区不修改后端 API 契约，不迁移 Vue admin。后端菜单、路由和权限数据仍是三套管理端共享的运行时真值。

## 环境变量

本工作区沿用其他管理端的 `VITE_APP_*` 基线：

- 开发环境 `VITE_APP_BASE_API=/dev-api`
- 生产环境 `VITE_APP_BASE_API=/prod-api`
- `VITE_APP_CONTEXT_PATH=/`
- `VITE_APP_PORT=80`
- 本地代理默认指向 `http://127.0.0.1:8080`
- 可通过 `VITE_APP_PROXY_TARGET` 覆盖本地后端目标

## 命令

```bash
pnpm install
pnpm run dev
pnpm run test
pnpm run lint
pnpm run build
```

`pnpm run dev` 默认以端口 `80` 启动 Umi Max，并在 dev server 输出本地 URL 后自动打开浏览器。可用 `PORT` 或 `VITE_APP_PORT` 覆盖端口；可用 `INFOQ_REACT_PRO_OPEN=false`、`BROWSER=none` 或 `pnpm run dev -- --no-open` 禁止自动打开浏览器。

所有调用 Umi Max 的 package scripts 都通过 `scripts/max.mjs` 或 `scripts/start-dev.mjs` 进入，统一避免在 install、dev、build、preview 和 analyze 命令中注册 `@umijs/did-you-know` 启动提示插件。

Compose 部署通过 `/react-pro/` 暴露本工作区，容器直连端口为 `9093`。

`pnpm run build` 当前已在 Codex 文件系统沙箱内通过。若后续 Umi / utoopack 因 worker 进程或本地端口限制失败，按仓库审批流程重跑同一命令并记录原因。

## 项目记录

原始迁移计划和验证记录维护在：

- `../doc/plan/2026-06-09-react-ant-design-pro-migration-plan.md`
- `../openspec/changes/react-ant-design-pro-migration/`
