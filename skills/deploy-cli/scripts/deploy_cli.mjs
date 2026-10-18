#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(scriptDir, '..', '..', '..');
const stateDir = path.join(repoRoot, 'tmp', 'deploy-cli');
export const stateFile = path.join(stateDir, 'state.json');
export const logFile = path.join(stateDir, 'deploy.log');
const appleScript = path.join(repoRoot, 'deploy', 'apple-container.sh');
const deployEnvFile = path.join(repoRoot, 'deploy', '.env');
const DEFAULT_APPLE_PORT = 19090;
const DEFAULT_DOCKER_BACKEND_PORT = 9090;
export const DOCKER_COMMANDS = new Set(['up', 'down', 'logs']);

const COMMANDS = new Set([
  'help', 'init', 'build', 'up', 'down', 'restart', 'status', 'smoke', 'logs', 'destroy', 'pull',
]);

const BOOLEAN_FLAGS = new Set([
  '--json', '--recreate', '--no-build', '--from-existing-jar', '--execute', '--volumes', '--yes',
  '--follow', '--help', '-h',
]);

const VALUE_FLAGS = new Set(['--base-url', '--timeout-ms', '--service']);

export function resolveRuntime(platform = process.platform) {
  if (platform === 'darwin') return 'apple';
  if (platform === 'linux') return 'docker';
  if (platform === 'win32') return 'wsl2';
  throw new Error(`Unsupported platform: ${platform}. Use macOS Apple container, WSL2 Docker, or Linux Docker.`);
}

export function parseEnvFile(text) {
  const result = {};
  const lines = text.split(/\r?\n/u);
  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) {
      throw new Error(`Invalid env line ${index + 1}: expected KEY=value`);
    }
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(key)) {
      throw new Error(`Invalid env key: ${key}`);
    }
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

export function readDeployEnv(runtime = resolveRuntime(), environment = process.env, allowMissing = false) {
  const envFile = environment.INFOQ_ENV_FILE || (runtime === 'apple'
    ? deployEnvFile
    : '/etc/infoq-scaffold-ai/deploy.env');
  if (!fs.existsSync(envFile)) {
    if (environment.INFOQ_ENV_FILE && !allowMissing) throw new Error(`Deployment env file does not exist: ${envFile}`);
    return {...environment};
  }
  // Match the shell helpers: sourced file values override inherited variables.
  return {...environment, ...parseEnvFile(fs.readFileSync(envFile, 'utf8'))};
}

export function parseArgs(argv) {
  const args = [...argv];
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    return {command: 'help', flags: {}, values: {}};
  }
  const command = args.shift();
  if (!COMMANDS.has(command)) {
    throw new Error(`Unknown command: ${command}`);
  }
  const flags = {};
  const values = {};
  while (args.length > 0) {
    const token = args.shift();
    if (token === '--') {
      throw new Error('Positional pass-through is not supported; use the documented flags.');
    }
    if (VALUE_FLAGS.has(token)) {
      const value = args.shift();
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`Missing value for ${token}`);
      }
      values[token.slice(2)] = value;
      continue;
    }
    if (token.startsWith('--') && token.includes('=')) {
      const [name, value] = token.split('=', 2);
      if (!VALUE_FLAGS.has(name)) throw new Error(`Unknown option: ${name}`);
      values[name.slice(2)] = value;
      continue;
    }
    if (BOOLEAN_FLAGS.has(token)) {
      flags[token.replace(/^--?/u, '')] = true;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  return {command, flags, values};
}

export function parsePort(value, fallback) {
  if (value === undefined || value === '') return fallback;
  const port = /^\d+$/u.test(String(value)) ? Number(value) : NaN;
  if (Number.isInteger(port) && port >= 1 && port <= 65535) return port;
  throw new Error(`Invalid TCP port: ${value}`);
}

export function normalizeBindHost(value) {
  if (!value) return '127.0.0.1';
  if (value === '0.0.0.0' || value === '::' || value === '[::]') return '127.0.0.1';
  return value;
}

export function buildSmokeChecks({runtime, baseUrl, frontendTarget = 'all'}) {
  const base = baseUrl.replace(/\/+$/u, '');
  if (runtime === 'apple') {
    return [
      {name: 'readiness', url: `${base}/monitor/health/readiness`},
      {name: 'liveness', url: `${base}/monitor/health/liveness`},
      {name: 'captcha', url: `${base}/auth/code`},
    ];
  }
  if (!['all', 'vue', 'react'].includes(frontendTarget)) {
    throw new Error(`Invalid INFOQ_FRONTEND_TARGET: ${frontendTarget}`);
  }
  // This CLI checks a local Compose stack; the public gateway may terminate TLS elsewhere.
  const backend = `http://127.0.0.1:${DEFAULT_DOCKER_BACKEND_PORT}`;
  const checks = [
    {name: 'backend-readiness', url: `${backend}/monitor/health/readiness`},
    {name: 'backend-liveness', url: `${backend}/monitor/health/liveness`},
    {name: 'gateway-readiness', url: `${base}/prod-api/monitor/health/readiness`},
  ];
  if (frontendTarget === 'all' || frontendTarget === 'vue') {
    checks.push({name: 'vue-console', url: `${base}${frontendTarget === 'all' ? '/vue/' : '/'}`});
  }
  if (frontendTarget === 'all' || frontendTarget === 'react') {
    checks.push({name: 'react-console', url: `${base}${frontendTarget === 'all' ? '/react/' : '/'}`});
  }
  return checks;
}

function ensureStateDir() {
  fs.mkdirSync(stateDir, {recursive: true});
}

export function readState() {
  if (!fs.existsSync(stateFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch (error) {
    throw new Error(`Invalid deploy state file ${stateFile}: ${error.message}`);
  }
}

export function writeState(patch) {
  ensureStateDir();
  const now = new Date().toISOString();
  const previous = readState() ?? {};
  const next = {...previous, ...patch, updatedAt: now};
  fs.writeFileSync(stateFile, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}

function relativeLogPath() {
  return path.relative(repoRoot, logFile).split(path.sep).join('/');
}

function appendLog(chunk) {
  ensureStateDir();
  fs.appendFileSync(logFile, chunk, 'utf8');
}

function runInherited(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: {...process.env, ...options.env},
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const pipe = (stream, target) => {
      stream.setEncoding('utf8');
      stream.on('data', (chunk) => {
        target.write(chunk);
        appendLog(chunk);
      });
    };
    pipe(child.stdout, process.stdout);
    pipe(child.stderr, process.stderr);
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({code: code ?? 1, signal}));
  });
}

function runCaptured(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: {...process.env, ...options.env},
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      const combined = `$ ${command} ${args.join(' ')}\n${stdout}${stderr}`;
      appendLog(combined.endsWith('\n') ? combined : `${combined}\n`);
      resolve({code: code ?? 1, signal, stdout, stderr});
    });
  });
}

async function runOrThrow(command, args, options) {
  const result = options?.capture
    ? await runCaptured(command, args, options)
    : await runInherited(command, args, options);
  if (result.code !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.code}`);
  }
  return result;
}

async function probe(check, timeoutMs) {
  const startedAt = Date.now();
  try {
    const response = await fetch(check.url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {'cache-control': 'no-cache'},
    });
    const ok = response.status >= 200 && response.status < 300;
    return {...check, ok, status: response.status, durationMs: Date.now() - startedAt};
  } catch (error) {
    return {...check, ok: false, status: null, durationMs: Date.now() - startedAt, error: error.message};
  }
}

export async function smoke(runtime, options = {}) {
  const timeoutMs = Number(options.timeoutMs ?? '10000');
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive integer');
  }
  const env = readDeployEnv(runtime);
  const appleHost = normalizeBindHost(env.APPLE_CONTAINER_BIND_HOST);
  const applePort = parsePort(env.APPLE_CONTAINER_HOST_PORT, DEFAULT_APPLE_PORT);
  const baseUrl = options.baseUrl ?? (runtime === 'apple'
    ? `http://${appleHost}:${applePort}`
    : (env.INFOQ_PUBLIC_BASE_URL ?? 'http://127.0.0.1'));
  const checks = buildSmokeChecks({
    runtime,
    baseUrl,
    frontendTarget: env.INFOQ_FRONTEND_TARGET ?? 'all',
  });
  const results = [];
  for (const check of checks) {
    results.push(await probe(check, timeoutMs));
  }
  return {
    baseUrl,
    checks: results,
    passed: results.every((item) => item.ok),
    port: runtime === 'apple' ? applePort : DEFAULT_DOCKER_BACKEND_PORT,
  };
}

function printSmoke(result) {
  for (const check of result.checks) {
    const status = check.status === null ? 'ERR' : String(check.status);
    console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name.padEnd(20)} ${status.padStart(3)} ${check.url}`);
  }
  if (result.passed) {
    console.log(`Smoke passed at ${result.baseUrl}`);
  } else {
    console.error(`Smoke failed at ${result.baseUrl}`);
  }
}

function requireApple(runtime, command) {
  if (runtime !== 'apple') {
    throw new Error(`${command} currently requires macOS Apple container; on ${runtime} follow references/docker.md.`);
  }
}

function requireExplicitExecute(flags, command, plan) {
  if (!flags.execute) {
    console.log(`Dry-run plan for ${command}:`);
    for (const line of plan) console.log(`  ${line}`);
    console.log('Re-run with --execute to perform the deployment mutation.');
    return false;
  }
  return true;
}

function appleArgs(command, flags, values) {
  switch (command) {
    case 'init': return ['init'];
    case 'build': return flags['from-existing-jar'] ? ['build', '--from-existing-jar'] : ['build'];
    case 'up': return flags.recreate ? ['up', '--recreate'] : ['up'];
    case 'down': return ['down'];
    case 'restart': return ['restart'];
    case 'status': return ['status'];
    case 'pull': return ['pull'];
    case 'destroy': {
      if (!flags.yes) throw new Error('destroy requires --yes; add --volumes to delete validation data.');
      const args = ['destroy'];
      if (flags.volumes) args.push('--volumes');
      args.push('--yes');
      return args;
    }
    case 'logs': {
      if (!values.service) throw new Error('logs requires --service <mysql|redis|admin>');
      const args = ['logs', values.service];
      if (flags.follow) args.push('-f');
      return args;
    }
    default:
      throw new Error(`Unsupported Apple command: ${command}`);
  }
}

async function dockerStatus(flags) {
  const result = await runOrThrow('bash', [path.join(repoRoot, 'deploy', 'bin', 'infoq.sh'), 'status'], {capture: true});
  if (!flags.json) process.stdout.write(result.stdout);
  return result;
}

async function main() {
  const {command, flags, values} = parseArgs(process.argv.slice(2));
  if (command === 'help' || flags.help || flags.h) {
    printUsage();
    return;
  }
  const runtime = resolveRuntime();
  ensureStateDir();
  const env = readDeployEnv(runtime, process.env, command === 'init' || command === 'up');
  const port = runtime === 'apple'
    ? parsePort(env.APPLE_CONTAINER_HOST_PORT, DEFAULT_APPLE_PORT)
    : DEFAULT_DOCKER_BACKEND_PORT;

  const mutating = new Set(['init', 'build', 'up', 'down', 'restart', 'destroy', 'pull']);
  writeState({
    command,
    status: mutating.has(command) ? 'starting' : 'running',
    pid: process.pid,
    port,
    runtime,
    log: relativeLogPath(),
    startedAt: new Date().toISOString(),
  });

  let interrupted = false;
  const onSignal = (signal, code) => {
    interrupted = true;
    writeState({status: 'interrupted', signal});
    process.exit(code);
  };
  process.once('SIGINT', () => onSignal('SIGINT', 130));
  process.once('SIGTERM', () => onSignal('SIGTERM', 143));

  try {
    if (command === 'smoke') {
      const result = await smoke(runtime, {
        baseUrl: values['base-url'],
        timeoutMs: values['timeout-ms'],
      });
      if (flags.json) console.log(JSON.stringify(result, null, 2));
      else printSmoke(result);
      writeState({status: result.passed ? 'passed' : 'failed', port: result.port});
      if (!result.passed) process.exitCode = 1;
      return;
    }

    if (command === 'status') {
      if (runtime === 'apple') {
        const result = await runOrThrow('bash', [appleScript, 'status'], {capture: true});
        if (!flags.json) process.stdout.write(`${result.stdout}${result.stderr}`);
      } else if (runtime === 'docker') {
        await dockerStatus(flags);
      }
      const result = await smoke(runtime, {
        baseUrl: values['base-url'],
        timeoutMs: values['timeout-ms'],
      });
      if (flags.json) {
        console.log(JSON.stringify({runtime, port: result.port, checks: result.checks, passed: result.passed}, null, 2));
      } else {
        printSmoke(result);
      }
      writeState({status: result.passed ? 'passed' : 'failed', port: result.port, error: null});
      if (!result.passed) process.exitCode = 1;
      return;
    }

    if (runtime === 'wsl2') {
      throw new Error('Run this command inside WSL2 Debian/Ubuntu. Native Windows lifecycle is not supported; see references/docker.md.');
    }

    if (runtime === 'docker') {
      if (!DOCKER_COMMANDS.has(command)) {
        throw new Error(`${command} is Apple-only; use deploy/VERIFICATION.md for Docker lifecycle operations.`);
      }
      const plan = command === 'up'
        ? ['INFOQ_PRINT_SECRETS=0 bash deploy/install.sh']
        : command === 'down'
          ? [
              'bash deploy/bin/infoq.sh stop',
              `bash deploy/bin/deploy-frontend.sh stop ${env.INFOQ_FRONTEND_TARGET ?? 'all'}`
            ]
          : [`bash deploy/bin/infoq.sh ${command}`];
      if (command === 'logs' && values.service) plan[0] += ` ${values.service}`;
      if (!requireExplicitExecute(flags, command, plan)) {
        writeState({status: 'stopped', dryRun: true});
        return;
      }
      if (command === 'up') {
        await runOrThrow('bash', [path.join(repoRoot, 'deploy', 'install.sh')], {env: {INFOQ_PRINT_SECRETS: '0'}});
        const result = await smoke(runtime, {timeoutMs: values['timeout-ms']});
        printSmoke(result);
        writeState({status: result.passed ? 'passed' : 'failed', port: result.port});
        if (!result.passed) process.exitCode = 1;
        return;
      }
      if (command === 'down') {
        await runOrThrow('bash', [path.join(repoRoot, 'deploy', 'bin', 'infoq.sh'), 'stop']);
        await runOrThrow('bash', [
          path.join(repoRoot, 'deploy', 'bin', 'deploy-frontend.sh'),
          'stop',
          env.INFOQ_FRONTEND_TARGET ?? 'all',
        ]);
        writeState({status: 'stopped'});
        return;
      }
      if (command === 'logs') {
        await runOrThrow('bash', [path.join(repoRoot, 'deploy', 'bin', 'infoq.sh'), 'logs', values.service ?? 'infoq-admin']);
        writeState({status: 'running'});
        return;
      }
      throw new Error(`${command} is not supported through the Docker delegation; use deploy/VERIFICATION.md.`);
    }

    requireApple(runtime, command);
    if ((command === 'up' || command === 'build') && !fs.existsSync(process.env.INFOQ_ENV_FILE || deployEnvFile)) {
      throw new Error('Apple deployment env file is missing. Run `node skills/deploy-cli/scripts/deploy_cli.mjs init` first.');
    }
    if (command === 'up') {
      if (!flags['no-build']) {
        await runOrThrow('bash', [appleScript, ...appleArgs('build', flags, values)]);
      }
      await runOrThrow('bash', [appleScript, ...appleArgs('up', flags, values)]);
      const result = await smoke(runtime, {timeoutMs: values['timeout-ms']});
      printSmoke(result);
      writeState({status: result.passed ? 'passed' : 'failed', port: result.port});
      if (!result.passed) process.exitCode = 1;
      return;
    }
    if (command === 'logs' && !values.service) {
      throw new Error('logs requires --service <mysql|redis|admin>');
    }
    await runOrThrow('bash', [appleScript, ...appleArgs(command, flags, values)]);
    writeState({status: command === 'down' || command === 'destroy' ? 'stopped' : 'running'});
  } catch (error) {
    if (!interrupted) {
      writeState({status: 'failed', error: error.message});
      console.error(`deploy-cli: ${error.message}`);
      process.exitCode = 1;
    }
  }
}

function printUsage() {
  console.log(`Usage: node skills/deploy-cli/scripts/deploy_cli.mjs <command> [options]

Commands:
  init                 Generate deploy/.env (Apple container only)
  build                Package the backend and build the runtime image (Apple only)
  up                   Build/start the stack, then smoke (Apple builds unless --no-build)
  down                 Stop owned containers and preserve data
  restart              Restart the stack in dependency order (Apple only)
  status               Show runtime state and run bounded HTTP probes
  smoke                Run bounded HTTP probes only
  logs                 Apple: mysql|redis|admin; Docker: mysql|redis|minio|infoq-admin (--execute)
  destroy              Delete owned containers/network (requires --yes; Apple only)
  pull                 Pull runtime images (Apple container only)
  help                 Show this help

Options:
  --json               Emit machine-readable output where supported
  --recreate           Recreate owned containers (up)
  --no-build           Skip the image build (up)
  --from-existing-jar  Reuse backend/infoq-admin/target/infoq-admin.jar (build)
  --execute            Perform the Docker lifecycle mutation (WSL2/Linux)
  --volumes            Delete owned volumes (destroy; requires --yes)
  --yes                Confirm destroy
  --follow             Follow logs
  --service <name>     Service for logs
  --base-url <url>     Override Apple API / Docker gateway URL (Docker API stays local :9090)
  --timeout-ms <n>     Per-probe timeout (default 10000)

State: tmp/deploy-cli/state.json
Log:   tmp/deploy-cli/deploy.log
Env:   INFOQ_ENV_FILE; default deploy/.env (Apple), /etc/infoq-scaffold-ai/deploy.env (Docker)
macOS wrapper uses Apple; use deploy/install.sh and deploy/VERIFICATION.md for Colima.
Successful up keeps the deployment running; verification tasks must explicitly down their owned stack.`);
}

const invokedDirectly = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (invokedDirectly) {
  main().catch((error) => {
    console.error(`deploy-cli: ${error.message}`);
    process.exitCode = 1;
  });
}
