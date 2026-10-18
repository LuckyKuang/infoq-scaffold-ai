#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {generateKeyPairSync} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createProductionFixture} from './production_fixture.mjs';
import {readProductionConfig, runtimeConfigEntries, validateProductionConfig, validateBrowserSessionConfig, validateRsaConfiguration, frontendBuildConfig, validateContextPath, verifyFrontendArtifact} from './production_config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = path.join(root, 'tmp/production-readiness/build', `tests-${Date.now()}-${process.pid}`);
let fixture;
const originalUmask = process.umask();
try {
  if (process.platform !== 'win32') process.umask(0o002);
  fixture = createProductionFixture(run);
} finally { process.umask(originalUmask); }
const env = readProductionConfig(fixture.configFile);
const installShell = process.platform === 'darwin' ? '/bin/bash' : 'bash';
let installShellVersion = 'not-applicable: Linux Bash entry';
const tests = [];
function test(name, action) { action(); tests.push({name, status: 'passed'}); }
function rejects(overrides, pattern, scope = 'deploy') { assert.throws(() => validateProductionConfig({...env, ...overrides}, {scope}), pattern); }
function command(args, overrides = {}) { return spawnSync(process.execPath, [path.join(root, 'tools/production_config.mjs'), ...args], {encoding: 'utf8', env: {...process.env, INFOQ_PRODUCTION_CONFIG_FILE: '', ...overrides}, timeout: 10000}); }

test('隔离证书不受组可写 umask 影响，私钥保持 owner-only', () => {
  if (process.platform !== 'win32') {
    assert.equal(fs.statSync(fixture.certificate).mode & 0o777, 0o644);
    assert.equal(fs.statSync(fixture.privateKeyFile).mode & 0o777, 0o600);
    assert.equal(fs.statSync(fixture.configFile).mode & 0o777, 0o600);
  }
  assert.equal(validateProductionConfig(env).mode, 'production');
});

test('两组独立 2048 位 RSA 严格生产主流程与指纹', () => {
  const result = validateProductionConfig(env);
  assert.equal(result.mode, 'production'); assert.equal(result.rsa.minimumBits, 2048);
  assert.notEqual(result.rsa.request, result.rsa.response);
  assert.equal(result.tls, 'key-validity-domains-and-provided-chain-consistency-verified-not-trust');
});
test('浏览器会话复用生产Origin，路径/Secure/有界TTL预检输出与实际部署一致', () => {
  const result = validateProductionConfig(env).browserSession;
  assert.deepEqual(result, {deploymentMode: 'production', origins: ['https://app.infoq.test'], cookiePath: '/prod-api/auth/browser-session', secure: true, ttlSeconds: 2592000});
  assert.equal(validateBrowserSessionConfig({...env, INFOQ_BROWSER_SESSION_TTL_SECONDS: undefined}).ttlSeconds, 2592000);
  assert.equal(validateBrowserSessionConfig({...env, INFOQ_BROWSER_SESSION_TTL_SECONDS: '1'}).ttlSeconds, 1);
});
test('生产会话拒绝扩展Origin、cookie越界、降级Secure与无界TTL', () => {
  for (const overrides of [
    {INFOQ_BROWSER_SESSION_ORIGINS: 'https://other.infoq.test'},
    {INFOQ_BROWSER_SESSION_ORIGINS: 'https://app.infoq.test'},
    {INFOQ_BROWSER_SESSION_COOKIE_PATH: '/'}, {INFOQ_BROWSER_SESSION_COOKIE_PATH: '/dev-api/auth/browser-session'},
    {INFOQ_BROWSER_SESSION_COOKIE_PATH: '/prod-api/auth/browser-session/../'}, {INFOQ_BROWSER_SESSION_COOKIE_PATH: ''},
    {INFOQ_BROWSER_SESSION_SECURE: 'false'}, {INFOQ_BROWSER_SESSION_SECURE: ''}, {INFOQ_BROWSER_SESSION_SECURE: 'TRUE'},
    {VITE_APP_BASE_API: 'https://evil.test/api'}, {VITE_APP_BASE_API: '/other-api'}
  ]) assert.throws(() => validateBrowserSessionConfig({...env, ...overrides}), /Origin|ORIGINS|COOKIE_PATH|SECURE|VITE_APP_BASE_API/u);
  for (const value of ['0', '-1', '01', '1.5', '2592001', '', '1e3', '9007199254740992']) assert.throws(() => validateBrowserSessionConfig({...env, INFOQ_BROWSER_SESSION_TTL_SECONDS: value}), /TTL_SECONDS/u);
});
test('开发会话仅显式HTTP loopback，区分Vite /dev-api与Compose /prod-api', () => {
  const development = {...env, INFOQ_DEPLOY_MODE: 'development', INFOQ_PUBLIC_BASE_URL: 'http://app.localhost', INFOQ_BROWSER_SESSION_ORIGINS: 'http://localhost:5173,http://127.0.0.1:5174,http://[::1]:5175', INFOQ_BROWSER_SESSION_SECURE: 'false'};
  const gateway = validateBrowserSessionConfig(development);
  assert.equal(gateway.secure, false);
  assert.deepEqual(gateway.origins, ['http://app.localhost', 'http://localhost:5173', 'http://127.0.0.1:5174', 'http://[::1]:5175']);
  const vite = {...development, INFOQ_BROWSER_SESSION_COOKIE_PATH: '/dev-api/auth/browser-session', VITE_APP_BASE_API: '/dev-api'};
  assert.equal(validateBrowserSessionConfig(vite, {apiPrefix: '/dev-api'}).cookiePath, vite.INFOQ_BROWSER_SESSION_COOKIE_PATH);
  assert.throws(() => validateBrowserSessionConfig(vite), /COOKIE_PATH/u);
  for (const origin of ['http://remote.test', 'http://localhost.evil.test', 'http://evil-localhost', 'http://*.localhost', 'null', 'http://localhost/path', 'http://user@localhost', 'http://localhost?query', 'http://localhost:5173,', 'http://localhost:5173, https://localhost:5174']) assert.throws(() => validateBrowserSessionConfig({...development, INFOQ_BROWSER_SESSION_ORIGINS: origin}), /Origin|origin|URL|VALUE/u);
});
for (const name of ['MYSQL_ROOT_PASSWORD', 'INFOQ_DB_PASSWORD', 'REDIS_PASSWORD', 'MINIO_ROOT_PASSWORD', 'SECURITY_TOKEN_SECRET', 'INFOQ_ADMIN_PASSWORD']) {
  test(`拒绝缺少/示例凭据 ${name}`, () => { rejects({[name]: ''}, new RegExp(name)); rejects({[name]: 'change-me-unsafe-secret12345'}, new RegExp(name)); });
}
test('拒绝重复凭据/默认用户名/控制字符', () => {
  rejects({INFOQ_DB_PASSWORD: env.REDIS_PASSWORD}, /相互独立/u);
  rejects({INFOQ_ADMIN_USERNAME: 'admin'}, /INFOQ_ADMIN_USERNAME/u);
  rejects({INFOQ_DB_PASSWORD: 'Sensitive\nSecret12345678'}, /INFOQ_DB_PASSWORD/u);
});
test('管理员凭据符合实际密码登录最大30字符边界', () => {
  assert.ok(env.INFOQ_ADMIN_PASSWORD.length >= 16 && env.INFOQ_ADMIN_PASSWORD.length <= 30);
  assert.ok(env.INFOQ_ADMIN_USERNAME.length <= 30);
  assert.equal(validateProductionConfig({...env, INFOQ_ADMIN_USERNAME: 'a'.repeat(30), INFOQ_ADMIN_PASSWORD: 'Ab12@Cd34#'.repeat(3)}).mode, 'production');
  rejects({INFOQ_ADMIN_USERNAME: 'a'.repeat(31)}, /INFOQ_ADMIN_USERNAME.*30/u);
  rejects({INFOQ_ADMIN_PASSWORD: 'Ab12@Cd34#'.repeat(3) + 'X'}, /INFOQ_ADMIN_PASSWORD.*30/u);
});
for (const name of ['VITE_APP_RSA_PUBLIC_KEY', 'INFOQ_API_REQUEST_PRIVATE_KEY', 'VITE_APP_RSA_PRIVATE_KEY', 'INFOQ_API_RESPONSE_PUBLIC_KEY']) {
  test(`缺失或损坏的 RSA ${name}`, () => { rejects({[name]: ''}, new RegExp(name), 'frontend'); rejects({[name]: 'invalid-sensitive-material'}, new RegExp(name), 'frontend'); });
}
test('双向错配分别拒绝', () => {
  rejects({VITE_APP_RSA_PUBLIC_KEY: env.INFOQ_API_RESPONSE_PUBLIC_KEY}, /配对不匹配/u, 'frontend');
  rejects({INFOQ_API_RESPONSE_PUBLIC_KEY: env.VITE_APP_RSA_PUBLIC_KEY}, /配对不匹配/u, 'frontend');
});
test('同一 key pair 不能把服务端私钥发布到浏览器', () => {
  rejects({VITE_APP_RSA_PRIVATE_KEY: env.INFOQ_API_REQUEST_PRIVATE_KEY, INFOQ_API_RESPONSE_PUBLIC_KEY: env.VITE_APP_RSA_PUBLIC_KEY}, /两组独立/u, 'frontend');
});
test('1024 位和非 RSA key 被拒绝', () => {
  const weak = generateKeyPairSync('rsa', {modulusLength: 1024}).publicKey.export({format: 'der', type: 'spki'}).toString('base64');
  rejects({VITE_APP_RSA_PUBLIC_KEY: weak}, /2048/u, 'frontend');
  const ec = generateKeyPairSync('ec', {namedCurve: 'prime256v1'}).publicKey.export({format: 'der', type: 'spki'}).toString('base64');
  rejects({VITE_APP_RSA_PUBLIC_KEY: ec}, /2048/u, 'frontend');
});
test('公开/私有字段只接受单行 DER；所有PEM和转义PEM拒绝', () => {
  const original = env.VITE_APP_RSA_PUBLIC_KEY;
  const pem = '-----BEGIN PUBLIC KEY-----\n' + original.match(/.{1,64}/gu).join('\n') + '\n-----END PUBLIC KEY-----';
  rejects({VITE_APP_RSA_PUBLIC_KEY: pem}, /RSA 格式无效/u, 'frontend');
  rejects({VITE_APP_RSA_PUBLIC_KEY: pem.replaceAll('\n', '\\n')}, /RSA 格式无效/u, 'frontend');
  const der = env.INFOQ_API_REQUEST_PRIVATE_KEY;
  const privatePem = '-----BEGIN PRIVATE KEY-----\n' + der.match(/.{1,64}/gu).join('\n') + '\n-----END PRIVATE KEY-----';
  rejects({VITE_APP_RSA_PUBLIC_KEY: privatePem}, /VITE_APP_RSA_PUBLIC_KEY/u, 'frontend');
  const processEnv = {...env, INFOQ_CONFIG_SOURCE: 'managed-environment', INFOQ_PRODUCTION_CONFIG_FILE: '', VITE_APP_RSA_PUBLIC_KEY: privatePem};
  assert.throws(() => frontendBuildConfig({command: 'build', mode: 'production', env: {}, processEnv}), /VITE_APP_RSA_PUBLIC_KEY/u);
});
test('生产HTTPS、独立域名、TLS域名/key/路径均预先核验', () => {
  rejects({INFOQ_PUBLIC_BASE_URL: 'http://app.infoq.test'}, /HTTPS/u);
  rejects({INFOQ_OSS_PUBLIC_ORIGIN: env.INFOQ_PUBLIC_BASE_URL}, /独立域名/u);
  rejects({INFOQ_OSS_PUBLIC_ORIGIN: 'https://other.infoq.test'}, /TLS/u);
  rejects({INFOQ_TLS_KEY_FILE: fixture.certificate}, /TLS/u);
  rejects({INFOQ_TLS_CERT_FILE: path.join(run, 'missing.crt')}, /INFOQ_TLS_CERT_FILE/u);
  rejects({INFOQ_INTERNAL_BIND_HOST: '0.0.0.0'}, /loopback/u);
});
test('子路径合法性与显式开发模式边界', () => {
  for (const value of ['/', '/react/', '/nested/admin_1/']) assert.equal(validateContextPath(value), value);
  for (const value of ['//evil/', '/a/../', '/a%2f/', '/a\\b/', '/a?b/', '/a#b/', '/react', 'https://evil/']) assert.throws(() => validateContextPath(value));
  const development = {...env, INFOQ_DEPLOY_MODE: 'development', INFOQ_PUBLIC_BASE_URL: 'http://localhost', INFOQ_OSS_PUBLIC_ORIGIN: 'http://oss.localhost', INFOQ_TLS_CERT_FILE: '', INFOQ_TLS_KEY_FILE: '', REDIS_PASSWORD: ''};
  assert.equal(validateProductionConfig(development).productionReady, false);
  assert.equal(validateProductionConfig(development, {scope: 'frontend'}).rsa.minimumBits, 2048);
  assert.throws(() => validateProductionConfig({...development, INFOQ_CONFIG_SOURCE: 'controlled-file'}, {scope: 'frontend'}), /development/u);
  assert.throws(() => validateProductionConfig({...development, INFOQ_PUBLIC_BASE_URL: 'https://localhost'}), /HTTPS/u);
});
test('受控dotenv按数据解析，不执行shell；重复/坏引号/不安全文件拒绝', () => {
  const file = path.join(run, 'parser.env');
  fs.writeFileSync(file, "VALUE='a'\\''b'\nDOUBLE=\"x=y\"\nLITERAL=$(touch unsafe)\n", {encoding: 'utf8', mode: 0o600});
  assert.deepEqual({...readProductionConfig(file)}, {VALUE: "a'b", DOUBLE: 'x=y', LITERAL: '$(touch unsafe)'});
  fs.writeFileSync(file, 'VALUE=1\nVALUE=2\n', 'utf8'); assert.throws(() => readProductionConfig(file), /重复/u);
  fs.writeFileSync(file, "VALUE='a'b'\n", 'utf8'); assert.throws(() => readProductionConfig(file), /引号/u);
  if (process.platform !== 'win32') { fs.chmodSync(file, 0o644); assert.throws(() => readProductionConfig(file), /权限/u); }
  assert.throws(() => readProductionConfig('relative.env'), /绝对路径/u);
});
test('UTF-8损坏、BOM、进程控制变量和链接越界均拒绝', () => {
  const file = path.join(run, 'invalid-encoding.env');
  fs.writeFileSync(file, Buffer.from([0x56, 0x41, 0x4c, 0x55, 0x45, 0x3d, 0xff]), {mode: 0o600});
  assert.throws(() => readProductionConfig(file), /UTF-8/u);
  fs.writeFileSync(file, '\ufeffVALUE=x', 'utf8'); assert.throws(() => readProductionConfig(file), /BOM/u);
  for (const name of ['PATH', 'NODE_OPTIONS', 'BASH_ENV', 'LD_PRELOAD']) assert.throws(() => runtimeConfigEntries({[name]: 'unsafe'}), new RegExp(name));
  if (process.platform !== 'win32') {
    const link = path.join(run, 'config-link.env'); fs.symlinkSync(fixture.configFile, link); assert.throws(() => readProductionConfig(link), /符号链接/u);
    const hard = path.join(run, 'config-hardlink.env'); fs.linkSync(file, hard); assert.throws(() => readProductionConfig(hard), /硬链接/u);
  }
});
test('Vite在production实际构建前校验；dev/test不误触发，fixture保持加密且不可发布', () => {
  const processEnv = {INFOQ_PRODUCTION_CONFIG_FILE: fixture.configFile};
  const result = frontendBuildConfig({command: 'build', mode: 'production', env: {VITE_APP_CONTEXT_PATH: '/react/'}, processEnv});
  assert.equal(result.contextPath, '/react/'); assert.equal(result.metadata.deployable, false); assert.equal(processEnv.VITE_APP_ENCRYPT, 'true');
  assert.equal(processEnv.VITE_APP_RSA_PRIVATE_KEY, env.VITE_APP_RSA_PRIVATE_KEY);
  assert.equal(processEnv.INFOQ_API_REQUEST_PRIVATE_KEY, undefined);
  assert.throws(() => frontendBuildConfig({command: 'build', mode: 'production', env: {}, processEnv: {}}), /INFOQ_PRODUCTION_CONFIG_FILE/u);
  assert.throws(() => frontendBuildConfig({command: 'build', mode: 'production', env: {}, processEnv: {...processEnv, INFOQ_BUILD_MODE: 'validation'}}), /不关闭加密/u);
  for (const baseApi of ['https://evil.test/api', '//evil.test/api', '/dev-api', '/other-api', '']) assert.throws(() => frontendBuildConfig({command: 'build', mode: 'production', env: {VITE_APP_BASE_API: baseApi}, processEnv}), /VITE_APP_BASE_API/u);
  assert.equal(frontendBuildConfig({command: 'serve', mode: 'development', env: {}}).metadata, null);
  assert.equal(frontendBuildConfig({command: 'serve', mode: 'test', env: {}}).metadata, null);
});
test('CLI成功只输出指纹；失败不输出秘密且非零退出', () => {
  const good = command(['check', '--scope', 'deploy', '--env-file', fixture.configFile]); assert.equal(good.status, 0, good.stderr);
  const secret = 'change-me-SECRET-DO-NOT-LOG123456';
  const badFile = path.join(run, 'bad.env');
  fs.writeFileSync(badFile, Object.entries({...env, INFOQ_PRODUCTION_CONFIG_FILE: badFile, INFOQ_DB_PASSWORD: secret}).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n'), {encoding: 'utf8', mode: 0o600});
  const bad = command(['check', '--scope', 'deploy', '--env-file', badFile]); assert.equal(bad.status, 1); assert.match(bad.stderr, /INFOQ_DB_PASSWORD/u);
  for (const value of [secret, env.INFOQ_API_REQUEST_PRIVATE_KEY, env.VITE_APP_RSA_PRIVATE_KEY, env.SECURITY_TOKEN_SECRET]) assert.ok(!(good.stdout + good.stderr + bad.stdout + bad.stderr).includes(value));
  for (const args of [[], ['check', '--bogus'], ['check', '--scope'], ['check', '--scope', 'deploy', '--scope', 'frontend']]) assert.equal(command(args).status, 1);
});
test('模拟Docker COPY的工具依赖闭合', () => {
  const container = path.join(run, 'container');
  for (const file of ['tools/production_config.mjs', 'deploy/bin/render-gateway.mjs']) {
    fs.mkdirSync(path.dirname(path.join(container, file)), {recursive: true}); fs.copyFileSync(path.join(root, file), path.join(container, file));
  }
  const check = spawnSync(process.execPath, [path.join(container, 'tools/production_config.mjs'), 'check', '--scope', 'frontend', '--env-file', fixture.configFile], {encoding: 'utf8', timeout: 10000});
  assert.equal(check.status, 0, check.stderr);
  for (const client of ['react', 'vue']) {
    const dockerfile = fs.readFileSync(path.join(root, `frontend-${client}/Dockerfile`), 'utf8');
    assert.match(dockerfile, /--mount=type=secret,id=production_config,required=true/u);
    assert.doesNotMatch(dockerfile, /(?:ARG|ENV)\s+(?:INFOQ_API_REQUEST_PRIVATE_KEY|VITE_APP_RSA_PRIVATE_KEY)/u);
  }
});
test('产物检查拒绝样例、服务端私钥、错指纹和fixture发布', () => {
  const dir = path.join(run, 'artifact'); fs.mkdirSync(dir);
  const metadata = frontendBuildConfig({command: 'build', mode: 'production', env: {}, processEnv: {INFOQ_PRODUCTION_CONFIG_FILE: fixture.configFile}}).metadata;
  fs.writeFileSync(path.join(dir, 'index.html'), '<div>fixture</div>', 'utf8');
  fs.writeFileSync(path.join(dir, 'production-build.json'), JSON.stringify(metadata), 'utf8');
  const js = path.join(dir, 'index.js'); fs.writeFileSync(js, `${env.VITE_APP_RSA_PUBLIC_KEY};${env.VITE_APP_RSA_PRIVATE_KEY}`, 'utf8');
  assert.equal(verifyFrontendArtifact(dir, env, {allowIsolated: true}).purpose, 'isolated-test-only');
  assert.throws(() => verifyFrontendArtifact(dir, env), /不可发布/u);
  fs.appendFileSync(js, env.INFOQ_API_REQUEST_PRIVATE_KEY, 'utf8'); assert.throws(() => verifyFrontendArtifact(dir, env, {allowIsolated: true}), /服务端请求解密私钥/u);
  fs.writeFileSync(js, `${env.VITE_APP_RSA_PUBLIC_KEY};${env.VITE_APP_RSA_PRIVATE_KEY};KoR8mX0rGKLqzcWmOzbfj64K8ZIgOdHnzkXSOVOZbFu`, 'utf8');
  assert.throws(() => verifyFrontendArtifact(dir, env, {allowIsolated: true}), /仓库示例/u);
});
if (process.platform !== 'win32') test('部署shell显式记录实际版本，macOS固定/bin/bash 3.2', () => {
  const result = spawnSync(installShell, ['--version'], {encoding: 'utf8', timeout: 10000});
  assert.equal(result.status, 0, result.stderr);
  installShellVersion = result.stdout.split('\n')[0];
  if (process.platform === 'darwin') assert.match(installShellVersion, /version 3\.2\./u);
});
if (process.platform !== 'win32') test('install生产缺配置/坏TLS在下载daemon写宿主前失败且不打印秘密', () => {
  const target = path.join(run, 'install');
  const options = {encoding: 'utf8', env: {...process.env, INFOQ_DEPLOY_MODE: 'production', INFOQ_ALLOW_NON_ROOT: '1', INFOQ_INSTALL_DIR: path.join(target, 'source'), INFOQ_CONFIG_DIR: path.join(target, 'config'), INFOQ_DEPLOY_ROOT: path.join(target, 'data'), INFOQ_ENV_FILE: path.join(target, 'missing.env'), INFOQ_FRONTEND_TARGET: 'all'}, timeout: 10000};
  const missing = spawnSync(installShell, [path.join(root, 'deploy/install.sh')], options);
  assert.notEqual(missing.status, 0); assert.ok(!fs.existsSync(target)); assert.match(missing.stderr, /INFOQ_ENV_FILE/u);
  const bad = {...env, INFOQ_PRODUCTION_CONFIG_FILE: path.join(run, 'bad-tls.env'), INFOQ_OSS_PUBLIC_ORIGIN: 'https://unmatched.infoq.test'};
  fs.writeFileSync(bad.INFOQ_PRODUCTION_CONFIG_FILE, Object.entries(bad).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n'), {encoding: 'utf8', mode: 0o600});
  const tls = spawnSync(installShell, [path.join(root, 'deploy/install.sh')], {...options, env: {...options.env, INFOQ_ENV_FILE: bad.INFOQ_PRODUCTION_CONFIG_FILE}});
  assert.notEqual(tls.status, 0); assert.match(tls.stderr, /TLS/u); assert.ok(!fs.existsSync(target));
  assert.ok(!tls.stderr.includes(env.INFOQ_API_REQUEST_PRIVATE_KEY));
});
if (process.platform !== 'win32') test('显式development安装生成独立RSA且helper使用同一受控配置，不打印秘密', () => {
  const target = path.join(run, 'development-install');
  const source = path.join(target, 'source'), bin = path.join(target, 'bin'); fs.mkdirSync(bin, {recursive: true});
  for (const file of ['tools/production_config.mjs', 'deploy/bin/render-gateway.mjs']) { fs.mkdirSync(path.dirname(path.join(source, file)), {recursive: true}); fs.copyFileSync(path.join(root, file), path.join(source, file)); }
  fs.writeFileSync(path.join(bin, 'docker'), '#!/bin/sh\nexit 0\n', {encoding: 'utf8', mode: 0o700});
  const fakeHelper = `#!/bin/sh\nexec '${process.execPath.replaceAll("'", "'\\''")}' tools/production_config.mjs check --scope frontend --env-file "$INFOQ_ENV_FILE"\n`;
  for (const file of ['infoq.sh', 'deploy-frontend.sh']) fs.writeFileSync(path.join(source, 'deploy/bin', file), fakeHelper, {encoding: 'utf8', mode: 0o700});
  const file = path.join(target, 'config/deploy.env');
  const result = spawnSync(installShell, [path.join(root, 'deploy/install.sh')], {encoding: 'utf8', timeout: 10000, env: {...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, INFOQ_DEPLOY_MODE: 'development', INFOQ_ALLOW_NON_ROOT: '1', INFOQ_SOURCE_DIR: source, INFOQ_INSTALL_DIR: path.join(target, 'install'), INFOQ_CONFIG_DIR: path.join(target, 'config'), INFOQ_DEPLOY_ROOT: path.join(target, 'data'), INFOQ_ENV_FILE: file, INFOQ_FRONTEND_TARGET: 'all', INFOQ_PUBLIC_BASE_URL: 'http://app.localhost', INFOQ_OSS_PUBLIC_ORIGIN: 'http://oss.localhost'}});
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const generated = readProductionConfig(file);
  assert.equal(generated.INFOQ_DEPLOY_MODE, 'development'); assert.equal(generated.INFOQ_CONFIG_SOURCE, 'isolated-test');
  assert.equal(generated.INFOQ_BROWSER_SESSION_ORIGINS, 'http://app.localhost');
  assert.equal(generated.INFOQ_BROWSER_SESSION_COOKIE_PATH, '/prod-api/auth/browser-session');
  assert.equal(generated.INFOQ_BROWSER_SESSION_SECURE, 'false');
  assert.equal(validateProductionConfig(generated).browserSession.ttlSeconds, 2592000);
  validateRsaConfiguration(generated);
  for (const name of ['INFOQ_API_REQUEST_PRIVATE_KEY', 'VITE_APP_RSA_PRIVATE_KEY', 'INFOQ_ADMIN_PASSWORD', 'REDIS_PASSWORD']) assert.ok(!(result.stdout + result.stderr).includes(generated[name]), `logs must not contain ${name}`);
  assert.match(result.stdout, /OSS:.*http:\/\/oss\.localhost/u);
});
if (process.platform !== 'win32') test('进程替换缺少NUL完成标记必须失败，已有RSA字段不能伪装成功', () => {
  const script = path.join(run, 'install-functions.sh');
  fs.writeFileSync(script, fs.readFileSync(path.join(root, 'deploy/install.sh'), 'utf8').replace(/\nmain "\$@"\s*$/u, '\n'), 'utf8');
  const development = spawnSync(installShell, ['-c', 'source "$INFOQ_TEST_INSTALL_SCRIPT"\nINFOQ_DEPLOY_MODE=development\nunset INFOQ_PUBLIC_BASE_URL\ndetect_public_base_url\n[[ "$INFOQ_PUBLIC_BASE_URL" == "http://127.0.0.1" ]]\n'], {encoding: 'utf8', timeout: 10000, env: {...process.env, INFOQ_TEST_INSTALL_SCRIPT: script}});
  assert.equal(development.status, 0, development.stdout + development.stderr);
  for (const [action, producer, pattern] of [
    ['generate_rsa_config', "emit_rsa_config() { printf 'VITE_APP_RSA_PUBLIC_KEY\\0partial\\0'; return 7; }", /RSA 生成失败/u],
    ['load_env_file', "emit_runtime_config() { printf 'INFOQ_DB_USERNAME\\0partial\\0'; return 7; }", /环境文件加载失败/u]
  ]) {
    const command = 'source "$INFOQ_TEST_INSTALL_SCRIPT"\nSOURCE_DIR="$INFOQ_TEST_SOURCE"\n' + producer + '\n' + action + '\n';
    const result = spawnSync(installShell, ['-c', command], {encoding: 'utf8', timeout: 10000, env: {...process.env, INFOQ_TEST_INSTALL_SCRIPT: script, INFOQ_TEST_SOURCE: root, INFOQ_ENV_FILE: fixture.configFile, INFOQ_API_REQUEST_PRIVATE_KEY: 'retained-request-private', VITE_APP_RSA_PRIVATE_KEY: 'retained-response-private'}});
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, pattern);
    for (const secret of ['retained-request-private', 'retained-response-private', env.INFOQ_API_REQUEST_PRIVATE_KEY, env.VITE_APP_RSA_PRIVATE_KEY]) assert.ok(!(result.stdout + result.stderr).includes(secret));
  }
});
if (process.platform !== 'win32') test('Apple init仅临时本地env：幂等保留RSA，生产配置在daemon前拒绝', () => {
  const dir = path.join(run, 'apple'); fs.mkdirSync(dir);
  const file = path.join(dir, 'local.env');
  const bin = path.join(dir, 'bin'); fs.mkdirSync(bin);
  const daemonCalls = path.join(dir, 'daemon-calls');
  fs.writeFileSync(path.join(bin, 'container'), `#!${process.execPath}\nrequire('node:fs').appendFileSync(process.env.INFOQ_TEST_DAEMON_CALLS, 'called\\n'); process.exit(91);\n`, {mode: 0o755});
  const options = {encoding: 'utf8', timeout: 10000, env: {...process.env, INFOQ_ENV_FILE: file, PATH: bin + path.delimiter + process.env.PATH, INFOQ_TEST_DAEMON_CALLS: daemonCalls}};
  const first = spawnSync(installShell, [path.join(root, 'deploy/apple-container.sh'), 'init'], options); assert.equal(first.status, 0, first.stderr);
  const original = readProductionConfig(file); assert.equal(original.INFOQ_DEPLOY_MODE, 'development'); validateRsaConfiguration(original);
  assert.equal(original.INFOQ_BROWSER_SESSION_COOKIE_PATH, '/dev-api/auth/browser-session');
  assert.equal(original.INFOQ_BROWSER_SESSION_SECURE, 'false');
  assert.equal(validateBrowserSessionConfig(original, {apiPrefix: '/dev-api'}).ttlSeconds, 2592000);
  const declarations = path.join(dir, 'apple-functions.sh');
  fs.writeFileSync(declarations, fs.readFileSync(path.join(root, 'deploy/apple-container.sh'), 'utf8').replace(/\nmain "\$@"\s*$/u, '\n'), 'utf8');
  const projected = spawnSync(installShell, ['-c', 'source "$INFOQ_TEST_SCRIPT"\nREPO_ROOT="$INFOQ_TEST_REPO"\nENV_FILE="$INFOQ_ENV_FILE"\nprepare_environment\nTEMP_DIR="$INFOQ_TEST_OUTPUT"\nwrite_admin_env_file\n'], {...options, env: {...options.env, INFOQ_TEST_SCRIPT: declarations, INFOQ_TEST_REPO: root, INFOQ_TEST_OUTPUT: dir}});
  assert.equal(projected.status, 0, projected.stdout + projected.stderr);
  const runtime = readProductionConfig(path.join(dir, 'admin.env'));
  for (const name of ['INFOQ_DEPLOY_MODE', 'INFOQ_PUBLIC_BASE_URL', 'INFOQ_BROWSER_SESSION_ORIGINS', 'INFOQ_BROWSER_SESSION_COOKIE_PATH', 'INFOQ_BROWSER_SESSION_SECURE', 'INFOQ_BROWSER_SESSION_TTL_SECONDS']) assert.equal(runtime[name], original[name], `Apple runtime lost ${name}`);
  original.INFOQ_BROWSER_SESSION_ORIGINS += ',http://admin.localhost:5179';
  fs.writeFileSync(file, Object.entries(original).map(([name, value]) => `${name}=${JSON.stringify(value)}`).join('\n') + '\n', {mode: 0o600});
  const second = spawnSync(installShell, [path.join(root, 'deploy/apple-container.sh'), 'init'], options); assert.equal(second.status, 0, second.stderr);
  const retained = readProductionConfig(file);
  for (const name of ['INFOQ_API_REQUEST_PRIVATE_KEY', 'INFOQ_BROWSER_SESSION_ORIGINS', 'INFOQ_BROWSER_SESSION_COOKIE_PATH', 'INFOQ_BROWSER_SESSION_SECURE', 'INFOQ_BROWSER_SESSION_TTL_SECONDS']) assert.equal(retained[name], original[name], `Apple init changed existing ${name}`);
  assert.ok(!(first.stdout + first.stderr + second.stdout + second.stderr).includes(original.INFOQ_API_REQUEST_PRIVATE_KEY));
  const production = spawnSync(installShell, [path.join(root, 'deploy/apple-container.sh'), 'up'], {...options, env: {...options.env, INFOQ_ENV_FILE: fixture.configFile}});
  assert.notEqual(production.status, 0); assert.match(production.stderr, /development/u);
  const invalidFile = path.join(dir, 'invalid.env');
  for (const overrides of [{INFOQ_BROWSER_SESSION_ORIGINS: 'http://external.test'}, {INFOQ_BROWSER_SESSION_COOKIE_PATH: '/prod-api/auth/browser-session'}, {INFOQ_BROWSER_SESSION_TTL_SECONDS: '0'}]) {
    fs.writeFileSync(invalidFile, Object.entries({...original, ...overrides}).map(([name, value]) => `${name}=${JSON.stringify(value)}`).join('\n') + '\n', {mode: 0o600});
    const invalid = spawnSync(installShell, [path.join(root, 'deploy/apple-container.sh'), 'up'], {...options, env: {...options.env, INFOQ_ENV_FILE: invalidFile}});
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /Origin|COOKIE_PATH|TTL_SECONDS/u);
    assert.ok(!(invalid.stdout + invalid.stderr).includes(original.INFOQ_API_REQUEST_PRIVATE_KEY));
  }
  assert.equal(fs.existsSync(daemonCalls), false, 'invalid configuration must fail before calling Apple daemon');
});
if (process.platform !== 'win32') test('远程bootstrap只替换带归属marker的源码，未知旧目录保留', () => {
  const base = path.join(run, 'bootstrap'); fs.mkdirSync(base);
  const archive = path.join(base, 'archive'); fs.mkdirSync(archive); fs.writeFileSync(path.join(archive, 'fixture.txt'), 'new source\n', 'utf8');
  const script = path.join(base, 'functions.sh');
  fs.writeFileSync(script, fs.readFileSync(path.join(root, 'deploy/install.sh'), 'utf8').replace(/\nmain "\$@"\s*$/u, '\n'), 'utf8');
  const install = path.join(base, 'install'); fs.mkdirSync(path.join(install, 'source'), {recursive: true}); fs.writeFileSync(path.join(install, 'source/unknown.txt'), 'keep', 'utf8');
  const options = {encoding: 'utf8', timeout: 10000, env: {...process.env, TMPDIR: base, INFOQ_DEPLOY_MODE: 'development', INFOQ_INSTALL_DIR: install, INFOQ_TEST_SCRIPT: script, INFOQ_TEST_ARCHIVE: archive}};
  const command = 'source "$INFOQ_TEST_SCRIPT"\ncurl() { tar -cz -C "$INFOQ_TEST_ARCHIVE" .; }\nSOURCE_DIR=""\ndownload_source\n';
  const rejected = spawnSync(installShell, ['-c', command], options); assert.notEqual(rejected.status, 0); assert.match(rejected.stderr, /归属标记/u);
  assert.equal(fs.readFileSync(path.join(install, 'source/unknown.txt'), 'utf8'), 'keep');
  fs.writeFileSync(path.join(install, 'source/.infoq-installer-owned'), 'infoq-scaffold-ai\n', 'utf8');
  const allowed = spawnSync(installShell, ['-c', command], options); assert.equal(allowed.status, 0, allowed.stderr);
  assert.equal(fs.readFileSync(path.join(install, 'source/fixture.txt'), 'utf8'), 'new source\n');
  assert.equal(fs.readFileSync(path.join(install, 'source/.infoq-installer-owned'), 'utf8'), 'infoq-scaffold-ai\n');
});
fs.writeFileSync(path.join(run, 'results.json'), JSON.stringify({status: 'passed', tests, fixture: 'isolated-test-only', installShell: {command: installShell, version: installShellVersion, status: process.platform === 'win32' ? 'not-applicable' : 'passed'}, docker: 'not-executed: COPY dependency closure only'}, null, 2) + '\n', 'utf8');
console.log(`[production-config-test] PASS ${tests.length} scenarios; evidence: ${path.relative(root, run)}/results.json`);
