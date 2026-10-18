import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { canConnect, isProcessAlive } from '../../../tools/lib/skill_runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const options = parseArgs(process.argv.slice(2));
if (options.help) {
  console.log(
    '管理端路由浏览器回归（真实构建产物 + 隔离 HTTP/Provider 替身）\n用法: node skills/test-cli/scripts/test_admin_routing.mjs --artifact-root <目录> [--client react|vue|both] [--output-dir tmp/...]\n产物目录: react-root-dist、react-sub-dist、vue-root-dist、vue-sub-dist；子路径分别 /react/、/vue/。\n不连接真实 backend、DB、Redis 或 Provider，不验证 nginx/TLS。状态、截图和请求类型证据写入 tmp/；失败或中断关闭浏览器和 owned loopback 端口。'
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
  source: 'isolated HTTP/API fixtures; no real authentication or Provider'
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
  const server = http.createServer((req, res) => {
    try {
      req.resume();
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname.startsWith('/prod-api/')) {
        const endpoint = url.pathname.slice('/prod-api'.length);
        counter[endpoint] = (counter[endpoint] || 0) + 1;
        requests.push({
          method: req.method,
          endpoint,
          query: Object.fromEntries([...url.searchParams].filter(([key]) => key === 'redirect'))
        });
        const json = (value) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: 200, msg: 'ok', ...value }));
        };
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
        if (endpoint === '/auth/login' || endpoint === '/auth/oauth/ticket')
          return json({ data: { access_token: 'isolated-fixture-token' } });
        if (endpoint === '/auth/logout' || endpoint === '/resource/sse/close') return json({});
        if (endpoint === '/auth/oauth/github/authorize') {
          const redirect = url.searchParams.get('redirect');
          assert.equal(redirect, `${base}user/profile?name=a%26b#identity`);
          res.writeHead(302, {
            Location: `${base}oauth/callback?${new URLSearchParams({ loginTicket: 'fixture-ticket', redirect })}`
          });
          res.end();
          return;
        }
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
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache'
          });
          res.write(': fixture\n\n');
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
      unexpected.push({ fixtureError: error.message });
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
  return { origin: `http://127.0.0.1:${port}`, counter, requests, unexpected };
}

async function exercise(client, base) {
  const fixture = await createFixture(client, base);
  const errors = [];
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 }
  });
  await restrictNetwork(context, fixture.origin, errors);
  const page = await context.newPage();
  const app = (route) => fixture.origin + base + route;
  const profile = '/user/profile?name=a%26b#identity';
  try {
    await page.goto(app(profile.slice(1)));
    await page.waitForURL((url) => url.pathname === `${base}login`);
    assert.equal(new URL(page.url()).searchParams.get('redirect'), profile);
    await page.getByPlaceholder('用户名', { exact: true }).fill('fixture-admin');
    await page.getByPlaceholder('密码', { exact: true }).fill('Fixture-Only-Password!');
    await page.getByPlaceholder('验证码', { exact: true }).fill('1111');
    await page.getByRole('button', { name: /^登\s*录$/ }).click();
    await page.waitForURL(app(profile.slice(1)));
    await page.getByText('个人信息', { exact: true }).waitFor();
    await page.getByText('fixture-admin', { exact: true }).first().waitFor();
    cases.push({
      client,
      base,
      flow: 'anonymous profile -> password login -> preserved query/hash',
      passed: true
    });
    await page.reload();
    await page.getByText('个人信息', { exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, `${base}user/profile`);
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
    await context.close();

    const oauthContext = await browser.newContext();
    await restrictNetwork(oauthContext, fixture.origin, errors);
    const oauthPage = await oauthContext.newPage();
    await oauthPage.goto(app(`login?redirect=${encodeURIComponent(profile)}`));
    await oauthPage.getByRole('button', { name: /使用 GitHub 登录/ }).click();
    await oauthPage.waitForURL(app(profile.slice(1)));
    await oauthPage.getByText('个人信息', { exact: true }).waitFor();
    cases.push({
      client,
      base,
      flow: 'OAuth authorize HTTP fixture -> ticket -> profile',
      passed: true
    });
    await oauthContext.close();

    const invalidContext = await browser.newContext();
    await restrictNetwork(invalidContext, fixture.origin, errors);
    const invalidPage = await invalidContext.newPage();
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
        await page.content(),
        'utf8'
      );
    } catch (evidenceError) {
      failures.push({
        phase: 'failure-evidence',
        message: evidenceError.message
      });
    }
    throw error;
  } finally {
    try {
      await context.close();
    } catch (error) {
      failures.push({ cleanup: 'context', message: error.message });
    }
    fs.writeFileSync(
      path.join(output, `${client}-${base === '/' ? 'root' : 'sub'}-browser-evidence.json`),
      JSON.stringify(
        {
          errors,
          requests: fixture.requests,
          counter: fixture.counter,
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
    if (options.client === 'both' || options.client === client) artifactDirectory(client, base);
  }
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

async function restrictNetwork(context, origin, errors) {
  await context.route('**/*', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.origin === origin) return route.continue();
    errors.push(`Unexpected external request: ${requestUrl.origin}`);
    return route.abort('blockedbyclient');
  });
  context.on('page', (page) => {
    page.on('pageerror', (error) => errors.push(`pageerror:${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console:${message.text()}`);
    });
  });
}
