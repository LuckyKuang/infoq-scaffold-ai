#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');
const fixtureParent = path.join(repoRoot, 'tmp', 'test-cli');
fs.mkdirSync(fixtureParent, { recursive: true });
const fixtureDir = fs.mkdtempSync(path.join(fixtureParent, 'case-matrix-test-'));

function run(script, args) {
  return spawnSync(process.execPath, [path.join(scriptDir, script), ...args], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
}

try {
  const generated = run('generate-case-matrix.mjs', ['--output-dir', fixtureDir]);
  assert.equal(generated.status, 0, generated.stderr);
  const matrixPath = path.join(fixtureDir, 'case-matrix.json');
  const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
  const fixed = matrix.cases.filter((item) => item.source === 'fixed-route');
  for (const routePath of [
    '/login', '/oauth/callback', '/register', '/forgot-password', '/index',
    '/user/profile', '/message-center', '/401', '/404', '/redirect/:path*'
  ]) {
    const matches = fixed.filter((item) => item.routePath === routePath);
    assert.equal(matches.length, 1, `${routePath} must have one shared business case`);
    assert.deepEqual(matches[0].clients, ['react', 'vue'], `${routePath} must resolve in both clients`);
  }
  const messageCase = fixed.find((item) => item.routePath === '/message-center');
  assert.equal(messageCase.moduleKey, 'message.center');
  assert.equal(messageCase.component, 'message-center/index');
  assert.equal(messageCase.sideEffect, false);
  assert.ok(messageCase.preconditions.some((value) => value.includes('有效登录态')));
  assert.ok(!matrix.gaps.some((gap) => gap.component === 'message-center/index'));
  assert.ok(fs.readFileSync(path.join(fixtureDir, 'case-matrix.md'), 'utf8').includes('FE-MESSAGE-CENTER'));
  assert.equal(matrix.summary.totalCases, matrix.cases.length);
  const gatedWrites = matrix.cases.filter((item) => item.sideEffect && /^(?:monitor\.(?:job|cache)|system\.oss)(?:\.|$)/u.test(item.moduleKey));
  assert.ok(gatedWrites.length > 0);
  for (const item of gatedWrites) assert.equal(item.priority, 'P2', `${item.id} changes gated resources`);
  assert.equal(run('validate-case-matrix.mjs', [matrixPath]).status, 0);

  // Exercise real SQL -> Markdown rendering without editing the repository menu baseline.
  const isolatedRepo = path.join(fixtureDir, 'repository');
  for (const relative of ['skills/test-cli/scripts/generate-case-matrix.mjs', 'tools/lib/skill_runtime.mjs']) {
    const target = path.join(isolatedRepo, relative);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.copyFileSync(path.join(repoRoot, relative), target);
  }
  fs.writeFileSync(path.join(isolatedRepo, 'AGENTS.md'), '# Fixture\n', 'utf8');
  fs.mkdirSync(path.join(isolatedRepo, 'sql'));
  const menuName = String.raw`left\|middle\\|right|end`;
  fs.writeFileSync(path.join(isolatedRepo, 'sql/infoq_scaffold_update_20261018.sql'),
    `INSERT INTO sys_menu (menu_id, menu_name, parent_id, menu_type, path, component) VALUES ('1', '${menuName}', '0', 'C', 'fixture', 'fixture/index');\n`, 'utf8');
  const isolatedOutput = path.join(fixtureDir, 'escaped-output');
  const escaped = spawnSync(process.execPath, [path.join(isolatedRepo, 'skills/test-cli/scripts/generate-case-matrix.mjs'), '--output-dir', isolatedOutput], {encoding: 'utf8', timeout: 10000});
  assert.equal(escaped.status, 0, escaped.stderr);
  const rendered = fs.readFileSync(path.join(isolatedOutput, 'case-matrix.md'), 'utf8');
  assert.ok(rendered.includes(String.raw`left\\\|middle\\\\\|right\|end`), 'literal backslashes must remain distinct from table separators');

  matrix.cases.push({ ...messageCase });
  matrix.summary.totalCases += 1;
  const duplicatePath = path.join(fixtureDir, 'duplicate.json');
  fs.writeFileSync(duplicatePath, `${JSON.stringify(matrix)}\n`, 'utf8');
  const duplicate = run('validate-case-matrix.mjs', [duplicatePath]);
  assert.equal(duplicate.status, 1);
  assert.match(duplicate.stderr, /duplicate id FE-MESSAGE-CENTER/);
  console.log('Case matrix regression passed: shared fixed routes, protected message center, generated evidence, duplicate rejection.');
} finally {
  fs.rmSync(fixtureDir, { recursive: true, force: true });
}
