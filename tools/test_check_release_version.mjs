#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolveRepoRoot} from './lib/skill_runtime.mjs';
import {parseReleaseVersion, releaseVersionFromTag, compareReleaseVersions} from './lib/release_version.mjs';

const root = resolveRepoRoot(path.dirname(fileURLToPath(import.meta.url)));
const base = path.join(root, 'tmp/documentation-reaudit');
fs.mkdirSync(base, {recursive: true});
const fixture = fs.mkdtempSync(path.join(base, 'release-version-'));
const managed = ['backend/pom.xml', 'backend/infoq-core/infoq-core-bom/pom.xml', 'frontend-react/package.json', 'frontend-vue/package.json', 'README.md', 'README_CN.md', 'README_JA.md', 'README_ZH_TW.md', 'deploy/.env.example', 'deploy/DOCKER.md', 'deploy/docker/docker-compose.yml'];
for (const rel of ['tools/check_release_version.mjs', 'tools/lib/skill_runtime.mjs', 'tools/lib/release_version.mjs', ...managed]) {
  fs.mkdirSync(path.dirname(path.join(fixture, rel)), {recursive: true});
  fs.copyFileSync(path.join(root, rel), path.join(fixture, rel));
}
fs.mkdirSync(path.join(fixture, 'skills'));
fs.writeFileSync(path.join(fixture, 'AGENTS.md'), '# fixture\n', 'utf8');
const version = JSON.parse(fs.readFileSync(path.join(fixture, 'frontend-react/package.json'), 'utf8')).version;
function run(args, status, pattern) {
  const result = spawnSync(process.execPath, [path.join(fixture, 'tools/check_release_version.mjs'), ...args], {encoding: 'utf8'});
  fs.appendFileSync(path.join(fixture, 'verification.log'), `${JSON.stringify(args)} exit=${result.status}\n${result.stdout}${result.stderr}\n`, 'utf8');
  assert.equal(result.status, status, result.stdout + result.stderr);
  if (pattern) assert.match(result.stdout + result.stderr, pattern);
}
for (const args of [[], ['--expect', version], [`--expect=${version}`], ['--tag', `v${version}`], [`--tag=${version}`, `--expect=${version}`]]) run(args, 0, /13 sources/u);
for (const [args, pattern] of [
  [['--expect='], /Missing value/u], [['--tag='], /Missing value/u], [['--expect'], /Missing value/u],
  [['--expect', '--help'], /Missing value/u], [['--bogus'], /Unknown argument/u],
  [[`--expect=${version}=ignored`], /Invalid --expect/u], [[`--tag=v${version}=ignored`], /Invalid --tag/u],
  [['--tag', `v${version}`, '--expect', '9.9.9'], /same version/u],
  [['--expect', '9.9.9', '--tag', `v${version}`], /same version/u],
  [['--expect', version, `--expect=${version}`], /Repeated option/u],
  [['--tag', 'v'], /Invalid --tag/u], [['--expect', 'invalid'], /Invalid --expect/u]
]) run(args, 1, pattern);
for (const invalid of ['3.0.0-rc0', '3.0.0-rc01', '3.0.0-rc', '3.0.0-beta1', '3.0.0+build', '3.0.0-rc1+build', '03.0.0', '3.0.0-rc9007199254740992']) {
  assert.equal(parseReleaseVersion(invalid), null);
  run(['--tag', `v${invalid}`], 1, /Invalid --tag/u);
  run(['--expect', invalid], 1, /Invalid --expect/u);
}
assert.equal(releaseVersionFromTag('3.0.0-rc1'), null);
assert.equal(releaseVersionFromTag('v3.0.0-rc1').rc, 1);
const ordered = ['2.99.99', '3.0.0-rc1', '3.0.0-rc2', '3.0.0-rc10', '3.0.0', '3.0.1-rc1', '3.0.1', '3.1.0', '4.0.0'];
for (let index = 1; index < ordered.length; index += 1) {
  assert.equal(compareReleaseVersions(ordered[index - 1], ordered[index]), -1);
  assert.equal(compareReleaseVersions(ordered[index], ordered[index - 1]), 1);
  assert.equal(compareReleaseVersions(ordered[index], ordered[index]), 0);
}
assert.throws(() => compareReleaseVersions('invalid', '3.0.0'));

// 用完整来源验证 RC 徽标的对称编码，不能把 RC 后缀截断后误报正式版一致。
for (const rel of managed) {
  const file = path.join(fixture, rel);
  const source = fs.readFileSync(file, 'utf8');
  const target = rel.startsWith('README') ? '3.0.0--rc1' : '3.0.0-rc1';
  fs.writeFileSync(file, source.replaceAll(rel.startsWith('README') ? version.replaceAll('-', '--') : version, target), 'utf8');
}
run(['--tag', 'v3.0.0-rc1'], 0, /3\.0\.0-rc1 \(13 sources\)/u);
run(['--expect', '3.0.0'], 1, /expected 3\.0\.0, found 3\.0\.0-rc1/u);
const badgeFile = path.join(fixture, 'README.md');
const validBadge = fs.readFileSync(badgeFile, 'utf8');
fs.writeFileSync(badgeFile, validBadge.replace('Version-3.0.0--rc1-', 'Version-3.0.0-rc1-'), 'utf8');
run(['--expect', '3.0.0-rc1'], 1, /Cannot parse README badge/u);
fs.writeFileSync(badgeFile, validBadge, 'utf8');
const envFile = path.join(fixture, 'deploy/.env.example');
fs.writeFileSync(envFile, fs.readFileSync(envFile, 'utf8').replace(/^INFOQ_VERSION=.+$/mu, 'INFOQ_VERSION=9.9.9'), 'utf8');
run(['--expect', '3.0.0-rc1'], 1, /deploy\/\.env\.example INFOQ_VERSION: expected/u);
console.log(`[release-version-test] PASS valid modes, empty/malformed/repeated/conflicting arguments and mismatched source; fixture: ${fixture}`);
