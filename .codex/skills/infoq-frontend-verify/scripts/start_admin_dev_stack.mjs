#!/usr/bin/env node
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveBackendConfigSelection} from '../../../scripts/resolve_backend_local_mcp_env.mjs';
import {runAdminDevStack} from '../../../lib/admin_dev_stack.mjs';
import {normalizeForwardedArgs, resolveDocTmpPath, resolveRepoRoot} from '../../../lib/skill_runtime.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(scriptDir);
const defaultProfile = (() => {
  try {
    return resolveBackendConfigSelection(repoRoot).profile;
  } catch {
    return 'dev';
  }
})();

const CLIENTS = {
  react: {
    label: 'react-runtime',
    frontendDirName: 'infoq-scaffold-frontend-react',
    frontendDisplayName: 'React admin',
    frontendLogPrefix: 'frontend-react',
    frontendPortFlag: '--react-port',
    frontendPortEnv: 'REACT_PORT',
    defaultBackendPort: 8080,
    defaultFrontendPort: 5174
  },
  vue: {
    label: 'vue-runtime',
    frontendDirName: 'infoq-scaffold-frontend-vue',
    frontendDisplayName: 'Vue admin',
    frontendLogPrefix: 'frontend-vue',
    frontendPortFlag: '--vue-port',
    frontendPortEnv: 'VUE_PORT',
    defaultBackendPort: 8080,
    defaultFrontendPort: 5173
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
  node .codex/skills/infoq-frontend-verify/scripts/start_admin_dev_stack.mjs --client <vue|react> [options]

Options:
  --client <vue|react>  Required admin client.
  --build-backend       Build backend jar before startup.
  --force-restart       Stop recorded processes before startup.
  --backend-only        Start backend only.
  --frontend-only       Start frontend only.
  --backend-port <port> Backend HTTP port. Default: 8080.
  --frontend-port <p>   Frontend dev port. Defaults by client.
  --frontend-host <h>   Frontend host. Default: 127.0.0.1.
  --profile <name>      Spring profile. Default: ${defaultProfile}.
  -h, --help            Show help.`);
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
    if (arg === '-h' || arg === '--help') {
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
const clientConfig = CLIENTS[client];
const stateSlug = `infoq-frontend-verify/${client}`;

runAdminDevStack(
  {
    ...clientConfig,
    repoRoot,
    defaultProfile,
    scriptPath: '.codex/skills/infoq-frontend-verify/scripts/start_admin_dev_stack.mjs',
    stateSlug,
    stateFile: resolveDocTmpPath(repoRoot, stateSlug, 'state.json')
  },
  forwarded
).catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
