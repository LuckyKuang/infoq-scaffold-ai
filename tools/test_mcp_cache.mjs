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
console.log(`[mcp-cache-test] PASS: local fixture launched without download; evidence: ${path.relative(root, fixture)}`);
