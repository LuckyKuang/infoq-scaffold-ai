#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
    ensureDir,
    fetchJson,
    normalizeForwardedArgs,
    resolveDocTmpPath,
    resolvePythonLaunchSpec,
    resolveRepoRoot,
    runCommandChecked,
    timestampSlug
} from '../../../lib/skill_runtime.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(scriptDir);
const ocrScriptPath = path.join(scriptDir, 'ocr_captcha.py');

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
  logPrefix: 'admin-e2e'
};

function printHelp() {
  console.log(`Usage:
  node .codex/skills/infoq-admin-e2e/scripts/captcha_login.mjs [options]

Options:
  --backend-url <url>             Backend base URL. Default: ${DEFAULT_CAPTCHA_LOGIN_OPTIONS.backendUrl}
  --client-id <id>                Login client id. Default: ${DEFAULT_CAPTCHA_LOGIN_OPTIONS.clientId}
  --username <name>               Preferred username.
  --password <pwd>                Preferred password.
  --login-candidates <csv>        Candidate accounts. Default: ${DEFAULT_CAPTCHA_LOGIN_OPTIONS.loginCandidates}
  --rsa-public-key <base64>       Request encryption public key.
  --max-captcha-attempts <n>      Captcha attempts per account. Default: ${DEFAULT_CAPTCHA_LOGIN_OPTIONS.maxCaptchaAttempts}
  --run-id <slug>                 Evidence run id under doc/tmp/infoq-admin-e2e/captcha-login/.
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

  if (!Number.isInteger(options.maxCaptchaAttempts) || options.maxCaptchaAttempts <= 0) {
    throw new Error('--max-captcha-attempts must be a positive integer.');
  }

  return options;
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
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
    .publicEncrypt({key: toPem(publicKeyBase64), padding: crypto.constants.RSA_PKCS1_PADDING}, Buffer.from(b64Aes, 'utf8'))
    .toString('base64');
}

async function parseResponseJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return {_raw: text};
  }
}

export function buildCaptchaLoginCandidates(options) {
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

export function normalizeOcrToCaptcha(rawText) {
  const cleaned = String(rawText || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[oO]/g, '0')
    .replace(/[lI]/g, '1')
    .replace(/[×xX*]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/[=？?]+$/g, '');

  if (!cleaned) {
    return '';
  }

  if (/^\d+[+\-*/]\d+$/u.test(cleaned)) {
    const [, left, op, right] = cleaned.match(/^(\d+)([+\-*/])(\d+)$/u);
    const a = Number(left);
    const b = Number(right);
    switch (op) {
      case '+':
        return String(a + b);
      case '-':
        return String(a - b);
      case '*':
        return String(a * b);
      case '/':
        return b === 0 ? '' : String(Math.trunc(a / b));
      default:
        return cleaned;
    }
  }

  return cleaned.replace(/[^a-zA-Z0-9]/g, '');
}

export async function recognizeCaptcha(imagePath) {
  const python = resolvePythonLaunchSpec();
  const ocrResult = await runCommandChecked(python.command, [...python.args, '-B', ocrScriptPath, '--image', imagePath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PYTHONDONTWRITEBYTECODE: '1'
    },
    captureOutput: true
  }).catch((error) => {
    throw new Error(`Captcha OCR failed. Ensure ddddocr is installed with: python3 -m pip install ddddocr\n${error.message || error}`);
  });

  const output = ocrResult.stdout.trim().split(/\r?\n/).at(-1) || '';
  try {
    const parsed = JSON.parse(output);
    if (parsed.error) {
      throw new Error(parsed.error);
    }
    return {
      raw: String(parsed.raw || parsed.text || ''),
      text: String(parsed.text || parsed.raw || '')
    };
  } catch (error) {
    throw new Error(`Failed to parse OCR output: ${output}\n${error.message || error}`);
  }
}

export async function fetchCaptcha(options, runDir, sequence) {
  let lastResponse;
  let lastBody;
  for (let attempt = 1; attempt <= options.captchaFetchRetries; attempt += 1) {
    const {response, body} = await fetchJson(`${options.backendUrl}/auth/code`, {
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
        throw new Error('GET /auth/code returned captchaEnabled=false. Captcha login requires real captcha verification.');
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
      await new Promise((resolve) => setTimeout(resolve, options.captchaFetchRetryDelayMs));
      continue;
    }
    break;
  }

  throw new Error(`GET /auth/code failed: http=${lastResponse?.status}, code=${lastBody?.code}, msg=${lastBody?.msg || ''}`);
}

export async function loginEncrypted(options, account, captchaCode, uuid) {
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
  const runDir = inputRunDir || resolveRunDir(options);
  ensureDir(runDir);
  const candidates = buildCaptchaLoginCandidates(options);
  const attempts = [];
  let sequence = 0;

  for (const account of candidates) {
    for (let attempt = 1; attempt <= options.maxCaptchaAttempts; attempt += 1) {
      sequence += 1;
      const captcha = await fetchCaptcha(options, runDir, sequence);
      const ocr = await recognizeCaptcha(captcha.imagePath);
      const captchaCode = normalizeOcrToCaptcha(ocr.text || ocr.raw);
      const attemptRecord = {
        sequence,
        username: account.username,
        attempt,
        uuid: captcha.uuid,
        imagePath: captcha.imagePath,
        ocrRaw: ocr.raw,
        ocrText: ocr.text,
        captchaCode,
        status: 'pending'
      };

      if (!captchaCode) {
        attemptRecord.status = 'ocr-empty';
        attempts.push(attemptRecord);
        writeJson(captcha.metaPath, attemptRecord);
        continue;
      }

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
  return resolveDocTmpPath(repoRoot, 'infoq-admin-e2e', 'captcha-login', runId);
}

async function main() {
  const options = parseArgs(normalizeForwardedArgs(process.argv.slice(2)));
  const runDir = resolveRunDir(options);
  ensureDir(runDir);
  const login = await loginWithRealCaptcha(options, runDir);
  const result = {
    backendUrl: options.backendUrl,
    username: login.username,
    tokenPresent: Boolean(login.token),
    attempts: login.attempts.map(({sequence, username, attempt, imagePath, ocrRaw, ocrText, captchaCode, status, httpStatus, responseCode, responseMsg}) => ({
      sequence,
      username,
      attempt,
      imagePath,
      ocrRaw,
      ocrText,
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
