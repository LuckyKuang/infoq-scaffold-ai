#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loginWithRealCaptcha} from '../../skills/test-cli/scripts/captcha_login.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tmp = path.join(repo, 'tmp');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const fail = message => { throw new Error(message); };
const identifier = /^[a-z][a-z0-9-]{2,47}$/;
const help = `生产运维隔离验证（Node 24；真实执行需 Linux Docker Compose v2）
node tools/verify/production_ops.mjs <command> --config <controlled.json> [--execute]
commands: inspect | backup | verify-backup | restore | rollback | checks | alert | capacity | cleanup
默认只读预览，无证据写入、无 HTTP、无 Docker mutation。--execute 才实际执行。
backup/verify-backup/restore 需要 --backup <tmp目录>；restore 的 config 是全新目标，
且必须与备份 source project 不同。rollback 需要固定 sha256 镜像与兼容性摘要。
只接受 infoq-verify-* 项目、com.infoq.ops.run 标签；拒绝共享/生产目标。
capacity 的目标/并发/速率/时长/请求上限/超时必须在 config 中显式指定。
秘密只从 config.secretsFile 读取，绝不放 CLI 参数；详见 docs/PRODUCTION-OPS.md。
`;

export function parseArgs(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) return {help: true};
  const [command, ...rest] = argv;
  if (!['inspect','backup','verify-backup','restore','rollback','checks','alert','capacity','cleanup'].includes(command)) fail('未知 command');
  const result = {command, execute: false};
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i];
    if (key === '--execute' && !result.execute) { result.execute = true; continue; }
    if (!['--config','--backup'].includes(key) || result[key.slice(2)] || !rest[i + 1] || rest[i + 1].startsWith('--')) fail('参数重复、未知或缺值');
    result[key.slice(2)] = rest[++i];
  }
  if (!result.config) fail('缺少 --config');
  if (['backup','verify-backup','restore'].includes(command) !== Boolean(result.backup)) fail('--backup 仅且必须用于 backup/verify-backup/restore');
  return result;
}

// Reject symbolic links in every existing component, including parent directories.
export function controlledPath(value, {directory = false, missing = false, allowEmpty = false, maxBytes = 10 * 1024 * 1024} = {}) {
  if (typeof value !== 'string' || !value || /[\x00-\x1f]/.test(value)) fail('受控路径无效');
  const absolute = path.resolve(repo, value);
  if (!absolute.startsWith(tmp + path.sep)) fail('路径必须在仓库 tmp/ 内');
  let current = repo;
  for (const part of path.relative(repo, absolute).split(path.sep)) {
    current = path.join(current, part);
    let stat;
    try{stat=fs.lstatSync(current);}catch(error){if(error.code==='ENOENT' && missing)continue;if(error.code==='ENOENT')fail('受控路径不存在');throw error;}
    if (stat.isSymbolicLink()) fail('受控路径包含符号链接');
  }
  if (fs.existsSync(absolute)) {
    const stat = fs.statSync(absolute);
    if (directory ? !stat.isDirectory() : !stat.isFile()) fail('受控路径类型错误');
    if(!directory && stat.nlink!==1)fail('受控文件不得包含硬链接');
    if (!directory && ((!allowEmpty && stat.size === 0) || stat.size > maxBytes)) fail('受控文件大小无效');
  }
  return absolute;
}

function number(value, name, max) {
  if (!Number.isInteger(value) || value < 1 || value > max) fail(`${name} 范围无效`);
  return value;
}

export function loadConfig(filename) {
  let config;
  try { config = JSON.parse(fs.readFileSync(controlledPath(filename), 'utf8')); }
  catch (error) { if (error instanceof SyntaxError) fail('配置 JSON 无效'); throw error; }
  if (config.version !== 1 || !identifier.test(config.runId) || !/^infoq-verify-[a-z0-9-]{3,45}$/.test(config.project)) fail('只接受明确的隔离 runId / infoq-verify-* project');
  config.root = controlledPath(config.root, {directory:true});
  config.composeFile = controlledPath(config.composeFile);
  config.secretsFile = controlledPath(config.secretsFile);
  if (process.platform !== 'win32' && (fs.statSync(config.secretsFile).mode & 0o077)) fail('secretsFile 必须禁止 group/other 访问');
  try { config.secrets = JSON.parse(fs.readFileSync(config.secretsFile, 'utf8')); }
  catch { fail('secretsFile JSON 无效'); }
  config.environmentFile = controlledPath(config.environmentFile);
  if (process.platform !== 'win32' && (fs.statSync(config.environmentFile).mode & 0o077)) fail('environmentFile 必须禁止 group/other 访问');
  if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(config.database)) fail('database 标识无效');
  if (!config.services || !['mysql','minio','application'].every(key => identifier.test(config.services[key]))) fail('缺少 mysql/minio/application service');
  if (!Array.isArray(config.sqlChecks) || !config.sqlChecks.length || config.sqlChecks.length > 20) fail('必须指定 1..20 个数据一致性查询');
  for (const check of config.sqlChecks) {
    if (!identifier.test(check.name) || typeof check.sql !== 'string' || !/^SELECT\s/i.test(check.sql) || /[;\x00-\x1f]|--|\/\*|\b(INTO|OUTFILE|DUMPFILE|SLEEP|BENCHMARK|LOAD_FILE|FOR\s+UPDATE)\b/i.test(check.sql)) fail('sqlChecks 只接受已审阅的单条 SELECT');
  }
  validateHttpChecks(config.checks, config.secrets);
  if (!config.s3 || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(config.s3.bucket)) fail('S3 bucket 无效');
  const origin = new URL(config.s3.origin);
  if (!['http:','https:'].includes(origin.protocol) || !['127.0.0.1','localhost','[::1]'].includes(origin.hostname) || origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) fail('S3 origin 必须为无凭据的 loopback origin');
  for (const key of ['accessKey','secretKey']) if (typeof config.secrets[key] !== 'string' || !config.secrets[key] || /[\r\n\x00]/.test(config.secrets[key])) fail(`缺少受控 ${key}`);
  if(!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(config.secrets.databaseUser || '') || !/^[A-Za-z0-9@#_+.-]{24,128}$/.test(config.secrets.databasePassword || '')) fail('缺少受控隔离数据库账号或密码格式无效');
  number(config.s3.maxObjects, 'maxObjects', 100000);
  number(config.s3.maxBytes, 'maxBytes', 1024 * 1024 * 1024);
  return config;
}

function validateHttpChecks(checks, secrets) {
  if (!Array.isArray(checks) || !checks.length || checks.length > 20 || !checks.some(c => c.kind === 'readiness') || !checks.some(c => c.kind === 'business')) fail('必须分别指定 readiness 和关键业务 checks');
  for (const check of checks) {
    if (!identifier.test(check.name) || !['readiness','business'].includes(check.kind)) fail('HTTP check 名称/类型无效');
    const url = new URL(check.url);
    if (!['http:','https:'].includes(url.protocol) || !['127.0.0.1','localhost','[::1]'].includes(url.hostname) || url.username || url.password || url.hash) fail('HTTP checks 只接受无凭据 loopback URL');
    number(check.status, 'HTTP status', 599);
    number(check.timeoutMs, 'HTTP timeoutMs', 60000);
    if (check.authorizationKey && typeof secrets[check.authorizationKey] !== 'string') fail('HTTP 授权来源缺失');
    if(check.headers && Object.entries(check.headers).some(([key,value])=>!['clientid','Content-Language'].includes(key) || typeof value!=='string' || /[\r\n]/.test(value))) fail('HTTP check headers 仅接受公开 clientid/Content-Language');
    if (!check.json || typeof check.json !== 'object' || !Object.keys(check.json).length) fail('HTTP check 必须核业务 JSON 字段，不只 HTTP 状态');
  }
}

export async function runProcess(args, {input, maxBytes = 16 * 1024 * 1024, timeoutMs = 120000, signal} = {}) {
  if(signal?.aborted)fail('Docker 操作已中断，未启动子进程');
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, {stdio:['pipe','pipe','pipe'], windowsHide:true});
    let bytes = 0, output = [], errorBytes = 0, settled = false, stopped = false;
    const stop = () => { stopped = true; child.kill('SIGKILL'); };
    const timer = setTimeout(stop, timeoutMs);
    signal?.addEventListener('abort', stop, {once:true});
    child.stdout.on('data', chunk => { bytes += chunk.length; if (bytes > maxBytes) stop(); else output.push(chunk); });
    // Upstream output can contain secrets. Never include it in public errors/evidence.
    child.stderr.on('data', chunk => { errorBytes += chunk.length; if (errorBytes > maxBytes) stop(); });
    child.stdin.on('error', () => {});
    child.on('error', () => { if (!settled) { settled = true; clearTimeout(timer); signal?.removeEventListener('abort', stop); reject(new Error('Docker 不可用或无法启动')); } });
    child.on('close', code => {
      clearTimeout(timer); signal?.removeEventListener('abort', stop);
      if (settled) return; settled = true;
      if (stopped || signal?.aborted) reject(new Error('Docker 操作超时/中断/输出超限'));
      else if (code !== 0) reject(new Error(`Docker 操作失败 exit=${code}`));
      else resolve(Buffer.concat(output));
    });
    child.stdin.end(input);
  });
}

function composeArgs(config) { return ['compose','--project-name',config.project,'--env-file',config.environmentFile,'-f',config.composeFile]; }

export async function inspectTarget(config, run = runProcess, {fresh = false} = {}) {
  const context=JSON.parse((await run(['context','inspect'])).toString());
  if (!/^(unix:\/\/|npipe:\/\/)/.test(context[0]?.Endpoints?.docker?.Host || '') || process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT) fail('仅支持当前本机 Docker context；拒绝远程/覆盖 context');
  if ((await run(['info','--format','{{.OSType}}'])).toString().trim() !== 'linux') fail('需要 Linux Docker engine');
  const definition = JSON.parse((await run([...composeArgs(config),'config','--format','json'])).toString());
  const services = definition.services || {};
  for (const required of Object.values(config.services)) if (!services[required]) fail('Compose 缺少声明 service');
  const names = new Set();
  for (const [name, service] of Object.entries(services)) {
    if (service.labels?.['com.infoq.ops.run'] !== config.runId) fail('Compose service 缺少 run ownership 标签');
    if (service.container_name && !service.container_name.startsWith(config.project + '-')) fail('Compose container_name 跨项目');
    for (const mount of service.volumes || []) {
      if (mount.type === 'bind') {
        const location = controlledPath(mount.source, {directory:fs.existsSync(mount.source) && fs.statSync(mount.source).isDirectory()});
        if (!location.startsWith(config.root + path.sep)) fail('Compose bind mount 不属于本 run root');
      } else if (mount.type !== 'volume') fail('不支持的 Compose mount');
    }
    for (const port of service.ports || []) if (!['127.0.0.1','::1'].includes(port.host_ip)) fail('隔离端口必须显式 loopback');
    if (service.privileged || service.network_mode || service.pid || service.devices?.length || service.cap_add?.length || service.volumes_from?.length) fail('拒绝特权/共享 namespace/外部 mounts');
    names.add(name);
  }
  for (const collection of ['volumes','networks']) for (const entry of Object.values(definition[collection] || {})) {
    if (entry.external || (entry.name && !entry.name.startsWith(config.project + '_'))) fail('拒绝外部/共享 Compose 资源');
    if (collection === 'volumes' && (entry.driver_opts || entry.driver && entry.driver !== 'local')) fail('拒绝外部 volume driver');
  }
  for(const [collection,kind] of [['volumes','volume'],['networks','network']]) for(const [key,entry] of Object.entries(definition[collection] || {})) {
    const name=entry.name || `${config.project}_${key}`;
    const matches=(await run([kind,'ls','--format','{{.Name}}','--filter',`name=${name}`])).toString().trim().split(/\s+/).filter(n=>n===name);
    if(matches.length) {
      if(fresh)fail('恢复目标存在同名资源，拒绝采用');
      const actual=JSON.parse((await run([kind,'inspect',name])).toString())[0];
      if(actual.Labels?.['com.docker.compose.project']!==config.project || actual.Labels?.['com.infoq.ops.run']!==config.runId)fail('实际卷/网络ownership不符');
    }
  }
  for (const collection of ['configs','secrets']) for (const entry of Object.values(definition[collection] || {})) {
    if (entry.external || !entry.file || !controlledPath(entry.file).startsWith(config.root+path.sep)) fail('Compose config/secret 必须属于本 run');
  }
  const published=(service)=>new Set((services[service]?.ports || []).map(p=>String(p.published)));
  const assertPort=(url,ports)=>{const parsed=new URL(url);if(!ports.has(parsed.port || (parsed.protocol==='https:'?'443':'80')))fail('HTTP/S3 endpoint 不是声明 owned service 端口');};
  assertPort(config.s3.origin,published(config.services.minio));
  for(const check of config.checks) assertPort(check.url,published(config.services.application));
  if(config.capacity) assertPort(config.capacity.url,published(config.services.application));
  if(config.authentication) {
    assertPort(config.authentication.backendUrl,published(config.services.application));
    if(!config.services.redis || !published(config.services.redis).has(String(config.authentication.redisPort)))fail('验证码Redis端口不是owned service');
  }
  if(config.alert) for(const phase of ['signal','trigger','received','recovered']) if(config.alert[phase]) assertPort(config.alert[phase].url,new Set(Object.keys(services).flatMap(name=>[...published(name)])));
  const ids = (await run(['ps','-aq','--filter',`label=com.docker.compose.project=${config.project}`])).toString().trim().split(/\s+/).filter(Boolean);
  if (fresh && ids.length) fail('恢复目标 project 已存在容器');
  const containers = ids.length ? JSON.parse((await run(['inspect',...ids])).toString()) : [];
  for (const container of containers) {
    if (container.Config?.Labels?.['com.infoq.ops.run'] !== config.runId || container.Config?.Labels?.['com.docker.compose.project']!==config.project || !names.has(container.Config?.Labels?.['com.docker.compose.service'])) fail('实际容器归属不匹配');
    if(container.HostConfig?.Privileged || ['host'].includes(container.HostConfig?.NetworkMode) || /^(host|container:)/.test(container.HostConfig?.PidMode || '') || /^(host|container:)/.test(container.HostConfig?.IpcMode || '') || container.HostConfig?.Devices?.length || container.HostConfig?.CapAdd?.length)fail('实际容器存在共享/特权配置');
    for (const port of Object.values(container.NetworkSettings?.Ports || {}).flat().filter(Boolean)) if (!['127.0.0.1','::1'].includes(port.HostIp)) fail('实际容器存在公开端口');
    for (const mount of container.Mounts || []) {
      if (mount.Type === 'bind' && !controlledPath(mount.Source,{directory:fs.existsSync(mount.Source)&&fs.statSync(mount.Source).isDirectory()}).startsWith(config.root + path.sep)) fail('实际容器 bind mount 越界');
      if (mount.Type === 'volume' && !mount.Name.startsWith(config.project + '_')) fail('实际容器 volume 越界');
    }
  }
  const ownedIds=new Set(ids);
  const allIds=(await run(['ps','-aq'])).toString().trim().split(/\s+/).filter(id=>id&&!ownedIds.has(id));
  if(allIds.length) {
    const others=JSON.parse((await run(['inspect',...allIds])).toString());
    const binds=Object.values(services).flatMap(service=>(service.volumes || []).filter(m=>m.type==='bind').map(m=>path.resolve(m.source)));
    const volumeNames=new Set(Object.entries(definition.volumes || {}).map(([key,value])=>value.name || `${config.project}_${key}`));
    for(const container of others)for(const mount of container.Mounts || []) {
      if(mount.Type==='volume' && volumeNames.has(mount.Name))fail('其它容器共享owned数据卷，拒绝操作');
      if(mount.Type==='bind') {
        const other=path.resolve(mount.Source);
        if(binds.some(own=>own===other || own.startsWith(other+path.sep) || other.startsWith(own+path.sep)))fail('其它容器共享/重叠owned bind mount，拒绝操作');
      }
    }
  }
  // Orphaned volumes/networks must not be adopted by a new restore.
  if (fresh) for (const kind of ['volume','network']) {
    const existing = (await run([kind,'ls','-q','--filter',`label=com.docker.compose.project=${config.project}`])).toString().trim();
    if (existing) fail('恢复目标 project 已存在资源');
  }
  const plannedServices=Object.entries(services).map(([service,value])=>({service,image:value.image,ports:value.ports || [],mounts:(value.volumes || []).map(m=>({type:m.type,target:m.target,source:m.type==='bind'?path.relative(repo,m.source):m.source,readOnly:Boolean(m.read_only)}))}));
  return {definition, containers, summary:{project:config.project,runId:config.runId,services:[...names],plannedServices,containers:containers.map(c=>({id:c.Id,image:c.Image,service:c.Config.Labels['com.docker.compose.service'],running:c.State?.Running,mounts:(c.Mounts || []).map(m=>({type:m.Type,target:m.Destination,source:m.Type==='volume'?m.Name:path.relative(repo,m.Source)})),ports:c.NetworkSettings?.Ports || {}}))}};
}

function serviceContainer(target, service) {
  const matches = target.containers.filter(c => c.Config.Labels['com.docker.compose.service'] === service);
  if (matches.length !== 1) fail('目标 service 必须有且仅有一个 owned 容器');
  return matches[0];
}

async function readBounded(response, maxBytes) {
  const chunks = []; let size = 0;
  for await (const chunk of response.body) { size += chunk.length; if (size > maxBytes) { await response.body.cancel().catch(()=>{}); fail('HTTP 响应超限'); } chunks.push(chunk); }
  return Buffer.concat(chunks);
}

// S3 Signature V4 uses the exact client-visible host/path. No proxy path rewrite.
export async function s3Request(config, method, key = '', {query = '', body = Buffer.alloc(0), fetchImpl = fetch, signal, metadata, withMetadata=false} = {}) {
  const now = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = now.slice(0,8), region = config.s3.region || 'us-east-1';
  const encode = value => encodeURIComponent(value).replace(/[!'()*]/g, c=>`%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  const uri = '/' + encode(config.s3.bucket) + (key ? '/' + key.split('/').map(encode).join('/') : '');
  const url = new URL(uri + (query ? '?' + query : ''), config.s3.origin);
  const bodyHash = hash(body), headers = {'host':url.host,'x-amz-content-sha256':bodyHash,'x-amz-date':now};
  for(const [name,value] of Object.entries(metadata || {})) {
    if(!/^(content-type|content-disposition|content-encoding|cache-control|x-amz-meta-[a-z0-9-]+)$/.test(name) || typeof value!=='string' || /[\r\n]/.test(value))fail('S3对象metadata非法');
    headers[name]=value;
  }
  const sorted=Object.keys(headers).sort(),signedHeaders=sorted.join(';');
  const canonical = [method,uri,query,sorted.map(k=>`${k}:${headers[k].trim().replace(/\s+/g,' ')}\n`).join(''),signedHeaders,bodyHash].join('\n');
  const scope = `${date}/${region}/s3/aws4_request`;
  let signing = Buffer.from('AWS4' + config.secrets.secretKey);
  for (const value of [date,region,'s3','aws4_request']) signing = crypto.createHmac('sha256', signing).update(value).digest();
  const signature = crypto.createHmac('sha256', signing).update(`AWS4-HMAC-SHA256\n${now}\n${scope}\n${hash(canonical)}`).digest('hex');
  headers.Authorization = `AWS4-HMAC-SHA256 Credential=${config.secrets.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const response = await fetchImpl(url, {method,headers,body:['GET','HEAD'].includes(method)?undefined:body,redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(30000)]):AbortSignal.timeout(30000)});
  const data = await readBounded(response, config.s3.maxBytes);
  if (!response.ok) fail(`S3 ${method} 失败 http=${response.status}`);
  return withMetadata?{data,metadata:Object.fromEntries([...response.headers].filter(([key])=>/^(content-type|content-disposition|content-encoding|cache-control|x-amz-meta-[a-z0-9-]+)$/.test(key)))}:data;
}

export async function listObjects(config, options = {}) {
  const result = []; let token = '', totalBytes=0;
  do {
    const query = (token ? `continuation-token=${encodeURIComponent(token)}&` : '') + 'encoding-type=url&list-type=2';
    const xml = (await s3Request(config,'GET','',{...options,query})).toString();
    if(!/<ListBucketResult(?:\s|>)/.test(xml) || !/<IsTruncated>(true|false)<\/IsTruncated>/.test(xml)) fail('S3 list 协议响应无效');
    for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const key = /<Key>(.*?)<\/Key>/.exec(match[1])?.[1];
      const size = Number(/<Size>(\d+)<\/Size>/.exec(match[1])?.[1]);
      if (key === undefined || !Number.isSafeInteger(size)) fail('S3 list 响应无效');
      const decoded=decodeURIComponent(key);
      if(decoded.split('/').some(part=>part==='.' || part==='..')) fail('S3 dot segment key 需要专用迁移，禁止 URL 归一化');
      result.push({key:decoded,size}); totalBytes+=size;
      if (result.length > config.s3.maxObjects || totalBytes > config.s3.maxBytes) fail('S3 备份范围超限');
    }
    const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
    const next = /<NextContinuationToken>(.*?)<\/NextContinuationToken>/.exec(xml)?.[1];
    if (truncated && (!next || next === token)) fail('S3 list 分页无效');
    token = truncated ? next.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>') : '';
  } while (token);
  return result;
}

async function sqlSnapshot(config, mysql, run, signal) {
  const result = {};
  for (const check of config.sqlChecks) {
    const output = await run(['exec','-i',mysql.Id,'sh','-ec','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql --batch --raw --skip-column-names -uroot "$1"','ops',config.database], {input:check.sql,signal});
    if (!output.length) fail('SQL 一致性查询无结果');
    result[check.name] = {sha256:hash(output),rows:output.toString().trimEnd().split('\n').length};
  }
  return result;
}

export function verifyBackup(directory) {
  const root = controlledPath(directory,{directory:true});
  const manifestFile = path.join(root,'manifest.json');
  controlledPath(manifestFile);
  let manifest; try {manifest = JSON.parse(fs.readFileSync(manifestFile,'utf8'));} catch {fail('备份 manifest 无效');}
  if (manifest.version !== 1 || !/^infoq-verify-[a-z0-9-]{3,45}$/.test(manifest.source?.project) || !identifier.test(manifest.source?.runId) || !Array.isArray(manifest.source?.images) || !manifest.source.images.length || !Number.isFinite(Date.parse(manifest.createdAt)) || Date.parse(manifest.createdAt)>Date.now()+300000 || !Array.isArray(manifest.files) || !manifest.files.length || !manifest.sqlChecks || !manifest.tools?.docker || !manifest.tools?.node || !/^mysqldump\s/.test(manifest.tools?.mysqldump || '')) fail('备份 manifest 缺来源/时间/范围/工具/校验信息');
  if(!Object.keys(manifest.sqlChecks).length || Object.entries(manifest.sqlChecks).some(([name,value])=>!identifier.test(name) || !/^[a-f0-9]{64}$/.test(value?.sha256) || !Number.isInteger(value?.rows) || value.rows<1))fail('备份SQL一致性摘要无效');
  const names = new Set();
  for (const entry of manifest.files) {
    if (!/^(database\.sql|objects\/[0-9]{6}\.bin)$/.test(entry.file) || names.has(entry.file) || !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0) fail('备份条目非法/重复');
    names.add(entry.file);
    const location = path.join(root,...entry.file.split('/'));
    controlledPath(location,{allowEmpty:entry.file!=='database.sql',maxBytes:1024*1024*1024});
    const bytes = fs.readFileSync(location);
    if ((entry.file === 'database.sql' && bytes.length === 0) || bytes.length !== entry.bytes || hash(bytes) !== entry.sha256) fail('备份文件损坏或为空');
  }
  if (!names.has('database.sql') || manifest.files.filter(f=>f.file.startsWith('objects/')).some(f=>typeof f.key!=='string') || manifest.files.some(f=>f.key!==undefined && !f.file.startsWith('objects/')) || new Set(manifest.files.filter(f=>f.key!==undefined).map(f=>f.key)).size!==manifest.files.length-1) fail('备份缺数据库/对象范围或对象key重复');
  return manifest;
}

export async function checkHttp(check, secrets = {}, {fetchImpl = fetch,signal} = {}) {
  const headers = {...check.headers,...(check.authorizationKey ? {Authorization:secrets[check.authorizationKey]} : {})};
  try {
    const response = await fetchImpl(check.url,{headers,redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(check.timeoutMs)]):AbortSignal.timeout(check.timeoutMs)});
    const body = await readBounded(response,1024*1024);
    if (response.status !== check.status) fail('HTTP status 不符');
    let json; try {json = JSON.parse(body);} catch {fail('JSON 无效');}
    for (const [field,value] of Object.entries(check.json)) {
      const observed = field.split('.').reduce((current,key)=>current?.[key],json);
      if (JSON.stringify(observed)!==JSON.stringify(value)) fail('业务字段不符');
    }
    return {name:check.name,kind:check.kind,passed:true,status:response.status};
  } catch { fail(`HTTP check ${check.name} 失败（响应正文/授权已隐藏）`); }
}

async function verifyRestartedApplication(config,{fetchImpl=fetch}={}) {
  const deadline=Date.now()+120000;
  do {
    try{for(const check of config.checks)await checkHttp(check,config.secrets,{fetchImpl});return;}
    catch{if(Date.now()>=deadline)fail('源应用重启后readiness/业务未恢复');await new Promise(resolve=>setTimeout(resolve,1000));}
  }while(Date.now()<deadline);
  fail('源应用重启后readiness/业务未恢复');
}

function validateCapacity(spec,secrets) {
  for (const [key,max] of [['concurrency',64],['ratePerSecond',100],['durationSeconds',300],['maxRequests',10000],['timeoutMs',60000]]) number(spec?.[key],key,max);
  validateHttpChecks([{...spec,name:'capacity-check',kind:'readiness'}, {...spec,name:'capacity-business',kind:'business'}],secrets);
  if(spec.slo && (!Number.isFinite(spec.slo.p95Ms) || spec.slo.p95Ms<=0 || !Number.isFinite(spec.slo.maxErrorRate) || spec.slo.maxErrorRate<0 || spec.slo.maxErrorRate>1))fail('SLO 参数无效');
}

export async function measureCapacity(spec, secrets = {}, {fetchImpl = fetch,signal} = {}) {
  validateCapacity(spec,secrets);
  const started = performance.now(), until = started + spec.durationSeconds * 1000;
  let issued = 0, errors = 0, active = 0, peak = 0; const latencies = [], pending = new Set();
  while (!signal?.aborted && performance.now() < until && issued < spec.maxRequests) {
    const due = started + issued * 1000 / spec.ratePerSecond;
    if (active >= spec.concurrency || performance.now() < due) { await new Promise(r=>setTimeout(r,5)); continue; }
    issued++; active++; peak=Math.max(peak,active); const requestStarted=performance.now();
    const operation=checkHttp({...spec,name:'capacity-request'},secrets,{fetchImpl,signal}).catch(()=>{errors++;}).finally(()=>{latencies.push(performance.now()-requestStarted);active--;pending.delete(operation);});
    pending.add(operation);
  }
  await Promise.all(pending);
  if (signal?.aborted) fail('容量测量中断；在途请求已结束');
  latencies.sort((a,b)=>a-b);
  const elapsedMs=performance.now()-started, percentile=p=>latencies[Math.min(latencies.length-1,Math.ceil(latencies.length*p)-1)] || 0;
  const result={issued,errors,errorRate:issued?errors/issued:0,peakConcurrency:peak,elapsedMs,requestsPerSecond:issued/(elapsedMs/1000),p50Ms:percentile(.5),p95Ms:percentile(.95),p99Ms:percentile(.99),cleanup:{activeRequests:active},acceptance:'blocked: capacity SLO 未提供'};
  if (spec.slo) {
    result.acceptance=result.p95Ms<=spec.slo.p95Ms && result.errorRate<=spec.slo.maxErrorRate?'passed':'failed';
  }
  return result;
}

export async function executeOperation(args, config, {run = runProcess, fetchImpl = fetch, signal, emit = console.log} = {}) {
  const backupDir=args.backup?controlledPath(args.backup,{directory:true,missing:args.command==='backup'}):undefined;
  let manifest;
  if (['verify-backup','restore'].includes(args.command)) manifest=verifyBackup(backupDir);
  if (args.command==='verify-backup') { const result={mode:args.execute?'executed':'preview',backup:'integrity-passed',files:manifest.files.length,createdAt:manifest.createdAt};emit(JSON.stringify(result));return result; }
  const target=await inspectTarget(config,run,{fresh:args.command==='restore'});
  if (args.command==='restore' && manifest.source.project===config.project) fail('恢复源与目标不得相同');
  const plan={mode:args.execute?'execute':'preview',command:args.command,...target.summary,backup:backupDir?path.relative(repo,backupDir):undefined,impact:args.command==='backup'?'暂时停止 application；数据库与对象只读复制':args.command==='restore'?'创建全新隔离 project，导入数据库和对象，执行一致性/API验证，finally删除仅本轮目标':args.command==='rollback'?'仅更换 application 镜像，保留所有数据，不逆向 SQL':args.command==='cleanup'?'删除已核验 owned project 的容器/网络/卷':'限时只读 HTTP 验证'};
  if (args.command==='capacity') validateCapacity(config.capacity,config.secrets);
  if (args.command==='rollback' && !/^(?:.+@)?sha256:[a-f0-9]{64}$/.test(config.rollback?.image || '')) fail('回滚必须提供固定旧镜像 digest/image ID');
  if (args.command==='alert' && (!config.alert?.receiver || !config.alert?.ruleId)) fail('blocked: 缺告警 ruleId/receiver 及实际接收证据');
  if(args.command==='alert') {
    for(const phase of ['signal','trigger','received','recovered']) {
      const check=config.alert[phase];
      if(!check || check.json?.runId!==config.runId || check.json?.ruleId!==config.alert.ruleId || (phase==='received' && check.json?.receiver!==config.alert.receiver)) fail(`blocked: 缺 ${phase} 告警关联证据`);
      validateHttpChecks([{...check,name:'alert-check',kind:'readiness'},{...check,name:'alert-business',kind:'business'}],config.secrets);
    }
    if(config.alert.injectService) {
      if(!Object.values(config.services).includes(config.alert.injectService))fail('告警故障注入必须选择声明的 owned service');
      if(!serviceContainer(target,config.alert.injectService).State?.Running)fail('故障注入目标本来未运行');
    }
  }
  if(args.command==='rollback')plan.rollback={image:config.rollback.image,configSha256:config.rollback.configSha256,schemaSha256:config.rollback.schemaSha256,compatibility:'execute前核验旧镜像存在、配置/schema摘要与readiness/业务失败触发'};
  if(manifest)plan.source={project:manifest.source.project,runId:manifest.source.runId,createdAt:manifest.createdAt,files:manifest.files.length};
  if(['backup','restore'].includes(args.command))plan.dataScope={database:config.database,bucket:config.s3.bucket,maxObjects:config.s3.maxObjects,maxBytes:config.s3.maxBytes,sqlChecks:config.sqlChecks.map(c=>c.name)};
  if(args.command==='capacity')plan.capacity={...Object.fromEntries(['concurrency','ratePerSecond','durationSeconds','maxRequests','timeoutMs'].map(key=>[key,config.capacity[key]])),target:new URL(config.capacity.url).origin+new URL(config.capacity.url).pathname,slo:config.capacity.slo || '未提供；只测量不判达标'};
  emit(JSON.stringify(plan));
  if (!args.execute || args.command==='inspect') return plan;
  const evidenceRoot=path.join(config.root,'evidence');fs.mkdirSync(evidenceRoot,{recursive:true,mode:0o700});
  const stateFile=path.join(evidenceRoot,`${args.command}-${Date.now()}.json`);
  const state={...plan,pid:process.pid,port:null,log:path.relative(repo,stateFile),status:'running',startedAt:new Date().toISOString(),cleanup:null};
  const write=()=>fs.writeFileSync(stateFile,JSON.stringify(state,null,2)+'\n',{encoding:'utf8',mode:0o600});write();
  let createdRestore=false, pausedApp, primaryError;
  const checkAll=async()=>{const results=[];for(const check of config.checks) results.push(await checkHttp(check,config.secrets,{fetchImpl,signal}));return results;};
  try {
    if(args.command==='checks') state.result=await checkAll();
    if(args.command==='capacity') state.result=await measureCapacity(config.capacity,config.secrets,{fetchImpl,signal});
    if(args.command==='alert') {
      // Four independent HTTP contracts must return the exact rule/run correlation.
      state.result={};
      for(const phase of ['signal','trigger','received','recovered']) {
        if(phase==='trigger' && config.alert.injectService) {
          if(!Object.values(config.services).includes(config.alert.injectService)) fail('告警故障注入必须选择声明的 owned service');
          const container=serviceContainer(target,config.alert.injectService);
          if(!container.State?.Running) fail('故障注入目标本来未运行');
          await run(['stop','--time','30',container.Id],{signal});pausedApp=container.Id;
        }
        if(phase==='recovered' && pausedApp) {await run(['start',pausedApp],{signal});}
        const check=config.alert[phase];
        state.result[phase]=await checkHttp({...check,name:`alert-${phase}`},config.secrets,{fetchImpl,signal});
      }
    }
    if(args.command==='backup') {
      if(fs.existsSync(backupDir)) fail('备份目标已存在，禁止覆盖');
      const mysql=serviceContainer(target,config.services.mysql),app=serviceContainer(target,config.services.application);
      if(app.State?.Running) {await run(['stop','--time','30',app.Id],{signal});pausedApp=app.Id;}
      fs.mkdirSync(path.join(backupDir,'objects'),{recursive:true,mode:0o700});
      const dump=await run(['exec',mysql.Id,'sh','-ec','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump --single-transaction --routines --events --triggers --hex-blob --skip-comments -uroot "$1"','ops',config.database],{maxBytes:config.s3.maxBytes,signal});
      if(!dump.length) fail('数据库导出为空');
      fs.writeFileSync(path.join(backupDir,'database.sql'),dump,{mode:0o600});
      const files=[{file:'database.sql',bytes:dump.length,sha256:hash(dump)}];
      const objects=await listObjects(config,{fetchImpl,signal});
      for(let i=0;i<objects.length;i++) {
        const captured=await s3Request(config,'GET',objects[i].key,{fetchImpl,signal,withMetadata:true}),bytes=captured.data;
        if(bytes.length!==objects[i].size) fail('对象在备份中变化，停止');
        const file=`objects/${String(i).padStart(6,'0')}.bin`;fs.writeFileSync(path.join(backupDir,file),bytes,{mode:0o600});
        files.push({file,key:objects[i].key,bytes:bytes.length,sha256:hash(bytes),metadata:captured.metadata});
      }
      const dockerVersion=(await run(['version','--format','{{.Client.Version}}'],{signal})).toString().trim();
      const dumpVersion=(await run(['exec',mysql.Id,'mysqldump','--version'],{signal,maxBytes:4096})).toString().trim();
      if(!/^mysqldump\s/.test(dumpVersion))fail('无法确认数据库备份工具版本');
      const saved={version:1,createdAt:new Date().toISOString(),source:{project:config.project,runId:config.runId,images:target.summary.containers.map(c=>({service:c.service,image:c.image}))},tools:{node:process.version,docker:dockerVersion,mysqldump:dumpVersion},database:config.database,bucket:config.s3.bucket,sqlChecks:await sqlSnapshot(config,mysql,run,signal),files};
      fs.writeFileSync(path.join(backupDir,'manifest.json'),JSON.stringify(saved,null,2)+'\n',{mode:0o600});
      verifyBackup(backupDir);state.result={backup:'integrity-passed',files:files.length};
    }
    if(args.command==='restore') {
      if(manifest.database!==config.database || manifest.bucket!==config.s3.bucket) fail('备份数据库/bucket 范围不匹配');
      createdRestore=true;
      const dependencies=Object.keys(target.definition.services[config.services.application].depends_on || {});
      await run([...composeArgs(config),'up','-d','--wait','--wait-timeout','120',...new Set([config.services.mysql,config.services.minio,...dependencies])],{signal,timeoutMs:180000});
      const restored=await inspectTarget(config,run),mysql=serviceContainer(restored,config.services.mysql);
      await run(['exec','-i',mysql.Id,'sh','-ec','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot "$1"','ops',config.database],{input:fs.readFileSync(path.join(backupDir,'database.sql')),signal});
      await run(['exec','-i',mysql.Id,'sh','-ec','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot'],{input:`CREATE USER '${config.secrets.databaseUser}'@'%' IDENTIFIED BY '${config.secrets.databasePassword}'; GRANT ALL PRIVILEGES ON \`${config.database}\`.* TO '${config.secrets.databaseUser}'@'%';`,signal});
      const snapshot=await sqlSnapshot(config,mysql,run,signal);
      if(JSON.stringify(snapshot)!==JSON.stringify(manifest.sqlChecks)) fail('恢复后关键数据字段/关联摘要不一致');
      await s3Request(config,'PUT','',{fetchImpl,signal});
      for(const entry of manifest.files.filter(f=>f.key!==undefined)) {
        await s3Request(config,'PUT',entry.key,{body:fs.readFileSync(path.join(backupDir,entry.file)),metadata:entry.metadata,fetchImpl,signal});
        if(hash(await s3Request(config,'GET',entry.key,{fetchImpl,signal}))!==entry.sha256) fail('恢复后对象 checksum 不匹配');
      }
      if((await listObjects(config,{fetchImpl,signal})).length!==manifest.files.length-1) fail('恢复对象数量不一致');
      await run([...composeArgs(config),'up','-d','--wait','--wait-timeout','180',config.services.application],{signal,timeoutMs:240000});
      if(config.authentication) {
        const authentication=config.authentication;
        const result=await loginWithRealCaptcha({backendUrl:authentication.backendUrl,username:config.secrets.adminUsername,password:config.secrets.adminPassword,loginCandidates:'',rsaPublicKey:config.secrets.requestPublicKey,redisHost:'127.0.0.1',redisPort:authentication.redisPort,redisPassword:config.secrets.redisPassword,maxCaptchaAttempts:1,captchaFetchRetries:2,captchaFetchRetryDelayMs:1000,signal},path.join(evidenceRoot,'restored-login'));
        config.secrets.bearer=`Bearer ${result.token}`;
      }
      state.result={database:'consistent',objects:manifest.files.length-1,checks:await checkAll(),backupAgeSeconds:(Date.now()-Date.parse(manifest.createdAt))/1000,rtoAcceptance:config.rtoSeconds?'pending elapsed measurement':'blocked: RTO 未定义',rpoAcceptance:config.rpoSeconds?'blocked: 未验证业务提交水位及实际丢失窗口':'blocked: RPO 未定义且未验证业务提交水位'};
    }
    if(args.command==='rollback') {
      const image=config.rollback.image;
      await run(['image','inspect',image],{signal});
      if(config.rollback.configSha256!==hash(fs.readFileSync(config.composeFile))) fail('旧镜像兼容配置摘要不符');
      const mysql=serviceContainer(target,config.services.mysql);
      const schema=await run(['exec',mysql.Id,'sh','-ec','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump --no-data --skip-comments --compact -uroot "$1"','ops',config.database],{signal});
      if(config.rollback.schemaSha256!==hash(schema)) fail('旧镜像数据/schema兼容性未确认');
      let unhealthy=false;try{await checkAll();}catch{unhealthy=true;}
      if(!unhealthy) fail('未触发回滚：readiness/业务仍健康');
      const override=path.join(evidenceRoot,'rollback-override.json');
      fs.writeFileSync(override,JSON.stringify({services:{[config.services.application]:{image,build:null}}}),{mode:0o600});
      await run([...composeArgs(config),'-f',override,'up','-d','--no-deps','--no-build','--wait','--wait-timeout','180',config.services.application],{signal,timeoutMs:240000});
      const actual=serviceContainer(await inspectTarget(config,run),config.services.application);
      const expected=JSON.parse((await run(['image','inspect',image],{signal})).toString())[0].Id;
      if(actual.Image!==expected) fail('回滚后实际镜像不匹配');
      state.result={image,checks:await checkAll(),data:'preserved; no reverse SQL'};
    }
    if(args.command==='cleanup') {
      await run([...composeArgs(config),'down','--volumes','--remove-orphans'],{signal});
      const remaining=await inspectTarget(config,run,{fresh:true});
      state.result={remainingContainers:remaining.containers.length};
      state.cleanup='verified';
    }
    state.status=state.result?.acceptance==='failed'?'failed':'passed';
  } catch(error) {primaryError=error;state.status=signal?.aborted?'interrupted':'failed';state.error=error.message;}
  finally {
    const cleanupErrors=[];
    if(pausedApp) try{await run(['start',pausedApp]);const actual=JSON.parse((await run(['inspect',pausedApp])).toString())[0];if(!actual.State?.Running) fail('备份后应用未恢复运行');await verifyRestartedApplication(config,{fetchImpl});}catch{cleanupErrors.push('源应用重新启动或readiness/业务恢复失败');}
    if(createdRestore) try{await inspectTarget(config,run);await run([...composeArgs(config),'down','--volumes','--remove-orphans']);await inspectTarget(config,run,{fresh:true});}catch{cleanupErrors.push('恢复 owned project 清理未核验成功');}
    state.cleanup=cleanupErrors.length?{status:'failed',errors:cleanupErrors}:{status:'verified',restoredApplication:Boolean(pausedApp),removedRestoreProject:createdRestore};
    state.elapsedMs=Date.now()-Date.parse(state.startedAt);state.finishedAt=new Date().toISOString();
    if(state.result && args.command==='restore') {
      state.result.rtoAcceptance=config.rtoSeconds?(state.elapsedMs/1000<=config.rtoSeconds?'passed':'failed'):'blocked: RTO 未定义';
      if(state.result.rtoAcceptance==='failed' || state.result.rpoAcceptance==='failed')state.status='failed';
    }
    if(cleanupErrors.length) state.status='failed';write();
    emit(JSON.stringify({status:state.status,evidence:path.relative(repo,stateFile),cleanup:state.cleanup,result:state.result}));
    if(cleanupErrors.length) fail(`${primaryError?primaryError.message+'; ':''}${cleanupErrors.join('; ')}`);
  }
  if(primaryError) throw primaryError;
  if(state.result?.acceptance==='failed') fail('容量 SLO 未通过');
  if(state.result?.rtoAcceptance==='failed' || state.result?.rpoAcceptance==='failed')fail('恢复 RTO/RPO 未通过');
  return state;
}

async function main() {
  const args=parseArgs(process.argv.slice(2));if(args.help){console.log(help);return;}
  const config=loadConfig(args.config),abort=new AbortController();
  const stop=()=>abort.abort();for(const event of ['SIGINT','SIGTERM','SIGHUP']) process.once(event,stop);
  try{await executeOperation(args,config,{signal:abort.signal});}finally{for(const event of ['SIGINT','SIGTERM','SIGHUP']) process.removeListener(event,stop);}
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(error=>{console.error(`[production-ops] ${error.message}`);process.exitCode=1;});
