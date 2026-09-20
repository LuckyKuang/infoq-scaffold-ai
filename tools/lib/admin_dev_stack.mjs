import fs from 'node:fs';
import path from 'node:path';
import {resolveBackendConfigSelection} from '../scripts/resolve_backend_local_mcp_env.mjs';
import {
    fetchText,
    isProcessAlive,
    markRunState,
    readJsonFile,
    resolveDocTmpPath,
    resolvePackageManager,
    runBackendMavenChecked,
    spawnDetachedProcess,
    stopRecordedRunState,
    tailFile,
    waitFor
} from './skill_runtime.mjs';

function resolveDefaultProfile(repoRoot) {
  return resolveBackendConfigSelection(repoRoot).profile;
}

async function canFetch(url) {
  try {
    const {response} = await fetchText(url, {redirect: 'manual'});
    return response.status >= 200 && response.status < 500;
  } catch {
    return false;
  }
}

async function waitForUrl(url, waitSeconds) {
  return waitFor(() => canFetch(url), {
    attempts: waitSeconds,
    intervalMs: 1000
  });
}

export async function stopAdminDevStackState(config, options = {}) {
  const state = readJsonFile(config.stateFile, null);
  if (!state) {
    console.log(`[${config.label}] no state file found: ${config.stateFile}`);
    return;
  }

  if (Array.isArray(state.processes)) {
    for (const record of state.processes) {
      if (record.owned === false) {
        console.log(`[${config.label}] skip external ${record.role || 'process'} (pid=${record.pid || 'n/a'})`);
      }
    }
  }

  const stoppedState = await stopRecordedRunState(config.stateFile, {
    status: options.status || 'stopped',
    reason: options.reason || 'manual-stop',
    graceMs: options.graceMs ?? 1000
  });

  for (const record of stoppedState?.stoppedProcesses || []) {
    const role = record.role || 'process';
    if (record.skippedReason) {
      console.log(`[${config.label}] ${role} skipped (${record.skippedReason}, pid=${record.pid})`);
    } else if (record.stopped) {
      console.log(`[${config.label}] ${role} stopped (pid=${record.pid})`);
    } else {
      console.log(`[${config.label}] ${role} already stopped (pid=${record.pid})`);
    }
  }

  if (options.removeState === true) {
    fs.rmSync(config.stateFile, {force: true});
    console.log(`[${config.label}] removed state file: ${config.stateFile}`);
  } else {
    console.log(`[${config.label}] state file updated: ${config.stateFile}`);
  }
}

function usage(config) {
  const defaultProfile = config.defaultProfile || resolveDefaultProfile(config.repoRoot);
  console.log(`Usage: node ${config.scriptPath} [options]

Options:
  --build-backend        Build backend jar before startup.
  --force-restart        Stop recorded processes before startup.
  --backend-only         Start backend only.
  --frontend-only        Start frontend only.
  --backend-port <port>  Backend HTTP port. Default: ${config.defaultBackendPort}. Also drives frontend proxy target unless VITE_APP_PROXY_TARGET is already set.
  ${config.frontendPortFlag} <port>   ${config.frontendDisplayName} dev port. Default: ${config.defaultFrontendPort}.
  --frontend-host <host> Frontend host. Default: 127.0.0.1.
  --profile <name>       Spring profile. Default: ${defaultProfile}.
  -h, --help             Show help.`);
}

function readValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function parseArgs(argv, config) {
  const options = {
    buildBackend: false,
    forceRestart: false,
    backendOnly: false,
    frontendOnly: false,
    backendPort: String(process.env.BACKEND_PORT || config.defaultBackendPort),
    frontendHost: String(process.env.FRONTEND_HOST || '127.0.0.1'),
    frontendPort: String(process.env[config.frontendPortEnv] || config.defaultFrontendPort),
    profile: String(process.env.PROFILE || config.defaultProfile || resolveDefaultProfile(config.repoRoot)),
    waitSeconds: Number(process.env.WAIT_SECONDS || 90)
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--build-backend':
        options.buildBackend = true;
        break;
      case '--force-restart':
        options.forceRestart = true;
        break;
      case '--backend-only':
        options.backendOnly = true;
        break;
      case '--frontend-only':
        options.frontendOnly = true;
        break;
      case '--backend-port':
        options.backendPort = readValue(argv, index, arg);
        index += 1;
        break;
      case '--frontend-host':
        options.frontendHost = readValue(argv, index, arg);
        index += 1;
        break;
      case '--profile':
        options.profile = readValue(argv, index, arg);
        index += 1;
        break;
      case '-h':
      case '--help':
        usage(config);
        process.exit(0);
        break;
      default:
        if (arg === config.frontendPortFlag) {
          options.frontendPort = readValue(argv, index, arg);
          index += 1;
          break;
        }
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (options.backendOnly && options.frontendOnly) {
    throw new Error('--backend-only and --frontend-only cannot be used together.');
  }

  return options;
}

export async function runAdminDevStack(config, argv) {
  const options = parseArgs(argv, config);
  const backendDir = path.join(config.repoRoot, 'infoq-scaffold-backend');
  const frontendDir = path.join(config.repoRoot, config.frontendDirName);
  const backendJar = path.join(backendDir, 'infoq-admin', 'target', 'infoq-admin.jar');
  const logDir = resolveDocTmpPath(config.repoRoot, config.stateSlug);
  const backendLog = path.join(logDir, `backend-${options.backendPort}.log`);
  const frontendLog = path.join(logDir, `${config.frontendLogPrefix}-${options.frontendPort}.log`);

  if (!fs.existsSync(backendDir) || !fs.existsSync(frontendDir)) {
    throw new Error(`Repository layout not found under ${config.repoRoot}`);
  }

  if (options.forceRestart) {
    await stopAdminDevStackState(config, {removeState: false});
  }

  const previousState = readJsonFile(config.stateFile, null);
  const findRecordedOwnedProcess = (role, port) => {
    if (!['starting', 'running', 'interrupted'].includes(previousState?.status)) {
      return null;
    }
    const processRecord = (Array.isArray(previousState.processes) ? previousState.processes : []).find((record) =>
      record?.role === role &&
      String(record?.port || '') === String(port) &&
      record.owned !== false &&
      record.pid &&
      isProcessAlive(record.pid)
    );
    if (!processRecord) {
      return null;
    }
    return {
      ...processRecord,
      reused: true,
      owned: true
    };
  };

  let startedBackendPid = '';
  let startedFrontendPid = '';
  const baseState = {
    schemaVersion: 1,
    skill: config.stateSlug.split('/')[0] || config.label,
    label: config.label,
    scriptPath: config.scriptPath,
    status: 'starting',
    startedAt: new Date().toISOString(),
    backendPort: options.backendPort,
    profile: options.profile,
    frontendHost: options.frontendHost,
    frontendPort: options.frontendPort,
    frontendProxyTarget: process.env.VITE_APP_PROXY_TARGET || `http://127.0.0.1:${options.backendPort}`,
    backendLog,
    frontendLog,
    processes: [],
    ...(config.stateContext ? {context: config.stateContext} : {})
  };

  const syncState = (patch) => markRunState(config.stateFile, patch);
  const cleanupStartedProcesses = async (status, reason) => {
    await stopRecordedRunState(config.stateFile, {status, reason});
  };

  const handleInterrupt = async (signal) => {
    await cleanupStartedProcesses('interrupted', signal);
    process.exit(signal === 'SIGINT' ? 130 : signal === 'SIGHUP' ? 129 : 143);
  };
  const handleSigint = () => handleInterrupt('SIGINT');
  const handleSigterm = () => handleInterrupt('SIGTERM');
  const handleSighup = () => handleInterrupt('SIGHUP');
  process.once('SIGINT', handleSigint);
  process.once('SIGTERM', handleSigterm);
  process.once('SIGHUP', handleSighup);
  syncState(baseState);

  try {
    if (!options.frontendOnly) {
      const backendUrl = `http://127.0.0.1:${options.backendPort}/auth/code`;
      if (options.buildBackend || !fs.existsSync(backendJar)) {
        console.log(`[${config.label}] building backend jar...`);
        await runBackendMavenChecked(config.repoRoot, ['-pl', 'infoq-admin', '-am', '-DskipTests', 'package']);
      }

      if (!fs.existsSync(backendJar)) {
        throw new Error(`[${config.label}] backend jar not found: ${backendJar}`);
      }

      if (await canFetch(backendUrl)) {
        if (options.forceRestart) {
          throw new Error(`[${config.label}] backend is still running on :${options.backendPort} after stopping recorded processes.`);
        }
        console.log(`[${config.label}] backend already running on :${options.backendPort}`);
        baseState.processes.push(findRecordedOwnedProcess('backend', options.backendPort) || {
          role: 'backend',
          pid: '',
          port: options.backendPort,
          logFile: backendLog,
          owned: false,
          reused: true
        });
      } else {
        console.log(`[${config.label}] starting backend on :${options.backendPort} with profile=${options.profile}`);
        const child = spawnDetachedProcess(
          'java',
          [
            '-jar',
            backendJar,
            `--spring.profiles.active=${options.profile}`,
            `--server.port=${options.backendPort}`
          ],
          {
            cwd: backendDir,
            env: process.env,
            logFile: backendLog
          }
        );
        startedBackendPid = String(child.pid || '');
        const backendRecord = {
          role: 'backend',
          pid: startedBackendPid,
          host: '127.0.0.1',
          port: options.backendPort,
          logFile: backendLog,
          owned: true
        };
        baseState.processes.push(backendRecord);
        syncState({processes: baseState.processes});

        const ready = await waitForUrl(backendUrl, options.waitSeconds);
        if (!ready) {
          throw new Error(`[${config.label}] backend failed to become ready. log=${backendLog}\n${tailFile(backendLog, 120)}`);
        }
        console.log(`[${config.label}] backend ready: ${backendUrl} (pid=${startedBackendPid})`);
      }
    }

    if (!options.backendOnly) {
      const frontendUrl = `http://${options.frontendHost}:${options.frontendPort}/`;
      const frontendProxyTarget = process.env.VITE_APP_PROXY_TARGET || `http://127.0.0.1:${options.backendPort}`;
      if (await canFetch(frontendUrl)) {
        if (options.forceRestart) {
          throw new Error(`[${config.label}] ${config.frontendDisplayName} is still running on :${options.frontendPort} after stopping recorded processes.`);
        }
        console.log(`[${config.label}] ${config.frontendDisplayName} already running on :${options.frontendPort}`);
        baseState.processes.push(findRecordedOwnedProcess('frontend', options.frontendPort) || {
          role: 'frontend',
          pid: '',
          host: options.frontendHost,
          port: options.frontendPort,
          logFile: frontendLog,
          owned: false,
          reused: true
        });
      } else {
        const pkg = resolvePackageManager();
        console.log(`[${config.label}] starting ${config.frontendDisplayName} on ${options.frontendHost}:${options.frontendPort}`);
        console.log(`[${config.label}] ${config.frontendDisplayName} proxy target: ${frontendProxyTarget}`);
        const child = spawnDetachedProcess(
          pkg.command,
          ['run', 'dev', '--', '--host', options.frontendHost, '--port', String(options.frontendPort), '--open', 'false', '--strictPort'],
          {
            cwd: frontendDir,
            env: {
              ...process.env,
              VITE_APP_PORT: String(options.frontendPort),
              VITE_APP_PROXY_TARGET: frontendProxyTarget
            },
            logFile: frontendLog
          }
        );
        startedFrontendPid = String(child.pid || '');
        const frontendRecord = {
          role: 'frontend',
          pid: startedFrontendPid,
          host: options.frontendHost,
          port: options.frontendPort,
          logFile: frontendLog,
          owned: true
        };
        baseState.processes.push(frontendRecord);
        syncState({processes: baseState.processes});

        const ready = await waitForUrl(frontendUrl, options.waitSeconds);
        if (!ready) {
          throw new Error(`[${config.label}] ${config.frontendDisplayName} failed to become ready. log=${frontendLog}\n${tailFile(frontendLog, 120)}`);
        }
        console.log(`[${config.label}] ${config.frontendDisplayName} ready: ${frontendUrl} (pid=${startedFrontendPid})`);
      }
    }

    syncState({
      status: 'running',
      readyAt: new Date().toISOString(),
      startedBackendPid,
      startedFrontendPid,
      processes: baseState.processes
    });

    console.log(`[${config.label}] state file: ${config.stateFile}`);
    console.log(`[${config.label}] backend log: ${backendLog}`);
    if (!options.backendOnly) {
      console.log(`[${config.label}] frontend log: ${frontendLog}`);
    }
  } catch (error) {
    await cleanupStartedProcesses('failed', error.message || String(error));
    throw error;
  } finally {
    process.removeListener('SIGINT', handleSigint);
    process.removeListener('SIGTERM', handleSigterm);
    process.removeListener('SIGHUP', handleSighup);
  }
}
