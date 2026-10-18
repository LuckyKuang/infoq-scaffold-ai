#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parseFirstInstallArgs, assertNativeFilesystem, assertOwnedContainers, runInstallShell} from './first_install_acceptance.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidence = path.join(repo, 'tmp/production-readiness/first-install-tests');
fs.mkdirSync(evidence, {recursive: true});
const root = fs.mkdtempSync(path.join(evidence, 'fixture-'));
const tests = [];
async function test(name, run) { await run(); tests.push({name, status: 'passed'}); console.log(`PASS ${name}`); }
function script(name, body) { const file = path.join(root, `${name}.sh`); fs.writeFileSync(file, body, {mode: 0o700}); return file; }
function groupAlive(pid) {
  const ps = spawnSync('ps', ['-eo', 'pgid=,stat='], {encoding: 'utf8'}); assert.equal(ps.status, 0);
  return ps.stdout.split('\n').some(line => { const [group, state] = line.trim().split(/\s+/u); return group === String(pid) && !state?.startsWith('Z'); });
}
try {
  await test('preview needs an explicit reviewed MinIO user and rejects ambiguous arguments', () => {
    assert.deepEqual(parseFirstInstallArgs(['--run-id', 'bind-first', '--minio-image-user', '0']), {execute: false, runId: 'bind-first', minioUser: '0'});
    for (const args of [['--run-id', '../prod', '--minio-image-user', '0'], ['--run-id', 'bind-first'], ['--run-id', 'bind-first', '--minio-image-user', '0', '--execute', '--execute'], ['--run-id', 'bind-first', '--minio-image-user', '0', '--help']]) assert.throws(() => parseFirstInstallArgs(args));
  });
  await test('CLI preview does not generate configuration or call Docker', () => {
    const runId = `preview-${process.pid}`, directory = path.join(repo, 'tmp/production-readiness', `first-install-${runId}`);
    assert.ok(!fs.existsSync(directory));
    const result = spawnSync(process.execPath, ['tools/verify/first_install_acceptance.mjs', '--run-id', runId, '--minio-image-user', '0'], {cwd: repo, encoding: 'utf8', env: {...process.env, DOCKER_HOST: 'invalid://preview-must-not-connect'}, timeout: 5000});
    assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).mode, 'preview'); assert.ok(!fs.existsSync(directory));
  });
  await test('shared or unknown filesystem cannot stand in for native Linux bind ownership', () => {
    for (const type of ['ext4', 'xfs', 'btrfs']) assertNativeFilesystem(type);
    for (const type of ['virtiofs', '9p', 'nfs4', 'fuse.osxfs', 'overlay', '', 'ext4\n9p']) assert.throws(() => assertNativeFilesystem(type), /原生/u);
  });
  await test('cleanup refuses foreign services and writable mounts outside the fresh bind root', () => {
    const container = {Id: 'a'.repeat(64), Image: `sha256:${'b'.repeat(64)}`, State: {Running: true}, Config: {Labels: {'com.docker.compose.project': 'infoq-first-test', 'com.docker.compose.service': 'mysql'}}, Mounts: [{Type: 'bind', RW: true, Source: '/owned/data/mysql/data'}]};
    const target = {project: 'infoq-first-test', root: '/owned/data'};
    assert.equal(assertOwnedContainers([container], target).length, 1);
    const foreign = structuredClone(container); foreign.Config.Labels['com.docker.compose.project'] = 'shared'; assert.throws(() => assertOwnedContainers([foreign], target), /归属/u);
    for (const source of ['/shared/data', '/owned/data/../shared']) { const bad = structuredClone(container); bad.Mounts[0].Source = source; assert.throws(() => assertOwnedContainers([bad], target), /bind/u); }
    assert.throws(() => assertOwnedContainers([container, container], target), /归属/u);
    assert.throws(() => assertOwnedContainers([container], {...target, complete: true}), /七个/u);
  });
  await test('real shell output is redacted across chunks and arguments reach the script', async () => {
    const file = script('success', 'printf "%s" "${TEST_SECRET:0:5}"\nsleep 0.05\nprintf "%s\\n" "${TEST_SECRET:5}"\nprintf "中文 %s\\n" "$1"\n');
    const log = path.join(root, 'success.log'), secret = 'independent-secret-value'; let pid;
    await runInstallShell(file, {args: ['restart'], env: {...process.env, TEST_SECRET: secret}, logFile: log, secrets: [secret], onPid: value => { if (value) pid = value; }});
    const text = fs.readFileSync(log, 'utf8'); assert.ok(!text.includes(secret)); assert.match(text, /\[REDACTED\]/u); assert.match(text, /中文 restart/u); assert.equal(fs.statSync(log).mode & 0o777, 0o600); assert.ok(!groupAlive(pid));
  });
  await test('installer failure preserves a nonzero result and stops background descendants', async () => {
    const file = script('failed', 'sleep 60 &\nexit 23\n'); let pid;
    await assert.rejects(runInstallShell(file, {env: process.env, logFile: path.join(root, 'failed.log'), timeoutMs: 1000, onPid: value => { if (value) pid = value; }}), /失败/u);
    assert.ok(!groupAlive(pid));
  });
  await test('timeout and interrupt cannot pass and their owned process groups actually exit', async () => {
    const file = script('waiting', 'sleep 60 &\nwait\n');
    for (const interrupted of [false, true]) {
      const abort = new AbortController(); let pid;
      const pending = runInstallShell(file, {env: process.env, logFile: path.join(root, `stop-${interrupted}.log`), signal: abort.signal, timeoutMs: interrupted ? 10000 : 50, onPid: value => { if (value) pid = value; }});
      const timer = interrupted ? setTimeout(() => abort.abort(), 50) : undefined;
      await assert.rejects(pending, /失败/u); clearTimeout(timer); assert.ok(!groupAlive(pid));
    }
    const abort = new AbortController(); abort.abort(); const log = path.join(root, 'not-started.log');
    await assert.rejects(runInstallShell(file, {env: process.env, logFile: log, signal: abort.signal}), /未启动/u); assert.ok(!fs.existsSync(log));
  });
  fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify({platform: process.platform, node: process.version, tests, passed: tests.length, failed: 0, realLinuxInstall: 'not executed by this fixture suite', cleanup: 'fixture shell groups verified stopped; fixture directory removed'}, null, 2) + '\n');
} finally { fs.rmSync(root, {recursive: true, force: true}); }
console.log(`${tests.length} first-install acceptance safety scenarios passed; real Docker/install not executed`);
