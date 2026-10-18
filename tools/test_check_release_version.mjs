#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolveRepoRoot} from './lib/skill_runtime.mjs';

const root = resolveRepoRoot(path.dirname(fileURLToPath(import.meta.url)));
const base = path.join(root, 'tmp/documentation-reaudit');
fs.mkdirSync(base, {recursive: true});
const fixture = fs.mkdtempSync(path.join(base, 'release-version-'));
for (const rel of ['tools/check_release_version.mjs', 'tools/lib/skill_runtime.mjs', 'backend/pom.xml', 'backend/infoq-core/infoq-core-bom/pom.xml', 'frontend-react/package.json', 'frontend-vue/package.json', 'README.md', 'README_CN.md', 'README_JA.md', 'README_ZH_TW.md', 'deploy/.env.example', 'deploy/DOCKER.md', 'deploy/docker/docker-compose.yml']) {
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
const envFile = path.join(fixture, 'deploy/.env.example');
fs.writeFileSync(envFile, fs.readFileSync(envFile, 'utf8').replace(/^INFOQ_VERSION=.+$/mu, 'INFOQ_VERSION=9.9.9'), 'utf8');
run(['--expect', version], 1, /deploy\/\.env\.example INFOQ_VERSION: expected/u);
console.log(`[release-version-test] PASS valid modes, empty/malformed/repeated/conflicting arguments and mismatched source; fixture: ${fixture}`);
