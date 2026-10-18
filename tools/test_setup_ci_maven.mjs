#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {setupCiMaven} from './setup_ci_maven.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidenceRoot = path.join(root, 'tmp', 'ci-maven-tests');
fs.mkdirSync(evidenceRoot, {recursive: true});
const evidence = fs.mkdtempSync(path.join(evidenceRoot, 'run-'));
const results = [];
function optionsFor(name) {
  const directory = path.join(evidence, name);
  fs.mkdirSync(directory);
  const options = {installRoot: path.join(directory, 'install'), githubEnvFile: path.join(directory, 'github-env'), githubPathFile: path.join(directory, 'github-path')};
  for (const file of [options.githubEnvFile, options.githubPathFile]) fs.writeFileSync(file, '', 'utf8');
  return options;
}
async function rejectsInstall(name, overrides, pattern) {
  const options = {...optionsFor(name), ...overrides};
  await assert.rejects(setupCiMaven(options), pattern);
  assert.equal(fs.readFileSync(options.githubEnvFile, 'utf8'), '', `${name} exposed MAVEN_HOME`);
  assert.equal(fs.readFileSync(options.githubPathFile, 'utf8'), '', `${name} exposed PATH`);
  assert.deepEqual(fs.existsSync(options.installRoot) ? fs.readdirSync(options.installRoot) : [], [], `${name} retained a failed install`);
  results.push({name, status: 'passed'});
}

// 成功路径下载并执行真实固定发行包，不用声明版本的替身冒充安装成功。
const good = optionsFor('official-package');
const mavenHome = await setupCiMaven(good);
assert.equal(fs.readFileSync(good.githubEnvFile, 'utf8'), `MAVEN_HOME=${mavenHome}\n`);
assert.equal(fs.readFileSync(good.githubPathFile, 'utf8'), `${path.join(mavenHome, 'bin')}\n`);
assert.ok(fs.existsSync(path.join(mavenHome, 'boot/plexus-classworlds-2.9.0.jar')));
const probe = spawnSync(path.join(mavenHome, 'bin', process.platform === 'win32' ? 'mvn.cmd' : 'mvn'), ['-v'], {encoding: 'utf8', shell: process.platform === 'win32'});
assert.equal(probe.status, 0, probe.stderr);
assert.match(probe.stdout, /Apache Maven 3\.9\.12\b/u);
results.push({name: 'official-package-real-version', status: 'passed'});

await rejectsInstall('http-failure', {fetchImpl: async () => new Response('unavailable', {status: 503})}, /HTTP 503/u);
await rejectsInstall('network-failure', {fetchImpl: async () => { throw new Error('network fixture unavailable'); }}, /network fixture unavailable/u);
await rejectsInstall('bad-checksum', {fetchImpl: async () => new Response('modified archive')}, /SHA-512 mismatch/u);
await rejectsInstall('empty-response', {fetchImpl: async () => new Response('')}, /archive size/u);
const invalidOutput = optionsFor('missing-environment-output');
await assert.rejects(setupCiMaven({...invalidOutput, githubEnvFile: ''}), /GITHUB_ENV/u);
assert.equal(fs.readFileSync(invalidOutput.githubPathFile, 'utf8'), '');
assert.ok(!fs.existsSync(invalidOutput.installRoot));
results.push({name: 'missing-environment-output', status: 'passed'});
const invalidArchive = Buffer.from('not a tar.gz archive');
await rejectsInstall('invalid-archive', {fetchImpl: async () => new Response(invalidArchive), expectedSha512: createHash('sha512').update(invalidArchive).digest('hex')}, /extraction failed/u);

const fixtures = path.join(evidence, 'negative-packages');
fs.mkdirSync(fixtures);
const packageDirectory = path.join(fixtures, 'apache-maven-3.9.12');
fs.cpSync(mavenHome, packageDirectory, {recursive: true});
const executable = path.join(packageDirectory, 'bin', process.platform === 'win32' ? 'mvn.cmd' : 'mvn');
for (const [name, content, mode, pattern] of [
  ['wrong-version', process.platform === 'win32' ? '@echo Apache Maven 3.10.0\r\n' : '#!/bin/sh\nprintf "Apache Maven 3.10.0\\n"\n', 0o755, /Expected Maven 3\.9\.12, found 3\.10\.0/u],
  ['failed-executable', process.platform === 'win32' ? '@exit /b 9\r\n' : '#!/bin/sh\nexit 9\n', 0o755, /version probe failed/u],
  ...(process.platform === 'win32' ? [] : [['non-executable', '#!/bin/sh\nexit 0\n', 0o600, /EACCES/u]])
]) {
  fs.writeFileSync(executable, content, 'utf8');
  fs.chmodSync(executable, mode);
  const archive = path.join(fixtures, `${name}.tar.gz`);
  const packed = spawnSync('tar', ['-czf', archive, '-C', fixtures, 'apache-maven-3.9.12'], {encoding: 'utf8'});
  assert.equal(packed.status, 0, packed.stderr);
  const bytes = fs.readFileSync(archive);
  await rejectsInstall(name, {fetchImpl: async () => new Response(bytes), expectedSha512: createHash('sha512').update(bytes).digest('hex')}, pattern);
}
fs.rmSync(executable);
const missingArchive = path.join(fixtures, 'missing-executable.tar.gz');
const missingPacked = spawnSync('tar', ['-czf', missingArchive, '-C', fixtures, 'apache-maven-3.9.12'], {encoding: 'utf8'});
assert.equal(missingPacked.status, 0, missingPacked.stderr);
const missingBytes = fs.readFileSync(missingArchive);
await rejectsInstall('missing-executable', {fetchImpl: async () => new Response(missingBytes), expectedSha512: createHash('sha512').update(missingBytes).digest('hex')}, /executable is missing or unsafe/u);
const cli = spawnSync(process.execPath, [path.join(root, 'tools/setup_ci_maven.mjs'), '--version', '3.10.0'], {encoding: 'utf8'});
assert.equal(cli.status, 1);
assert.match(cli.stderr, /Usage:/u);
results.push({name: 'cli-does-not-allow-overriding-pin', status: 'passed'});
fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify({status: 'passed', results}, null, 2) + '\n', 'utf8');
console.log(`[ci-maven-test] PASS ${results.length} cases; evidence: ${path.relative(root, evidence)}/results.json`);
