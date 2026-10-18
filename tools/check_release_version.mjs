#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeForwardedArgs, resolveRepoRoot} from './lib/skill_runtime.mjs';
import {parseReleaseVersion} from './lib/release_version.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(scriptDir);
const args = normalizeForwardedArgs(process.argv.slice(2));

function usage() {
  console.log(`Usage: node tools/check_release_version.mjs [--tag vX.Y.Z[-rcN]] [--expect X.Y.Z[-rcN]]

Checks that the backend revision, BOM revision, both admin package versions,
README badges, deployment docs, and Compose image tags agree.
--tag accepts vX.Y.Z[-rcN] or X.Y.Z[-rcN]; --expect accepts X.Y.Z[-rcN].
N is a positive integer without leading zeros.
Both options may be combined only when they name the same version.
Empty values, repeated options, unknown arguments and malformed versions fail.`);
}

function parseArgs(argv) {
  const parsed = {tag: '', expect: ''};
  const supplied = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '-h' || token === '--help') {
      usage();
      process.exit(0);
    }
    if (token === '--tag' || token === '--expect') {
      const value = argv[index + 1];
      if (!value || value.startsWith('-')) throw new Error(`Missing value for ${token}`);
      if (supplied.has(token)) throw new Error(`Repeated option: ${token}`);
      supplied.add(token);
      parsed[token.slice(2)] = value;
      index += 1;
      continue;
    }
    if (token.startsWith('--tag=') || token.startsWith('--expect=')) {
      const separator = token.indexOf('=');
      const name = token.slice(0, separator);
      const value = token.slice(separator + 1);
      if (!value) throw new Error(`Missing value for ${name}`);
      if (supplied.has(name)) throw new Error(`Repeated option: ${name}`);
      supplied.add(name);
      parsed[name.slice(2)] = value;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  if (parsed.tag && !parseReleaseVersion(parsed.tag.replace(/^v/u, ''))) throw new Error(`Invalid --tag: ${parsed.tag}`);
  if (parsed.expect && !parseReleaseVersion(parsed.expect)) throw new Error(`Invalid --expect: ${parsed.expect}`);
  if (parsed.tag && parsed.expect && parsed.tag.replace(/^v/u, '') !== parsed.expect) throw new Error('--tag and --expect must name the same version');
  return parsed;
}

function read(relativePath) {
  const absolute = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Missing version source: ${relativePath}`);
  }
  return fs.readFileSync(absolute, 'utf8');
}

function firstMatch(text, pattern, label) {
  const match = text.match(pattern);
  if (!match) throw new Error(`Cannot parse ${label}`);
  return match[1].trim();
}

function badgeVersion(text, label) {
  return firstMatch(text, /badge\/Version-((?:[^\s)\-]|--)+)-[a-zA-Z0-9]+(?:\?[^)]*)?\)/u, label).replaceAll('--', '-');
}

function collectSources() {
  const backendPom = read('backend/pom.xml');
  const bomPom = read('backend/infoq-core/infoq-core-bom/pom.xml');
  const vuePackage = JSON.parse(read('frontend-vue/package.json'));
  const reactPackage = JSON.parse(read('frontend-react/package.json'));
  const readme = read('README.md');
  const readmeCn = read('README_CN.md');
  const readmeJa = read('README_JA.md');
  const readmeZhTw = read('README_ZH_TW.md');
  const envExample = read('deploy/.env.example');
  const dockerDoc = read('deploy/DOCKER.md');
  const compose = read('deploy/docker/docker-compose.yml');

  return new Map([
    ['backend/pom.xml <revision>', firstMatch(backendPom, /<revision>([^<]+)<\/revision>/u, 'backend revision')],
    ['backend/infoq-core/infoq-core-bom/pom.xml <revision>', firstMatch(bomPom, /<revision>([^<]+)<\/revision>/u, 'BOM revision')],
    ['frontend-vue/package.json version', String(vuePackage.version ?? '')],
    ['frontend-react/package.json version', String(reactPackage.version ?? '')],
    ['README.md version badge', badgeVersion(readme, 'README badge')],
    ['README_CN.md version badge', badgeVersion(readmeCn, 'README_CN badge')],
    ['README_JA.md version badge', badgeVersion(readmeJa, 'README_JA badge')],
    ['README_ZH_TW.md version badge', badgeVersion(readmeZhTw, 'README_ZH_TW badge')],
    ['deploy/.env.example INFOQ_VERSION', firstMatch(envExample, /^INFOQ_VERSION=([^\s#]+)/mu, 'INFOQ_VERSION')],
    ['deploy/DOCKER.md baseline', firstMatch(dockerDoc, /当前文档对应项目基线版本为 `([^`]+)`/u, 'DOCKER.md baseline')],
    ['deploy/docker/docker-compose.yml infoq-admin tag', firstMatch(compose, /image:\s+infoq\/infoq-admin:([^\s]+)/u, 'admin image tag')],
    ['deploy/docker/docker-compose.yml vue tag', firstMatch(compose, /image:\s+infoq\/infoq-frontend-vue:([^\s]+)/u, 'vue image tag')],
    ['deploy/docker/docker-compose.yml react tag', firstMatch(compose, /image:\s+infoq\/infoq-frontend-react:([^\s]+)/u, 'react image tag')],
  ]);
}

try {
  const options = parseArgs(args);
  const sources = collectSources();
  const expected = options.tag
    ? options.tag.replace(/^v/u, '')
    : options.expect;

  if (expected && !parseReleaseVersion(expected)) {
    throw new Error(`Expected version must be x.y.z or x.y.z-rcN, got: ${expected}`);
  }

  const mismatches = [];
  for (const [label, value] of sources) {
    if (!parseReleaseVersion(value)) {
      mismatches.push(`${label}: invalid version "${value}"`);
      continue;
    }
    if (expected && value !== expected) {
      mismatches.push(`${label}: expected ${expected}, found ${value}`);
    }
  }

  if (mismatches.length > 0) {
    console.error('Release version check failed:');
    for (const mismatch of mismatches) console.error(`- ${mismatch}`);
    process.exit(1);
  }

  const versions = new Set(sources.values());
  if (versions.size !== 1) {
    console.error('Release version check failed: version sources disagree');
    for (const [label, value] of sources) console.error(`- ${label}: ${value}`);
    process.exit(1);
  }

  const [version] = versions;
  console.log(`Release version check passed: ${version} (${sources.size} sources)`);
} catch (error) {
  console.error(`Release version check failed: ${error.message}`);
  process.exit(1);
}
