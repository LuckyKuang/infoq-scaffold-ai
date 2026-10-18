#!/usr/bin/env node
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveRepoRoot} from '../../../tools/lib/skill_runtime.mjs';
import {createRemoteFixture} from '../../push-cli/scripts/remote_cli_fixture.mjs';

const fixture = createRemoteFixture(resolveRepoRoot(path.dirname(fileURLToPath(import.meta.url))), 'release-cli');
const {run, git, write, state, assertNoWrites} = fixture;
const beforeHead = git('rev-parse', 'HEAD');
git('--git-dir', fixture.origin, 'tag', 'v1.0.0', beforeHead);
const missingHistory = run('release-cli', ['plan'], 1);
assertNoWrites(missingHistory);
assert.match(missingHistory.stderr, /无法读取发布提交清单.*获取到本地/u);
assertNoWrites(run('release-cli', ['tag', '--version', '1.2.3']));
assertNoWrites(run('release-cli', ['tag', '--version', '1.2.3', '--dry-run']));
assert.equal(git('tag', '--list'), '');
assert.equal(git('rev-parse', 'HEAD'), beforeHead);
for (const rel of ['frontend-react/package.json', 'frontend-vue/package.json']) write(rel, '{"version":"1.2.4"}\n');
write('backend/pom.xml', '<project><revision>1.2.4</revision></project>\n');
const dirty = run('release-cli', ['tag', '--version', '1.2.4', '--execute'], 1);
assertNoWrites(dirty);
assert.match(dirty.stderr, /干净工作区/u);
for (const rel of ['frontend-react/package.json', 'frontend-vue/package.json']) write(rel, '{"version":"1.2.3"}\n');
write('backend/pom.xml', '<project><revision>1.2.3</revision></project>\n');
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
  ['plan', '--execute'], ['publish', '--notes-file'], ['plan', '--dry-run'], ['publish', '--json'], ['bump', '--remote', 'origin']
]) assertNoWrites(run('release-cli', args, 1));
const originalTarget = state.remotePushUrls;
state.remotePushUrls = 'https://github.com/other/repository.git';
assertNoWrites(run('release-cli', ['tag', '--version', '1.2.3', '--execute'], 1));
state.remotePushUrls = originalTarget;
const originalIdentity = state.repo.nameWithOwner;
state.repo.nameWithOwner = 'other/repository';
assertNoWrites(run('release-cli', ['tag', '--version', '1.2.3', '--execute'], 1));
state.repo.nameWithOwner = originalIdentity;
git('branch', 'v1.2.3');
const tagged = run('release-cli', ['tag', '--version', '1.2.3', '--execute']);
assert.ok(tagged.calls.some(call => call.command === 'git' && call.args[0] === 'push'));
assert.ok(git('ls-remote', '--tags', 'origin').includes('refs/tags/v1.2.3'));
assertNoWrites(run('release-cli', ['tag', '--version', '1.2.3'], 1));
assertNoWrites(run('release-cli', ['publish', '--version', '1.2.3']));
assertNoWrites(run('release-cli', ['publish', '--version', '1.2.3', '--dry-run']));
assertNoWrites(run('release-cli', ['publish', '--version', '1.2.3', '--notes-file', 'missing.md', '--execute'], 1));
const published = run('release-cli', ['publish', '--version', '1.2.3', '--execute']);
assert.ok(published.calls.some(call => call.command === 'gh' && call.args[0] === 'release' && call.args[1] === 'create'));
assert.ok(published.calls.find(call => call.command === 'gh' && call.args[1] === 'create').args.includes('--repo'));
state.release = {tagName: 'v1.2.3', isDraft: false, isPrerelease: false, url: 'https://example.invalid/release/v1.2.3'};
assertNoWrites(run('release-cli', ['publish', '--version', '1.2.3', '--execute'], 1));
assertNoWrites(run('release-cli', ['verify', '--version', '1.2.3']));
state.release.isDraft = true;
assertNoWrites(run('release-cli', ['verify', '--version', '1.2.3'], 1));
state.release = null;
state.releasesError = 'authentication failed';
assertNoWrites(run('release-cli', ['publish', '--version', '1.2.3', '--execute'], 1));
console.log(`[release-cli-test] PASS default preview, explicit execution, errors, duplicate release, verification; fixture: ${fixture.base}`);
