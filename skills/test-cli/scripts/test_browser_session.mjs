#!/usr/bin/env node
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {request} from 'playwright';
import {establishBrowserSession} from '../../../tools/lib/browser_session.mjs';

const token = 'private-access-token-never-log';
const csrf = 'private-csrf-never-log';
let mode = 'ok';
const calls = [];
const server = http.createServer((req, res) => {
  calls.push({url:req.url,method:req.method,headers:req.headers});
  res.setHeader('Content-Type', 'application/json');
  const path = req.url.startsWith('/prod-api/') ? '/prod-api' : '/dev-api';
  if (req.url.endsWith('/csrf')) {
    if (mode === 'bad-json') return res.end(token);
    if (mode === 'get-reject') {res.statusCode = 403; return res.end(JSON.stringify({code:403,msg:token}));}
    res.setHeader('Set-Cookie', `CSRF=${csrf}; Path=${path}/auth/browser-session; HttpOnly; SameSite=Strict`);
    return res.end(JSON.stringify({code:200,data:{token:csrf,headerName:'X-XSRF-TOKEN'}}));
  }
  if (mode === 'disconnect') return req.socket.destroy();
  if (mode === 'redirect') {res.statusCode=307;res.setHeader('Location','/redirected');return res.end('{}');}
  if (mode === 'put-reject') {res.statusCode=503;return res.end(JSON.stringify({code:503,msg:token}));}
  if (req.headers.authorization !== `Bearer ${token}` || req.headers['x-xsrf-token'] !== csrf
      || !req.headers.cookie?.includes(`CSRF=${csrf}`)) {res.statusCode=403;return res.end('{"code":403}');}
  res.setHeader('Set-Cookie', `SESSION=opaque; Path=${path}/auth/browser-session; HttpOnly; SameSite=Strict`);
  res.end('{"code":200}');
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  for (const apiPrefix of ['/dev-api', '/prod-api']) {
    const context = await request.newContext();
    try {
      calls.length = 0;
      await establishBrowserSession({request:context}, {origin,client:'react',clientId:'fixture.client',token,apiPrefix});
      assert.deepEqual(calls.map(({url,method})=>[method,url]), [['GET',`${apiPrefix}/auth/browser-session/csrf`],['PUT',`${apiPrefix}/auth/browser-session`]]);
      assert.equal(calls[0].headers.authorization, undefined);
      for (const call of calls) {
        assert.equal(call.headers.origin, origin);
        assert.equal(call.headers.clientid, 'fixture.client');
        assert.equal(call.headers['x-infoq-browser-session'], 'react');
      }
      const cookies = (await context.storageState()).cookies;
      assert.ok(cookies.some(cookie=>cookie.name==='SESSION' && cookie.httpOnly && cookie.path===`${apiPrefix}/auth/browser-session`));
    } finally {await context.dispose();}
  }
  for (mode of ['bad-json','get-reject','put-reject','disconnect','redirect']) {
    const context = await request.newContext();
    calls.length = 0;
    try {
      await assert.rejects(establishBrowserSession({request:context}, {origin,client:'vue',clientId:'fixture-client',token}), error => {
        assert.ok(!error.stack.includes(token) && !error.stack.includes(csrf), 'failures must not include private headers or upstream body');
        return /Browser session/.test(error.message);
      });
      assert.ok(!calls.some(call=>call.url==='/redirected'), 'private headers must not follow redirects');
    } finally {await context.dispose();}
  }
  for (const overrides of [{client:'unknown'},{clientId:''},{clientId:'_invalid'},{clientId:'white space'},{token:''},{apiPrefix:'/other-api'},{timeoutMs:0}]) {
    calls.length = 0;
    await assert.rejects(establishBrowserSession({}, {origin,client:'vue',clientId:'fixture-client',token,...overrides}), /Invalid browser session/);
    assert.equal(calls.length, 0);
  }
  console.log('Browser session contracts passed: real HTTP, shared private cookie jar, both proxy paths, scope/CSRF headers, sanitized failures, redirect rejection.');
} finally {
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
}
