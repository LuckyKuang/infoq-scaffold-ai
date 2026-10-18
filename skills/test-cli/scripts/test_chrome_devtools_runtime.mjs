#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createInterface} from 'node:readline';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {isProcessAlive, markRunState, terminateProcessTree} from '../../../tools/lib/skill_runtime.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const parent = path.join(repoRoot, 'tmp/test-cli');
fs.mkdirSync(parent, {recursive: true});
const runDir = fs.mkdtempSync(path.join(parent, 'devtools-protocol-'));
const stateFile = path.join(runDir, 'state.json');
const logFile = path.join(runDir, 'mcp.stderr.log');
const profile = path.join(runDir, 'chromium-profile');
const save = (name, value) => fs.writeFileSync(path.join(runDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
const record = (patch) => markRunState(stateFile, patch);

await test('installed DevTools MCP supports the configured protocol, isolated diagnosis and owned cleanup', async () => {
  fs.writeFileSync(logFile, '', 'utf8');
  record({status: 'starting', pid: process.pid, port: null, log: logFile, owned: true, processes: []});
  let context, child, closed, reader, browserPid, fixturePort, cdpPort, wrapperState;
  let requestId = 0;
  let failure;
  let interrupted = '';
  const pending = new Map();
  const server = http.createServer((_request, response) => {
    response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
    response.end('<!doctype html><title>InfoQ DevTools fixture</title><h1>Isolated diagnostic fixture</h1>');
  });
  const rejectPending = (error) => {
    for (const item of pending.values()) {clearTimeout(item.timer); item.reject(error);}
    pending.clear();
  };
  const handlers = new Map(['SIGINT', 'SIGTERM', 'SIGHUP'].map(signal => [signal, () => {
    interrupted ||= signal;
    rejectPending(new Error(`DevTools verification interrupted: ${signal}`));
  }]));
  for (const [signal, handler] of handlers) process.on(signal, handler);
  const request = (method, params) => new Promise((resolve, reject) => {
    if (interrupted) {reject(new Error(`DevTools verification interrupted: ${interrupted}`)); return;}
    const id = ++requestId;
    const timer = setTimeout(() => {pending.delete(id); reject(new Error(`MCP ${method} timed out after 20 seconds`));}, 20_000);
    pending.set(id, {resolve, reject, timer});
    child.stdin.write(`${JSON.stringify({jsonrpc: '2.0', id, method, params})}\n`, error => {
      if (error) {clearTimeout(timer); pending.delete(id); reject(error);}
    });
  });
  const call = async (name, args = {}) => {
    const result = await request('tools/call', {name, arguments: args});
    save(`${name}.json`, result);
    assert.notEqual(result.isError, true, `${name} failed: ${JSON.stringify(result)}`);
    return result;
  };
  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    fixturePort = server.address().port;
    record({port: fixturePort});
    context = await chromium.launchPersistentContext(profile, {
      headless: true, timeout: 15_000, handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false,
      args: ['--remote-debugging-port=0']
    });
    cdpPort = Number(fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]);
    assert.ok(Number.isInteger(cdpPort) && cdpPort > 0, 'Chromium must publish its isolated CDP port');
    const session = await context.browser().newBrowserCDPSession();
    const {processInfo} = await session.send('SystemInfo.getProcessInfo');
    browserPid = processInfo.find(item => item.type === 'browser')?.id;
    assert.ok(Number.isInteger(browserPid) && browserPid > 0, 'Chromium PID must be observable');
    record({processes: [{role: 'chromium', pid: browserPid, port: cdpPort, owned: true}]});
    await session.detach();
    await context.pages()[0].goto(`http://127.0.0.1:${fixturePort}/`, {timeout: 10_000});
    child = spawn(process.execPath, [path.join(repoRoot, 'skills/test-cli/scripts/chrome_devtools_cli.mjs'),
      `--browserUrl=http://127.0.0.1:${cdpPort}`, '--no-usage-statistics', '--no-performance-crux'], {
      cwd: repoRoot, stdio: ['pipe', 'pipe', 'pipe'],
      env: {...process.env, CI: '1', CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS: '1'}
    });
    closed = new Promise(resolve => child.once('close', (code, signal) => {
      rejectPending(new Error(`MCP wrapper closed: code=${code}, signal=${signal}`));
      resolve({code, signal});
    }));
    child.on('error', rejectPending);
    child.stdin.on('error', rejectPending);
    child.stderr.on('data', data => fs.appendFileSync(logFile, data));
    reader = createInterface({input: child.stdout});
    reader.on('line', line => {
      try {
        const response = JSON.parse(line);
        const item = pending.get(response.id);
        if (!item) return;
        clearTimeout(item.timer);
        pending.delete(response.id);
        if (response.error) item.reject(new Error(`MCP response error: ${JSON.stringify(response.error)}`));
        else item.resolve(response.result);
      } catch (error) {rejectPending(new Error(`Invalid MCP JSON response: ${error.message}`));}
    });
    record({status: 'running', processes: [
      {role: 'chromium', pid: browserPid, port: cdpPort, owned: true},
      {role: 'mcp-wrapper', pid: child.pid, port: null, owned: true}
    ]});
    const initialized = await request('initialize', {
      protocolVersion: '2025-03-26', capabilities: {}, clientInfo: {name: 'infoq-devtools-verification', version: '1.0.0'}
    });
    save('initialize.json', initialized);
    assert.equal(initialized.protocolVersion, '2025-03-26');
    const installed = JSON.parse(fs.readFileSync(path.join(repoRoot, 'skills/test-cli/scripts/node_modules/chrome-devtools-mcp/package.json'), 'utf8'));
    assert.equal(initialized.serverInfo.version, installed.version);
    assert.ok(initialized.capabilities.tools);
    child.stdin.write(`${JSON.stringify({jsonrpc: '2.0', method: 'notifications/initialized'})}\n`);
    const listed = await request('tools/list', {});
    save('tools-list.json', listed);
    const config = fs.readFileSync(path.join(repoRoot, '.codex/config.toml'), 'utf8');
    const approved = [...config.matchAll(/\[mcp_servers\.chrome-devtools\.tools\.([^\]]+)\]\s*approval_mode\s*=\s*"approve"/gu)].map(match => match[1]).sort();
    assert.deepEqual(approved, ['click', 'evaluate_script', 'take_screenshot', 'take_snapshot']);
    const required = {click: ['uid'], evaluate_script: ['function'], take_screenshot: [], take_snapshot: []};
    for (const name of approved) {
      const schema = listed.tools.find(tool => tool.name === name)?.inputSchema;
      assert.equal(schema?.type, 'object', `${name} input schema missing`);
      assert.deepEqual(schema.required || [], required[name], `${name} required parameters changed`);
    }
    assert.equal(listed.tools.find(tool => tool.name === 'click').inputSchema.properties.uid.type, 'string');
    assert.equal(listed.tools.find(tool => tool.name === 'evaluate_script').inputSchema.properties.function.type, 'string');
    assert.equal(listed.tools.find(tool => tool.name === 'take_snapshot').inputSchema.properties.verbose.type, 'boolean');
    assert.equal(listed.tools.find(tool => tool.name === 'take_screenshot').inputSchema.properties.filePath.type, 'string');
    const pages = await call('list_pages');
    assert.ok(JSON.stringify(pages).includes(`http://127.0.0.1:${fixturePort}/`));
    const snapshot = await call('take_snapshot');
    assert.ok(JSON.stringify(snapshot).includes('Isolated diagnostic fixture'));
    // Only this fixed expression is read-only; evaluate_script itself permits mutation.
    const evaluated = await call('evaluate_script', {function: '() => ({title: document.title, heading: document.querySelector("h1").textContent})'});
    assert.ok(JSON.stringify(evaluated).includes('InfoQ DevTools fixture'));
    assert.ok(JSON.stringify(evaluated).includes('Isolated diagnostic fixture'));
    await call('list_console_messages');
  } catch (error) {
    failure = error;
  } finally {
    const cleanupErrors = [];
    if (child) {
      try {
        if (child.exitCode === null && child.signalCode === null) child.stdin.end();
        let timer;
        const result = await Promise.race([closed, new Promise((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error('MCP wrapper did not close after client stdin EOF')), 10_000);
        })]).finally(() => clearTimeout(timer));
        save('wrapper-exit.json', result);
        assert.equal(result.code, 0);
        assert.equal(result.signal, null);
        const dir = path.join(repoRoot, 'tmp/test-cli/browser/chrome-devtools-mcp');
        const stateName = fs.readdirSync(dir).find(name => name.endsWith(`-${child.pid}.state.json`));
        assert.ok(stateName, 'MCP wrapper must record its lifecycle state');
        wrapperState = JSON.parse(fs.readFileSync(path.join(dir, stateName), 'utf8'));
        assert.equal(wrapperState.status, 'stopped');
        assert.equal(wrapperState.exitCode, 0);
        assert.equal(wrapperState.signal, null);
        assert.equal(wrapperState.processClosed, true);
        assert.equal(isProcessAlive(wrapperState.pid), false);
        assert.equal(isProcessAlive(child.pid), false);
        save('wrapper-state.json', wrapperState);
      } catch (error) {
        cleanupErrors.push(error);
        const dir = path.join(repoRoot, 'tmp/test-cli/browser/chrome-devtools-mcp');
        let pid;
        try {
          const stateName = fs.existsSync(dir) && fs.readdirSync(dir).find(name => name.endsWith(`-${child.pid}.state.json`));
          pid = stateName && JSON.parse(fs.readFileSync(path.join(dir, stateName), 'utf8')).pid;
        } catch (stateError) {
          cleanupErrors.push(new Error(`Cannot read owned MCP state during cleanup: ${stateError.message}`, {cause: stateError}));
        }
        for (const ownedPid of [pid, child.pid].filter(Boolean)) {
          try {await terminateProcessTree(ownedPid, {graceMs: 100});} catch (cleanupError) {cleanupErrors.push(cleanupError);}
        }
      }
    }
    reader?.close();
    if (context) {
      let timer;
      try {
        await Promise.race([context.close(), new Promise((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error('Owned Chromium did not close after 10 seconds')), 10_000);
        })]);
        assert.equal(isProcessAlive(browserPid), false);
      }
      catch (error) {
        cleanupErrors.push(error);
        if (browserPid) {
          try {await terminateProcessTree(browserPid, {graceMs: 100});} catch (cleanupError) {cleanupErrors.push(cleanupError);}
        }
      }
      finally {clearTimeout(timer);}
    }
    if (server.listening) {server.closeAllConnections(); await new Promise(resolve => server.close(resolve));}
    for (const port of [fixturePort, cdpPort].filter(Boolean)) {
      const probe = net.createServer();
      try {probe.listen(port, '127.0.0.1'); await once(probe, 'listening');}
      catch (error) {cleanupErrors.push(new Error(`Owned port ${port} remains unavailable after cleanup`, {cause: error}));}
      finally {if (probe.listening) await new Promise(resolve => probe.close(resolve));}
    }
    for (const [signal, handler] of handlers) process.removeListener(signal, handler);
    if (interrupted && !failure) failure = new Error(`DevTools verification interrupted: ${interrupted}`);
    if (cleanupErrors.length) failure = new AggregateError([...(failure ? [failure] : []), ...cleanupErrors], 'DevTools verification or owned cleanup failed');
    record({status: failure ? (interrupted ? 'interrupted' : 'failed') : 'passed',
      error: failure?.message || null, browserClosed: !context || (Boolean(browserPid) && !isProcessAlive(browserPid)),
      wrapperClosed: !child || (!isProcessAlive(child.pid) && wrapperState?.processClosed === true),
      portsClosed: cleanupErrors.length === 0, cleanupErrors: cleanupErrors.map(error => error.message)});
    fs.rmSync(profile, {recursive: true, force: true});
  }
  console.log(`DevTools protocol evidence: ${path.relative(repoRoot, runDir)}`);
  if (failure) throw failure;
});
