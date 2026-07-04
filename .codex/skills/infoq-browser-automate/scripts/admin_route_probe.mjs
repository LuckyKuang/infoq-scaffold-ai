import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {runPlaywrightFlow} from './playwright_core.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..', '..', '..');
const loginScript = path.join(repoRoot, '.codex', 'skills', 'infoq-backend-verify', 'scripts', 'login_check.mjs');
const captchaLoginScript = path.join(repoRoot, '.codex', 'skills', 'infoq-admin-e2e', 'scripts', 'captcha_login.mjs');

function formatTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('') + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function joinRoutePath(prefix, pathValue) {
  if (!pathValue) {
    return prefix || '/';
  }

  if (pathValue.startsWith('/')) {
    return pathValue;
  }

  const base = (prefix || '').replace(/\/+$/, '');
  if (!base) {
    return `/${pathValue}`;
  }

  return `${base}/${pathValue}`.replace(/\/+/g, '/');
}

function getRouteList(nodes, prefix = '') {
  const results = [];
  for (const node of nodes || []) {
    const fullPath = joinRoutePath(prefix, node?.path || '');
    if (node?.component && node.component !== 'Layout') {
      results.push(fullPath);
    }
    if (Array.isArray(node?.children) && node.children.length > 0) {
      results.push(...getRouteList(node.children, fullPath));
    }
  }
  return results;
}

function buildDefaultEvidencePath(route, extension) {
  const normalizedRoute = route === '/' ? 'root' : route.replace(/^\/+/, '').replace(/\//g, '_');
  return path.join(repoRoot, 'doc', 'tmp', 'infoq-browser-automate', 'admin-route-probe', `${normalizedRoute}.${formatTimestamp()}.${extension}`);
}

function collectProcessOutput(result) {
  return [result.stdout, result.stderr, result.error?.message]
    .filter(Boolean)
    .map((value) => value.trim())
    .filter(Boolean)
    .join('\n');
}

function parseTokenOutput(output, label) {
  const tokenLine = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('TOKEN='))
    .at(-1);

  if (!tokenLine) {
    throw new Error(`${label} succeeded without TOKEN output.\n${output}`);
  }

  const token = tokenLine.replace(/^TOKEN=/, '');
  if (!token) {
    throw new Error(`${label} returned an empty token.\n${output}`);
  }

  return token;
}

function isCaptchaEnabledFailure(output) {
  const normalized = String(output || '').toLowerCase();
  return (
    output.includes('captchaEnabled=true') ||
    output.includes('captchaEnabled = true') ||
    normalized.includes('captcha enabled') ||
    normalized.includes('real captcha login') ||
    normalized.includes('use infoq-admin-e2e')
  );
}

function runFastLoginCheck({backendUrl, clientId, username, password}) {
  return spawnSync(process.execPath, [loginScript], {
    cwd: repoRoot,
    env: {
      ...process.env,
      BASE_URL: backendUrl,
      CLIENT_ID: clientId,
      USERNAME: username,
      PASSWORD: password,
      PRINT_TOKEN: '1'
    },
    encoding: 'utf8'
  });
}

function runCaptchaLogin({backendUrl, clientId, username, password}) {
  const runId = `admin-route-probe-${formatTimestamp()}-${process.pid}`;
  const args = [
    captchaLoginScript,
    '--backend-url',
    backendUrl,
    '--client-id',
    clientId,
    '--run-id',
    runId,
    '--print-token'
  ];
  if (username && password) {
    args.push('--username', username, '--password', password);
  }

  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      BACKEND_URL: backendUrl,
      CLIENT_ID: clientId,
      USERNAME: username,
      PASSWORD: password
    },
    encoding: 'utf8'
  });
  return {result, runId};
}

function acquireToken({
  backendUrl = 'http://127.0.0.1:8080',
  clientId = 'e5cd7e4891bf95d1d19206ce24a7b32e',
  username = '',
  password = ''
}) {
  const fastResult = runFastLoginCheck({backendUrl, clientId, username, password});
  const fastOutput = collectProcessOutput(fastResult);

  if (fastResult.status === 0) {
    return parseTokenOutput(fastOutput, 'Login check');
  }

  if (!isCaptchaEnabledFailure(fastOutput)) {
    throw new Error(
      `Failed to acquire admin token from ${backendUrl}. Ensure backend is reachable and credentials are valid.\n${fastOutput}`
    );
  }

  console.log('[admin-probe] fast login check reported captchaEnabled=true; falling back to OCR captcha login.');
  const {result: captchaResult, runId} = runCaptchaLogin({backendUrl, clientId, username, password});
  const captchaOutput = collectProcessOutput(captchaResult);
  if (captchaResult.status !== 0) {
    throw new Error(
      `Failed to acquire admin token from ${backendUrl} with OCR captcha login. Evidence run id: ${runId}\n` +
      `Fast login output:\n${fastOutput}\n\nCaptcha login output:\n${captchaOutput}`
    );
  }
  console.log(`[admin-probe] OCR captcha login evidence: doc/tmp/infoq-admin-e2e/captcha-login/${runId}/`);
  return parseTokenOutput(captchaOutput, 'Captcha login');
}

async function fetchRoutes(backendUrl, clientId, token) {
  const response = await fetch(`${backendUrl}/system/menu/getRouters`, {
    headers: {
      Authorization: `Bearer ${token}`,
      clientid: clientId,
      'Content-Language': 'zh-CN'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch admin routes from ${backendUrl}/system/menu/getRouters: http=${response.status}`);
  }

  const payload = await response.json();
  if (payload.code !== 200 || !payload.data) {
    throw new Error(`Router API failed: code=${payload.code} msg=${payload.msg || ''}`);
  }

  return payload.data;
}

export async function runAdminRouteProbe({
  frontendOrigin = '',
  route = '/index',
  backendUrl = 'http://127.0.0.1:8080',
  clientId = 'e5cd7e4891bf95d1d19206ce24a7b32e',
  username = '',
  password = '',
  waitForText = '',
  screenshotPath = '',
  consoleLogPath = '',
  timeoutMs = 45000,
  listRoutes = false,
  headed = false,
  allowConsoleErrors = false
}) {
  const normalizedRoute = route.startsWith('/') ? route : `/${route}`;
  const token = acquireToken({ backendUrl, clientId, username, password });
  const routeTree = await fetchRoutes(backendUrl, clientId, token);
  const routeList = Array.from(new Set(getRouteList(routeTree))).sort();

  if (listRoutes) {
    for (const routePath of routeList) {
      console.log(routePath);
    }
    return { routeList, listedOnly: true };
  }

  if (!frontendOrigin) {
    throw new Error('frontendOrigin is required unless --list-routes is used.');
  }

  const targetUrl = `${frontendOrigin.replace(/\/+$/, '')}${normalizedRoute}`;
  const effectiveScreenshotPath = screenshotPath || buildDefaultEvidencePath(normalizedRoute, 'png');
  const effectiveConsoleLogPath = consoleLogPath || buildDefaultEvidencePath(normalizedRoute, 'console.json');

  console.log(`[admin-probe] backend: ${backendUrl}`);
  console.log(`[admin-probe] frontend: ${frontendOrigin}`);
  console.log(`[admin-probe] route: ${normalizedRoute}`);
  console.log(`[admin-probe] route count from backend: ${routeList.length}`);
  console.log(`[admin-probe] screenshot: ${effectiveScreenshotPath}`);
  console.log(`[admin-probe] console log: ${effectiveConsoleLogPath}`);

  await runPlaywrightFlow({
    targetUrl,
    storageKey: 'Admin-Token',
    storageValue: token,
    waitForText,
    waitForUrl: normalizedRoute,
    screenshotPath: effectiveScreenshotPath,
    consoleLogPath: effectiveConsoleLogPath,
    failOnConsoleErrors: !allowConsoleErrors,
    timeoutMs,
    headed
  });

  console.log('[admin-probe] completed successfully');
  return {
    routeList,
    screenshotPath: effectiveScreenshotPath,
    consoleLogPath: effectiveConsoleLogPath
  };
}
