#!/usr/bin/env node
import crypto from 'node:crypto';

const config = {
  baseUrl: process.env.BASE_URL || 'http://127.0.0.1:8080',
  clientId: process.env.CLIENT_ID || 'e5cd7e4891bf95d1d19206ce24a7b32e',
  username: process.env.USERNAME || '',
  password: process.env.PASSWORD || '',
  loginCandidates: process.env.LOGIN_CANDIDATES || 'admin:admin123,dept:666666,owner:666666,admin:123456',
  rsaPublicKey:
    process.env.RSA_PUBLIC_KEY ||
    'MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAKoR8mX0rGKLqzcWmOzbfj64K8ZIgOdHnzkXSOVOZbFu/TJhZ7rFAN+eaGkl3C4buccQd/EjEsj9ir7ijT7h96MCAwEAAQ==',
  printToken: process.env.PRINT_TOKEN === '1'
};

function pass(name, detail = '') {
  console.log(`[PASS] ${name}${detail ? ` | ${detail}` : ''}`);
}

function fail(name, detail = '') {
  throw new Error(`[FAIL] ${name}${detail ? ` | ${detail}` : ''}`);
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
  return crypto
    .publicEncrypt({ key: toPem(publicKeyBase64), padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(b64Aes, 'utf8'))
    .toString('base64');
}

async function parseJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

function buildCandidates() {
  const list = [];
  if (config.username && config.password) {
    list.push({ username: config.username, password: config.password });
  }
  for (const item of config.loginCandidates.split(',')) {
    const [username, password] = item.split(':');
    if (!username || !password) continue;
    if (!list.some((x) => x.username === username && x.password === password)) {
      list.push({ username, password });
    }
  }
  return list;
}

async function loginEncrypted(username, password) {
  const aesKey = randomAesKey(32);
  const payload = JSON.stringify({
    clientId: config.clientId,
    grantType: 'password',
    username,
    password
  });

  const res = await fetch(`${config.baseUrl}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      clientid: config.clientId,
      'encrypt-key': encryptHeaderKey(aesKey, config.rsaPublicKey)
    },
    body: encryptWithAesEcbPkcs7(payload, aesKey)
  });

  return { res, body: await parseJson(res), mode: 'encrypted' };
}

async function loginPlain(username, password) {
  const res = await fetch(`${config.baseUrl}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      clientid: config.clientId
    },
    body: JSON.stringify({
      clientId: config.clientId,
      grantType: 'password',
      username,
      password
    })
  });

  return { res, body: await parseJson(res), mode: 'plain' };
}

async function assertAuthCode() {
  const res = await fetch(`${config.baseUrl}/auth/code`);
  if (res.status !== 200) {
    fail('GET /auth/code', `http=${res.status}`);
  }
  const body = await parseJson(res);
  if (body.code !== 200) {
    fail('GET /auth/code', `code=${body.code}, msg=${body.msg || ''}`);
  }
  if (body?.data?.captchaEnabled === true) {
    fail(
      'GET /auth/code',
      [
        'captchaEnabled=true.',
        'Use infoq-admin-e2e-captcha-verification for real captcha login,',
        'or run verify_login.mjs with --allow-captcha-disabled for explicit fast diagnostics.'
      ].join(' ')
    );
  }
  pass('GET /auth/code', 'captchaEnabled=false');
}

async function loginAndGetToken() {
  const candidates = buildCandidates();
  const attempts = [];

  for (const account of candidates) {
    for (const loginFn of [loginEncrypted, loginPlain]) {
      const result = await loginFn(account.username, account.password);
      const code = result?.body?.code;
      const token = result?.body?.data?.access_token || result?.body?.data?.accessToken;

      if (result.res.status === 200 && code === 200 && token) {
        pass('POST /auth/login', `user=${account.username}, mode=${result.mode}`);
        return { token, username: account.username };
      }

      attempts.push(
        `${account.username}/${account.password} (${result.mode}) => http=${result.res.status}, code=${code}, msg=${result?.body?.msg || ''}`
      );
    }
  }

  fail('POST /auth/login', `all attempts failed: ${attempts.join(' || ')}`);
}

async function checkProtectedApis(token) {
  const headers = {
    Authorization: `Bearer ${token}`,
    clientid: config.clientId,
    'Content-Language': 'zh-CN'
  };

  const infoRes = await fetch(`${config.baseUrl}/system/user/getInfo`, { headers });
  if (infoRes.status !== 200) {
    fail('GET /system/user/getInfo', `http=${infoRes.status}`);
  }
  const infoBody = await parseJson(infoRes);
  if (infoBody.code !== 200 || !infoBody?.data?.user?.userName) {
    fail('GET /system/user/getInfo', `code=${infoBody.code}, msg=${infoBody.msg || ''}`);
  }
  pass('GET /system/user/getInfo', `user=${infoBody.data.user.userName}`);

  const routesRes = await fetch(`${config.baseUrl}/system/menu/getRouters`, { headers });
  if (routesRes.status !== 200) {
    fail('GET /system/menu/getRouters', `http=${routesRes.status}`);
  }
  const routesBody = await parseJson(routesRes);
  if (routesBody.code !== 200) {
    fail('GET /system/menu/getRouters', `code=${routesBody.code}, msg=${routesBody.msg || ''}`);
  }
  pass('GET /system/menu/getRouters');
}

async function main() {
  console.log(`[INFO] target backend: ${config.baseUrl}`);
  await assertAuthCode();
  const { token, username } = await loginAndGetToken();
  await checkProtectedApis(token);
  if (config.printToken) {
    console.log(`TOKEN=${token}`);
  }
  console.log(`[INFO] login success verified with user: ${username}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
