#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {command, inspectOwnedContainer, assertExclusiveMount} from './runtime-target.mjs';
import {assertSafePath} from './render-gateway.mjs';

export function prepareVolumeUsers({services, newDirectories = [], execute = false}, env = process.env) {
  if (!Array.isArray(services) || !services.length || new Set(services).size !== services.length || services.some((name) => !['mysql', 'redis', 'minio', 'infoq-admin', 'infoq-frontend-vue', 'infoq-frontend-react', 'nginx-web'].includes(name))) throw new Error('必须提供明确且不重复的基础服务列表');
  const root = env.INFOQ_DEPLOY_ROOT;
  assertSafePath(root || '');
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  let config;
  try { config = JSON.parse(command('docker', ['compose', '-f', path.join(repo, 'deploy/docker/docker-compose.yml'), 'config', '--format', 'json'], {env})); } catch { throw new Error('无法读取 Compose v2 内存配置，不输出可能含秘密的渲染内容'); }
  const project = env.INFOQ_COMPOSE_PROJECT_NAME || env.COMPOSE_PROJECT_NAME || 'infoq-scaffold-ai';
  const containerIds = command('docker', ['container', 'ls', '--all', '--quiet', '--no-trunc'], {env}).trim().split(/\s+/u).filter(Boolean);
  if (containerIds.length > 1000 || containerIds.some((id) => !/^[a-f0-9]{64}$/u.test(id))) throw new Error('容器列表无法完整核验');
  let containers = [];
  try { if (containerIds.length) containers = JSON.parse(command('docker', ['container', 'inspect', ...containerIds], {env})); } catch { throw new Error('无法核验现有容器挂载'); }
  if (!Array.isArray(containers) || containers.length !== containerIds.length || new Set(containers.map((item) => item.Id)).size !== containerIds.length || containers.some((item) => !containerIds.includes(item.Id))) throw new Error('现有容器快照不完整');
  const plans = [];
  for (const service of services) {
    const definition = config.services?.[service];
    let image;
    try { [image] = JSON.parse(command('docker', ['image', 'inspect', definition?.image || ''], {env})); } catch { throw new Error(`镜像不可读取，请先受控 pull/build: ${service}`); }
    if (!/^sha256:[a-f0-9]{64}$/u.test(image?.Id || '')) throw new Error(`镜像 ID 无效: ${service}`);
    const imageUser = service === 'mysql' ? 'mysql' : service === 'redis' ? 'redis' : service === 'minio' ? env.INFOQ_MINIO_IMAGE_USER || image.Config?.User : image.Config?.User || '0';
    if (!/^[A-Za-z0-9_-]+(?::[A-Za-z0-9_-]+)?$/u.test(imageUser || '')) throw new Error(`镜像业务用户未知: ${service}；MinIO 需核实际 entrypoint 后显式 INFOQ_MINIO_IMAGE_USER`);
    const ids = execute ? ['-u', '-g'].map((flag) => command('docker', ['run', '--rm', '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--user', imageUser, '--entrypoint', 'id', image.Id, flag], {env}).trim()) : null;
    if (ids && ids.some((value) => !/^(0|[1-9][0-9]{0,9})$/u.test(value) || Number(value) > 2147483647)) throw new Error(`镜像 UID/GID 无法确认: ${service}`);
    for (const mount of definition.volumes || []) {
      if (mount.type !== 'bind' || mount.read_only) continue;
      assertSafePath(mount.source);
      if (mount.source.includes(',')) throw new Error('Docker bind mount 路径不允许逗号');
      if (!mount.source.startsWith(`${root}${path.sep}`)) throw new Error(`可写挂载越过部署根: ${service}`);
      const relative = path.relative(root, mount.source); const serviceRoot = path.join(root, relative.split(path.sep)[0]);
      const marker = path.join(serviceRoot, '.infoq-deploy-owner');
      assertSafePath(marker);
      if (fs.existsSync(marker)) {
        const markerStat = fs.lstatSync(marker);
        if (!markerStat.isFile() || markerStat.nlink !== 1 || fs.readFileSync(marker, 'utf8').trim() !== project) throw new Error(`目录归属未知: ${service}`);
      } else {
        const existing = inspectOwnedContainer(service, mount.target, env);
        if (existing.mount.Source !== mount.source) throw new Error(`旧目录没有标记且容器挂载不匹配: ${service}`);
        assertExclusiveMount(existing, env);
      }
      const stat = fs.lstatSync(mount.source);
      if (!stat.isDirectory()) throw new Error(`可写挂载不是目录: ${service}`);
      const candidate = newDirectories.includes(mount.source);
      for (const container of containers) for (const existing of container.Mounts || []) {
        if (existing.Type !== 'bind') continue;
        const source = path.resolve(existing.Source);
        if (source !== mount.source && !source.startsWith(`${mount.source}${path.sep}`) && !mount.source.startsWith(`${source}${path.sep}`)) continue;
        if (container.Config?.Labels?.['com.docker.compose.project'] !== project || container.Config?.Labels?.['com.docker.compose.service'] !== service || (candidate && container.State?.Running)) throw new Error(`挂载被其它资源共享或新目录已在使用: ${service}`);
      }
      if (candidate && fs.readdirSync(mount.source).length !== 0) throw new Error(`本轮新目录不再为空，拒绝自动改权限: ${service}`);
      if (!plans.some((plan) => plan.source === mount.source)) plans.push({service, image: image.Id, imageUser, uid: ids ? Number(ids[0]) : null, gid: ids ? Number(ids[1]) : null, source: mount.source, initialize: candidate, original: {uid: stat.uid, gid: stat.gid, mode: stat.mode & 0o7777}});
    }
  }
  if (!execute) return {action: 'preview', project, plans, executeRequired: true};
  const changed = [];
  try {
    for (const plan of plans) {
      if (plan.initialize) {
        if (fs.readdirSync(plan.source).length) throw new Error('初始化期间目录内容变化');
        changed.push(plan);
        const stat = fs.statSync(plan.source);
        if (stat.uid !== plan.uid || stat.gid !== plan.gid) fs.chownSync(plan.source, plan.uid, plan.gid);
        fs.chmodSync(plan.source, 0o750);
      }
      const script = 'test -r /probe && test -x /probe; probe="$(mktemp /probe/.infoq-write.XXXXXX)"; trap \'rm -f "$probe"\' EXIT; printf "infoq-owned-probe" > "$probe"; test "$(cat "$probe")" = "infoq-owned-probe"; rm "$probe"; test ! -e "$probe"; trap - EXIT';
      try { command('docker', ['run', '--rm', '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--user', `${plan.uid}:${plan.gid}`, '--mount', `type=bind,source=${plan.source},target=/probe`, '--entrypoint', '/bin/sh', plan.image, '-ec', script], {env}); } catch { throw new Error(`镜像实际用户不可读写挂载: ${plan.service}；旧目录先运行 migrate-permissions.mjs 预览，不自动递归改 owner`); }
    }
  } catch (error) {
    try { for (const plan of changed.reverse()) { fs.chownSync(plan.source, plan.original.uid, plan.original.gid); fs.chmodSync(plan.source, plan.original.mode); } } catch { throw new Error('新目录初始化失败且原权限恢复失败，禁止启动'); }
    throw error;
  }
  return {action: 'initialized-and-write-verified', project, plans};
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--help') { console.log('用法: node deploy/bin/prepare-volume-users.mjs --services mysql,redis,minio [--new-dir /absolute/new-empty-dir ...] [--execute]\n只枚举所选 Compose 可写 bind；按不可变镜像实际账户核验，默认预览。execute只给本轮明确新建、owned且为空目录配置owner/mode，旧目录只验证读写，失败要求显式迁移。'); process.exit(0); }
    const options = {newDirectories: []};
    while (args.length) { const flag = args.shift(); if (flag === '--execute' && !options.execute) options.execute = true; else if (flag === '--services' && !options.services && args[0]) options.services = args.shift().split(','); else if (flag === '--new-dir' && args[0] && !args[0].startsWith('--')) options.newDirectories.push(args.shift()); else throw new Error('未知、重复或缺值参数'); }
    console.log(JSON.stringify(prepareVolumeUsers(options), null, 2));
  } catch (error) { console.error(`[volume-users] ${error.message}`); process.exitCode = 1; }
}
