#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveBackendConfigSelection} from '../../../scripts/resolve_backend_local_mcp_env.mjs';
import {
    canConnect,
    fetchText,
    markRunState,
    normalizeForwardedArgs,
    readJsonFile,
    resolveDocTmpPath,
    resolveRepoRoot,
    runBackendMavenChecked,
    runCommandChecked,
    spawnDetachedProcess,
    stopRecordedRunState,
    tailFile,
    terminateProcessTree,
    waitFor
} from '../../../lib/skill_runtime.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(scriptDir);
const args = normalizeForwardedArgs(process.argv.slice(2));

const config = {
  jarRelPath: 'infoq-scaffold-backend/infoq-admin/target/infoq-admin.jar',
  port: process.env.SMOKE_PORT || '18080',
  host: process.env.SMOKE_HOST || '127.0.0.1',
  springProfile: process.env.SMOKE_SPRING_PROFILES_ACTIVE || '',
  roleId: process.env.SMOKE_ROLE_ID || '3',
  dictType: process.env.SMOKE_DICT_TYPE || 'sys_yes_no',
  clientId: process.env.SMOKE_CLIENT_ID || 'e5cd7e4891bf95d1d19206ce24a7b32e',
  username: process.env.SMOKE_USERNAME || '',
  password: process.env.SMOKE_PASSWORD || '',
  loginCandidates: process.env.SMOKE_LOGIN_CANDIDATES || 'dept:666666,owner:666666,admin:123456',
  rsaPublicKey:
    process.env.SMOKE_RSA_PUBLIC_KEY ||
    'MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAKoR8mX0rGKLqzcWmOzbfj64K8ZIgOdHnzkXSOVOZbFu/TJhZ7rFAN+eaGkl3C4buccQd/EjEsj9ir7ijT7h96MCAwEAAQ=='
};

let buildFirst = false;
let keepServer = false;
let serverPid = '';
let logFile = '';
let stateFile = '';

function usage() {
  console.log(`Usage: node .codex/skills/infoq-backend-verify/scripts/run_smoke.mjs [options]

Options:
  --build                    Build backend jar before smoke testing.
  --keep-server              Keep backend process alive after checks.
  --port <port>              Server port (default: 18080).
  --host <host>              Server host (default: 127.0.0.1).
  --profile <name>           Spring profile (default: local when application-local.yml exists, else dev).
  --role-id <id>             Role ID for role menu/dept checks (default: 3).
  --dict-type <type>         Dict type check target (default: sys_yes_no).
  --client-id <id>           Client ID for login.
  --username <name>          Preferred login username.
  --password <pwd>           Preferred login password.
  --login-candidates <list>  Comma list like "dept:666666,owner:666666".
  --jar <path>               Jar path relative to repo root.
  -h, --help                 Show help.`);
}

function readValue(index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  switch (arg) {
    case '--build':
      buildFirst = true;
      break;
    case '--keep-server':
      keepServer = true;
      break;
    case '--port':
      config.port = readValue(index, arg);
      index += 1;
      break;
    case '--host':
      config.host = readValue(index, arg);
      index += 1;
      break;
    case '--profile':
      config.springProfile = readValue(index, arg);
      index += 1;
      break;
    case '--role-id':
      config.roleId = readValue(index, arg);
      index += 1;
      break;
    case '--dict-type':
      config.dictType = readValue(index, arg);
      index += 1;
      break;
    case '--client-id':
      config.clientId = readValue(index, arg);
      index += 1;
      break;
    case '--username':
      config.username = readValue(index, arg);
      index += 1;
      break;
    case '--password':
      config.password = readValue(index, arg);
      index += 1;
      break;
    case '--login-candidates':
      config.loginCandidates = readValue(index, arg);
      index += 1;
      break;
    case '--jar':
      config.jarRelPath = readValue(index, arg);
      index += 1;
      break;
    case '-h':
    case '--help':
      usage();
      process.exit(0);
      break;
    default:
      throw new Error(`Unknown option: ${arg}`);
  }
}

const backendConfigSelection = resolveBackendConfigSelection(repoRoot);
config.springProfile ||= backendConfigSelection.profile;

const backendDir = path.join(repoRoot, 'infoq-scaffold-backend');
const jarPath = path.join(repoRoot, config.jarRelPath);
const baseUrl = `http://${config.host}:${config.port}`;
stateFile = resolveDocTmpPath(repoRoot, 'infoq-backend-verify', `run-smoke-${config.port}.state.json`);

async function isServerReady() {
  try {
    const health = await fetchText(`${baseUrl}/monitor/health`);
    if (health.response.status === 200) {
      return true;
    }
  } catch {
    // Continue probing.
  }

  try {
    const root = await fetchText(`${baseUrl}/`);
    return root.response.status === 200;
  } catch {
    return false;
  }
}

function writeState(patch) {
  if (!stateFile) {
    return;
  }
  markRunState(stateFile, patch);
}

async function cleanup(status = 'stopped', reason = '', options = {}) {
  const shouldStop = options.force === true || !keepServer || status !== 'passed';
  if (stateFile) {
    if (shouldStop) {
      await stopRecordedRunState(stateFile, {status, reason});
      serverPid = '';
    } else {
      writeState({
        status: 'running',
        validationStatus: status,
        keepAlive: true,
        stopReason: reason
      });
    }
  } else if (serverPid && shouldStop) {
    await terminateProcessTree(serverPid, {graceMs: 1000});
    serverPid = '';
  }
}

process.on('exit', () => {
  if (serverPid && !keepServer) {
    writeState({
      status: 'interrupted',
      stopReason: 'process-exit'
    });
    try {
      process.kill(Number(serverPid));
    } catch {
      // Ignore cleanup failures during process exit.
    }
  }
});
process.on('SIGINT', async () => {
  await cleanup('interrupted', 'SIGINT', {force: true});
  process.exit(130);
});
process.on('SIGTERM', async () => {
  await cleanup('interrupted', 'SIGTERM', {force: true});
  process.exit(143);
});
process.on('SIGHUP', async () => {
  await cleanup('interrupted', 'SIGHUP', {force: true});
  process.exit(129);
});

async function main() {
  const staleState = readJsonFile(stateFile, null);
  if (['starting', 'running', 'interrupted'].includes(staleState?.status)) {
    console.log(`[smoke] cleaning recorded stale runtime state: ${stateFile}`);
    await stopRecordedRunState(stateFile, {status: 'stopped', reason: 'stale-before-run'});
  }

  if (await canConnect(config.host, Number(config.port), 500)) {
    throw new Error(`[smoke] target port already occupied: ${config.host}:${config.port}`);
  }

  if (buildFirst || !fs.existsSync(jarPath)) {
    console.log('[smoke] building backend jar...');
    await runBackendMavenChecked(repoRoot, ['-pl', 'infoq-admin', '-am', '-DskipTests', 'clean', 'package']);
  }

  if (!fs.existsSync(jarPath)) {
    throw new Error(`[smoke] jar not found: ${jarPath}`);
  }

  logFile = resolveDocTmpPath(repoRoot, 'infoq-backend-verify', `infoq-smoke-${config.port}.log`);
  writeState({
    schemaVersion: 1,
    skill: 'infoq-backend-verify',
    script: 'run_smoke.mjs',
    status: 'starting',
    startedAt: new Date().toISOString(),
    host: config.host,
    ports: [config.port],
    profile: config.springProfile,
    keepAlive: keepServer,
    logFiles: [logFile],
    processes: []
  });
  console.log(`[smoke] backend config source: ${path.relative(repoRoot, backendConfigSelection.configPath)}`);
  console.log(`[smoke] starting server on ${baseUrl} with profile=${config.springProfile}`);
  const child = spawnDetachedProcess(
    'java',
    ['-jar', jarPath, `--server.port=${config.port}`, '--captcha.enable=false'],
    {
      cwd: backendDir,
      env: {
        ...process.env,
        SPRING_PROFILES_ACTIVE: config.springProfile
      },
      logFile
    }
  );
  serverPid = String(child.pid || '');
  writeState({
    status: 'running',
    processes: [
      {
        role: 'backend',
        pid: serverPid,
        host: config.host,
        port: config.port,
        logFile,
        owned: true
      }
    ]
  });

  const ready = await waitFor(() => isServerReady(), {
    attempts: 60,
    intervalMs: 1000
  });
  if (!ready) {
    throw new Error(`[smoke] server failed to become ready, log: ${logFile}\n${tailFile(logFile, 220)}`);
  }
  writeState({readyAt: new Date().toISOString()});

  console.log('[smoke] server is ready, running endpoint checks...');
  await runCommandChecked(process.execPath, [path.join(scriptDir, 'smoke_checks.mjs')], {
    cwd: scriptDir,
    env: {
      ...process.env,
      BASE_URL: baseUrl,
      ROLE_ID: config.roleId,
      DICT_TYPE: config.dictType,
      CLIENT_ID: config.clientId,
      USERNAME: config.username,
      PASSWORD: config.password,
      LOGIN_CANDIDATES: config.loginCandidates,
      RSA_PUBLIC_KEY: config.rsaPublicKey
    }
  });

  console.log('[smoke] all checks passed.');
  console.log(`[smoke] server log file: ${logFile}`);
  if (keepServer) {
    console.log(`[smoke] keep-server enabled, pid=${serverPid}`);
    writeState({
      status: 'running',
      validationStatus: 'passed',
      keepAlive: true
    });
  } else {
    await cleanup('passed', 'validation-complete');
  }
}

main().catch(async (error) => {
  await cleanup('failed', error.message || String(error), {force: true});
  console.error(error.message || error);
  process.exit(1);
});
