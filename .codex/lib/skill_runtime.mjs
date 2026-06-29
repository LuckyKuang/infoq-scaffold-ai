import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import net from 'node:net';

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, {recursive: true});
  return dirPath;
}

export function readJsonFile(filePath, fallbackValue = null) {
  if (!fs.existsSync(filePath)) {
    return fallbackValue;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writeJsonFile(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return data;
}

export function updateJsonFile(filePath, updater, fallbackValue = {}) {
  const current = readJsonFile(filePath, fallbackValue);
  const next = typeof updater === 'function' ? updater(current) : {...current, ...updater};
  return writeJsonFile(filePath, next);
}

export function markRunState(stateFile, patch) {
  return updateJsonFile(stateFile, (current) => ({
    ...current,
    ...patch,
    updatedAt: new Date().toISOString()
  }));
}

export function collectRunStateProcesses(state) {
  const records = [];
  const seen = new Set();
  const add = (record) => {
    const pid = String(record?.pid || '').trim();
    if (!pid || seen.has(pid)) {
      return;
    }
    seen.add(pid);
    records.push({
      ...record,
      pid
    });
  };

  for (const processRecord of Array.isArray(state?.processes) ? state.processes : []) {
    add(processRecord);
  }

  if (state?.startedBackendPid) {
    add({
      role: 'backend',
      pid: state.startedBackendPid,
      port: state.backendPort,
      logFile: state.backendLog
    });
  }
  if (state?.startedFrontendPid) {
    add({
      role: 'frontend',
      pid: state.startedFrontendPid,
      host: state.frontendHost,
      port: state.frontendPort,
      logFile: state.frontendLog
    });
  }

  return records;
}

export async function stopRecordedRunState(stateFile, options = {}) {
  const state = readJsonFile(stateFile, null);
  if (!state) {
    return null;
  }

  const stoppedAt = new Date().toISOString();
  const stoppedProcesses = [];

  for (const record of collectRunStateProcesses(state)) {
    if (record.owned === false) {
      stoppedProcesses.push({
        ...record,
        aliveBeforeStop: isProcessAlive(record.pid),
        stopped: false,
        skippedReason: 'not-owned',
        stoppedAt
      });
      continue;
    }

    const aliveBeforeStop = isProcessAlive(record.pid);
    const stopped = aliveBeforeStop
      ? await terminateProcessTree(record.pid, {graceMs: options.graceMs ?? 1000})
      : false;
    stoppedProcesses.push({
      ...record,
      aliveBeforeStop,
      stopped,
      stoppedAt
    });
  }

  return writeJsonFile(stateFile, {
    ...state,
    status: options.status || 'stopped',
    stopReason: options.reason || state.stopReason || '',
    stoppedAt,
    updatedAt: stoppedAt,
    stoppedProcesses
  });
}

export function resolveRepoRoot(scriptDir) {
  let currentDir = path.resolve(scriptDir);
  while (true) {
    const agentsPath = path.join(currentDir, 'AGENTS.md');
    const skillsDir = path.join(currentDir, '.codex', 'skills');
    if (fs.existsSync(agentsPath) && fs.existsSync(skillsDir)) {
      return currentDir;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error(`Failed to resolve repository root from ${scriptDir}`);
    }
    currentDir = parentDir;
  }
}

export function resolveDocTmpDir(repoRoot) {
  return ensureDir(path.join(repoRoot, 'doc', 'tmp'));
}

export function resolveDocTmpPath(repoRoot, ...parts) {
  return path.join(resolveDocTmpDir(repoRoot), ...parts);
}

export function normalizeForwardedArgs(argv) {
  if (argv[0] === '--') {
    return argv.slice(1);
  }
  return argv;
}

function canExecute(command, args = []) {
  const result = spawnSync(command, [...args, '--version'], {
    stdio: 'ignore'
  });
  return !result.error;
}

export function canExecuteCommand(command, args = []) {
  return canExecute(command, args);
}

export function resolvePackageManager() {
  if (canExecute('pnpm')) {
    return {command: 'pnpm', name: 'pnpm'};
  }
  if (canExecute('npm')) {
    return {command: 'npm', name: 'npm'};
  }
  throw new Error('pnpm/npm is required but no compatible package manager was found in PATH.');
}

export function resolvePythonLaunchSpec() {
  const candidates = process.platform === 'win32'
    ? [
        {command: 'py', args: ['-3']},
        {command: 'python', args: []},
        {command: 'python3', args: []}
      ]
    : [
        {command: 'python3', args: []},
        {command: 'python', args: []}
      ];

  for (const candidate of candidates) {
    if (canExecute(candidate.command, candidate.args)) {
      return candidate;
    }
  }

  throw new Error('Python 3 is required but no compatible launcher was found in PATH.');
}

export function spawnPythonScript(scriptPath, scriptArgs = [], options = {}) {
  const spec = resolvePythonLaunchSpec();
  return spawn(spec.command, [...spec.args, scriptPath, ...scriptArgs], options);
}

export function relayChildExit(child) {
  child.on('error', (error) => {
    console.error(error.message || error);
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}

export function isProcessAlive(pid) {
  const numericPid = Number(pid);
  if (!Number.isInteger(numericPid) || numericPid <= 0) {
    return false;
  }
  try {
    process.kill(numericPid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function terminateProcessTree(pid, options = {}) {
  const numericPid = Number(pid);
  if (!Number.isInteger(numericPid) || numericPid <= 0) {
    return false;
  }

  if (!isProcessAlive(numericPid)) {
    return false;
  }

  const graceMs = options.graceMs ?? 1000;

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(numericPid), '/T', '/F'], {stdio: 'ignore'});
    return true;
  }

  try {
    process.kill(-numericPid, 'SIGTERM');
  } catch (error) {
    if (error?.code === 'ESRCH') {
      return false;
    }
    process.kill(numericPid, 'SIGTERM');
  }

  await sleep(graceMs);

  if (!isProcessAlive(numericPid)) {
    return true;
  }

  try {
    process.kill(-numericPid, 'SIGKILL');
  } catch {
    try {
      process.kill(numericPid, 'SIGKILL');
    } catch {
      // Ignore final cleanup failures for already-dead processes.
    }
  }
  return true;
}

export function spawnDetachedProcess(command, args = [], options = {}) {
  const logFile = options.logFile;
  let logFd = null;
  if (logFile) {
    ensureDir(path.dirname(logFile));
    logFd = fs.openSync(logFile, 'a');
  }

  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    detached: true,
    stdio: logFd === null ? 'ignore' : ['ignore', logFd, logFd],
    windowsHide: true
  });
  child.unref();

  if (logFd !== null) {
    fs.closeSync(logFd);
  }

  return child;
}

export function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const captureOutput = options.captureOutput === true;
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: options.stdio ?? (captureOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit'),
      detached: options.detached ?? false,
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';

    if (captureOutput && child.stdout) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
    }

    if (captureOutput && child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
    }

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      resolve({
        code: code ?? 0,
        signal: signal ?? null,
        stdout,
        stderr
      });
    });
  });
}

export async function runCommandChecked(command, args = [], options = {}) {
  const result = await runCommand(command, args, options);
  if (result.signal) {
    throw new Error(`${command} exited via signal ${result.signal}`);
  }
  if (result.code !== 0) {
    const detail = result.stderr || result.stdout;
    throw new Error(detail ? `${command} exited with code ${result.code}\n${detail}` : `${command} exited with code ${result.code}`);
  }
  return result;
}

export function backendMavenLaunchSpec(repoRoot, args = []) {
  return {
    command: process.execPath,
    args: [path.join(repoRoot, '.codex', 'scripts', 'backend_mvn.mjs'), '--', ...args],
    cwd: repoRoot
  };
}

export function runBackendMaven(repoRoot, args = [], options = {}) {
  const spec = backendMavenLaunchSpec(repoRoot, args);
  return runCommand(spec.command, spec.args, {
    ...options,
    cwd: options.cwd ?? spec.cwd
  });
}

export function runBackendMavenChecked(repoRoot, args = [], options = {}) {
  const spec = backendMavenLaunchSpec(repoRoot, args);
  return runCommandChecked(spec.command, spec.args, {
    ...options,
    cwd: options.cwd ?? spec.cwd
  });
}

export function runCommandStreaming(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const logFile = options.logFile;
    let stream = null;
    if (logFile) {
      ensureDir(path.dirname(logFile));
      stream = fs.createWriteStream(logFile, {flags: 'a'});
    }

    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });

    const closeStream = () => {
      if (stream) {
        stream.end();
      }
    };

    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      stream?.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      stream?.write(chunk);
    });

    child.on('error', (error) => {
      closeStream();
      reject(error);
    });

    child.on('exit', (code, signal) => {
      closeStream();
      resolve({
        code: code ?? 0,
        signal: signal ?? null
      });
    });
  });
}

export function tailFile(filePath, lines = 120) {
  if (!fs.existsSync(filePath)) {
    return '';
  }
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).slice(-lines).join('\n');
}

export function timestampSlug(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
}

export async function canConnect(host, port, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const socket = net.createConnection({host, port});
    const onDone = (result) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => onDone(true));
    socket.once('timeout', () => onDone(false));
    socket.once('error', () => onDone(false));
  });
}

export async function waitFor(checkFn, options = {}) {
  const attempts = options.attempts ?? 60;
  const intervalMs = options.intervalMs ?? 1000;

  for (let index = 0; index < attempts; index += 1) {
    if (await checkFn()) {
      return true;
    }
    await sleep(intervalMs);
  }

  return false;
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  try {
    return {response, body: JSON.parse(text)};
  } catch {
    return {response, body: {_raw: text}};
  }
}

export async function fetchText(url, options = {}) {
  const response = await fetch(url, options);
  return {response, body: await response.text()};
}
