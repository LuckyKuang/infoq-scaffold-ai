#!/usr/bin/env node
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PROFILES, buildMatrix} from './push_matrix.mjs';
import {resolveRepoRoot} from '../../../tools/lib/skill_runtime.mjs';
import {createRemoteFixture} from './remote_cli_fixture.mjs';

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

const full = names('full');
for (const name of docs) assert.ok(full.includes(name), `full missing ${name}`);
for (const name of ci) assert.ok(full.includes(name), `full missing ${name}`);
assert.equal(new Set(full).size, full.length, 'full profile must not contain duplicate steps');

const backend = buildMatrix('ci').find((step) => step.name === 'backend-package');
assert.deepEqual(backend.args, ['tools/backend_mvn.mjs', '--', '-B', '-ntp', '-DskipTests=false', 'clean', 'package', '-P', 'dev']);

console.log('[push-cli-test] pass: profiles docs/ci/full and CI parity matrix');

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
  ['ensure', '--execute']
]) assertNoWrites(run('push-cli', args, 1));
const originalPermission = state.repo.viewerPermission;
state.repo.viewerPermission = 'READ';
assertNoWrites(run('push-cli', ['submit-pr', '--message', 'fixture', '--execute'], 1));
state.repo.viewerPermission = originalPermission;
const submitted = run('push-cli', ['submit-pr', '--message', 'fixture', '--branch', 'work', '--skip-check', '--no-watch', '--execute']);
assert.equal(git('branch', '--show-current'), 'work');
assert.notEqual(git('rev-parse', 'HEAD'), beforeHead);
assert.ok(submitted.calls.some(call => call.command === 'gh' && call.args[1] === 'create'));
assertNoWrites(run('push-cli', ['push']));
assertNoWrites(run('push-cli', ['push', '--dry-run']));
const pushed = run('push-cli', ['push', '--execute']);
assert.ok(pushed.calls.some(call => call.command === 'git' && call.args[0] === 'push'));
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
