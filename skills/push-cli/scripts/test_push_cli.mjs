#!/usr/bin/env node
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PROFILES, buildMatrix} from './push_matrix.mjs';
import {resolveRepoRoot} from '../../../tools/lib/skill_runtime.mjs';
import {createRemoteFixture} from './remote_cli_fixture.mjs';
import {githubRepositoryFromRemote} from './remote_target.mjs';

function names(profile) {
  return buildMatrix(profile).map((step) => step.name);
}

assert.deepEqual(PROFILES, ['docs', 'ci', 'full']);
assert.throws(() => buildMatrix('unknown'), /unknown profile/);

const docs = names('docs');
assert.ok(docs.includes('utf8'));
assert.ok(docs.includes('agents-check'));
assert.ok(!docs.includes('backend-package'));
assert.ok(!docs.includes('vue-test'));

const ci = names('ci');
assert.ok(ci.includes('utf8'));
assert.ok(ci.includes('backend-package'));
assert.ok(ci.includes('vue-test'));
assert.ok(ci.includes('react-test'));
assert.ok(!ci.includes('agents-check'));
for (const name of ['release-cli-test', 'release-bump-test', 'release-version-test', 'release-assets-test', 'release-policy-test']) {
  assert.ok(ci.includes(name), `ci missing release contract ${name}`);
  assert.ok(!docs.includes(name), `docs unexpectedly runs ${name}`);
}

const full = names('full');
for (const name of docs) assert.ok(full.includes(name), `full missing ${name}`);
for (const name of ci) assert.ok(full.includes(name), `full missing ${name}`);
assert.equal(new Set(full).size, full.length, 'full profile must not contain duplicate steps');

const backend = buildMatrix('ci').find((step) => step.name === 'backend-package');
assert.deepEqual(backend.args, ['tools/backend_mvn.mjs', '--', '-B', '-ntp', '-DskipTests=false', 'clean', 'package', '-P', 'dev']);

console.log('[push-cli-test] pass: profiles docs/ci/full and CI parity matrix');
for (const remote of ['https://github.com/Owner/Repo.git', 'git@github.com:Owner/Repo.git', 'ssh://git@github.com:2222/Owner/Repo.git']) {
  assert.equal(githubRepositoryFromRemote(remote), 'github.com/owner/repo');
}
for (const remote of ['/tmp/local.git', 'https://user:fixture-secret@github.com/Owner/Repo.git', 'https://github.com/Owner/Repo.git?x=1', 'https://github.com/Owner/Repo/extra']) {
  assert.throws(() => githubRepositoryFromRemote(remote));
}

const fixture = createRemoteFixture(resolveRepoRoot(path.dirname(fileURLToPath(import.meta.url))), 'push-cli');
const {run, git, write, state, assertNoWrites} = fixture;
assertNoWrites(run('push-cli', ['ensure']));
assertNoWrites(run('push-cli', ['watch', '--pr', '42']));
for (const checks of [[], [{name: 'CI', state: 'FUTURE_UNKNOWN', bucket: 'unknown'}], [{name: 'CI', state: 'FAILURE', bucket: 'fail'}]]) {
  const original = state.checks;
  state.checks = checks;
  assertNoWrites(run('push-cli', ['watch', '--pr', '42'], 1));
  state.checks = original;
}
state.checksStatus = 1;
assertNoWrites(run('push-cli', ['watch', '--pr', '42'], 1));
state.checksStatus = 0;
state.checks = [{name: 'CI', state: 'FAILURE', bucket: 'fail', link: 'https://example.invalid/actions/runs/99'}];
state.runLogStatus = 1;
state.runLogStderr = 'fixture API permission denied';
const logFailure = run('push-cli', ['watch', '--pr', '42'], 1);
assert.match(logFailure.stderr, /日志抓取失败.*exit=1.*stderr=fixture API permission denied/u);
assertNoWrites(logFailure);
state.checks = [{name: 'CI', state: 'SUCCESS', bucket: 'pass'}];
assertNoWrites(run('push-cli', ['push'], 1)); // 默认分支仍被拒绝。
write('change.md', 'fixture change\n');
const beforeHead = git('rev-parse', 'HEAD');
assertNoWrites(run('push-cli', ['submit-pr', '--message', 'fixture', '--branch', 'work']));
assertNoWrites(run('push-cli', ['submit-pr', '--message', 'fixture', '--branch', 'work', '--dry-run']));
assert.equal(git('branch', '--show-current'), 'main');
assert.equal(git('rev-parse', 'HEAD'), beforeHead);
assertNoWrites(run('push-cli', ['merge', '--pr', '42', '--yes']));
assertNoWrites(run('push-cli', ['merge', '--pr', '42', '--yes', '--dry-run']));
assertNoWrites(run('push-cli', ['merge', '--pr', '42', '--execute'], 1));
for (const patch of [
  {state: 'CLOSED'}, {isDraft: true}, {baseRefName: 'other'}, {mergeable: 'UNKNOWN'}, {statusCheckRollup: []},
  {statusCheckRollup: [{name: 'CI', state: 'PENDING'}]},
  {statusCheckRollup: [{name: 'CI', state: 'FAILURE'}]}, {headRefOid: ''}
]) {
  const original = {...state.pr};
  Object.assign(state.pr, patch);
  assertNoWrites(run('push-cli', ['merge', '--pr', '42', '--yes', '--execute'], 1));
  state.pr = original;
}
for (const args of [
  ['push', '--execute', '--dry-run'], ['push', '--dry-run', '--execute'],
  ['submit-pr', '--execute', '--dry-run'], ['submit-pr', '--dry-run', '--execute'],
  ['merge', '--execute', '--dry-run'], ['merge', '--dry-run', '--execute'],
  ['submit-pr', '--message'], ['push', '--bogus'], ['--bogus'],
  ['watch', '--timeout-min', 'NaN'], ['merge', '--pr', '-1'], ['merge', '--method', 'admin'],
  ['ensure', '--execute'], ['check', '--dry-run'], ['push', '--json'], ['ensure', '--skip-check']
]) assertNoWrites(run('push-cli', args, 1));
for (const patch of [
  {remotePushUrls: 'https://github.com/other/repository.git'},
  {remotePushUrls: 'https://github.com/LuckyKuang/infoq-scaffold-ai.git\nhttps://github.com/other/repository.git'}
]) {
  const original = state.remotePushUrls;
  Object.assign(state, patch);
  assertNoWrites(run('push-cli', ['submit-pr', '--message', 'fixture', '--execute'], 1));
  state.remotePushUrls = original;
}
const originalPermission = state.repo.viewerPermission;
const originalIdentity = state.repo.nameWithOwner;
state.repo.nameWithOwner = 'other/repository';
assertNoWrites(run('push-cli', ['submit-pr', '--message', 'fixture', '--execute'], 1));
state.repo.nameWithOwner = originalIdentity;
state.repo.viewerPermission = 'READ';
assertNoWrites(run('push-cli', ['submit-pr', '--message', 'fixture', '--execute'], 1));
state.repo.viewerPermission = originalPermission;
const submitted = run('push-cli', ['submit-pr', '--message', 'fixture', '--branch', 'work', '--skip-check', '--no-watch', '--execute']);
assert.equal(git('branch', '--show-current'), 'work');
assert.notEqual(git('rev-parse', 'HEAD'), beforeHead);
assert.ok(submitted.calls.some(call => call.command === 'gh' && call.args[1] === 'create'));
for (const call of submitted.calls.filter(call => call.command === 'gh' && !['auth', 'repo'].includes(call.args[0]))) {
  assert.ok(call.args.includes('--repo'));
  assert.equal(call.args[call.args.indexOf('--repo') + 1], 'github.com/luckykuang/infoq-scaffold-ai');
}
assertNoWrites(run('push-cli', ['push']));
assertNoWrites(run('push-cli', ['push', '--dry-run']));
const pushed = run('push-cli', ['push', '--execute']);
assert.ok(pushed.calls.some(call => call.command === 'git' && call.args[0] === 'push'));
assertNoWrites(run('push-cli', ['push', '--force-with-lease']));
git('checkout', '-b', 'new-lease-branch');
const newLease = run('push-cli', ['push', '--force-with-lease', '--execute'], 1);
assert.match(newLease.stderr, /要求远端分支.*已存在/u);
assertNoWrites(newLease);
git('checkout', 'work');
const merged = run('push-cli', ['merge', '--pr', '42', '--yes', '--execute']);
assert.ok(merged.calls.some(call => call.command === 'gh' && call.args[1] === 'merge'));
assert.ok(merged.calls.find(call => call.command === 'gh' && call.args[1] === 'merge').args.includes('--match-head-commit'));
git('checkout', '--detach', 'HEAD');
for (const mode of [[], ['--dry-run'], ['--execute']]) {
  const rejected = run('push-cli', ['submit-pr', '--message', 'fixture', '--skip-check', '--no-watch', ...mode], 1);
  assert.match(rejected.stderr, /detached HEAD/u);
  assertNoWrites(rejected);
}
console.log(`[push-cli-test] PASS preview has no branch/commit/write, explicit execution, parameter failures; fixture: ${fixture.base}`);
