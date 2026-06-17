# InfoQ Scaffold React Pro

本目录是 `infoq-scaffold-frontend-react` 迁到 Ant Design Pro 的候选工作区。

当前迁移策略是保留旧 React admin 作为行为基线，在本候选工作区按阶段迁移基础设施、布局、动态菜单、权限、请求和业务页面；候选项目通过计划中的验证门禁后，再整体切换为正式 React 管理端。

## 范围

- React 19
- Ant Design 6
- Ant Design Pro / Umi Max
- ProComponents
- pnpm

本工作区不修改后端 API 契约，不迁移 Vue admin。

## 环境变量

候选工作区沿用旧 React admin 的 `VITE_APP_*` 基线：

- 开发环境 `VITE_APP_BASE_API=/dev-api`
- 生产环境 `VITE_APP_BASE_API=/prod-api`
- `VITE_APP_CONTEXT_PATH=/`
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

`pnpm run build` 当前已在 Codex 文件系统沙箱内通过。若后续 Umi / utoopack 因 worker 进程或本地端口限制失败，按仓库审批流程重跑同一命令并记录原因。

## 迁移记录

计划和验证记录维护在：

- `../doc/plan/2026-06-09-react-ant-design-pro-migration-plan.md`
- `../openspec/changes/react-ant-design-pro-migration/`
