#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {generateKeyPairSync, randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateGatewayConfig, renderGatewayConfig, writeGateway} from './render-gateway.mjs';
import {runPolicy, MC_IMAGE, MC_RELEASE, MC_HASHES} from './minio-policy.mjs';
import {migratePermissions} from './migrate-permissions.mjs';
import {prepareVolumeUsers} from './prepare-volume-users.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidence = path.join(repo, 'tmp/production-readiness/deploy');
fs.mkdirSync(evidence, {recursive: true});
const runRoot = fs.mkdtempSync(path.join(evidence, 'fixtures-'));
const cases = [];
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
function fixture() { return fs.mkdtempSync(path.join(runRoot, 'case-')); }
function test(name, run) { return Promise.resolve().then(run).then(() => { cases.push({name, status: 'passed'}); console.log(`PASS ${name}`); }, (error) => { cases.push({name, status: 'failed', error: error.message}); console.error(`FAIL ${name}: ${error.stack}`); }); }
function certEnv(root, {days = '2', names = 'DNS:app.localhost,DNS:oss.localhost'} = {}) {
  const cert = path.join(root, 'certificate.pem'); const key = path.join(root, 'key.pem');
  const result = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', days, '-subj', '/CN=app.localhost', '-addext', `subjectAltName=${names}`], {encoding: 'utf8', timeout: 10000});
  assert.equal(result.status, 0, 'openssl fixture generation failed');
  fs.chmodSync(key, 0o600); fs.chmodSync(cert, 0o644);
  return {INFOQ_DEPLOY_MODE: 'production', INFOQ_CONFIG_SOURCE: 'isolated-test', INFOQ_PUBLIC_BASE_URL: 'https://app.localhost', INFOQ_OSS_PUBLIC_ORIGIN: 'https://oss.localhost', INFOQ_DEPLOY_ROOT: path.join(root, 'data'), INFOQ_TLS_CERT_FILE: cert, INFOQ_TLS_KEY_FILE: key, INFOQ_FRONTEND_TARGET: 'all'};
}
function dockerFixture(root, service = 'minio', {running = service === 'minio', permission = 'private', foreign = false} = {}) {
  const bin = path.join(root, 'bin'); fs.mkdirSync(bin);
  const source = path.join(root, 'data', service === 'minio' ? 'minio/data' : 'mysql/data'); fs.mkdirSync(source, {recursive: true});
  const state = path.join(root, 'docker.json'); const calls = path.join(root, 'calls.jsonl');
  const container = {Id: 'a'.repeat(64), Image: `sha256:${'b'.repeat(64)}`, State: {Running: running}, Config: {Labels: {'com.docker.compose.project': foreign ? 'foreign' : 'infoq-scaffold-ai', 'com.docker.compose.service': service}}, Mounts: [{Type: 'bind', Source: source, Destination: service === 'minio' ? '/data' : '/var/lib/mysql', RW: true}]};
  const policy = permission === 'private' ? null : {Version: '2012-10-17', Statement: [{Effect: 'Allow', Principal: '*', Action: ['s3:GetObject'], Resource: ['arn:aws:s3:::infoq/*']}]};
  const tool = {Id: `sha256:${'d'.repeat(64)}`, Os: 'linux', Architecture: 'arm64', Config: {Labels: {'cc.infoq.tool': 'minio-policy', 'cc.infoq.mc.recipe': '1', 'org.opencontainers.image.version': MC_RELEASE, 'org.opencontainers.image.source': 'https://github.com/minio/mc'}}};
  fs.writeFileSync(state, JSON.stringify({container, tool, permission, originalPermission: permission, policy, failPrivateOnce: false}));
  fs.writeFileSync(path.join(bin, 'mc'), `#!${process.execPath}
const fs=require('node:fs');const args=process.argv.slice(2);if(args[0]!=='--json'||args[1]!=='anonymous'||args[2]!=='set-json')process.exit(96);
// Match the fixed mc version's validation + operation: the file is opened twice.
const first=JSON.parse(fs.readFileSync(args[3],'utf8'));const second=JSON.parse(fs.readFileSync(args[3],'utf8'));if(JSON.stringify(first)!==JSON.stringify(second))process.exit(97);
const file=process.env.RUNTIME_STATE;const s=JSON.parse(fs.readFileSync(file,'utf8'));s.policy=second;s.permission=s.originalPermission;
if(s.reverseRestoredActions)s.policy.Statement=s.policy.Statement.map(statement=>({...statement,Action:[...statement.Action].reverse()}));
if(s.restoredPolicyMutation==='action')s.policy.Statement[0].Action[0]='s3:PutObject';
if(s.restoredPolicyMutation==='effect')s.policy.Statement[0].Effect='Deny';
if(s.restoredPolicyMutation==='resource')s.policy.Statement[0].Resource=['arn:aws:s3:::other/*'];
if(s.restoredPolicyMutation==='principal')s.policy.Statement[0].Principal={AWS:['arn:aws:iam::123456789012:root']};
if(s.restoredPolicyMutation==='condition')s.policy.Statement[0].Condition={StringEquals:{'aws:username':'changed'}};
fs.writeFileSync(file,JSON.stringify(s));console.log('{}');
`, {mode: 0o755});
  fs.writeFileSync(path.join(bin, 'docker'), `#!${process.execPath}
const fs=require('node:fs');const args=process.argv.slice(2);const file=process.env.RUNTIME_STATE;const s=JSON.parse(fs.readFileSync(file,'utf8'));
fs.appendFileSync(process.env.RUNTIME_CALLS,JSON.stringify(args)+'\\n');
if(args[0]==='container'&&args[1]==='ls'){console.log(s.container.Id+(s.shared?'\\n'+'c'.repeat(64):''));process.exit(0);}
if(args[0]==='container'&&args[1]==='inspect'){const all=[s.container];if(s.shared&&args.length>3)all.push({...s.container,Id:'c'.repeat(64)});console.log(JSON.stringify(all));process.exit(0);}
if(args[0]==='compose'&&s.compose){console.log(JSON.stringify(s.compose));process.exit(0);}
if(args[0]==='info'){console.log(s.daemonArchitecture||'aarch64');process.exit(0);}
if(args[0]==='image'&&args[1]==='ls'){if(args[4]!=='${MC_IMAGE}')process.exit(90);console.log(s.toolMissing?'':s.tool.Id);process.exit(0);}
if(args[0]==='build'){const recipe=fs.readFileSync(0,'utf8');if(args.join(' ')!=='build --tag ${MC_IMAGE} -'||!recipe.includes('FROM node:24.18.0')||!recipe.includes('FROM busybox:1.37.0')||!recipe.includes('${MC_HASHES.arm64}')||!recipe.includes('${MC_HASHES.amd64}'))process.exit(91);if(s.buildFail)process.exit(17);s.toolMissing=false;fs.writeFileSync(file,JSON.stringify(s));console.log('built fixed tool');process.exit(0);}
if(args[0]==='image'&&args[1]==='inspect'){console.log(JSON.stringify(args[2]==='${MC_IMAGE}'?[s.tool]:[{Id:s.container.Image,Config:{User:s.imageUser===undefined?'fixture':s.imageUser}}]));process.exit(0);}
if(args.includes('id')){console.log(args.includes('-u')?process.getuid():process.getgid());process.exit(0);}
if(args.includes('--mount')){
 if(s.probeFail)process.exit(32);const {spawnSync}=require('node:child_process');const source=args[args.indexOf('--mount')+1].split(',').find(x=>x.startsWith('source=')).slice(7);const script=args[args.indexOf('-ec')+1].replaceAll('/probe',source);const result=spawnSync('/bin/sh',['-ec',script],{encoding:'utf8'});process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');process.exit(result.status??99);
}
const image=args.indexOf(s.tool.Id);if(image<0)process.exit(92);
if(args.includes('none')){if(args[args.indexOf('-ec')+1]!=='sha256sum /usr/local/bin/mc; mc --version')process.exit(95);console.log((s.toolProbeSha||'${MC_HASHES.arm64}')+'  /usr/local/bin/mc\\nmc version '+(s.toolProbeRelease||'${MC_RELEASE}')+' (commit-id=7394ce0)');process.exit(0);}
if(args[args.indexOf('--entrypoint')+1]==='/bin/sh'){
 const {spawnSync}=require('node:child_process');const input=fs.readFileSync(0);const result=spawnSync('/bin/sh',args.slice(image+1),{env:{...process.env,TMPDIR:require('node:path').dirname(file)},input,encoding:'utf8'});process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');process.exit(result.status??99);
}
const a=args.slice(image+2);
if(a[0]==='mb'){s.mbCalls=(s.mbCalls||0)+1;if(s.mbFailures){s.mbFailures--;fs.writeFileSync(file,JSON.stringify(s));console.log(s.mbRaw||JSON.stringify({status:'error',error:{message:'do-not-log-this-sensitive-message',cause:{error:{Code:s.mbCode}}}}));process.exit(12);}fs.writeFileSync(file,JSON.stringify(s));console.log(JSON.stringify({status:'success',bucket:'infoq/infoq'}));process.exit(0);}
if(a[0]!=='anonymous')process.exit(93);
if(a[1]==='get-json'){console.log(s.policyResponse===undefined?JSON.stringify({operation:'get-json',status:'success',bucket:'infoq/infoq',permission:s.permission,...(s.policy?{anonymous:s.policy}:{})}):s.policyResponse);process.exit(0);}
if(a[1]==='set'&&a[2]==='private'){if(s.failPrivateOnce){s.failPrivateOnce=false;fs.writeFileSync(file,JSON.stringify(s));process.exit(27);}s.permission='private';s.policy=null;}
else if(a[1]==='set-json')process.exit(98);
else process.exit(94);fs.writeFileSync(file,JSON.stringify(s));console.log('{}');
`, {mode: 0o755});
  return {env: {...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, RUNTIME_STATE: state, RUNTIME_CALLS: calls, INFOQ_DEPLOY_ROOT: path.join(root, 'data'), MINIO_ROOT_USER: 'fixture-user', MINIO_ROOT_PASSWORD: 'fixture-secret', INFOQ_OSS_BUCKET: 'infoq'}, state, calls, source};
}

await test('TLS main flow persists certificate-backed HTTPS and custom contexts on repeated rendering', () => {
  const root = fixture(); const env = certEnv(root); env.INFOQ_REACT_CONTEXT_PATH = '/admin/react/'; env.INFOQ_VUE_CONTEXT_PATH = '/admin/vue/';
  fs.mkdirSync(path.join(env.INFOQ_DEPLOY_ROOT, 'nginx/conf'), {recursive: true}); fs.mkdirSync(path.join(env.INFOQ_DEPLOY_ROOT, 'nginx/cert'));
  const config = validateGatewayConfig(env); writeGateway(config);
  const output = path.join(env.INFOQ_DEPLOY_ROOT, 'nginx/conf/nginx.conf'); const first = fs.readFileSync(output, 'utf8');
  writeGateway(validateGatewayConfig(env)); assert.equal(fs.readFileSync(output, 'utf8'), first);
  assert.match(first, /listen 443 ssl;/u); assert.match(first, /return 308 https:\/\/\$host\$request_uri/u);
  assert.match(first, /location \^~ \/admin\/react\//u); assert.match(first, /server_name oss.localhost/u);
  assert.match(first, /proxy_pass http:\/\/minio:9000;/u); assert.ok(!first.includes('proxy_pass http://minio:9000/;'));
  assert.equal(fs.statSync(path.join(env.INFOQ_DEPLOY_ROOT, 'nginx/cert/tls.key')).mode & 0o777, 0o600);
  assert.ok(!first.includes('$request"')); assert.ok(!first.includes('$args'));
});
await test('TLS missing, unsafe key, wrong key, wrong SAN and HTTP downgrade fail before writes', () => {
  const root = fixture(); const env = certEnv(root);
  assert.throws(() => validateGatewayConfig({...env, INFOQ_CONFIG_SOURCE: 'controlled-file'}), /TLS/u);
  for (const change of [{INFOQ_TLS_CERT_FILE: path.join(root, 'missing')}, {INFOQ_OSS_PUBLIC_ORIGIN: 'https://other.localhost'}, {INFOQ_PUBLIC_BASE_URL: 'http://app.localhost'}, {INFOQ_OSS_PUBLIC_ORIGIN: 'https://oss.localhost/oss'}, {INFOQ_PUBLIC_BASE_URL: 'https://app.localhost:444'}]) assert.throws(() => validateGatewayConfig({...env, ...change}));
  const pair = generateKeyPairSync('rsa', {modulusLength: 2048}); fs.writeFileSync(env.INFOQ_TLS_KEY_FILE, pair.privateKey.export({type: 'pkcs8', format: 'pem'}));
  assert.throws(() => validateGatewayConfig(env), /TLS/u);
  certEnv(root); fs.chmodSync(env.INFOQ_TLS_KEY_FILE, 0o644); assert.throws(() => validateGatewayConfig(env), /0600/u);
  assert.equal(fs.existsSync(env.INFOQ_DEPLOY_ROOT), false);
});
await test('expired TLS and not-yet-valid certificates fail explicitly', () => {
  const root = fixture(); const env = certEnv(root); const future = Date.now;
  try { Date.now = () => future() + 4 * 24 * 3600 * 1000; assert.throws(() => validateGatewayConfig(env), /TLS/u); Date.now = () => future() - 24 * 3600 * 1000; assert.throws(() => validateGatewayConfig(env), /TLS/u); } finally { Date.now = future; }
});
await test('render failure restores existing configuration and key material, removes staging files', () => {
  const root = fixture(); const env = certEnv(root); fs.mkdirSync(path.join(env.INFOQ_DEPLOY_ROOT, 'nginx/conf'), {recursive: true}); fs.mkdirSync(path.join(env.INFOQ_DEPLOY_ROOT, 'nginx/cert'));
  const config = validateGatewayConfig(env); writeGateway(config); const file = path.join(env.INFOQ_DEPLOY_ROOT, 'nginx/conf/nginx.conf'); fs.writeFileSync(file, 'previous config');
  const rename = fs.renameSync; let count = 0;
  try { fs.renameSync = (...args) => { if (++count === 2) throw new Error('injected rename failure'); return rename(...args); }; assert.throws(() => writeGateway(config), /injected/u); } finally { fs.renameSync = rename; }
  assert.equal(fs.readFileSync(file, 'utf8'), 'previous config');
  assert.ok(fs.readdirSync(path.dirname(file)).every((name) => !name.startsWith('.infoq-')));
  assert.ok(fs.readdirSync(path.join(env.INFOQ_DEPLOY_ROOT, 'nginx/cert')).every((name) => !name.startsWith('.infoq-')));
});
await test('context collisions, reserved prefixes and implicit TLS fallback are refused', () => {
  const root = fixture(); const env = {INFOQ_DEPLOY_MODE: 'development', INFOQ_PUBLIC_BASE_URL: 'http://app.localhost', INFOQ_OSS_PUBLIC_ORIGIN: 'http://oss.localhost', INFOQ_DEPLOY_ROOT: path.join(root, 'data')};
  for (const change of [{INFOQ_REACT_CONTEXT_PATH: '/vue/'}, {INFOQ_REACT_CONTEXT_PATH: '/prod-api/client/'}, {INFOQ_REACT_CONTEXT_PATH: '/vue/child/'}, {INFOQ_TLS_KEY_FILE: '/tmp/key'}]) assert.throws(() => validateGatewayConfig({...env, ...change}));
  assert.match(renderGatewayConfig(validateGatewayConfig({...env, INFOQ_FRONTEND_TARGET: 'react'})), /proxy_pass http:\/\/infoq-frontend-react:9092;/u);
});
await test('default production helper rejects missing controlled inputs before directory and Docker effects', () => {
  const root = fixture(); const envFile = path.join(root, 'runtime.env'); fs.writeFileSync(envFile, `INFOQ_DEPLOY_ROOT=${quote(path.join(root, 'data'))}\n`, {mode: 0o600});
  for (const helper of ['infoq.sh', 'deploy-frontend.sh']) {
    const result = spawnSync('/bin/bash', [path.join(repo, 'deploy/bin', helper), 'prepare'], {env: {...process.env, INFOQ_ENV_FILE: envFile, INFOQ_PRODUCTION_CONFIG_FILE: ''}, encoding: 'utf8'});
    assert.notEqual(result.status, 0); assert.equal(fs.existsSync(path.join(root, 'data')), false);
  }
});
await test('strict production prepare injects validated security placeholders and callback bases without exposing keys', () => {
  const root = fixture(); const env = certEnv(root); const request = generateKeyPairSync('rsa', {modulusLength: 2048}); const response = generateKeyPairSync('rsa', {modulusLength: 2048});
  const file = path.join(root, 'runtime.env'); Object.assign(env, {INFOQ_PRODUCTION_CONFIG_FILE: file, VITE_APP_ENCRYPT: 'true', INFOQ_REACT_CONTEXT_PATH: '/admin/react/', INFOQ_VUE_CONTEXT_PATH: '/admin/vue/', INFOQ_DB_USERNAME: 'app_' + randomBytes(6).toString('hex'), MINIO_ROOT_USER: 'oss_' + randomBytes(6).toString('hex'), INFOQ_ADMIN_USERNAME: 'owner_' + randomBytes(6).toString('hex'), INFOQ_API_REQUEST_PRIVATE_KEY: request.privateKey.export({type: 'pkcs8', format: 'der'}).toString('base64'), VITE_APP_RSA_PUBLIC_KEY: request.publicKey.export({type: 'spki', format: 'der'}).toString('base64'), VITE_APP_RSA_PRIVATE_KEY: response.privateKey.export({type: 'pkcs8', format: 'der'}).toString('base64'), INFOQ_API_RESPONSE_PUBLIC_KEY: response.publicKey.export({type: 'spki', format: 'der'}).toString('base64')});
  for (const key of ['MYSQL_ROOT_PASSWORD', 'INFOQ_DB_PASSWORD', 'REDIS_PASSWORD', 'MINIO_ROOT_PASSWORD', 'SECURITY_TOKEN_SECRET']) env[key] = randomBytes(24).toString('hex');
  env.INFOQ_ADMIN_PASSWORD = `A1@${randomBytes(12).toString('hex')}`;
  fs.writeFileSync(file, Object.entries(env).map(([key, value]) => `${key}=${quote(value)}`).join('\n') + '\n', {mode: 0o600});
  fs.mkdirSync(path.join(env.INFOQ_DEPLOY_ROOT, 'server/config'), {recursive: true}); fs.writeFileSync(path.join(env.INFOQ_DEPLOY_ROOT, 'server/config/application-prod.yml'), 'api-decrypt:\n  enabled: false\n  privateKey: obsolete\n');
  for (const helper of ['infoq.sh', 'deploy-frontend.sh']) { const result = spawnSync('/bin/bash', [path.join(repo, 'deploy/bin', helper), 'prepare'], {env: {...process.env, INFOQ_ENV_FILE: file}, encoding: 'utf8'}); assert.equal(result.status, 0, result.stderr); for (const key of ['INFOQ_API_REQUEST_PRIVATE_KEY', 'VITE_APP_RSA_PRIVATE_KEY', 'REDIS_PASSWORD']) assert.ok(!`${result.stdout}${result.stderr}`.includes(env[key])); }
  const managed = fs.readFileSync(path.join(env.INFOQ_DEPLOY_ROOT, 'server/config/managed-security.yml'), 'utf8');
  assert.match(managed, /api-decrypt:\n  enabled: true\n  privateKey: \$\{INFOQ_API_REQUEST_PRIVATE_KEY\}/u); assert.match(managed, /'\[\/admin\/react\/\]': '\/admin\/react\/oauth\/callback'/u); assert.ok(!managed.includes(env.INFOQ_API_REQUEST_PRIVATE_KEY));
  assert.match(fs.readFileSync(path.join(env.INFOQ_DEPLOY_ROOT, 'nginx/conf/nginx.conf'), 'utf8'), /location \^~ \/admin\/vue\//u);
});
await test('runtime environment loader treats expressions as data and merges controlled source consistently', () => {
  const root = fixture(); const data = path.join(root, 'must-not-exist'); const envFile = path.join(root, 'runtime.env'); const extra = path.join(root, 'controlled.env');
  fs.writeFileSync(extra, `INFOQ_DEPLOY_ROOT=${quote(path.join(root, 'other-data'))}\nREDIS_PASSWORD=${quote('$(touch '+data+')')}\n`, {mode: 0o600});
  fs.writeFileSync(envFile, `INFOQ_PRODUCTION_CONFIG_FILE=${quote(extra)}\nINFOQ_DEPLOY_ROOT=${quote(path.join(root, 'data'))}\n`, {mode: 0o600});
  const result = spawnSync(process.execPath, [path.join(repo, 'deploy/bin/load-runtime-env.mjs'), envFile], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr); const parts = result.stdout.split('\0'); const values = Object.fromEntries(Array.from({length: (parts.length - 1) / 2}, (_, index) => [parts[index * 2], parts[index * 2 + 1]]));
  assert.equal(values.INFOQ_DEPLOY_ROOT, path.join(root, 'other-data')); assert.equal(values.REDIS_PASSWORD, '$(touch '+data+')'); assert.equal(fs.existsSync(data), false);
});
await test('private bucket ensure never enables anonymous access and contains no literal secret argv', async () => {
  const root = fixture(); const {env, calls} = dockerFixture(root);
  await assert.rejects(runPolicy('ensure', {env}), /显式 --execute/u);
  assert.equal((await runPolicy('ensure', {env, execute: true})).status, 'passed'); const commands = fs.readFileSync(calls, 'utf8');
  assert.ok(!commands.includes('latest')); assert.ok(!commands.includes(env.MINIO_ROOT_PASSWORD)); assert.ok(!commands.includes('set","download'));
});
await test('missing mc tool is explicit for preview and built exactly once before bucket operations', async () => {
  const root = fixture(); const {env, state, calls} = dockerFixture(root); const data = JSON.parse(fs.readFileSync(state, 'utf8')); data.toolMissing = true; fs.writeFileSync(state, JSON.stringify(data));
  await assert.rejects(runPolicy('plan', {env}), /prepare-tool --execute/u);
  assert.ok(!fs.readFileSync(calls, 'utf8').includes('"build"')); assert.ok(!fs.readFileSync(calls, 'utf8').includes('"run"'));
  await assert.rejects(runPolicy('prepare-tool', {env}), /显式 --execute/u);
  const prepared = await runPolicy('prepare-tool', {env, execute: true});
  assert.equal(prepared.image, data.tool.Id); assert.equal(prepared.sha256, MC_HASHES.arm64); assert.equal(prepared.architecture, 'arm64');
  assert.equal((await runPolicy('ensure', {env, execute: true})).status, 'passed');
  const commands = fs.readFileSync(calls, 'utf8'); assert.equal(commands.match(/"build"/gu)?.length, 1); assert.ok(commands.indexOf('"build"') < commands.indexOf('"mb"'));
  assert.ok(!commands.includes('"pull"')); assert.ok(commands.includes(`"${data.tool.Id}"`)); assert.ok(!commands.includes(env.MINIO_ROOT_PASSWORD));
});
await test('permanent mc preparation failures stop once before bucket readiness retries', async () => {
  const root = fixture(); const {env, state, calls} = dockerFixture(root); const data = JSON.parse(fs.readFileSync(state, 'utf8')); Object.assign(data, {toolMissing: true, buildFail: true}); fs.writeFileSync(state, JSON.stringify(data));
  await assert.rejects(runPolicy('ensure', {env, execute: true}), /工具镜像准备失败/u);
  const commands = fs.readFileSync(calls, 'utf8'); assert.equal(commands.match(/"build"/gu)?.length, 1); assert.ok(!commands.includes('"mb"')); assert.ok(!commands.includes('"run"'));
});
await test('mc images with wrong owner, release, architecture, OS or binary fail before policy access', async () => {
  for (const mode of ['owner', 'recipe', 'release', 'source', 'architecture', 'os', 'sha', 'version', 'unsupported']) {
    const root = fixture(); const {env, state, calls} = dockerFixture(root); const data = JSON.parse(fs.readFileSync(state, 'utf8'));
    if (mode === 'owner') data.tool.Config.Labels['cc.infoq.tool'] = 'foreign';
    if (mode === 'recipe') data.tool.Config.Labels['cc.infoq.mc.recipe'] = 'old';
    if (mode === 'release') data.tool.Config.Labels['org.opencontainers.image.version'] = 'unknown';
    if (mode === 'source') data.tool.Config.Labels['org.opencontainers.image.source'] = 'https://untrusted.invalid';
    if (mode === 'architecture') data.tool.Architecture = 'amd64';
    if (mode === 'os') data.tool.Os = 'windows';
    if (mode === 'sha') data.toolProbeSha = '0'.repeat(64);
    if (mode === 'version') data.toolProbeRelease = 'RELEASE.unknown';
    if (mode === 'unsupported') data.daemonArchitecture = 's390x';
    fs.writeFileSync(state, JSON.stringify(data)); await assert.rejects(runPolicy('ensure', {env, execute: true}), /架构|版本|SHA256/u);
    const commands = fs.readFileSync(calls, 'utf8'); assert.ok(!commands.includes('"build"')); assert.ok(!commands.includes('"mb"')); assert.ok(!commands.includes('"anonymous"'));
  }
});
await test('unknown or mismatched mc JSON protocols fail before mutation', async () => {
  for (const response of ['not-json', 'null', {operation: 'get', status: 'success', bucket: 'infoq/infoq', permission: 'private'}, {operation: 'get-json', status: 'success', bucket: 'other/infoq', permission: 'private'}, {operation: 'get-json', status: 'error', bucket: 'infoq/infoq', permission: 'private'}, {operation: 'get-json', status: 'success', bucket: 'infoq/infoq'}, {operation: 'get-json', status: 'success', bucket: 'infoq/infoq', permission: 'download', anonymous: {}}]) {
    const root = fixture(); const {env, state, calls} = dockerFixture(root); const data = JSON.parse(fs.readFileSync(state, 'utf8')); data.policyResponse = typeof response === 'string' ? response : JSON.stringify(response); fs.writeFileSync(state, JSON.stringify(data));
    await assert.rejects(runPolicy('migrate', {env, execute: true, backup: path.join(root, 'policy.json')}), /JSON|策略|响应/u);
    assert.ok(!fs.readFileSync(calls, 'utf8').includes('"set"')); assert.equal(fs.existsSync(path.join(root, 'policy.json')), false);
  }
});
await test('mc authorization and unstructured errors fail once and redact raw details', async () => {
  for (const mode of ['AccessDenied', 'SignatureDoesNotMatch', 'malformed']) {
    const root = fixture(); const {env, state, calls} = dockerFixture(root); const data = JSON.parse(fs.readFileSync(state, 'utf8')); Object.assign(data, {mbFailures: 50, mbCode: mode}); if (mode === 'malformed') data.mbRaw = `sensitive-${env.MINIO_ROOT_PASSWORD}`; fs.writeFileSync(state, JSON.stringify(data));
    await assert.rejects(runPolicy('ensure', {env, execute: true}), (error) => !error.message.includes(env.MINIO_ROOT_PASSWORD) && !error.message.includes('do-not-log-this-sensitive-message') && (mode === 'malformed' || error.message.includes(mode)));
    assert.equal(JSON.parse(fs.readFileSync(state, 'utf8')).mbCalls, 1); assert.ok(!fs.readFileSync(calls, 'utf8').includes('"anonymous"'));
  }
});
await test('mc retries only an explicitly classified temporary S3 error and then verifies private policy', async () => {
  const root = fixture(); const {env, state} = dockerFixture(root); const data = JSON.parse(fs.readFileSync(state, 'utf8')); Object.assign(data, {mbFailures: 1, mbCode: 'ServiceUnavailable'}); fs.writeFileSync(state, JSON.stringify(data));
  assert.equal((await runPolicy('ensure', {env, execute: true})).permission, 'private'); assert.equal(JSON.parse(fs.readFileSync(state, 'utf8')).mbCalls, 2);
});
await test('public bucket requires preview and explicit migration, backups restore exact original policy', async () => {
  const root = fixture(); const {env, state} = dockerFixture(root, 'minio', {permission: 'download'}); const backup = path.join(root, 'policy.json');
  await assert.rejects(runPolicy('ensure', {env, execute: true}), /匿名访问/u);
  assert.equal((await runPolicy('plan', {env})).permission, 'download'); assert.equal((await runPolicy('migrate', {env, backup})).executeRequired, true); assert.equal(fs.existsSync(backup), false);
  assert.equal((await runPolicy('migrate', {env, backup, execute: true})).permission, 'private'); assert.equal(fs.statSync(backup).mode & 0o777, 0o600);
  assert.equal((await runPolicy('restore', {env, backup})).executeRequired, true); assert.equal(JSON.parse(fs.readFileSync(state, 'utf8')).permission, 'private');
  assert.equal((await runPolicy('restore', {env, backup, execute: true})).permission, 'download');
  assert.ok(fs.readdirSync(root).every((name) => !name.startsWith('infoq-policy.')));
});
await test('upload and public mc policies preserve exact JSON through migration and restore', async () => {
  for (const permission of ['upload', 'public']) {
    const root = fixture(); const {env, state} = dockerFixture(root, 'minio', {permission}); const original = JSON.parse(fs.readFileSync(state, 'utf8')).policy; const backup = path.join(root, 'policy.json');
    assert.equal((await runPolicy('plan', {env})).permission, permission);
    assert.equal((await runPolicy('migrate', {env, backup, execute: true})).permission, 'private');
    assert.equal((await runPolicy('restore', {env, backup, execute: true})).permission, permission); assert.deepEqual(JSON.parse(fs.readFileSync(state, 'utf8')).policy, original);
    assert.ok(fs.readdirSync(root).every((name) => !name.startsWith('infoq-policy.')));
  }
});
await test('unknown policy and foreign container fail before policy mutation', async () => {
  for (const options of [{permission: 'custom'}, {foreign: true}]) { const root = fixture(); const {env, calls} = dockerFixture(root, 'minio', options); await assert.rejects(runPolicy('migrate', {env, backup: path.join(root, 'policy.json'), execute: true})); assert.ok(!fs.readFileSync(calls, 'utf8').includes('"set"')); }
});
await test('migration command failure restores and verifies original bucket policy', async () => {
  const root = fixture(); const {env, state} = dockerFixture(root, 'minio', {permission: 'download'}); const s = JSON.parse(fs.readFileSync(state, 'utf8')); s.failPrivateOnce = true; fs.writeFileSync(state, JSON.stringify(s));
  await assert.rejects(runPolicy('migrate', {env, backup: path.join(root, 'policy.json'), execute: true}), /已回读确认原策略恢复/u);
  assert.equal(JSON.parse(fs.readFileSync(state, 'utf8')).permission, 'download');
});
await test('real mc Action enumeration order preserves policy restore and failure rollback without changing backup checksum', async () => {
  for (const failPrivateOnce of [false, true]) {
    const root = fixture(); const {env, state} = dockerFixture(root, 'minio', {permission: 'download'}); const data = JSON.parse(fs.readFileSync(state, 'utf8')); const backup = path.join(root, 'policy.json');
    data.policy = {Statement: [{Action: ['s3:GetBucketLocation', 's3:ListBucket'], Effect: 'Allow', Principal: {AWS: ['*']}, Resource: ['arn:aws:s3:::infoq']}, {Action: ['s3:GetObject'], Effect: 'Allow', Principal: {AWS: ['*']}, Resource: ['arn:aws:s3:::infoq/*']}], Version: '2012-10-17'};
    Object.assign(data, {reverseRestoredActions: true, failPrivateOnce}); fs.writeFileSync(state, JSON.stringify(data));
    if (failPrivateOnce) await assert.rejects(runPolicy('migrate', {env, backup, execute: true}), /已回读确认原策略恢复/u);
    else {
      assert.equal((await runPolicy('migrate', {env, backup, execute: true})).permission, 'private');
      const originalBackup = fs.readFileSync(backup, 'utf8');
      assert.equal((await runPolicy('restore', {env, backup, execute: true})).permission, 'download'); assert.equal(fs.readFileSync(backup, 'utf8'), originalBackup);
    }
    const record = JSON.parse(fs.readFileSync(backup, 'utf8')); assert.deepEqual(record.original.policy, data.policy);
    const after = JSON.parse(fs.readFileSync(state, 'utf8')); assert.deepEqual(after.policy.Statement[0].Action, ['s3:ListBucket', 's3:GetBucketLocation']);
    assert.equal(after.permission, 'download'); assert.ok(fs.readdirSync(root).every((name) => !name.startsWith('infoq-policy.')));
  }
});
await test('policy restore still rejects changed action, effect, resource, principal and condition values', async () => {
  for (const mutation of ['action', 'effect', 'resource', 'principal', 'condition']) {
    const root = fixture(); const {env, state} = dockerFixture(root, 'minio', {permission: 'download'}); const data = JSON.parse(fs.readFileSync(state, 'utf8')); data.restoredPolicyMutation = mutation; fs.writeFileSync(state, JSON.stringify(data)); const backup = path.join(root, 'policy.json');
    assert.equal((await runPolicy('migrate', {env, backup, execute: true})).permission, 'private');
    await assert.rejects(runPolicy('restore', {env, backup, execute: true}), /恢复策略回读不符/u);
  }
});
await test('backup checksum remains strict even when tampering only reorders equivalent Action entries', async () => {
  const root = fixture(); const {env, state, calls} = dockerFixture(root, 'minio', {permission: 'download'}); const data = JSON.parse(fs.readFileSync(state, 'utf8')); data.policy.Statement[0].Action = ['s3:GetBucketLocation', 's3:ListBucket']; fs.writeFileSync(state, JSON.stringify(data)); const backup = path.join(root, 'policy.json');
  await runPolicy('migrate', {env, backup, execute: true}); const record = JSON.parse(fs.readFileSync(backup, 'utf8')); record.original.policy.Statement[0].Action.reverse(); fs.writeFileSync(backup, JSON.stringify(record));
  const before = fs.readFileSync(calls, 'utf8'); await assert.rejects(runPolicy('restore', {env, backup, execute: true}), /校验和/u);
  assert.ok(!fs.readFileSync(calls, 'utf8').slice(before.length).includes('"set-json"')); assert.equal(JSON.parse(fs.readFileSync(state, 'utf8')).permission, 'private');
});
await test('permissions preview is zero-write, execute stores tar/hash and restores original owner/mode', () => {
  const root = fixture(); const {env, source} = dockerFixture(root, 'mysql'); const file = path.join(source, 'records'); fs.writeFileSync(file, 'owned data', {mode: 0o666}); fs.chmodSync(file, 0o666);
  const options = {service: 'mysql', imageUser: String(process.getuid()), uid: process.getuid(), gid: process.getgid(), backup: path.join(root, 'permissions.json')};
  assert.equal(migratePermissions(options, env).action, 'preview'); assert.equal(fs.existsSync(options.backup), false); assert.equal(fs.statSync(file).mode & 0o777, 0o666);
  assert.equal(migratePermissions({...options, execute: true}, env).action, 'migrated'); assert.equal(fs.statSync(file).mode & 0o777, 0o640); assert.equal(fs.statSync(`${options.backup}.tar`).mode & 0o777, 0o600);
  assert.equal(migratePermissions({...options, restore: true}, env).action, 'restore-preview');
  assert.equal(migratePermissions({...options, restore: true, execute: true}, env).action, 'restored'); assert.equal(fs.statSync(file).mode & 0o777, 0o666); assert.equal(fs.readFileSync(file, 'utf8'), 'owned data');
});
await test('permissions reject foreign, running, wrong account and symlink scopes before backup', () => {
  for (const mode of ['foreign', 'running', 'uid', 'symlink']) {
    const root = fixture(); const {env, source} = dockerFixture(root, 'mysql', {foreign: mode === 'foreign', running: mode === 'running'});
    if (mode === 'symlink') fs.symlinkSync(path.join(root, 'outside'), path.join(source, 'link'));
    const options = {service: 'mysql', imageUser: String(process.getuid()), uid: process.getuid() + (mode === 'uid' ? 1 : 0), gid: process.getgid(), backup: path.join(root, 'permissions.json'), execute: true};
    assert.throws(() => migratePermissions(options, env)); assert.equal(fs.existsSync(options.backup), false);
  }
});
await test('shared data mounts fail migration before any policy or permission mutation', async () => {
  for (const service of ['mysql', 'minio']) {
    const root = fixture(); const {env, state, calls} = dockerFixture(root, service); const data = JSON.parse(fs.readFileSync(state, 'utf8')); data.shared = true; fs.writeFileSync(state, JSON.stringify(data));
    if (service === 'minio') await assert.rejects(runPolicy('migrate', {env, backup: path.join(root, 'policy.json'), execute: true}), /共享挂载/u);
    else assert.throws(() => migratePermissions({service, imageUser: String(process.getuid()), uid: process.getuid(), gid: process.getgid(), backup: path.join(root, 'permissions.json'), execute: true}, env), /共享挂载/u);
    assert.ok(!fs.readFileSync(calls, 'utf8').includes('"run"'));
  }
});
await test('permission apply failure rolls back exact enumerated owner/mode without deleting data', () => {
  const root = fixture(); const {env, source} = dockerFixture(root, 'mysql'); const file = path.join(source, 'records'); fs.writeFileSync(file, 'must persist'); fs.chmodSync(file, 0o664);
  const chmod = fs.chmodSync; let count = 0;
  try { fs.chmodSync = (...args) => { if (++count === 2) throw new Error('injected permission failure'); return chmod(...args); }; assert.throws(() => migratePermissions({service: 'mysql', imageUser: String(process.getuid()), uid: process.getuid(), gid: process.getgid(), backup: path.join(root, 'permissions.json'), execute: true}, env), /已恢复原权限/u); } finally { fs.chmodSync = chmod; }
  assert.equal(fs.statSync(file).mode & 0o777, 0o664); assert.equal(fs.readFileSync(file, 'utf8'), 'must persist');
});
await test('Compose defaults auxiliary ports to loopback and mounts controlled build/runtime security inputs', () => {
  const result = spawnSync('python3', ['-c', 'import json,yaml; print(json.dumps(yaml.safe_load(open("deploy/docker/docker-compose.yml",encoding="utf-8"))))'], {cwd: repo, encoding: 'utf8'}); assert.equal(result.status, 0, result.stderr); const config = JSON.parse(result.stdout);
  for (const [name, service] of Object.entries(config.services)) if (name !== 'nginx-web') for (const port of service.ports || []) assert.equal(port.host_ip, '${INFOQ_INTERNAL_BIND_HOST:-127.0.0.1}');
  for (const [name, service] of Object.entries(config.services)) for (const volume of service.volumes || []) {
    if (!volume.startsWith('${INFOQ_DEPLOY_ROOT:-/infoq}')) continue;
    const [source, target] = volume.replace('${INFOQ_DEPLOY_ROOT:-/infoq}', '/isolated/data').split(':');
    assert.equal(path.posix.resolve(source), source, `${name} bind source must satisfy the runtime's canonical path guard`);
    assert.equal(path.posix.resolve(target), target, `${name} bind target must use its canonical path`);
  }
  for (const client of ['vue', 'react']) { const build = config.services[`infoq-frontend-${client}`].build; assert.equal(build.context, '../..'); assert.deepEqual(build.secrets, ['production_config']); }
  assert.match(config.services['infoq-admin'].environment.SPRING_CONFIG_ADDITIONAL_LOCATION, /managed-security.yml$/u);
  assert.match(config.services['infoq-admin'].environment.INFOQ_API_REQUEST_PRIVATE_KEY, /INFOQ_API_REQUEST_PRIVATE_KEY/u);
});

await test('database mutations pass secrets via stdin with explicit SQL escaping semantics', () => {
  const root = fixture(); const source = fs.readFileSync(path.join(repo, 'deploy/bin/infoq.sh'), 'utf8');
  const extract = (name) => source.slice(source.indexOf(`${name}() {`), source.indexOf('\n}', source.indexOf(`${name}() {`)) + 2);
  const script = `${extract('sql_escape')}\n${extract('mysql_exec_root')}\ncompose() { printf '%s\\n' "$@" > "$RUNTIME_ARGUMENTS"; cat > "$RUNTIME_SQL"; }\nsql_escape "$RUNTIME_VALUE" > "$RUNTIME_ESCAPED"\nmysql_exec_root "CREATE USER 'fixture' IDENTIFIED BY '$(sql_escape "$RUNTIME_VALUE")';"\n`;
  const value = "quote'and\\backslash";
  const result = spawnSync('/bin/bash', ['-c', script], {env: {...process.env, RUNTIME_VALUE: value, RUNTIME_ARGUMENTS: path.join(root, 'args'), RUNTIME_SQL: path.join(root, 'sql'), RUNTIME_ESCAPED: path.join(root, 'escaped')}, encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr); assert.equal(fs.readFileSync(path.join(root, 'escaped'), 'utf8'), "quote''and\\backslash");
  assert.ok(!fs.readFileSync(path.join(root, 'args'), 'utf8').includes(value)); assert.match(fs.readFileSync(path.join(root, 'sql'), 'utf8'), /^SET SESSION sql_mode='NO_BACKSLASH_ESCAPES';/u);
});
await test('first deployment initializes only owned new empty volumes with actual image-user write probes', () => {
  const root = fixture(); const {env, source, state, calls} = dockerFixture(root, 'mysql'); fs.writeFileSync(path.join(root, 'data/mysql/.infoq-deploy-owner'), 'infoq-scaffold-ai\n');
  const saved = JSON.parse(fs.readFileSync(state, 'utf8')); saved.compose = {services: {mysql: {image: 'mysql:fixed', volumes: [{type: 'bind', source, target: '/var/lib/mysql', read_only: false}]}}}; fs.writeFileSync(state, JSON.stringify(saved));
  assert.equal(prepareVolumeUsers({services: ['mysql'], newDirectories: [source]}, env).action, 'preview'); assert.equal(fs.statSync(source).mode & 0o777, 0o755); assert.ok(!fs.readFileSync(calls, 'utf8').includes('"run"'));
  // A separate prepare process has no new-directory grant; empty alone must never permit chown.
  saved.probeFail = true; fs.writeFileSync(state, JSON.stringify(saved)); assert.throws(() => prepareVolumeUsers({services: ['mysql'], execute: true}, env), /不可读写挂载/u); assert.equal(fs.statSync(source).mode & 0o777, 0o755);
  saved.probeFail = false; fs.writeFileSync(state, JSON.stringify(saved));
  const result = prepareVolumeUsers({services: ['mysql'], newDirectories: [source], execute: true}, env); assert.equal(result.action, 'initialized-and-write-verified'); assert.equal(fs.statSync(source).mode & 0o777, 0o750); assert.deepEqual(fs.readdirSync(source), []);
  fs.writeFileSync(path.join(source, 'existing'), 'persistent'); fs.chmodSync(source, 0o755);
  assert.equal(prepareVolumeUsers({services: ['mysql'], execute: true}, env).action, 'initialized-and-write-verified'); assert.equal(fs.statSync(source).mode & 0o777, 0o755);
});
await test('first deployment refuses nonempty new or unowned volumes and restores permission on probe failure', () => {
  const root = fixture(); const {env, source, state} = dockerFixture(root, 'mysql'); const saved = JSON.parse(fs.readFileSync(state, 'utf8')); saved.compose = {services: {mysql: {image: 'mysql:fixed', volumes: [{type: 'bind', source, target: '/var/lib/mysql', read_only: false}]}}}; fs.writeFileSync(state, JSON.stringify(saved));
  saved.compose.services.mysql.volumes[0].source = `${source}/`; fs.writeFileSync(state, JSON.stringify(saved)); assert.throws(() => prepareVolumeUsers({services: ['mysql'], newDirectories: [source]}, env), /规范绝对路径/u);
  saved.compose.services.mysql.volumes[0].source = source; fs.writeFileSync(state, JSON.stringify(saved));
  fs.writeFileSync(path.join(root, 'data/mysql/.infoq-deploy-owner'), 'foreign\n'); assert.throws(() => prepareVolumeUsers({services: ['mysql'], newDirectories: [source], execute: true}, env), /归属未知/u);
  fs.writeFileSync(path.join(root, 'data/mysql/.infoq-deploy-owner'), 'infoq-scaffold-ai\n'); fs.writeFileSync(path.join(source, 'existing'), 'data'); assert.throws(() => prepareVolumeUsers({services: ['mysql'], newDirectories: [source], execute: true}, env), /不再为空/u); fs.rmSync(path.join(source, 'existing'));
  saved.probeFail = true; fs.writeFileSync(state, JSON.stringify(saved)); assert.throws(() => prepareVolumeUsers({services: ['mysql'], newDirectories: [source], execute: true}, env), /不可读写挂载/u); assert.equal(fs.statSync(source).mode & 0o777, 0o755); assert.deepEqual(fs.readdirSync(source), []);
});

const result = {createdAt: new Date().toISOString(), platform: process.platform, node: process.version, tests: cases, passed: cases.filter((item) => item.status === 'passed').length, failed: cases.filter((item) => item.status === 'failed').length, realLinuxDocker: 'not executed by this fixture suite; use separate Linux runner evidence for actual TLS, S3 signatures and UID compatibility', cleanup: 'fixture directory removed'};
fs.rmSync(runRoot, {recursive: true, force: true}); fs.writeFileSync(path.join(evidence, 'runtime-results.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(`${result.passed} production runtime scenarios passed; ${result.failed} failed`);
if (result.failed) process.exitCode = 1;
