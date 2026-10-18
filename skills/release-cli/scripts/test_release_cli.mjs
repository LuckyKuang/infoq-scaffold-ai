#!/usr/bin/env node
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveRepoRoot} from '../../../tools/lib/skill_runtime.mjs';
import {createRemoteFixture} from '../../push-cli/scripts/remote_cli_fixture.mjs';

const fixture = createRemoteFixture(resolveRepoRoot(path.dirname(fileURLToPath(import.meta.url))), 'release-cli');
const {run, git, write, state, assertNoWrites} = fixture;
const beforeHead = git('rev-parse', 'HEAD');
assertNoWrites(run('release-cli', ['tag', '--version', '1.2.3']));
assertNoWrites(run('release-cli', ['tag', '--version', '1.2.3', '--dry-run']));
assert.equal(git('tag', '--list'), '');
assert.equal(git('rev-parse', 'HEAD'), beforeHead);
assertNoWrites(run('release-cli', ['tag', '--version', '1.2.4', '--execute'], 1));
write('frontend-react/package.json', '{"version":"1.2.4"}\n');
assertNoWrites(run('release-cli', ['tag', '--version', '1.2.3', '--execute'], 1));
write('frontend-react/package.json', '{"version":"1.2.3"}\n');
assertNoWrites(run('release-cli', ['publish', '--version', '1.2.3', '--execute'], 1));
for (const args of [
  ['tag', '--version', '1.2.3', '--execute', '--dry-run'],
  ['tag', '--version', '1.2.3', '--dry-run', '--execute'],
  ['publish', '--version', '1.2.3', '--execute', '--dry-run'],
  ['publish', '--version', '1.2.3', '--dry-run', '--execute'],
  ['tag', '--version'], ['tag', '--remote', '--execute'],
  ['tag', '--version', '1.2.3', '--bogus'], ['--bogus'],
  ['plan', '--execute'], ['publish', '--notes-file']
]) assertNoWrites(run('release-cli', args, 1));

const tagged = run('release-cli', ['tag', '--version', '1.2.3', '--execute']);
assert.ok(tagged.calls.some(call => call.command === 'git' && call.args[0] === 'push'));
assert.ok(git('ls-remote', '--tags', 'origin').includes('refs/tags/v1.2.3'));
assertNoWrites(run('release-cli', ['tag', '--version', '1.2.3'], 1));
assertNoWrites(run('release-cli', ['publish', '--version', '1.2.3']));
assertNoWrites(run('release-cli', ['publish', '--version', '1.2.3', '--dry-run']));
assertNoWrites(run('release-cli', ['publish', '--version', '1.2.3', '--notes-file', 'missing.md', '--execute'], 1));
const published = run('release-cli', ['publish', '--version', '1.2.3', '--execute']);
assert.ok(published.calls.some(call => call.command === 'gh' && call.args[0] === 'release' && call.args[1] === 'create'));
state.release = {tagName: 'v1.2.3', isDraft: false, isPrerelease: false, url: 'https://example.invalid/release/v1.2.3'};
assertNoWrites(run('release-cli', ['publish', '--version', '1.2.3', '--execute'], 1));
assertNoWrites(run('release-cli', ['verify', '--version', '1.2.3']));
state.release.isDraft = true;
assertNoWrites(run('release-cli', ['verify', '--version', '1.2.3'], 1));
state.release = null;
state.releasesError = 'authentication failed';
assertNoWrites(run('release-cli', ['publish', '--version', '1.2.3', '--execute'], 1));
console.log(`[release-cli-test] PASS default preview, explicit execution, errors, duplicate release, verification; fixture: ${fixture.base}`);
