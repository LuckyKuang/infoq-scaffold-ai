#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  DEFAULT_CAPTCHA_KEY_PREFIX,
  encodeCommand,
  parseRespValue,
  seedCaptchaAnswer,
} from './redis_captcha_seed.mjs';
import {loginWithRealCaptcha} from './captcha_login.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..', '..');
const runDir = path.join(repoRoot, 'tmp', 'test-cli', 'redis-captcha-seed-test');

let passed = 0;
const failures = [];

function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log(`PASS ${name}`);
    })
    .catch((error) => {
      failures.push({name, error});
      console.error(`FAIL ${name}: ${error.message}`);
    });
}

function startFakeRedis() {
  const commands = [];
  const server = net.createServer((socket) => {
    let buffer = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (true) {
        let parsed;
        try {
          parsed = parseRespValue(buffer, 0);
        } catch (error) {
          socket.write(`-ERR ${error.message}\r\n`);
          buffer = Buffer.alloc(0);
          break;
        }
        if (!parsed) break;
        buffer = buffer.subarray(parsed.nextOffset);
        const command = parsed.value.map(String);
        commands.push(command);
        const name = String(command[0] || '').toUpperCase();
        if (name === 'AUTH' || name === 'SELECT' || name === 'SET') {
          socket.write('+OK\r\n');
        } else if (name === 'PING') {
          socket.write('+PONG\r\n');
        } else {
          socket.write('-ERR unsupported command\r\n');
        }
      }
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({server, port: server.address().port, commands});
    });
  });
}

function startFakeBackend() {
  const server = http.createServer((request, response) => {
    if (request.url === '/auth/code') {
      response.writeHead(200, {'content-type': 'application/json'});
      response.end(JSON.stringify({
        code: 200,
        data: {
          captchaEnabled: true,
          uuid: 'uuid-1',
          img: Buffer.from('fake-captcha-image').toString('base64'),
        },
      }));
      return;
    }
    if (request.url === '/auth/login' && request.method === 'POST') {
      const chunks = [];
      request.on('data', (chunk) => chunks.push(chunk));
      request.on('end', () => {
        response.writeHead(200, {'content-type': 'application/json'});
        response.end(JSON.stringify({code: 200, data: {access_token: 'token-1'}}));
      });
      return;
    }
    response.writeHead(404, {'content-type': 'application/json'});
    response.end(JSON.stringify({code: 404}));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({server, port: server.address().port});
    });
  });
}

await test('encodeCommand encodes RESP arrays and unicode payloads', () => {
  assert.equal(encodeCommand(['SET', 'k', '值']), '*3\r\n$3\r\nSET\r\n$1\r\nk\r\n$3\r\n值\r\n');
});

await test('parseRespValue handles simple strings, bulk strings, arrays, nulls, and errors', () => {
  assert.deepEqual(parseRespValue(Buffer.from('+OK\r\n')), {value: 'OK', nextOffset: 5});
  assert.deepEqual(parseRespValue(Buffer.from('$5\r\nhello\r\n')), {value: 'hello', nextOffset: 11});
  assert.deepEqual(parseRespValue(Buffer.from('*2\r\n$3\r\nfoo\r\n$3\r\nbar\r\n')), {
    value: ['foo', 'bar'],
    nextOffset: 22,
  });
  assert.deepEqual(parseRespValue(Buffer.from('$-1\r\n')), {value: null, nextOffset: 5});
  assert.equal(parseRespValue(Buffer.from('$5\r\nhel')), null);
  assert.throws(() => parseRespValue(Buffer.from('-ERR bad auth\r\n')), /Redis error: ERR bad auth/u);
});

await test('seedCaptchaAnswer authenticates, selects the database, and writes a JSON string answer', async () => {
  const fake = await startFakeRedis();
  try {
    const result = await seedCaptchaAnswer({
      uuid: 'uuid-1',
      answer: '2468',
      host: '127.0.0.1',
      port: fake.port,
      password: 'secret',
      database: 15,
      ttlMs: 120000,
    });
    assert.equal(result.key, `${DEFAULT_CAPTCHA_KEY_PREFIX}uuid-1`);
    assert.deepEqual(fake.commands, [
      ['AUTH', 'secret'],
      ['SELECT', '15'],
      ['SET', `${DEFAULT_CAPTCHA_KEY_PREFIX}uuid-1`, '"2468"', 'PX', '120000'],
    ]);
  } finally {
    fake.server.close();
  }
});

await test('loginWithRealCaptcha uses the seeded answer', async () => {
  const fakeRedis = await startFakeRedis();
  const fakeBackend = await startFakeBackend();
  try {
    const login = await loginWithRealCaptcha({
      backendUrl: `http://127.0.0.1:${fakeBackend.port}`,
      username: 'admin',
      password: 'admin123',
      loginCandidates: '',
      maxCaptchaAttempts: 1,
      captchaAnswer: '2468',
      redisHost: '127.0.0.1',
      redisPort: fakeRedis.port,
      redisPassword: '',
      redisDatabase: 0,
      runDir,
    });
    assert.equal(login.token, 'token-1');
    assert.equal(login.attempts.length, 1);
    assert.equal(login.attempts[0].captchaCode, '2468');
    assert.deepEqual(fakeRedis.commands, [
      ['SET', `${DEFAULT_CAPTCHA_KEY_PREFIX}uuid-1`, '"2468"', 'PX', '120000'],
    ]);
  } finally {
    fakeRedis.server.close();
    fakeBackend.server.close();
    fs.rmSync(runDir, {recursive: true, force: true});
  }
});

if (failures.length > 0) {
  console.error(`\n${failures.length} test(s) failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\nAll ${passed} redis captcha seed tests passed`);
