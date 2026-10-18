#!/usr/bin/env node
import {encryptHeaderKey,encryptWithAesEcbPkcs7,randomAesKey} from '../lib/backend_login.mjs';
import {SmokeCheckError,sendSmokeDiagnostic} from './smoke_output.mjs';

const config = {
  baseUrl: process.env.BASE_URL || 'http://127.0.0.1:18080',
  roleId: process.env.ROLE_ID || '3',
  dictType: process.env.DICT_TYPE || 'sys_yes_no',
  clientId: process.env.CLIENT_ID || 'e5cd7e4891bf95d1d19206ce24a7b32e',
  username: process.env.USERNAME || '',
  password: process.env.PASSWORD || '',
  loginCandidates: process.env.LOGIN_CANDIDATES || 'dept:666666,owner:666666,admin:123456',
  rsaPublicKey:
    process.env.RSA_PUBLIC_KEY ||
    'MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAKoR8mX0rGKLqzcWmOzbfj64K8ZIgOdHnzkXSOVOZbFu/TJhZ7rFAN+eaGkl3C4buccQd/EjEsj9ir7ijT7h96MCAwEAAQ==',
  loginMode: process.env.LOGIN_MODE || 'encrypted',
  httpTimeoutMs: process.env.HTTP_TIMEOUT_MS || '10000'
};
const requests = new WeakMap();
let finished = false;
process.on('disconnect',() => { if (!finished) process.exit(1); });

function logPass(check, details = {}) {
  return sendSmokeDiagnostic({type:'smoke-status',version:1,check,passed:true,...details});
}

function fail(check, reason, details = {}) {
  throw new SmokeCheckError(check,reason,details);
}

async function request(check, endpoint, options = {}) {
  const signal = AbortSignal.timeout(Number(config.httpTimeoutMs));
  try {
    const response = await fetch(`${config.baseUrl}${endpoint}`, {...options, signal});
    requests.set(response, {check, signal});
    return response;
  } catch {
    fail(check,signal.aborted ? 'timeout' : 'network',{timeoutMs:Number(config.httpTimeoutMs)});
  }
}

async function readBody(response, format = 'text') {
  try {
    return await response[format]();
  } catch {
    const context = requests.get(response);
    fail(context?.check || 'configuration',context?.signal.aborted ? 'timeout' : 'body',{timeoutMs:Number(config.httpTimeoutMs)});
  }
}

async function parseResponseAsJson(response) {
  const text = await readBody(response);
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function decodeJwtPayload(token) {
  if (!token || !token.includes('.')) {
    return {};
  }
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  } catch {
    return {};
  }
}

async function assertJsonApi(check, response, expectedHttp = 200) {
  if (response.status !== expectedHttp) {
    fail(check,'response',{http:response.status});
  }
  const body = await parseResponseAsJson(response);
  if (body?.code !== 200) {
    fail(check,'response',{http:response.status,code:Number.isSafeInteger(body?.code) ? body.code : 'invalid-response'});
  }
  await logPass(check,{http:200,code:200});
  return body;
}

async function checkPublicEndpoints() {
  const rootResp = await request('root','/');
  if (rootResp.status !== 200) {
    fail('root','response',{http:rootResp.status});
  }
  const rootText = await readBody(rootResp);
  if (!rootText.includes('backend')) {
    fail('root','response');
  }
  await logPass('root',{http:200});

  await assertJsonApi('captcha', await request('captcha','/auth/code'));
}

function buildCandidateList() {
  const candidates = [];
  if (config.username && config.password) {
    candidates.push({ username: config.username, password: config.password });
  }
  for (const item of config.loginCandidates.split(',')) {
    const [username, password] = item.split(':');
    if (username && password) {
      const exists = candidates.some((c) => c.username === username && c.password === password);
      if (!exists) {
        candidates.push({ username, password });
      }
    }
  }
  return candidates;
}

async function loginEncrypted(username, password) {
  const aesKey = randomAesKey(32);
  const loginBody = JSON.stringify({
    clientId: config.clientId,
    grantType: 'password',
    username,
    password
  });
  const res = await request('login','/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'clientid': config.clientId,
      'encrypt-key': encryptHeaderKey(aesKey, config.rsaPublicKey)
    },
    body: encryptWithAesEcbPkcs7(loginBody, aesKey)
  });
  const body = await parseResponseAsJson(res);
  return { res, body };
}

async function loginPlain(username, password) {
  const res = await request('login','/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'clientid': config.clientId
    },
    body: JSON.stringify({
      clientId: config.clientId,
      grantType: 'password',
      username,
      password
    })
  });
  const body = await parseResponseAsJson(res);
  return { res, body };
}

async function loginAndGetToken() {
  const candidates = buildCandidateList();
  const login = config.loginMode === 'encrypted' ? loginEncrypted : loginPlain;

  for (const account of candidates) {
    const result = await login(account.username, account.password);
    const code = Number.isSafeInteger(result?.body?.code) ? result.body.code : 'invalid-response';
    const token = result?.body?.data?.access_token || result?.body?.data?.accessToken;
    if (result.res.status === 200 && code === 200 && typeof token === 'string' && token && !/[\s\x00-\x1f\x7f]/u.test(token)) {
      const payload = decodeJwtPayload(token);
      await logPass('login',{http:200,code:200});
      return { token, userId: String(payload.userId || '') };
    }
    if (account === candidates.at(-1)) fail('login','login',{http:result.res.status,code});
  }

  fail('login','login');
}

async function checkProtectedEndpoints(token) {
  const headers = {
    Authorization: `Bearer ${token}`,
    clientid: config.clientId,
    'Content-Language': 'zh-CN'
  };

  await assertJsonApi(
    'routers',
    await request('routers','/system/menu/getRouters', { headers })
  );
  await assertJsonApi(
    'roleMenu',
    await request('roleMenu',`/system/menu/roleMenuTreeselect/${config.roleId}`, { headers })
  );
  await assertJsonApi(
    'departments',
    await request('departments',`/system/role/deptTree/${config.roleId}`, { headers })
  );
  await assertJsonApi(
    'dictionary',
    await request('dictionary',`/system/dict/data/type/${config.dictType}`, { headers })
  );

  const exportResp = await request('export','/system/user/export', {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: ''
  });
  if (exportResp.status !== 200) {
    fail('export','export',{http:exportResp.status});
  }
  const contentType = exportResp.headers.get('content-type') || '';
  const buffer = Buffer.from(await readBody(exportResp, 'arrayBuffer'));
  if (!contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
    fail('export','export');
  }
  if (buffer.length === 0) {
    fail('export','export');
  }
  await logPass('export',{bytes:buffer.length});
}

async function main() {
  if (!['encrypted', 'plain'].includes(config.loginMode)) {
    fail('configuration','invalid-login-mode');
  }
  if (!/^[1-9]\d{0,4}$/.test(config.httpTimeoutMs) || Number(config.httpTimeoutMs) > 60000) {
    fail('configuration','invalid-timeout');
  }
  if (process.argv.length > 2) fail('configuration','invalid-arguments');
  if (process.env.PRINT_TOKEN !== undefined || process.env.PRINT_USER_ID !== undefined) fail('configuration','legacy-output');
  if (process.env.SMOKE_AUTH_IPC === '1' && typeof process.send !== 'function') fail('configuration','ipc-required');
  await checkPublicEndpoints();
  const { token, userId } = await loginAndGetToken();
  await checkProtectedEndpoints(token);
  if (process.env.SMOKE_AUTH_IPC === '1') {
    if (!/^[1-9]\d{0,19}$/u.test(userId) || token.length > 16384) fail('login','invalid-auth');
    await new Promise((resolve,reject) => process.send({type:'smoke-auth',version:1,token,userId},error => error ? reject(new SmokeCheckError('configuration','ipc-required')) : resolve()));
  }
  await logPass('complete');
}

main().catch(async(error) => {
  await sendSmokeDiagnostic(error instanceof SmokeCheckError ? error.diagnostic : new SmokeCheckError('configuration','internal').diagnostic).catch(() => {});
  process.exitCode = 1;
}).finally(() => { finished = true; if (process.connected) process.disconnect(); });
