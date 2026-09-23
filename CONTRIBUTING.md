# Contributing to InfoQ-Scaffold-AI

Thank you for contributing. Repository-wide mandatory rules are in
[`AGENTS.md`](AGENTS.md); this guide provides the working commands and review
flow.

## Toolchain

Use the versions declared by the repository:

- JDK: `infoq-scaffold-backend/pom.xml` (`java.version`, currently 21)
- Maven: 3.9.x
- Node.js: `.node-version` / `.nvmrc` (`24.18.0`)
- pnpm: each frontend workspace `packageManager` and `engines`

Install frontend dependencies with pnpm only and synchronize the workspace
`pnpm-lock.yaml` when they change. Backend dependency changes belong in Maven
POMs; do not invent extra lockfiles.

## Development Checks

Run the repository commands from the root. Host-side Maven and pnpm checks are
the default development path. Containerized full-stack verification uses
`deploy/VERIFICATION.md`.

```bash
# Encoding
node tools/validate_utf8.mjs

# README structure
node tools/check_readme_sync.mjs

# Backend, via the repo Maven runner
node tools/backend_mvn.mjs -- test

# Vue admin
pnpm --dir infoq-scaffold-frontend-vue run lint:eslint
pnpm --dir infoq-scaffold-frontend-vue run test:unit
pnpm --dir infoq-scaffold-frontend-vue run build:prod

# React admin
pnpm --dir infoq-scaffold-frontend-react run lint
pnpm --dir infoq-scaffold-frontend-react run test
pnpm --dir infoq-scaffold-frontend-react run build:prod
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

- Backend tests, login, and API smoke: `tools/verify`
- Frontend unit/lint/build and local admin stack: `infoq-test`
- Captcha login and admin E2E: `infoq-test`
- SQL, Redis, and data repair: `docs/DATA-OPS.md`
- OpenSpec and high-impact delivery: `docs/DELIVERY-WORKFLOW.md`
- Docker Compose deploy verification: `deploy/VERIFICATION.md`

## Database Changes

`sql/infoq_scaffold_3.0.0.sql` is the frozen initialization baseline. Never
edit it. Schema, dictionary, menu, config, and seed changes must add
`sql/infoq_scaffold_update_YYYYMMDD.sql`. If the baseline is changed by
mistake, revert it and move the change into a dated incremental script.

## Documentation and Locales

- Keep English and Chinese README section IDs aligned
- Put detailed operations in `doc/` or `deploy/`
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
