# InfoQ Scaffold React Pro

This directory is the official React Pro admin workspace based on Ant Design
Pro. It is maintained in parallel with `infoq-scaffold-frontend-react` and
`infoq-scaffold-frontend-vue`.

## Scope

- React 19
- Ant Design 6
- Ant Design Pro / Umi Max
- ProComponents
- pnpm

This workspace does not change backend API contracts and does not migrate the
Vue admin. Backend menu, route and permission data remain the shared runtime
truth across the three admin frontends.

## Environment

This workspace uses the same `VITE_APP_*` baseline as the other admin
frontends:

- `VITE_APP_BASE_API=/dev-api` in development
- `VITE_APP_BASE_API=/prod-api` in production
- `VITE_APP_CONTEXT_PATH=/`
- `VITE_APP_PORT=80`
- local proxy target defaults to `http://127.0.0.1:8080`
- `VITE_APP_PROXY_TARGET` can override the local backend target

## Commands

```bash
pnpm install
pnpm run dev
pnpm run test
pnpm run lint
pnpm run build
```

`pnpm run dev` starts Umi Max on port `80` by default and opens the browser
after the dev server reports its local URL. Override the port with `PORT` or
`VITE_APP_PORT`. Disable browser opening with `INFOQ_REACT_PRO_OPEN=false`,
`BROWSER=none`, or `pnpm run dev -- --no-open`.

Compose deployment exposes this workspace through `/react-pro/` and direct
container port `9093`.

`pnpm run build` currently passes in the Codex filesystem sandbox. If Umi /
utoopack later fails because of worker process or local port restrictions, rerun
the same command through the repository approval flow and record the reason.

## Project Notes

Original migration planning and verification records are maintained in:

- `../doc/plan/2026-06-09-react-ant-design-pro-migration-plan.md`
- `../openspec/changes/react-ant-design-pro-migration/`
