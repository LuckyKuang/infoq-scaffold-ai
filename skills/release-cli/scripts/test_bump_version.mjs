#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
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
  'deploy/DOCKER.md',
  'deploy/MANUAL.md',
  'deploy/examples/systemd/infoq-admin.service',
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
assertContains('deploy/docker/docker-compose.yml', 'image: infoq/infoq-admin:9.9.9');
assertContains('deploy/docker/docker-compose.yml', 'image: infoq/infoq-frontend-vue:9.9.9');
assertContains('deploy/docker/docker-compose.yml', 'image: infoq/infoq-frontend-react:9.9.9');
assertContains('README.md', initSqlRelPath);
assertContains('deploy/DOCKER.md', initSqlRelPath);
assertContains('deploy/DOCKER.md', '当前文档对应项目基线版本为 `9.9.9`。');
assertContains('deploy/bin/infoq.sh', initSqlRelPath);
assertContains('deploy/docker/docker-compose.yml', initSqlRelPath);

console.log('[version-bump-test] pass');
console.log(`[version-bump-test] fixture root: ${fixtureRoot}`);
console.log(`[version-bump-test] log file: ${logFile}`);
