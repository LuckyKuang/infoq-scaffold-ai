#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import {runPlaywrightFlow} from '../skills/test-cli/scripts/playwright_core.mjs';
import {createBrowserEvidence} from './lib/browser_evidence.mjs';
import {terminateProcessTree} from './lib/skill_runtime.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(repo, 'skills/test-cli/scripts/package.json'));
const {chromium} = require('playwright');
const directory = path.join(repo, 'tmp/test-cli/browser');
fs.mkdirSync(directory, {recursive:true,mode:0o700});
const root = fs.mkdtempSync(path.join(directory, 'browser-evidence-'));
const token = 'private-fixture/token+value=never-publish';
const encoded = encodeURIComponent(token);
const browserPids = [];
const originalLaunch = chromium.launch;
chromium.launch = async function(options) {
  const browser = await originalLaunch.call(this, options);
  const session = await browser.newBrowserCDPSession();
  const info = await session.send('SystemInfo.getProcessInfo');
  browserPids.push(info.processInfo.find(process => process.type === 'browser').id);
  await session.detach();
  return browser;
};
const server = http.createServer((request,response) => {
  if (request.url.endsWith('/csrf')) {
    response.setHeader('Content-Type','application/json');
    response.setHeader('Set-Cookie','CSRF=fixture; HttpOnly; SameSite=Strict; Path=/dev-api/auth/browser-session');
    response.end(JSON.stringify({code:200,data:{token:'fixture',headerName:'X-XSRF-TOKEN'}}));
  } else if (request.method === 'PUT') {
    response.setHeader('Content-Type','application/json');
    response.setHeader('Set-Cookie','SESSION=opaque-fixture; HttpOnly; SameSite=Strict; Path=/dev-api/auth/browser-session');
    response.end('{"code":200}');
  } else {
    response.setHeader('Content-Type','text/html');
    response.end(`<!doctype html><title>Private evidence fixture</title><script>
      new WebSocket('ws://' + location.host + '/resource/websocket?Authorization=Bearer ' + ${JSON.stringify(encoded)});
      setTimeout(() => {throw new Error('fixture page failure ' + ${JSON.stringify(token)} + ' ' + ${JSON.stringify(encoded)});}, 0);
    </script>`);
  }
});
server.on('upgrade', (_request,socket) => socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n'));
server.listen(0,'127.0.0.1');
await once(server,'listening');
const port = server.address().port;
const origin = `http://127.0.0.1:${port}`;
const clean = value => {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  assert.ok(!serialized.includes(token) && !serialized.includes(encoded), 'private raw/encoded credential must not enter evidence');
};
try {
  await test('redaction preserves nested evidence and exception semantics across the credential lifetime', () => {
    const evidence=createBrowserEvidence([token]);
    const online='private online/token+value=';
    evidence.add(online);
    const lowerEncoded=encoded.replace(/%[\dA-F]{2}/gu,value=>value.toLowerCase());
    const value={type:'error',count:2,location:{url:`https://fixture.invalid/?token=${lowerEncoded}`},rows:[token,encodeURIComponent(online)],enabled:false};
    const safe=evidence.sanitize(value);
    clean(safe);assert.ok(!JSON.stringify(safe).includes(lowerEncoded));assert.equal(safe.type,'error');assert.equal(safe.count,2);assert.equal(safe.enabled,false);
    assert.equal(safe.rows.length,2);assert.ok(!JSON.stringify(safe).includes(encodeURIComponent(online)));
    const original=new AggregateError([Object.assign(new Error(`failed ${encoded}`),{code:'ECONNRESET',cause:new Error(online)})],`cleanup ${token}`);
    const error=evidence.error(original);
    clean(error.message);clean(error.stack);assert.ok(error instanceof AggregateError);assert.equal(error.errors[0].code,'ECONNRESET');
    assert.equal(error.errors[0].cause.message,'[redacted-token]');
    assert.ok(!evidence.text(new URLSearchParams({token:online}).toString()).includes('private+online'));
  });
  await test('real Chromium WS401 and page errors keep their category/count but hide known credentials', async () => {
    const result = await runPlaywrightFlow({targetUrl:origin, browserSession:{client:'react',clientId:'fixture',token},failOnConsoleErrors:false,consoleLogPath:path.join(root,'allowed-console.json')});
    assert.ok(result.consoleEntries.some(entry=>entry.type==='error'), 'the actual WebSocket rejection must remain observable');
    assert.ok(result.consoleEntries.some(entry=>entry.type==='pageerror'), 'the actual script failure must remain observable');
    clean(result);
    clean(fs.readFileSync(result.consoleLogPath,'utf8'));
    const state=JSON.parse(fs.readFileSync(result.stateFile,'utf8'));
    clean(state);
    assert.equal(state.browserClosed,true);
  });
  await test('console failures still reject and locator exceptions/state hide the authenticated token', async () => {
    for (const options of [{},{waitForText:token,timeoutMs:300}]) {
      const consoleLogPath=path.join(root,options.waitForText?'locator.json':'rejected-console.json');
      await assert.rejects(runPlaywrightFlow({targetUrl:origin,browserSession:{client:'react',clientId:'fixture',token},consoleLogPath,...options}),error=>{
        clean(error.message);clean(error.stack);return /Console check failed|Timeout/u.test(error.message);
      });
      clean(fs.readFileSync(consoleLogPath,'utf8'));
      const states=fs.readdirSync(path.join(repo,'tmp/test-cli/browser/states')).filter(name=>name.endsWith('.json')&&!name.endsWith('.console.json')).map(name=>JSON.parse(fs.readFileSync(path.join(repo,'tmp/test-cli/browser/states',name),'utf8')));
      const state=states.find(item=>item.log===consoleLogPath);
      assert.equal(state.status,'failed');assert.equal(state.browserClosed,true);clean(state);
    }
  });
  await test('an authenticated CLI caller receives only a redacted failing exception on stderr', async () => {
    const child=spawn(process.execPath,['--input-type=module','-e',`
      import {runPlaywrightFlow} from './skills/test-cli/scripts/playwright_core.mjs';
      runPlaywrightFlow({targetUrl:process.env.FIXTURE_ORIGIN,browserSession:{token:process.env.FIXTURE_TOKEN,client:'react',clientId:'fixture'},waitForText:process.env.FIXTURE_TOKEN,timeoutMs:300,consoleLogPath:process.env.FIXTURE_LOG}).catch(error=>{console.error(error);process.exitCode=1;});
    `],{cwd:repo,env:{...process.env,FIXTURE_ORIGIN:origin,FIXTURE_TOKEN:token,FIXTURE_LOG:path.join(root,'terminal.json')},stdio:['ignore','pipe','pipe']});
    let output='';child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{output+=chunk;});
    let timedOut=false,termination;
    const stop=()=>termination ||= terminateProcessTree(child.pid,{graceMs:100});
    const timer=setTimeout(()=>{timedOut=true;void stop().catch(()=>{});},15000);
    try {
      const [code,signal]=await once(child,'close');assert.equal(timedOut,false);assert.equal(signal,null);assert.equal(code,1);clean(output);assert.match(output,/Timeout|Console check failed/u);
    } finally {clearTimeout(timer);if(child.exitCode===null && child.signalCode===null)stop();await termination;}
  });
} finally {
  chromium.launch=originalLaunch;
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  const rebound=net.createServer();await new Promise((resolve,reject)=>{rebound.once('error',reject);rebound.listen(port,'127.0.0.1',resolve);});await new Promise(resolve=>rebound.close(resolve));
  for (const pid of browserPids) assert.throws(()=>process.kill(pid,0),{code:'ESRCH'});
  fs.writeFileSync(path.join(root,'cleanup.json'),JSON.stringify({browserProcessesExited:true,browserPids,fixturePortRebound:true,port},null,2)+'\n',{mode:0o600});
  console.log(`[browser-evidence] real Chromium cleanup verified; evidence=${path.relative(repo,root)}`);
}
