# Contributing to InfoQ-Scaffold-AI

Thank you for contributing. Repository-wide mandatory rules are in
[`AGENTS.md`](AGENTS.md); this guide provides the working commands and review
flow.

## Toolchain

Use the versions declared by the repository:

- JDK: `backend/pom.xml` (`java.version`, currently 21)
- Maven: 3.9.x
- Node.js: `.node-version` / `.nvmrc` (`24.18.0`)
- pnpm `10.34.1`: root `package.json` `packageManager`, mirrored by each workspace

Use pnpm by default and synchronize the workspace `pnpm-lock.yaml` when dependencies
change. If pnpm is unavailable, the root rules allow npm as a fallback; restore pnpm
and validate the authoritative lockfile before delivering dependency changes. Do not
substitute Yarn. The repository pins pnpm `10.34.1` at the
root. Node 24 does not bundle Corepack; install Corepack separately if you choose
that launcher, or install the pinned pnpm directly with
`npm install --global pnpm@10.34.1`. If a Corepack shim is already available, activate it with
`corepack prepare pnpm@10.34.1 --activate`, then verify `pnpm -v` before
installing. Run `corepack pnpm` when the shell shim has not yet been refreshed.
pnpm 10 blocks dependency build scripts by default; the workspaces allowlist
only `@parcel/watcher` and `esbuild`. Backend dependency changes belong in
Maven POMs; do not invent extra lockfiles.

## Development Checks

Run the repository commands from the root. Host-side Maven and pnpm checks are
the default development path. Containerized full-stack verification uses
`deploy-cli` (`skills/deploy-cli/`); Docker-specific steps are in `deploy/VERIFICATION.md`.

```bash
# Encoding
node tools/validate_utf8.mjs

# README structure
node tools/check_readme_sync.mjs

# Release metadata consistency
node tools/check_release_version.mjs

# Local documentation links and anchors
node tools/check_doc_links.mjs

# Backend, via the repo Maven runner
node tools/backend_mvn.mjs -- test

# Vue admin
pnpm --dir frontend-vue run lint:eslint
pnpm --dir frontend-vue run test:unit
pnpm --dir frontend-vue run build:prod

# React admin
pnpm --dir frontend-react run lint
pnpm --dir frontend-react run test
pnpm --dir frontend-react run build:prod
```

The root Makefile wraps the same entrypoints:

```bash
make test-docs
make test-backend
make test-vue
make test-react
```

Select the affected workspace while iterating. Final PRs should cover the
changed path plus the encoding gate. Backend unit tests must stay within 60
seconds. Do not weaken assertions, mocks, or coverage thresholds to make a
check pass.

Use these entry points for the matching work:

- Backend tests and API smoke: `tools/verify`
- Local deployment and readiness smoke: `deploy-cli` (`skills/deploy-cli/`)
- Frontend unit/lint/build and local admin stack: `test-cli`
- Captcha login and admin E2E: `test-cli`
- SQL, Redis, and data repair: `docs/DATA-OPS.md`
- OpenSpec and high-impact delivery: `docs/DELIVERY-WORKFLOW.md`
- Docker Compose deploy verification: `deploy/VERIFICATION.md`

## Database Changes

`sql/infoq_scaffold_3.0.0.sql` is the frozen initialization baseline. Never
edit it. Schema, dictionary, menu, config, and seed changes must add
`sql/infoq_scaffold_update_YYYYMMDD.sql`. If the baseline is changed by
mistake, revert it and move the change into a dated incremental script.

## Documentation and Locales

- Keep all four root README section IDs aligned (English, Simplified Chinese, Traditional Chinese, Japanese)
- Put detailed operations in `docs/` or `deploy/`
- Update `deploy/` examples when configuration changes
- After README edits, run `node tools/check_readme_sync.mjs`

## OpenSpec

Cross-workspace work and high-impact changes use OpenSpec:

- **L3 (required)**: new features, API contract changes, or cross-workspace
  delivery. Create `openspec/changes/<change-id>/` and follow the full
  artifacts.
- **L2 (recommended Lite)**: single-workspace behavior change without an API
  contract change. At least `proposal.md` and `tasks.md`.
- **L1 (optional)**: small single-workspace fix, no contract change, default
  <= 3 files. Write an acceptance contract first.

When unsure, follow L3. Durable specs live under `docs/specs/`; active change
artifacts stay local under `openspec/changes/` and are not committed.

## Pull Requests

Keep changes focused and use the existing commit style (`feat:`, `fix:`,
`test:`, `docs:`, `chore:`). Include:

- Problem and expected behavior
- Important implementation or compatibility decisions
- Tests that were run
- Migration, configuration, documentation, and release-note impact

Do not push `master` directly. Open a pull request. Publication of tags and
releases is a separate maintainer action.

## Secrets

Never commit credentials, tokens, production configuration, or user data.
Source code must not hardcode secrets. Database access uses parameterized
queries.
