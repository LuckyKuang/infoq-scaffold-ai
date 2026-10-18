#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {X509Certificate, createPrivateKey, createPublicKey, randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export function assertSafePath(target) {
  if (!path.isAbsolute(target) || path.resolve(target) !== target || target === path.parse(target).root || /[\r\n]/u.test(target)) throw new Error('部署路径必须是非根、规范绝对路径');
  for (let current = target; current !== path.dirname(current); current = path.dirname(current)) {
    try { if (fs.lstatSync(current).isSymbolicLink()) throw new Error('部署路径不允许符号链接'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

function origin(value, name, production) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} 必须是有效 origin`); }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || !['http:', 'https:'].includes(url.protocol) || /[^a-zA-Z0-9.:[\]-]/u.test(url.host)) throw new Error(`${name} 只能包含协议、主机和端口`);
  if (production && (url.protocol !== 'https:' || url.port)) throw new Error(`${name} 生产模式必须使用标准 443 HTTPS origin`);
  if (!production && url.port) throw new Error(`${name} 开发网关仅支持标准 HTTP/HTTPS 端口`);
  return url;
}

function readMaterial(file, name, privateKey = false) {
  if (!file) throw new Error(`缺少 ${name}`);
  assertSafePath(file);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.nlink !== 1 || (stat.mode & 0o022) || (privateKey && (stat.mode & 0o077))) throw new Error(`${name} 必须是受控普通文件，私钥权限要求 0600`);
  if (stat.size > 1024 * 1024) throw new Error(`${name} 文件过大`);
  return fs.readFileSync(file, 'utf8');
}

export function validateGatewayConfig(env) {
  const mode = env.INFOQ_DEPLOY_MODE || 'production';
  if (!['production', 'development'].includes(mode)) throw new Error('INFOQ_DEPLOY_MODE 无效');
  const production = mode === 'production';
  const app = origin(env.INFOQ_PUBLIC_BASE_URL, 'INFOQ_PUBLIC_BASE_URL', production);
  const oss = origin(env.INFOQ_OSS_PUBLIC_ORIGIN, 'INFOQ_OSS_PUBLIC_ORIGIN', production);
  if (app.hostname === oss.hostname || app.protocol !== oss.protocol || app.port !== oss.port) throw new Error('应用和 OSS 必须使用不同主机、相同协议和端口');
  const tls = app.protocol === 'https:';
  let certificate, privateKey;
  if (tls) {
    certificate = readMaterial(env.INFOQ_TLS_CERT_FILE, 'INFOQ_TLS_CERT_FILE');
    privateKey = readMaterial(env.INFOQ_TLS_KEY_FILE, 'INFOQ_TLS_KEY_FILE', true);
    try {
      const blocks = certificate.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/gu);
      if (!blocks?.length || certificate.replace(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/gu, '').trim()) throw new Error();
      const certificates = blocks.map((block) => new X509Certificate(block));
      const now = Date.now();
      for (const cert of certificates) if (Date.parse(cert.validFrom) > now || Date.parse(cert.validTo) <= now) throw new Error();
      for (let index = 0; index < certificates.length - 1; index += 1) if (!certificates[index].checkIssued(certificates[index + 1]) || !certificates[index].verify(certificates[index + 1].publicKey)) throw new Error();
      const leaf = certificates[0];
      if (production && env.INFOQ_CONFIG_SOURCE !== 'isolated-test' && leaf.checkIssued(leaf) && leaf.verify(leaf.publicKey)) throw new Error();
      for (const url of [app, oss]) {
        const hostname = url.hostname.replace(/^\[|\]$/gu, '');
        if (!(net.isIP(hostname) ? leaf.checkIP(hostname) : leaf.checkHost(hostname, {subject: 'never'}))) throw new Error();
      }
      if (!leaf.checkPrivateKey(createPrivateKey(privateKey))) throw new Error();
      createPublicKey(privateKey);
    } catch { throw new Error('TLS 证书、私钥、证书链、有效期或应用/OSS 域名核验失败'); }
  } else if (env.INFOQ_TLS_CERT_FILE || env.INFOQ_TLS_KEY_FILE) {
    throw new Error('HTTP 模式不得提供 TLS 材料，禁止静默降级');
  }
  const root = env.INFOQ_DEPLOY_ROOT;
  assertSafePath(root || '');
  const target = env.INFOQ_FRONTEND_TARGET || 'all';
  if (!['all', 'vue', 'react'].includes(target)) throw new Error('INFOQ_FRONTEND_TARGET 无效');
  const vuePath = target === 'vue' ? '/' : env.INFOQ_VUE_CONTEXT_PATH || '/vue/';
  const reactPath = target === 'react' ? '/' : env.INFOQ_REACT_CONTEXT_PATH || '/react/';
  for (const value of [vuePath, reactPath]) if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/u.test(value)) throw new Error('前端 context path 无效');
  if (target === 'all' && (vuePath === '/' || reactPath === '/' || vuePath.startsWith(reactPath) || reactPath.startsWith(vuePath) || [vuePath, reactPath].some((value) => /^\/(?:prod-api|console-oss|oss)(?:\/|$)/u.test(value)))) throw new Error('双端 context path 必须独立且不与 API/Console 路径重叠');
  return {app, oss, tls, root, target, certificate, privateKey, vuePath, reactPath};
}

const proxyHeaders = `proxy_set_header Host $http_host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;`;

export function renderGatewayConfig(config) {
  const {app, oss, tls, target, vuePath, reactPath} = config;
  const tlsOptions = tls ? `listen 443 ssl;
        ssl_certificate /etc/nginx/cert/tls.crt;
        ssl_certificate_key /etc/nginx/cert/tls.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_session_cache shared:TLS:10m;` : 'listen 80;';
  const frontends = target === 'all' ? `location = / { return 302 ${vuePath}; }
        location = ${vuePath.slice(0, -1)} { return 302 ${vuePath}; }
        location = ${reactPath.slice(0, -1)} { return 302 ${reactPath}; }
        location ^~ ${vuePath} { ${proxyHeaders} proxy_pass http://infoq-frontend-vue:9091/; }
        location ^~ ${reactPath} { ${proxyHeaders} proxy_pass http://infoq-frontend-react:9092/; }` : `location / { ${proxyHeaders} proxy_pass http://infoq-frontend-${target}:${target === 'vue' ? 9091 : 9092}; }`;
  return `# Generated by deploy/bin/render-gateway.mjs; configure env, never hand-edit TLS here.
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;
events { worker_connections 1024; }
http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    server_tokens off;
    sendfile on;
    keepalive_timeout 65;
    client_max_body_size 200m;
    map $http_upgrade $connection_upgrade { default upgrade; '' close; }
    # Query strings can contain temporary signed credentials; never log them.
    log_format safe '$remote_addr [$time_local] "$request_method $uri $server_protocol" $status $body_bytes_sent';
    access_log /var/log/nginx/access.log safe;
    ${tls ? `server { listen 80; server_name ${app.hostname} ${oss.hostname}; return 308 https://$host$request_uri; }` : ''}
    server {
        ${tlsOptions}
        server_name ${app.hostname};
        ${frontends}
        location ^~ /prod-api/ {
            ${proxyHeaders}
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_read_timeout 86400s;
            proxy_buffering off;
            proxy_pass http://infoq-admin:9090/;
        }
        location = /console-oss { return 302 /console-oss/; }
        location ^~ /console-oss/ {
            ${proxyHeaders}
            proxy_set_header X-Forwarded-Host $http_host;
            proxy_set_header X-Forwarded-Prefix /console-oss;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection $connection_upgrade;
            proxy_buffering off;
            proxy_pass http://minio:9001/;
        }
    }
    server {
        ${tlsOptions}
        server_name ${oss.hostname};
        ignore_invalid_headers off;
        location / {
            ${proxyHeaders}
            proxy_http_version 1.1;
            proxy_request_buffering off;
            proxy_buffering off;
            # No URI replacement: S3 signatures bind the original Host and path.
            proxy_pass http://minio:9000;
        }
    }
}
`;
}

export function writeGateway(config) {
  const files = [[path.join(config.root, 'nginx/conf/nginx.conf'), renderGatewayConfig(config), 0o644]];
  if (config.tls) files.unshift([path.join(config.root, 'nginx/cert/tls.crt'), config.certificate, 0o644], [path.join(config.root, 'nginx/cert/tls.key'), config.privateKey, 0o600]);
  for (const [file] of files) { assertSafePath(file); if (fs.existsSync(file) && (!fs.lstatSync(file).isFile() || fs.lstatSync(file).nlink !== 1)) throw new Error('网关输出必须是普通文件'); }
  // Same-filesystem staging is needed for rename; these are runtime-owned paths,
  // never repository scratch artifacts. nginx.conf is committed after both keys.
  const staged = [];
  const previous = files.map(([file]) => fs.existsSync(file) ? {file, data: fs.readFileSync(file), mode: fs.statSync(file).mode & 0o777} : {file});
  try {
    for (const [file, data, mode] of files) {
      const temporary = path.join(path.dirname(file), `.infoq-render-${randomUUID()}`);
      fs.writeFileSync(temporary, data, {encoding: 'utf8', mode, flag: 'wx'});
      staged.push({file, temporary});
    }
    for (const {file, temporary} of staged) fs.renameSync(temporary, file);
  } catch (error) {
    try {
      for (const old of previous) {
        if (old.data) {
          const temporary = path.join(path.dirname(old.file), `.infoq-restore-${randomUUID()}`);
          fs.writeFileSync(temporary, old.data, {mode: old.mode, flag: 'wx'});
          fs.renameSync(temporary, old.file);
        } else fs.rmSync(old.file, {force: true});
      }
    } catch { throw new Error('网关渲染失败且恢复失败，禁止启动 nginx'); }
    throw error;
  } finally { for (const {temporary} of staged) fs.rmSync(temporary, {force: true}); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === '--help') { console.log('用法: node deploy/bin/render-gateway.mjs check | render --execute\n读取受控环境；先核验 TLS/域名/路径，render 仅写入已准备的 nginx cert/conf。'); process.exit(0); }
    if (!(args.length === 1 && args[0] === 'check') && !(args.length === 2 && args[0] === 'render' && args[1] === '--execute')) throw new Error('只接受 check 或 render --execute');
    const config = validateGatewayConfig(process.env);
    if (args[0] === 'render') writeGateway(config);
    console.log(`[gateway] ${args[0]} passed; mode=${config.tls ? 'https' : 'development-http'}; target=${config.target}`);
  } catch (error) { console.error(`[gateway] ${error.message}`); process.exitCode = 1; }
}
