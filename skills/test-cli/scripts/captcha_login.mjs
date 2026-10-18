#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {
    ensureDir,
    fetchJson,
    normalizeForwardedArgs,
    resolveRepoRoot,
    resolveTmpPath,
    timestampSlug
} from '../../../tools/lib/skill_runtime.mjs';
import {encryptHeaderKey, encryptWithAesEcbPkcs7, randomAesKey} from '../../../tools/lib/backend_login.mjs';
import {DEFAULT_CAPTCHA_KEY_PREFIX, DEFAULT_CAPTCHA_TTL_MS, seedCaptchaAnswer} from './redis_captcha_seed.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(scriptDir);

export const DEFAULT_CAPTCHA_LOGIN_OPTIONS = {
  backendUrl: 'http://127.0.0.1:8080',
  clientId: 'e5cd7e4891bf95d1d19206ce24a7b32e',
  username: '',
  password: '',
  loginCandidates: 'admin:admin123,dept:666666,owner:666666,admin:123456',
  maxCaptchaAttempts: 3,
  captchaFetchRetries: 4,
  captchaFetchRetryDelayMs: 16000,
  rsaPublicKey: 'MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAKoR8mX0rGKLqzcWmOzbfj64K8ZIgOdHnzkXSOVOZbFu/TJhZ7rFAN+eaGkl3C4buccQd/EjEsj9ir7ijT7h96MCAwEAAQ==',
  logPrefix: 'admin-e2e',
  captchaAnswer: '2468',
  captchaTtlMs: DEFAULT_CAPTCHA_TTL_MS,
  redisHost: process.env.INFOQ_TEST_REDIS_HOST || process.env.REDIS_HOST || '127.0.0.1',
  redisPort: Number(process.env.INFOQ_TEST_REDIS_PORT || process.env.REDIS_PORT || 6379),
  redisUsername: process.env.INFOQ_TEST_REDIS_USERNAME || process.env.REDIS_USERNAME || '',
  redisPassword: process.env.INFOQ_TEST_REDIS_PASSWORD || process.env.REDIS_PASSWORD || '',
  redisDatabase: Number(process.env.INFOQ_TEST_REDIS_DATABASE || process.env.REDIS_DATABASE || 0),
  redisTls: String(process.env.INFOQ_TEST_REDIS_TLS || '').toLowerCase() === 'true',
  redisKeyPrefix: process.env.INFOQ_TEST_REDIS_KEY_PREFIX || DEFAULT_CAPTCHA_KEY_PREFIX
};

function printHelp() {
  console.log(`Usage:
  node skills/test-cli/scripts/captcha_login.mjs [options]

Options:
  --backend-url <url>             Backend base URL. Default: ${DEFAULT_CAPTCHA_LOGIN_OPTIONS.backendUrl}
  --client-id <id>                Login client id. Default: ${DEFAULT_CAPTCHA_LOGIN_OPTIONS.clientId}
  --username <name>               Preferred username.
  --password <pwd>                Preferred password.
  --login-candidates <csv>        Candidate accounts. Default: ${DEFAULT_CAPTCHA_LOGIN_OPTIONS.loginCandidates}
  --rsa-public-key <base64>       Request encryption public key.
  --max-captcha-attempts <n>      Captcha attempts per account. Default: ${DEFAULT_CAPTCHA_LOGIN_OPTIONS.maxCaptchaAttempts}
  --captcha-answer <code>         Answer seeded into Redis. Default: ${DEFAULT_CAPTCHA_LOGIN_OPTIONS.captchaAnswer}
  --captcha-ttl-ms <ms>           Seeded captcha TTL in milliseconds. Default: ${DEFAULT_CAPTCHA_LOGIN_OPTIONS.captchaTtlMs}
  --redis-host <host>             Redis host for the seeded captcha. Default: ${DEFAULT_CAPTCHA_LOGIN_OPTIONS.redisHost}
  --redis-port <port>             Redis port for the seeded captcha. Default: ${DEFAULT_CAPTCHA_LOGIN_OPTIONS.redisPort}
  --redis-username <name>         Redis ACL username.
  --redis-password <pwd>          Redis password. Default: INFOQ_TEST_REDIS_PASSWORD or REDIS_PASSWORD
  --redis-database <n>            Redis database. Default: ${DEFAULT_CAPTCHA_LOGIN_OPTIONS.redisDatabase}
  --redis-tls                     Connect to Redis with TLS.
  --redis-key-prefix <prefix>     Captcha key prefix. Default: ${DEFAULT_CAPTCHA_LOGIN_OPTIONS.redisKeyPrefix}
  --run-id <slug>                 Evidence run id under tmp/test-cli/e2e/captcha-login/.
  --run-dir <path>                Explicit evidence directory.
  --print-token                   Print TOKEN=<token> for script consumers.
  --json                          Print machine-readable JSON summary.
  -h, --help                      Show help.`);
}

function readValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function parseArgs(argv) {
  const options = {
    ...DEFAULT_CAPTCHA_LOGIN_OPTIONS,
    backendUrl: process.env.BACKEND_URL || DEFAULT_CAPTCHA_LOGIN_OPTIONS.backendUrl,
    clientId: process.env.CLIENT_ID || DEFAULT_CAPTCHA_LOGIN_OPTIONS.clientId,
    username: process.env.USERNAME || '',
    password: process.env.PASSWORD || '',
    loginCandidates: process.env.LOGIN_CANDIDATES || DEFAULT_CAPTCHA_LOGIN_OPTIONS.loginCandidates,
    rsaPublicKey: process.env.RSA_PUBLIC_KEY || DEFAULT_CAPTCHA_LOGIN_OPTIONS.rsaPublicKey,
    printToken: false,
    json: false,
    runId: '',
    runDir: ''
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--backend-url':
        options.backendUrl = readValue(argv, index, arg).replace(/\/+$/, '');
        index += 1;
        break;
      case '--client-id':
        options.clientId = readValue(argv, index, arg);
        index += 1;
        break;
      case '--username':
        options.username = readValue(argv, index, arg);
        index += 1;
        break;
      case '--password':
        options.password = readValue(argv, index, arg);
        index += 1;
        break;
      case '--login-candidates':
        options.loginCandidates = readValue(argv, index, arg);
        index += 1;
        break;
      case '--rsa-public-key':
        options.rsaPublicKey = readValue(argv, index, arg);
        index += 1;
        break;
      case '--max-captcha-attempts':
        options.maxCaptchaAttempts = Number(readValue(argv, index, arg));
        index += 1;
        break;
      case '--captcha-answer':
        options.captchaAnswer = readValue(argv, index, arg);
        index += 1;
        break;
      case '--captcha-ttl-ms':
        options.captchaTtlMs = Number(readValue(argv, index, arg));
        index += 1;
        break;
      case '--redis-host':
        options.redisHost = readValue(argv, index, arg);
        index += 1;
        break;
      case '--redis-port':
        options.redisPort = Number(readValue(argv, index, arg));
        index += 1;
        break;
      case '--redis-username':
        options.redisUsername = readValue(argv, index, arg);
        index += 1;
        break;
      case '--redis-password':
        options.redisPassword = readValue(argv, index, arg);
        index += 1;
        break;
      case '--redis-database':
        options.redisDatabase = Number(readValue(argv, index, arg));
        index += 1;
        break;
      case '--redis-tls':
        options.redisTls = true;
        break;
      case '--redis-key-prefix':
        options.redisKeyPrefix = readValue(argv, index, arg);
        index += 1;
        break;
      case '--run-id':
        options.runId = readValue(argv, index, arg);
        index += 1;
        break;
      case '--run-dir':
        options.runDir = readValue(argv, index, arg);
        index += 1;
        break;
      case '--print-token':
        options.printToken = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  validateCaptchaOptions(options);
  return options;
}

function validateCaptchaOptions(options) {
  if (options.runId && !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/u.test(options.runId)) throw new Error('--run-id must be a simple slug without path separators.');
  if (!Number.isInteger(options.maxCaptchaAttempts) || options.maxCaptchaAttempts <= 0) {
    throw new Error('--max-captcha-attempts must be a positive integer.');
  }
  if (!String(options.captchaAnswer || '').trim()) {
    throw new Error('--captcha-answer must not be empty.');
  }
  if (!Number.isInteger(options.redisPort) || options.redisPort <= 0 || options.redisPort > 65535) {
    throw new Error('--redis-port must be a valid TCP port.');
  }
  if (!Number.isInteger(options.redisDatabase) || options.redisDatabase < 0) {
    throw new Error('--redis-database must be a non-negative integer.');
  }
  if (!Number.isInteger(options.captchaTtlMs) || options.captchaTtlMs <= 0) {
    throw new Error('--captcha-ttl-ms must be a positive integer.');
  }
  if (!String(options.redisKeyPrefix || '').trim()) {
    throw new Error('--redis-key-prefix must not be empty.');
  }
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function parseResponseJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return {_raw: text};
  }
}

function buildCaptchaLoginCandidates(options) {
  const list = [];
  if (options.username && options.password) {
    list.push({username: options.username, password: options.password});
  }
  for (const item of String(options.loginCandidates || '').split(',')) {
    const [username, password] = item.split(':');
    if (!username || !password) {
      continue;
    }
    if (!list.some((candidate) => candidate.username === username && candidate.password === password)) {
      list.push({username, password});
    }
  }
  if (list.length === 0) {
    throw new Error('No login candidates configured.');
  }
  return list;
}

async function fetchCaptcha(options, runDir, sequence) {
  let lastResponse;
  let lastBody;
  for (let attempt = 1; attempt <= options.captchaFetchRetries; attempt += 1) {
    const {response, body} = await fetchJson(`${options.backendUrl}/auth/code`, {
      signal: AbortSignal.any([AbortSignal.timeout(options.timeoutMs || 30000), ...(options.signal ? [options.signal] : [])]),
      headers: {
        clientid: options.clientId,
        'Content-Language': 'zh-CN'
      }
    });
    lastResponse = response;
    lastBody = body;
    if (response.status === 200 && body.code === 200) {
      const data = body.data || {};
      if (data.captchaEnabled !== true) {
        throw new Error('GET /auth/code returned captchaEnabled=false. Captcha login requires captchaEnabled=true; the test seeds the expected answer in Redis.');
      }
      if (!data.img || !data.uuid) {
        throw new Error('GET /auth/code did not return img and uuid.');
      }

      const imagePath = path.join(runDir, 'captcha', `captcha-${sequence}.png`);
      const metaPath = path.join(runDir, 'captcha', `captcha-${sequence}.json`);
      ensureDir(path.dirname(imagePath));
      fs.writeFileSync(imagePath, Buffer.from(data.img, 'base64'));
      writeJson(metaPath, {
        sequence,
        uuid: data.uuid,
        captchaEnabled: data.captchaEnabled,
        registerEnabled: data.registerEnabled,
        inviteRegisterEnabled: data.inviteRegisterEnabled,
        forgotPasswordEnabled: data.forgotPasswordEnabled,
        mailEnabled: data.mailEnabled,
        imagePath
      });

      return {uuid: data.uuid, imagePath, metaPath};
    }

    if (String(body.msg || '').includes('访问过于频繁') && attempt < options.captchaFetchRetries) {
      await delay(options.captchaFetchRetryDelayMs, undefined, {signal: options.signal});
      continue;
    }
    break;
  }

  throw new Error(`GET /auth/code failed: http=${lastResponse?.status}, code=${lastBody?.code}, msg=${lastBody?.msg || ''}`);
}

async function loginEncrypted(options, account, captchaCode, uuid) {
  const aesKey = randomAesKey(32);
  const payload = JSON.stringify({
    clientId: options.clientId,
    grantType: 'password',
    username: account.username,
    password: account.password,
    code: captchaCode,
    uuid
  });

  const response = await fetch(`${options.backendUrl}/auth/login`, {
    signal: AbortSignal.any([AbortSignal.timeout(options.timeoutMs || 30000), ...(options.signal ? [options.signal] : [])]),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      clientid: options.clientId,
      'encrypt-key': encryptHeaderKey(aesKey, options.rsaPublicKey)
    },
    body: encryptWithAesEcbPkcs7(payload, aesKey)
  });

  return {
    response,
    body: await parseResponseJson(response)
  };
}

export async function loginWithRealCaptcha(inputOptions = {}, inputRunDir = '') {
  const options = {
    ...DEFAULT_CAPTCHA_LOGIN_OPTIONS,
    ...inputOptions,
    backendUrl: (inputOptions.backendUrl || DEFAULT_CAPTCHA_LOGIN_OPTIONS.backendUrl).replace(/\/+$/, '')
  };
  validateCaptchaOptions(options);
  const runDir = inputRunDir || resolveRunDir(options);
  const relativeRunDir = path.relative(path.join(repoRoot, 'tmp'), path.resolve(runDir));
  if (relativeRunDir.startsWith('..') || path.isAbsolute(relativeRunDir)) throw new Error('--run-dir must be inside the repository tmp/ directory.');
  ensureDir(runDir);
  const candidates = buildCaptchaLoginCandidates(options);
  const attempts = [];
  let sequence = 0;

  for (const account of candidates) {
    for (let attempt = 1; attempt <= options.maxCaptchaAttempts; attempt += 1) {
      options.signal?.throwIfAborted();
      sequence += 1;
      const captcha = await fetchCaptcha(options, runDir, sequence);
      let seed;
      try {
        seed = await seedCaptchaAnswer({
          uuid: captcha.uuid,
          answer: options.captchaAnswer,
          host: options.redisHost,
          port: options.redisPort,
          username: options.redisUsername,
          password: options.redisPassword,
          database: options.redisDatabase,
          tls: options.redisTls,
          keyPrefix: options.redisKeyPrefix,
          ttlMs: options.captchaTtlMs
        });
      } catch (error) {
        throw new Error(
          `Failed to seed captcha answer in Redis at ${options.redisHost}:${options.redisPort}/${options.redisDatabase}: ${error.message}`
        );
      }
      const captchaCode = String(options.captchaAnswer);
      options.signal?.throwIfAborted();
      const attemptRecord = {
        sequence,
        username: account.username,
        attempt,
        uuid: captcha.uuid,
        imagePath: captcha.imagePath,
        seedKey: seed.key,
        captchaCode,
        status: 'pending'
      };

      const loginResult = await loginEncrypted(options, account, captchaCode, captcha.uuid);
      const token = loginResult.body?.data?.access_token || loginResult.body?.data?.accessToken;
      attemptRecord.httpStatus = loginResult.response.status;
      attemptRecord.responseCode = loginResult.body?.code;
      attemptRecord.responseMsg = loginResult.body?.msg || '';
      attemptRecord.status = loginResult.response.status === 200 && loginResult.body?.code === 200 && token ? 'passed' : 'failed';
      attempts.push(attemptRecord);
      writeJson(captcha.metaPath, attemptRecord);

      if (attemptRecord.status === 'passed') {
        console.log(`[${options.logPrefix}] captcha login passed: user=${account.username}, captcha="${captchaCode}", attempt=${attempt}`);
        return {token, username: account.username, attempts};
      }

      console.log(
        `[${options.logPrefix}] captcha login attempt failed: user=${account.username}, captcha="${captchaCode}", http=${attemptRecord.httpStatus}, code=${attemptRecord.responseCode}, msg=${attemptRecord.responseMsg}`
      );
    }
  }

  throw new Error(`Real captcha login failed after ${attempts.length} attempt(s). Evidence: ${path.join(runDir, 'captcha')}`);
}

function resolveRunDir(options) {
  if (options.runDir) {
    return path.isAbsolute(options.runDir) ? options.runDir : path.join(repoRoot, options.runDir);
  }
  const runId = options.runId || `captcha-login-${timestampSlug()}`;
  return resolveTmpPath(repoRoot, 'test-cli', 'e2e', 'captcha-login', runId);
}

async function main() {
  const options = parseArgs(normalizeForwardedArgs(process.argv.slice(2)));
  const runDir = resolveRunDir(options);
  const login = await loginWithRealCaptcha(options, runDir);
  const result = {
    backendUrl: options.backendUrl,
    username: login.username,
    tokenPresent: Boolean(login.token),
    attempts: login.attempts.map(({sequence, username, attempt, imagePath, seedKey, captchaCode, status, httpStatus, responseCode, responseMsg}) => ({
      sequence,
      username,
      attempt,
      imagePath,
      seedKey,
      captchaCode,
      status,
      httpStatus,
      responseCode,
      responseMsg
    })),
    runDir
  };
  writeJson(path.join(runDir, 'result.json'), result);

  if (options.printToken) {
    console.log(`TOKEN=${login.token}`);
  }
  if (options.json) {
    console.log(JSON.stringify(result));
  } else {
    console.log(`[captcha-login] completed: user=${login.username}, evidence=${runDir}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}
