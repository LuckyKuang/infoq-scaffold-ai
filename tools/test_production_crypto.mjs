#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createProductionFixture} from './production_fixture.mjs';
import {readProductionConfig, validateRsaConfiguration} from './production_config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--help') {
  console.log('真实浏览器 RSA 库格式回归（仅生成隔离密钥）\n用法: node tools/test_production_crypto.mjs [--client react|vue|all]\n前置条件：目标工作区 pnpm install 已完成；需要 openssl。证据在 tmp/production-readiness/build/。');
  process.exit(0);
}
try {
  if (!(args.length === 0 || (args.length === 2 && args[0] === '--client' && ['react', 'vue', 'all'].includes(args[1])))) throw new Error('参数无效；使用 --help');
  const clients = !args.length || args[1] === 'all' ? ['react', 'vue'] : [args[1]];
  const directory = path.join(root, 'tmp/production-readiness/build', `crypto-${Date.now()}-${process.pid}`);
  const fixture = createProductionFixture(directory);
  const env = readProductionConfig(fixture.configFile);
  validateRsaConfiguration(env);
  const tests = [];
  for (const client of clients) {
    const require = createRequire(path.join(root, `frontend-${client}/package.json`));
    let JSEncrypt;
    try { JSEncrypt = require('jsencrypt'); } catch { throw new Error(`frontend-${client} 缺少已安装的 JSEncrypt；先 pnpm --dir frontend-${client} install --frozen-lockfile`); }
    for (const [direction, publicName, privateName] of [['request', 'VITE_APP_RSA_PUBLIC_KEY', 'INFOQ_API_REQUEST_PRIVATE_KEY'], ['response', 'INFOQ_API_RESPONSE_PUBLIC_KEY', 'VITE_APP_RSA_PRIVATE_KEY']]) {
      const encryptor = new JSEncrypt(), decryptor = new JSEncrypt();
      encryptor.setPublicKey(env[publicName]); decryptor.setPrivateKey(env[privateName]);
      const payload = 'isolated-aes-material-1234567890';
      const ciphertext = encryptor.encrypt(payload);
      assert.equal(typeof ciphertext, 'string', `${client} ${direction} encryption must succeed`);
      assert.equal(decryptor.decrypt(ciphertext), payload, `${client} ${direction} decryption must match`);
      tests.push({client, direction, library: require('jsencrypt/package.json').version, format: 'Base64 DER public SPKI / private PKCS8', status: 'passed'});
    }
  }
  fs.writeFileSync(path.join(directory, 'results.json'), JSON.stringify({status: 'passed', tests, target: 'real-workspace-jsencrypt-with-isolated-keys', backend: 'requires Java/Hutool tests separately'}, null, 2) + '\n', 'utf8');
  console.log(`[production-crypto-test] PASS ${tests.length} real-library directions; evidence: ${path.relative(root, directory)}/results.json`);
} catch (error) { console.error(`[production-crypto-test] ${error.message}`); process.exitCode = 1; }
