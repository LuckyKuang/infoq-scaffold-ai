import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { canConnect, isProcessAlive } from '../../../tools/lib/skill_runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const options = parseArgs(process.argv.slice(2));
if (options.help) {
  console.log(
    '管理端路由与浏览器恢复回归（真实构建产物 + 隔离 HTTP/Provider 替身）\n用法: node skills/test-cli/scripts/test_admin_routing.mjs --artifact-root <目录> [--client react|vue|both] [--output-dir tmp/...]\n产物目录: react-root-dist、react-sub-dist、vue-root-dist、vue-sub-dist；子路径分别 /react/、/vue/。\n校验密码/OAuth、HttpOnly恢复、刷新/退出、存储无秘密与fixture拒绝/隔离；不连接真实backend、DB、Redis或Provider，不验证Spring CSRF、nginx/TLS或真实凭据。HTTP loopback的fixture cookie仅供隔离测试。状态、截图与脱敏请求结果写tmp/；失败/中断关闭浏览器及owned端口。'
  );
  process.exit(0);
}
const artifactRoot = path.resolve(root, options.artifactRoot);
const output = path.resolve(root, options.outputDir);
const tmpRoot = path.join(root, 'tmp');
if (!output.startsWith(tmpRoot + path.sep)) throw new Error('--output-dir 必须位于仓库 tmp/ 子目录');
for (let directory = output; directory !== root; directory = path.dirname(directory)) {
  if (fs.existsSync(directory) && fs.lstatSync(directory).isSymbolicLink()) throw new Error('证据路径禁止符号链接');
}
fs.mkdirSync(output, { recursive: true });
const existingDirectories = [output];
while (existingDirectories.length) {
  for (const entry of fs.readdirSync(existingDirectories.pop(), { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error('证据目录禁止符号链接');
    if (entry.isDirectory()) existingDirectories.push(path.join(entry.parentPath, entry.name));
  }
}
const stateFile = path.join(output, 'browser-state.json');
if (fs.existsSync(stateFile)) {
  const previous = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  if (['starting', 'running'].includes(previous.status) && isProcessAlive(previous.pid))
    throw new Error('该证据目录已有活动 owned runner，请使用独立 --output-dir');
}
const cases = [];
const failures = [];
const run = {
  pid: process.pid,
  port: null,
  log: path.join(output, 'browser-results.json'),
  owned: true,
  status: 'starting',
  browserClosed: false,
  browserTransport: 'pipe',
  runnerSha256: createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex'),
  artifacts: [],
  source: 'real frontend builds with stateful isolated HTTP/API/session fixtures; no real backend, Spring CSRF, Redis, TLS or Provider'
};
const save = () => fs.writeFileSync(stateFile, JSON.stringify(run, null, 2), 'utf8');
save();
let browser;
const servers = [];
let interrupted = false;
let closePromise;
const closeBrowser = () =>
  browser
    ? (closePromise ||= browser.close().then(() => {
        run.browserClosed = true;
      }))
    : Promise.resolve();
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'])
  process.once(signal, () => {
    interrupted = true;
    run.status = 'interrupted';
    run.signal = signal;
    save();
    void closeBrowser().catch((error) => failures.push({ cleanup: 'browser', message: error.message }));
  });
const user = {
  userId: 1001,
  userName: 'fixture-admin',
  nickName: '隔离用户',
  email: 'fixture@example.test',
  phonenumber: '13800138000',
  deptName: '隔离研发',
  sex: '0',
  avatar: '',
  createTime: '2026-10-18 12:00:00'
};
const mime = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.html': 'text/html'
};

function artifactDirectory(client, base) {
  const dist = path.join(artifactRoot, `${client}-${base === '/' ? 'root' : 'sub'}-dist`);
  for (const file of [dist, path.join(dist, 'index.html'), path.join(dist, 'production-build.json')]) {
    const stat = fs.existsSync(file) ? fs.lstatSync(file) : null;
    if (!stat || stat.isSymbolicLink() || (file === dist ? !stat.isDirectory() : !stat.isFile()))
      throw new Error(`缺少常规构建产物: ${path.basename(file)}`);
  }
  const metadata = JSON.parse(fs.readFileSync(path.join(dist, 'production-build.json'), 'utf8'));
  if (metadata.buildMode !== 'production' || metadata.contextPath !== base)
    throw new Error(`${client} 产物 contextPath/buildMode 不匹配`);
  return dist;
}

async function createFixture(client, base) {
  if (interrupted) throw new Error('Routing verification interrupted');
  const dist = artifactDirectory(client, base);
  const counter = {};
  const requests = [];
  const unexpected = [];
  const expectedBrowserErrors = [];
  const issuedSecrets = new Set();
  const sessions = new Map();
  const handles = new Map();
  const csrfTokens = new Map();
  const streams = new Map();
  const restoreFailures = new Map();
  const logoutPauses = new Map();
  const sessionPath = '/prod-api/auth/browser-session';
  const csrfName = (scope) => `InfoQ-FIXTURE-CSRF-${scope}`;
  const sessionName = (scope, clientId) => `InfoQ-FIXTURE-BS-${scope}-${createHash('sha256').update(clientId).digest('hex').slice(0, 16)}`;
  const tokenActive = (token, clientId) => {
    const session = sessions.get(token);
    return session && !session.revoked && session.expiresAt > Date.now() && session.clientId === clientId;
  };
  const redact = (value) => {
    let safe = String(value).replaceAll('Fixture-Only-Password!', '[redacted-password]');
    for (const secret of issuedSecrets) {
      safe = safe.replaceAll(secret, '[redacted-fixture-credential]');
      safe = safe.replaceAll(encodeURIComponent(secret), '[redacted-fixture-credential]');
    }
    return safe.replace(/Bearer(?:%20|\s)+[^\s"'<>]+/giu, 'Bearer [redacted]');
  };
  const revoke = (token) => {
    const session = sessions.get(token);
    if (session) session.revoked = true;
    for (const response of streams.get(token) || []) response.end();
    streams.delete(token);
  };
  const server = http.createServer(async (req, res) => {
    try {
      req.resume();
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname.startsWith('/prod-api/')) {
        const endpoint = url.pathname.slice('/prod-api'.length);
        counter[endpoint] = (counter[endpoint] || 0) + 1;
        const requestRecord = {
          method: req.method,
          endpoint,
          query: Object.fromEntries([...url.searchParams].filter(([key]) => key === 'redirect'))
        };
        requests.push(requestRecord);
        const json = (value, status = 200, extraHeaders = {}) => {
          requestRecord.status = status;
          res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders });
          res.end(JSON.stringify({ code: status, msg: status === 200 ? 'ok' : 'Fixture request rejected', ...value }));
        };
        const clientId = req.headers.clientid || url.searchParams.get('clientid');
        const bearer = req.headers.authorization?.replace(/^Bearer /u, '') || (endpoint === '/resource/sse' ? url.searchParams.get('Authorization')?.replace(/^Bearer /u, '') : undefined);
        if (endpoint === '/auth/browser-session' || endpoint === '/auth/browser-session/csrf') {
          const scope = req.headers['x-infoq-browser-session'];
          requestRecord.scope = scope;
          requestRecord.clientId = clientId;
          const origin = `http://127.0.0.1:${server.address().port}`;
          if (!['react', 'vue'].includes(scope)) return json({}, 403);
          if (typeof req.headers.clientid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/u.test(req.headers.clientid)) return json({}, 400);
          if (req.headers['sec-fetch-site'] === 'cross-site' ||
              (req.headers.origin !== origin && !(req.method === 'GET' && !req.headers.origin && req.headers['sec-fetch-site'] === 'same-origin'))) return json({}, 403);
          const cookies = new Map((req.headers.cookie || '').split(';').map((part) => {
            const index = part.indexOf('=');
            return [part.slice(0, index).trim(), part.slice(index + 1)];
          }));
          const cookie = (name, value, clear = false) => `${name}=${value}; Path=${sessionPath}; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : 1800}`;
          const name = sessionName(scope, clientId);
          if (req.method === 'GET' && endpoint.endsWith('/csrf')) {
            if (req.headers.authorization) return json({}, 400);
            const prior = cookies.get(csrfName(scope));
            const token = csrfTokens.get(prior) === scope ? prior : randomBytes(24).toString('base64url');
            csrfTokens.set(token, scope);
            issuedSecrets.add(token);
            return json({ data: { token, headerName: 'X-XSRF-TOKEN' } }, 200, { 'Set-Cookie': cookie(csrfName(scope), token) });
          }
          if (endpoint.endsWith('/csrf') || !['PUT', 'POST', 'DELETE'].includes(req.method)) return json({}, 405);
          const csrf = cookies.get(csrfName(scope));
          if (!csrf || csrfTokens.get(csrf) !== scope || req.headers['x-xsrf-token'] !== csrf) return json({}, 403);
          const priorHandle = cookies.get(name);
          const prior = handles.get(priorHandle);
          if (req.method === 'PUT') {
            if (!req.headers.authorization?.startsWith('Bearer ') || !tokenActive(bearer, clientId)) return json({}, 401);
            if (prior) {
              handles.delete(priorHandle);
              if (prior.token !== bearer) revoke(prior.token);
            }
            const handle = randomBytes(32).toString('base64url');
            handles.set(handle, { scope, clientId, token: bearer });
            issuedSecrets.add(handle);
            return json({ data: null }, 200, { 'Set-Cookie': cookie(name, handle) });
          }
          if (req.headers.authorization) return json({}, 400);
          if (req.method === 'DELETE') {
            const pause = logoutPauses.get(`${scope}:${clientId}`);
            if (pause) {
              logoutPauses.delete(`${scope}:${clientId}`);
              pause.arrived();
              await pause.gate;
            }
            if (prior && prior.scope === scope && prior.clientId === clientId) {
              revoke(prior.token);
              handles.delete(priorHandle);
            }
            csrfTokens.delete(csrf);
            return json({ data: null }, 200, { 'Set-Cookie': [cookie(name, '', true), cookie(csrfName(scope), '', true)] });
          }
          const failureKey = `${scope}:${clientId}`;
          const restoreFailure = restoreFailures.get(failureKey);
          restoreFailures.delete(failureKey);
          if (restoreFailure !== undefined && restoreFailure !== 401) return json({}, restoreFailure);
          if (restoreFailure === 401 || !prior || prior.scope !== scope || prior.clientId !== clientId || !tokenActive(prior.token, clientId)) {
            if (prior) handles.delete(priorHandle);
            csrfTokens.delete(csrf);
            return json({}, 401, { 'Set-Cookie': [cookie(name, '', true), cookie(csrfName(scope), '', true)] });
          }
          return json({ data: { access_token: prior.token, client_id: clientId, expire_in: Math.floor((sessions.get(prior.token).expiresAt - Date.now()) / 1000) } });
        }
        if (endpoint === '/auth/code')
          return json({
            data: {
              captchaEnabled: true,
              uuid: 'isolated-fixture-captcha',
              img: 'R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
              registerEnabled: false,
              forgotPasswordEnabled: false,
              mailEnabled: false
            }
          });
        if (endpoint === '/auth/oauth/providers')
          return json({
            data: [{ providerCode: 'github', providerName: 'GitHub' }]
          });
        if (endpoint === '/auth/login' || endpoint === '/auth/oauth/ticket') {
          if (typeof clientId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/u.test(clientId)) return json({}, 400);
          const token = `isolated-fixture-${randomBytes(24).toString('base64url')}`;
          sessions.set(token, { clientId, revoked: false, expiresAt: Date.now() + 1800000 });
          issuedSecrets.add(token);
          return json({ data: { access_token: token, client_id: clientId, expire_in: 1800 } });
        }
        if (endpoint === '/auth/oauth/github/authorize') {
          const redirect = url.searchParams.get('redirect');
          assert.equal(redirect, `${base}user/profile?name=a%26b#identity`);
          res.writeHead(302, {
            Location: `${base}oauth/callback?${new URLSearchParams({ loginTicket: 'fixture-ticket', redirect })}`
          });
          res.end();
          return;
        }
        if (!tokenActive(bearer, clientId)) return json({}, 401);
        if (endpoint === '/auth/logout') {
          revoke(bearer);
          return json({});
        }
        if (endpoint === '/resource/sse/close') return json({});
        if (endpoint === '/system/user/profile/oauth/github/bind/authorize') {
          assert.equal(url.searchParams.get('redirect'), `${base}user/profile`);
          return json({
            data: `${base}user/profile?bind=success&provider=github`
          });
        }
        if (endpoint === '/system/user/getInfo')
          return json({
            data: { user, roles: ['admin'], permissions: ['*:*:*'] }
          });
        if (endpoint === '/system/user/profile')
          return json({
            data: { user, roleGroup: '隔离管理员', postGroup: '隔离岗位' }
          });
        if (endpoint === '/system/user/profile/oauth/identities') return json({ data: [] });
        if (endpoint === '/monitor/online') return json({ rows: [], total: 0 });
        if (endpoint === '/system/menu/getRouters')
          return json({
            data: [
              {
                path: '/fixture',
                name: 'Fixture',
                component: 'Layout',
                meta: { title: '隔离菜单' },
                children: [
                  {
                    path: 'profile',
                    name: 'FixtureProfile',
                    component: 'system/user/profile/index',
                    meta: { title: '隔离动态资料' }
                  }
                ]
              }
            ]
          });
        if (endpoint === '/system/message/list') return json({ rows: [], total: 0 });
        if (endpoint === '/system/message/unread-count') return json({ data: 0 });
        if (endpoint.startsWith('/system/dict/data/type/')) return json({ data: [] });
        if (endpoint === '/resource/sse') {
          requestRecord.status = 200;
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache'
          });
          res.write(': fixture\n\n');
          if (!streams.has(bearer)) streams.set(bearer, new Set());
          streams.get(bearer).add(res);
          res.on('close', () => streams.get(bearer)?.delete(res));
          return;
        }
        unexpected.push({ endpoint, method: req.method });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: 500, msg: 'Unconfigured fixture endpoint' }));
        return;
      }
      const relative = url.pathname.startsWith(base) ? url.pathname.slice(base.length) : null;
      if (relative === null) {
        res.writeHead(404);
        res.end('outside application base');
        return;
      }
      let target = path.join(dist, relative);
      if (!target.startsWith(dist + path.sep) && target !== dist) {
        res.writeHead(403);
        res.end();
        return;
      }
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
        if (path.extname(relative)) {
          res.writeHead(404);
          res.end('missing asset');
          return;
        }
        target = path.join(dist, 'index.html');
      }
      if (!fs.realpathSync(target).startsWith(fs.realpathSync(dist) + path.sep)) {
        unexpected.push({ asset: relative, failure: 'outside-artifact' });
        res.writeHead(403);
        res.end('asset outside artifact');
        return;
      }
      res.writeHead(200, {
        'Content-Type': mime[path.extname(target)] || 'application/octet-stream'
      });
      fs.createReadStream(target).pipe(res);
    } catch (error) {
      unexpected.push({ fixtureError: redact(error.message) });
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Fixture assertion failed');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  servers.push({ server, port });
  run.port = port;
  run.status = 'running';
  run.servers = servers.map(({ port }) => ({
    pid: process.pid,
    port,
    log: run.log,
    owned: true,
    status: 'running'
  }));
  save();
  return { origin: `http://127.0.0.1:${port}`, counter, requests, unexpected, expectedBrowserErrors, sessions, restoreFailures, logoutPauses, csrfName, sessionName, sessionPath, redact };
}

async function assertNoStoredCredentials(page, fixture, expectedUsername) {
  const result = await page.evaluate(({ tokens, password, expectedUsername }) => {
    const safe = [localStorage, sessionStorage].every((storage) => Object.entries(storage).every(([key, value]) =>
      key !== 'password' && key !== 'Admin-Token' && !value.includes(password) && tokens.every((token) => !value.includes(token))));
    return { safe, usernameMatches: expectedUsername === undefined || localStorage.getItem('username') === expectedUsername };
  }, { tokens: [...fixture.sessions.keys()], password: 'Fixture-Only-Password!', expectedUsername });
  assert.equal(result.safe, true, 'password and access tokens must never enter application browser storage');
  assert.equal(result.usernameMatches, true, 'only the opted-in username may be remembered');
}

async function getSessionCsrf(context, fixture, scope, clientId) {
  const response = await context.request.get(`${fixture.origin}${fixture.sessionPath}/csrf`, {
    headers: { Origin: fixture.origin, clientid: clientId, 'X-InfoQ-Browser-Session': scope }
  });
  assert.equal(response.status(), 200, 'fixture CSRF bootstrap must succeed');
  const body = await response.json();
  assert.ok(body.code === 200 && typeof body.data?.token === 'string' && body.data.headerName === 'X-XSRF-TOKEN', 'fixture CSRF response contract');
  return body.data.token;
}

async function fixtureSessionCall(context, fixture, { method, scope, clientId, csrf, token, origin = fixture.origin, extraHeaders = {} }) {
  return context.request.fetch(`${fixture.origin}${fixture.sessionPath}`, {
    method,
    headers: { Origin: origin, clientid: clientId, 'X-InfoQ-Browser-Session': scope,
      ...(csrf ? { 'X-XSRF-TOKEN': csrf } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extraHeaders }
  });
}

async function verifySessionRejections(context, fixture, scope, clientId) {
  const csrf = await getSessionCsrf(context, fixture, scope, clientId);
  const queryClient = await context.request.get(`${fixture.origin}${fixture.sessionPath}/csrf?clientid=${encodeURIComponent(clientId)}`, {
    headers: { Origin: fixture.origin, 'X-InfoQ-Browser-Session': scope }
  });
  assert.equal(queryClient.status(), 400, 'query clientId cannot replace the required browser-session header');
  const bearerCsrf = await context.request.get(`${fixture.origin}${fixture.sessionPath}/csrf`, {
    headers: { Origin: fixture.origin, clientid: clientId, 'X-InfoQ-Browser-Session': scope, Authorization: 'Bearer never-issued' }
  });
  assert.equal(bearerCsrf.status(), 400, 'CSRF bootstrap must not attach a Bearer token');
  for (const override of [{ csrf: undefined }, { csrf: 'invalid-csrf' }, { origin: 'https://untrusted.invalid' }, { extraHeaders: { 'Sec-Fetch-Site': 'cross-site' } }]) {
    const response = await fixtureSessionCall(context, fixture, { method: 'POST', scope, clientId, csrf, ...override });
    assert.equal(response.status(), 403, 'missing/wrong CSRF or cross-origin session requests must be rejected');
    const retainedCookies = await context.cookies(`${fixture.origin}${fixture.sessionPath}`);
    assert.ok(retainedCookies.some((cookie) => cookie.name === fixture.csrfName(scope)), '403 must preserve the existing scope CSRF cookie');
  }
  const unbound = await fixtureSessionCall(context, fixture, { method: 'POST', scope, clientId, csrf });
  assert.equal(unbound.status(), 401, 'unbound browser may not restore a session');
  const clearedCookies = await context.cookies(`${fixture.origin}${fixture.sessionPath}`);
  assert.ok(!clearedCookies.some((cookie) => [fixture.csrfName(scope), fixture.sessionName(scope, clientId)].includes(cookie.name)), 'restore 401 must clear recovery and scope CSRF cookies');
  const staleCsrf = await fixtureSessionCall(context, fixture, { method: 'PUT', scope, clientId, csrf, token: 'never-issued' });
  assert.equal(staleCsrf.status(), 403, 'CSRF cached before restore 401 cannot bind after its cookie is cleared');
  const freshCsrf = await getSessionCsrf(context, fixture, scope, clientId);
  assert.ok(freshCsrf !== csrf, 'a new CSRF bootstrap is required after restore 401');
  const noBearer = await fixtureSessionCall(context, fixture, { method: 'PUT', scope, clientId, csrf: freshCsrf });
  assert.equal(noBearer.status(), 401, 'cookie cannot replace the explicit bind Bearer token');
  const invalidBearer = await fixtureSessionCall(context, fixture, { method: 'PUT', scope, clientId, csrf: freshCsrf, token: 'never-issued' });
  assert.equal(invalidBearer.status(), 401, 'unknown tokens cannot bind a browser session');
}

async function bindFixturePeer(context, fixture, scope, clientId) {
  const login = await context.request.post(`${fixture.origin}/prod-api/auth/login`, { headers: { clientid: clientId }, data: { fixture: true } });
  assert.equal(login.status(), 200);
  const token = (await login.json()).data.access_token;
  const csrf = await getSessionCsrf(context, fixture, scope, clientId);
  const bound = await fixtureSessionCall(context, fixture, { method: 'PUT', scope, clientId, csrf, token });
  assert.equal(bound.status(), 200, 'separate fixture identity must bind');
  const restored = await fixtureSessionCall(context, fixture, { method: 'POST', scope, clientId, csrf });
  assert.equal(restored.status(), 200);
  assert.ok((await restored.json()).data.access_token === token, 'restore must return this scope/client identity');
  return { scope, clientId, csrf, token };
}

async function exercise(client, base) {
  const fixture = await createFixture(client, base);
  const errors = [];
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 }
  });
  const ownedContexts = [context];
  await restrictNetwork(context, fixture.origin, errors, fixture);
  await context.addInitScript((origin) => {
    if (window.location.origin !== origin) return;
    if (sessionStorage.getItem('fixture-initialized')) return;
    localStorage.setItem('Admin-Token', 'legacy-untrusted-storage-value');
    localStorage.setItem('password', 'legacy-stored-password');
    sessionStorage.setItem('fixture-initialized', 'true');
  }, fixture.origin);
  const page = await context.newPage();
  let evidencePage = page;
  const app = (route) => fixture.origin + base + route;
  const profile = '/user/profile?name=a%26b#identity';
  try {
    await page.goto(app(profile.slice(1)));
    await page.waitForURL((url) => url.pathname === `${base}login`);
    assert.equal(new URL(page.url()).searchParams.get('redirect'), profile);
    await page.getByPlaceholder('用户名', { exact: true }).waitFor();
    await page.waitForFunction(() => [localStorage, sessionStorage].every((storage) =>
      storage.getItem('password') === null && storage.getItem('Admin-Token') === null));
    await assertNoStoredCredentials(page, fixture);
    const anonymousRestoreIndex = fixture.requests.findIndex((request) => request.endpoint === '/auth/browser-session' && request.method === 'POST' && request.scope === client && request.status === 401);
    assert.ok(anonymousRestoreIndex > 0, 'protected anonymous entry must attempt recovery before redirecting to login');
    const anonymousRestore = fixture.requests[anonymousRestoreIndex];
    assert.equal(fixture.requests.slice(0, anonymousRestoreIndex).filter((request) => request.endpoint === '/auth/browser-session/csrf' && request.scope === client && request.status === 200).length, 1, 'anonymous bootstrap requires exactly one CSRF GET before restore');
    const anonymousCookies = await context.cookies(`${fixture.origin}${fixture.sessionPath}`);
    assert.ok(!anonymousCookies.some((cookie) => [fixture.csrfName(client), fixture.sessionName(client, anonymousRestore.clientId)].includes(cookie.name)), 'anonymous restore 401 must clear recovery and scope CSRF cookies before the first login');
    await page.getByPlaceholder('用户名', { exact: true }).fill('fixture-admin');
    await page.getByPlaceholder('密码', { exact: true }).fill('Fixture-Only-Password!');
    await page.getByPlaceholder('验证码', { exact: true }).fill('1111');
    const rememberUsername = page.getByRole('checkbox', { name: '记住用户名' });
    if (!(await rememberUsername.isChecked())) await page.getByText('记住用户名', { exact: true }).click();
    assert.equal(await rememberUsername.isChecked(), true, 'visible remember-username control must select the checkbox');
    await page.getByRole('button', { name: /^登\s*录$/ }).click();
    await page.waitForURL(app(profile.slice(1)));
    await page.getByText('个人信息', { exact: true }).waitFor();
    await page.getByText('fixture-admin', { exact: true }).first().waitFor();
    const clientId = fixture.requests.find((request) => request.endpoint === '/auth/browser-session' && request.method === 'PUT' && request.scope === client)?.clientId;
    assert.ok(clientId, 'login must explicitly bind the frontend client identity');
    assert.equal(clientId, anonymousRestore.clientId, 'same-tab login must preserve the frontend client identity');
    assert.equal(fixture.counter['/auth/login'], 1, 'the first same-tab password login attempt must succeed');
    const bindIndex = fixture.requests.findIndex((request) => request.endpoint === '/auth/browser-session' && request.method === 'PUT' && request.scope === client);
    assert.equal(fixture.requests[bindIndex].status, 200, 'the first password session binding must succeed');
    assert.equal(fixture.requests.slice(anonymousRestoreIndex + 1, bindIndex).filter((request) => request.endpoint === '/auth/browser-session/csrf' && request.scope === client && request.status === 200).length, 1, 'same-tab login must bootstrap fresh CSRF after restore 401 cleared the cookie');
    const primaryToken = [...fixture.sessions.keys()].at(-1);
    const cookies = await context.cookies(`${fixture.origin}${fixture.sessionPath}`);
    const recovery = cookies.find((cookie) => cookie.name === fixture.sessionName(client, clientId));
    const csrfCookie = cookies.find((cookie) => cookie.name === fixture.csrfName(client));
    assert.ok(recovery?.httpOnly && csrfCookie?.httpOnly, 'recovery and CSRF cookies must both be HttpOnly');
    assert.ok([recovery, csrfCookie].every((cookie) => cookie.path === fixture.sessionPath && cookie.sameSite === 'Strict'), 'fixture cookies must have the narrow API path and Strict SameSite');
    assert.equal(await page.evaluate(() => document.cookie.includes('InfoQ-FIXTURE')), false, 'session cookies must not be script-visible');
    await assertNoStoredCredentials(page, fixture, 'fixture-admin');
    cases.push({
      client,
      base,
      flow: 'anonymous profile -> password login -> preserved query/hash',
      passed: true
    });
    cases.push({ client, base, flow: 'protected anonymous entry clears CSRF on restore 401, then first same-tab password login binds with fresh CSRF', passed: true });
    const restoreCount = () => fixture.requests.filter((request) => request.endpoint === '/auth/browser-session' && request.method === 'POST' && request.scope === client && request.clientId === clientId).length;
    const beforeRefresh = restoreCount();
    await page.reload();
    await page.getByText('个人信息', { exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, `${base}user/profile`);
    assert.equal(restoreCount(), beforeRefresh + 1, 'one reload must perform exactly one guarded restore');
    await assertNoStoredCredentials(page, fixture, 'fixture-admin');
    cases.push({
      client,
      base,
      flow: 'authenticated profile refresh',
      passed: true
    });
    await page.getByRole('tab', { name: '账号关联' }).click();
    await page.getByRole('button', { name: '绑定第三方账号' }).click();
    if (client === 'react') {
      await page.getByRole('dialog').getByRole('combobox').click();
      await page.getByText('GitHub', { exact: true }).last().click();
      await page
        .getByRole('dialog')
        .getByRole('button', { name: /^(OK|确\s*定)$/ })
        .click();
    } else {
      await page.getByRole('dialog', { name: '绑定第三方账号' }).locator('.el-select__wrapper').click();
      await page.getByRole('option', { name: 'GitHub' }).click();
      await page.getByRole('button', { name: '继续授权' }).click();
    }
    await page.waitForURL(
      (url) => url.pathname === `${base}user/profile` && url.searchParams.get('bind') === 'success'
    );
    await page.getByText('个人信息', { exact: true }).waitFor();
    cases.push({
      client,
      base,
      flow: 'binding request contains relative deployment path and returns to profile',
      passed: true
    });
    await page.goto(app('fixture/profile'));
    await page.getByText('个人信息', { exact: true }).waitFor();
    await page.reload();
    await page.getByText('个人信息', { exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, `${base}fixture/profile`);
    cases.push({
      client,
      base,
      flow: 'API-defined dynamic page direct access and refresh',
      passed: true
    });
    await page.screenshot({
      path: path.join(output, `${client}-${base === '/' ? 'root' : 'sub'}-profile.png`)
    });
    const beforeFailedRestoreInfo = fixture.counter['/system/user/getInfo'];
    fixture.restoreFailures.set(`${client}:${clientId}`, 503);
    await page.reload();
    await page.getByText(/浏览器会话.*503/).first().waitFor();
    assert.equal(fixture.counter['/system/user/getInfo'], beforeFailedRestoreInfo, 'dependency failure must stop authenticated bootstrap');
    assert.equal(new URL(page.url()).pathname, `${base}fixture/profile`, 'dependency failure must remain visible instead of becoming anonymous login');
    await assertNoStoredCredentials(page, fixture, 'fixture-admin');
    await page.reload();
    await page.getByText('个人信息', { exact: true }).waitFor();
    cases.push({ client, base, flow: 'restore dependency failure is visible, stops bootstrap and requires explicit reload to retry', passed: true });
    const cookieOnly = await context.request.get(`${fixture.origin}/prod-api/system/user/getInfo`, { headers: { clientid: clientId } });
    assert.equal(cookieOnly.status(), 401, 'business API cannot authenticate with only a recovery cookie');
    const peerScope = client === 'react' ? 'vue' : 'react';
    const peer = await bindFixturePeer(context, fixture, peerScope, clientId);
    const alternate = await bindFixturePeer(context, fixture, client, 'fixture-other-client');
    const wrongClient = await fixtureSessionCall(context, fixture, { method: 'PUT', scope: client, clientId: 'fixture-other-client', csrf: alternate.csrf, token: primaryToken });
    assert.equal(wrongClient.status(), 401, 'token clientId mismatch cannot replace a peer binding');
    cases.push({ client, base, flow: 'HttpOnly narrow cookies, no password/token storage, cookie-only business API refused', passed: true });

    let releaseLogout;
    let observeLogout;
    let logoutTimer;
    const logoutGate = new Promise((resolve) => { releaseLogout = resolve; });
    const logoutArrived = new Promise((resolve) => { observeLogout = resolve; });
    fixture.logoutPauses.set(`${client}:${clientId}`, { arrived: observeLogout, gate: logoutGate });
    try {
      await page.locator('.avatar-wrapper').click();
      await page.getByText('退出登录', { exact: true }).click();
      if (client === 'vue') await page.getByRole('button', { name: '确定', exact: true }).click();
      await Promise.race([logoutArrived, new Promise((_, reject) => {
        logoutTimer = setTimeout(() => reject(new Error('UI logout did not reach the fixture revocation resource')), 15000);
      })]);
      await page.locator('.avatar-wrapper').waitFor({ state: 'detached' });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(new URL(page.url()).pathname, `${base}fixture/profile`, 'logout must not expose the login page before server revocation completes');
      assert.equal(await page.getByPlaceholder('用户名', { exact: true }).isVisible(), false, 'login form must wait for the pending logout response');
    } finally {
      clearTimeout(logoutTimer);
      fixture.logoutPauses.delete(`${client}:${clientId}`);
      releaseLogout();
    }
    await page.waitForURL((url) => url.pathname === `${base}login`);
    await page.reload();
    await page.getByPlaceholder('用户名', { exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, `${base}login`);
    assert.equal(await page.getByPlaceholder('用户名', { exact: true }).inputValue(), 'fixture-admin');
    assert.equal(await page.getByPlaceholder('密码', { exact: true }).inputValue(), '');
    await assertNoStoredCredentials(page, fixture, 'fixture-admin');
    const clearedCookies = await context.cookies(`${fixture.origin}${fixture.sessionPath}`);
    assert.ok(!clearedCookies.some((cookie) => cookie.name === fixture.sessionName(client, clientId)), 'logout must clear this recovery cookie');
    const revokedBusiness = await context.request.get(`${fixture.origin}/prod-api/system/user/getInfo`, { headers: { clientid: clientId, Authorization: `Bearer ${primaryToken}` } });
    assert.equal(revokedBusiness.status(), 401, 'logout must revoke the bound token');
    cases.push({ client, base, flow: 'UI logout revokes own identity; reload remains anonymous and remembers username only', passed: true });

    for (const identity of [peer, alternate]) {
      const csrf = await getSessionCsrf(context, fixture, identity.scope, identity.clientId);
      const response = await fixtureSessionCall(context, fixture, { method: 'POST', scope: identity.scope, clientId: identity.clientId, csrf });
      assert.equal(response.status(), 200, 'logout must preserve a different scope or client binding');
      assert.ok((await response.json()).data.access_token === identity.token, 'scope/client restores only the bound identity');
    }
    const revoked = await context.request.post(`${fixture.origin}/prod-api/auth/logout`, { headers: { clientid: peer.clientId, Authorization: `Bearer ${peer.token}` } });
    assert.equal(revoked.status(), 200);
    const revokedCsrf = await getSessionCsrf(context, fixture, peer.scope, peer.clientId);
    const revokedRestore = await fixtureSessionCall(context, fixture, { method: 'POST', scope: peer.scope, clientId: peer.clientId, csrf: revokedCsrf });
    assert.equal(revokedRestore.status(), 401, 'revoked underlying session must not restore');
    fixture.sessions.get(alternate.token).expiresAt = Date.now() - 1;
    const expiredCsrf = await getSessionCsrf(context, fixture, alternate.scope, alternate.clientId);
    const expiredRestore = await fixtureSessionCall(context, fixture, { method: 'POST', scope: alternate.scope, clientId: alternate.clientId, csrf: expiredCsrf });
    assert.equal(expiredRestore.status(), 401, 'expired underlying session must not restore');
    cases.push({ client, base, flow: 'scope/client cookie isolation, explicit revocation and expiry rejection in HTTP fixture', passed: true });
    await context.close();

    const oauthContext = await browser.newContext();
    ownedContexts.push(oauthContext);
    await restrictNetwork(oauthContext, fixture.origin, errors, fixture);
    const oauthPage = await oauthContext.newPage();
    evidencePage = oauthPage;
    await oauthPage.goto(app(`login?redirect=${encodeURIComponent(profile)}`));
    await oauthPage.getByRole('button', { name: /使用 GitHub 登录/ }).click();
    await oauthPage.waitForURL(app(profile.slice(1)));
    await oauthPage.getByText('个人信息', { exact: true }).waitFor();
    await assertNoStoredCredentials(oauthPage, fixture);
    await oauthPage.reload();
    await oauthPage.getByText('个人信息', { exact: true }).waitFor();
    await assertNoStoredCredentials(oauthPage, fixture);
    cases.push({
      client,
      base,
      flow: 'OAuth authorize HTTP fixture -> ticket -> profile',
      passed: true
    });
    await oauthContext.close();

    const invalidContext = await browser.newContext();
    ownedContexts.push(invalidContext);
    await restrictNetwork(invalidContext, fixture.origin, errors, fixture);
    await verifySessionRejections(invalidContext, fixture, client, clientId);
    cases.push({ client, base, flow: 'unbound and forged Bearer refused; missing/wrong CSRF and cross-Origin requests rejected by fixture', passed: true });
    const invalidPage = await invalidContext.newPage();
    evidencePage = invalidPage;
    const beforeLogin = fixture.counter['/auth/login'] || 0;
    const beforeTicket = fixture.counter['/auth/oauth/ticket'] || 0;
    const beforeAuthorize = fixture.counter['/auth/oauth/github/authorize'] || 0;
    const invalid = '/%252fevil.test';
    await invalidPage.goto(app(`login?redirect=${encodeURIComponent(invalid)}`));
    await invalidPage.getByPlaceholder('用户名', { exact: true }).fill('fixture-admin');
    await invalidPage.getByPlaceholder('密码', { exact: true }).fill('Fixture-Only-Password!');
    await invalidPage.getByPlaceholder('验证码', { exact: true }).fill('1111');
    await invalidPage.getByRole('button', { name: /^登\s*录$/ }).click();
    await invalidPage.getByText('登录回跳地址无效，请从站内页面重新进入', { exact: true }).waitFor();
    await invalidPage.getByRole('button', { name: /使用 GitHub 登录/ }).click();
    assert.equal(fixture.counter['/auth/login'] || 0, beforeLogin);
    assert.equal(fixture.counter['/auth/oauth/github/authorize'] || 0, beforeAuthorize);
    for (const invalidCallback of [invalid, '/a%3F/%2e%2e/%2e%2e/outside']) {
      await invalidPage.goto(app(`oauth/callback?loginTicket=unused&redirect=${encodeURIComponent(invalidCallback)}`));
      await invalidPage.getByText('登录回跳地址无效，请从站内页面重新进入', { exact: true }).waitFor();
      assert.equal(fixture.counter['/auth/oauth/ticket'] || 0, beforeTicket);
    }
    cases.push({
      client,
      base,
      flow: 'invalid redirect refuses login, authorization and ticket exchange',
      passed: true
    });
    await invalidContext.close();
    assert.deepEqual(fixture.unexpected, [], 'unexpected fixture API');
    assert.deepEqual(errors, [], 'browser console/pageerror');
  } catch (error) {
    try {
      fs.writeFileSync(
        path.join(output, `${client}-${base === '/' ? 'root' : 'sub'}-failure.html`),
        fixture.redact(await evidencePage.evaluate(() => {
          const clone = document.documentElement.cloneNode(true);
          clone.querySelectorAll('input').forEach((input) => input.removeAttribute('value'));
          return clone.outerHTML;
        })),
        'utf8'
      );
    } catch (evidenceError) {
      failures.push({
        phase: 'failure-evidence',
        message: evidenceError.message
      });
    }
    throw new Error(fixture.redact(error.message));
  } finally {
    for (const owned of ownedContexts) {
      try {
        await owned.close();
      } catch (error) {
        failures.push({ cleanup: 'context', message: fixture.redact(error.message) });
      }
    }
    fs.writeFileSync(
      path.join(output, `${client}-${base === '/' ? 'root' : 'sub'}-browser-evidence.json`),
      JSON.stringify(
        {
          errors,
          requests: fixture.requests,
          counter: fixture.counter,
          expectedBrowserErrors: fixture.expectedBrowserErrors,
          unexpected: fixture.unexpected
        },
        null,
        2
      ),
      'utf8'
    );
  }
}

try {
  // 完整只读预检先于浏览器或 HTTP 服务启动。
  for (const [client, base] of [
    ['react', '/'],
    ['react', '/react/'],
    ['vue', '/'],
    ['vue', '/vue/']
  ]) {
    if (options.client !== 'both' && options.client !== client) continue;
    const dist = artifactDirectory(client, base);
    const entries = fs.readdirSync(dist, { recursive: true, withFileTypes: true });
    if (entries.some((entry) => !entry.isFile() && !entry.isDirectory())) throw new Error('构建产物禁止符号链接或非常规文件');
    const files = entries.filter((entry) => entry.isFile()).map((entry) =>
      path.relative(dist, path.join(entry.parentPath, entry.name)).split(path.sep).join('/')).sort();
    const fingerprint = createHash('sha256');
    for (const file of files) fingerprint.update(`${file}\0${createHash('sha256').update(fs.readFileSync(path.join(dist, file))).digest('hex')}\n`);
    run.artifacts.push({ client, base, directory: path.relative(root, dist).split(path.sep).join('/'), files: files.length, sha256: fingerprint.digest('hex') });
  }
  save();
  browser = await chromium.launch({
    headless: true,
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false
  });
  if (interrupted) {
    await closeBrowser();
    throw new Error('Routing verification interrupted');
  }
  for (const [client, base] of [
    ['react', '/'],
    ['react', '/react/'],
    ['vue', '/'],
    ['vue', '/vue/']
  ]) {
    if (options.client !== 'both' && options.client !== client) continue;
    try {
      await exercise(client, base);
      console.log(`${client} ${base}: passed`);
    } catch (error) {
      failures.push({ client, base, message: error.message });
      console.error(`${client} ${base}: ${error.message}`);
      break;
    }
  }
} catch (error) {
  failures.push({ message: error.message });
} finally {
  try {
    await closeBrowser();
    if (!browser) run.browserClosed = true;
  } catch (error) {
    failures.push({ cleanup: 'browser', message: error.message });
  }
  let portsClosed = true;
  for (const { server, port } of servers) {
    try {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      assert.equal(await canConnect('127.0.0.1', port, 100), false);
    } catch (error) {
      portsClosed = false;
      failures.push({ cleanup: 'server', port, message: error.message });
    }
  }
  run.status = interrupted ? 'interrupted' : failures.length ? 'failed' : 'passed';
  run.portsClosed = portsClosed;
  run.finishedAt = new Date().toISOString();
  if (run.servers)
    run.servers = run.servers.map((server) => ({
      ...server,
      status: portsClosed ? 'stopped' : 'failed'
    }));
  save();
  fs.writeFileSync(
    path.join(output, 'browser-results.json'),
    JSON.stringify({ cases, failures, state: run }, null, 2),
    'utf8'
  );
  process.exitCode = interrupted ? 130 : failures.length ? 1 : 0;
}

function parseArgs(args) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) return { help: true };
  const parsed = { client: 'both', outputDir: 'tmp/test-cli/e2e/routing' };
  const keys = new Map([
    ['--artifact-root', 'artifactRoot'],
    ['--client', 'client'],
    ['--output-dir', 'outputDir']
  ]);
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (!keys.has(flag) || seen.has(flag) || !args[i + 1] || args[i + 1].startsWith('--'))
      throw new Error('未知/重复参数或缺少参数值；使用 --help');
    seen.add(flag);
    parsed[keys.get(flag)] = args[++i];
  }
  if (!parsed.artifactRoot || !['react', 'vue', 'both'].includes(parsed.client))
    throw new Error('必须提供 --artifact-root，--client 只接受 react|vue|both');
  return parsed;
}

async function restrictNetwork(context, origin, errors, fixture) {
  await context.route('**/*', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.origin === origin) return route.continue();
    errors.push(`Unexpected external request: ${requestUrl.origin}`);
    return route.abort('blockedbyclient');
  });
  context.on('page', (page) => {
    page.on('pageerror', (error) => errors.push(`pageerror:${fixture.redact(error.message)}`));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const status = message.text().match(/^Failed to load resource: the server responded with a status of (401|403|503) \(/u);
      if (status && message.location().url === `${origin}${fixture.sessionPath}` &&
          fixture.requests.some((request) => request.endpoint === '/auth/browser-session' && request.status === Number(status[1]))) {
        fixture.expectedBrowserErrors.push({ endpoint: '/auth/browser-session', status: Number(status[1]) });
        return;
      }
      errors.push(`console:${fixture.redact(message.text())}`);
    });
  });
}
