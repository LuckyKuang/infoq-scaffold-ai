import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {assertSafePath} from './render-gateway.mjs';

export function command(program, args, {env = process.env, input, timeout = 30000} = {}) {
  const result = spawnSync(program, args, {env, input, encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024});
  if (result.error || result.status !== 0) throw new Error(`${program} 操作失败（${result.error?.code || result.status || result.signal}）；详细输出可能含秘密，未写入日志`);
  return result.stdout;
}

export function inspectOwnedContainer(service, destination, env = process.env) {
  const root = env.INFOQ_DEPLOY_ROOT;
  assertSafePath(root || '');
  const project = env.INFOQ_COMPOSE_PROJECT_NAME || env.COMPOSE_PROJECT_NAME || 'infoq-scaffold-ai';
  if (!/^[a-z0-9][a-z0-9_-]{0,62}$/u.test(project)) throw new Error('Compose project 无效');
  const raw = command('docker', ['container', 'inspect', service], {env});
  let container;
  try { const parsed = JSON.parse(raw); if (parsed.length !== 1) throw new Error(); [container] = parsed; } catch { throw new Error('容器 inspect 格式无效'); }
  const labels = container.Config?.Labels || {};
  if (labels['com.docker.compose.project'] !== project || labels['com.docker.compose.service'] !== service || !/^[a-f0-9]{12,64}$/u.test(container.Id || '') || !/^sha256:[a-f0-9]{64}$/u.test(container.Image || '')) throw new Error('容器或镜像归属不符');
  const mounts = (container.Mounts || []).filter((mount) => mount.Destination.replace(/\/$/u, '') === destination.replace(/\/$/u, ''));
  if (mounts.length !== 1 || mounts[0].Type !== 'bind' || !mounts[0].RW) throw new Error('目标不是唯一可写 bind mount');
  assertSafePath(mounts[0].Source);
  const relative = path.relative(root, mounts[0].Source);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('挂载不在部署根的明确子目录中');
  return {container, mount: mounts[0], project, root};
}

export function assertExclusiveMount(owned, env = process.env) {
  const ids = command('docker', ['container', 'ls', '--all', '--quiet', '--no-trunc'], {env}).trim().split(/\s+/u).filter(Boolean);
  if (!ids.length || ids.length > 1000 || ids.some((id) => !/^[a-f0-9]{64}$/u.test(id)) || !ids.includes(owned.container.Id)) throw new Error('无法完整枚举挂载归属或容器清单过大，拒绝迁移');
  let containers;
  try { containers = JSON.parse(command('docker', ['container', 'inspect', ...ids], {env})); } catch { throw new Error('无法批量核验其它容器挂载'); }
  if (!Array.isArray(containers) || containers.length !== ids.length || new Set(containers.map((item) => item.Id)).size !== ids.length || containers.some((item) => !ids.includes(item.Id))) throw new Error('容器挂载快照不完整');
  for (const container of containers) {
    if (container.Id === owned.container.Id) continue;
    for (const mount of container.Mounts || []) {
      if (mount.Type !== 'bind') continue;
      const source = path.resolve(mount.Source);
      if (source === owned.mount.Source || source.startsWith(`${owned.mount.Source}${path.sep}`) || owned.mount.Source.startsWith(`${source}${path.sep}`)) throw new Error('目标数据被其它容器共享挂载，拒绝迁移');
    }
  }
}

export function readProtectedJSON(file) {
  assertSafePath(file);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.nlink !== 1 || (stat.mode & 0o077) || stat.size > 16 * 1024 * 1024) throw new Error('备份 manifest 必须是受控 0600 普通文件');
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw new Error('备份 manifest 不是有效 JSON'); }
}
