#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const parent = path.join(root, 'tmp', 'mcp-cache-test');
fs.mkdirSync(parent, {recursive: true});
const fixture = fs.mkdtempSync(path.join(parent, 'fixture-'));
const cache = path.join(fixture, 'tmp', 'mcp', 'npm-cache');
const packageRoot = path.join(cache, 'node_modules', '@audit', 'fixture');
fs.mkdirSync(path.join(packageRoot, 'dist'), {recursive: true});
fs.writeFileSync(path.join(packageRoot, 'dist', 'index.js'), 'process.stdout.write("isolated-mcp-fixture");\n', 'utf8');
const runner = path.join(fixture, 'runner.mjs');
fs.writeFileSync(runner, `import {launchCachedMcpPackage} from ${JSON.stringify(pathToFileURL(path.join(root, 'tools', 'launch_cached_mcp_package.mjs')).href)};
const child = launchCachedMcpPackage({repoRoot: ${JSON.stringify(fixture)}, packageName: '@audit/fixture', env: process.env, label: 'test'});
child.on('error', () => {process.exitCode = 1;});
child.on('exit', (code, signal) => {process.exitCode = signal ? 1 : (code ?? 1);});
`, 'utf8');
const result = spawnSync(process.execPath, [runner], {cwd: fixture, encoding: 'utf8', timeout: 10000});
fs.writeFileSync(path.join(fixture, 'results.json'), `${JSON.stringify({status: result.status, stdout: result.stdout, stderr: result.stderr}, null, 2)}\n`, 'utf8');
assert.equal(result.status, 0, result.stderr);
assert.equal(result.stdout, 'isolated-mcp-fixture');
assert.match(result.stderr, /launching cached package/u);
assert.equal(fs.existsSync(path.join(fixture, 'tools', 'tmp')), false, 'must not create artifacts outside root tmp/');
fs.writeFileSync(path.join(packageRoot, 'package.json'), JSON.stringify({name: '@audit/fixture', bin: {fixture: 'cli.js'}}), 'utf8');
fs.writeFileSync(path.join(packageRoot, 'cli.js'), 'process.stdout.write("declared-cli");\n', 'utf8');
const binRun = spawnSync(process.execPath, [runner], {cwd: fixture, encoding: 'utf8', timeout: 10000});
assert.equal(binRun.status, 0, binRun.stderr);
assert.equal(binRun.stdout, 'declared-cli', 'package bin must take precedence over the import-only dist/index.js');
fs.unlinkSync(path.join(packageRoot, 'cli.js'));
const brokenBinRun = spawnSync(process.execPath, [runner], {cwd: fixture, encoding: 'utf8', timeout: 10000});
assert.notEqual(brokenBinRun.status, 0);
assert.match(brokenBinRun.stderr, /Declared MCP executable is missing/u);
assert.equal(brokenBinRun.stdout, '', 'broken declared bin must not silently launch a different module');
fs.mkdirSync(path.join(fixture, 'tools/mcp'), {recursive: true});
for (const file of ['launch_cached_mcp_package.mjs', 'resolve_backend_local_mcp_env.mjs']) fs.copyFileSync(path.join(root, 'tools', file), path.join(fixture, 'tools', file));
const resources = path.join(fixture, 'backend/infoq-admin/src/main/resources');
fs.mkdirSync(resources, {recursive: true});
fs.writeFileSync(path.join(resources, 'application-dev.yml'), 'spring:\n  datasource:\n    dynamic:\n      datasource:\n        master:\n          url: jdbc:mysql://127.0.0.1:3306/fixture\n          username: audit\n          password: fixture\nspring.data:\n  redis:\n    host: 127.0.0.1\n    port: 6379\n    database: 0\n', 'utf8');
for (const [name, packageName] of [['playwright', '@playwright/mcp'], ['mysql', '@wenit/mysql-mcp-server'], ['redis', '@wenit/redis-mcp-server']]) {
  const wrapper = `tools/mcp/start_${name}_mcp.mjs`;
  fs.copyFileSync(path.join(root, wrapper), path.join(fixture, wrapper));
  const packageDir = path.join(cache, 'node_modules', packageName);
  fs.mkdirSync(packageDir, {recursive: true});
  fs.writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify({name: packageName, bin: 'cli.js'}), 'utf8');
  for (const [label, source, expected] of [
    ['failure', 'process.exitCode=7;', 7],
    ['signal', 'process.kill(process.pid,"SIGTERM");', 143],
  ]) {
    fs.writeFileSync(path.join(packageDir, 'cli.js'), source, 'utf8');
    const run = spawnSync(process.execPath, [path.join(fixture, wrapper)], {cwd: fixture, encoding: 'utf8', timeout: 10000});
    assert.equal(run.error, undefined, `${name} ${label} must terminate`);
    if (label === 'signal' && process.platform === 'win32') assert.notEqual(run.status, 0, `${name}: signal must fail`);
    else assert.equal(run.status, expected, `${name} ${label}: ${run.stderr}`);
  }
}
console.log(`[mcp-cache-test] PASS: 3 package-entry and 6 wrapper-exit scenarios without download; evidence: ${path.relative(root, fixture)}`);
