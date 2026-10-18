#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {generateKeyPairSync, randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function createProductionFixture(directory) {
  const output = path.resolve(directory);
  const relative = path.relative(path.join(root, 'tmp'), output);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('隔离测试输入只能生成在仓库 tmp/ 的专用子目录');
  for (let current = output; current !== path.dirname(current); current = path.dirname(current)) {
    try { if (fs.lstatSync(current).isSymbolicLink()) throw new Error('测试目录不允许经过符号链接'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (fs.existsSync(output)) throw new Error('测试目录已存在，拒绝覆盖已有配置');
  fs.mkdirSync(output, {recursive: true, mode: 0o700});
  const keyPair = () => generateKeyPairSync('rsa', {modulusLength: 2048, publicKeyEncoding: {type: 'spki', format: 'der'}, privateKeyEncoding: {type: 'pkcs8', format: 'der'}});
  const request = keyPair();
  const response = keyPair();
  const cert = path.join(output, 'tls.crt');
  const key = path.join(output, 'tls.key');
  const tls = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes', '-days', '2', '-subj', '/CN=app.infoq.test', '-addext', 'subjectAltName=DNS:app.infoq.test,DNS:oss.infoq.test', '-keyout', key, '-out', cert], {encoding: 'utf8', timeout: 10000});
  if (tls.status !== 0) throw new Error('openssl 生成隔离证书失败；不接受已有生产证书作为fixture');
  fs.chmodSync(cert, 0o644);
  fs.chmodSync(key, 0o600);
  const configFile = path.join(output, 'production.env');
  const secret = () => 'A1' + randomBytes(24).toString('hex');
  const suffix = randomBytes(6).toString('hex');
  const env = {
    INFOQ_DEPLOY_MODE: 'production', INFOQ_CONFIG_SOURCE: 'isolated-test',
    INFOQ_PRODUCTION_CONFIG_FILE: configFile,
    INFOQ_PUBLIC_BASE_URL: 'https://app.infoq.test', INFOQ_OSS_PUBLIC_ORIGIN: 'https://oss.infoq.test',
    INFOQ_BROWSER_SESSION_ORIGINS: '', INFOQ_BROWSER_SESSION_COOKIE_PATH: '/prod-api/auth/browser-session',
    INFOQ_BROWSER_SESSION_SECURE: 'true', INFOQ_BROWSER_SESSION_TTL_SECONDS: '2592000',
    INFOQ_TLS_CERT_FILE: cert, INFOQ_TLS_KEY_FILE: key, INFOQ_INTERNAL_BIND_HOST: '127.0.0.1',
    INFOQ_DEPLOY_ROOT: path.join(output, 'data'), INFOQ_FRONTEND_TARGET: 'all',
    INFOQ_VERSION: JSON.parse(fs.readFileSync(path.join(root, 'frontend-react/package.json'), 'utf8')).version,
    INFOQ_REACT_CONTEXT_PATH: '/react/', INFOQ_VUE_CONTEXT_PATH: '/vue/',
    MYSQL_ROOT_PASSWORD: secret(), INFOQ_DB_USERNAME: `app_${suffix}`, INFOQ_DB_PASSWORD: secret(),
    REDIS_PASSWORD: secret(), MINIO_ROOT_USER: `minio_${suffix}`, MINIO_ROOT_PASSWORD: secret(),
    INFOQ_OSS_BUCKET: 'infoq', SECURITY_TOKEN_SECRET: secret(),
    INFOQ_ADMIN_USERNAME: `admin_${suffix}`, INFOQ_ADMIN_PASSWORD: `A1@${randomBytes(12).toString('hex')}`,
    DEPLOY_ID: `isolated-${suffix}`, VITE_APP_ENCRYPT: 'true',
    VITE_APP_RSA_PUBLIC_KEY: request.publicKey.toString('base64'),
    INFOQ_API_REQUEST_PRIVATE_KEY: request.privateKey.toString('base64'),
    VITE_APP_RSA_PRIVATE_KEY: response.privateKey.toString('base64'),
    INFOQ_API_RESPONSE_PUBLIC_KEY: response.publicKey.toString('base64')
  };
  fs.writeFileSync(configFile, Object.entries(env).map(([name, value]) => `${name}=${JSON.stringify(value)}`).join('\n') + '\n', {encoding: 'utf8', mode: 0o600});
  return {configFile, certificate: cert, privateKeyFile: key, purpose: 'isolated-test-only', deployable: false};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--help') console.log('隔离构建配置生成器（不能用于生产/Release）\n用法: node tools/production_fixture.mjs --output-dir tmp/production-readiness/<唯一运行目录>\n生成两组独立 2048 位 RSA、随机凭据和双域自签证书；拒绝覆盖目录，不打印秘密。需要 openssl。');
    else if (args.length === 2 && args[0] === '--output-dir' && args[1]) console.log(JSON.stringify(createProductionFixture(args[1])));
    else throw new Error('参数无效；使用 --help 查看用法');
  } catch (error) { console.error(`[production-fixture] ${error.message}`); process.exitCode = 1; }
}
