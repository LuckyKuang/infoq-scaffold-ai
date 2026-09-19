#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeForwardedArgs, resolveRepoRoot} from '../../../lib/skill_runtime.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(scriptDir);
const args = normalizeForwardedArgs(process.argv.slice(2));

const REQUIRED_FIELDS = [
  'id',
  'source',
  'moduleKey',
  'menuName',
  'menuType',
  'routePath',
  'clients',
  'priority',
  'automationType',
  'sideEffect',
  'dependencies',
  'preconditions',
  'steps',
  'assertions',
  'testData',
  'cleanup',
  'gaps'
];
const VALID_PRIORITIES = new Set(['P0', 'P1', 'P2']);
const VALID_AUTOMATION_TYPES = new Set(['smoke', 'route', 'CRUD', 'permission', 'negative', 'visual', 'integration']);
const VALID_CLIENTS = new Set(['react', 'vue']);

function printHelp() {
  console.log(`Usage:
  node .codex/skills/infoq-admin-e2e/scripts/validate-case-matrix.mjs [case-matrix.json]

Default:
  doc/test/frontend-web-automation/case-matrix.json`);
}

function rel(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/');
}

function assertArray(value, label, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array`);
    return false;
  }
  return true;
}

function validateCase(item, index, seenIds, errors) {
  const label = `cases[${index}]`;
  for (const field of REQUIRED_FIELDS) {
    if (!(field in item)) {
      errors.push(`${label} missing ${field}`);
    }
  }

  if (item.id) {
    if (seenIds.has(item.id)) {
      errors.push(`${label} duplicate id ${item.id}`);
    }
    seenIds.add(item.id);
  }

  if (typeof item.routePath !== 'string' || !item.routePath.startsWith('/')) {
    errors.push(`${label} routePath must start with /`);
  }
  if (!VALID_PRIORITIES.has(item.priority)) {
    errors.push(`${label} invalid priority ${item.priority}`);
  }
  if (!VALID_AUTOMATION_TYPES.has(item.automationType)) {
    errors.push(`${label} invalid automationType ${item.automationType}`);
  }
  if (typeof item.sideEffect !== 'boolean') {
    errors.push(`${label} sideEffect must be boolean`);
  }
  if (assertArray(item.clients, `${label}.clients`, errors)) {
    if (item.clients.length === 0) {
      errors.push(`${label}.clients must not be empty`);
    }
    for (const client of item.clients) {
      if (!VALID_CLIENTS.has(client)) {
        errors.push(`${label}.clients contains invalid client ${client}`);
      }
    }
  }
  for (const field of ['dependencies', 'preconditions', 'steps', 'assertions', 'gaps']) {
    assertArray(item[field], `${label}.${field}`, errors);
  }
  if (item.sideEffect && (!item.cleanup || /无需/u.test(item.cleanup))) {
    errors.push(`${label} sideEffect case must define cleanup`);
  }
}

function main() {
  if (args.includes('-h') || args.includes('--help')) {
    printHelp();
    return;
  }

  const matrixPath = path.resolve(repoRoot, args[0] || path.join('doc', 'test', 'frontend-web-automation', 'case-matrix.json'));
  if (!fs.existsSync(matrixPath)) {
    throw new Error(`Matrix file not found: ${rel(matrixPath)}`);
  }

  const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
  const errors = [];
  if (!matrix.generatedAt) {
    errors.push('generatedAt is required');
  }
  if (!matrix.summary || typeof matrix.summary.totalCases !== 'number') {
    errors.push('summary.totalCases is required');
  }
  if (!assertArray(matrix.cases, 'cases', errors)) {
    throw new Error(errors.join('\n'));
  }

  const seenIds = new Set();
  matrix.cases.forEach((item, index) => validateCase(item, index, seenIds, errors));

  if (matrix.summary && matrix.summary.totalCases !== matrix.cases.length) {
    errors.push(`summary.totalCases ${matrix.summary.totalCases} does not match cases length ${matrix.cases.length}`);
  }

  if (errors.length > 0) {
    console.error(`Case matrix validation failed: ${rel(matrixPath)}`);
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log(`Case matrix validation passed: ${rel(matrixPath)}`);
  console.log(`cases=${matrix.cases.length} p0=${matrix.summary.p0} p1=${matrix.summary.p1} p2=${matrix.summary.p2} gaps=${matrix.summary.gaps}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
