#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveBackendConfigSelection, resolveRedisEnv} from '../../../scripts/resolve_backend_local_mcp_env.mjs';
import {
    canConnect,
    fetchText,
    markRunState,
    normalizeForwardedArgs,
    readJsonFile,
    resolveDocTmpPath,
    resolveRepoRoot,
    runBackendMavenChecked,
    runCommand,
    spawnDetachedProcess,
    spawnPythonScript,
    stopRecordedRunState,
    tailFile,
    terminateProcessTree,
    waitFor
} from '../../../lib/skill_runtime.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(scriptDir);
const args = normalizeForwardedArgs(process.argv.slice(2));
const redisOverrideKeys = [
  'CLUSTER_SMOKE_REDIS_HOST',
  'CLUSTER_SMOKE_REDIS_PORT',
  'CLUSTER_SMOKE_REDIS_DB',
  'CLUSTER_SMOKE_REDIS_PASSWORD'
];

function readExplicitEnv(name) {
  return Object.prototype.hasOwnProperty.call(process.env, name)
    ? String(process.env[name] ?? '')
    : undefined;
}

function resolveClusterRedisDefaults() {
  const {configPath} = resolveBackendConfigSelection(repoRoot);
  try {
    return resolveRedisEnv(configPath);
  } catch (error) {
    const missingOverrideKeys = redisOverrideKeys.filter((key) => readExplicitEnv(key) === undefined);
    if (missingOverrideKeys.length === 0) {
      return {};
    }
    throw new Error(
      `[cluster-smoke] failed to resolve Redis config from ${configPath}: ${error.message}. ` +
      `Set ${missingOverrideKeys.join(', ')} to override explicitly.`
    );
  }
}

const config = {
  jarRelPath: 'infoq-scaffold-backend/infoq-admin/target/infoq-admin.jar',
  host: process.env.CLUSTER_SMOKE_HOST || '127.0.0.1',
  portA: process.env.CLUSTER_SMOKE_PORT_A || '19081',
  portB: process.env.CLUSTER_SMOKE_PORT_B || '19082',
  springProfile: process.env.CLUSTER_SMOKE_SPRING_PROFILES_ACTIVE || '',
  nodeIdA: process.env.CLUSTER_SMOKE_NODE_ID_A || 'node-a',
  nodeIdB: process.env.CLUSTER_SMOKE_NODE_ID_B || 'node-b',
  clientId: process.env.CLUSTER_SMOKE_CLIENT_ID || 'e5cd7e4891bf95d1d19206ce24a7b32e',
  username: process.env.CLUSTER_SMOKE_USERNAME || '',
  password: process.env.CLUSTER_SMOKE_PASSWORD || '',
  loginCandidates: process.env.CLUSTER_SMOKE_LOGIN_CANDIDATES || 'dept:666666,owner:666666,admin:123456',
  rsaPublicKey:
    process.env.CLUSTER_SMOKE_RSA_PUBLIC_KEY ||
    'MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAKoR8mX0rGKLqzcWmOzbfj64K8ZIgOdHnzkXSOVOZbFu/TJhZ7rFAN+eaGkl3C4buccQd/EjEsj9ir7ijT7h96MCAwEAAQ==',
  redisHost: readExplicitEnv('CLUSTER_SMOKE_REDIS_HOST') ?? '',
  redisPort: readExplicitEnv('CLUSTER_SMOKE_REDIS_PORT') ?? '',
  redisDb: readExplicitEnv('CLUSTER_SMOKE_REDIS_DB') ?? '',
  redisPassword: readExplicitEnv('CLUSTER_SMOKE_REDIS_PASSWORD') ?? '',
  websocketPath: process.env.CLUSTER_SMOKE_WEBSOCKET_PATH || '/resource/websocket',
  userSettleSeconds: process.env.CLUSTER_SMOKE_USER_SETTLE_SECONDS || '1.5',
  userClearTimeoutSeconds: process.env.CLUSTER_SMOKE_USER_CLEAR_TIMEOUT_SECONDS || '15',
  cleanupTimeoutSeconds: process.env.CLUSTER_SMOKE_CLEANUP_TIMEOUT_SECONDS || '140'
};

let buildFirst = false;
let keepServers = false;
let skipAbnormalExit = false;
let serverAPid = '';
let serverBPid = '';
let logA = '';
let logB = '';
let stateFile = '';

function usage() {
  console.log(`Usage: node .codex/skills/infoq-backend-verify/scripts/run_cluster_smoke.mjs [options]

Options:
  --build                    Build backend jar before cluster smoke testing.
  --keep-servers             Keep surviving backend process alive after checks.
  --skip-abnormal-exit       Skip the abnormal-exit cleanup phase.
  --host <host>              Server host (default: 127.0.0.1).
  --port-a <port>            Node A port (default: 19081).
  --port-b <port>            Node B port (default: 19082).
  --profile <name>           Spring profile (default: local when application-local.yml exists, else dev).
  --node-id-a <id>           Node A websocket node id (default: node-a).
  --node-id-b <id>           Node B websocket node id (default: node-b).
  --client-id <id>           Client ID for login.
  --username <name>          Preferred login username.
  --password <pwd>           Preferred login password.
  --login-candidates <list>  Comma list like "dept:666666,owner:666666".
  --redis-host <host>        Redis host used by resolved backend config (local first, else dev).
  --redis-port <port>        Redis port used by resolved backend config (local first, else dev).
  --redis-db <db>            Redis db used by resolved backend config (local first, else dev).
  --redis-password <pwd>     Redis password used by resolved backend config (local first, else dev).
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
    case '--keep-servers':
      keepServers = true;
      break;
    case '--skip-abnormal-exit':
      skipAbnormalExit = true;
      break;
    case '--host':
      config.host = readValue(index, arg);
      index += 1;
      break;
    case '--port-a':
      config.portA = readValue(index, arg);
      index += 1;
      break;
    case '--port-b':
      config.portB = readValue(index, arg);
      index += 1;
      break;
    case '--profile':
      config.springProfile = readValue(index, arg);
      index += 1;
      break;
    case '--node-id-a':
      config.nodeIdA = readValue(index, arg);
      index += 1;
      break;
    case '--node-id-b':
      config.nodeIdB = readValue(index, arg);
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
    case '--redis-host':
      config.redisHost = readValue(index, arg);
      index += 1;
      break;
    case '--redis-port':
      config.redisPort = readValue(index, arg);
      index += 1;
      break;
    case '--redis-db':
      config.redisDb = readValue(index, arg);
      index += 1;
      break;
    case '--redis-password':
      config.redisPassword = readValue(index, arg);
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
const redisDefaults = resolveClusterRedisDefaults();
config.redisHost ||= redisDefaults.REDIS_HOST || '';
config.redisPort ||= redisDefaults.REDIS_PORT || '';
config.redisDb ||= redisDefaults.REDIS_DB || '';
config.redisPassword ||= redisDefaults.REDIS_PASSWORD || '';

for (const [flag, value] of [
  ['--redis-host', config.redisHost],
  ['--redis-port', config.redisPort],
  ['--redis-db', config.redisDb]
]) {
  if (!value) {
    throw new Error(`[cluster-smoke] missing required Redis setting ${flag}.`);
  }
}

const backendDir = path.join(repoRoot, 'infoq-scaffold-backend');
const jarPath = path.join(repoRoot, config.jarRelPath);
const pyScriptPath = path.join(scriptDir, 'websocket_cluster_smoke.py');
stateFile = resolveDocTmpPath(repoRoot, 'infoq-backend-verify', `run-cluster-smoke-${config.portA}-${config.portB}.state.json`);

async function isServerReady(baseUrl) {
  try {
    const health = await fetchText(`${baseUrl}/monitor/health`);
    if (health.response.status === 200) {
      return true;
    }
  } catch {
    // Continue probing.
  }

  try {
    const authCode = await fetchText(`${baseUrl}/auth/code`);
    if (authCode.response.status === 200) {
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
  const shouldStop = options.force === true || !keepServers || status !== 'passed';
  if (stateFile) {
    if (shouldStop) {
      await stopRecordedRunState(stateFile, {status, reason});
      serverAPid = '';
      serverBPid = '';
    } else {
      writeState({
        status: 'running',
        validationStatus: status,
        keepAlive: true,
        stopReason: reason
      });
    }
  } else if (shouldStop) {
    if (serverAPid) {
      await terminateProcessTree(serverAPid, {graceMs: 1000});
      serverAPid = '';
    }
    if (serverBPid) {
      await terminateProcessTree(serverBPid, {graceMs: 1000});
      serverBPid = '';
    }
  }
}

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

function startNode(port, nodeId, logFile) {
  const child = spawnDetachedProcess(
    'java',
    [
      '-jar',
      jarPath,
      `--server.port=${port}`,
      '--captcha.enable=false',
      '--websocket.enabled=true',
      `--websocket.node-id=${nodeId}`,
      '--infoq.quartz.bootstrap.reconcile-enabled=false'
    ],
    {
      cwd: backendDir,
      env: {
        ...process.env,
        SPRING_PROFILES_ACTIVE: config.springProfile
      },
      logFile
    }
  );
  return String(child.pid || '');
}

async function waitNode(baseUrl, logFile) {
  const ready = await waitFor(() => isServerReady(baseUrl), {
    attempts: 90,
    intervalMs: 1000
  });
  if (!ready) {
    throw new Error(`[cluster-smoke] server failed to become ready: ${baseUrl}\n${tailFile(logFile, 220)}`);
  }
}

async function runPythonChecked(scriptArgs, env) {
  const child = spawnPythonScript(pyScriptPath, scriptArgs, {
    cwd: scriptDir,
    env,
    stdio: 'inherit'
  });
  await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`python exited via signal ${signal}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`python exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}

async function main() {
  const staleState = readJsonFile(stateFile, null);
  if (['starting', 'running', 'interrupted'].includes(staleState?.status)) {
    console.log(`[cluster-smoke] cleaning recorded stale runtime state: ${stateFile}`);
    await stopRecordedRunState(stateFile, {status: 'stopped', reason: 'stale-before-run'});
  }

  for (const port of [config.portA, config.portB]) {
    if (await canConnect(config.host, Number(port), 500)) {
      throw new Error(`[cluster-smoke] port ${port} already occupied`);
    }
  }

  if (buildFirst || !fs.existsSync(jarPath)) {
    console.log('[cluster-smoke] building backend jar...');
    await runBackendMavenChecked(repoRoot, ['-pl', 'infoq-admin', '-am', '-DskipTests', 'package']);
  }

  if (!fs.existsSync(jarPath)) {
    throw new Error(`[cluster-smoke] jar not found: ${jarPath}`);
  }

  logA = resolveDocTmpPath(repoRoot, 'infoq-backend-verify', `infoq-cluster-smoke-${config.nodeIdA}.log`);
  logB = resolveDocTmpPath(repoRoot, 'infoq-backend-verify', `infoq-cluster-smoke-${config.nodeIdB}.log`);
  writeState({
    schemaVersion: 1,
    skill: 'infoq-backend-verify',
    script: 'run_cluster_smoke.mjs',
    status: 'starting',
    startedAt: new Date().toISOString(),
    host: config.host,
    ports: [config.portA, config.portB],
    profile: config.springProfile,
    keepAlive: keepServers,
    logFiles: [logA, logB],
    processes: []
  });

  console.log(`[cluster-smoke] backend config source: ${path.relative(repoRoot, backendConfigSelection.configPath)}`);
  console.log(`[cluster-smoke] starting ${config.nodeIdA} on http://${config.host}:${config.portA}`);
  serverAPid = startNode(config.portA, config.nodeIdA, logA);
  writeState({
    status: 'running',
    processes: [
      {
        role: config.nodeIdA,
        pid: serverAPid,
        host: config.host,
        port: config.portA,
        logFile: logA,
        owned: true
      }
    ]
  });
  console.log(`[cluster-smoke] starting ${config.nodeIdB} on http://${config.host}:${config.portB}`);
  serverBPid = startNode(config.portB, config.nodeIdB, logB);
  writeState({
    status: 'running',
    processes: [
      {
        role: config.nodeIdA,
        pid: serverAPid,
        host: config.host,
        port: config.portA,
        logFile: logA,
        owned: true
      },
      {
        role: config.nodeIdB,
        pid: serverBPid,
        host: config.host,
        port: config.portB,
        logFile: logB,
        owned: true
      }
    ]
  });

  await waitNode(`http://${config.host}:${config.portA}`, logA);
  await waitNode(`http://${config.host}:${config.portB}`, logB);
  writeState({readyAt: new Date().toISOString()});

  console.log('[cluster-smoke] both nodes are ready, running node-a HTTP smoke and encrypted login...');
  const smokeOutput = await runCommand(process.execPath, [path.join(scriptDir, 'smoke_checks.mjs')], {
    cwd: scriptDir,
    captureOutput: true,
    env: {
      ...process.env,
      BASE_URL: `http://${config.host}:${config.portA}`,
      CLIENT_ID: config.clientId,
      USERNAME: config.username,
      PASSWORD: config.password,
      LOGIN_CANDIDATES: config.loginCandidates,
      RSA_PUBLIC_KEY: config.rsaPublicKey,
      PRINT_TOKEN: '1',
      PRINT_USER_ID: '1'
    }
  });
  if (smokeOutput.signal || smokeOutput.code !== 0) {
    throw new Error(smokeOutput.stderr || smokeOutput.stdout || '[cluster-smoke] smoke_checks failed');
  }
  process.stdout.write(smokeOutput.stdout);

  const token = smokeOutput.stdout.match(/^TOKEN=(.+)$/m)?.[1]?.trim() || '';
  const userId = smokeOutput.stdout.match(/^USER_ID=(.+)$/m)?.[1]?.trim() || '';
  if (!token || !userId) {
    throw new Error('[cluster-smoke] failed to extract TOKEN/USER_ID from smoke output');
  }

  console.log('[cluster-smoke] running websocket cluster verification...');
  const pythonArgs = [
    '--host', config.host,
    '--port-a', config.portA,
    '--port-b', config.portB,
    '--node-id-a', config.nodeIdA,
    '--node-id-b', config.nodeIdB,
    '--websocket-path', config.websocketPath,
    '--server-b-pid', serverBPid,
    '--user-settle-seconds', config.userSettleSeconds,
    '--user-clear-timeout-seconds', config.userClearTimeoutSeconds,
    '--cleanup-timeout-seconds', config.cleanupTimeoutSeconds
  ];
  if (skipAbnormalExit) {
    pythonArgs.push('--skip-abnormal-exit');
  }
  await runPythonChecked(pythonArgs, {
    ...process.env,
    CLUSTER_SMOKE_TOKEN: token,
    CLUSTER_SMOKE_USER_ID: userId,
    CLUSTER_SMOKE_CLIENT_ID: config.clientId,
    CLUSTER_SMOKE_REDIS_HOST: config.redisHost,
    CLUSTER_SMOKE_REDIS_PORT: config.redisPort,
    CLUSTER_SMOKE_REDIS_DB: config.redisDb,
    CLUSTER_SMOKE_REDIS_PASSWORD: config.redisPassword
  });

  if (!skipAbnormalExit) {
    serverBPid = '';
  }

  const classCastInLogs = [logA, logB].some((file) => fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes('ClassCastException'));
  if (classCastInLogs) {
    throw new Error('[cluster-smoke] detected ClassCastException in node logs');
  }

  if (!skipAbnormalExit) {
    const logAText = fs.existsSync(logA) ? fs.readFileSync(logA, 'utf8') : '';
    if (!logAText.includes(`清理WebSocket节点用户注册, nodeId=${config.nodeIdB}`)) {
      throw new Error(`[cluster-smoke] node-a log missing stale-node cleanup evidence for ${config.nodeIdB}`);
    }
  }

  console.log('[cluster-smoke] cluster smoke passed.');
  console.log(`[cluster-smoke] node-a log: ${logA}`);
  console.log(`[cluster-smoke] node-b log: ${logB}`);
  if (keepServers) {
    const survivors = [serverAPid, serverBPid].filter(Boolean).join(' ') || 'none';
    console.log(`[cluster-smoke] keep-servers enabled; surviving pids: ${survivors}`);
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
