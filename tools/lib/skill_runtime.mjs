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
    // A detached leader may already have exited while its owned process group remains.
    const stopped = await terminateProcessTree(record.pid, {graceMs: options.graceMs ?? 1000});
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
    const skillsDir = path.join(currentDir, 'skills');
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

export function resolveTmpDir(repoRoot) {
  return ensureDir(path.join(repoRoot, 'tmp'));
}

export function resolveTmpPath(repoRoot, ...parts) {
  return path.join(resolveTmpDir(repoRoot), ...parts);
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
  if (numericPid === process.pid) throw new Error('Refusing to terminate the current process');

  const graceMs = options.graceMs ?? 1000;

  if (process.platform === 'win32') {
    if (!isProcessAlive(numericPid)) return false;
    const result = spawnSync('taskkill', ['/PID', String(numericPid), '/T', '/F'], {stdio: 'ignore'});
    if (isProcessAlive(numericPid)) {
      throw new Error(`Failed to stop owned process ${numericPid}: ${result.error?.message || `taskkill exit ${result.status}`}`);
    }
    return true;
  }

  const ownedPids = new Set([numericPid]);
  let ownsGroup = false;
  // One process-table read per snapshot avoids per-process IO and never exposes command lines.
  const snapshot = () => {
    const result = spawnSync('ps', ['-A', '-o', 'pid=', '-o', 'ppid=', '-o', 'pgid=', '-o', 'stat='], {encoding: 'utf8'});
    if (result.error || result.status !== 0) throw new Error(`Cannot inspect owned process tree: ${result.error?.message || `ps exit ${result.status}`}`);
    const rows = result.stdout.split(/\r?\n/u).filter((line) => line.trim()).map((line) => {
      const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s*$/u.exec(line);
      if (!match) throw new Error('Cannot parse process-table PID/PPID/PGID/status fields');
      return {pid: Number(match[1]), parent: Number(match[2]), group: Number(match[3]), active: !/^[ZX]/u.test(match[4])};
    });
    ownsGroup ||= rows.some((row) => row.group === numericPid);
    let changed = true;
    while (changed) {
      changed = false;
      for (const row of rows) {
        if (!ownedPids.has(row.pid) && (ownedPids.has(row.parent) || (ownsGroup && row.group === numericPid))) {
          ownedPids.add(row.pid);
          changed = true;
        }
      }
    }
    if (ownedPids.has(process.pid)) throw new Error('Refusing to terminate a process tree containing the current process');
    return rows.filter((row) => row.active && ownedPids.has(row.pid));
  };
  const signalTree = (rows, signal) => {
    const targets = ownsGroup ? [-numericPid] : [];
    // Keep the parent until descendants have been signalled; a shared process group is never killed.
    targets.push(...rows.filter((row) => row.pid !== numericPid && (!ownsGroup || row.group !== numericPid)).map((row) => row.pid));
    if (!ownsGroup && rows.some((row) => row.pid === numericPid)) targets.push(numericPid);
    for (const target of new Set(targets)) {
      try { process.kill(target, signal); } catch (error) { if (error?.code !== 'ESRCH') throw error; }
    }
  };
  let remaining = snapshot();
  if (!remaining.length) return false;
  signalTree(remaining, 'SIGTERM');

  await sleep(graceMs);
  remaining = snapshot();
  if (!remaining.length) return true;
  signalTree(remaining, 'SIGKILL');
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await sleep(20);
    remaining = snapshot();
    if (!remaining.length) return true;
  }
  throw new Error(`Owned process tree ${numericPid} still has active PIDs after SIGKILL: ${remaining.map((row) => row.pid).join(', ')}`);
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
    if (options.signal?.aborted) {
      const error = new Error('Command aborted before start', {cause: options.signal.reason});
      error.name = 'AbortError';
      error.code = 'ABORT_ERR';
      reject(error);
      return;
    }
    if (options.timeoutMs !== undefined && (!Number.isInteger(options.timeoutMs) || options.timeoutMs <= 0)) {
      reject(new Error('timeoutMs must be a positive integer'));
      return;
    }
    const captureOutput = options.captureOutput === true;
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: options.stdio ?? (captureOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit'),
      // Cancellation must also stop descendants that inherited our stdout/stderr pipes.
      detached: process.platform !== 'win32' && (options.signal || options.timeoutMs) ? true : (options.detached ?? false),
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

    let spawnError;
    let cancellationError;
    let stopPromise;
    let timer;
    const cancel = (error) => {
      if (cancellationError) return;
      cancellationError = error;
      stopPromise = child.pid ? terminateProcessTree(child.pid, {graceMs: 40}) : Promise.resolve(false);
      stopPromise.catch((cleanupError) => reject(new AggregateError([error, cleanupError], `${error.message}; owned process cleanup failed: ${cleanupError.message}`)));
    };
    const onAbort = () => {
      const error = new Error('Command aborted', {cause: options.signal.reason});
      error.name = 'AbortError';
      error.code = 'ABORT_ERR';
      cancel(error);
    };
    child.on('error', (error) => { spawnError = error; });
    child.on('close', async (code, signal) => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      try { await stopPromise; } catch { return; }
      if (spawnError || cancellationError) {
        reject(spawnError || cancellationError);
        return;
      }
      resolve({
        code: code ?? 1,
        signal: signal ?? null,
        stdout,
        stderr
      });
    });
    if (options.signal) {
      options.signal.addEventListener('abort', onAbort, {once: true});
      if (options.signal.aborted) onAbort();
    }
    if (options.timeoutMs !== undefined) timer = setTimeout(() => {
      const error = new Error(`Command timed out after ${options.timeoutMs}ms`);
      error.name = 'TimeoutError';
      error.code = 'ETIMEDOUT';
      cancel(error);
    }, options.timeoutMs);
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
    args: [path.join(repoRoot, 'tools', 'backend_mvn.mjs'), '--', ...args],
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
