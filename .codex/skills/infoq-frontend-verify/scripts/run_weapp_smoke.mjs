#!/usr/bin/env node
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runWeappSmoke} from '../../../lib/weapp_smoke.mjs';
import {normalizeForwardedArgs, resolveRepoRoot} from '../../../lib/skill_runtime.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(scriptDir);

const CLIENTS = {
  react: {
    label: 'react-weapp-smoke',
    stateSlug: 'infoq-frontend-verify/react-weapp',
    workspaceDirName: 'infoq-scaffold-frontend-weapp-react'
  },
  vue: {
    label: 'vue-weapp-smoke',
    stateSlug: 'infoq-frontend-verify/vue-weapp',
    workspaceDirName: 'infoq-scaffold-frontend-weapp-vue'
  }
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
  node .codex/skills/infoq-frontend-verify/scripts/run_weapp_smoke.mjs --client <vue|react> [options]

Options after --client are passed to the shared weapp smoke runner, for example:
  --suite <smoke|core|full>
  --skip-build
  --login-home-only
  -h, --help`);
}

function splitClientArg(argv) {
  const forwarded = [];
  let client = '';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--client') {
      client = readValue(argv, index, arg);
      index += 1;
      continue;
    }
    if ((arg === '-h' || arg === '--help') && !client) {
      printHelp();
      process.exit(0);
    }
    forwarded.push(arg);
  }
  if (!CLIENTS[client]) {
    throw new Error('--client must be one of: vue, react');
  }
  return {client, forwarded};
}

const {client, forwarded} = splitClientArg(normalizeForwardedArgs(process.argv.slice(2)));

runWeappSmoke(
  {
    ...CLIENTS[client],
    repoRoot,
    scriptPath: '.codex/skills/infoq-frontend-verify/scripts/run_weapp_smoke.mjs'
  },
  forwarded
).catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
