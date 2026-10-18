#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {test} from 'node:test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const parent = path.join(repoRoot, 'tmp/test-cli');
fs.mkdirSync(parent, {recursive: true});
const fixture = fs.mkdtempSync(path.join(parent, 'browser-runtime-'));
const scripts = path.join(fixture, 'skills/test-cli/scripts');
fs.mkdirSync(scripts, {recursive: true});
fs.writeFileSync(path.join(fixture, 'AGENTS.md'), '# Fixture\n', 'utf8');
for (const file of ['skills/test-cli/scripts/playwright_core.mjs', 'skills/test-cli/scripts/chrome_devtools_cli.mjs', 'skills/test-cli/scripts/run_admin_crud_e2e.mjs', 'skills/test-cli/scripts/captcha_login.mjs', 'skills/test-cli/scripts/redis_captcha_seed.mjs', 'skills/test-cli/scripts/test_run_lifecycle.mjs', 'tools/lib/skill_runtime.mjs', 'tools/lib/admin_dev_stack.mjs', 'tools/lib/backend_login.mjs', 'tools/lib/browser_session.mjs', 'tools/lib/browser_evidence.mjs', 'tools/resolve_backend_local_mcp_env.mjs']) {
  fs.mkdirSync(path.dirname(path.join(fixture, file)), {recursive: true});
  fs.copyFileSync(path.join(repoRoot, file), path.join(fixture, file));
}
const packageDir = path.join(scripts, 'node_modules/playwright');
fs.mkdirSync(packageDir, {recursive: true});
fs.writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify({type: 'module', exports: {import: './index.mjs', require: './index.cjs'}}), 'utf8');
fs.writeFileSync(path.join(packageDir, 'index.mjs'), `
export const chromium = {launch: async (options) => {
  const fixture = globalThis.browserFixture;
  fixture.launchOptions = options;
  if (fixture.launchError) throw new Error('fixture launch failed');
  const page = {
    on: (event, callback) => {
      if (event === 'console' && fixture.consoleError) callback({type:()=> 'error', text:()=> 'fixture console failure', location:()=> ({})});
      if (event === 'console') for (const entry of fixture.consoleEntries || []) callback({type:()=>entry.type,text:()=>entry.text,location:()=>entry.location || {}});
      if (event === 'pageerror') for (const text of fixture.pageErrors || []) callback(new Error(text));
    },
    goto: async () => {
      if (fixture.gotoError) throw new Error(fixture.gotoError);
      if (fixture.wait) return new Promise((resolve, reject) => {fixture.reject = reject; fixture.ready();});
      return {ok:()=> fixture.httpStatus < 400, status:()=> fixture.httpStatus};
    },
    waitForURL: async () => {},
    getByText: () => ({waitFor: async () => {}}),
    waitForLoadState: async () => {},
    screenshot: async () => {}
  };
  return {newContext: async () => ({
    addInitScript: async () => {}, newPage:async () => page,
    request: {
      get: async () => ({status:()=>200,json:async()=>({code:200,data:{token:'csrf-fixture',headerName:'X-XSRF-TOKEN'}})}),
      put: async () => ({status:()=>200,json:async()=>({code:200})})
    }
  }), close:async () => {
    fixture.closeCount++; fixture.reject?.(new Error('fixture browser closed')); fixture.onClose?.(); if (fixture.closeError) throw new Error(fixture.closeError === true ? 'fixture close failed' : fixture.closeError);
  }};
}};
`, 'utf8');
fs.writeFileSync(path.join(packageDir, 'index.cjs'), fs.readFileSync(path.join(packageDir, 'index.mjs'), 'utf8').replace('export const chromium =', 'exports.chromium ='), 'utf8');
const {runPlaywrightFlow} = await import(pathToFileURL(path.join(scripts, 'playwright_core.mjs')));
const {runBrowser} = await import(pathToFileURL(path.join(scripts, 'run_admin_crud_e2e.mjs')));
const {runAdminDevStack, stopAdminDevStackState} = await import(pathToFileURL(path.join(fixture, 'tools/lib/admin_dev_stack.mjs')));
function latestState() {
  const dir = path.join(fixture, 'tmp/test-cli/browser/states');
  return fs.readdirSync(dir).filter((name) => !name.includes('.console.')).map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'))).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)).at(-1);
}
try {
  await test('browser successful flow records lifecycle and closes owned browser', async () => {
    globalThis.browserFixture = {httpStatus: 200, closeCount: 0};
    const result = await runPlaywrightFlow({targetUrl: 'http://fixture.invalid/'});
    const state = JSON.parse(fs.readFileSync(result.stateFile, 'utf8'));
    assert.equal(state.status, 'passed');
    assert.equal(state.browserClosed, true);
    assert.equal(state.pid, process.pid);
    assert.equal(state.port, null);
    assert.ok(fs.existsSync(state.log));
    assert.equal(globalThis.browserFixture.closeCount, 1);
    assert.equal(globalThis.browserFixture.launchOptions.handleSIGTERM, false);
  });
  await test('HTTP failure and console failure preserve failed state and logs', async () => {
    for (const scenario of [{httpStatus: 503}, {httpStatus: 200, consoleError: true}]) {
      globalThis.browserFixture = {...scenario, closeCount: 0};
      await assert.rejects(runPlaywrightFlow({targetUrl: 'http://fixture.invalid/'}), /HTTP 503|Console check failed/);
      assert.equal(latestState().status, 'failed');
      assert.equal(latestState().browserClosed, true);
      assert.equal(globalThis.browserFixture.closeCount, 1);
    }
  });
  await test('launch failure is observable and close failure cannot mask primary navigation failure', async () => {
    globalThis.browserFixture = {launchError: true, closeCount: 0};
    await assert.rejects(runPlaywrightFlow({targetUrl: 'http://fixture.invalid/'}), /launch failed/);
    assert.equal(latestState().status, 'failed');
    globalThis.browserFixture = {httpStatus: 500, closeCount: 0, closeError: true};
    await assert.rejects(runPlaywrightFlow({targetUrl: 'http://fixture.invalid/'}), /HTTP 500.*Browser cleanup failed/);
    assert.equal(latestState().browserClosed, false);
  });
  await test('cancellation closes an in-flight browser and records interrupted state', async () => {
    const controller = new AbortController();
    let ready;
    const started = new Promise((resolve) => {ready = resolve;});
    globalThis.browserFixture = {httpStatus: 200, closeCount: 0, wait: true, ready};
    const flow = runPlaywrightFlow({targetUrl: 'http://fixture.invalid/', signal: controller.signal});
    await started;
    controller.abort(new Error('fixture interrupt'));
    await assert.rejects(flow, /browser closed/);
    assert.equal(latestState().status, 'interrupted');
    assert.equal(latestState().browserClosed, true);
    assert.equal(globalThis.browserFixture.closeCount, 1);
  });
  await test('cancellation during browser close rejects instead of returning a passed flow', async () => {
    const controller = new AbortController();
    globalThis.browserFixture = {httpStatus: 200, closeCount: 0, onClose: () => controller.abort(new Error('late close interrupt'))};
    await assert.rejects(runPlaywrightFlow({targetUrl: 'http://fixture.invalid/', signal: controller.signal}), /late close interrupt/);
    assert.equal(latestState().status, 'interrupted');
    assert.equal(latestState().browserClosed, true);
    assert.equal(globalThis.browserFixture.closeCount, 1);
  });
  await test('CRUD console failure is reflected in browser state before the runner returns', async () => {
    globalThis.browserFixture = {httpStatus: 200, closeCount: 0, consoleError: true};
    const runDir = path.join(fixture, 'tmp/crud-console');
    const report = {browser: {}};
    await assert.rejects(runBrowser({modules: [], timeoutMs: 1000, frontendOrigin:'http://fixture.invalid', client:'vue', clientId:'fixture-client'}, runDir, 'fixture-token', {}, {}, {}, {}, report), /Console check failed/);
    const state = JSON.parse(fs.readFileSync(path.join(runDir, 'browser-state.json'), 'utf8'));
    assert.equal(state.status, 'failed');
    assert.equal(state.browserClosed, true);
    assert.equal(report.browser.badConsoleEntries, 1);
  });
  await test('authenticated console/page errors and returned JSON redact raw/encoded URLs without hiding errors', async () => {
    const token = 'private/browser+credential=value';
    const encoded = encodeURIComponent(token);
    const privateText = `WebSocket failed ${token} ${encoded}`;
    globalThis.browserFixture = {httpStatus:200,closeCount:0,consoleEntries:[{type:'error',text:privateText,location:{url:`http://fixture.invalid/${encoded}`,lineNumber:3}}],pageErrors:[privateText]};
    const result = await runPlaywrightFlow({targetUrl:'http://fixture.invalid/',browserSession:{token,client:'react',clientId:'fixture-client'},failOnConsoleErrors:false});
    assert.equal(result.consoleEntries.length,2);
    assert.deepEqual(result.consoleEntries.map(item=>item.type),['error','pageerror']);
    assert.equal(result.consoleEntries[0].location.lineNumber,3);
    for (const value of [JSON.stringify(result),fs.readFileSync(result.consoleLogPath,'utf8'),fs.readFileSync(result.stateFile,'utf8')]) assert.ok(!value.includes(token) && !value.includes(encoded),'public evidence must hide both credential representations');
    assert.equal(globalThis.browserFixture.closeCount,1);
  });
  await test('Playwright and cleanup errors keep failure details but sanitize nested causes and terminal stacks', async () => {
    const token='private/cancelled+credential=value';
    const encoded=encodeURIComponent(token);
    globalThis.browserFixture={httpStatus:200,closeCount:0,gotoError:`navigation failed ${encoded}`,closeError:`close failed ${token}`};
    await assert.rejects(runPlaywrightFlow({targetUrl:'http://fixture.invalid/',browserSession:{token,client:'vue',clientId:'fixture-client'}}),error=>{
      assert.ok(error instanceof AggregateError);
      assert.match(error.message,/navigation failed.*Browser cleanup failed/u);
      for(const item of [error,...error.errors]) assert.ok(!item.message.includes(token)&&!item.stack.includes(encoded));
      return true;
    });
    const state=latestState();
    assert.equal(state.status,'failed');assert.equal(state.browserClosed,false);
    assert.ok(!JSON.stringify(state).includes(token)&&!JSON.stringify(state).includes(encoded));
  });
  await test('CRUD evidence keeps admin and online-session credentials private after online token is cleared', async () => {
    const token='private/admin+credential=value',online='private/online+credential=value';
    const data={onlineUser:{token:online}};
    const runDir=path.join(fixture,'tmp/crud-private-console');
    const report={browser:{}};
    globalThis.browserFixture={httpStatus:200,closeCount:0,consoleEntries:[{type:'error',text:`handshake ${token} ${encodeURIComponent(online)}`,location:{url:`http://fixture.invalid/${encodeURIComponent(token)}`}}],pageErrors:[`page failure ${online}`],onClose:()=>{data.onlineUser.token='';}};
    await assert.rejects(runBrowser({modules:[],timeoutMs:1000,frontendOrigin:'http://fixture.invalid',client:'vue',clientId:'fixture-client'},runDir,token,{},{},data,{},report),/Console check failed/u);
    assert.equal(data.onlineUser.token,'');assert.equal(report.browser.badConsoleEntries,2);
    for (const value of [fs.readFileSync(path.join(runDir,'console/admin-crud.json'),'utf8'),fs.readFileSync(path.join(runDir,'browser-state.json'),'utf8'),JSON.stringify(report)]) for(const secret of [token,online,encodeURIComponent(token),encodeURIComponent(online)]) assert.ok(!value.includes(secret),'CRUD public evidence must not disclose a login token');
  });
  await test('admin stack preserves external service ownership and cancels a pending probe', async () => {
    fs.mkdirSync(path.join(fixture, 'backend'), {recursive: true});
    fs.mkdirSync(path.join(fixture, 'frontend-fixture'), {recursive: true});
    const controller = new AbortController();
    let interrupt = false;
    const server = http.createServer((_request, response) => {
      if (interrupt) controller.abort(new Error('fixture probe interrupted'));
      else response.end('fixture');
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const config = {repoRoot: fixture, label: 'fixture-stack', defaultProfile: 'local', defaultBackendPort: 8080, defaultFrontendPort: server.address().port, frontendPortEnv: 'FIXTURE_FRONTEND_PORT', frontendPortFlag: '--fixture-port', frontendDirName: 'frontend-fixture', frontendDisplayName: 'fixture', frontendLogPrefix: 'fixture', scriptPath: 'fixture', stateSlug: 'test-cli/stack-fixture', stateFile: path.join(fixture, 'tmp/stack-state.json')};
    try {
      await runAdminDevStack(config, ['--frontend-only']);
      assert.equal(JSON.parse(fs.readFileSync(config.stateFile, 'utf8')).processes[0].owned, false);
      await stopAdminDevStackState(config);
      assert.equal(server.listening, true);
      interrupt = true;
      await assert.rejects(runAdminDevStack({...config, signal: controller.signal}, ['--frontend-only']), /fixture probe interrupted/);
      assert.equal(JSON.parse(fs.readFileSync(config.stateFile, 'utf8')).status, 'interrupted');
      assert.equal(server.listening, true);
    } finally {server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));}
  });
  await test('DevTools wrapper forwards termination, closes its owned process and records evidence', async () => {
    const entry = path.join(scripts, 'node_modules/chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js');
    fs.mkdirSync(path.dirname(entry), {recursive: true});
    fs.writeFileSync(entry, "process.stdout.write('FIXTURE_READY\\n'); setInterval(() => {}, 1000);\n", 'utf8');
    const child = spawn(process.execPath, [path.join(scripts, 'chrome_devtools_cli.mjs')], {stdio: ['ignore', 'pipe', 'pipe']});
    try {
      await once(child.stdout, 'data');
      const closed = once(child, 'close');
      child.kill('SIGTERM');
      const [code] = await closed;
      assert.equal(code, 143);
      const dir = path.join(fixture, 'tmp/test-cli/browser/chrome-devtools-mcp');
      const statePath = fs.readdirSync(dir).find((name) => name.endsWith('.state.json'));
      const state = JSON.parse(fs.readFileSync(path.join(dir, statePath), 'utf8'));
      assert.equal(state.status, 'interrupted');
      assert.equal(state.processClosed, true);
      assert.throws(() => process.kill(state.pid, 0), {code: 'ESRCH'});
    } finally { if (child.exitCode === null) child.kill('SIGKILL'); }
  });
} finally {
  delete globalThis.browserFixture;
  fs.rmSync(fixture, {recursive: true, force: true});
}
