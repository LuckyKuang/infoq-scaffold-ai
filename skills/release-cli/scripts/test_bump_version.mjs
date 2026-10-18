#!/usr/bin/env node
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {resolveRepoRoot, resolveTmpPath, runCommandChecked, timestampSlug} from '../../../tools/lib/skill_runtime.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(scriptDir);
const fixtureRoot = resolveTmpPath(repoRoot, 'release-cli', `fixture-${timestampSlug()}`, 'repo');
const logFile = resolveTmpPath(repoRoot, 'release-cli', `test-${timestampSlug()}.log`);

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
for (const file of ['tools/check_release_version.mjs', 'tools/lib/skill_runtime.mjs']) {
  fs.mkdirSync(path.dirname(path.join(fixtureRoot, file)), {recursive: true});
  fs.copyFileSync(path.join(repoRoot, file), path.join(fixtureRoot, file));
}
fs.mkdirSync(path.join(fixtureRoot, 'skills'), {recursive: true});
fs.writeFileSync(path.join(fixtureRoot, 'AGENTS.md'), '# AGENTS.md\n', 'utf8');
const versionGate = spawnSync(process.execPath, [path.join(fixtureRoot, 'tools/check_release_version.mjs'), '--expect', '9.9.9'], {encoding: 'utf8'});
assert.equal(versionGate.status, 0, versionGate.stdout + versionGate.stderr);

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
