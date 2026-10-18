#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import https from 'node:https';
import {spawn, spawnSync} from 'node:child_process';
import {createHash, randomBytes} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {createProductionFixture} from '../production_fixture.mjs';
import {readProductionConfig, validateProductionConfig} from '../production_config.mjs';
import {runProcess, checkHttp, s3Request} from './production_ops.mjs';
import {presignObject, assertAnonymousDenied} from './linux_acceptance.mjs';
import {loginWithRealCaptcha} from '../../skills/test-cli/scripts/captcha_login.mjs';
import {DEFAULT_CAPTCHA_KEY_PREFIX} from '../../skills/test-cli/scripts/redis_captcha_seed.mjs';
import {assertSafePath} from '../../deploy/bin/render-gateway.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const services = ['mysql', 'redis', 'minio', 'infoq-admin', 'infoq-frontend-vue', 'infoq-frontend-react', 'nginx-web'];
const ports = [80, 443, 3306, 6379, 9000, 9001, 9090, 9091, 9092];
const hash = value => createHash('sha256').update(value).digest('hex');
const help = `Linux Docker 原生 bind 首次安装验收
node tools/verify/first_install_acceptance.mjs --run-id <slug> --minio-image-user <已审阅账户> [--execute]
默认仅打印计划，不写文件、不调用 Docker。execute 需要专用 Linux VM 内 root、本机 Unix Docker、
Compose/BuildKit、Node 24.18.0、openssl/curl/tar/findmnt；复用 test-cli 的 Node 登录实现。
必须先审阅目标 MinIO 不可变镜像及 entrypoint，再显式指定用户；不猜 root。
真实调用 install.sh，使用全新 tmp/production-readiness/first-install-<run-id>/data 原生 bind；
占用默认容器名与 80/443/3306/6379/9000/9001/9090/9091/9092，不与其它验收栈并行。
验证 readiness、真实验证码登录、私有 S3、实际 daemon UID/owner/写入及重启持久性。
成功、失败或中断均清理本轮容器/匿名卷/network；0600 配置与 bind 数据保留在 owned tmp 目录。
自签证书及随机配置仅为隔离 fixture，不能据此声明公开 CA、生产秘密或真实 Provider 验收通过。
`;

export function parseFirstInstallArgs(args) {
  if (args.length === 0 || (args.length === 1 && args[0] === '--help')) return {help: true};
  const result = {execute: false};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--execute' && !result.execute) result.execute = true;
    else if (arg === '--run-id' && !result.runId && args[i + 1]) result.runId = args[++i];
    else if (arg === '--minio-image-user' && result.minioUser === undefined && args[i + 1]) result.minioUser = args[++i];
    else throw new Error('参数未知、重复或缺值');
  }
  if (!/^[a-z][a-z0-9-]{2,21}$/u.test(result.runId || '')) throw new Error('run-id 必须为 3..22 位小写字母/数字/连字符');
  if (!/^[A-Za-z0-9_-]+(?::[A-Za-z0-9_-]+)?$/u.test(result.minioUser || '')) throw new Error('必须显式提供已审阅的 --minio-image-user，不能默认猜 root');
  return result;
}

export function assertNativeFilesystem(type) {
  if (!['ext2', 'ext3', 'ext4', 'xfs', 'btrfs', 'zfs'].includes(type.trim())) throw new Error('验收目录必须位于 Linux 原生磁盘文件系统；拒绝 macOS 共享、9p、virtiofs、NFS、FUSE 或未知类型');
}

export function assertOwnedContainers(containers, {project, root, complete = false}) {
  if (!Array.isArray(containers) || containers.length > services.length) throw new Error('容器清单无效');
  const observed = new Set();
  for (const container of containers) {
    const labels = container.Config?.Labels || {}, service = labels['com.docker.compose.service'];
    if (labels['com.docker.compose.project'] !== project || !services.includes(service) || observed.has(service) || !/^[a-f0-9]{64}$/u.test(container.Id || '') || !/^sha256:[a-f0-9]{64}$/u.test(container.Image || '')) throw new Error('容器归属/服务/不可变身份不符，拒绝接管或清理');
    observed.add(service);
    for (const mount of container.Mounts || []) {
      if (mount.Type === 'bind' && mount.RW && (path.resolve(mount.Source) !== mount.Source || !mount.Source.startsWith(`${root}${path.sep}`))) throw new Error('可写 bind 越过本轮部署根，拒绝接管或清理');
    }
  }
  if (complete && (observed.size !== services.length || containers.some(c => !c.State?.Running))) throw new Error('首次安装未使七个真实服务全部运行');
  return containers;
}

// Child output may contain configuration errors. Redact complete lines before persisting it.
export async function runInstallShell(script, {args = [], env, logFile, secrets = [], signal, timeoutMs = 1800000, onPid = () => {}}) {
  if (signal?.aborted) throw new Error('安装操作已中断，未启动进程');
  const log = fs.openSync(logFile, 'a', 0o600);
  try {
    await new Promise((resolve, reject) => {
      const child = spawn('/bin/bash', [script, ...args], {cwd: repo, env, detached: true, stdio: ['ignore', 'pipe', 'pipe']});
      onPid(child.pid);
      const pending = new Map([[child.stdout, ''], [child.stderr, '']]);
      let total = 0, stopped = false, killTimer;
      const write = text => {
        for (const secret of secrets) if (secret) text = text.replaceAll(secret, '[REDACTED]');
        fs.writeSync(log, text);
      };
      const killGroup = sig => { try { process.kill(-child.pid, sig); } catch (error) { if (error.code !== 'ESRCH') throw error; } };
      const stop = () => {
        if (stopped) return;
        stopped = true; killGroup('SIGTERM');
        killTimer = setTimeout(() => killGroup('SIGKILL'), 5000);
      };
      const timer = setTimeout(stop, timeoutMs);
      signal?.addEventListener('abort', stop, {once: true});
      for (const stream of pending.keys()) { stream.setEncoding('utf8'); stream.on('data', chunk => {
        total += Buffer.byteLength(chunk);
        if (total > 32 * 1024 * 1024) { stop(); return; }
        let text = pending.get(stream) + chunk.toString('utf8');
        const last = text.lastIndexOf('\n');
        if (last >= 0) { write(text.slice(0, last + 1)); text = text.slice(last + 1); }
        if (text.length > 1024 * 1024) { stop(); text = ''; }
        pending.set(stream, text);
      }); }
      child.on('error', () => {});
      child.on('close', async code => {
        clearTimeout(timer); signal?.removeEventListener('abort', stop);
        for (const text of pending.values()) if (text) write(text + '\n');
        // A shell can exit before a background builder. Verify the entire owned process group.
        if (child.pid) {
          killGroup('SIGTERM');
          for (let i = 0; i < 50; i++) {
            const ps = spawnSync('ps', ['-eo', 'pgid=,stat='], {encoding: 'utf8'});
            if (ps.status !== 0) { clearTimeout(killTimer); reject(new Error('安装子进程组清理无法核验')); return; }
            const alive = ps.stdout.split('\n').some(line => { const [pgid, state] = line.trim().split(/\s+/u); return pgid === String(child.pid) && !state?.startsWith('Z'); });
            if (!alive) { clearTimeout(killTimer); onPid(null); code === 0 && !stopped ? resolve() : reject(new Error(`安装脚本失败 exit=${code ?? 'signal'}；超时/中断不会记为成功；见脱敏日志`)); return; }
            await delay(100);
          }
          killGroup('SIGKILL');
          clearTimeout(killTimer); reject(new Error('安装子进程组未及时退出，清理失败')); return;
        }
        clearTimeout(killTimer); reject(new Error('安装脚本无法启动'));
      });
    });
  } finally { fs.closeSync(log); }
}

async function ensureFreePorts() {
  for (const port of ports) await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error(`默认端口 ${port} 已占用或不可绑定；拒绝复用未知服务`)));
    server.listen({host: '0.0.0.0', port, exclusive: true}, () => server.close(error => error ? reject(new Error('端口探测清理失败')) : resolve()));
  });
}

async function tlsRequest(url, ca, signal) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, {ca, signal: AbortSignal.any([AbortSignal.timeout(10000), signal]), lookup: (_host, options, done) => options.all ? done(null, [{address: '127.0.0.1', family: 4}]) : done(null, '127.0.0.1', 4)}, response => {
      const chunks = []; let bytes = 0;
      response.on('data', chunk => { bytes += chunk.length; if (bytes > 1024 * 1024) request.destroy(); else chunks.push(chunk); });
      response.on('end', () => resolve({status: response.statusCode, body: Buffer.concat(chunks)}));
      response.on('error', () => reject(new Error('TLS 响应失败（正文与签名隐藏）')));
    });
    request.on('error', () => reject(new Error('TLS 请求失败（URL 参数与秘密隐藏）'))); request.end();
  });
}

export async function firstInstallAcceptance(args) {
  const project = `infoq-first-${args.runId}`, root = path.join(repo, 'tmp/production-readiness', `first-install-${args.runId}`), dataRoot = path.join(root, 'data');
  const plan = {mode: args.execute ? 'execute' : 'preview', project, root, ports, containerNames: services, minioImageUser: args.minioUser, minioEntryPointReviewRequired: true, installer: 'deploy/install.sh', filesystem: 'Linux native bind only; no named-volume substitution', checks: ['direct install', 'readiness', 'real captcha login', 'private signed S3', 'daemon UID/GID + bind owner/write', 'restart + account/object/SQL persistence'], cleanup: 'only owned project containers/anonymous volumes/network; preserve protected fixture/bind evidence'};
  console.log(JSON.stringify(plan));
  if (!args.execute) return plan;
  if (process.platform !== 'linux' || process.getuid?.() !== 0) throw new Error('真实首装仅在专用 Linux VM 内通过 sudo/root 执行；不能用 macOS 共享目录或普通 docker 组替代 chown 权限');
  if (process.version !== 'v24.18.0') throw new Error('首次安装验收要求仓库 Node 24.18.0 基线');
  assertSafePath(root);
  if (fs.existsSync(root)) throw new Error('本轮目录已存在；拒绝覆盖、复用旧数据或自动清空重试');
  let ancestor = path.dirname(root);
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const mount = spawnSync('findmnt', ['-n', '-o', 'FSTYPE', '--target', ancestor], {encoding: 'utf8'});
  if (mount.status !== 0) throw new Error('无法确认仓库/临时目录的实际文件系统');
  assertNativeFilesystem(mount.stdout);
  const context = JSON.parse((await runProcess(['context', 'inspect'])).toString());
  if (process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT || !context[0]?.Endpoints?.docker?.Host?.startsWith('unix://') || (await runProcess(['info', '--format', '{{.OSType}}'])).toString().trim() !== 'linux') throw new Error('只允许 VM 内本机 Unix Linux Docker，拒绝远程或宿主 context');
  const existing = (await runProcess(['container', 'ls', '--all', '--format', '{{json .}}'])).toString().split('\n').filter(Boolean).map(line => JSON.parse(line));
  if (existing.some(c => services.includes(c.Names)) || (await runProcess(['container', 'ls', '--all', '--quiet', '--filter', `label=com.docker.compose.project=${project}`])).toString().trim() || (await runProcess(['network', 'ls', '--quiet', '--filter', `label=com.docker.compose.project=${project}`])).toString().trim()) throw new Error('默认容器名或本轮 project 已存在；拒绝采用/删除其它栈');
  await ensureFreePorts();
  const fixture = createProductionFixture(root), env = readProductionConfig(fixture.configFile);
  Object.assign(env, {INFOQ_ENV_FILE: fixture.configFile, INFOQ_COMPOSE_PROJECT_NAME: project, COMPOSE_PROJECT_NAME: project, INFOQ_MINIO_IMAGE_USER: args.minioUser, INFOQ_INSTALL_DIR: path.join(root, 'install'), INFOQ_CONFIG_DIR: path.join(root, 'config'), INFOQ_CREDENTIALS_FILE: path.join(root, 'config/credentials.txt')});
  fs.writeFileSync(fixture.configFile, Object.entries(env).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', {mode: 0o600});
  validateProductionConfig(env, {source: fixture.configFile, scope: 'deploy'});
  const ownership = randomBytes(24).toString('hex'), marker = path.join(root, '.infoq-first-install-owner');
  fs.writeFileSync(marker, ownership, {mode: 0o600, flag: 'wx'});
  const stateFile = path.join(root, 'first-install.state.json'), logFile = path.join(root, 'install.redacted.log');
  const state = {status: 'starting', pid: process.pid, childPid: null, port: ports, log: path.relative(repo, logFile), project, stage: 'preflight', startedAt: new Date().toISOString(), filesystem: mount.stdout.trim(), configPurpose: fixture.purpose, deployable: false, checks: {}, cleanup: null};
  const update = () => fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n', {mode: 0o600});
  const abort = new AbortController(), stop = () => abort.abort();
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.once(signal, stop);
  const run = (command, options = {}) => runProcess(command, {...options, signal: abort.signal});
  const compose = (...command) => ['compose', '--project-name', project, '--env-file', fixture.configFile, '-f', path.join(repo, 'deploy/docker/docker-compose.yml'), ...command];
  const inspect = async (complete = false, runner = run) => {
    const ids = (await runner(['container', 'ls', '--all', '--quiet', '--no-trunc', '--filter', `label=com.docker.compose.project=${project}`])).toString().trim().split(/\s+/u).filter(Boolean);
    if (ids.some(id => !/^[a-f0-9]{64}$/u.test(id))) throw new Error('容器 ID 清单无效');
    return assertOwnedContainers(ids.length ? JSON.parse((await runner(['container', 'inspect', ...ids])).toString()) : [], {project, root: dataRoot, complete});
  };
  const childEnv = {PATH: process.env.PATH, HOME: process.env.HOME, LANG: 'C.UTF-8', ...env, INFOQ_SOURCE_DIR: repo, INFOQ_PRINT_SECRETS: '0', TMPDIR: root};
  const secretValues = Object.entries(env).filter(([key]) => /PASSWORD|SECRET|PRIVATE_KEY|RSA_PUBLIC_KEY|RESPONSE_PUBLIC_KEY/u.test(key)).map(([, value]) => value);
  const readiness = {name: 'first-install-readiness', kind: 'readiness', url: 'http://127.0.0.1:9090/monitor/health/readiness', status: 200, timeoutMs: 10000, json: {status: 'UP'}};
  const s3 = {s3: {origin: 'http://127.0.0.1:9000', bucket: env.INFOQ_OSS_BUCKET, maxBytes: 1024 * 1024}, secrets: {accessKey: env.MINIO_ROOT_USER, secretKey: env.MINIO_ROOT_PASSWORD}};
  const ca = fs.readFileSync(fixture.certificate), objectKey = `first-install/${args.runId}.txt`, object = Buffer.from(`owned-first-install-${ownership}`);
  let primary;
  try {
    state.status = 'running'; state.stage = 'install'; update();
    await runInstallShell(path.join(repo, 'deploy/install.sh'), {env: childEnv, logFile, secrets: secretValues, signal: abort.signal, onPid: pid => { state.childPid = pid; update(); }});
    state.checks.directInstall = 'passed: no prior prepare, no Compose rewrite, native bind'; state.stage = 'readiness'; update();
    const containers = await inspect(true);
    await run(compose('up', '-d', '--no-build', '--no-recreate', '--wait', '--wait-timeout', '180'), {timeoutMs: 240000});
    await checkHttp(readiness, {}, {signal: abort.signal});
    assertAnonymousDenied(await tlsRequest('https://app.infoq.test/prod-api/system/user/list', ca, abort.signal));
    const probe = await tlsRequest('https://app.infoq.test/prod-api/auth/wechat-miniapp/enabled', ca, abort.signal);
    if (probe.status !== 200 || JSON.parse(probe.body).code !== 200 || JSON.parse(probe.body).data !== false) throw new Error('网关能力探测失败');
    state.checks.readinessAndTls = 'passed'; state.stage = 'daemon-identity'; update();
    for (const [service, processName, directory] of [['mysql', 'mysqld', '/var/lib/mysql'], ['redis', 'redis-server', '/redis/data'], ['minio', 'minio', '/data'], ['infoq-admin', 'java', '/infoq/server/logs']]) {
      const container = containers.find(c => c.Config.Labels['com.docker.compose.service'] === service);
      const status = (await run(['exec', container.Id, 'sh', '-ec', `for p in /proc/[0-9]*; do test -r "$p/comm" || continue; read -r name < "$p/comm"; case "$name" in '${processName}'*) cat "$p/status"; exit 0;; esac; done; exit 1`])).toString();
      const uid = Number(/^Uid:\s+\d+\s+(\d+)/mu.exec(status)?.[1]), gid = Number(/^Gid:\s+\d+\s+(\d+)/mu.exec(status)?.[1]);
      if (!Number.isSafeInteger(uid) || !Number.isSafeInteger(gid)) throw new Error(`未识别 ${service} 实际 daemon UID/GID`);
      const bind = container.Mounts.find(m => m.Destination.replace(/\/$/u, '') === directory && m.Type === 'bind' && m.RW);
      if (!bind) throw new Error(`${service} 数据目录不是实际可写 bind`);
      assertSafePath(bind.Source);
      const stat = fs.statSync(bind.Source);
      if (stat.uid !== uid || stat.gid !== gid || (stat.mode & 0o002)) throw new Error(`${service} bind owner/mode 与实际 daemon 不符`);
      await run(['exec', '--user', `${uid}:${gid}`, container.Id, 'sh', '-ec', `probe="$(mktemp '${directory}/.infoq-first.XXXXXX')"; trap 'rm -f "$probe"' EXIT; printf verified > "$probe"; test "$(cat "$probe")" = verified; rm "$probe"; test ! -e "$probe"; trap - EXIT`]);
      state.checks[`identity-${service}`] = {image: container.Image, uid, gid, bind: path.relative(root, bind.Source), mode: (stat.mode & 0o777).toString(8), writeReadDelete: 'passed'};
    }
    async function loginAndBusiness(label) {
      let login;
      try { login = await loginWithRealCaptcha({backendUrl: 'http://127.0.0.1:9090', username: env.INFOQ_ADMIN_USERNAME, password: env.INFOQ_ADMIN_PASSWORD, loginCandidates: '', rsaPublicKey: env.VITE_APP_RSA_PUBLIC_KEY, redisHost: '127.0.0.1', redisPort: 6379, redisUsername: '', redisPassword: env.REDIS_PASSWORD, redisDatabase: 0, redisTls: false, redisKeyPrefix: DEFAULT_CAPTCHA_KEY_PREFIX, captchaFetchRetryDelayMs: 16000, captchaFetchRetries: 3, maxCaptchaAttempts: 1, signal: abort.signal}, path.join(root, 'captcha', label)); }
      catch { throw new Error(`真实验证码登录失败: ${label}（上游正文隐藏）`); }
      await checkHttp({name: 'protected-menu', kind: 'business', url: 'http://127.0.0.1:9090/system/menu/getRouters', status: 200, timeoutMs: 10000, json: {code: 200}, authorizationKey: 'bearer', headers: {clientid: 'e5cd7e4891bf95d1d19206ce24a7b32e'}}, {bearer: `Bearer ${login.token}`}, {signal: abort.signal});
      state.checks[`captcha-${label}`] = 'real encrypted login + protected menu passed';
    }
    state.stage = 'login-and-private-s3'; update(); await loginAndBusiness('before-restart');
    await s3Request(s3, 'PUT', objectKey, {body: object, signal: abort.signal});
    const unsigned = new URL(`/${env.INFOQ_OSS_BUCKET}/${objectKey}`, env.INFOQ_OSS_PUBLIC_ORIGIN);
    if ((await tlsRequest(unsigned, ca, abort.signal)).status !== 403) throw new Error('实际 MinIO bucket 未拒绝匿名读取');
    const signed = presignObject(env, objectKey, 5), read = await tlsRequest(signed, ca, abort.signal);
    if (read.status !== 200 || !read.body.equals(object)) throw new Error('实际 HTTPS 代理签名/对象校验失败');
    await delay(6200, undefined, {signal: abort.signal});
    if ((await tlsRequest(signed, ca, abort.signal)).status !== 403) throw new Error('实际过期签名未拒绝');
    state.checks.privateS3 = {signed: 'passed', anonymous: 'denied', expired: 'denied', objectSha256: hash(object)};
    const mysql = containers.find(c => c.Config.Labels['com.docker.compose.service'] === 'mysql');
    const snapshot = async () => hash(await run(['exec', '-i', mysql.Id, 'sh', '-ec', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot --batch --skip-column-names infoq'], {input: 'SELECT user_id,user_name,status,del_flag FROM sys_user ORDER BY user_id; SELECT user_id,role_id FROM sys_user_role ORDER BY user_id,role_id; SELECT oss_config_id,bucket_name,access_policy,status FROM sys_oss_config ORDER BY oss_config_id;'}));
    const before = await snapshot();
    state.stage = 'restart-and-persistence'; update();
    await run(compose('restart', 'mysql', 'redis', 'minio'), {timeoutMs: 240000});
    await run(compose('up', '-d', '--no-build', '--no-recreate', '--wait', '--wait-timeout', '180', 'mysql', 'redis', 'minio'), {timeoutMs: 240000});
    await runInstallShell(path.join(repo, 'deploy/bin/infoq.sh'), {args: ['restart'], env: childEnv, logFile, secrets: secretValues, signal: abort.signal, onPid: pid => { state.childPid = pid; update(); }});
    await runInstallShell(path.join(repo, 'deploy/bin/deploy-frontend.sh'), {args: ['restart', 'all'], env: childEnv, logFile, secrets: secretValues, signal: abort.signal, onPid: pid => { state.childPid = pid; update(); }});
    await run(compose('up', '-d', '--no-build', '--no-recreate', '--wait', '--wait-timeout', '180'), {timeoutMs: 240000});
    await checkHttp(readiness, {}, {signal: abort.signal}); await loginAndBusiness('after-restart');
    if (await snapshot() !== before || !(await s3Request(s3, 'GET', objectKey, {signal: abort.signal})).equals(object)) throw new Error('重启后 SQL/对象数据不一致');
    const persisted = await tlsRequest(presignObject(env, objectKey, 30), ca, abort.signal);
    if (persisted.status !== 200 || !persisted.body.equals(object)) throw new Error('重启后网关/私有签名访问失败');
    if ((await tlsRequest(unsigned, ca, abort.signal)).status !== 403) throw new Error('重启后私有对象匿名权限变化');
    await inspect(true); state.checks.restartPersistence = {sqlSha256: before, sameCredentialsLogin: 'passed', objectAndGateway: 'passed'};
    state.status = 'passed'; state.stage = 'complete';
  } catch (error) { primary = error; state.status = abort.signal.aborted ? 'interrupted' : 'failed'; state.error = error.message; }
  finally {
    state.stageBeforeCleanup = state.stage; state.stage = 'cleanup'; update();
    try {
      if (fs.readFileSync(marker, 'utf8') !== ownership) throw new Error('本轮目录归属标记变化');
      await inspect(false, runProcess);
      await runProcess(compose('down', '--volumes', '--timeout', '30'), {timeoutMs: 120000});
      if ((await runProcess(['container', 'ls', '--all', '--quiet', '--filter', `label=com.docker.compose.project=${project}`])).toString().trim() || (await runProcess(['network', 'ls', '--quiet', '--filter', `label=com.docker.compose.project=${project}`])).toString().trim()) throw new Error('本轮容器/network 清理未收敛');
      await ensureFreePorts();
      state.cleanup = {status: 'verified', containersNetworksAndAnonymousVolumesRemoved: true, nativeBindAndProtectedConfigRetained: true};
    } catch (error) { state.cleanup = {status: 'failed', error: error.message}; state.status = 'failed'; }
    state.finishedAt = new Date().toISOString(); state.stage = 'finished'; update();
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.removeListener(signal, stop);
    console.log(JSON.stringify({status: state.status, evidence: path.relative(repo, stateFile), cleanup: state.cleanup}));
  }
  if (primary || state.cleanup.status !== 'verified') throw new Error(`首次安装验收失败；stage=${state.stageBeforeCleanup}；cleanup=${state.cleanup.status}；见受控证据`);
  return state;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { const args = parseFirstInstallArgs(process.argv.slice(2)); if (args.help) console.log(help); else await firstInstallAcceptance(args); }
  catch (error) { console.error(`[first-install-acceptance] ${error.message}`); process.exitCode = 1; }
}
