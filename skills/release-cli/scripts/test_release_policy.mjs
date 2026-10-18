#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolveRepoRoot} from '../../../tools/lib/skill_runtime.mjs';
import {assertPublishAllowed, releasePolicy} from './release_policy.mjs';

const scripts = path.dirname(fileURLToPath(import.meta.url));
const root = resolveRepoRoot(scripts);
const base = path.join(root, 'tmp/release-policy');
fs.mkdirSync(base, {recursive: true});
const fixture = fs.mkdtempSync(path.join(base, 'test-'));
const log = path.join(fixture, 'verification.log');
function run(args, status) {
  const result = spawnSync(process.execPath, [path.join(scripts, 'release_policy.mjs'), ...args], {encoding: 'utf8'});
  fs.appendFileSync(log, `${JSON.stringify(args)} exit=${result.status}\n${result.stdout}${result.stderr}\n`, 'utf8');
  assert.equal(result.status, status, result.stdout + result.stderr);
  return result;
}

assert.deepEqual(releasePolicy('v3.0.0-rc1'), {version: '3.0.0-rc1', channel: 'rc', artifact_policy: 'source-only', prerelease: true, make_latest: false});
assert.deepEqual(releasePolicy('v3.0.0'), {version: '3.0.0', channel: 'stable', artifact_policy: 'compiled', prerelease: false, make_latest: true});
for (const tag of ['v3.0.0', 'v3.0.0-rc1', 'v3.0.0-rc10']) {
  const output = path.join(fixture, `${tag}.output`);
  const policy = JSON.parse(run(['classify', '--tag', tag, '--github-output', output], 0).stdout);
  assert.deepEqual(policy, releasePolicy(tag));
  assert.equal(fs.readFileSync(output, 'utf8'), Object.entries(policy).map(([key, value]) => `${key}=${value}\n`).join(''));
  for (const verify of ['success', 'failure', 'cancelled', 'skipped']) {
    for (const admin of ['success', 'failure', 'cancelled', 'skipped']) {
      const allowed = verify === 'success' && admin === (policy.channel === 'rc' ? 'skipped' : 'success');
      const args = ['gate', '--tag', tag, '--verify-result', verify, '--admin-result', admin];
      run(args, allowed ? 0 : 1);
      if (allowed) assert.deepEqual(assertPublishAllowed(tag, verify, admin), policy);
      else assert.throws(() => assertPublishAllowed(tag, verify, admin), /禁止发布/u);
    }
  }
}
for (const tag of ['3.0.0', 'v3.0.0-rc0', 'v3.0.0-rc01', 'v3.0.0-rc', 'v3.0.0-beta1', 'v3.0.0+build', 'v3.0.0\n']) {
  assert.throws(() => releasePolicy(tag), /无效发布 tag/u);
  run(['classify', '--tag', tag], 1);
}
for (const args of [
  [], ['unknown'], ['classify'], ['classify', '--tag'], ['classify', '--tag', '--help'],
  ['classify', '--tag', 'v3.0.0', '--tag', 'v3.0.0'], ['classify', '--tag', 'v3.0.0', '--unknown', 'x'],
  ['classify', '--tag', 'v3.0.0', '--github-output'], ['gate', '--tag', 'v3.0.0'],
  ['gate', '--tag', 'v3.0.0', '--verify-result', 'unknown', '--admin-result', 'success'],
  ['gate', '--tag', 'v3.0.0', '--verify-result', 'success', '--admin-result', 'success', '--github-output', 'x']
]) run(args, 1);
run(['classify', '--tag', 'v3.0.0', '--github-output', path.join(fixture, 'missing', 'output')], 1);
console.log(`[release-policy-test] PASS RC/stable classification, GitHub outputs, all upstream result combinations and invalid arguments; evidence: ${fixture}`);
