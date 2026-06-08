#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeForwardedArgs, resolveRepoRoot, runCommandChecked} from '../../../lib/skill_runtime.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const args = normalizeForwardedArgs(process.argv.slice(2));
let repoRoot = resolveRepoRoot(scriptDir);
let dryRun = false;
let targetVersion = '';

function usage() {
  console.log(`Usage: node .codex/skills/infoq-release-ops/scripts/bump_version.mjs [--dry-run] [--repo-root <path>] <x.y.z>

Examples:
  node .codex/skills/infoq-release-ops/scripts/bump_version.mjs 2.0.3
  node .codex/skills/infoq-release-ops/scripts/bump_version.mjs --dry-run 2.0.3
  node .codex/skills/infoq-release-ops/scripts/bump_version.mjs --repo-root /path/to/infoq-scaffold-ai 2.0.3`);
}

function fail(message) {
  throw new Error(`[version-bump] ${message}`);
}

function readValue(index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    fail(`missing value for ${flag}`);
  }
  return value;
}

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  switch (arg) {
    case '--dry-run':
      dryRun = true;
      break;
    case '--repo-root':
      repoRoot = path.resolve(readValue(index, arg));
      index += 1;
      break;
    case '-h':
    case '--help':
      usage();
      process.exit(0);
      break;
    default:
      if (!targetVersion) {
        targetVersion = arg;
      } else {
        fail(`unexpected argument: ${arg}`);
      }
  }
}

if (!targetVersion) {
  usage();
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(targetVersion)) {
  fail(`target version must match x.y.z, got: ${targetVersion}`);
}

const rootPom = path.join(repoRoot, 'infoq-scaffold-backend', 'pom.xml');
const bomPom = path.join(repoRoot, 'infoq-scaffold-backend', 'infoq-core', 'infoq-core-bom', 'pom.xml');
const reactPackage = path.join(repoRoot, 'infoq-scaffold-frontend-react', 'package.json');
const vuePackage = path.join(repoRoot, 'infoq-scaffold-frontend-vue', 'package.json');
const weappReactPackage = path.join(repoRoot, 'infoq-scaffold-frontend-weapp-react', 'package.json');
const weappVuePackage = path.join(repoRoot, 'infoq-scaffold-frontend-weapp-vue', 'package.json');
const weappVueManifest = path.join(repoRoot, 'infoq-scaffold-frontend-weapp-vue', 'src', 'manifest.json');
const docsPackage = path.join(repoRoot, 'infoq-scaffold-docs', 'package.json');
const readmeFile = path.join(repoRoot, 'README.md');
const deployDoc = path.join(repoRoot, 'doc', 'devops', 'docker-compose-deploy.md');
const docsSyncScript = path.join(repoRoot, 'infoq-scaffold-docs', 'scripts', 'sync-from-root-doc.mjs');
const docsSiteMap = path.join(repoRoot, 'infoq-scaffold-docs', 'site-map.mjs');
const docsSyncedDeployDoc = path.join(repoRoot, 'infoq-scaffold-docs', 'docs', 'devops', 'docker-compose-deploy.md');
const composeFile = path.join(repoRoot, 'script', 'docker', 'docker-compose.yml');
const backendDeployScript = path.join(repoRoot, 'script', 'bin', 'infoq.sh');
const projectReferenceFile = path.join(
  repoRoot,
  '.codex',
  'skills',
  'infoq-project-reference',
  'references',
  'project-reference.md'
);
const springDocConfigTest = path.join(
  repoRoot,
  'infoq-scaffold-backend',
  'infoq-plugin',
  'infoq-plugin-doc',
  'src',
  'test',
  'java',
  'cc',
  'infoq',
  'common',
  'doc',
  'config',
  'SpringDocConfigTest.java'
);
const springDocPropertiesTest = path.join(
  repoRoot,
  'infoq-scaffold-backend',
  'infoq-plugin',
  'infoq-plugin-doc',
  'src',
  'test',
  'java',
  'cc',
  'infoq',
  'common',
  'doc',
  'config',
  'properties',
  'SpringDocPropertiesTest.java'
);

const filesToCheck = [
  rootPom,
  bomPom,
  reactPackage,
  vuePackage,
  weappReactPackage,
  weappVuePackage,
  weappVueManifest,
  docsPackage,
  readmeFile,
  deployDoc,
  docsSyncScript,
  docsSiteMap,
  composeFile,
  backendDeployScript,
  projectReferenceFile,
  springDocConfigTest,
  springDocPropertiesTest
];

function assertFileExists(filePath) {
  if (!fs.existsSync(filePath)) {
    fail(`required file not found: ${filePath}`);
  }
}

function assertContainsFixed(filePath, text, description) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes(text)) {
    fail(`verification failed for ${description} in ${filePath}`);
  }
}

function replaceOrThrow(filePath, pattern, replacement, description) {
  const content = fs.readFileSync(filePath, 'utf8');
  const updated = content.replace(pattern, replacement);
  if (updated === content) {
    fail(`replacement failed for ${description} in ${filePath}`);
  }
  fs.writeFileSync(filePath, updated, 'utf8');
}

function updateJsonTopLevel(filePath, updates) {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  for (const [key, value] of Object.entries(updates)) {
    parsed[key] = value;
  }
  fs.writeFileSync(filePath, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
}

function assertJsonTopLevel(filePath, key, expected, description) {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (parsed[key] !== expected) {
    fail(`verification failed for ${description} in ${filePath}; expected ${expected}, got ${parsed[key]}`);
  }
}

function findInitSqlFile() {
  const sqlDir = path.join(repoRoot, 'sql');
  const matches = fs
    .readdirSync(sqlDir, {withFileTypes: true})
    .filter((entry) => entry.isFile() && /^infoq_scaffold_\d+\.\d+\.\d+\.sql$/.test(entry.name))
    .map((entry) => path.join(sqlDir, entry.name))
    .sort();

  if (matches.length !== 1) {
    fail(`expected exactly one init sql/infoq_scaffold_x.y.z.sql file, found ${matches.length}`);
  }

  return matches[0];
}

for (const filePath of filesToCheck) {
  assertFileExists(filePath);
}

const sqlFilePath = findInitSqlFile();
const sqlFileRel = path.relative(repoRoot, sqlFilePath).replace(/\\/g, '/');

assertContainsFixed(readmeFile, sqlFileRel, 'README SQL reference');
assertContainsFixed(deployDoc, sqlFileRel, 'deploy doc SQL reference');
assertContainsFixed(composeFile, sqlFileRel, 'docker compose SQL reference');
assertContainsFixed(backendDeployScript, sqlFileRel, 'backend deploy script SQL reference');
assertContainsFixed(projectReferenceFile, sqlFileRel, 'project reference SQL reference');

console.log(`[version-bump] repo root: ${repoRoot}`);
console.log(`[version-bump] target version: ${targetVersion}`);
console.log(`[version-bump] sql file kept unchanged: ${sqlFileRel}`);
console.log('[version-bump] managed files:');
for (const filePath of [
  rootPom,
  bomPom,
  reactPackage,
  vuePackage,
  weappReactPackage,
  weappVuePackage,
  weappVueManifest,
  docsPackage,
  readmeFile,
  deployDoc,
  composeFile,
  springDocConfigTest,
  springDocPropertiesTest
]) {
  console.log(`  - ${path.relative(repoRoot, filePath).replace(/\\/g, '/')}`);
}
console.log(`[version-bump] docs sync script: ${path.relative(repoRoot, docsSyncScript).replace(/\\/g, '/')}`);

if (dryRun) {
  console.log('[version-bump] dry-run complete; no files modified.');
  process.exit(0);
}

replaceOrThrow(rootPom, /<revision>[^<]+<\/revision>/, `<revision>${targetVersion}</revision>`, 'backend revision');
replaceOrThrow(bomPom, /<revision>[^<]+<\/revision>/, `<revision>${targetVersion}</revision>`, 'bom revision');
replaceOrThrow(reactPackage, /("version"\s*:\s*")[^"]+(")/, `$1${targetVersion}$2`, 'react package version');
replaceOrThrow(vuePackage, /("version"\s*:\s*")[^"]+(")/, `$1${targetVersion}$2`, 'vue package version');
replaceOrThrow(weappReactPackage, /("version"\s*:\s*")[^"]+(")/, `$1${targetVersion}$2`, 'weapp react package version');
replaceOrThrow(weappVuePackage, /("version"\s*:\s*")[^"]+(")/, `$1${targetVersion}$2`, 'weapp vue package version');
updateJsonTopLevel(weappVueManifest, {
  versionName: targetVersion,
  versionCode: targetVersion.replace(/\./g, '')
});
replaceOrThrow(docsPackage, /("version"\s*:\s*")[^"]+(")/, `$1${targetVersion}$2`, 'docs package version');
replaceOrThrow(readmeFile, /(!\[Version\]\(https:\/\/img\.shields\.io\/badge\/Version-)\d+\.\d+\.\d+(-[^)]*\))/, `$1${targetVersion}$2`, 'README version badge');
replaceOrThrow(deployDoc, /(当前文档对应项目基线版本为 `)[^`]+(`。)/, `$1${targetVersion}$2`, 'deploy doc baseline version');
replaceOrThrow(composeFile, /(image:\s+infoq\/infoq-admin:)\d+\.\d+\.\d+/, `$1${targetVersion}`, 'admin image tag');
replaceOrThrow(composeFile, /(image:\s+infoq\/infoq-frontend-vue:)\d+\.\d+\.\d+/, `$1${targetVersion}`, 'vue image tag');
replaceOrThrow(composeFile, /(image:\s+infoq\/infoq-frontend-react:)\d+\.\d+\.\d+/, `$1${targetVersion}`, 'react image tag');
replaceOrThrow(springDocConfigTest, /(info\.setVersion\(")[^"]+("\);)/g, `$1${targetVersion}$2`, 'springdoc config test setVersion');
replaceOrThrow(springDocConfigTest, /(assertEquals\(")[^"]+(",\s*openAPI\.getInfo\(\)\.getVersion\(\)\);)/g, `$1${targetVersion}$2`, 'springdoc config test assert');
replaceOrThrow(springDocPropertiesTest, /(info\.setVersion\(")[^"]+("\);)/g, `$1${targetVersion}$2`, 'springdoc properties test setVersion');
replaceOrThrow(springDocPropertiesTest, /(assertEquals\(")[^"]+(",\s*properties\.getInfo\(\)\.getVersion\(\)\);)/g, `$1${targetVersion}$2`, 'springdoc properties test assert');

await runCommandChecked(process.execPath, [docsSyncScript], {
  cwd: repoRoot
});

assertContainsFixed(rootPom, `<revision>${targetVersion}</revision>`, 'backend revision');
assertContainsFixed(bomPom, `<revision>${targetVersion}</revision>`, 'bom revision');
assertContainsFixed(reactPackage, `"version": "${targetVersion}"`, 'react package version');
assertContainsFixed(vuePackage, `"version": "${targetVersion}"`, 'vue package version');
assertContainsFixed(weappReactPackage, `"version": "${targetVersion}"`, 'weapp react package version');
assertContainsFixed(weappVuePackage, `"version": "${targetVersion}"`, 'weapp vue package version');
assertJsonTopLevel(weappVueManifest, 'versionName', targetVersion, 'weapp vue manifest versionName');
assertJsonTopLevel(weappVueManifest, 'versionCode', targetVersion.replace(/\./g, ''), 'weapp vue manifest versionCode');
assertContainsFixed(docsPackage, `"version": "${targetVersion}"`, 'docs package version');
assertContainsFixed(readmeFile, `![Version](https://img.shields.io/badge/Version-${targetVersion}-`, 'README version badge');
assertContainsFixed(deployDoc, `当前文档对应项目基线版本为 \`${targetVersion}\`。`, 'deploy doc baseline version');
assertFileExists(docsSyncedDeployDoc);
assertContainsFixed(docsSyncedDeployDoc, `当前文档对应项目基线版本为 \`${targetVersion}\`。`, 'docs site deploy doc baseline version');
assertContainsFixed(composeFile, `image: infoq/infoq-admin:${targetVersion}`, 'admin image tag');
assertContainsFixed(composeFile, `image: infoq/infoq-frontend-vue:${targetVersion}`, 'vue image tag');
assertContainsFixed(composeFile, `image: infoq/infoq-frontend-react:${targetVersion}`, 'react image tag');
assertContainsFixed(springDocConfigTest, `info.setVersion("${targetVersion}");`, 'springdoc config test setVersion');
assertContainsFixed(springDocConfigTest, `assertEquals("${targetVersion}", openAPI.getInfo().getVersion());`, 'springdoc config test assert');
assertContainsFixed(springDocPropertiesTest, `info.setVersion("${targetVersion}");`, 'springdoc properties test setVersion');
assertContainsFixed(springDocPropertiesTest, `assertEquals("${targetVersion}", properties.getInfo().getVersion());`, 'springdoc properties test assert');

console.log('[version-bump] version bump completed successfully.');
console.log('[version-bump] suggested follow-up:');
console.log(`  rg -n "${targetVersion.replace(/\./g, '\\.')}" README.md doc script infoq-scaffold-backend infoq-scaffold-frontend-react infoq-scaffold-frontend-vue infoq-scaffold-frontend-weapp-react infoq-scaffold-frontend-weapp-vue infoq-scaffold-docs`);
console.log('  node .codex/scripts/backend_mvn.mjs -- -pl infoq-plugin/infoq-plugin-doc -am -DskipTests=false -Dsurefire.failIfNoSpecifiedTests=false -Dtest=SpringDocConfigTest,SpringDocPropertiesTest test');
