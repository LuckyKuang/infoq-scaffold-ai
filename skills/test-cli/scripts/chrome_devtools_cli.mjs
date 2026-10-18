#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {isProcessAlive, markRunState, resolveRepoRoot, terminateProcessTree} from '../../../tools/lib/skill_runtime.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(scriptDir);
const entryPath = path.join(scriptDir, 'node_modules', 'chrome-devtools-mcp', 'build', 'src', 'bin', 'chrome-devtools-mcp.js');
const localStoragePath = path.join(repoRoot, 'tmp', 'test-cli', 'browser', 'chrome-devtools-mcp', 'localstorage');
const forwardedArgs = process.argv[2] === '--' ? process.argv.slice(3) : process.argv.slice(2);

function printHelp() {
  console.log(`Usage:
  pnpm --dir skills/test-cli/scripts run chrome-devtools-cli -- [chrome-devtools-mcp args]

Examples:
  pnpm --dir skills/test-cli/scripts run chrome-devtools-cli -- --help

Notes:
  - Requires local dependencies under skills/test-cli/scripts.
  - Writes local MCP storage under tmp/test-cli/browser/chrome-devtools-mcp/.`);
}

if (forwardedArgs.includes('-h') || forwardedArgs.includes('--help')) {
  printHelp();
  process.exit(0);
}

if (!fs.existsSync(entryPath)) {
  console.error(
    "chrome-devtools-mcp is not installed. Run 'pnpm --dir skills/test-cli/scripts install' first."
  );
  process.exit(1);
}

fs.mkdirSync(path.dirname(localStoragePath), { recursive: true });
const stateFile = path.join(path.dirname(localStoragePath), `${Date.now()}-${process.pid}.state.json`);
const logFile = stateFile.replace(/\.state\.json$/u, '.log');
const record = (patch) => {
  fs.appendFileSync(logFile, `${new Date().toISOString()} ${JSON.stringify(patch)}\n`, 'utf8');
  markRunState(stateFile, patch);
};
record({status: 'starting', pid: null, runnerPid: process.pid, port: null, log: logFile, transport: 'stdio', owned: true});

const child = spawn(process.execPath, [`--localstorage-file=${localStoragePath}`, entryPath, ...forwardedArgs], {
  cwd: scriptDir,
  env: process.env,
  stdio: 'inherit',
  detached: process.platform !== 'win32'
});
record({status: 'running', pid: child.pid || null});
let interrupted = '';
let stopPromise;
let cleanupError;
const stopChild = () => {
  stopPromise ||= terminateProcessTree(child.pid).catch((error) => {
    cleanupError = error;
    record({status: 'failed', cleanupError: error.message});
  });
  return stopPromise;
};
const handlers = new Map(['SIGINT', 'SIGTERM', 'SIGHUP'].map((signal) => [signal, () => {
  interrupted ||= signal;
  void stopChild();
}]));
for (const [signal, handler] of handlers) process.on(signal, handler);

child.on('error', (error) => {
  console.error(`Failed to launch chrome-devtools-mcp: ${error.message}`);
  record({status: 'failed', error: error.message});
  process.exitCode = 1;
});

child.on('close', async (code, signal) => {
  await stopChild();
  const alive = isProcessAlive(child.pid);
  record({status: (alive || cleanupError) ? 'failed' : interrupted ? 'interrupted' : code === 0 ? 'stopped' : 'failed', exitCode: code, signal: interrupted || signal, processClosed: !alive && !cleanupError});
  for (const [name, handler] of handlers) process.removeListener(name, handler);
  process.exitCode = (alive || cleanupError) ? 1 : interrupted === 'SIGINT' ? 130 : interrupted === 'SIGHUP' ? 129 : interrupted ? 143 : (code ?? 1);
});
