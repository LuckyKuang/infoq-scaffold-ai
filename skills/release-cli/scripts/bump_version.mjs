#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeForwardedArgs, resolveRepoRoot, runCommandChecked} from '../../../tools/lib/skill_runtime.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const args = normalizeForwardedArgs(process.argv.slice(2));
let repoRoot = resolveRepoRoot(scriptDir);
let dryRun = false;
let targetVersion = '';

function usage() {
  console.log(`Usage: node skills/release-cli/scripts/bump_version.mjs [--dry-run] [--repo-root <path>] <x.y.z>

Examples:
  node skills/release-cli/scripts/bump_version.mjs 2.0.3
  node skills/release-cli/scripts/bump_version.mjs --dry-run 2.0.3
  node skills/release-cli/scripts/bump_version.mjs --repo-root /path/to/infoq-scaffold-ai 2.0.3`);
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

const rootPom = path.join(repoRoot, 'backend', 'pom.xml');
const bomPom = path.join(repoRoot, 'backend', 'infoq-core', 'infoq-core-bom', 'pom.xml');
const reactPackage = path.join(repoRoot, 'frontend-react', 'package.json');
const vuePackage = path.join(repoRoot, 'frontend-vue', 'package.json');
const readmeFile = path.join(repoRoot, 'README.md');
const readmeCnFile = path.join(repoRoot, 'README_CN.md');
const readmeJaFile = path.join(repoRoot, 'README_JA.md');
const readmeZhTwFile = path.join(repoRoot, 'README_ZH_TW.md');
const deployDoc = path.join(repoRoot, 'deploy', 'DOCKER.md');
const manualDeployDoc = path.join(repoRoot, 'deploy', 'MANUAL.md');
const systemdExample = path.join(repoRoot, 'deploy', 'examples', 'systemd', 'infoq-admin.service');
const composeFile = path.join(repoRoot, 'deploy', 'docker', 'docker-compose.yml');
const backendDeployScript = path.join(repoRoot, 'deploy', 'bin', 'infoq.sh');
const appYaml = path.join(repoRoot, 'backend', 'infoq-admin', 'src', 'main', 'resources', 'application.yml');
const appProdYaml = path.join(
  repoRoot,
  'backend',
  'infoq-admin',
  'src',
  'main',
  'resources',
  'application-prod.yml'
);
const springDocConfigTest = path.join(
  repoRoot,
  'backend',
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
  'backend',
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
const quartzManagedProperties = path.join(
  repoRoot,
  'backend',
  'infoq-plugin',
  'infoq-plugin-quartz',
  'src',
  'main',
  'java',
  'cc',
  'infoq',
  'common',
  'quartz',
  'properties',
  'QuartzManagedProperties.java'
);
const quartzBootstrapCoordinatorTest = path.join(
  repoRoot,
  'backend',
  'infoq-modules',
  'infoq-system',
  'src',
  'test',
  'java',
  'cc',
  'infoq',
  'system',
  'runner',
  'QuartzBootstrapCoordinatorTest.java'
);

const filesToCheck = [
  rootPom,
  bomPom,
  reactPackage,
  vuePackage,
  readmeFile,
  readmeCnFile,
  readmeJaFile,
  readmeZhTwFile,
  deployDoc,
  manualDeployDoc,
  systemdExample,
  composeFile,
  backendDeployScript,
  appYaml,
  appProdYaml,
  springDocConfigTest,
  springDocPropertiesTest,
  quartzManagedProperties,
  quartzBootstrapCoordinatorTest
];

const deployIdExampleFiles = [
  [manualDeployDoc, 'manual deploy doc deploy-id example'],
  [systemdExample, 'systemd deploy-id example'],
  [appYaml, 'application.yml deploy-id comment'],
  [appProdYaml, 'application-prod.yml deploy-id comment'],
  [quartzManagedProperties, 'QuartzManagedProperties deploy-id comment'],
  [quartzBootstrapCoordinatorTest, 'Quartz bootstrap coordinator deploy-id assertions']
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
  const matcher = pattern instanceof RegExp ? new RegExp(pattern.source, pattern.flags.replace(/g/g, '')) : pattern;
  const matched = matcher instanceof RegExp ? matcher.test(content) : content.includes(matcher);
  const updated = content.replace(pattern, replacement);
  if (updated === content && !matched) {
    fail(`replacement failed for ${description} in ${filePath}`);
  }
  if (updated !== content) {
    fs.writeFileSync(filePath, updated, 'utf8');
  }
}

function replaceDeployIdVersionExamples(filePath, description) {
  replaceOrThrow(filePath, /\b\d+\.\d+\.\d+(?=-\d{14}\b)/g, targetVersion, description);
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

function assertDeployIdVersionExamples(filePath, description) {
  const content = fs.readFileSync(filePath, 'utf8');
  const matches = content.match(/\b\d+\.\d+\.\d+(?=-\d{14}\b)/g) ?? [];
  if (matches.length === 0) {
    fail(`verification failed for ${description} in ${filePath}; no deploy-id version examples found`);
  }
  const staleVersions = [...new Set(matches.filter((version) => version !== targetVersion))];
  if (staleVersions.length > 0) {
    fail(
      `verification failed for ${description} in ${filePath}; expected deploy-id version ${targetVersion}, got ${staleVersions.join(', ')}`
    );
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
assertContainsFixed(readmeCnFile, sqlFileRel, 'README_CN SQL reference');
assertContainsFixed(deployDoc, sqlFileRel, 'deploy doc SQL reference');
assertContainsFixed(composeFile, sqlFileRel, 'docker compose SQL reference');
assertContainsFixed(backendDeployScript, sqlFileRel, 'backend deploy script SQL reference');

console.log(`[version-bump] repo root: ${repoRoot}`);
console.log(`[version-bump] target version: ${targetVersion}`);
console.log(`[version-bump] sql file kept unchanged: ${sqlFileRel}`);
console.log('[version-bump] managed files:');
for (const filePath of [
  rootPom,
  bomPom,
  reactPackage,
  vuePackage,
  readmeFile,
  readmeCnFile,
  readmeJaFile,
  readmeZhTwFile,
  deployDoc,
  manualDeployDoc,
  systemdExample,
  composeFile,
  appYaml,
  appProdYaml,
  quartzManagedProperties,
  quartzBootstrapCoordinatorTest,
  springDocConfigTest,
  springDocPropertiesTest,
]) {
  console.log(`  - ${path.relative(repoRoot, filePath).replace(/\\/g, '/')}`);
}

if (dryRun) {
  console.log('[version-bump] dry-run complete; no files modified.');
  process.exit(0);
}

replaceOrThrow(rootPom, /<revision>[^<]+<\/revision>/, `<revision>${targetVersion}</revision>`, 'backend revision');
replaceOrThrow(bomPom, /<revision>[^<]+<\/revision>/, `<revision>${targetVersion}</revision>`, 'bom revision');
replaceOrThrow(reactPackage, /("version"\s*:\s*")[^"]+(")/, `$1${targetVersion}$2`, 'react package version');
replaceOrThrow(vuePackage, /("version"\s*:\s*")[^"]+(")/, `$1${targetVersion}$2`, 'vue package version');
replaceOrThrow(readmeFile, /(!\[Version\]\(https:\/\/img\.shields\.io\/badge\/Version-)\d+\.\d+\.\d+(-[^)]*\))/, `$1${targetVersion}$2`, 'README version badge');
replaceOrThrow(readmeCnFile, /(!\[Version\]\(https:\/\/img\.shields\.io\/badge\/Version-)\d+\.\d+\.\d+(-[^)]*\))/, `$1${targetVersion}$2`, 'README_CN version badge');
replaceOrThrow(readmeJaFile, /(!\[Version\]\(https:\/\/img\.shields\.io\/badge\/Version-)\d+\.\d+\.\d+(-[^)]*\))/, `$1${targetVersion}$2`, 'README_JA version badge');
replaceOrThrow(readmeZhTwFile, /(!\[Version\]\(https:\/\/img\.shields\.io\/badge\/Version-)\d+\.\d+\.\d+(-[^)]*\))/, `$1${targetVersion}$2`, 'README_ZH_TW version badge');
replaceOrThrow(deployDoc, /(当前文档对应项目基线版本为 `)[^`]+(`。)/, `$1${targetVersion}$2`, 'deploy doc baseline version');
for (const [filePath, description] of deployIdExampleFiles) {
  replaceDeployIdVersionExamples(filePath, description);
}
replaceOrThrow(composeFile, /(image:\s+infoq\/infoq-admin:)\d+\.\d+\.\d+/, `$1${targetVersion}`, 'admin image tag');
replaceOrThrow(composeFile, /(image:\s+infoq\/infoq-frontend-vue:)\d+\.\d+\.\d+/, `$1${targetVersion}`, 'vue image tag');
replaceOrThrow(composeFile, /(image:\s+infoq\/infoq-frontend-react:)\d+\.\d+\.\d+/, `$1${targetVersion}`, 'react image tag');
replaceOrThrow(springDocConfigTest, /(info\.setVersion\(")[^"]+("\);)/g, `$1${targetVersion}$2`, 'springdoc config test setVersion');
replaceOrThrow(springDocConfigTest, /(assertEquals\(")[^"]+(",\s*openAPI\.getInfo\(\)\.getVersion\(\)\);)/g, `$1${targetVersion}$2`, 'springdoc config test assert');
replaceOrThrow(springDocPropertiesTest, /(info\.setVersion\(")[^"]+("\);)/g, `$1${targetVersion}$2`, 'springdoc properties test setVersion');
replaceOrThrow(springDocPropertiesTest, /(assertEquals\(")[^"]+(",\s*properties\.getInfo\(\)\.getVersion\(\)\);)/g, `$1${targetVersion}$2`, 'springdoc properties test assert');


assertContainsFixed(rootPom, `<revision>${targetVersion}</revision>`, 'backend revision');
assertContainsFixed(bomPom, `<revision>${targetVersion}</revision>`, 'bom revision');
assertContainsFixed(reactPackage, `"version": "${targetVersion}"`, 'react package version');
assertContainsFixed(vuePackage, `"version": "${targetVersion}"`, 'vue package version');
assertContainsFixed(readmeFile, `![Version](https://img.shields.io/badge/Version-${targetVersion}-`, 'README version badge');
assertContainsFixed(readmeCnFile, `![Version](https://img.shields.io/badge/Version-${targetVersion}-`, 'README_CN version badge');
assertContainsFixed(readmeJaFile, `![Version](https://img.shields.io/badge/Version-${targetVersion}-`, 'README_JA version badge');
assertContainsFixed(readmeZhTwFile, `![Version](https://img.shields.io/badge/Version-${targetVersion}-`, 'README_ZH_TW version badge');
assertContainsFixed(deployDoc, `当前文档对应项目基线版本为 \`${targetVersion}\`。`, 'deploy doc baseline version');
for (const [filePath, description] of deployIdExampleFiles) {
  assertDeployIdVersionExamples(filePath, description);
}
assertContainsFixed(composeFile, `image: infoq/infoq-admin:${targetVersion}`, 'admin image tag');
assertContainsFixed(composeFile, `image: infoq/infoq-frontend-vue:${targetVersion}`, 'vue image tag');
assertContainsFixed(composeFile, `image: infoq/infoq-frontend-react:${targetVersion}`, 'react image tag');
assertContainsFixed(springDocConfigTest, `info.setVersion("${targetVersion}");`, 'springdoc config test setVersion');
assertContainsFixed(springDocConfigTest, `assertEquals("${targetVersion}", openAPI.getInfo().getVersion());`, 'springdoc config test assert');
assertContainsFixed(springDocPropertiesTest, `info.setVersion("${targetVersion}");`, 'springdoc properties test setVersion');
assertContainsFixed(springDocPropertiesTest, `assertEquals("${targetVersion}", properties.getInfo().getVersion());`, 'springdoc properties test assert');

console.log('[version-bump] version bump completed successfully.');
console.log('[version-bump] suggested follow-up:');
console.log('  node tools/backend_mvn.mjs -- -pl infoq-plugin/infoq-plugin-doc -am -DskipTests=false -Dsurefire.failIfNoSpecifiedTests=false -Dtest=SpringDocConfigTest,SpringDocPropertiesTest test');
console.log('  node tools/backend_mvn.mjs -- -pl infoq-modules/infoq-system -am -DskipTests=false -Dsurefire.failIfNoSpecifiedTests=false -Dtest=QuartzBootstrapCoordinatorTest test');
