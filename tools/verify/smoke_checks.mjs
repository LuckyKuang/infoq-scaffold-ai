#!/usr/bin/env node
import crypto from 'node:crypto';

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
  printToken: process.env.PRINT_TOKEN === '1',
  printUserId: process.env.PRINT_USER_ID === '1',
  loginMode: process.env.LOGIN_MODE || 'encrypted',
  httpTimeoutMs: process.env.HTTP_TIMEOUT_MS || '10000'
};
const requests = new WeakMap();

function logPass(name, detail = '') {
  console.log(`[PASS] ${name}${detail ? ` | ${detail}` : ''}`);
}

function fail(name, detail = '') {
  throw new Error(`[FAIL] ${name}${detail ? ` | ${detail}` : ''}`);
}

async function request(endpoint, options = {}) {
  const name = `${options.method || 'GET'} ${endpoint}`;
  const signal = AbortSignal.timeout(Number(config.httpTimeoutMs));
  try {
    const response = await fetch(`${config.baseUrl}${endpoint}`, {...options, signal});
    requests.set(response, {name, signal});
    return response;
  } catch (error) {
    const cause = ['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT']
      .includes(error.cause?.code) ? `, cause=${error.cause.code}` : '';
    fail(name, `network=${signal.aborted ? 'timeout' : 'request-failed'}, timeout_ms=${config.httpTimeoutMs}${cause}`);
  }
}

async function readBody(response, format = 'text') {
  try {
    return await response[format]();
  } catch {
    const context = requests.get(response);
    fail(context?.name || 'HTTP response', `network=${context?.signal.aborted ? 'timeout' : 'response-read-failed'}, timeout_ms=${config.httpTimeoutMs}`);
  }
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
  return crypto.publicEncrypt(
    { key: toPem(publicKeyBase64), padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(b64Aes, 'utf8')
  ).toString('base64');
}

async function parseResponseAsJson(response) {
  const text = await readBody(response);
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
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

async function assertJsonApi(name, response, expectedHttp = 200) {
  if (response.status !== expectedHttp) {
    fail(name, `http=${response.status}`);
  }
  const body = await parseResponseAsJson(response);
  if (body?.code !== 200) {
    fail(name, `http=${response.status}, code=${Number.isInteger(body?.code) ? body.code : 'invalid-response'}`);
  }
  logPass(name, `http=${response.status}, code=${body.code}`);
  return body;
}

async function checkPublicEndpoints() {
  const rootResp = await request('/');
  if (rootResp.status !== 200) {
    fail('GET /', `http=${rootResp.status}`);
  }
  const rootText = await readBody(rootResp);
  if (!rootText.includes('backend')) {
    fail('GET /', 'unexpected response body');
  }
  logPass('GET /', 'http=200');

  await assertJsonApi('GET /auth/code', await request('/auth/code'));
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
  const res = await request('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'clientid': config.clientId,
      'encrypt-key': encryptHeaderKey(aesKey, config.rsaPublicKey)
    },
    body: encryptWithAesEcbPkcs7(loginBody, aesKey)
  });
  const body = await parseResponseAsJson(res);
  return { res, body, mode: 'encrypted' };
}

async function loginPlain(username, password) {
  const res = await request('/auth/login', {
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
  return { res, body, mode: 'plain' };
}

async function loginAndGetToken() {
  const candidates = buildCandidateList();
  const attempts = [];
  const login = config.loginMode === 'encrypted' ? loginEncrypted : loginPlain;

  for (const account of candidates) {
    const result = await login(account.username, account.password);
    const code = Number.isInteger(result?.body?.code) ? result.body.code : 'invalid-response';
    const token = result?.body?.data?.access_token || result?.body?.data?.accessToken;
    if (result.res.status === 200 && code === 200 && token) {
      const payload = decodeJwtPayload(token);
      logPass(
        'POST /auth/login',
        `mode=${result.mode}, user=${account.username}, token_len=${String(token).length}`
      );
      return { token, username: account.username, userId: payload.userId || '' };
    }
    attempts.push(
      `${account.username} (${result.mode}) => http=${result.res.status}, code=${code}`
    );
  }

  fail('POST /auth/login', `all attempts failed: ${attempts.join(' || ')}`);
}

async function checkProtectedEndpoints(token) {
  const headers = {
    Authorization: `Bearer ${token}`,
    clientid: config.clientId,
    'Content-Language': 'zh-CN'
  };

  await assertJsonApi(
    'GET /system/menu/getRouters',
    await request('/system/menu/getRouters', { headers })
  );
  await assertJsonApi(
    `GET /system/menu/roleMenuTreeselect/${config.roleId}`,
    await request(`/system/menu/roleMenuTreeselect/${config.roleId}`, { headers })
  );
  await assertJsonApi(
    `GET /system/role/deptTree/${config.roleId}`,
    await request(`/system/role/deptTree/${config.roleId}`, { headers })
  );
  await assertJsonApi(
    `GET /system/dict/data/type/${config.dictType}`,
    await request(`/system/dict/data/type/${config.dictType}`, { headers })
  );

  const exportResp = await request('/system/user/export', {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: ''
  });
  if (exportResp.status !== 200) {
    fail('POST /system/user/export', `http=${exportResp.status}`);
  }
  const contentType = exportResp.headers.get('content-type') || '';
  const buffer = Buffer.from(await readBody(exportResp, 'arrayBuffer'));
  if (!contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
    fail('POST /system/user/export', `unexpected content-type=${contentType}`);
  }
  if (buffer.length === 0) {
    fail('POST /system/user/export', 'empty file');
  }
  logPass('POST /system/user/export', `bytes=${buffer.length}`);
}

async function main() {
  if (!['encrypted', 'plain'].includes(config.loginMode)) {
    throw new Error('LOGIN_MODE must be encrypted or plain.');
  }
  if (!/^[1-9]\d{0,4}$/.test(config.httpTimeoutMs) || Number(config.httpTimeoutMs) > 60000) {
    throw new Error('HTTP_TIMEOUT_MS must be an integer from 1 to 60000 without leading zeros.');
  }
  console.log(
    `[INFO] smoke target: ${config.baseUrl}, roleId=${config.roleId}, dictType=${config.dictType}`
  );
  await checkPublicEndpoints();
  const { token, username, userId } = await loginAndGetToken();
  await checkProtectedEndpoints(token);
  if (config.printToken) {
    console.log(`TOKEN=${token}`);
  }
  if (config.printUserId && userId) {
    console.log(`USER_ID=${userId}`);
  }
  console.log(`[INFO] smoke completed with login user: ${username}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
