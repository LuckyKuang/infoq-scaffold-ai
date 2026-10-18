#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import crypto from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {createProductionFixture} from '../production_fixture.mjs';
import {readProductionConfig,validateProductionConfig,verifyFrontendArtifact,frontendBuildCacheKey} from '../production_config.mjs';
import {validateGatewayConfig,writeGateway} from '../../deploy/bin/render-gateway.mjs';
import {runProcess,loadConfig,inspectTarget,executeOperation,s3Request} from './production_ops.mjs';
import {loginWithRealCaptcha} from '../../skills/test-cli/scripts/captcha_login.mjs';
import {establishBrowserSession} from '../lib/browser_session.mjs';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const help=`Linux Docker 隔离全栈验收（不会调用生产或真实OAuth Provider）
node tools/verify/linux_acceptance.mjs --run-id <slug> [--execute]
默认仅计划；--execute 会构建真实镜像、绑定 loopback 80/443/19090/19000/16379，
创建 infoq-verify-<run-id> 和独立 restore project，并在 finally 核验删除 owned 容器/卷/网络。
要求 Linux、本机Docker Compose v2/BuildKit、openssl、test-cli Playwright与Chromium。
所有配置/自签证书/数据/证据只在 tmp/production-readiness/linux-<run-id>/。
高负载、真实Provider、外部告警接收、生产SLO/RTO/RPO不在该隔离环境虚报。
`;

export function parseLinuxArgs(args) {
  if(args.length===0 || args.includes('--help')) return {help:true};
  const result={execute:false};
  for(let i=0;i<args.length;i++) {
    if(args[i]==='--execute' && !result.execute)result.execute=true;
    else if(args[i]==='--run-id' && !result.runId && args[i+1])result.runId=args[++i];
    else throw Error('参数未知、重复或缺值');
  }
  if(!/^[a-z][a-z0-9-]{2,21}$/.test(result.runId || ''))throw Error('run-id 必须为 3..22 位小写字母/数字/连字符');
  return result;
}

function save(file,value,mode=0o600) {fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});fs.writeFileSync(file,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{mode});return file;}

export function isolateDefinition(definition,{project,runId,root,environment,ports}) {
  const result=structuredClone(definition);delete result.name;
  result.volumes ||= {};
  for(const [name,service] of Object.entries(result.services)) {
    service.container_name=`${project}-${name}`;
    service.labels={...service.labels,'com.infoq.ops.run':runId};
    service.restart='no';
    if(!['nginx-web'].includes(name) && (service.ports || []).some(port=>port.host_ip!=='127.0.0.1'))throw Error('基础 Compose 的辅助端口默认未限制loopback');
    service.ports=(service.ports || []).filter(port=>ports[name]?.[port.target]).map(port=>({...port,host_ip:'127.0.0.1',published:String(ports[name][port.target])}));
    service.volumes=(service.volumes || []).map(mount=>{
      if(mount.type!=='bind')return mount;
      if(['/var/lib/mysql','/redis/data','/data'].includes(mount.target)) {
        const key=`${name}-data`;result.volumes[key]={name:`${project}_${key}`,labels:{'com.infoq.ops.run':runId}};
        return {type:'volume',source:key,target:mount.target};
      }
      if(mount.target==='/docker-entrypoint-initdb.d')return {...mount,source:path.join(root,'sql')};
      if(mount.source.startsWith(environment.INFOQ_DEPLOY_ROOT))return mount;
      throw Error('基础Compose存在未归属bind mount');
    });
    if(service.build) {service.build.args={...service.build.args};service.image=`infoq-verify/${project}-${name}:candidate`;}
  }
  for(const [name,entry] of Object.entries(result.volumes))entry.name=`${project}_${name}`;
  for(const [name,entry] of Object.entries(result.networks || {})) {entry.name=`${project}_${name}`;entry.labels={...entry.labels,'com.infoq.ops.run':runId};}
  if(result.secrets?.production_config)result.secrets.production_config.file=environment.INFOQ_PRODUCTION_CONFIG_FILE;
  return result;
}

async function tlsRequest(url,{ca,headers={},method='GET',body,timeout=10000}={}) {
  return new Promise((resolve,reject)=>{
    const request=https.request(url,{ca,method,headers,signal:AbortSignal.timeout(timeout),lookup:(_host,options,callback)=>options.all?callback(null,[{address:'127.0.0.1',family:4}]):callback(null,'127.0.0.1',4)},response=>{
      const chunks=[];let bytes=0;
      response.on('data',chunk=>{bytes+=chunk.length;if(bytes>1024*1024)request.destroy(new Error('response-limit'));else chunks.push(chunk);});
      response.on('end',()=>resolve({status:response.statusCode,body:Buffer.concat(chunks),headers:response.headers}));
    });
    request.on('error',()=>reject(new Error('TLS/HTTP 请求失败（敏感上下文隐藏）')));request.setTimeout(timeout,()=>request.destroy());request.end(body);
  });
}

// A bind-mounted single file keeps its old inode after the renderer renames
// the new configuration; recreating only this owned service remounts it.
export async function activateGateway(composeArguments,run) {
  await run([...composeArguments,'up','-d','--no-deps','--force-recreate','--wait','nginx-web'],{timeoutMs:120000});
}

export function assertAnonymousDenied(response) {
  if([401,403].includes(response.status))return;
  let code;
  try{code=JSON.parse(response.body).code;}catch{throw Error('匿名受保护路径未返回明确鉴权拒绝');}
  if(response.status!==200 || ![401,403].includes(code))throw Error('匿名受保护路径未返回明确鉴权拒绝');
}

export async function verifyProfileNavigation(page,navigate,{timeoutMs=30000}={}) {
  const responses=[];
  let received,timeout;
  const firstResponse=new Promise(resolve=>{received=resolve;});
  const capture=response=>{
    if(new URL(response.url()).pathname!=='/prod-api/system/user/profile')return;
    const status=response.status();
    // Consume the body while its document is alive; retain only safe assertions.
    responses.push(response.json().then(body=>({status,code:body?.code}),()=>({status,bodyReadFailed:true})));
    received(true);
  };
  page.on('response',capture);
  try {
    await navigate();
    // Vue mounts its static form before onMounted profile data arrives.
    if(!responses.length && !await Promise.race([firstResponse,new Promise(resolve=>{timeout=setTimeout(()=>resolve(false),timeoutMs);})]))throw Error('本次导航未观察到 profile API');
    for(const response of responses) {
      const result=await response;
      if(result.bodyReadFailed)throw Error('profile API 响应正文读取失败');
      if(result.status!==200 || result.code!==200)throw Error('profile API 业务失败');
    }
  }finally{clearTimeout(timeout);page.off('response',capture);}
}

// A one-second SigV4 link verifies actual proxy Host/path and actual expiration.
export function presignObject(env,key,expires=1) {
  const encode=value=>encodeURIComponent(value).replace(/[!'()*]/g,c=>`%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  const now=new Date().toISOString().replace(/[:-]|\.\d{3}/g,''),date=now.slice(0,8),scope=`${date}/us-east-1/s3/aws4_request`;
  const url=new URL('/'+env.INFOQ_OSS_BUCKET+'/'+key.split('/').map(encode).join('/'),env.INFOQ_OSS_PUBLIC_ORIGIN);
  const query=Object.entries({'X-Amz-Algorithm':'AWS4-HMAC-SHA256','X-Amz-Credential':`${env.MINIO_ROOT_USER}/${scope}`,'X-Amz-Date':now,'X-Amz-Expires':String(expires),'X-Amz-SignedHeaders':'host'}).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${encode(k)}=${encode(v)}`).join('&');
  const canonical=`GET\n${url.pathname}\n${query}\nhost:${url.host}\n\nhost\nUNSIGNED-PAYLOAD`;
  let signing=Buffer.from('AWS4'+env.MINIO_ROOT_PASSWORD);for(const value of [date,'us-east-1','s3','aws4_request'])signing=crypto.createHmac('sha256',signing).update(value).digest();
  const signature=crypto.createHmac('sha256',signing).update(`AWS4-HMAC-SHA256\n${now}\n${scope}\n${sha(canonical)}`).digest('hex');
  return url.origin+url.pathname+'?'+query+'&X-Amz-Signature='+signature;
}

async function main() {
  const args=parseLinuxArgs(process.argv.slice(2));if(args.help){console.log(help);return;}
  const project=`infoq-verify-${args.runId}`,runId=`run-${args.runId}`;
  console.log(JSON.stringify({mode:args.execute?'execute':'preview',project,restoreProject:`${project}-restore`,scope:['controlled two-RSA build','TLS+ports','strict anonymous authorization','real captcha login','React/Vue root+subpath DOM+refresh','private S3 signed/anonymous/expired','UID/GID+write','database+objects backup/restore','application rollback','owned cleanup'],externalAlert:'blocked: receiver not supplied',capacity:'not a production benchmark'}));
  if(!args.execute)return;
  if(process.platform!=='linux')throw Error('blocked: 真实验收只允许 Linux；不能用 macOS/Apple替代');
  const context=JSON.parse((await runProcess(['context','inspect'])).toString());
  if(!context[0]?.Endpoints?.docker?.Host?.startsWith('unix://') || process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT)throw Error('blocked: 需要本机Linux Docker context');
  if((await runProcess(['info','--format','{{.OSType}}'])).toString().trim()!=='linux')throw Error('blocked: 需要Linux Docker daemon');
  for(const target of [project,`${project}-restore`]) if((await runProcess(['ps','-aq','--filter',`label=com.docker.compose.project=${target}`])).toString().trim())throw Error('隔离项目已存在，拒绝采用');
  const root=path.join(repo,'tmp/production-readiness',`linux-${args.runId}`);
  const fixture=createProductionFixture(root),env=readProductionConfig(fixture.configFile);
  validateProductionConfig(env,{source:fixture.configFile,scope:'deploy'});
  env.INFOQ_FRONTEND_CONFIG_DIGEST=frontendBuildCacheKey(env);
  fs.appendFileSync(fixture.configFile,`INFOQ_FRONTEND_CONFIG_DIGEST=${env.INFOQ_FRONTEND_CONFIG_DIGEST}\n`,{encoding:'utf8'});
  const stateFile=path.join(root,'acceptance.state.json'),state={status:'starting',pid:process.pid,port:[80,443,19090,19000,16379],log:path.relative(repo,stateFile),project,startedAt:new Date().toISOString(),checks:{},externalConditions:{productionCredentials:'blocked: isolated fixture only',publicTrustChain:'blocked: self-signed fixture only',oauthProvider:'blocked: controlled Provider fixture is separate',alertReceipt:'blocked: no external receiver',capacitySlo:'blocked: not supplied',rtoRpo:'blocked: business goals/watermarks not supplied'},cleanup:null};
  const update=()=>save(stateFile,state);
  const stage=phase=>{state.phase=phase;state.stageStartedAt=new Date().toISOString();update();};
  const abort=new AbortController();const stop=()=>abort.abort();for(const signal of ['SIGINT','SIGTERM','SIGHUP'])process.once(signal,stop);
  let sourceConfig,restoreConfig,browser,primary;
  const run=(cmd,options={})=>runProcess(cmd,{...options,signal:options.signal || abort.signal});
  try {
    stage('prepare');
    for(const dir of ['sql','data/server/config','data/server/logs','data/server/ip2region','data/redis/conf','data/nginx/conf','data/nginx/cert','data/nginx/log','data/vue/logs','data/react/logs','data/mysql/conf'])fs.mkdirSync(path.join(root,dir),{recursive:true,mode:0o755});
    fs.cpSync(path.join(repo,'sql'),path.join(root,'sql'),{recursive:true});
    fs.copyFileSync(path.join(repo,'deploy/docker/server/application-prod.yml'),path.join(root,'data/server/config/application-prod.yml'));
    fs.copyFileSync(path.join(repo,'deploy/docker/server/ip2region/ip2region_v6.xdb'),path.join(root,'data/server/ip2region/ip2region_v6.xdb'));
    fs.copyFileSync(path.join(repo,'deploy/docker/redis/conf/redis.conf'),path.join(root,'data/redis/conf/redis.conf'));
    save(path.join(root,'data/server/config/managed-security.yml'),`api-decrypt:\n  enabled: true\n  private-key: \${INFOQ_API_REQUEST_PRIVATE_KEY}\n  public-key: \${INFOQ_API_RESPONSE_PUBLIC_KEY}\n`);
    writeGateway(validateGatewayConfig(env));
    const nginxBefore=sha(fs.readFileSync(path.join(root,'data/nginx/conf/nginx.conf')));writeGateway(validateGatewayConfig(env));
    if(nginxBefore!==sha(fs.readFileSync(path.join(root,'data/nginx/conf/nginx.conf'))))throw Error('TLS重渲染不一致');
    stage('compose-config');
    const rendered=JSON.parse((await run(['compose','--project-name',project,'--env-file',fixture.configFile,'-f',path.join(repo,'deploy/docker/docker-compose.yml'),'config','--format','json'])).toString());
    const ports={mysql:{},redis:{6379:16379},minio:{9000:19000},'infoq-admin':{9090:19090},'infoq-frontend-react':{},'infoq-frontend-vue':{},'nginx-web':{80:80,443:443}};
    const definition=isolateDefinition(rendered,{project,runId,root,environment:env,ports});
    const composeFile=save(path.join(root,'compose.json'),definition);
    const secretsFile=save(path.join(root,'ops-secrets.json'),{accessKey:env.MINIO_ROOT_USER,secretKey:env.MINIO_ROOT_PASSWORD,databaseUser:env.INFOQ_DB_USERNAME,databasePassword:env.INFOQ_DB_PASSWORD,adminUsername:env.INFOQ_ADMIN_USERNAME,adminPassword:env.INFOQ_ADMIN_PASSWORD,requestPublicKey:env.VITE_APP_RSA_PUBLIC_KEY,redisPassword:env.REDIS_PASSWORD});
    const configuration={version:1,runId,project,root,composeFile,environmentFile:fixture.configFile,secretsFile,services:{mysql:'mysql',minio:'minio',application:'infoq-admin'},database:'infoq',sqlChecks:[{name:'users-fields',sql:'SELECT user_id,user_name,status,del_flag FROM sys_user ORDER BY user_id'},{name:'user-role-relations',sql:'SELECT user_id,role_id FROM sys_user_role ORDER BY user_id,role_id'},{name:'oss-fields',sql:'SELECT oss_config_id,bucket_name,access_policy,status FROM sys_oss_config ORDER BY oss_config_id'}],checks:[{name:'readiness-check',kind:'readiness',url:'http://127.0.0.1:19090/monitor/health/readiness',status:200,timeoutMs:10000,json:{status:'UP'}},{name:'miniapp-probe',kind:'business',url:'http://127.0.0.1:19090/auth/wechat-miniapp/enabled',status:200,timeoutMs:10000,json:{code:200,data:false}}],s3:{origin:'http://127.0.0.1:19000',bucket:env.INFOQ_OSS_BUCKET,maxObjects:100,maxBytes:128*1024*1024}};
    const opsFile=save(path.join(root,'ops.json'),configuration);sourceConfig=loadConfig(opsFile);
    const compose=(...cmd)=>['compose','--project-name',project,'--env-file',fixture.configFile,'-f',composeFile,...cmd];
    stage('ownership');
    await inspectTarget(sourceConfig,run,{fresh:true});
    state.status='running';stage('build');
    await run(compose('build'),{timeoutMs:1800000,maxBytes:32*1024*1024});state.checks.controlledBuild='passed';update();
    stage('deps-up');
    await run(compose('up','-d','--wait','--wait-timeout','180','mysql','redis','minio'),{timeoutMs:240000});
    stage('seed');
    const target=await inspectTarget(sourceConfig,run);
    const mysql=target.containers.find(c=>c.Config.Labels['com.docker.compose.service']==='mysql');
    const mysqlInput=async(sql)=>run(['exec','-i',mysql.Id,'sh','-ec','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot infoq'],{input:sql});
    const bcrypt=(await run(compose('run','--rm','--no-deps','-T','--entrypoint','java','infoq-admin','-jar','/infoq/server/app.jar','--infoq-bcrypt-hash-stdin'),{input:env.INFOQ_ADMIN_PASSWORD,timeoutMs:120000})).toString().trim();
    if(!/^\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}$/.test(bcrypt))throw Error('BCrypt隔离管理员hash失败');
    await mysqlInput(`CREATE USER '${env.INFOQ_DB_USERNAME}'@'%' IDENTIFIED BY '${env.INFOQ_DB_PASSWORD}'; GRANT ALL PRIVILEGES ON infoq.* TO '${env.INFOQ_DB_USERNAME}'@'%'; UPDATE sys_user SET user_name='${env.INFOQ_ADMIN_USERNAME}',password='${bcrypt}' WHERE user_id=1; UPDATE sys_oss_config SET access_key='${env.MINIO_ROOT_USER}',secret_key='${env.MINIO_ROOT_PASSWORD}',endpoint='http://minio:9000',domain='${env.INFOQ_OSS_PUBLIC_ORIGIN}',is_https='Y',access_policy='0' WHERE config_key IN ('minio','image');`);
    await s3Request(sourceConfig,'PUT','');
    await s3Request(sourceConfig,'PUT','production-acceptance.txt',{body:Buffer.from('isolated-object-integrity')});
    stage('full-up');
    await run(compose('up','-d','--wait','--wait-timeout','240'),{timeoutMs:300000});
    const running=await inspectTarget(sourceConfig,run);state.checks.ownershipAndPorts=running.summary;
    stage('artifacts-subpath');
    const artifacts=path.join(root,'artifacts');
    for(const client of ['react','vue']) {
      const container=running.containers.find(c=>c.Config.Labels['com.docker.compose.service']===`infoq-frontend-${client}`);
      const directory=path.join(artifacts,`${client}-sub-dist`);fs.mkdirSync(directory,{recursive:true});
      await run(['cp',`${container.Id}:/usr/share/nginx/html/.`,directory]);
      verifyFrontendArtifact(directory,env,{allowIsolated:true});
    }
    stage('checks');
    await executeOperation({command:'checks',execute:true},sourceConfig,{run:runProcess,signal:abort.signal});
    sourceConfig.capacity={...configuration.checks[1],concurrency:2,ratePerSecond:10,durationSeconds:3,maxRequests:20,timeoutMs:1000};
    state.checks.boundedMeasurement=(await executeOperation({command:'capacity',execute:true},sourceConfig,{run:runProcess,signal:abort.signal})).result;
    stage('tls-authorization');
    const ca=fs.readFileSync(fixture.certificate);
    const probe=await tlsRequest('https://app.infoq.test/prod-api/auth/wechat-miniapp/enabled',{ca});
    if(probe.status!==200 || JSON.parse(probe.body).data!==false)throw Error('精确匿名探测失败');
    for(const endpoint of ['/system/user/list','/auth/wechat-miniapp/enabled/extra','/system/oss/list']) {
      const denied=await tlsRequest('https://app.infoq.test/prod-api'+endpoint,{ca});
      assertAnonymousDenied(denied);
    }
    state.checks.tlsAndStrictAnonymous='passed';
    stage('storage');
    const object='https://oss.infoq.test/infoq/production-acceptance.txt';
    if((await tlsRequest(object,{ca})).status!==403)throw Error('私有对象匿名访问未拒绝');
    const signed=presignObject(env,'production-acceptance.txt',5);
    const signedResponse=await tlsRequest(signed,{ca});
    if(signedResponse.status!==200 || signedResponse.body.toString()!=='isolated-object-integrity')throw Error('真实代理签名Host/path失败');
    await new Promise(resolve=>setTimeout(resolve,6200));
    if((await tlsRequest(signed,{ca})).status!==403)throw Error('过期签名未拒绝');
    state.checks.privateS3='signed/anonymous/expired passed';
    for(const [service,processName,directory] of [['mysql','mysqld','/var/lib/mysql'],['redis','redis-server','/redis/data'],['minio','minio','/data'],['infoq-admin','java','/infoq/server/logs']]) {
      stage(`identities-${service}`);
      const container=running.containers.find(c=>c.Config.Labels['com.docker.compose.service']===service);
      const status=(await run(['exec',container.Id,'sh','-ec',`for p in /proc/[0-9]*; do test -r "$p/comm" || continue; read -r name < "$p/comm"; case "$name" in '${processName}'*) cat "$p/status"; exit 0;; esac; done; exit 1`])).toString();
      const uid=/^Uid:\s+\d+\s+(\d+)/m.exec(status)?.[1],gid=/^Gid:\s+\d+\s+(\d+)/m.exec(status)?.[1];
      if(!uid || !gid)throw Error(`未识别 ${service} 实际daemon UID/GID`);
      const identity=(await run(['exec','--user',`${uid}:${gid}`,container.Id,'sh','-ec',`id; test -w '${directory}'; touch '${directory}/.infoq-write-proof'; rm '${directory}/.infoq-write-proof'`])).toString().trim();
      state.checks[`uid-${service}`]={uid:Number(uid),gid:Number(gid),directory,identity};
    }
    async function login() {
      const auth=await loginWithRealCaptcha({backendUrl:'http://127.0.0.1:19090',username:env.INFOQ_ADMIN_USERNAME,password:env.INFOQ_ADMIN_PASSWORD,loginCandidates:'',rsaPublicKey:env.VITE_APP_RSA_PUBLIC_KEY,redisHost:'127.0.0.1',redisPort:16379,redisPassword:env.REDIS_PASSWORD,captchaFetchRetryDelayMs:1000,captchaFetchRetries:2,maxCaptchaAttempts:1,signal:abort.signal},path.join(root,'captcha',String(Date.now())));
      return auth.token;
    }
    stage('login');
    const token=await login();state.checks.realCaptchaLogin='passed';
    const authPath='/system/menu/getRouters';
    const auth=await fetch('http://127.0.0.1:19090'+authPath,{headers:{Authorization:`Bearer ${token}`,clientid:'e5cd7e4891bf95d1d19206ce24a7b32e'},signal:AbortSignal.timeout(10000)});
    if(auth.status!==200 || (await auth.json()).code!==200)throw Error('关键业务菜单失败');
    configuration.checks.push({name:'protected-menu',kind:'business',url:'http://127.0.0.1:19090'+authPath,status:200,timeoutMs:10000,json:{code:200},authorizationKey:'bearer',headers:{clientid:'e5cd7e4891bf95d1d19206ce24a7b32e'}});
    sourceConfig.checks=configuration.checks;sourceConfig.secrets.bearer=`Bearer ${token}`;
    stage('browser-subpath-initialize');
    const require=createRequire(path.join(repo,'skills/test-cli/scripts/package.json'));
    const {chromium}=require('playwright');
    browser=await chromium.launch({headless:true,handleSIGINT:false,handleSIGTERM:false,handleSIGHUP:false,args:['--host-resolver-rules=MAP app.infoq.test 127.0.0.1,MAP oss.infoq.test 127.0.0.1','--no-proxy-server']});
    abort.signal.addEventListener('abort',()=>{void browser?.close();},{once:true});
    async function profileDom(page,url,client,label) {
      const errors=[];
      page.on('pageerror',()=>errors.push('pageerror'));
      page.on('console',message=>{if(message.type()==='error')errors.push('console-error');});
      await verifyProfileNavigation(page,async()=>{
        await page.goto(url,{waitUntil:'domcontentloaded'});
        await page.getByText('个人信息',{exact:true}).first().waitFor({state:'visible',timeout:30000});
        await page.getByRole('tab',{name:'基本资料',exact:true}).waitFor({state:'visible'});
        if(await page.locator('input').count()===0)throw Error(`${client} ${label} profile业务表单缺失`);
      });
      await verifyProfileNavigation(page,async()=>{
        await page.reload({waitUntil:'domcontentloaded'});
        await page.getByRole('tab',{name:'基本资料',exact:true}).waitFor({state:'visible'});
      });
      if(!page.url().includes('user/profile') || errors.length)throw Error(`${client} ${label} DOM/console/profile API失败`);
      await page.screenshot({path:path.join(root,`${client}-${label}.png`)});
    }
    for(const [client,base] of [['react','/react/'],['vue','/vue/']]) {
      stage(`browser-subpath-${client}`);
      const browserContext=await browser.newContext({ignoreHTTPSErrors:true}),page=await browserContext.newPage();
      await page.goto(`https://app.infoq.test${base}user/profile`,{waitUntil:'domcontentloaded'});
      await page.waitForURL(url=>url.pathname===base+'login',{timeout:30000});
      await establishBrowserSession(browserContext, {origin:'https://app.infoq.test',client,clientId:'e5cd7e4891bf95d1d19206ce24a7b32e',token,apiPrefix:'/prod-api',page});
      await profileDom(page,`https://app.infoq.test${base}user/profile`,client,'subpath');await browserContext.close();
      state.checks[`${client}-subpath`]='real DOM protected route/profile/refresh passed';
    }
    await browser.close();browser=undefined;
    // Build and serve each client with / as well; real DOM acceptance on the same gateway.
    for(const client of ['react','vue']) {
      stage(`browser-root-build-${client}`);
      const service=`infoq-frontend-${client}`,original=structuredClone(definition.services[service]);
      definition.services[service].build.args.VITE_APP_CONTEXT_PATH='/';save(composeFile,definition);
      await run(compose('build',service),{timeoutMs:900000,maxBytes:32*1024*1024});await run(compose('up','-d','--no-deps',service),{timeoutMs:120000});
      const built=await inspectTarget(sourceConfig,run),rootContainer=built.containers.find(c=>c.Config.Labels['com.docker.compose.service']===service);
      const directory=path.join(artifacts,`${client}-root-dist`);fs.mkdirSync(directory,{recursive:true});await run(['cp',`${rootContainer.Id}:/usr/share/nginx/html/.`,directory]);
      verifyFrontendArtifact(directory,env,{allowIsolated:true});
      writeGateway(validateGatewayConfig({...env,INFOQ_FRONTEND_TARGET:client}));await activateGateway(compose(),run);
      // Node DNS host mapping for browser is explicit in the context used above;
      // this loop uses a fresh Chromium with the same DNS boundary.
      stage(`browser-root-${client}`);
      browser=await chromium.launch({headless:true,handleSIGINT:false,handleSIGTERM:false,handleSIGHUP:false,args:['--host-resolver-rules=MAP app.infoq.test 127.0.0.1','--no-proxy-server']});
      const ctx=await browser.newContext({ignoreHTTPSErrors:true});
      const page=await ctx.newPage();await page.goto('https://app.infoq.test/login',{waitUntil:'domcontentloaded'});
      await establishBrowserSession(ctx, {origin:'https://app.infoq.test',client,clientId:'e5cd7e4891bf95d1d19206ce24a7b32e',token,apiPrefix:'/prod-api',page});
      await profileDom(page,'https://app.infoq.test/user/profile',client,'root');await browser.close();browser=undefined;
      definition.services[service]=original;save(composeFile,definition);
      state.checks[`${client}-root`]='actual root build + DOM/refresh passed';
    }
    // Restore the tested subpath images before backup/restore.
    stage('restore-subpaths');
    await run(compose('build','infoq-frontend-react','infoq-frontend-vue'),{timeoutMs:1800000,maxBytes:32*1024*1024});
    await run(compose('up','-d','--no-deps','infoq-frontend-react','infoq-frontend-vue'),{timeoutMs:120000});
    writeGateway(validateGatewayConfig(env));await activateGateway(compose(),run);
    // Backup pauses application writes, verifies database and complete bucket objects.
    stage('backup');
    const backup=path.join(root,'backup');await executeOperation({command:'backup',execute:true,backup},sourceConfig,{run:runProcess,signal:abort.signal});
    stage('restore-prepare');
    const restoreRoot=path.join(root,'restore');fs.mkdirSync(restoreRoot,{mode:0o700});
    // A restore imports data rather than rerunning baseline initialization.
    const restoreDefinition=structuredClone(definition),restoreProject=project+'-restore',restoreRun=runId+'-restore';
    for(const [name,service] of Object.entries(restoreDefinition.services)) {
      service.container_name=`${restoreProject}-${name}`;service.labels['com.infoq.ops.run']=restoreRun;delete service.build;
      service.ports=(service.ports || []).map(port=>({...port,published:String(Number(port.published)+10000)}));
      service.volumes=service.volumes.filter(m=>m.target!=='/docker-entrypoint-initdb.d').map(m=>{
        if(m.type==='bind') {const relative=path.relative(root,m.source);const copied=path.join(restoreRoot,relative);if(!fs.existsSync(copied))fs.cpSync(m.source,copied,{recursive:true});return {...m,source:copied};}
        return m;
      });
    }
    for(const [name,entry] of Object.entries(restoreDefinition.volumes)) {entry.name=`${restoreProject}_${name}`;entry.labels={'com.infoq.ops.run':restoreRun};}
    for(const [name,entry] of Object.entries(restoreDefinition.networks || {})){entry.name=`${restoreProject}_${name}`;entry.labels={...entry.labels,'com.infoq.ops.run':restoreRun};}
    delete restoreDefinition.secrets;
    const restoreFile=save(path.join(restoreRoot,'compose.json'),restoreDefinition),restoreSecrets=save(path.join(restoreRoot,'secrets.json'),{...sourceConfig.secrets});
    const restoreEnv=save(path.join(restoreRoot,'empty.env'),'ISOLATED=1\n');
    const restoreSpecification={...configuration,root:restoreRoot,project:restoreProject,runId:restoreRun,composeFile:restoreFile,environmentFile:restoreEnv,secretsFile:restoreSecrets,services:{...configuration.services,redis:'redis'},authentication:{backendUrl:'http://127.0.0.1:29090',redisPort:26379},s3:{...configuration.s3,origin:'http://127.0.0.1:29000'},checks:configuration.checks.map(c=>({...c,url:c.url.replace(':19090',':29090')}))};
    restoreConfig=loadConfig(save(path.join(restoreRoot,'ops.json'),restoreSpecification));
    stage('restore');
    await executeOperation({command:'restore',execute:true,backup},restoreConfig,{run:runProcess,signal:abort.signal});state.checks.restore='data/objects/API + cleanup passed';
    // Pin a previously tested local image by immutable image ID; no registry publication.
    stage('rollback-prepare');
    const app=running.containers.find(c=>c.Config.Labels['com.docker.compose.service']==='infoq-admin');
    const imageInfo=JSON.parse((await run(['image','inspect',app.Image])).toString())[0];
    const digest=imageInfo.RepoDigests?.[0] || imageInfo.Id;
    const schema=await run(['exec',mysql.Id,'sh','-ec','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump --no-data --skip-comments --compact -uroot "$1"','ops','infoq']);
    sourceConfig.rollback={image:digest,configSha256:sha(fs.readFileSync(composeFile)),schemaSha256:sha(schema)};
    const faulty=save(path.join(root,'faulty-candidate.json'),{services:{'infoq-admin':{environment:{SERVER_PORT:'19999'}}}});
    stage('rollback-inject');
    await run([...compose().slice(0),'-f',faulty,'up','-d','--no-deps','--no-build','infoq-admin'],{timeoutMs:120000});
    stage('rollback');
    await executeOperation({command:'rollback',execute:true},sourceConfig,{run:runProcess,signal:abort.signal});await login();state.checks.rollback='fixed digest + readiness/business + real login passed';
    state.status='passed';
  }catch(error){primary=error;state.status=abort.signal.aborted?'interrupted':'failed';state.failedPhase=state.phase;state.error=error.message;}
  finally {
    const errors=[];
    state.cleanup={phase:'cleanup',status:'running',stageStartedAt:new Date().toISOString()};update();
    if(browser)try{await browser.close();}catch{errors.push('browser close failed');}
    for(const config of [restoreConfig,sourceConfig].filter(Boolean))try{await executeOperation({command:'cleanup',execute:true},config,{run:runProcess});}catch{errors.push(`owned cleanup failed: ${config.project}`);}
    state.cleanup={...state.cleanup,finishedAt:new Date().toISOString(),...(errors.length?{status:'failed',errors}:{status:'verified',browserClosed:true,ownedProjectsRemoved:true})};
    state.finishedAt=new Date().toISOString();if(errors.length){state.status='failed';state.failedPhase ||= 'cleanup';}update();
    for(const signal of ['SIGINT','SIGTERM','SIGHUP'])process.removeListener(signal,stop);
    console.log(JSON.stringify({status:state.status,evidence:path.relative(repo,stateFile),cleanup:state.cleanup}));
    if(errors.length)throw Error(`${primary?primary.message+'; ':''}${errors.join('; ')}`);
  }
  if(primary)throw primary;
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{console.error(`[linux-acceptance] ${error.message}`);process.exitCode=1;});
