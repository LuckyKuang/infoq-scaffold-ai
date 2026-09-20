#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveDocTmpPath, resolveRepoRoot, runCommandChecked, timestampSlug} from '../../../tools/lib/skill_runtime.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(scriptDir);
const fixtureRoot = resolveDocTmpPath(repoRoot, 'infoq-release-ops', `fixture-${timestampSlug()}`, 'repo');
const logFile = resolveDocTmpPath(repoRoot, 'infoq-release-ops', `test-${timestampSlug()}.log`);

const files = [
  'README.md',
  'deploy/DOCKER.md',
  'deploy/MANUAL.md',
  'doc/examples/systemd/infoq-admin.service',
  'deploy/bin/infoq.sh',
  'deploy/docker/docker-compose.yml',
  'skills/infoq-project-reference/references/project-reference.md',
  'infoq-scaffold-backend/infoq-admin/src/main/resources/application.yml',
  'infoq-scaffold-backend/infoq-admin/src/main/resources/application-prod.yml',
  'infoq-scaffold-backend/pom.xml',
  'infoq-scaffold-backend/infoq-core/infoq-core-bom/pom.xml',
  'infoq-scaffold-backend/infoq-plugin/infoq-plugin-doc/src/test/java/cc/infoq/common/doc/config/SpringDocConfigTest.java',
  'infoq-scaffold-backend/infoq-plugin/infoq-plugin-doc/src/test/java/cc/infoq/common/doc/config/properties/SpringDocPropertiesTest.java',
  'infoq-scaffold-backend/infoq-plugin/infoq-plugin-quartz/src/main/java/cc/infoq/common/quartz/properties/QuartzManagedProperties.java',
  'infoq-scaffold-backend/infoq-modules/infoq-system/src/test/java/cc/infoq/system/runner/QuartzBootstrapCoordinatorTest.java',
  'infoq-scaffold-frontend-react/package.json',
  'infoq-scaffold-frontend-vue/package.json',
  'sql/infoq_scaffold_2.0.0.sql',
  'sql/infoq_scaffold_update_20260425.sql'
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

assertContains('infoq-scaffold-backend/pom.xml', '<revision>9.9.9</revision>');
assertContains('infoq-scaffold-backend/infoq-core/infoq-core-bom/pom.xml', '<revision>9.9.9</revision>');
assertContains('infoq-scaffold-frontend-react/package.json', '"version": "9.9.9"');
assertContains('infoq-scaffold-frontend-vue/package.json', '"version": "9.9.9"');
assertContains('README.md', 'Version-9.9.9-');
assertContains('deploy/docker/docker-compose.yml', 'image: infoq/infoq-admin:9.9.9');
assertContains('deploy/docker/docker-compose.yml', 'image: infoq/infoq-frontend-vue:9.9.9');
assertContains('deploy/docker/docker-compose.yml', 'image: infoq/infoq-frontend-react:9.9.9');
assertContains('README.md', 'sql/infoq_scaffold_2.0.0.sql');
assertContains('deploy/bin/infoq.sh', 'sql/infoq_scaffold_2.0.0.sql');
assertContains('deploy/docker/docker-compose.yml', 'sql/infoq_scaffold_2.0.0.sql');

console.log('[version-bump-test] pass');
console.log(`[version-bump-test] fixture root: ${fixtureRoot}`);
console.log(`[version-bump-test] log file: ${logFile}`);
