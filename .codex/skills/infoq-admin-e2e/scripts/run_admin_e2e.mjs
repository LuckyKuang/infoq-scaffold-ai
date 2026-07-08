#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {resolveBackendConfigSelection} from '../../../scripts/resolve_backend_local_mcp_env.mjs';
import {
    ensureDir,
    fetchJson,
    markRunState,
    normalizeForwardedArgs,
    readJsonFile,
    resolveDocTmpPath,
    resolveRepoRoot,
    timestampSlug
} from '../../../lib/skill_runtime.mjs';
import {runAdminDevStack, stopAdminDevStackState} from '../../../lib/admin_dev_stack.mjs';
import {DEFAULT_CAPTCHA_LOGIN_OPTIONS, loginWithRealCaptcha} from './captcha_login.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(scriptDir);
const playwrightCorePath = path.join(repoRoot, '.codex', 'skills', 'infoq-browser-automate', 'scripts', 'playwright_core.mjs');
const defaultProfile = (() => {
  try {
    return resolveBackendConfigSelection(repoRoot).profile;
  } catch {
    return 'dev';
  }
})();
const DEFAULT_ROUTE_SMOKE_LOGIN_CANDIDATES = 'admin:admin123,dept:666666,admin:123456';

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
  },
  'react-pro': {
    label: 'admin-e2e-react-pro',
    frontendDirName: 'infoq-scaffold-frontend-react-pro',
    frontendDisplayName: 'React Pro admin',
    frontendLogPrefix: 'frontend-react-pro',
    frontendPortFlag: '--react-pro-port',
    frontendPortEnv: 'REACT_PRO_PORT',
    defaultFrontendPort: 4184
  }
};

const DEFAULTS = {
  backendUrl: DEFAULT_CAPTCHA_LOGIN_OPTIONS.backendUrl,
  backendPort: '8080',
  frontendHost: '127.0.0.1',
  profile: defaultProfile,
  clientId: DEFAULT_CAPTCHA_LOGIN_OPTIONS.clientId,
  loginCandidates: DEFAULT_ROUTE_SMOKE_LOGIN_CANDIDATES,
  maxCaptchaAttempts: DEFAULT_CAPTCHA_LOGIN_OPTIONS.maxCaptchaAttempts,
  timeoutMs: 45000,
  rsaPublicKey: DEFAULT_CAPTCHA_LOGIN_OPTIONS.rsaPublicKey
};

function printHelp() {
  console.log(`Usage:
  node .codex/skills/infoq-admin-e2e/scripts/run_admin_e2e.mjs --client <vue|react|react-pro> [options]

Examples:
  node .codex/skills/infoq-admin-e2e/scripts/run_admin_e2e.mjs --client vue
  node .codex/skills/infoq-admin-e2e/scripts/run_admin_e2e.mjs --client react --route-limit 1
  node .codex/skills/infoq-admin-e2e/scripts/run_admin_e2e.mjs --client react-pro --route-limit 1
  node .codex/skills/infoq-admin-e2e/scripts/run_admin_e2e.mjs --client vue --no-start-stack --backend-url http://127.0.0.1:8080 --frontend-origin http://127.0.0.1:5173

Options:
  --client <vue|react|react-pro>    Required admin client.
  --backend-url <url>               Backend base URL. Default: ${DEFAULTS.backendUrl}
  --frontend-origin <url>           Frontend origin. Default follows --client.
  --start-stack                     Start or reuse backend + frontend dev stack. Default.
  --no-start-stack                  Reuse existing services only.
  --build-backend                   Build backend jar before startup.
  --force-restart                   Stop recorded stack processes before startup.
  --stop-stack-after                Stop processes started by this skill after the run. Default.
  --keep-stack-after                Keep processes started by this skill after a successful run.
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
    stopStackAfter: true,
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
      case '--keep-stack-after':
        options.stopStackAfter = false;
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
    throw new Error('--client must be one of: vue, react, react-pro');
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
  const stateDir = resolveDocTmpPath(repoRoot, 'infoq-admin-e2e', 'stack', options.client);
  return {
    ...clientConfig,
    repoRoot,
    defaultProfile,
    scriptPath: '.codex/skills/infoq-admin-e2e/scripts/run_admin_e2e.mjs',
    stateSlug: `infoq-admin-e2e/stack/${options.client}`,
    stateFile: path.join(stateDir, 'state.json'),
    stateContext: {
      runId: path.basename(runDir),
      evidenceDir: runDir
    },
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
      `pnpm --dir .codex/skills/infoq-browser-automate/scripts install\n` +
      `pnpm --dir .codex/skills/infoq-browser-automate/scripts exec playwright install chromium\n` +
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
  const runDir = resolveDocTmpPath(repoRoot, 'infoq-admin-e2e', runId);
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

  console.log(`[admin-e2e] stack profile default: ${defaultProfile}`);

  const stackConfig = buildStackConfig(options, runDir);
  const stopStaleStackBeforeRun = async () => {
    const state = readJsonFile(stackConfig.stateFile, null);
    const shouldStop =
      ['starting', 'interrupted'].includes(state?.status) ||
      (state?.status === 'running' && state.keepAlive !== true);
    if (!shouldStop) {
      return;
    }
    console.log(`[admin-e2e] cleaning recorded stack state before run: ${stackConfig.stateFile}`);
    await stopAdminDevStackState(stackConfig, {status: 'stopped', reason: 'stale-before-e2e'});
  };
  let finalStatus = 'stopped';
  let stopReason = 'e2e-complete';
  const stopStackIfNeeded = async (status, reason) => {
    if (options.startStack && (options.stopStackAfter || status !== 'stopped')) {
      await stopAdminDevStackState(stackConfig, {status, reason});
    }
  };
  const handleInterrupt = async (signal) => {
    await stopStackIfNeeded('interrupted', signal);
    process.exit(signal === 'SIGINT' ? 130 : signal === 'SIGHUP' ? 129 : 143);
  };
  const handleSigint = () => handleInterrupt('SIGINT');
  const handleSigterm = () => handleInterrupt('SIGTERM');
  const handleSighup = () => handleInterrupt('SIGHUP');
  process.once('SIGINT', handleSigint);
  process.once('SIGTERM', handleSigterm);
  process.once('SIGHUP', handleSighup);
  try {
    if (options.startStack) {
      await stopStaleStackBeforeRun();
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
    if (options.startStack && !options.stopStackAfter) {
      markRunState(stackConfig.stateFile, {
        status: 'running',
        validationStatus: 'passed',
        keepAlive: true,
        keepReason: '--keep-stack-after',
        context: stackConfig.stateContext
      });
    }
    console.log(`[admin-e2e] completed successfully: ${routeResults.length} route(s) passed`);
  } catch (error) {
    finalStatus = 'failed';
    stopReason = error.message || String(error);
    throw error;
  } finally {
    process.removeListener('SIGINT', handleSigint);
    process.removeListener('SIGTERM', handleSigterm);
    process.removeListener('SIGHUP', handleSighup);
    await stopStackIfNeeded(finalStatus, stopReason);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
