#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {generateKeyPairSync} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {frontendBuildCacheKey, frontendBuildConfig, readProductionConfig} from './production_config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'tmp/production-readiness/build', `cache-${Date.now()}-${process.pid}`);
fs.mkdirSync(output, {recursive: true, mode: 0o700});
const pair = () => {
  const keys = generateKeyPairSync('rsa', {modulusLength: 2048});
  return {publicKey: keys.publicKey.export({format: 'der', type: 'spki'}).toString('base64'), privateKey: keys.privateKey.export({format: 'der', type: 'pkcs8'}).toString('base64')};
};
const request = pair();
const response = pair();
const rotated = pair();
const env = {
  INFOQ_DEPLOY_MODE: 'production', INFOQ_CONFIG_SOURCE: 'controlled-file', VITE_APP_ENCRYPT: 'true',
  INFOQ_PUBLIC_BASE_URL: 'https://app.infoq.test', INFOQ_BROWSER_SESSION_ORIGINS: '',
  INFOQ_BROWSER_SESSION_COOKIE_PATH: '/prod-api/auth/browser-session', INFOQ_BROWSER_SESSION_SECURE: 'true', INFOQ_BROWSER_SESSION_TTL_SECONDS: '2592000',
  VITE_APP_RSA_PUBLIC_KEY: request.publicKey, INFOQ_API_REQUEST_PRIVATE_KEY: request.privateKey,
  VITE_APP_RSA_PRIVATE_KEY: response.privateKey, INFOQ_API_RESPONSE_PUBLIC_KEY: response.publicKey
};
const tests = [];
const test = (name, action) => { action(); tests.push({name, status: 'passed'}); };
const writeConfig = (file, values) => fs.writeFileSync(file, Object.entries(values).map(([name, value]) => `${name}=${JSON.stringify(value)}`).join('\n') + '\n', {encoding: 'utf8', mode: 0o600});
const config = path.join(output, 'production.env');
writeConfig(config, env);
const digest = frontendBuildCacheKey(env);
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(?:INFOQ_|VITE_APP_)/u.test(name)));
const cli = (file) => spawnSync(process.execPath, [path.join(root, 'tools/production_config.mjs'), 'frontend-cache-key', '--env-file', file], {env: cleanEnv, encoding: 'utf8', timeout: 10000});

test('受控浏览器输入自动生成唯一非秘密 SHA256，CLI 与 API 一致', () => {
  assert.match(digest, /^[a-f0-9]{64}$/u);
  const result = cli(config);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `${digest}\n`);
  assert.equal(result.stderr, '');
});
test('同内容在重排、重定位、不同构建时间下保持缓存键稳定', () => {
  const moved = path.join(output, 'relocated.env');
  writeConfig(moved, {...Object.fromEntries(Object.entries(env).reverse()), INFOQ_PRODUCTION_CONFIG_FILE: moved, INFOQ_BUILD_TIMESTAMP: 'different-build-time'});
  assert.equal(frontendBuildCacheKey(readProductionConfig(moved)), digest);
  assert.equal(cli(moved).stdout, `${digest}\n`);
});
test('数据库、token 与后端运行配置不进入浏览器缓存摘要', () => {
  assert.equal(frontendBuildCacheKey({...env, MYSQL_ROOT_PASSWORD: 'unrelated-database-value', SECURITY_TOKEN_SECRET: 'unrelated-token-value', INFOQ_ADMIN_PASSWORD: 'unrelated-admin-value', INFOQ_PUBLIC_BASE_URL: 'https://other.infoq.test'}), digest);
});
test('独立请求密钥轮换改变缓存键', () => {
  assert.notEqual(frontendBuildCacheKey({...env, VITE_APP_RSA_PUBLIC_KEY: rotated.publicKey, INFOQ_API_REQUEST_PRIVATE_KEY: rotated.privateKey}), digest);
});
test('独立响应密钥轮换改变缓存键', () => {
  assert.notEqual(frontendBuildCacheKey({...env, VITE_APP_RSA_PRIVATE_KEY: rotated.privateKey, INFOQ_API_RESPONSE_PUBLIC_KEY: rotated.publicKey}), digest);
});
test('来源标识参与产物缓存，路径/API/端口由各自 Docker ARG 管理', () => {
  assert.notEqual(frontendBuildCacheKey({...env, INFOQ_CONFIG_SOURCE: 'isolated-test'}), digest);
  assert.equal(frontendBuildCacheKey({...env, VITE_APP_CONTEXT_PATH: '/other/', VITE_APP_BASE_API: '/prod-api', VITE_APP_PORT: '8080'}), digest);
  assert.throws(() => frontendBuildCacheKey({...env, VITE_APP_BASE_API: '/other-api'}), /VITE_APP_BASE_API/u);
});
test('密钥配对错误或禁用加密时不得输出可用缓存键', () => {
  assert.throws(() => frontendBuildCacheKey({...env, INFOQ_API_REQUEST_PRIVATE_KEY: rotated.privateKey}), /配对不匹配/u);
  assert.throws(() => frontendBuildCacheKey({...env, VITE_APP_ENCRYPT: 'false'}), /VITE_APP_ENCRYPT/u);
  const broken = path.join(output, 'broken.env');
  writeConfig(broken, {...env, INFOQ_API_REQUEST_PRIVATE_KEY: ''});
  const result = cli(broken);
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /INFOQ_API_REQUEST_PRIVATE_KEY/u);
});
test('挂载输入与 Docker ARG 一致才允许 Vite 注入浏览器密钥', () => {
  const processEnv = {INFOQ_PRODUCTION_CONFIG_FILE: config, INFOQ_FRONTEND_CONFIG_DIGEST: digest};
  const result = frontendBuildConfig({command: 'build', mode: 'production', env: {}, processEnv});
  assert.equal(result.metadata.configDigest, digest);
  assert.equal(processEnv.VITE_APP_RSA_PUBLIC_KEY, env.VITE_APP_RSA_PUBLIC_KEY);
  assert.equal(processEnv.VITE_APP_RSA_PRIVATE_KEY, env.VITE_APP_RSA_PRIVATE_KEY);
  assert.equal(Object.hasOwn(processEnv, 'INFOQ_API_REQUEST_PRIVATE_KEY'), false);
});
test('Docker 摘要缺失/过期在 Vite 注入密钥前明确拒绝', () => {
  for (const invalid of ['', 'stale', '0'.repeat(64)]) {
    const processEnv = {INFOQ_PRODUCTION_CONFIG_FILE: config, INFOQ_FRONTEND_CONFIG_DIGEST: invalid};
    assert.throws(() => frontendBuildConfig({command: 'build', mode: 'production', env: {}, processEnv}), /INFOQ_FRONTEND_CONFIG_DIGEST/u);
    assert.equal(Object.hasOwn(processEnv, 'VITE_APP_RSA_PRIVATE_KEY'), false);
  }
});
test('宿主非 Docker 生产构建仍可使用受控文件直接构建', () => {
  const result = frontendBuildConfig({command: 'build', mode: 'production', env: {}, processEnv: {INFOQ_PRODUCTION_CONFIG_FILE: config}});
  assert.equal(result.metadata.configDigest, digest);
});
test('两端 Docker RUN 与 Compose 显式接入自动缓存摘要', () => {
  for (const client of ['react', 'vue']) {
    const dockerfile = fs.readFileSync(path.join(root, `frontend-${client}/Dockerfile`), 'utf8');
    assert.match(dockerfile, /ARG INFOQ_FRONTEND_CONFIG_DIGEST\nRUN --mount=type=secret,id=production_config,required=true \\\n\s+INFOQ_FRONTEND_CONFIG_DIGEST=\$\{INFOQ_FRONTEND_CONFIG_DIGEST\}/u);
    assert.doesNotMatch(dockerfile, /(?:ARG|ENV)\s+(?:INFOQ_API_REQUEST_PRIVATE_KEY|VITE_APP_RSA_PRIVATE_KEY)/u);
  }
  const compose = fs.readFileSync(path.join(root, 'deploy/docker/docker-compose.yml'), 'utf8');
  assert.equal(compose.match(/INFOQ_FRONTEND_CONFIG_DIGEST: \$\{INFOQ_FRONTEND_CONFIG_DIGEST:-\}/gu)?.length, 2);
});

const script = fs.readFileSync(path.join(root, 'deploy/bin/deploy-frontend.sh'), 'utf8');
const buildFunction = /^build_frontends\(\) \{[\s\S]*?^\}/mu.exec(script)?.[0];
assert.ok(buildFunction, '必须验证实际部署函数');
const harness = path.join(output, 'build-harness.sh');
const rotationScript = path.join(output, 'rotate.mjs');
fs.writeFileSync(rotationScript, "import fs from 'node:fs'; fs.copyFileSync(process.env.CACHE_ROTATED, process.env.INFOQ_PRODUCTION_CONFIG_FILE);\n", 'utf8');
fs.writeFileSync(harness, `set -euo pipefail
TARGET_FRONTEND_SERVICES=(infoq-frontend-vue infoq-frontend-react)
validate_docker_credential_helpers() { :; }
resolve_compose_command() { :; }
compose() {
  printf '%s %s %s\\n' "$1" "$2" "$INFOQ_FRONTEND_CONFIG_DIGEST" >> "$CACHE_EVENTS"
  if [[ "$CACHE_SCENARIO" == rotate || "$CACHE_SCENARIO" == corrupt ]]; then node "$CACHE_ROTATION_SCRIPT"; fi
  if [[ "$CACHE_SCENARIO" == fail ]]; then return 37; fi
}
${buildFunction}
build_frontends
printf 'start\\n' >> "$CACHE_EVENTS"
`, {encoding: 'utf8', mode: 0o600});
const shellBuild = (scenario, rotatedEnv = env) => {
  const current = path.join(output, `${scenario}.env`);
  const next = path.join(output, `${scenario}-next.env`);
  const events = path.join(output, `${scenario}-events.log`);
  writeConfig(current, {...env, INFOQ_FRONTEND_CONFIG_DIGEST: 'stale-file-value'});
  writeConfig(next, rotatedEnv);
  const result = spawnSync('bash', [harness], {env: {...cleanEnv, REPO_ROOT: root, INFOQ_PRODUCTION_CONFIG_FILE: current, INFOQ_FRONTEND_CONFIG_DIGEST: 'stale-shell-value', CACHE_SCENARIO: scenario, CACHE_EVENTS: events, CACHE_ROTATED: next, CACHE_ROTATION_SCRIPT: rotationScript}, encoding: 'utf8', timeout: 20000});
  return {...result, events: fs.existsSync(events) ? fs.readFileSync(events, 'utf8').trim().split('\n') : []};
};
test('部署自动覆盖文件和 shell 旧摘要，两前端使用同一新摘要后才继续', () => {
  const result = shellBuild('success');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.events, [`build infoq-frontend-vue ${digest}`, `build infoq-frontend-react ${digest}`, 'start']);
});
test('第一前端构建失败保留错误码，不构建第二端或继续启动', () => {
  const result = shellBuild('fail');
  assert.equal(result.status, 37, result.stderr);
  assert.deepEqual(result.events, [`build infoq-frontend-vue ${digest}`]);
});
test('构建期间密钥轮换即使首个镜像成功，也阻止下一构建与启动', () => {
  const result = shellBuild('rotate', {...env, VITE_APP_RSA_PUBLIC_KEY: rotated.publicKey, INFOQ_API_REQUEST_PRIVATE_KEY: rotated.privateKey});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /构建期间发生变化/u);
  assert.deepEqual(result.events, [`build infoq-frontend-vue ${digest}`]);
});
test('构建期间配置损坏以真实校验原因阻止继续启动', () => {
  const result = shellBuild('corrupt', {...env, INFOQ_API_REQUEST_PRIVATE_KEY: ''});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /INFOQ_API_REQUEST_PRIVATE_KEY/u);
  assert.deepEqual(result.events, [`build infoq-frontend-vue ${digest}`]);
});
fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify({status: 'passed', tests, realBuildKitCache: '由 Linux Docker 实机 A/B 热缓存轮换另行验证'}, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({status: 'passed', count: tests.length, evidence: path.relative(root, output)}));
