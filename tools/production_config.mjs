#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash, createPrivateKey, createPublicKey, timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateGatewayConfig} from '../deploy/bin/render-gateway.mjs';

const rsaFields = ['VITE_APP_RSA_PUBLIC_KEY', 'INFOQ_API_REQUEST_PRIVATE_KEY', 'VITE_APP_RSA_PRIVATE_KEY', 'INFOQ_API_RESPONSE_PUBLIC_KEY'];
const credentialFields = ['MYSQL_ROOT_PASSWORD', 'INFOQ_DB_PASSWORD', 'REDIS_PASSWORD', 'MINIO_ROOT_PASSWORD', 'SECURITY_TOKEN_SECRET', 'INFOQ_ADMIN_PASSWORD'];
const samplePattern = /(?:change[-_ ]?me|replace[-_ ]?me|example|placeholder|default|password|123456|qwerty|admin123|your[-_ ])/iu;

function fail(message) {
  throw new Error(`[production-config] ${message}`);
}

export function readProductionConfig(file) {
  if (!path.isAbsolute(file) || path.resolve(file) !== file) fail('配置文件必须使用规范绝对路径');
  for (let current = file; current !== path.dirname(current); current = path.dirname(current)) {
    try { if (fs.lstatSync(current).isSymbolicLink()) fail('受控配置路径不允许符号链接'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  let stat;
  try { stat = fs.lstatSync(file); } catch { fail('受控配置文件不存在或不可读取'); }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 1024 * 1024) fail('受控配置必须是小于 1 MiB 的常规文件，不允许符号链接或硬链接');
  if (process.platform !== 'win32' && (stat.mode & 0o077) !== 0) fail('受控配置文件权限必须限制为当前所有者（例如 0600）');
  let content;
  try { content = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(fs.readFileSync(file)); } catch { fail('受控配置文件不可读取或不是有效 UTF-8'); }
  if (content.charCodeAt(0) === 0xfeff || content.includes('\0')) fail('受控配置必须为 UTF-8 without BOM 文本');
  const result = Object.create(null);
  for (const [index, line] of content.split(/\r?\n/u).entries()) {
    if (!line.trim() || /^\s*#/u.test(line)) continue;
    const match = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/u.exec(line);
    if (!match) fail(`配置文件第 ${index + 1} 行格式无效`);
    const [, key, raw] = match;
    if (Object.hasOwn(result, key)) fail(`配置项重复: ${key}`);
    let value = raw;
    if (raw.startsWith("'")) {
      if (!raw.endsWith("'")) fail(`配置项引号无效: ${key}`);
      const inner = raw.slice(1, -1).replaceAll("'\\''", '\u0001');
      if (inner.includes("'")) fail(`配置项引号无效: ${key}`);
      value = inner.replaceAll('\u0001', "'");
    } else if (raw.startsWith('"')) {
      try { value = JSON.parse(raw); } catch { fail(`配置项引号无效: ${key}`); }
      if (typeof value !== 'string') fail(`配置项必须为字符串: ${key}`);
    } else {
      value = raw.replace(/\s+#.*$/u, '');
      if (/[\r\n]/u.test(value)) fail(`配置项含无效字符: ${key}`);
    }
    result[key] = value;
  }
  return result;
}

export function runtimeConfigEntries(env) {
  const entries = Object.entries(env);
  for (const [name] of entries) {
    if (!/^(?:INFOQ_|MYSQL_|REDIS_|MINIO_|SECURITY_|VITE_APP_|APPLE_CONTAINER_|MQTT_|ES_)/u.test(name) && !['DEPLOY_ID', 'COMPOSE_PROJECT_NAME', 'TZ'].includes(name)) fail(`受控配置不允许覆盖进程运行时变量: ${name}`);
  }
  return entries;
}

function required(env, name) {
  const value = env[name];
  if (typeof value !== 'string' || !value || value !== value.trim() || /[\u0000-\u001f\u007f]/u.test(value)) fail(`缺失或无效配置项: ${name}`);
  return value;
}

function rsaKey(env, name, privateKey) {
  const value = env[name];
  if (typeof value !== 'string' || !value) fail(`缺失或无效配置项: ${name}`);
  let key;
  try {
    if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(value)) throw new Error();
    const bytes = Buffer.from(value, 'base64');
    if (bytes.toString('base64') !== value) throw new Error();
    key = privateKey ? createPrivateKey({key: bytes, format: 'der', type: 'pkcs8'}) : createPublicKey({key: bytes, format: 'der', type: 'spki'});
  } catch { fail(`RSA 格式无效（仅接受单行 Base64 DER，public SPKI / private PKCS8）: ${name}`); }
  if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails.modulusLength < 2048) fail(`必须使用至少 2048 位 RSA: ${name}`);
  return key;
}

export function validateRsaConfiguration(env) {
  const keys = rsaFields.map((name, index) => rsaKey(env, name, index === 1 || index === 2));
  const publicBytes = keys.map((key) => (key.type === 'private' ? createPublicKey(key) : key).export({format: 'der', type: 'spki'}));
  for (const [left, right] of [[0, 1], [2, 3]]) {
    if (publicBytes[left].length !== publicBytes[right].length || !timingSafeEqual(publicBytes[left], publicBytes[right])) fail(`RSA 配对不匹配: ${rsaFields[left]} / ${rsaFields[right]}`);
  }
  if (publicBytes[0].equals(publicBytes[2])) fail('请求与响应必须使用两组独立 RSA；服务端请求私钥不能出现在浏览器协议密钥中');
  return {request: createHash('sha256').update(publicBytes[0]).digest('hex'), response: createHash('sha256').update(publicBytes[2]).digest('hex'), minimumBits: 2048};
}

export function validateContextPath(value = '/') {
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/u.test(value)) fail('VITE_APP_CONTEXT_PATH 必须为本地绝对目录路径，例如 / 或 /react/');
  return value;
}

function origin(env, name, production) {
  const value = required(env, name);
  let url;
  try { url = new URL(value); } catch { fail(`URL 无效: ${name}`); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash || value.replace(/\/$/u, '') !== url.origin) fail(`必须使用无凭据、无路径的 HTTP(S) origin: ${name}`);
  if (production && (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) fail(`生产必须使用外部 HTTPS origin: ${name}`);
  return url;
}

export function validateBrowserSessionConfig(env, {apiPrefix = '/prod-api'} = {}) {
  const deploymentMode = env.INFOQ_DEPLOY_MODE || 'production';
  if (!['production', 'development'].includes(deploymentMode)) fail('INFOQ_DEPLOY_MODE 必须为 production 或 development');
  const production = deploymentMode === 'production';
  const publicOrigin = origin(env, 'INFOQ_PUBLIC_BASE_URL', production);
  const configuredOrigins = env.INFOQ_BROWSER_SESSION_ORIGINS;
  if (production && configuredOrigins) fail('生产浏览器会话 Origin 只使用 INFOQ_PUBLIC_BASE_URL，禁止 INFOQ_BROWSER_SESSION_ORIGINS');
  const origins = [publicOrigin.origin];
  if (!production) {
    const values = configuredOrigins === undefined || configuredOrigins === '' ? [] : configuredOrigins.split(',');
    for (const value of [publicOrigin.origin, ...values]) {
      const item = origin({VALUE: value}, 'VALUE', false);
      const hostname = item.hostname;
      if (item.protocol !== 'http:' || !(['localhost', '127.0.0.1', '[::1]'].includes(hostname) || /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+localhost$/u.test(hostname))) fail('development 浏览器会话禁止 HTTPS 或非 loopback Origin，仅允许精确 HTTP localhost、*.localhost、127.0.0.1、::1');
      if (!origins.includes(item.origin)) origins.push(item.origin);
    }
  }
  if (!['/prod-api', '/dev-api'].includes(apiPrefix) || (production && apiPrefix !== '/prod-api')) fail('浏览器会话 API 前缀与部署模式不一致');
  const cookiePath = required(env, 'INFOQ_BROWSER_SESSION_COOKIE_PATH');
  if (cookiePath !== `${apiPrefix}/auth/browser-session`) fail(`INFOQ_BROWSER_SESSION_COOKIE_PATH 必须匹配实际 API 路径 ${apiPrefix}/auth/browser-session`);
  const secure = required(env, 'INFOQ_BROWSER_SESSION_SECURE');
  if (!['true', 'false'].includes(secure) || (production && secure !== 'true')) fail('INFOQ_BROWSER_SESSION_SECURE 生产必须为 true；仅显式 HTTP loopback development 允许 false');
  const ttlText = env.INFOQ_BROWSER_SESSION_TTL_SECONDS === undefined ? '2592000' : required(env, 'INFOQ_BROWSER_SESSION_TTL_SECONDS');
  const ttlSeconds = Number(ttlText);
  if (!/^[1-9][0-9]*$/u.test(ttlText) || !Number.isSafeInteger(ttlSeconds) || ttlSeconds > 2592000) fail('INFOQ_BROWSER_SESSION_TTL_SECONDS 必须为不大于 2592000 的正整数');
  if (env.VITE_APP_BASE_API !== undefined && env.VITE_APP_BASE_API !== apiPrefix) fail('VITE_APP_BASE_API 必须与浏览器会话的同源代理 API 路径一致');
  return {deploymentMode, origins, cookiePath, secure: secure === 'true', ttlSeconds};
}

function validateCredentials(env) {
  const values = [];
  for (const name of credentialFields) {
    const value = required(env, name);
    const minimum = name === 'SECURITY_TOKEN_SECRET' ? 32 : 16;
    if (value.length < minimum || samplePattern.test(value) || new Set(value).size < 8 || !/[A-Za-z]/u.test(value) || !/[0-9]/u.test(value)) fail(`凭据缺少强度或仍为示例值: ${name}`);
    if (name === 'INFOQ_ADMIN_PASSWORD' && value.length > 30) fail('INFOQ_ADMIN_PASSWORD 不能超过密码登录契约的 30 个字符');
    values.push(value);
  }
  if (new Set(values).size !== values.length) fail('生产凭据必须相互独立，不得重复使用');
  for (const name of ['INFOQ_DB_USERNAME', 'MINIO_ROOT_USER', 'INFOQ_ADMIN_USERNAME']) {
    const value = required(env, name);
    if (!/^[A-Za-z][A-Za-z0-9_-]{2,63}$/u.test(value) || ['root', 'admin', 'infoq_app', 'infoqminio', 'minioadmin'].includes(value) || samplePattern.test(value)) fail(`生产用户名无效或仍为示例值: ${name}`);
    if (name === 'INFOQ_ADMIN_USERNAME' && value.length > 30) fail('INFOQ_ADMIN_USERNAME 不能超过密码登录契约的 30 个字符');
  }
}

export function validateProductionConfig(env, {scope = 'deploy', source = 'environment'} = {}) {
  if (!['deploy', 'frontend', 'apple'].includes(scope)) fail('scope 必须为 deploy、frontend 或 apple');
  const mode = env.INFOQ_DEPLOY_MODE || 'production';
  if (!['production', 'development'].includes(mode)) fail('INFOQ_DEPLOY_MODE 必须为 production 或 development');
  const production = mode === 'production';
  if (env.INFOQ_CONFIG_SOURCE && !['isolated-test', 'controlled-file', 'managed-environment'].includes(env.INFOQ_CONFIG_SOURCE)) fail('INFOQ_CONFIG_SOURCE 无效；托管来源需在目标环境独立确认');
  if (scope === 'frontend') {
    if (!production && env.INFOQ_CONFIG_SOURCE !== 'isolated-test') fail('development 前端构建必须显式声明 INFOQ_CONFIG_SOURCE=isolated-test，不得作为生产产物');
    if (env.VITE_APP_ENCRYPT !== 'true') fail('生产构建必须显式设置 VITE_APP_ENCRYPT=true');
    return {scope, mode, source, rsa: validateRsaConfiguration(env), browserSession: validateBrowserSessionConfig(env)};
  }
  if (scope === 'apple') {
    if (production) fail('Apple 本地栈仅支持显式 INFOQ_DEPLOY_MODE=development；生产基线为 Linux Docker');
    for (const name of ['MYSQL_ROOT_PASSWORD', 'INFOQ_DB_PASSWORD', 'REDIS_PASSWORD', 'SECURITY_TOKEN_SECRET']) {
      const value = required(env, name);
      if (value.length < (name === 'SECURITY_TOKEN_SECRET' ? 32 : 16) || samplePattern.test(value)) fail(`凭据缺少强度或仍为示例值: ${name}`);
    }
    return {scope, mode, source, rsa: validateRsaConfiguration(env), browserSession: validateBrowserSessionConfig(env, {apiPrefix: '/dev-api'})};
  }
  const publicOrigin = origin(env, 'INFOQ_PUBLIC_BASE_URL', production);
  const ossOrigin = origin(env, 'INFOQ_OSS_PUBLIC_ORIGIN', production);
  if (publicOrigin.hostname === ossOrigin.hostname || publicOrigin.port !== ossOrigin.port) fail('INFOQ_OSS_PUBLIC_ORIGIN 必须使用独立域名且与主站端口一致');
  const reactPath = validateContextPath(env.INFOQ_REACT_CONTEXT_PATH || '/react/');
  const vuePath = validateContextPath(env.INFOQ_VUE_CONTEXT_PATH || '/vue/');
  const target = env.INFOQ_FRONTEND_TARGET || 'all';
  if (target === 'all' && (reactPath === '/' || vuePath === '/' || reactPath.startsWith(vuePath) || vuePath.startsWith(reactPath))) fail('all 目标的 React/Vue context path 必须非根且互不重叠');
  if (env.INFOQ_INTERNAL_BIND_HOST && !['127.0.0.1', '::1'].includes(env.INFOQ_INTERNAL_BIND_HOST)) fail('INFOQ_INTERNAL_BIND_HOST 必须为 loopback；公开入口仅使用网关');
  const browserSession = validateBrowserSessionConfig(env);
  if (!production) {
    if (publicOrigin.protocol === 'https:' || ossOrigin.protocol === 'https:') fail('development HTTP 模式不得声称启用 HTTPS；HTTPS 请使用 production 配置');
    validateGatewayConfig(env);
    return {scope, mode, source, productionReady: false, browserSession};
  }
  for (const name of ['INFOQ_TLS_CERT_FILE', 'INFOQ_TLS_KEY_FILE', 'INFOQ_PRODUCTION_CONFIG_FILE']) {
    const file = required(env, name);
    if (!path.isAbsolute(file)) fail(`必须使用绝对文件路径: ${name}`);
    try { if (!fs.statSync(file).isFile() || fs.lstatSync(file).isSymbolicLink()) fail(`文件无效: ${name}`); } catch { fail(`文件不存在或无效: ${name}`); }
  }
  validateCredentials(env);
  if (env.VITE_APP_ENCRYPT !== 'true') fail('生产必须显式设置 VITE_APP_ENCRYPT=true');
  validateGatewayConfig(env);
  return {scope, mode, source, rsa: validateRsaConfiguration(env), browserSession, tls: 'key-validity-domains-and-provided-chain-consistency-verified-not-trust'};
}

export function frontendBuildCacheKey(env, {source = 'controlled-file'} = {}) {
  validateProductionConfig(env, {scope: 'frontend', source});
  // BuildKit secrets do not invalidate RUN cache. Only browser-visible inputs
  // belong in this digest; backend private keys and passwords stay out of ARGs.
  return createHash('sha256').update(JSON.stringify({
    schema: 1,
    encrypt: env.VITE_APP_ENCRYPT,
    requestPublicKey: env.VITE_APP_RSA_PUBLIC_KEY,
    responsePrivateKey: env.VITE_APP_RSA_PRIVATE_KEY,
    source: env.INFOQ_CONFIG_SOURCE || source,
    deployable: env.INFOQ_CONFIG_SOURCE !== 'isolated-test'
  })).digest('hex');
}

export function frontendBuildConfig({command, mode, env, processEnv = process.env}) {
  let contextPath = validateContextPath(env.VITE_APP_CONTEXT_PATH || '/');
  if (command !== 'build' || mode !== 'production') return {contextPath, metadata: null};
  const buildMode = processEnv.INFOQ_BUILD_MODE || 'production';
  if (buildMode !== 'production') fail('生产打包只允许 INFOQ_BUILD_MODE=production；隔离验证使用随机密钥 fixture，不关闭加密');
  const file = processEnv.INFOQ_PRODUCTION_CONFIG_FILE;
  if (!file && processEnv.INFOQ_CONFIG_SOURCE !== 'managed-environment') fail('生产构建必须提供 INFOQ_PRODUCTION_CONFIG_FILE 或显式 INFOQ_CONFIG_SOURCE=managed-environment');
  const controlled = file ? readProductionConfig(file) : processEnv;
  if (file) runtimeConfigEntries(controlled);
  contextPath = validateContextPath(processEnv.VITE_APP_CONTEXT_PATH || controlled.VITE_APP_CONTEXT_PATH || contextPath);
  const result = validateProductionConfig(controlled, {scope: 'frontend', source: file ? 'controlled-file' : 'managed-environment'});
  const actualBaseApi = processEnv.VITE_APP_BASE_API ?? env.VITE_APP_BASE_API ?? controlled.VITE_APP_BASE_API ?? '/prod-api';
  if (actualBaseApi !== '/prod-api') fail('production 构建的 VITE_APP_BASE_API 必须使用同源 /prod-api，与受控浏览器会话 cookie Path 一致');
  const configDigest = frontendBuildCacheKey(controlled, {source: result.source});
  if (Object.hasOwn(processEnv, 'INFOQ_FRONTEND_CONFIG_DIGEST') && processEnv.INFOQ_FRONTEND_CONFIG_DIGEST !== configDigest) fail('INFOQ_FRONTEND_CONFIG_DIGEST 缺失、无效或与受控构建输入不匹配；通过构建入口自动计算');
  for (const name of ['VITE_APP_RSA_PUBLIC_KEY', 'VITE_APP_RSA_PRIVATE_KEY', 'VITE_APP_ENCRYPT']) processEnv[name] = controlled[name];
  processEnv.VITE_APP_ENV = 'production';
  return {contextPath, metadata: {buildMode, deployable: controlled.INFOQ_CONFIG_SOURCE !== 'isolated-test', contextPath, source: controlled.INFOQ_CONFIG_SOURCE || result.source, rsa: result.rsa, configDigest}};
}

export function productionBuildMetadataPlugin(metadata) {
  return {name: 'infoq-build-metadata', generateBundle() { if (metadata) this.emitFile({type: 'asset', fileName: 'production-build.json', source: JSON.stringify(metadata, null, 2) + '\n'}); }};
}

export function verifyFrontendArtifact(directory, env, {allowIsolated = false} = {}) {
  const expected = validateProductionConfig(env, {scope: 'frontend'});
  let metadata;
  try { metadata = JSON.parse(fs.readFileSync(path.join(directory, 'production-build.json'), 'utf8')); } catch { fail('前端产物缺少有效 production-build.json'); }
  const isolated = env.INFOQ_CONFIG_SOURCE === 'isolated-test';
  if (metadata.buildMode !== 'production' || metadata.deployable !== !isolated || (isolated && !allowIsolated) || (metadata.source === 'isolated-test') !== isolated) fail('前端产物来源不可发布；隔离fixture必须显式允许且不得用于Release');
  if (metadata.rsa?.request !== expected.rsa.request || metadata.rsa?.response !== expected.rsa.response) fail('前端产物 RSA 指纹与目标受控配置不匹配');
  validateContextPath(metadata.contextPath);
  const material = rsaFields.map((name, index) => rsaKey(env, name, index === 1 || index === 2).export({format: 'der', type: index === 1 || index === 2 ? 'pkcs8' : 'spki'}).toString('base64'));
  const requestPrivateFragment = material[1].slice(-160, -96);
  const frontFragments = [material[0].slice(64, 112), material[2].slice(64, 112)];
  const sampleFragments = ['KoR8mX0rGKLqzcWmOzbfj64K8ZIgOdHnzkXSOVOZbFu', 'mc3CuPiGL/LcIIm7zryCEIbl1SPzBkr75E2VMtxegyZ1'];
  const found = new Set();
  if (!fs.lstatSync(directory).isDirectory() || fs.lstatSync(directory).isSymbolicLink()) fail('前端产物根目录无效');
  let files = 0, bytes = 0;
  function inspect(dir) {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) fail('前端产物不允许符号链接');
      if (entry.isDirectory()) inspect(file);
      else if (entry.isFile()) {
        files += 1;
        bytes += fs.statSync(file).size;
        if (files > 10000 || bytes > 512 * 1024 * 1024) fail('前端产物超过静态检查上限');
        if (!/\.(?:js|mjs|html|json|map)$/u.test(file)) continue;
        const content = fs.readFileSync(file, 'utf8');
        const normalized = content.replace(/\\[rn]|[\r\n]/gu, '');
        if (normalized.includes(requestPrivateFragment)) fail('前端产物包含服务端请求解密私钥，禁止发布');
        if (sampleFragments.some((fragment) => normalized.includes(fragment))) fail('前端产物包含仓库示例 RSA，禁止发布');
        frontFragments.forEach((fragment, index) => { if (normalized.includes(fragment)) found.add(index); });
      } else fail('前端产物必须只包含常规文件与目录');
    }
  }
  inspect(directory);
  if (!fs.existsSync(path.join(directory, 'index.html')) || found.size !== 2) fail('前端产物缺少入口或未包含已校验的前端协议密钥');
  return {status: 'passed', purpose: isolated ? 'isolated-test-only' : 'production-artifact', files, bytes, rsa: expected.rsa};
}

function main(args) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log('生产配置预检（只读，不打印秘密）\n用法: node tools/production_config.mjs check --scope deploy|frontend|apple [--env-file <绝对私有dotenv路径>]\n缓存: node tools/production_config.mjs frontend-cache-key [--env-file <配置>]（只输出自动计算的浏览器输入 SHA256）\n产物: node tools/production_config.mjs check-artifact --dir <dist目录> [--env-file <配置>] [--allow-isolated]\n生产默认严格；仅显式 INFOQ_DEPLOY_MODE=development 使用隔离开发模式。前端四向 RSA 必须至少 2048 位；隔离产物不能发布。');
    return;
  }
  const command = args.shift();
  if (!['check', 'check-artifact', 'frontend-cache-key'].includes(command)) fail('必须指定 check、frontend-cache-key 或 check-artifact；使用 --help 查看参数');
  const options = new Map();
  while (args.length) {
    const arg = args.shift();
    if (arg === '--allow-isolated' && command === 'check-artifact' && !options.has(arg)) { options.set(arg, true); continue; }
    const allowed = command === 'check' ? ['--scope', '--env-file'] : command === 'check-artifact' ? ['--dir', '--env-file'] : ['--env-file'];
    if (!allowed.includes(arg) || options.has(arg) || !args[0] || args[0].startsWith('--')) fail('未知、重复参数或缺少参数值');
    options.set(arg, args.shift());
  }
  const file = options.get('--env-file') || process.env.INFOQ_PRODUCTION_CONFIG_FILE;
  if (!file && process.env.INFOQ_DEPLOY_MODE !== 'development' && process.env.INFOQ_CONFIG_SOURCE !== 'managed-environment') fail('生产预检必须提供受控配置文件或显式 managed-environment 来源');
  const fileValues = file ? readProductionConfig(file) : null;
  if (fileValues) runtimeConfigEntries(fileValues);
  const env = fileValues ? {...process.env, ...fileValues} : process.env;
  if (command === 'frontend-cache-key') {
    console.log(frontendBuildCacheKey(env, {source: file ? 'controlled-file' : 'managed-environment'}));
    return;
  }
  if (command === 'check-artifact') {
    if (!options.get('--dir')) fail('产物检查必须指定 --dir');
    console.log(JSON.stringify(verifyFrontendArtifact(path.resolve(options.get('--dir')), env, {allowIsolated: options.has('--allow-isolated')})));
    return;
  }
  if (file && (options.get('--scope') || 'deploy') === 'deploy' && env.INFOQ_DEPLOY_MODE !== 'development' && path.resolve(env.INFOQ_PRODUCTION_CONFIG_FILE || '') !== path.resolve(file)) fail('生产部署环境文件必须与 INFOQ_PRODUCTION_CONFIG_FILE 为同一路径，保证校验、运行与构建同源');
  const result = validateProductionConfig(env, {scope: options.get('--scope') || 'deploy', source: file ? 'controlled-file' : 'managed-environment'});
  console.log(JSON.stringify({...result, status: 'passed'}));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
