#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {resolveRepoRoot, resolveTmpPath, runCommandChecked, timestampSlug} from '../../../tools/lib/skill_runtime.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(scriptDir);
const fixtureRoot = resolveTmpPath(repoRoot, 'documentation-reaudit', 'release-cli', `fixture-${timestampSlug()}`, 'repo');
const logFile = resolveTmpPath(repoRoot, 'documentation-reaudit', 'release-cli', `test-${timestampSlug()}.log`);

const sqlDir = path.join(repoRoot, 'sql');
const initSqlCandidates = fs
  .readdirSync(sqlDir, {withFileTypes: true})
  .filter((entry) => entry.isFile() && /^infoq_scaffold_\d+\.\d+\.\d+\.sql$/.test(entry.name))
  .map((entry) => `sql/${entry.name}`)
  .sort();

if (initSqlCandidates.length !== 1) {
  throw new Error(`[version-bump-test] expected exactly one sql/infoq_scaffold_x.y.z.sql, found ${initSqlCandidates.length}`);
}

const [initSqlRelPath] = initSqlCandidates;

const files = [
  'README.md',
  'README_CN.md',
  'README_JA.md',
  'README_ZH_TW.md',
  'deploy/DOCKER.md',
  'deploy/.env.example',
  'deploy/bin/infoq.sh',
  'deploy/docker/docker-compose.yml',
  'backend/infoq-admin/src/main/resources/application.yml',
  'backend/infoq-admin/src/main/resources/application-prod.yml',
  'backend/pom.xml',
  'backend/infoq-core/infoq-core-bom/pom.xml',
  'backend/infoq-plugin/infoq-plugin-doc/src/test/java/cc/infoq/common/doc/config/SpringDocConfigTest.java',
  'backend/infoq-plugin/infoq-plugin-doc/src/test/java/cc/infoq/common/doc/config/properties/SpringDocPropertiesTest.java',
  'backend/infoq-plugin/infoq-plugin-quartz/src/main/java/cc/infoq/common/quartz/properties/QuartzManagedProperties.java',
  'backend/infoq-modules/infoq-system/src/test/java/cc/infoq/system/runner/QuartzBootstrapCoordinatorTest.java',
  'frontend-react/package.json',
  'frontend-vue/package.json',
  'frontend-react/pnpm-lock.yaml',
  'frontend-vue/pnpm-lock.yaml',
  initSqlRelPath
];

for (const relPath of files) {
  const sourcePath = path.join(repoRoot, relPath);
  const targetPath = path.join(fixtureRoot, relPath);
  fs.mkdirSync(path.dirname(targetPath), {recursive: true});
  fs.copyFileSync(sourcePath, targetPath);
}

const before = new Map(files.map((relPath) => [relPath, fs.readFileSync(path.join(fixtureRoot, relPath))]));
await runCommandChecked(process.execPath, [path.join(scriptDir, 'bump_version.mjs'), '--repo-root', fixtureRoot, '--dry-run', '9.9.9'], {
  cwd: repoRoot,
  stdio: ['ignore', fs.openSync(logFile, 'a'), fs.openSync(logFile, 'a')]
});
for (const [relPath, content] of before) {
  assert.deepEqual(fs.readFileSync(path.join(fixtureRoot, relPath)), content, `dry-run modified ${relPath}`);
}

await runCommandChecked(process.execPath, [path.join(scriptDir, 'bump_version.mjs'), '--repo-root', fixtureRoot, '9.9.9'], {
  cwd: repoRoot,
  stdio: ['ignore', fs.openSync(logFile, 'a'), fs.openSync(logFile, 'a')]
});

function assertContains(relPath, expected) {
  const content = fs.readFileSync(path.join(fixtureRoot, relPath), 'utf8');
  if (!content.includes(expected)) {
    throw new Error(`[version-bump-test] missing ${expected} in ${relPath}`);
  }
}

assertContains('backend/pom.xml', '<revision>9.9.9</revision>');
assertContains('backend/infoq-core/infoq-core-bom/pom.xml', '<revision>9.9.9</revision>');
assertContains('frontend-react/package.json', '"version": "9.9.9"');
assertContains('frontend-vue/package.json', '"version": "9.9.9"');
assertContains('README.md', 'Version-9.9.9-');
assertContains('README_CN.md', 'Version-9.9.9-');
assertContains('README_JA.md', 'Version-9.9.9-');
assertContains('README_ZH_TW.md', 'Version-9.9.9-');
assertContains('deploy/docker/docker-compose.yml', 'image: infoq/infoq-admin:9.9.9');
assertContains('deploy/docker/docker-compose.yml', 'image: infoq/infoq-frontend-vue:9.9.9');
assertContains('deploy/docker/docker-compose.yml', 'image: infoq/infoq-frontend-react:9.9.9');
assertContains('README.md', initSqlRelPath);
assertContains('README_CN.md', initSqlRelPath);
assertContains('deploy/DOCKER.md', initSqlRelPath);
assertContains('deploy/DOCKER.md', '当前文档对应项目基线版本为 `9.9.9`。');
assertContains('deploy/.env.example', 'INFOQ_VERSION=9.9.9');
assertContains('deploy/bin/infoq.sh', initSqlRelPath);
assertContains('deploy/docker/docker-compose.yml', initSqlRelPath);
assert.deepEqual(fs.readFileSync(path.join(fixtureRoot, initSqlRelPath)), before.get(initSqlRelPath), 'frozen SQL content changed');
for (const relPath of [
  'backend/infoq-admin/src/main/resources/application.yml',
  'backend/infoq-admin/src/main/resources/application-prod.yml',
  'backend/infoq-plugin/infoq-plugin-quartz/src/main/java/cc/infoq/common/quartz/properties/QuartzManagedProperties.java',
  'backend/infoq-modules/infoq-system/src/test/java/cc/infoq/system/runner/QuartzBootstrapCoordinatorTest.java'
]) {
  const versions = fs.readFileSync(path.join(fixtureRoot, relPath), 'utf8').match(/\b\d+\.\d+\.\d+(?=-\d{14}\b)/g) ?? [];
  assert.ok(versions.length > 0, `missing DEPLOY_ID examples in ${relPath}`);
  assert.ok(versions.every(version => version === '9.9.9'), `stale DEPLOY_ID in ${relPath}`);
}

// Use the production consistency gate to detect missing managed version sources.
for (const file of ['tools/check_release_version.mjs', 'tools/lib/skill_runtime.mjs', 'tools/lib/release_version.mjs']) {
  fs.mkdirSync(path.dirname(path.join(fixtureRoot, file)), {recursive: true});
  fs.copyFileSync(path.join(repoRoot, file), path.join(fixtureRoot, file));
}
fs.mkdirSync(path.join(fixtureRoot, 'skills'), {recursive: true});
fs.writeFileSync(path.join(fixtureRoot, 'AGENTS.md'), '# AGENTS.md\n', 'utf8');
const versionGate = spawnSync(process.execPath, [path.join(fixtureRoot, 'tools/check_release_version.mjs'), '--expect', '9.9.9'], {encoding: 'utf8'});
assert.equal(versionGate.status, 0, versionGate.stdout + versionGate.stderr);

// 完整反复同步必须保留 RC 后缀、徽标转义及部署日期，且不触碰 SQL 或依赖锁。
for (const target of ['3.0.0-rc1', '3.0.0-rc2', '3.0.0-rc10', '3.0.0']) {
  const bumped = spawnSync(process.execPath, [path.join(scriptDir, 'bump_version.mjs'), '--repo-root', fixtureRoot, target], {encoding: 'utf8'});
  assert.equal(bumped.status, 0, bumped.stdout + bumped.stderr);
  const checked = spawnSync(process.execPath, [path.join(fixtureRoot, 'tools/check_release_version.mjs'), '--tag', `v${target}`], {encoding: 'utf8'});
  assert.equal(checked.status, 0, checked.stdout + checked.stderr);
  for (const readme of ['README.md', 'README_CN.md', 'README_JA.md', 'README_ZH_TW.md']) assertContains(readme, `Version-${target.replaceAll('-', '--')}-`);
  for (const relPath of [
    'backend/infoq-admin/src/main/resources/application.yml',
    'backend/infoq-admin/src/main/resources/application-prod.yml',
    'backend/infoq-plugin/infoq-plugin-quartz/src/main/java/cc/infoq/common/quartz/properties/QuartzManagedProperties.java',
    'backend/infoq-modules/infoq-system/src/test/java/cc/infoq/system/runner/QuartzBootstrapCoordinatorTest.java'
  ]) {
    const content = fs.readFileSync(path.join(fixtureRoot, relPath), 'utf8');
    const deployIds = content.match(/\b\d+\.\d+\.\d+(?:-rc\d+)?-\d{14}\b/gu) ?? [];
    assert.ok(deployIds.length > 0 && deployIds.every(id => id.startsWith(`${target}-`)), `invalid DEPLOY_ID in ${relPath}: ${deployIds}`);
    const datesBefore = before.get(relPath).toString('utf8').match(/\d{14}/gu);
    assert.deepEqual(content.match(/\d{14}/gu), datesBefore, `DEPLOY_ID date changed in ${relPath}`);
    assert.ok(!content.includes('-rc1-rc') && !content.includes('-rc2-rc'), 'duplicated RC suffix');
  }
  for (const relPath of [initSqlRelPath, 'frontend-react/pnpm-lock.yaml', 'frontend-vue/pnpm-lock.yaml']) assert.deepEqual(fs.readFileSync(path.join(fixtureRoot, relPath)), before.get(relPath), `immutable file changed: ${relPath}`);
}
const beforeInvalidArgs = new Map(files.map(file => [file, fs.readFileSync(path.join(fixtureRoot, file))]));
for (const invalidArgs of [
  ['3.0.0-rc0'], ['3.0.0-rc01'], ['3.0.0-beta1'], ['3.0.0+build'], ['--bogus', '3.0.1'],
  ['--dry-run', '--dry-run', '3.0.1'], ['--repo-root'], ['--repo-root', '--help', '3.0.1']
]) {
  const rejected = spawnSync(process.execPath, [path.join(scriptDir, 'bump_version.mjs'), '--repo-root', fixtureRoot, ...invalidArgs], {encoding: 'utf8'});
  assert.equal(rejected.status, 1, rejected.stdout + rejected.stderr);
  for (const [file, contents] of beforeInvalidArgs) assert.deepEqual(fs.readFileSync(path.join(fixtureRoot, file)), contents, `invalid arguments modified ${file}`);
}
for (const [file, from, to] of [
  ['README.md', 'Version-3.0.0-', 'Version-3.0.0-rc1-'],
  ['deploy/docker/docker-compose.yml', 'image: infoq/infoq-admin:3.0.0', 'image: infoq/infoq-admin:3.0.0-rc1-extra']
]) {
  const absolute = path.join(fixtureRoot, file);
  const original = fs.readFileSync(absolute, 'utf8');
  fs.writeFileSync(absolute, original.replace(from, to), 'utf8');
  const snapshot = new Map(files.map(rel => [rel, fs.readFileSync(path.join(fixtureRoot, rel))]));
  const rejected = spawnSync(process.execPath, [path.join(scriptDir, 'bump_version.mjs'), '--repo-root', fixtureRoot, '3.0.1'], {encoding: 'utf8'});
  assert.equal(rejected.status, 1, rejected.stdout + rejected.stderr);
  for (const [rel, contents] of snapshot) assert.deepEqual(fs.readFileSync(path.join(fixtureRoot, rel)), contents, `malformed source changed ${rel}`);
  fs.writeFileSync(absolute, original, 'utf8');
}

// A late replacement failure must leave every managed file unchanged.
const invalidReadme = path.join(fixtureRoot, 'README.md');
fs.writeFileSync(invalidReadme, fs.readFileSync(invalidReadme, 'utf8').replace('![Version]', '![Invalid version field]'), 'utf8');
const beforeFailure = new Map(files.map(file => [file, fs.readFileSync(path.join(fixtureRoot, file))]));
for (const mode of [[], ['--dry-run']]) {
  const rejected = spawnSync(process.execPath, [path.join(scriptDir, 'bump_version.mjs'), '--repo-root', fixtureRoot, ...mode, '9.9.10'], {encoding: 'utf8'});
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /replacement failed for README version badge/u);
  for (const [file, contents] of beforeFailure) {
    assert.deepEqual(fs.readFileSync(path.join(fixtureRoot, file)), contents, `failed preflight modified ${file}`);
  }
}

console.log('[version-bump-test] pass');
console.log(`[version-bump-test] fixture root: ${fixtureRoot}`);
console.log(`[version-bump-test] log file: ${logFile}`);
