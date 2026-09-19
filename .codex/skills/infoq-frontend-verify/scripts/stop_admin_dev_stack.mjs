#!/usr/bin/env node
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {stopAdminDevStackState} from '../../../lib/admin_dev_stack.mjs';
import {normalizeForwardedArgs, resolveDocTmpPath, resolveRepoRoot} from '../../../lib/skill_runtime.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(scriptDir);

const CLIENTS = {
  react: {label: 'react-runtime', frontendDisplayName: 'React admin'},
  vue: {label: 'vue-runtime', frontendDisplayName: 'Vue admin'}
};

function readValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function printHelp() {
  console.log(`Usage:
  node .codex/skills/infoq-frontend-verify/scripts/stop_admin_dev_stack.mjs --client <vue|react>`);
}

function parseClient(argv) {
  let client = '';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--client') {
      client = readValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  if (!CLIENTS[client]) {
    throw new Error('--client must be one of: vue, react');
  }
  return client;
}

const client = parseClient(normalizeForwardedArgs(process.argv.slice(2)));
const stateSlug = `infoq-frontend-verify/${client}`;

stopAdminDevStackState({
  ...CLIENTS[client],
  stateFile: resolveDocTmpPath(repoRoot, stateSlug, 'state.json')
}).catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
