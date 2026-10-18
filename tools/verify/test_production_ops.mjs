#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {parseArgs,loadConfig,controlledPath,inspectTarget,executeOperation,verifyBackup,measureCapacity,checkHttp,listObjects} from './production_ops.mjs';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const parent=path.join(repo,'tmp/production-readiness');fs.mkdirSync(parent,{recursive:true});
const root=fs.mkdtempSync(path.join(parent,'ops-tests-'));
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
let passed=0;
const test=async(name,fn)=>{await fn();passed++;console.log(`[PASS] ${name}`);};
const save=(file,value)=>{fs.writeFileSync(file,typeof value==='string'?value:JSON.stringify(value),{mode:0o600});return file;};

function fixture(suffix='source') {
  const base=path.join(root,suffix);fs.mkdirSync(base,{recursive:true});
  const project=`infoq-verify-${suffix}`,runId=`run-${suffix}`;
  const check={name:'ready-check',kind:'readiness',url:'http://127.0.0.1:19990/ready',status:200,timeoutMs:100,json:{status:'UP'}};
  const config={version:1,project,runId,root:base,composeFile:save(path.join(base,'compose.json'),'{}'),environmentFile:save(path.join(base,'deploy.env'),'ISOLATED=1\n'),secretsFile:save(path.join(base,'secrets.json'),{accessKey:'fixture-access',secretKey:'fixture-secret',databaseUser:'app_test',databasePassword:'abcdefgh1234567890abcdefgh',bearer:'Bearer PRIVATE-TOKEN'}),services:{mysql:'mysql',minio:'minio',application:'application'},database:'infoq',sqlChecks:[{name:'user-relations',sql:'SELECT count(*) FROM sys_user'}],checks:[check,{...check,name:'login-check',kind:'business',url:'http://127.0.0.1:19990/business',authorizationKey:'bearer',json:{code:200}}],s3:{origin:'http://127.0.0.1:19900',bucket:'infoq',maxObjects:10,maxBytes:1024*1024}};
  const file=save(path.join(base,'ops.json'),config);
  return {config:loadConfig(file),file,base};
}

function dockerFixture(config,{fresh=false,sql='1\n',cleanupFails=false,imageMissing=false}={}) {
  const calls=[];let alive=!fresh,running=true,image='sha256:'+'a'.repeat(64);
  const definition={services:Object.fromEntries(Object.values(config.services).map((name,index)=>[name,{image:'fixture:'+name,labels:{'com.infoq.ops.run':config.runId},ports:index===1?[{host_ip:'127.0.0.1',published:'19900',target:9000}]:index===2?[{host_ip:'127.0.0.1',published:'19990',target:8080}]:[]}]))};
  const containers=()=>Object.values(config.services).map((name,index)=>({Id:`id-${name}`,Image:image,Config:{Labels:{'com.infoq.ops.run':config.runId,'com.docker.compose.project':config.project,'com.docker.compose.service':name}},State:{Running:name==='application'?running:true},NetworkSettings:{Ports:{}},Mounts:[]}));
  const run=async(args,options={})=>{
    calls.push({args,input:options.input});
    let output='';
    if(args[0]==='context') output=JSON.stringify([{Endpoints:{docker:{Host:'unix:///fixture/docker.sock'}}}]);
    else if(args[0]==='info') output='linux';
    else if(args[0]==='version') output='27.0.0';
    else if(args[0]==='ps') output=alive?Object.values(config.services).map(name=>`id-${name}`).join('\n'):'';
    else if(args[0]==='inspect') output=JSON.stringify(containers().filter(c=>args.includes(c.Id)));
    else if(args[0]==='stop') running=false;
    else if(args[0]==='start') running=true;
    else if(args[0]==='image') {if(imageMissing) throw Error('Docker 操作失败 exit=1');output=JSON.stringify([{Id:'sha256:'+'b'.repeat(64)}]);}
    else if(args[0]==='exec') output=args.includes('--version')?'mysqldump Ver 8.0.42':args.some(a=>a.includes('mysqldump --no-data'))?'SCHEMA':args.some(a=>a.includes('mysqldump'))?'CREATE TABLE test(id INT);\n':sql;
    else if(args[0]==='compose') {
      if(args.includes('config')) output=JSON.stringify(definition);
      else if(args.includes('up')) {alive=true;if(args.includes('--no-deps')) image='sha256:'+'b'.repeat(64);}
      else if(args.includes('down')) {if(cleanupFails)throw Error('cleanup-failure');alive=false;}
      else throw Error('unexpected compose command');
    } else if(!['volume','network'].includes(args[0])) throw Error('unexpected Docker command '+args[0]);
    return Buffer.from(output);
  };
  return {run,calls,definition,containers};
}

function s3Fixture() {
  const objects=new Map([['proof.txt',Buffer.from('backed-up-object')],['empty.txt',Buffer.alloc(0)]]);
  let businessFails=false,received=false;
  const fetchImpl=async(url,options={})=>{
    url=new URL(url);
    if(url.port==='19900') {
      const key=decodeURIComponent(url.pathname.slice('/infoq/'.length));
      if(url.search) return new Response(`<ListBucketResult><IsTruncated>false</IsTruncated>${[...objects].map(([k,v])=>`<Contents><Key>${encodeURIComponent(k)}</Key><Size>${v.length}</Size></Contents>`).join('')}</ListBucketResult>`);
      if(options.method==='PUT') {if(url.pathname!=='/infoq') objects.set(key,Buffer.from(options.body));return new Response('');}
      return new Response(objects.get(key)??'',{status:objects.has(key)?200:404});
    }
    if(url.pathname==='/received') return Response.json({runId:'run-alert',ruleId:'rule-test',receiver:received?'ops-test':'wrong'});
    if(url.pathname==='/business') return Response.json({code:businessFails?500:200});
    return Response.json({status:'UP'});
  };
  return {objects,fetchImpl,setBusinessFailure:value=>{businessFails=value;},setReceived:value=>{received=value;}};
}

const quiet=()=>{};
try {
  // Main flow first: actual orchestration, explicit fixture Docker/S3 boundary.
  const source=fixture(),docker=dockerFixture(source.config),s3=s3Fixture(),backup=path.join(root,'backup');
  await test('main flow: backup -> integrity -> independent restore -> consistency/API -> owned cleanup',async()=>{
    const state=await executeOperation({command:'backup',execute:true,backup},source.config,{run:docker.run,fetchImpl:s3.fetchImpl,emit:quiet});
    assert.equal(state.status,'passed');assert.equal(state.cleanup.restoredApplication,true);
    const manifest=verifyBackup(backup);assert.equal(manifest.files.length,3);
    const target=fixture('restored'),targetDocker=dockerFixture(target.config,{fresh:true});s3.objects.clear();
    const restored=await executeOperation({command:'restore',execute:true,backup},target.config,{run:targetDocker.run,fetchImpl:s3.fetchImpl,emit:quiet});
    assert.equal(restored.status,'passed');assert.equal(restored.cleanup.removedRestoreProject,true);
    assert.equal(restored.result.objects,2);assert.match(restored.result.rtoAcceptance,/blocked/);
    assert(targetDocker.calls.some(c=>c.args.includes('down')));
    assert.equal(s3.objects.get('proof.txt').toString(),'backed-up-object');
  });
  await test('preview makes no filesystem/HTTP/mutation changes',async()=>{
    const before=fs.readdirSync(source.base).sort();let requests=0;
    const fake=dockerFixture(source.config);
    await executeOperation({command:'backup',execute:false,backup:path.join(root,'preview-backup')},source.config,{run:fake.run,fetchImpl:()=>{requests++;throw Error();},emit:quiet});
    assert.deepEqual(fs.readdirSync(source.base).sort(),before);assert.equal(requests,0);
    assert(!fake.calls.some(c=>['stop','start','exec'].includes(c.args[0]) || c.args.includes('up') || c.args.includes('down')));
    assert(!fs.existsSync(path.join(root,'preview-backup')));
  });
  await test('target ownership / public ports / shared resource rejected',async()=>{
    const fake=dockerFixture(source.config);fake.definition.services.mysql.labels['com.infoq.ops.run']='other-run';
    await assert.rejects(inspectTarget(source.config,fake.run),/ownership/);
    fake.definition.services.mysql.labels['com.infoq.ops.run']=source.config.runId;
    fake.definition.services.minio.ports[0].host_ip='0.0.0.0';
    await assert.rejects(inspectTarget(source.config,fake.run),/loopback/);
    fake.definition.services.minio.ports[0].host_ip='127.0.0.1';fake.definition.volumes={data:{external:true}};
    await assert.rejects(inspectTarget(source.config,fake.run),/共享/);
  });
  await test('missing capacity target/bounds and duplicate arguments fail before mutation',async()=>{
    assert.throws(()=>parseArgs(['backup','--config','a','--config','b','--backup','c']),/参数/);
    assert.throws(()=>parseArgs(['restore','--config','a']),/backup/);
    await assert.rejects(executeOperation({command:'capacity',execute:false},source.config,{run:docker.run,emit:quiet}),/concurrency/);
  });
  await test('shared mounts with unrelated containers are rejected before stop or writes',async()=>{
    const current=fixture('shared-mount'),fake=dockerFixture(current.config),data=path.join(current.base,'data');fs.mkdirSync(data);
    fake.definition.services.mysql.volumes=[{type:'bind',source:data,target:'/data'}];
    const run=async(args,options)=>{
      if(args[0]==='ps' && !args.includes('--filter'))return Buffer.from('other-container');
      if(args[0]==='inspect' && args.includes('other-container'))return Buffer.from(JSON.stringify([{Id:'other-container',Mounts:[{Type:'bind',Source:data,Destination:'/shared'}]}]));
      return fake.run(args,options);
    };
    await assert.rejects(executeOperation({command:'backup',execute:true,backup:path.join(root,'shared-backup')},current.config,{run,emit:quiet}),/其它容器共享/);
    assert(!fake.calls.some(call=>call.args[0]==='stop'));assert(!fs.existsSync(path.join(current.base,'evidence')));
  });
  await test('backup checksum corruption and symbolic link rejected',async()=>{
    const file=path.join(backup,'database.sql'),bytes=fs.readFileSync(file);fs.appendFileSync(file,'corrupt');
    assert.throws(()=>verifyBackup(backup),/损坏/);fs.writeFileSync(file,bytes);
    const link=path.join(source.base,'link.json');
    try{fs.symlinkSync(source.file,link);assert.throws(()=>controlledPath(link),/符号链接/);}catch(error){if(error.code!=='EPERM')throw error;}
  });
  await test('restore rejects existing project/source target; SQL mismatch cleanup executes',async()=>{
    await assert.rejects(executeOperation({command:'restore',execute:true,backup},source.config,{run:docker.run,fetchImpl:s3.fetchImpl,emit:quiet}),/已存在/);
    const target=fixture('mismatch'),fake=dockerFixture(target.config,{fresh:true,sql:'999\n'});
    await assert.rejects(executeOperation({command:'restore',execute:true,backup},target.config,{run:fake.run,fetchImpl:s3.fetchImpl,emit:quiet}),/摘要不一致/);
    assert(fake.calls.some(c=>c.args.includes('down')));
    const evidence=JSON.parse(fs.readFileSync(path.join(target.base,'evidence',fs.readdirSync(path.join(target.base,'evidence'))[0])));
    assert.equal(evidence.status,'failed');assert.equal(evidence.cleanup.status,'verified');
  });
  await test('restore interruption and cleanup failure remain failed',async()=>{
    const target=fixture('interrupted'),fake=dockerFixture(target.config,{fresh:true,cleanupFails:true}),abort=new AbortController();
    const run=async(args,options)=>{if(args[0]==='exec'){abort.abort();throw Error('interrupted');}return fake.run(args,options);};
    await assert.rejects(executeOperation({command:'restore',execute:true,backup},target.config,{run,signal:abort.signal,fetchImpl:s3.fetchImpl,emit:quiet}),/清理未核验/);
    const file=path.join(target.base,'evidence',fs.readdirSync(path.join(target.base,'evidence'))[0]);
    assert.equal(JSON.parse(fs.readFileSync(file)).status,'failed');
  });
  await test('rollback requires existing pinned old image, exact config/schema and failed readiness/business',async()=>{
    const current=fixture('rollback'),fake=dockerFixture(current.config);
    current.config.rollback={image:'local/app@sha256:'+'c'.repeat(64),configSha256:sha(fs.readFileSync(current.config.composeFile)),schemaSha256:sha('SCHEMA')};
    await assert.rejects(executeOperation({command:'rollback',execute:true},current.config,{run:dockerFixture(current.config,{imageMissing:true}).run,fetchImpl:s3.fetchImpl,emit:quiet}),/Docker/);
    current.config.rollback.schemaSha256='bad';
    await assert.rejects(executeOperation({command:'rollback',execute:true},current.config,{run:fake.run,fetchImpl:s3.fetchImpl,emit:quiet}),/兼容性/);
    current.config.rollback.schemaSha256=sha('SCHEMA');
    await assert.rejects(executeOperation({command:'rollback',execute:true},current.config,{run:fake.run,fetchImpl:s3.fetchImpl,emit:quiet}),/未触发/);
    s3.setBusinessFailure(true);let afterRollback=false;
    const run=async(args,options)=>{if(args.includes('--no-deps')){afterRollback=true;s3.setBusinessFailure(false);}return fake.run(args,options);};
    const result=await executeOperation({command:'rollback',execute:true},current.config,{run,fetchImpl:s3.fetchImpl,emit:quiet});
    assert(afterRollback);assert.equal(result.status,'passed');assert.match(result.result.data,/no reverse SQL/);
  });
  await test('HTTP readiness/business errors hide upstream body and token',async()=>{
    await assert.rejects(checkHttp(source.config.checks[1],source.config.secrets,{fetchImpl:async()=>new Response('PRIVATE-TOKEN secret-payload',{status:500})}),error=>!error.message.includes('PRIVATE-TOKEN')&&!error.message.includes('secret-payload'));
  });
  await test('alert rejects absent receiver and uncorrelated receipt',async()=>{
    const current=fixture('alert'),fake=dockerFixture(current.config);
    await assert.rejects(executeOperation({command:'alert',execute:false},current.config,{run:fake.run,emit:quiet}),/blocked/);
    const check={url:'http://127.0.0.1:19990/received',status:200,timeoutMs:100,json:{runId:'run-alert',ruleId:'rule-test',receiver:'ops-test'}};
    current.config.alert={ruleId:'rule-test',receiver:'ops-test',signal:check,trigger:check,received:check,recovered:check};
    await assert.rejects(executeOperation({command:'alert',execute:true},current.config,{run:fake.run,fetchImpl:s3.fetchImpl,emit:quiet}),/HTTP check/);
  });
  await test('capacity measures actual loopback HTTP with strict request/concurrency bounds and cleanup',async()=>{
    let active=0,peak=0,count=0;
    const server=http.createServer((req,res)=>{count++;active++;peak=Math.max(active,peak);setTimeout(()=>{res.setHeader('content-type','application/json');res.end('{"status":"UP"}');active--;},20);});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    try {
      const result=await measureCapacity({url:`http://127.0.0.1:${server.address().port}/`,status:200,json:{status:'UP'},concurrency:2,ratePerSecond:100,durationSeconds:1,maxRequests:5,timeoutMs:200});
      assert.equal(result.issued,5);assert.equal(count,5);assert(peak<=2);assert.equal(result.cleanup.activeRequests,0);assert.match(result.acceptance,/blocked/);
    }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  });
  await test('capacity abort drains requests and does not declare success',async()=>{
    const abort=new AbortController();setTimeout(()=>abort.abort(),30);
    await assert.rejects(measureCapacity({url:'http://127.0.0.1:19990',status:200,json:{status:'UP'},concurrency:1,ratePerSecond:100,durationSeconds:1,maxRequests:100,timeoutMs:100},{},{signal:abort.signal,fetchImpl:async()=>{await new Promise(r=>setTimeout(r,20));return Response.json({status:'UP'});}}),/中断/);
  });
  await test('capacity SLO violation persists failed state and exits with failure',async()=>{
    const current=fixture('slo-failed'),fake=dockerFixture(current.config);
    current.config.capacity={url:'http://127.0.0.1:19990/ready',status:200,json:{status:'UP'},concurrency:1,ratePerSecond:100,durationSeconds:1,maxRequests:1,timeoutMs:100,slo:{p95Ms:0.00001,maxErrorRate:0}};
    await assert.rejects(executeOperation({command:'capacity',execute:true},current.config,{run:fake.run,fetchImpl:s3.fetchImpl,emit:quiet}),/SLO 未通过/);
    const state=JSON.parse(fs.readFileSync(path.join(current.base,'evidence',fs.readdirSync(path.join(current.base,'evidence'))[0])));
    assert.equal(state.status,'failed');assert.equal(state.result.acceptance,'failed');assert.equal(state.result.cleanup.activeRequests,0);
  });
  await test('alert four distinct correlated phases include actual receipt; injection restarts owned service',async()=>{
    const current=fixture('alert-positive'),fake=dockerFixture(current.config);
    const check={url:'http://127.0.0.1:19990/alert',status:200,timeoutMs:100,json:{runId:current.config.runId,ruleId:'rule-test'}};
    current.config.alert={ruleId:'rule-test',receiver:'ops-test',injectService:'application',signal:check,trigger:check,received:{...check,json:{...check.json,receiver:'ops-test'}},recovered:check};
    const result=await executeOperation({command:'alert',execute:true},current.config,{run:fake.run,fetchImpl:async url=>new URL(url).pathname==='/alert'?Response.json({runId:current.config.runId,ruleId:'rule-test',receiver:'ops-test'}):s3.fetchImpl(url),emit:quiet});
    assert.deepEqual(Object.keys(result.result),['signal','trigger','received','recovered']);assert.equal(result.status,'passed');
    assert(fake.calls.some(c=>c.args[0]==='stop'));assert(fake.calls.some(c=>c.args[0]==='start'));
  });
  await test('invalid alert trigger is rejected before state writes or service stop',async()=>{
    const current=fixture('alert-invalid'),fake=dockerFixture(current.config);
    const check={url:'http://127.0.0.1:19990/alert',status:200,timeoutMs:100,json:{runId:current.config.runId,ruleId:'rule-test'}};
    current.config.alert={ruleId:'rule-test',receiver:'ops-test',injectService:'application',signal:check,received:{...check,json:{...check.json,receiver:'ops-test'}},recovered:check};
    await assert.rejects(executeOperation({command:'alert',execute:true},current.config,{run:fake.run,fetchImpl:s3.fetchImpl,emit:quiet}),/trigger/);
    assert(!fake.calls.some(c=>c.args[0]==='stop'));assert(!fs.existsSync(path.join(current.base,'evidence')));
  });
  await test('S3 list errors cannot masquerade as empty backup',async()=>{
    await assert.rejects(listObjects(source.config,{fetchImpl:async()=>new Response('<Error>forbidden</Error>')}),/协议/);
  });
  await test('S3 pagination decodes XML entities once and preserves opaque continuation tokens',async()=>{
    const tokens = ['&amp;lt;', '&lt;&gt;&quot;&apos;&amp;', '&#65;&#x1F600;&#9;', 'literal%2F+value'];
    const expected = ['&lt;', '<>"\'&', 'A😀\t', 'literal%2F+value'];
    const requests = [];
    const objects = await listObjects(source.config,{fetchImpl:async url=>{
      requests.push(new URL(url).searchParams.get('continuation-token'));
      const index = requests.length - 1;
      return new Response(`<ListBucketResult><IsTruncated>${index < tokens.length}</IsTruncated>${index < tokens.length ? `<NextContinuationToken>${tokens[index]}</NextContinuationToken>` : '<Contents><Key>proof%26name.txt</Key><Size>3</Size></Contents>'}</ListBucketResult>`);
    }});
    assert.deepEqual(requests,[null,...expected]);
    assert.deepEqual(objects,[{key:'proof&name.txt',size:3}]);
  });
  await test('S3 pagination rejects missing, cyclic and invalid XML tokens',async()=>{
    for (const value of ['', '&unknown;', '&amp', '&#0;', '&#xD800;', '&#x110000;', '&#-1;', '&#xZZ;', '<invalid>', '\u0000', '\ud800']) {
      await assert.rejects(listObjects(source.config,{fetchImpl:async()=>new Response(`<ListBucketResult><IsTruncated>true</IsTruncated><NextContinuationToken>${value}</NextContinuationToken></ListBucketResult>`)}),/分页/);
    }
    for (const tokens of [['same','same'],['first','second','first'],['&amp;lt;','&#38;lt;']]) {
      let index=0;
      await assert.rejects(listObjects(source.config,{fetchImpl:async()=>new Response(`<ListBucketResult><IsTruncated>true</IsTruncated><NextContinuationToken>${tokens[index++]}</NextContinuationToken></ListBucketResult>`)}),/分页/);
      assert.equal(index,tokens.length);
    }
  });
  save(path.join(root,'result.json'),{status:'passed',tests:passed,scope:'fixture Docker/S3; real loopback HTTP; no Linux daemon',platform:process.platform,node:process.version,cleanup:'HTTP server closed; fixture files retained under tmp'});
  console.log(`[production-ops-tests] ${passed} passed; evidence=${path.relative(repo,root)}`);
} catch(error) {console.error(error);process.exitCode=1;}
