#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveDocTmpPath, resolveRepoRoot, runCommandChecked, timestampSlug} from '../../../lib/skill_runtime.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(scriptDir);
const fixtureRoot = resolveDocTmpPath(repoRoot, 'infoq-release-ops', `fixture-${timestampSlug()}`, 'repo');
const logFile = resolveDocTmpPath(repoRoot, 'infoq-release-ops', `test-${timestampSlug()}.log`);

function copyFile(relPath) {
  const sourcePath = path.join(repoRoot, relPath);
  const targetPath = path.join(fixtureRoot, relPath);
  fs.mkdirSync(path.dirname(targetPath), {recursive: true});
  fs.copyFileSync(sourcePath, targetPath);
}

function writeMinimalDocsSiteMap() {
  const targetPath = path.join(fixtureRoot, 'infoq-scaffold-docs', 'site-map.mjs');
  fs.writeFileSync(
    targetPath,
    `export const repoUrl = 'https://github.com/luckykuang/infoq-scaffold-ai';
export const repoBlobBase = \`\${repoUrl}/blob/main\`;
export const sourceDocRoot = 'doc';
export const generatedPages = [
  {
    source: 'devops/docker-compose-deploy.md',
    target: 'devops/docker-compose-deploy.md',
    title: 'Docker Compose 部署',
    description: 'Fixture docs page',
    route: '/devops/docker-compose-deploy'
  }
];
export const generatedPageBySource = new Map(generatedPages.map((page) => [page.source, page]));
`,
    'utf8'
  );
}

function assertContainsFixed(filePath, text) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes(text)) {
    throw new Error(`[version-bump-test] missing expected text in ${filePath}: ${text}`);
  }
}

const files = [
  'README.md',
  'doc/devops/docker-compose-deploy.md',
  'script/bin/infoq.sh',
  'script/docker/docker-compose.yml',
  '.codex/skills/infoq-project-reference/references/project-reference.md',
  'infoq-scaffold-backend/pom.xml',
  'infoq-scaffold-backend/infoq-core/infoq-core-bom/pom.xml',
  'infoq-scaffold-backend/infoq-plugin/infoq-plugin-doc/src/test/java/cc/infoq/common/doc/config/SpringDocConfigTest.java',
  'infoq-scaffold-backend/infoq-plugin/infoq-plugin-doc/src/test/java/cc/infoq/common/doc/config/properties/SpringDocPropertiesTest.java',
  'infoq-scaffold-docs/package.json',
  'infoq-scaffold-docs/scripts/sync-from-root-doc.mjs',
  'infoq-scaffold-frontend-react/package.json',
  'infoq-scaffold-frontend-react-pro/package.json',
  'infoq-scaffold-frontend-vue/package.json',
  'infoq-scaffold-frontend-weapp-react/package.json',
  'infoq-scaffold-frontend-weapp-vue/package.json',
  'infoq-scaffold-frontend-weapp-vue/src/manifest.json',
  'sql/infoq_scaffold_2.0.0.sql',
  'sql/infoq_scaffold_update_20260425.sql'
];

for (const relPath of files) {
  copyFile(relPath);
}

fs.mkdirSync(path.join(fixtureRoot, 'doc', 'images'), {recursive: true});
fs.mkdirSync(path.join(fixtureRoot, 'doc', 'examples'), {recursive: true});
fs.mkdirSync(path.join(fixtureRoot, 'infoq-scaffold-docs', 'docs', 'devops'), {recursive: true});
writeMinimalDocsSiteMap();

await runCommandChecked(process.execPath, [path.join(scriptDir, 'bump_version.mjs'), '--repo-root', fixtureRoot, '9.9.9'], {
  cwd: repoRoot,
  stdio: ['ignore', fs.openSync(logFile, 'a'), fs.openSync(logFile, 'a')]
});

assertContainsFixed(path.join(fixtureRoot, 'infoq-scaffold-backend', 'pom.xml'), '<revision>9.9.9</revision>');
assertContainsFixed(path.join(fixtureRoot, 'infoq-scaffold-backend', 'infoq-core', 'infoq-core-bom', 'pom.xml'), '<revision>9.9.9</revision>');
assertContainsFixed(path.join(fixtureRoot, 'infoq-scaffold-frontend-react', 'package.json'), '"version": "9.9.9"');
assertContainsFixed(path.join(fixtureRoot, 'infoq-scaffold-frontend-react-pro', 'package.json'), '"version": "9.9.9"');
assertContainsFixed(path.join(fixtureRoot, 'infoq-scaffold-frontend-vue', 'package.json'), '"version": "9.9.9"');
assertContainsFixed(path.join(fixtureRoot, 'infoq-scaffold-frontend-weapp-react', 'package.json'), '"version": "9.9.9"');
assertContainsFixed(path.join(fixtureRoot, 'infoq-scaffold-frontend-weapp-vue', 'package.json'), '"version": "9.9.9"');
assertContainsFixed(path.join(fixtureRoot, 'infoq-scaffold-frontend-weapp-vue', 'src', 'manifest.json'), '"versionName": "9.9.9"');
assertContainsFixed(path.join(fixtureRoot, 'infoq-scaffold-frontend-weapp-vue', 'src', 'manifest.json'), '"versionCode": "999"');
assertContainsFixed(path.join(fixtureRoot, 'infoq-scaffold-docs', 'package.json'), '"version": "9.9.9"');
assertContainsFixed(path.join(fixtureRoot, 'README.md'), '![Version](https://img.shields.io/badge/Version-9.9.9-');
assertContainsFixed(path.join(fixtureRoot, 'doc', 'devops', 'docker-compose-deploy.md'), '当前文档对应项目基线版本为 `9.9.9`。');
assertContainsFixed(path.join(fixtureRoot, 'infoq-scaffold-docs', 'docs', 'devops', 'docker-compose-deploy.md'), '当前文档对应项目基线版本为 `9.9.9`。');
assertContainsFixed(path.join(fixtureRoot, 'script', 'docker', 'docker-compose.yml'), 'image: infoq/infoq-admin:9.9.9');
assertContainsFixed(path.join(fixtureRoot, 'script', 'docker', 'docker-compose.yml'), 'image: infoq/infoq-frontend-vue:9.9.9');
assertContainsFixed(path.join(fixtureRoot, 'script', 'docker', 'docker-compose.yml'), 'image: infoq/infoq-frontend-react:9.9.9');
assertContainsFixed(path.join(fixtureRoot, 'script', 'docker', 'docker-compose.yml'), 'image: infoq/infoq-frontend-react-pro:9.9.9');
assertContainsFixed(path.join(fixtureRoot, 'README.md'), 'sql/infoq_scaffold_2.0.0.sql');
assertContainsFixed(path.join(fixtureRoot, 'script', 'bin', 'infoq.sh'), 'sql/infoq_scaffold_2.0.0.sql');
assertContainsFixed(path.join(fixtureRoot, 'script', 'docker', 'docker-compose.yml'), 'sql/infoq_scaffold_2.0.0.sql');
assertContainsFixed(
  path.join(fixtureRoot, '.codex', 'skills', 'infoq-project-reference', 'references', 'project-reference.md'),
  'sql/infoq_scaffold_2.0.0.sql'
);

console.log('[version-bump-test] pass');
console.log(`[version-bump-test] fixture root: ${fixtureRoot}`);
console.log(`[version-bump-test] log file: ${logFile}`);
