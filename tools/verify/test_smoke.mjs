import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {once} from 'node:events';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {parseSmokeAuthenticationOutput} from './smoke_output.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
const password = 'fixture-password-must-not-be-logged';
const token = `header.${Buffer.from('{"userId":"123"}').toString('base64url')}.fixture-secret-token`;

async function runScript(script, args = [], env = {}, nodeArgs = []) {
  const child = spawn(process.execPath, [...nodeArgs, path.join(scriptDir, script), ...args], {
    cwd: repoRoot,
    env: {...process.env, ...env},
    timeout: 5000,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const [code] = await once(child, 'close');
  return {code, output};
}

for (const mode of ['encrypted', 'plain']) {
  for (const acceptsLogin of [true, false]) {
    test(`${mode} login ${acceptsLogin ? 'succeeds' : 'fails without a protocol fallback or secret log'}`, async (t) => {
      const loginRequests = [];
      const server = http.createServer(async (req, res) => {
        let body = '';
        for await (const chunk of req) body += chunk;
        if (req.url === '/') return res.end('backend fixture');
        if (req.url === '/auth/login') {
          loginRequests.push({headers: req.headers, body});
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify(acceptsLogin
            ? {code: 200, data: {accessToken: token}}
            : {code: 403, msg: `sensitive upstream detail ${password} ${token}`}));
        }
        if (req.url === '/system/user/export') {
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          return res.end('fixture workbook');
        }
        res.setHeader('Content-Type', 'application/json');
        res.end('{"code":200,"data":[]}');
      });
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
      const result = await runScript('smoke_checks.mjs', [], {
        BASE_URL: `http://127.0.0.1:${server.address().port}`,
        USERNAME: 'fixture-user', PASSWORD: password, LOGIN_CANDIDATES: 'none',
        LOGIN_MODE: mode, PRINT_TOKEN: '0', PRINT_USER_ID: '0'
      });
      assert.equal(result.code, acceptsLogin ? 0 : 1, result.output);
      assert.equal(loginRequests.length, 1, 'each account must use only the explicitly selected protocol');
      assert.equal(Boolean(loginRequests[0].headers['encrypt-key']), mode === 'encrypted');
      if (mode === 'plain') assert.equal(JSON.parse(loginRequests[0].body).password, password);
      else assert.throws(() => JSON.parse(loginRequests[0].body));
      assert.ok(!result.output.includes(password), result.output);
      assert.ok(!result.output.includes(token), result.output);
    });
  }
}

test('invalid login modes fail before config resolution or server startup', async () => {
  for (const script of ['smoke_checks.mjs', 'run_smoke.mjs', 'run_cluster_smoke.mjs']) {
    const args = script === 'smoke_checks.mjs' ? [] : ['--login-mode', 'unknown'];
    const result = await runScript(script, args, {LOGIN_MODE: 'unknown'});
    assert.equal(result.code, 1);
    assert.match(result.output, /must be encrypted or plain/);
  }
});

test('cluster consumes private auth fields without including them in public output', () => {
  const result = parseSmokeAuthenticationOutput(`[PASS] login\r\nTOKEN=${token}\r\nUSER_ID=123\r\n[PASS] done\r\n`);
  assert.equal(result.token, token);
  assert.equal(result.userId, '123');
  assert.equal(result.publicOutput, '[PASS] login\n[PASS] done\n');
  for (const invalid of [`TOKEN=${token}`, `TOKEN=\nUSER_ID=123`, `TOKEN=${token}\nTOKEN=other\nUSER_ID=123`]) {
    assert.throws(() => parseSmokeAuthenticationOutput(invalid), (error) => {
      assert.ok(!error.message.includes(token));
      return /expected one nonempty TOKEN and USER_ID/.test(error.message);
    });
  }
});

test('coverage scan help does not run the scan and rejects unknown options', async () => {
  const help = await runScript('scan_missing_tests.mjs', ['--help']);
  assert.equal(help.code, 0);
  assert.match(help.output, /Usage:/);
  assert.doesNotMatch(help.output, /missing=/);
  const invalid = await runScript('scan_missing_tests.mjs', ['--unknown']);
  assert.equal(invalid.code, 1);
});

test('runner help and argument failures return before starting a backend', async () => {
  for (const script of ['run_smoke.mjs', 'run_cluster_smoke.mjs']) {
    const help = await runScript(script, ['--help']);
    assert.equal(help.code, 0, help.output);
    assert.match(help.output, /--login-mode/);
    assert.doesNotMatch(help.output, /starting server|starting node|building backend/);
    if (script === 'run_cluster_smoke.mjs') {
      assert.match(help.output, /Python verifier Redis/);
      assert.match(help.output, /does not configure Java/);
    }
    for (const args of [['--unknown'], ['--login-mode']]) {
      const result = await runScript(script, args);
      assert.equal(result.code, 1, result.output);
      assert.match(result.output, /Unknown option|Missing value/);
      assert.doesNotMatch(result.output, /starting server|starting node|building backend/);
    }
  }
});

test('API error bodies and malformed business codes never enter public diagnostics', async (t) => {
  let failedPath = '';
  let failedBody = '';
  const server = http.createServer(async (req, res) => {
    for await (const chunk of req) { /* Consume the request before replying. */ }
    if (req.url === failedPath) return res.end(failedBody);
    if (req.url === '/') return res.end('backend fixture');
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/auth/login') return res.end(JSON.stringify({code: 200, data: {accessToken: token}}));
    res.end('{"code":200,"data":[]}');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  for (const endpoint of ['/auth/code', '/auth/login', '/system/menu/getRouters']) {
    for (const body of [JSON.stringify({code: 403, msg: `${password} ${token}`}),
      JSON.stringify({code: `${password} ${token}`}), `${password} ${token}`, 'null']) {
      failedPath = endpoint;
      failedBody = body;
      const result = await runScript('smoke_checks.mjs', [], {
        BASE_URL: `http://127.0.0.1:${server.address().port}`,
        USERNAME: 'fixture-user', PASSWORD: password, LOGIN_CANDIDATES: 'none',
        LOGIN_MODE: 'plain', PRINT_TOKEN: '0', PRINT_USER_ID: '0'
      });
      assert.equal(result.code, 1, result.output);
      assert.match(result.output, /\[FAIL\]/, result.output);
      assert.ok(result.output.includes(endpoint), result.output);
      assert.ok(!result.output.includes(password), result.output);
      assert.ok(!result.output.includes(token), result.output);
      assert.match(result.output, /code=(403|invalid-response)/);
    }
  }
});

test('unsafe bind, port and node identifiers fail before configuration or process access', async () => {
  for (const script of ['run_smoke.mjs', 'run_cluster_smoke.mjs']) {
    const portFlag = script === 'run_smoke.mjs' ? '--port' : '--port-a';
    const prefix = script === 'run_smoke.mjs' ? 'SMOKE' : 'CLUSTER_SMOKE';
    const cases = [['--host', '0.0.0.0'], ['--host', 'example.com'], ['--host', '127.0.0.1/path'],
      ['--host', '-h'], ...['0', '65536', '-1', '1.2', '018080', '../../outside', 'abc'].map((port) => [portFlag, port])];
    if (script === 'run_cluster_smoke.mjs') {
      cases.push(['--port-a', '19081', '--port-b', '19081'],
        ['--port-b', '65536'], ['--node-id-a', '../../outside'], ['--node-id-b', 'bad/name'],
        ['--node-id-a', '.'], ['--node-id-b', 'a'.repeat(65)],
        ['--node-id-a', 'same', '--node-id-b', 'SAME']);
    }
    for (const args of cases) {
      const result = await runScript(script, args);
      assert.equal(result.code, 1, result.output);
      assert.match(result.output, /must be|Missing value/);
      assert.doesNotMatch(result.output, /starting server|starting node|building backend|cleaning recorded/);
    }
    const result = await runScript(script, [], {[`${prefix}_HOST`]: '0.0.0.0'});
    assert.equal(result.code, 1);
    assert.match(result.output, /must stay on loopback/);
  }
});

test('hung HTTP headers and response bodies fail within the configured request deadline', async (t) => {
  let failedPath = '';
  let hangBody = false;
  const server = http.createServer(async (req, res) => {
    for await (const chunk of req) { /* Consume the request before replying. */ }
    if (req.url === failedPath) {
      if (hangBody) {
        res.writeHead(200, {'Content-Type': failedPath.endsWith('/export')
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/json'});
        res.write(password);
      }
      return;
    }
    if (req.url === '/') return res.end('backend fixture');
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/auth/login') return res.end(JSON.stringify({code: 200, data: {accessToken: token}}));
    res.end('{"code":200,"data":[]}');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  for (const endpoint of ['/auth/code', '/auth/login', '/system/menu/getRouters', '/system/user/export']) {
    for (const body of [false, true]) {
      failedPath = endpoint;
      hangBody = body;
      const started = Date.now();
      const result = await runScript('smoke_checks.mjs', [], {
        BASE_URL: `http://127.0.0.1:${server.address().port}`,
        USERNAME: 'fixture-user', PASSWORD: password, LOGIN_CANDIDATES: 'none',
        LOGIN_MODE: 'plain', PRINT_TOKEN: '0', PRINT_USER_ID: '0', HTTP_TIMEOUT_MS: '200'
      });
      assert.equal(result.code, 1, result.output);
      assert.match(result.output, /network=timeout, timeout_ms=200/);
      assert.ok(result.output.includes(endpoint), result.output);
      assert.ok(!result.output.includes(password), result.output);
      assert.ok(!result.output.includes(token), result.output);
      assert.ok(Date.now() - started < 5000, 'request deadline must close a hung connection');
    }
  }
});

test('invalid HTTP deadlines fail before network, configuration or backend startup', async () => {
  for (const [script, key] of [['smoke_checks.mjs', 'HTTP_TIMEOUT_MS'],
    ['run_smoke.mjs', 'SMOKE_HTTP_TIMEOUT_MS'], ['run_cluster_smoke.mjs', 'CLUSTER_SMOKE_HTTP_TIMEOUT_MS']]) {
    for (const value of ['0', '-1', '1.5', '60001', 'abc']) {
      const result = await runScript(script, [], {[key]: value});
      assert.equal(result.code, 1, result.output);
      assert.match(result.output, /HTTP_TIMEOUT_MS must be an integer/);
      assert.doesNotMatch(result.output, /smoke target|starting server|starting node|building backend|cleaning recorded/);
    }
  }
});

test('cluster Redis bounds connect/read waits and preserves timeout failure', async () => {
  const python = (process.platform === 'win32' ? ['python', 'python3'] : ['python3', 'python'])
    .find((command) => spawnSync(command, ['--version'], {stdio: 'ignore'}).status === 0);
  assert.ok(python, 'Python 3 is required for the cluster helper isolation regression');
  const source = `
import runpy, sys, types
def fake_redis(**kwargs):
    assert kwargs['socket_connect_timeout'] == 5
    assert kwargs['socket_timeout'] == 5
    print('REDIS_TIMEOUTS=5,5')
    raise TimeoutError('fixture Redis socket timeout')
sys.modules['redis'] = types.SimpleNamespace(Redis=fake_redis)
sys.modules['websockets'] = types.SimpleNamespace()
sys.argv = ['websocket_cluster_smoke.py', '--server-b-pid', '424242']
runpy.run_path('tools/verify/websocket_cluster_smoke.py', run_name='__main__')
`;
  const result = spawnSync(python, ['-c', source], {
    cwd: repoRoot, encoding: 'utf8', timeout: 5000, env: {...process.env,
      CLUSTER_SMOKE_TOKEN: token, CLUSTER_SMOKE_USER_ID: '123', CLUSTER_SMOKE_CLIENT_ID: 'fixture',
      CLUSTER_SMOKE_REDIS_HOST: '127.0.0.1', CLUSTER_SMOKE_REDIS_PORT: '6379',
      CLUSTER_SMOKE_REDIS_DB: '0', CLUSTER_SMOKE_REDIS_PASSWORD: password}
  });
  const output = result.stdout + result.stderr;
  assert.equal(result.status, 1, output);
  assert.match(output, /REDIS_TIMEOUTS=5,5/);
  assert.match(output, /\[FAIL\] fixture Redis socket timeout/);
  assert.ok(!output.includes(password), output);
  assert.ok(!output.includes(token), output);
});

// Replace only external runtime/config boundaries; execute the real runner orchestration.
const runtimeFixtureSource = `
import path from 'node:path';
import {EventEmitter} from 'node:events';
const emit = (event) => console.log('RUNTIME_FIXTURE=' + JSON.stringify(event));
export const resolveRepoRoot = () => process.cwd();
export const normalizeForwardedArgs = (args) => args[0] === '--' ? args.slice(1) : args;
export const resolveTmpPath = (root, ...parts) => path.join(root, 'tmp', ...parts);
export const readJsonFile = () => null;
export const canConnect = async (host, port) => { emit({type: 'port-check', host, port}); return false; };
export const fetchText = async (url, options) => {
  emit({type: 'probe', url, bounded: options?.signal instanceof AbortSignal});
  return {response: {status: 200}, text: 'ok'};
};
export const waitFor = async (check) => check();
export const markRunState = (file, patch) => emit({type: 'state', patch});
export const stopRecordedRunState = async (file, options) => emit({type: 'cleanup', ...options});
export const terminateProcessTree = async () => { throw new Error('Unexpected unrecorded process cleanup'); };
export const tailFile = () => '';
export const runBackendMavenChecked = async () => { throw new Error('Fixture must not build backend'); };
export const spawnDetachedProcess = (command, args) => {
  emit({type: 'spawn', command, args});
  return {pid: 424242};
};
export const runCommandChecked = async (command, args, {env}) => {
  emit({type: 'check-env', printToken: env.PRINT_TOKEN, printUserId: env.PRINT_USER_ID, httpTimeoutMs: env.HTTP_TIMEOUT_MS});
  if (process.env.RUNTIME_FIXTURE_FAILURE === '1') throw new Error('isolated check failed');
};
export const runCommand = async (command, args, {env}) => {
  emit({type: 'check-env', printToken: env.PRINT_TOKEN, printUserId: env.PRINT_USER_ID, httpTimeoutMs: env.HTTP_TIMEOUT_MS});
  return {code: process.env.RUNTIME_FIXTURE_FAILURE === '1' ? 1 : 0,
    stdout: 'TOKEN=private-fixture-token\\nUSER_ID=123\\n[PASS] fixture checks\\n'};
};
export const spawnPythonScript = () => {
  const child = new EventEmitter();
  queueMicrotask(() => child.emit('exit', 0));
  return child;
};
`;
const configFixtureSource = `
export const resolveBackendConfigSelection = (root) => ({configPath: root + '/fixture.yml', profile: 'fixture'});
export const resolveRedisEnv = () => ({REDIS_HOST: '127.0.0.1', REDIS_PORT: '6379', REDIS_DB: '0', REDIS_PASSWORD: 'fixture'});
`;
const hookSource = `
import {registerHooks} from 'node:module';
registerHooks({load(url, context, nextLoad) {
  if (url.endsWith('/tools/lib/skill_runtime.mjs')) return {format: 'module', shortCircuit: true, source: ${JSON.stringify(runtimeFixtureSource)}};
  if (url.endsWith('/tools/resolve_backend_local_mcp_env.mjs')) return {format: 'module', shortCircuit: true, source: ${JSON.stringify(configFixtureSource)}};
  return nextLoad(url, context);
}});
`;

test('runner binds the probe host, confines private output and cleans up on success or failure', async () => {
  for (const script of ['run_smoke.mjs', 'run_cluster_smoke.mjs']) {
    const cluster = script === 'run_cluster_smoke.mjs';
    for (const mode of ['success', 'failure', 'keep']) {
      const args = ['--jar', 'tools/verify/test_smoke.mjs', '--profile', 'fixture', '--host', 'localhost'];
      if (cluster) args.push('--skip-abnormal-exit');
      if (mode === 'keep') args.push(cluster ? '--keep-servers' : '--keep-server');
      const result = await runScript(script, args, {
        PRINT_TOKEN: '1', PRINT_USER_ID: '1', RUNTIME_FIXTURE_FAILURE: mode === 'failure' ? '1' : '0',
        [cluster ? 'CLUSTER_SMOKE_HTTP_TIMEOUT_MS' : 'SMOKE_HTTP_TIMEOUT_MS']: '2500'
      }, ['--import', `data:text/javascript,${encodeURIComponent(hookSource)}`]);
      assert.equal(result.code, mode === 'failure' ? 1 : 0, result.output);
      const events = result.output.split(/\r?\n/).filter((line) => line.startsWith('RUNTIME_FIXTURE='))
        .map((line) => JSON.parse(line.slice('RUNTIME_FIXTURE='.length)));
      const launches = events.filter((event) => event.type === 'spawn');
      assert.equal(launches.length, cluster ? 2 : 1);
      for (const launch of launches) {
        assert.equal(launch.command, 'java');
        assert.ok(launch.args.includes('--server.address=localhost'));
        assert.ok(launch.args.includes('--captcha.enable=false'));
      }
      assert.equal(events.filter((event) => event.type === 'port-check').length, cluster ? 2 : 1);
      assert.ok(events.filter((event) => event.type === 'port-check').every((event) => event.host === 'localhost'));
      const probes = events.filter((event) => event.type === 'probe');
      assert.equal(probes.length, cluster ? 2 : 1);
      assert.ok(probes.every((event) => new URL(event.url).hostname === 'localhost'));
      assert.ok(probes.every((event) => event.bounded), 'startup readiness requests must have a deadline');
      assert.deepEqual(events.find((event) => event.type === 'check-env'), {
        type: 'check-env', printToken: cluster ? '1' : '0', printUserId: cluster ? '1' : '0', httpTimeoutMs: '2500'
      });
      assert.ok(!result.output.includes('private-fixture-token'), result.output);
      const cleanup = events.filter((event) => event.type === 'cleanup');
      if (mode === 'keep') {
        assert.equal(cleanup.length, 0);
        const lastState = events.filter((event) => event.type === 'state').at(-1).patch;
        assert.equal(lastState.status, 'running');
        assert.equal(lastState.validationStatus, 'passed');
        assert.equal(lastState.keepAlive, true);
      } else {
        assert.equal(cleanup.length, 1);
        assert.equal(cleanup[0].status, mode === 'failure' ? 'failed' : 'passed');
      }
    }
  }
});
