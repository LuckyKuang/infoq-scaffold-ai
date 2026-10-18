import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runPlaywrightFlow} from './playwright_core.mjs';
import {resolveRepoRoot} from '../../../tools/lib/skill_runtime.mjs';
import {DEFAULT_CAPTCHA_LOGIN_OPTIONS, loginWithRealCaptcha} from './captcha_login.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(scriptDir);

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
  return path.join(repoRoot, 'tmp', 'test-cli', 'browser', 'admin-route-probe', `${normalizedRoute}.${formatTimestamp()}.${extension}`);
}

async function acquireToken({
  backendUrl = 'http://127.0.0.1:8080',
  clientId = 'e5cd7e4891bf95d1d19206ce24a7b32e',
  username = '',
  password = ''
}) {
  console.log('[admin-probe] acquiring admin token with Redis-seeded captcha login.');
  const runId = `admin-route-probe-${formatTimestamp()}-${process.pid}`;
  const {token} = await loginWithRealCaptcha({
    ...DEFAULT_CAPTCHA_LOGIN_OPTIONS, backendUrl, clientId, username, password,
    loginCandidates: process.env.LOGIN_CANDIDATES || DEFAULT_CAPTCHA_LOGIN_OPTIONS.loginCandidates,
    rsaPublicKey: process.env.RSA_PUBLIC_KEY || DEFAULT_CAPTCHA_LOGIN_OPTIONS.rsaPublicKey
  }, path.join(repoRoot, 'tmp/test-cli/e2e/captcha-login', runId));
  console.log(`[admin-probe] seeded captcha login evidence: tmp/test-cli/e2e/captcha-login/${runId}/`);
  return token;
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
  client = 'vue',
  apiPrefix = '/dev-api',
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
  const token = await acquireToken({ backendUrl, clientId, username, password });
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
    browserSession: {token, client, clientId, apiPrefix},
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
