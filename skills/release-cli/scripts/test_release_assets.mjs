#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolveRepoRoot} from '../../../tools/lib/skill_runtime.mjs';

const scripts = path.dirname(fileURLToPath(import.meta.url));
const root = resolveRepoRoot(scripts);
const base = path.join(root, 'tmp/documentation-reaudit');
fs.mkdirSync(base, {recursive: true});
const assets = fs.mkdtempSync(path.join(base, 'release-assets-'));
const artifacts = {'backend-jar': 'infoq-admin.jar', 'react-dist': 'react-dist.tar.gz', 'vue-dist': 'vue-dist.tar.gz'};
function run(status) {
  const result = spawnSync(process.execPath, [path.join(scripts, 'verify_release_assets.mjs'), assets], {encoding: 'utf8'});
  assert.equal(result.status, status, result.stdout + result.stderr);
  return result;
}
for (const [artifact, name] of Object.entries(artifacts)) {
  fs.mkdirSync(path.join(assets, artifact));
  fs.writeFileSync(path.join(assets, artifact, name), 'fixture content\n', 'utf8');
}
run(0);
for (const [artifact, name] of Object.entries(artifacts)) {
  const file = path.join(assets, artifact, name);
  const held = path.join(base, `held-${path.basename(assets)}-${name}`);
  fs.renameSync(file, held);
  assert.match(run(1).stderr, /资产集合错误/u);
  fs.renameSync(held, file);
  fs.writeFileSync(file, '', 'utf8');
  assert.match(run(1).stderr, /非空普通文件/u);
  fs.unlinkSync(file);
  fs.mkdirSync(file);
  assert.match(run(1).stderr, /非空普通文件/u);
  fs.rmdirSync(file);
  fs.writeFileSync(file, 'fixture content\n', 'utf8');
}
const duplicate = path.join(assets, 'vue-dist', 'infoq-admin.jar');
fs.copyFileSync(path.join(assets, 'backend-jar', 'infoq-admin.jar'), duplicate);
assert.match(run(1).stderr, /资产集合错误/u);
fs.unlinkSync(duplicate);
fs.writeFileSync(path.join(assets, 'extra.jar'), 'unexpected\n', 'utf8');
assert.match(run(1).stderr, /资产集合错误/u);
fs.unlinkSync(path.join(assets, 'extra.jar'));
fs.renameSync(path.join(assets, 'vue-dist', 'vue-dist.tar.gz'), path.join(assets, 'vue-dist', 'wrong-name.tar.gz'));
assert.match(run(1).stderr, /资产集合错误/u);
fs.renameSync(path.join(assets, 'vue-dist', 'wrong-name.tar.gz'), path.join(assets, 'vue-dist', 'vue-dist.tar.gz'));
if (process.platform !== 'win32') {
  const file = path.join(assets, 'backend-jar', 'infoq-admin.jar');
  fs.unlinkSync(file);
  fs.symlinkSync(path.join(assets, 'vue-dist', 'vue-dist.tar.gz'), file);
  assert.match(run(1).stderr, /非空普通文件/u);
  fs.unlinkSync(file);
  fs.writeFileSync(file, 'fixture content\n', 'utf8');
  const directory = path.join(assets, 'backend-jar');
  const held = path.join(base, `held-${path.basename(assets)}-backend`);
  fs.renameSync(directory, held);
  fs.symlinkSync(held, directory);
  assert.match(run(1).stderr, /普通目录/u);
  fs.unlinkSync(directory);
  fs.renameSync(held, directory);
} else {
  console.log('[release-assets-test] symlink cases not run on Windows (privilege requirement)');
}
run(0);
console.log(`[release-assets-test] PASS complete isolated artifact set, each missing/empty/nonregular file, wrong name, duplicate across artifacts and unexpected asset; fixture: ${assets}`);
