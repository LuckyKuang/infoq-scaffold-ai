import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {parseSmokeAuthenticationOutput} from './smoke_output.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const password = 'fixture-password-must-not-be-logged';
const token = `header.${Buffer.from('{"userId":"123"}').toString('base64url')}.fixture-secret-token`;

async function runScript(script, args = [], env = {}) {
  const child = spawn(process.execPath, [path.join(scriptDir, script), ...args], {
    env: {...process.env, ...env},
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
