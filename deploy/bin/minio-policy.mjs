#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {assertSafePath} from './render-gateway.mjs';
import {command, inspectOwnedContainer, assertExclusiveMount, readProtectedJSON} from './runtime-target.mjs';

export const MC_RELEASE = 'RELEASE.2025-08-13T08-35-41Z';
export const MC_IMAGE = `infoq/infoq-mc:${MC_RELEASE}`;
export const MC_HASHES = {
  amd64: '01f866e9c5f9b87c2b09116fa5d7c06695b106242d829a8bb32990c00312e891',
  arm64: '14c8c9616cfce4636add161304353244e8de383b2e2752c0e9dad01d4c27c12c',
};
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function sameBucketPolicy(left, right) {
  if (left.permission !== right.permission) return false;
  // MinIO/mc can enumerate the same S3 Action set in a different order on read.
  // Keep the backup checksum byte-sensitive; compare only runtime Action order as a set.
  const policies = [left.policy, right.policy].map((policy) => {
    if (!policy || !Array.isArray(policy.Statement)) return policy;
    return {...policy, Statement: policy.Statement.map((statement) => {
      if (!statement || !Array.isArray(statement.Action) || !statement.Action.every((action) => typeof action === 'string')) return statement;
      return {...statement, Action: [...statement.Action].sort()};
    })};
  });
  return isDeepStrictEqual(policies[0], policies[1]);
}

export function prepareMcTool({env = process.env, execute = false} = {}) {
  const machine = command('docker', ['info', '--format', '{{.Architecture}}'], {env}).trim();
  const architecture = ({x86_64: 'amd64', amd64: 'amd64', aarch64: 'arm64', arm64: 'arm64'})[machine];
  if (!architecture) throw new Error('不支持的 Docker daemon 架构；MinIO 工具镜像仅支持 Linux amd64/arm64');
  const ids = command('docker', ['image', 'ls', '--quiet', '--no-trunc', MC_IMAGE], {env}).trim();
  if (!ids) {
    if (!execute) throw new Error('缺少固定 MinIO 工具镜像；先运行 minio-policy.mjs prepare-tool --execute，预览不会构建或拉取');
    const dockerfile = fs.readFileSync(fileURLToPath(new URL('../docker/Dockerfile.mc', import.meta.url)), 'utf8');
    try { command('docker', ['build', '--tag', MC_IMAGE, '-'], {env, input: dockerfile, timeout: 300000}); }
    catch { throw new Error('MinIO 工具镜像准备失败；请核验固定 Node/BusyBox 镜像、官方 GitHub 下载和 SHA256（不会按 bucket 就绪错误重试）'); }
  } else if (!/^sha256:[a-f0-9]{64}$/u.test(ids)) throw new Error('MinIO 工具镜像清单无效');
  let image;
  try { const list = JSON.parse(command('docker', ['image', 'inspect', MC_IMAGE], {env})); if (list.length !== 1) throw new Error(); [image] = list; }
  catch { throw new Error('无法核验 MinIO 工具镜像身份'); }
  const labels = image.Config?.Labels || {};
  if (!/^sha256:[a-f0-9]{64}$/u.test(image.Id || '') || image.Os !== 'linux' || image.Architecture !== architecture ||
      labels['cc.infoq.tool'] !== 'minio-policy' || labels['cc.infoq.mc.recipe'] !== '1' ||
      labels['org.opencontainers.image.version'] !== MC_RELEASE || labels['org.opencontainers.image.source'] !== 'https://github.com/minio/mc') throw new Error('MinIO 工具镜像归属、版本或架构不符；拒绝运行/覆盖');
  const probe = command('docker', ['run', '--rm', '--network', 'none', '--entrypoint', '/bin/sh', image.Id, '-ec', 'sha256sum /usr/local/bin/mc; mc --version'], {env}).trim().split(/\r?\n/u);
  if (probe[0] !== `${MC_HASHES[architecture]}  /usr/local/bin/mc` || !probe[1]?.startsWith(`mc version ${MC_RELEASE} (commit-id=`)) throw new Error('MinIO 工具实际二进制 SHA256 或版本不符');
  return {image: image.Id, tag: MC_IMAGE, architecture, release: MC_RELEASE, sha256: MC_HASHES[architecture]};
}

export async function runPolicy(action, {env = process.env, execute = false, backup} = {}) {
  if (!['prepare-tool', 'ensure', 'plan', 'migrate', 'restore'].includes(action)) throw new Error('不支持的 bucket 操作');
  if (action === 'prepare-tool') {
    if (!execute || backup) throw new Error('prepare-tool 必须显式 --execute，不接受 backup');
    return {action, ...prepareMcTool({env, execute}), status: 'passed'};
  }
  if (action === 'plan' && (execute || backup)) throw new Error('plan 不接受迁移参数');
  if (action === 'ensure' && (!execute || backup)) throw new Error('ensure 必须显式 --execute（新建 bucket），不接受 backup');
  if (['migrate', 'restore'].includes(action) && !backup) throw new Error('迁移/恢复必须提供 --backup 绝对路径');
  const bucket = env.INFOQ_OSS_BUCKET || 'infoq';
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u.test(bucket) || bucket.includes('..')) throw new Error('INFOQ_OSS_BUCKET 无效');
  if (!env.MINIO_ROOT_USER || !env.MINIO_ROOT_PASSWORD) throw new Error('缺少 MinIO 受控凭据');
  const owned = inspectOwnedContainer('minio', '/data', env);
  if (owned.mount.Source !== path.join(owned.root, 'minio/data') || !owned.container.State?.Running) throw new Error('MinIO 挂载或运行状态不符');
  assertExclusiveMount(owned, env);
  // Resolve once, before bucket readiness retries; never retry registry/build failures.
  const tool = prepareMcTool({env, execute});
  const host = new URL('http://127.0.0.1:9000');
  host.username = env.MINIO_ROOT_USER; host.password = env.MINIO_ROOT_PASSWORD;
  const runEnv = {...env, MC_HOST_infoq: host.href};
  const target = `infoq/${bucket}`;
  const mc = (args, input) => {
    const base = ['run', '--rm', ...(input === undefined ? [] : ['-i']), '--network', `container:${owned.container.Id}`, '--env', 'MC_HOST_infoq'];
    // mc validates and opens set-json files twice; a pipe such as /dev/stdin
    // cannot satisfy that protocol. Keep the short-lived policy in container tmpfs.
    const script = 'umask 077; policy="$(mktemp "${TMPDIR:-/tmp}/infoq-policy.XXXXXX")"; trap \'rm -f "$policy"\' EXIT; cat > "$policy"; mc --json anonymous set-json "$policy" "$1"';
    const cli = input === undefined ? [...base, '--entrypoint', 'mc', tool.image, '--json', ...args] : [...base, '--tmpfs', '/tmp:rw,noexec,nosuid,size=1m', '--entrypoint', '/bin/sh', tool.image, '-ec', script, 'sh', target];
    const result = spawnSync('docker', cli, {env: runEnv, input, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024});
    if (result.error || result.status !== 0) {
      let body; try { body = JSON.parse(result.stdout); } catch { /* Unstructured failures are never safe to retry or print. */ }
      const code = body?.error?.cause?.error?.Code;
      const safeCode = ['AccessDenied', 'InvalidAccessKeyId', 'SignatureDoesNotMatch', 'InvalidBucketName', 'NoSuchBucket', 'NoSuchKey', 'RequestTimeTooSkewed', 'AuthorizationHeaderMalformed', 'InvalidToken', 'XMinioServerNotInitialized', 'ServiceUnavailable', 'InternalError', 'SlowDown'].includes(code) ? code : undefined;
      const error = new Error(`MinIO ${args.slice(0, 2).join(' ')} 失败（${result.error?.code || safeCode || result.status || result.signal}）；原始输出可能含秘密，未写入日志`);
      error.retryable = body?.status === 'error' && ['XMinioServerNotInitialized', 'ServiceUnavailable', 'InternalError', 'SlowDown'].includes(code);
      throw error;
    }
    return result.stdout;
  };
  if (action === 'ensure') {
    // mb --ignore-existing does not change existing policies; new buckets are private.
    for (let attempt = 0; ; attempt += 1) {
      try { mc(['mb', '--ignore-existing', target]); break; } catch (error) {
        if (!error.retryable || attempt >= 29) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }
  const read = () => {
    let result;
    const raw = mc(['anonymous', 'get-json', target]);
    try { result = JSON.parse(raw); } catch { throw new Error('无法核验 MinIO 匿名策略（响应不是有效 JSON）'); }
    if (result?.operation !== 'get-json' || result.bucket !== target) throw new Error('MinIO 匿名策略响应操作或 bucket 不符');
    if (result.status !== 'success' || !['private', 'download', 'upload', 'public'].includes(result.permission)) throw new Error('未知或自定义 bucket 策略，拒绝自动修改');
    if (result.permission !== 'private' && (!result.anonymous || !Array.isArray(result.anonymous.Statement))) throw new Error('公开策略没有可恢复的原始 JSON');
    return {permission: result.permission, policy: result.anonymous || null};
  };
  const current = read();
  const identity = {project: owned.project, containerId: owned.container.Id, image: owned.container.Image, dataPath: owned.mount.Source, bucket};
  if (action === 'ensure') {
    if (current.permission !== 'private') throw new Error('现有 bucket 允许匿名访问；请先 minio-policy.mjs plan，再显式 migrate --backup ... --execute');
    return {action, ...identity, permission: 'private', status: 'passed'};
  }
  if (action === 'plan') return {action, ...identity, permission: current.permission, target: 'private', executeRequired: true, objectsDeleted: false};
  assertSafePath(backup);
  if (backup === owned.root || backup.startsWith(`${owned.root}${path.sep}`)) throw new Error('策略备份不得位于部署数据目录内');
  if (action === 'migrate') {
    if (current.permission === 'private') throw new Error('bucket 已私有，无需迁移');
    if (fs.existsSync(backup)) throw new Error('策略备份已存在，拒绝覆盖');
    if (!execute) return {action, ...identity, from: current.permission, to: 'private', backup, executeRequired: true};
    const record = {version: 1, createdAt: new Date().toISOString(), identity, original: current, checksum: digest(current)};
    fs.writeFileSync(backup, `${JSON.stringify(record, null, 2)}\n`, {encoding: 'utf8', mode: 0o600, flag: 'wx'});
    try {
      mc(['anonymous', 'set', 'private', target]);
      if (read().permission !== 'private') throw new Error('私有策略回读不符');
    } catch (error) {
      try { mc(['anonymous', 'set-json', '/dev/stdin', target], JSON.stringify(current.policy)); if (!sameBucketPolicy(read(), current)) throw new Error('原策略回读不符'); } catch { throw new Error('bucket 迁移失败且策略恢复失败；保留备份，禁止上线'); }
      throw new Error('bucket 迁移失败，已回读确认原策略恢复');
    }
    return {action, ...identity, status: 'passed', backup, permission: 'private'};
  }
  const record = readProtectedJSON(backup);
  if (record.version !== 1 || digest(record.original) !== record.checksum || JSON.stringify(record.identity) !== JSON.stringify(identity) || !['download', 'upload', 'public'].includes(record.original?.permission)) throw new Error('备份校验和或当前资源身份不匹配');
  if (current.permission !== 'private') throw new Error('恢复要求当前 bucket 仍为本次迁移后的 private，拒绝覆盖其它变化');
  if (!execute) return {action, ...identity, from: 'private', to: record.original.permission, executeRequired: true};
  mc(['anonymous', 'set-json', '/dev/stdin', target], JSON.stringify(record.original.policy));
  if (!sameBucketPolicy(read(), record.original)) throw new Error('恢复策略回读不符；禁止上线');
  return {action, ...identity, status: 'passed', permission: record.original.permission};
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args[0] === '--help' && args.length === 1) { console.log('用法: node deploy/bin/minio-policy.mjs prepare-tool --execute\n      node deploy/bin/minio-policy.mjs plan\n      node deploy/bin/minio-policy.mjs ensure --execute\n      node deploy/bin/minio-policy.mjs migrate|restore --backup /absolute/policy.json [--execute]\n默认预览，不构建/拉取镜像；prepare-tool 显式准备固定官方二进制+SHA256工具镜像。ensure 执行时可准备镜像并新建 bucket；从已加载的受控环境读取凭据，所有写入必须 --execute，只操作所属 bucket，不删除对象。'); process.exit(0); }
    const action = args.shift(); let backup; let execute = false;
    while (args.length) { const arg = args.shift(); if (arg === '--execute' && !execute) execute = true; else if (arg === '--backup' && !backup && args[0] && !args[0].startsWith('--')) backup = args.shift(); else throw new Error('未知、重复或缺值参数'); }
    console.log(JSON.stringify(await runPolicy(action, {execute, backup}), null, 2));
  } catch (error) { console.error(`[minio] ${error.message}`); process.exitCode = 1; }
}
