#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {
    ensureDir,
    fetchJson,
    normalizeForwardedArgs,
    resolveDocTmpPath,
    resolvePythonLaunchSpec,
    resolveRepoRoot,
    runCommandChecked,
    timestampSlug
} from '../../../lib/skill_runtime.mjs';
import {runAdminDevStack, stopAdminDevStackState} from '../../../lib/admin_dev_stack.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(scriptDir);
const ocrScriptPath = path.join(scriptDir, 'ocr_captcha.py');
const playwrightCorePath = path.join(repoRoot, '.codex', 'skills', 'infoq-browser-automation', 'scripts', 'playwright_core.mjs');

const CLIENTS = {
  vue: {
    label: 'admin-e2e-vue',
    frontendDirName: 'infoq-scaffold-frontend-vue',
    frontendDisplayName: 'Vue admin',
    frontendLogPrefix: 'frontend-vue',
    frontendPortFlag: '--vue-port',
    frontendPortEnv: 'VUE_PORT',
    defaultFrontendPort: 5173
  },
  react: {
    label: 'admin-e2e-react',
    frontendDirName: 'infoq-scaffold-frontend-react',
    frontendDisplayName: 'React admin',
    frontendLogPrefix: 'frontend-react',
    frontendPortFlag: '--react-port',
    frontendPortEnv: 'REACT_PORT',
    defaultFrontendPort: 5174
  }
};

const DEFAULTS = {
  backendUrl: 'http://127.0.0.1:8080',
  backendPort: '8080',
  frontendHost: '127.0.0.1',
  profile: 'dev',
  clientId: 'e5cd7e4891bf95d1d19206ce24a7b32e',
  loginCandidates: 'admin:admin123,dept:666666,owner:666666,admin:123456',
  maxCaptchaAttempts: 3,
  timeoutMs: 45000,
  rsaPublicKey: 'MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAKoR8mX0rGKLqzcWmOzbfj64K8ZIgOdHnzkXSOVOZbFu/TJhZ7rFAN+eaGkl3C4buccQd/EjEsj9ir7ijT7h96MCAwEAAQ=='
};

function printHelp() {
  console.log(`Usage:
  node .codex/skills/infoq-admin-e2e-captcha-verification/scripts/run_admin_e2e.mjs --client <vue|react> [options]

Examples:
  node .codex/skills/infoq-admin-e2e-captcha-verification/scripts/run_admin_e2e.mjs --client vue
  node .codex/skills/infoq-admin-e2e-captcha-verification/scripts/run_admin_e2e.mjs --client react --route-limit 1
  node .codex/skills/infoq-admin-e2e-captcha-verification/scripts/run_admin_e2e.mjs --client vue --no-start-stack --backend-url http://127.0.0.1:8080 --frontend-origin http://127.0.0.1:5173

Options:
  --client <vue|react>              Required admin client.
  --backend-url <url>               Backend base URL. Default: ${DEFAULTS.backendUrl}
  --frontend-origin <url>           Frontend origin. Default follows --client.
  --start-stack                     Start or reuse backend + frontend dev stack. Default.
  --no-start-stack                  Reuse existing services only.
  --build-backend                   Build backend jar before startup.
  --force-restart                   Stop recorded stack processes before startup.
  --stop-stack-after                Stop processes started by this skill after the run.
  --backend-port <port>             Backend port when starting stack. Default: ${DEFAULTS.backendPort}
  --frontend-port <port>            Frontend port when starting stack.
  --frontend-host <host>            Frontend host when starting stack. Default: ${DEFAULTS.frontendHost}
  --profile <name>                  Spring profile when starting backend. Default: ${DEFAULTS.profile}
  --username <name>                 Preferred username.
  --password <pwd>                  Preferred password.
  --login-candidates <csv>          Candidate accounts. Default: ${DEFAULTS.loginCandidates}
  --client-id <id>                  Login client id. Default: ${DEFAULTS.clientId}
  --rsa-public-key <base64>         Request encryption public key.
  --max-captcha-attempts <n>        Captcha attempts per account. Default: ${DEFAULTS.maxCaptchaAttempts}
  --route-limit <n>                 Limit route smoke count.
  --include-route <pattern>         Include route pattern. Repeatable. '*' wildcard supported.
  --exclude-route <pattern>         Exclude route pattern. Repeatable. '*' wildcard supported.
  --timeout-ms <ms>                 Per-route timeout. Default: ${DEFAULTS.timeoutMs}
  --headed                          Show browser.
  --allow-console-errors            Do not fail route smoke on console errors.
  --run-id <slug>                   Evidence run id.
  -h, --help                        Show help.`);
}

function readValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function parseArgs(argv) {
  const options = {
    client: '',
    backendUrl: process.env.BACKEND_URL || DEFAULTS.backendUrl,
    frontendOrigin: process.env.FRONTEND_ORIGIN || '',
    startStack: true,
    buildBackend: false,
    forceRestart: false,
    stopStackAfter: false,
    backendPort: String(process.env.BACKEND_PORT || DEFAULTS.backendPort),
    frontendPort: '',
    frontendHost: String(process.env.FRONTEND_HOST || DEFAULTS.frontendHost),
    profile: String(process.env.PROFILE || DEFAULTS.profile),
    username: process.env.USERNAME || '',
    password: process.env.PASSWORD || '',
    loginCandidates: process.env.LOGIN_CANDIDATES || DEFAULTS.loginCandidates,
    clientId: process.env.CLIENT_ID || DEFAULTS.clientId,
    rsaPublicKey: process.env.RSA_PUBLIC_KEY || DEFAULTS.rsaPublicKey,
    maxCaptchaAttempts: DEFAULTS.maxCaptchaAttempts,
    routeLimit: 0,
    includeRoutes: [],
    excludeRoutes: [],
    timeoutMs: DEFAULTS.timeoutMs,
    headed: false,
    allowConsoleErrors: false,
    runId: ''
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--client':
        options.client = readValue(argv, index, arg);
        index += 1;
        break;
      case '--backend-url':
        options.backendUrl = readValue(argv, index, arg).replace(/\/+$/, '');
        index += 1;
        break;
      case '--frontend-origin':
        options.frontendOrigin = readValue(argv, index, arg).replace(/\/+$/, '');
        index += 1;
        break;
      case '--start-stack':
        options.startStack = true;
        break;
      case '--no-start-stack':
        options.startStack = false;
        break;
      case '--build-backend':
        options.buildBackend = true;
        break;
      case '--force-restart':
        options.forceRestart = true;
        break;
      case '--stop-stack-after':
        options.stopStackAfter = true;
        break;
      case '--backend-port':
        options.backendPort = readValue(argv, index, arg);
        index += 1;
        break;
      case '--frontend-port':
        options.frontendPort = readValue(argv, index, arg);
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
      case '--username':
        options.username = readValue(argv, index, arg);
        index += 1;
        break;
      case '--password':
        options.password = readValue(argv, index, arg);
        index += 1;
        break;
      case '--login-candidates':
        options.loginCandidates = readValue(argv, index, arg);
        index += 1;
        break;
      case '--client-id':
        options.clientId = readValue(argv, index, arg);
        index += 1;
        break;
      case '--rsa-public-key':
        options.rsaPublicKey = readValue(argv, index, arg);
        index += 1;
        break;
      case '--max-captcha-attempts':
        options.maxCaptchaAttempts = Number(readValue(argv, index, arg));
        index += 1;
        break;
      case '--route-limit':
        options.routeLimit = Number(readValue(argv, index, arg));
        index += 1;
        break;
      case '--include-route':
        options.includeRoutes.push(readValue(argv, index, arg));
        index += 1;
        break;
      case '--exclude-route':
        options.excludeRoutes.push(readValue(argv, index, arg));
        index += 1;
        break;
      case '--timeout-ms':
        options.timeoutMs = Number(readValue(argv, index, arg));
        index += 1;
        break;
      case '--headed':
        options.headed = true;
        break;
      case '--allow-console-errors':
        options.allowConsoleErrors = true;
        break;
      case '--run-id':
        options.runId = readValue(argv, index, arg);
        index += 1;
        break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!CLIENTS[options.client]) {
    throw new Error('--client must be one of: vue, react');
  }
  if (!Number.isInteger(options.maxCaptchaAttempts) || options.maxCaptchaAttempts <= 0) {
    throw new Error('--max-captcha-attempts must be a positive integer.');
  }
  if (options.routeLimit && (!Number.isInteger(options.routeLimit) || options.routeLimit <= 0)) {
    throw new Error('--route-limit must be a positive integer.');
  }
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive integer.');
  }

  return options;
}

function buildStackConfig(options, runDir) {
  const clientConfig = CLIENTS[options.client];
  const stateDir = path.join(runDir, 'stack');
  return {
    ...clientConfig,
    repoRoot,
    scriptPath: '.codex/skills/infoq-admin-e2e-captcha-verification/scripts/run_admin_e2e.mjs',
    stateSlug: path.relative(path.join(repoRoot, 'doc', 'tmp'), stateDir).replace(/\\/g, '/'),
    stateFile: path.join(stateDir, 'state.json'),
    defaultBackendPort: 8080,
    defaultFrontendPort: clientConfig.defaultFrontendPort
  };
}

function buildStackArgs(options, clientConfig) {
  const args = [
    '--backend-port',
    options.backendPort,
    clientConfig.frontendPortFlag,
    options.frontendPort || String(clientConfig.defaultFrontendPort),
    '--frontend-host',
    options.frontendHost,
    '--profile',
    options.profile
  ];
  if (options.buildBackend) {
    args.push('--build-backend');
  }
  if (options.forceRestart) {
    args.push('--force-restart');
  }
  return args;
}

function buildFrontendOrigin(options) {
  if (options.frontendOrigin) {
    return options.frontendOrigin;
  }
  const clientConfig = CLIENTS[options.client];
  const frontendPort = options.frontendPort || String(clientConfig.defaultFrontendPort);
  return `http://${options.frontendHost}:${frontendPort}`;
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function sanitizeName(value) {
  return String(value || 'item')
    .replace(/^\/+/, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'root';
}

function toPem(base64Key) {
  const lines = (base64Key.match(/.{1,64}/g) || []).join('\n');
  return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----\n`;
}

function randomAesKey(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let value = '';
  for (let i = 0; i < length; i += 1) {
    value += chars[Math.floor(Math.random() * chars.length)];
  }
  return value;
}

function encryptWithAesEcbPkcs7(plainText, aesKey) {
  const cipher = crypto.createCipheriv('aes-256-ecb', Buffer.from(aesKey, 'utf8'), null);
  cipher.setAutoPadding(true);
  return Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]).toString('base64');
}

function encryptHeaderKey(aesKey, publicKeyBase64) {
  const b64Aes = Buffer.from(aesKey, 'utf8').toString('base64');
  return crypto
    .publicEncrypt({key: toPem(publicKeyBase64), padding: crypto.constants.RSA_PKCS1_PADDING}, Buffer.from(b64Aes, 'utf8'))
    .toString('base64');
}

async function parseResponseJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return {_raw: text};
  }
}

function buildCandidates(options) {
  const list = [];
  if (options.username && options.password) {
    list.push({username: options.username, password: options.password});
  }
  for (const item of options.loginCandidates.split(',')) {
    const [username, password] = item.split(':');
    if (!username || !password) {
      continue;
    }
    if (!list.some((candidate) => candidate.username === username && candidate.password === password)) {
      list.push({username, password});
    }
  }
  if (list.length === 0) {
    throw new Error('No login candidates configured.');
  }
  return list;
}

function normalizeOcrToCaptcha(rawText) {
  const cleaned = String(rawText || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[oO]/g, '0')
    .replace(/[lI]/g, '1')
    .replace(/[×xX*]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/[=？?]+$/g, '');

  if (!cleaned) {
    return '';
  }

  if (/^\d+[+\-*/]\d+$/u.test(cleaned)) {
    const [, left, op, right] = cleaned.match(/^(\d+)([+\-*/])(\d+)$/u);
    const a = Number(left);
    const b = Number(right);
    switch (op) {
      case '+':
        return String(a + b);
      case '-':
        return String(a - b);
      case '*':
        return String(a * b);
      case '/':
        return b === 0 ? '' : String(Math.trunc(a / b));
      default:
        return cleaned;
    }
  }

  return cleaned.replace(/[^a-zA-Z0-9]/g, '');
}

async function recognizeCaptcha(imagePath) {
  const python = resolvePythonLaunchSpec();
  const ocrResult = await runCommandChecked(python.command, [...python.args, '-B', ocrScriptPath, '--image', imagePath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PYTHONDONTWRITEBYTECODE: '1'
    },
    captureOutput: true
  }).catch((error) => {
    throw new Error(`Captcha OCR failed. Ensure ddddocr is installed with: python3 -m pip install ddddocr\n${error.message || error}`);
  });

  const output = ocrResult.stdout.trim().split(/\r?\n/).at(-1) || '';
  try {
    const parsed = JSON.parse(output);
    if (parsed.error) {
      throw new Error(parsed.error);
    }
    return {
      raw: String(parsed.raw || parsed.text || ''),
      text: String(parsed.text || parsed.raw || '')
    };
  } catch (error) {
    throw new Error(`Failed to parse OCR output: ${output}\n${error.message || error}`);
  }
}

async function fetchCaptcha(options, runDir, sequence) {
  const {response, body} = await fetchJson(`${options.backendUrl}/auth/code`, {
    headers: {
      clientid: options.clientId,
      'Content-Language': 'zh-CN'
    }
  });
  if (response.status !== 200 || body.code !== 200) {
    throw new Error(`GET /auth/code failed: http=${response.status}, code=${body.code}, msg=${body.msg || ''}`);
  }
  const data = body.data || {};
  if (data.captchaEnabled !== true) {
    throw new Error('GET /auth/code returned captchaEnabled=false. This skill requires real captcha verification.');
  }
  if (!data.img || !data.uuid) {
    throw new Error('GET /auth/code did not return img and uuid.');
  }

  const imagePath = path.join(runDir, 'captcha', `captcha-${sequence}.png`);
  const metaPath = path.join(runDir, 'captcha', `captcha-${sequence}.json`);
  ensureDir(path.dirname(imagePath));
  fs.writeFileSync(imagePath, Buffer.from(data.img, 'base64'));
  writeJson(metaPath, {
    sequence,
    uuid: data.uuid,
    captchaEnabled: data.captchaEnabled,
    registerEnabled: data.registerEnabled,
    inviteRegisterEnabled: data.inviteRegisterEnabled,
    forgotPasswordEnabled: data.forgotPasswordEnabled,
    mailEnabled: data.mailEnabled,
    imagePath
  });

  return {uuid: data.uuid, imagePath, metaPath};
}

async function loginEncrypted(options, account, captchaCode, uuid) {
  const aesKey = randomAesKey(32);
  const payload = JSON.stringify({
    clientId: options.clientId,
    grantType: 'password',
    username: account.username,
    password: account.password,
    code: captchaCode,
    uuid
  });

  const response = await fetch(`${options.backendUrl}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      clientid: options.clientId,
      'encrypt-key': encryptHeaderKey(aesKey, options.rsaPublicKey)
    },
    body: encryptWithAesEcbPkcs7(payload, aesKey)
  });

  return {
    response,
    body: await parseResponseJson(response)
  };
}

async function loginWithRealCaptcha(options, runDir) {
  const candidates = buildCandidates(options);
  const attempts = [];
  let sequence = 0;

  for (const account of candidates) {
    for (let attempt = 1; attempt <= options.maxCaptchaAttempts; attempt += 1) {
      sequence += 1;
      const captcha = await fetchCaptcha(options, runDir, sequence);
      const ocr = await recognizeCaptcha(captcha.imagePath);
      const captchaCode = normalizeOcrToCaptcha(ocr.text || ocr.raw);
      const attemptRecord = {
        sequence,
        username: account.username,
        attempt,
        uuid: captcha.uuid,
        imagePath: captcha.imagePath,
        ocrRaw: ocr.raw,
        ocrText: ocr.text,
        captchaCode,
        status: 'pending'
      };

      if (!captchaCode) {
        attemptRecord.status = 'ocr-empty';
        attempts.push(attemptRecord);
        writeJson(captcha.metaPath, attemptRecord);
        continue;
      }

      const loginResult = await loginEncrypted(options, account, captchaCode, captcha.uuid);
      const token = loginResult.body?.data?.access_token || loginResult.body?.data?.accessToken;
      attemptRecord.httpStatus = loginResult.response.status;
      attemptRecord.responseCode = loginResult.body?.code;
      attemptRecord.responseMsg = loginResult.body?.msg || '';
      attemptRecord.status = loginResult.response.status === 200 && loginResult.body?.code === 200 && token ? 'passed' : 'failed';
      attempts.push(attemptRecord);
      writeJson(captcha.metaPath, attemptRecord);

      if (attemptRecord.status === 'passed') {
        console.log(`[admin-e2e] login passed: user=${account.username}, captcha="${captchaCode}", attempt=${attempt}`);
        return {token, username: account.username, attempts};
      }

      console.log(
        `[admin-e2e] login attempt failed: user=${account.username}, captcha="${captchaCode}", http=${attemptRecord.httpStatus}, code=${attemptRecord.responseCode}, msg=${attemptRecord.responseMsg}`
      );
    }
  }

  throw new Error(`Real captcha login failed after ${attempts.length} attempt(s). Evidence: ${path.join(runDir, 'captcha')}`);
}

async function fetchProtectedJson(options, token, apiPath, label) {
  const {response, body} = await fetchJson(`${options.backendUrl}${apiPath}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      clientid: options.clientId,
      'Content-Language': 'zh-CN'
    }
  });
  if (response.status !== 200 || body.code !== 200) {
    throw new Error(`${label} failed: http=${response.status}, code=${body.code}, msg=${body.msg || ''}`);
  }
  return body.data;
}

function joinRoutePath(prefix, pathValue) {
  if (!pathValue) {
    return prefix || '/';
  }
  if (pathValue.startsWith('/')) {
    return pathValue;
  }
  const base = (prefix || '').replace(/\/+$/, '');
  return `${base}/${pathValue}`.replace(/\/+/g, '/') || '/';
}

function collectRoutes(nodes, prefix = '') {
  const results = [];
  for (const node of nodes || []) {
    const fullPath = joinRoutePath(prefix, node?.path || '');
    if (node?.component && node.component !== 'Layout') {
      results.push({
        path: fullPath,
        name: node.name || '',
        component: node.component,
        hidden: Boolean(node.hidden),
        meta: node.meta || {}
      });
    }
    if (Array.isArray(node?.children) && node.children.length > 0) {
      results.push(...collectRoutes(node.children, fullPath));
    }
  }
  return results;
}

function patternToRegExp(pattern) {
  const escaped = String(pattern)
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

function routeMatches(routePath, patterns) {
  if (patterns.length === 0) {
    return true;
  }
  return patterns.some((pattern) => {
    if (pattern.includes('*')) {
      return patternToRegExp(pattern).test(routePath);
    }
    return routePath.includes(pattern);
  });
}

function filterRoutes(routes, options) {
  let filtered = routes
    .filter((route) => route.path && !route.path.includes(':'))
    .filter((route) => routeMatches(route.path, options.includeRoutes))
    .filter((route) => options.excludeRoutes.length === 0 || !routeMatches(route.path, options.excludeRoutes));

  const indexRoute = filtered.find((route) => route.path === '/index');
  if (indexRoute) {
    filtered = [indexRoute, ...filtered.filter((route) => route.path !== '/index')];
  }

  if (options.routeLimit > 0) {
    filtered = filtered.slice(0, options.routeLimit);
  }
  return filtered;
}

async function loadPlaywrightFlow() {
  try {
    const module = await import(pathToFileURL(playwrightCorePath).href);
    return module.runPlaywrightFlow;
  } catch (error) {
    throw new Error(
      `Playwright runtime is required. Install it with:\n` +
      `pnpm --dir .codex/skills/infoq-browser-automation/scripts install\n` +
      `pnpm --dir .codex/skills/infoq-browser-automation/scripts exec playwright install chromium\n` +
      `${error.message || error}`
    );
  }
}

async function runRouteSmoke(options, runDir, token, routes) {
  const runPlaywrightFlow = await loadPlaywrightFlow();
  const results = [];

  for (const route of routes) {
    const routeName = sanitizeName(route.path);
    const screenshotPath = path.join(runDir, 'screenshots', `${routeName}.png`);
    const consoleLogPath = path.join(runDir, 'console', `${routeName}.json`);
    const targetUrl = `${buildFrontendOrigin(options)}${route.path}`;
    const startedAt = new Date().toISOString();
    console.log(`[admin-e2e] route smoke: ${route.path}`);
    try {
      await runPlaywrightFlow({
        targetUrl,
        storageKey: 'Admin-Token',
        storageValue: token,
        waitForUrl: route.path,
        screenshotPath,
        consoleLogPath,
        failOnConsoleErrors: !options.allowConsoleErrors,
        timeoutMs: options.timeoutMs,
        headed: options.headed
      });
      results.push({
        ...route,
        targetUrl,
        status: 'passed',
        startedAt,
        finishedAt: new Date().toISOString(),
        screenshotPath,
        consoleLogPath
      });
    } catch (error) {
      results.push({
        ...route,
        targetUrl,
        status: 'failed',
        startedAt,
        finishedAt: new Date().toISOString(),
        screenshotPath,
        consoleLogPath,
        error: error.message || String(error)
      });
    }
  }

  return results;
}

function writeMarkdownReport(reportPath, report) {
  const lines = [
    `# InfoQ Admin E2E Captcha Report`,
    ``,
    `- Run ID: ${report.runId}`,
    `- Client: ${report.client}`,
    `- Backend: ${report.backendUrl}`,
    `- Frontend: ${report.frontendOrigin}`,
    `- User: ${report.username}`,
    `- Status: ${report.status}`,
    `- Routes: ${report.summary.passedRoutes}/${report.summary.totalRoutes} passed`,
    `- Evidence: ${report.runDir}`,
    ``,
    `## Failed Routes`,
    ``
  ];

  const failed = report.routes.filter((route) => route.status !== 'passed');
  if (failed.length === 0) {
    lines.push('- None');
  } else {
    for (const route of failed) {
      lines.push(`- ${route.path}: ${route.error || route.status}`);
    }
  }

  lines.push('', '## Captcha Attempts', '');
  for (const attempt of report.loginAttempts) {
    lines.push(`- #${attempt.sequence} ${attempt.username}: status=${attempt.status}, raw="${attempt.ocrRaw}", code="${attempt.captchaCode}"`);
  }

  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
}

async function main() {
  const options = parseArgs(normalizeForwardedArgs(process.argv.slice(2)));
  const clientConfig = CLIENTS[options.client];
  const runId = options.runId || `${options.client}-${timestampSlug()}`;
  const runDir = resolveDocTmpPath(repoRoot, 'infoq-admin-e2e-captcha-verification', runId);
  ensureDir(runDir);
  options.backendUrl = options.backendUrl.replace(/\/+$/, '');
  if (options.backendUrl === DEFAULTS.backendUrl && options.backendPort !== DEFAULTS.backendPort) {
    options.backendUrl = `http://127.0.0.1:${options.backendPort}`;
  }

  if (!options.frontendPort) {
    options.frontendPort = String(clientConfig.defaultFrontendPort);
  }
  if (!options.frontendOrigin) {
    options.frontendOrigin = buildFrontendOrigin(options);
  }

  const stackConfig = buildStackConfig(options, runDir);
  try {
    if (options.startStack) {
      console.log(`[admin-e2e] starting/reusing stack for ${options.client}`);
      await runAdminDevStack(stackConfig, buildStackArgs(options, clientConfig));
    }

    console.log(`[admin-e2e] backend: ${options.backendUrl}`);
    console.log(`[admin-e2e] frontend: ${options.frontendOrigin}`);
    console.log(`[admin-e2e] evidence: ${runDir}`);

    const login = await loginWithRealCaptcha(options, runDir);
    const userInfo = await fetchProtectedJson(options, login.token, '/system/user/getInfo', 'GET /system/user/getInfo');
    const routeTree = await fetchProtectedJson(options, login.token, '/system/menu/getRouters', 'GET /system/menu/getRouters');
    const allRoutes = Array.from(new Map(collectRoutes(routeTree).map((route) => [route.path, route])).values())
      .sort((a, b) => a.path.localeCompare(b.path));
    const routes = filterRoutes(allRoutes, options);
    if (routes.length === 0) {
      throw new Error('No routes selected for smoke. Check --include-route / --exclude-route / --route-limit.');
    }

    writeJson(path.join(runDir, 'routes.json'), {
      total: allRoutes.length,
      selected: routes.length,
      routes
    });

    const routeResults = await runRouteSmoke(options, runDir, login.token, routes);
    const failedRoutes = routeResults.filter((route) => route.status !== 'passed');
    const report = {
      runId,
      runDir,
      client: options.client,
      backendUrl: options.backendUrl,
      frontendOrigin: options.frontendOrigin,
      username: login.username,
      user: userInfo?.user || null,
      status: failedRoutes.length === 0 ? 'passed' : 'failed',
      summary: {
        totalRoutes: routeResults.length,
        passedRoutes: routeResults.length - failedRoutes.length,
        failedRoutes: failedRoutes.length,
        captchaAttempts: login.attempts.length
      },
      loginAttempts: login.attempts,
      routes: routeResults
    };

    writeJson(path.join(runDir, 'report.json'), report);
    writeMarkdownReport(path.join(runDir, 'report.md'), report);

    console.log(`[admin-e2e] report: ${path.join(runDir, 'report.md')}`);
    if (failedRoutes.length > 0) {
      throw new Error(`[admin-e2e] route smoke failed: ${failedRoutes.length}/${routeResults.length}. See ${path.join(runDir, 'report.md')}`);
    }
    console.log(`[admin-e2e] completed successfully: ${routeResults.length} route(s) passed`);
  } finally {
    if (options.stopStackAfter) {
      await stopAdminDevStackState(stackConfig);
    }
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
