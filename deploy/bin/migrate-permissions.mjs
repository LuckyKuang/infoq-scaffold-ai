#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {assertSafePath} from './render-gateway.mjs';
import {command, inspectOwnedContainer, assertExclusiveMount, readProtectedJSON} from './runtime-target.mjs';

const destinations = {mysql: ['/var/lib/mysql'], redis: ['/redis/data'], minio: ['/data'], 'infoq-admin': ['/infoq/server/logs/'], 'infoq-frontend-vue': ['/var/log/nginx/'], 'infoq-frontend-react': ['/var/log/nginx/'], 'nginx-web': ['/var/log/nginx']};
const sourcePaths = {mysql: 'mysql/data', redis: 'redis/data', minio: 'minio/data', 'infoq-admin': 'server/logs', 'infoq-frontend-vue': 'vue/logs', 'infoq-frontend-react': 'react/logs', 'nginx-web': 'nginx/log'};
const checksum = (file) => {
  const hash = createHash('sha256');
  const descriptor = fs.openSync(file, 'r');
  const buffer = Buffer.alloc(1024 * 1024);
  try { for (let bytes; (bytes = fs.readSync(descriptor, buffer, 0, buffer.length, null)) > 0;) hash.update(buffer.subarray(0, bytes)); } finally { fs.closeSync(descriptor); }
  return hash.digest('hex');
};
function entries(root) {
  const result = [];
  const walk = (file) => {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile()) || (stat.isFile() && stat.nlink !== 1)) throw new Error('迁移范围存在链接或特殊文件，拒绝修改');
    result.push({relative: path.relative(root, file), uid: stat.uid, gid: stat.gid, mode: stat.mode & 0o7777, dev: stat.dev, ino: stat.ino, size: stat.size, directory: stat.isDirectory()});
    if (stat.isDirectory()) for (const child of fs.readdirSync(file).sort()) walk(path.join(file, child));
  };
  walk(root);
  return result;
}
function sameEntries(left, right) { return JSON.stringify(left) === JSON.stringify(right); }

export function migratePermissions(options, env = process.env) {
  const {service, imageUser, uid, gid, backup, execute = false, restore = false} = options;
  if (!destinations[service] || !/^[a-zA-Z_][a-zA-Z0-9_-]*$|^[0-9]+$/u.test(imageUser || '')) throw new Error('必须提供允许的 service 和明确 image-user');
  if (![uid, gid].every((value) => Number.isSafeInteger(value) && value >= 0 && value <= 2147483647)) throw new Error('uid/gid 必须是非负整数');
  if (!backup) throw new Error('必须提供 --backup /absolute/manifest.json');
  assertSafePath(backup);
  const owned = inspectOwnedContainer(service, destinations[service][0], env);
  if (owned.mount.Source !== path.join(owned.root, sourcePaths[service])) throw new Error('挂载不是该服务约定的数据/日志路径');
  assertExclusiveMount(owned, env);
  if (backup.startsWith(`${owned.root}${path.sep}`)) throw new Error('备份必须位于部署根外');
  const image = owned.container.Image;
  const resolveId = (flag) => Number(command('docker', ['run', '--rm', '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--entrypoint', 'id', image, flag, imageUser], {env}).trim());
  if (resolveId('-u') !== uid || resolveId('-g') !== gid) throw new Error('指定 UID/GID 与不可变目标镜像中的账户不匹配');
  const current = entries(owned.mount.Source);
  const identity = {project: owned.project, containerId: owned.container.Id, image, source: owned.mount.Source, destination: owned.mount.Destination};
  const desired = current.map((entry) => ({...entry, uid, gid, mode: entry.directory ? 0o750 : (entry.mode & 0o100 ? 0o750 : 0o640)}));
  const changed = desired.filter((entry, index) => entry.uid !== current[index].uid || entry.gid !== current[index].gid || entry.mode !== current[index].mode).length;
  if (!execute && !restore) return {action: 'preview', identity, imageUser, uid, gid, entries: current.length, changed, backup, running: !!owned.container.State?.Running, executionRequiresStopped: true};
  if (owned.container.State?.Running) throw new Error('权限执行/恢复前必须停止目标服务，禁止修改正在写入的数据');
  const apply = (record) => {
    for (const entry of record) {
      const target = path.join(owned.mount.Source, entry.relative);
      const stat = fs.lstatSync(target);
      if (stat.isSymbolicLink() || stat.dev !== entry.dev || stat.ino !== entry.ino) throw new Error('迁移期间文件身份变化，停止');
      if (stat.uid !== entry.uid || stat.gid !== entry.gid) fs.chownSync(target, entry.uid, entry.gid);
      fs.chmodSync(target, entry.mode);
    }
  };
  if (restore) {
    const manifest = readProtectedJSON(backup);
    assertSafePath(`${backup}.tar`);
    const archive = fs.lstatSync(`${backup}.tar`);
    if (!archive.isFile() || archive.nlink !== 1 || (archive.mode & 0o077) || manifest.version !== 1 || JSON.stringify(manifest.identity) !== JSON.stringify(identity) || manifest.sha256 !== checksum(`${backup}.tar`) || !Array.isArray(manifest.original)) throw new Error('权限备份损坏或目标身份不匹配');
    for (const item of manifest.original) if (typeof item.relative !== 'string' || path.isAbsolute(item.relative) || item.relative.split(path.sep).includes('..') || !Number.isSafeInteger(item.mode) || item.mode < 0 || item.mode > 0o7777 || !Number.isSafeInteger(item.uid) || !Number.isSafeInteger(item.gid)) throw new Error('权限 manifest 路径或权限无效');
    const actualIdentity = current.map(({relative, dev, ino}) => ({relative, dev, ino}));
    const expectedIdentity = manifest.original.map(({relative, dev, ino}) => ({relative, dev, ino}));
    if (!sameEntries(actualIdentity, expectedIdentity)) throw new Error('数据文件集合变化，拒绝恢复旧权限');
    if (!execute) return {action: 'restore-preview', identity, entries: current.length, backup, executeRequired: true};
    apply(manifest.original);
    if (!sameEntries(entries(owned.mount.Source), manifest.original)) throw new Error('原权限恢复回读不符');
    return {action: 'restored', identity, entries: current.length, backup};
  }
  if (fs.existsSync(backup) || fs.existsSync(`${backup}.tar`)) throw new Error('备份已存在，拒绝覆盖');
  const archive = `${backup}.tar`;
  try {
    // The stopped service and immutable enumerated file set bound this filesystem backup.
    fs.closeSync(fs.openSync(archive, 'wx', 0o600));
    command('tar', ['-cpf', archive, '-C', path.dirname(owned.mount.Source), path.basename(owned.mount.Source)], {env, timeout: 300000});
    command('tar', ['-tf', archive], {env, timeout: 300000});
    if (!sameEntries(current, entries(owned.mount.Source))) throw new Error('备份过程中源文件变化');
    const manifest = {version: 1, createdAt: new Date().toISOString(), identity, imageUser, uid, gid, sha256: checksum(archive), original: current};
    fs.writeFileSync(backup, `${JSON.stringify(manifest, null, 2)}\n`, {encoding: 'utf8', mode: 0o600, flag: 'wx'});
    try {
      apply(desired);
      if (!sameEntries(entries(owned.mount.Source), desired)) throw new Error('迁移权限回读不符');
    } catch {
      try { apply(current); if (!sameEntries(entries(owned.mount.Source), current)) throw new Error(); } catch { throw new Error('权限迁移失败且恢复失败；保留备份，禁止启动服务'); }
      throw new Error('权限迁移失败，已恢复原权限');
    }
    return {action: 'migrated', identity, entries: current.length, changed, backup, sha256: manifest.sha256, runtimeWriteVerification: 'blocked_until_target_service_restart'};
  } catch (error) { throw error; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--help') { console.log('用法: node deploy/bin/migrate-permissions.mjs --service mysql|redis|minio|infoq-admin|infoq-frontend-vue|infoq-frontend-react|nginx-web --image-user NAME --uid ID --gid ID --backup /absolute/permissions.json [--restore] [--execute]\n默认预览；执行要求目标容器已停止、image账户已核验、路径/项目归属正确。备份包含受控 tar 与原 owner/mode；不处理配置、整个部署根或未知数据。'); process.exit(0); }
    const options = {};
    while (args.length) {
      const flag = args.shift(); const key = {'--service': 'service', '--image-user': 'imageUser', '--uid': 'uid', '--gid': 'gid', '--backup': 'backup', '--execute': 'execute', '--restore': 'restore'}[flag];
      if (!key || options[key] !== undefined) throw new Error('未知或重复参数');
      if (['execute', 'restore'].includes(key)) options[key] = true;
      else { const value = args.shift(); if (!value || value.startsWith('--')) throw new Error('参数缺值'); if (['uid', 'gid'].includes(key) && !/^(0|[1-9][0-9]*)$/u.test(value)) throw new Error('uid/gid 无效'); options[key] = ['uid', 'gid'].includes(key) ? Number(value) : value; }
    }
    console.log(JSON.stringify(migratePermissions(options), null, 2));
  } catch (error) { console.error(`[permissions] ${error.message}`); process.exitCode = 1; }
}
