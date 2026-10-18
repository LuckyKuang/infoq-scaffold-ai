#!/usr/bin/env node
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {parseLinuxArgs,isolateDefinition,presignObject,activateGateway,assertAnonymousDenied,verifyProfileNavigation} from './linux_acceptance.mjs';
assert.deepEqual(parseLinuxArgs(['--run-id','test-run']),{execute:false,runId:'test-run'});
assert.throws(()=>parseLinuxArgs(['--run-id','../prod']),/run-id/);
assert.throws(()=>parseLinuxArgs(['--run-id','valid-run','--execute','--execute']),/参数/);
const fixture={services:{mysql:{container_name:'mysql',image:'mysql:8.0.42',ports:[{target:3306,published:'3306',host_ip:'127.0.0.1'}],volumes:[{type:'bind',source:'/isolated/data/mysql',target:'/var/lib/mysql'}]},'nginx-web':{ports:[{target:443,published:'443',host_ip:'0.0.0.0'}],volumes:[]},application:{image:'shared/app:3.0.0',build:{context:'/workspace'}}},networks:{default:{}},secrets:{production_config:{file:'/old/config'}}};
const isolated=isolateDefinition(fixture,{project:'infoq-verify-test',runId:'run-test',root:'/isolated',environment:{INFOQ_DEPLOY_ROOT:'/isolated/data',INFOQ_PRODUCTION_CONFIG_FILE:'/isolated/production.env'},ports:{mysql:{3306:13306},'nginx-web':{443:443}}});
assert.equal(isolated.services.mysql.container_name,'infoq-verify-test-mysql');
assert.equal(isolated.services.mysql.ports[0].published,'13306');
assert.equal(isolated.services['nginx-web'].ports[0].host_ip,'127.0.0.1');
assert.equal(isolated.volumes['mysql-data'].name,'infoq-verify-test_mysql-data');
assert.equal(isolated.networks.default.name,'infoq-verify-test_default');
assert.equal(isolated.services.application.image,'infoq-verify/infoq-verify-test-application:candidate');
assert.equal(fixture.services.application.image,'shared/app:3.0.0');
assert.equal(fixture.services.mysql.container_name,'mysql');
fixture.services.mysql.ports[0].host_ip='0.0.0.0';
assert.throws(()=>isolateDefinition(fixture,{project:'infoq-verify-test',runId:'run-test',root:'/isolated',environment:{},ports:{}}),/默认/);
const signed=new URL(presignObject({INFOQ_OSS_BUCKET:'private',INFOQ_OSS_PUBLIC_ORIGIN:'https://oss.infoq.test',MINIO_ROOT_USER:'isolated',MINIO_ROOT_PASSWORD:'fixture-secret'},'folder/a b.txt'));
assert.equal(signed.host,'oss.infoq.test');assert.equal(signed.pathname,'/private/folder/a%20b.txt');assert.equal(signed.searchParams.get('X-Amz-Expires'),'1');assert.match(signed.searchParams.get('X-Amz-Signature'),/^[a-f0-9]{64}$/);
for(const response of [{status:401,body:'unauthorized'},{status:403,body:'forbidden'},{status:200,body:'{"code":401}'},{status:200,body:'{"code":403}'}])assertAnonymousDenied(response);
for(const response of [{status:500,body:'{"code":500}'},{status:404,body:'not found'},{status:200,body:'{"code":200}'},{status:200,body:'not JSON'}])assert.throws(()=>assertAnonymousDenied(response),/鉴权拒绝/);
const mutations=[];
await activateGateway(['compose','--project-name','infoq-verify-test','-f','owned.json'],async args=>{mutations.push(args);});
assert.deepEqual(mutations,[['compose','--project-name','infoq-verify-test','-f','owned.json','up','-d','--no-deps','--force-recreate','--wait','nginx-web']]);
await assert.rejects(activateGateway(['compose'],async()=>{throw Error('recreate failed');}),/recreate failed/);
const page=new EventEmitter();
let bodyStarted=false,releaseBody,navigationVerified=false;
const body=new Promise(resolve=>{releaseBody=resolve;});
const firstNavigation=verifyProfileNavigation(page,async()=>{
  page.emit('response',{url:()=> 'https://app.infoq.test/prod-api/system/user/profile',status:()=>200,json:()=>{bodyStarted=true;return body;}});
  assert.equal(bodyStarted,true,'response body reading must begin before navigation returns');
}).then(()=>{navigationVerified=true;});
await Promise.resolve();
assert.equal(navigationVerified,false,'navigation must wait for its own body before reload');
releaseBody({code:200});await firstNavigation;
assert.equal(page.listenerCount('response'),0);
await verifyProfileNavigation(page,async()=>{
  setImmediate(()=>page.emit('response',{url:()=> 'https://app.infoq.test/prod-api/system/user/profile',status:()=>200,json:async()=>({code:200})}));
});
assert.equal(page.listenerCount('response'),0);
await assert.rejects(verifyProfileNavigation(page,async()=>{},{timeoutMs:5}),/本次导航/,'a preceding successful request cannot satisfy reload');
for(const [status,bodyValue] of [[500,{code:200}],[200,{code:500}],[200,null]]) {
  await assert.rejects(verifyProfileNavigation(page,async()=>{
    page.emit('response',{url:()=> 'https://app.infoq.test/prod-api/system/user/profile',status:()=>status,json:async()=>bodyValue});
  }),/业务失败/);
}
await assert.rejects(verifyProfileNavigation(page,async()=>{
  page.emit('response',{url:()=> 'https://app.infoq.test/prod-api/system/user/profile',status:()=>200,json:async()=>{throw Error('expired-document-body');}});
}),/正文读取失败/);
await assert.rejects(verifyProfileNavigation(page,async()=>{
  page.emit('response',{url:()=> 'https://app.infoq.test/prod-api/system/user/profile/extra',status:()=>200,json:async()=>({code:200})});
},{timeoutMs:5}),/本次导航/);
await assert.rejects(verifyProfileNavigation(page,async()=>{throw Error('navigation failed');}),/navigation failed/);
assert.equal(page.listenerCount('response'),0);
console.log('[linux-acceptance-tests] argument/isolation/ports/presign/profile-navigation contracts passed; Docker not executed');
