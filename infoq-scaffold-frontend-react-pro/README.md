# InfoQ Scaffold React Pro

This directory is the Ant Design Pro candidate workspace for migrating
`infoq-scaffold-frontend-react`.

The current migration strategy keeps the old React admin as the behavioral
baseline, migrates modules into this candidate workspace, and switches the whole
React admin directory only after the candidate passes the planned verification
gates.

## Scope

- React 19
- Ant Design 6
- Ant Design Pro / Umi Max
- ProComponents
- pnpm

This workspace does not change backend API contracts and does not migrate the
Vue admin.

## Environment

The candidate workspace uses the same `VITE_APP_*` baseline as the old React
admin:

- `VITE_APP_BASE_API=/dev-api` in development
- `VITE_APP_BASE_API=/prod-api` in production
- `VITE_APP_CONTEXT_PATH=/`
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

`pnpm run build` currently passes in the Codex filesystem sandbox. If Umi /
utoopack later fails because of worker process or local port restrictions, rerun
the same command through the repository approval flow and record the reason.

## Migration Notes

Migration planning and verification records are maintained in:

- `../doc/plan/2026-06-09-react-ant-design-pro-migration-plan.md`
- `../openspec/changes/react-ant-design-pro-migration/`
