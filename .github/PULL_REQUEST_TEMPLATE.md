## Summary

Describe the problem, the intended behavior, and any compatibility or
deployment decisions.

## Verification

- [ ] `node tools/validate_utf8.mjs`
- [ ] `node tools/check_readme_sync.mjs`
- [ ] `node tools/check_release_version.mjs`
- [ ] Relevant backend tests pass
- [ ] Relevant Vue/React lint, unit tests, and production build pass
- [ ] `deploy/` examples and defaults are synchronized when configuration changes
- [ ] Frozen SQL baseline is unchanged; schema changes use a dated incremental script
- [ ] Skills, docs, and AGENTS routing are synchronized when commands or paths change
- [ ] No credentials, production configuration, or user data are included

## Documentation and Release Impact

List documentation, migration, configuration, deployment, and release-note
impact, or state `None`.
