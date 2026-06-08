import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {runPlaywrightFlow} from './playwright_core.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..', '..', '..');
const loginScript = path.join(repoRoot, '.codex', 'skills', 'infoq-backend-verify', 'scripts', 'login_check.mjs');

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
  return path.join(repoRoot, 'test-results', 'browser-automation', `${normalizedRoute}.${formatTimestamp()}.${extension}`);
}

function acquireToken({
  backendUrl = 'http://127.0.0.1:8080',
  clientId = 'e5cd7e4891bf95d1d19206ce24a7b32e',
  username = '',
  password = ''
}) {
  const result = spawnSync(process.execPath, [loginScript], {
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

  const loginOutput = [result.stdout, result.stderr]
    .filter(Boolean)
    .map((value) => value.trim())
    .filter(Boolean)
    .join('\n');

  if (result.status !== 0) {
    throw new Error(
      `Failed to acquire admin token from ${backendUrl}. Ensure backend is reachable and can be logged in without captcha for this fast route probe. For real captcha E2E, use infoq-admin-e2e.\n${loginOutput}`
    );
  }

  const tokenLine = loginOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('TOKEN='))
    .at(-1);

  if (!tokenLine) {
    throw new Error(`Login check succeeded without TOKEN output.\n${loginOutput}`);
  }

  const token = tokenLine.replace(/^TOKEN=/, '');
  if (!token) {
    throw new Error(`Parsed token is empty.\n${loginOutput}`);
  }

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
