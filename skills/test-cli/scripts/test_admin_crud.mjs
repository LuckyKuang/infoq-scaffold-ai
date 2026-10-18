#!/usr/bin/env node
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {test} from 'node:test';
import {runTestLifecycle} from './test_run_lifecycle.mjs';
import {assertCrudSnapshot, cleanupDefinition, expectedCrudRow, finalDbResidue, listAllRows, makeTestData, moduleDefinitions, responseRows, summarizeDbResidue} from './run_admin_crud_e2e.mjs';

test('notice create/edit/delete verify persisted values and matching API identity', () => {
  const data = makeTestData('react');
  const definition = moduleDefinitions(data).notice;
  const created = {label: 'notice:create', api: {[data.notice.baseTitle]: [{noticeId: 42, noticeTitle: data.notice.baseTitle, status: '0'}]}, db: {rows: [{notice_id: '42', notice_title: data.notice.baseTitle, status: '0'}]}};
  assertCrudSnapshot(created, definition, expectedCrudRow(data, 'notice', 'after-create'));
  assert.throws(() => assertCrudSnapshot(created, definition, expectedCrudRow(data, 'notice', 'after-edit')), /noticeTitle mismatch/);
  const edited = structuredClone(created);
  edited.api[data.notice.baseTitle][0].noticeTitle = data.notice.editedTitle;
  edited.db.rows[0].notice_title = data.notice.editedTitle;
  assertCrudSnapshot(edited, definition, expectedCrudRow(data, 'notice', 'after-edit'));
  edited.db.rows[0].notice_id = '43';
  assert.throws(() => assertCrudSnapshot(edited, definition, expectedCrudRow(data, 'notice', 'after-edit')), /identity mismatch/);
  assert.throws(() => assertCrudSnapshot(created, definition, null), /expected 0 active row/);
  assertCrudSnapshot({label: 'notice:delete', api: {old: [], edited: []}, db: {rows: []}}, definition, null);
  assert.throws(() => assertCrudSnapshot({...created, db: {rows: []}}, definition, expectedCrudRow(data, 'notice', 'after-create')), /expected 1 active row/);
  assert.throws(() => assertCrudSnapshot({...created, db: {rows: [...created.db.rows, ...created.db.rows]}}, definition, expectedCrudRow(data, 'notice', 'after-create')), /DB=2/);
});

test('same-key edits and invite cancellation have concrete business expectations', () => {
  const data = makeTestData('vue');
  assert.equal(expectedCrudRow(data, 'user', 'after-edit').nickName, data.user.editedName);
  assert.equal(expectedCrudRow(data, 'dictType', 'type-after-edit').dictName, data.dict.typeNameEdited);
  assert.equal(expectedCrudRow(data, 'config', 'after-edit').configName, data.config.nameEdited);
  assert.equal(expectedCrudRow(data, 'client', 'after-create').activeTimeout, 1800);
  assert.equal(expectedCrudRow(data, 'client', 'after-edit').activeTimeout, 1801);
  assert.equal(expectedCrudRow(data, 'invite', 'after-cancel').status, '2');
  const definition = moduleDefinitions(data).client;
  const snapshot = {label: 'client:edit', api: {key: [{id: 8, clientKey: data.client.key, status: '1', activeTimeout: 1800}]}, db: {rows: [{id: '8', client_key: data.client.key, status: '1', active_timeout: '1800'}]}};
  assert.throws(() => assertCrudSnapshot(snapshot, definition, expectedCrudRow(data, 'client', 'after-edit')), /activeTimeout mismatch/);
});

test('list protocol errors cannot masquerade as an empty delete/cleanup result', () => {
  assert.deepEqual(responseRows({rows: []}), []);
  assert.deepEqual(responseRows({data: []}), []);
  for (const body of [null, {}, {code: 200}, {_raw: '<html>failure</html>'}, {rows: null}]) {
    assert.throws(() => responseRows(body), /Invalid list response/);
  }
});

test('invite cleanup reads later result pages and rejects incomplete pagination', async () => {
  let broken = false;
  const server = http.createServer((request, response) => {
    const page = Number(new URL(request.url, 'http://fixture').searchParams.get('pageNum'));
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({rows: page === 1 ? Array.from({length: 100}, (_, id) => ({id})) : broken ? [] : [{id: 100, remark: 'e2e_last_page'}], total: 101}));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const options = {backendUrl: `http://127.0.0.1:${server.address().port}`, clientId: 'fixture', timeoutMs: 1000};
    const rows = await listAllRows(options, 'fixture-token', '/invites');
    assert.equal(rows.length, 101);
    assert.equal(rows.at(-1).remark, 'e2e_last_page');
    broken = true;
    await assert.rejects(listAllRows(options, 'fixture-token', '/invites'), /incomplete pagination/);
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
});

test('DB query failure, invalid output and unexecuted checks remain unknown; genuine residue stays nonzero', async () => {
  const definitions = {notice: moduleDefinitions(makeTestData('react')).notice};
  const failed = await finalDbResidue(definitions, {}, {}, async () => {throw new Error('fixture: connection refused');});
  assert.equal(failed[0].db.error, 'fixture: connection refused');
  assert.equal(failed[0].db.rows, null);
  assert.equal(summarizeDbResidue(failed), null);
  assert.equal(summarizeDbResidue([]), null);
  assert.equal(summarizeDbResidue(await finalDbResidue(definitions, {}, {}, async () => ({}))), null);
  assert.equal(summarizeDbResidue(await finalDbResidue(definitions, {}, {}, async () => ({rows: []}))), 0);
  assert.equal(summarizeDbResidue(await finalDbResidue(definitions, {}, {}, async () => ({rows: [{notice_id: '9'}]}))), 1);
});

test('actual API cleanup deletes only current-run exact keys and rejects failed or malformed mutations', async () => {
  const data = makeTestData('react');
  const definition = moduleDefinitions(data).notice;
  let mutationResponse = {code: 200};
  const deleted = [];
  const server = http.createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    if (request.method === 'DELETE') {
      deleted.push(request.url);
      response.end(JSON.stringify(mutationResponse));
    } else response.end(JSON.stringify({rows: [{noticeId: 1, noticeTitle: data.notice.baseTitle}, {noticeId: 2, noticeTitle: 'e2e_other_run'}, {noticeId: 3, noticeTitle: 'user_notice'}], total: 3}));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const options = {backendUrl: `http://127.0.0.1:${server.address().port}`, clientId: 'fixture', timeoutMs: 1000};
    const cleaned = await cleanupDefinition(options, 'fixture', definition, definition.dbKeys);
    assert.deepEqual(deleted, ['/system/notice/1']);
    assert.deepEqual(cleaned.errors, []);
    for (const body of [{code: 500, msg: 'denied'}, {}]) {
      mutationResponse = body;
      const failed = await cleanupDefinition(options, 'fixture', definition, [data.notice.baseTitle]);
      assert.equal(failed.deleted.length, 0);
      assert.equal(failed.errors.length, 1);
    }
    const refused = await cleanupDefinition(options, 'fixture', definition, ['user_notice']);
    assert.match(refused.errors[0].error, /non-e2e key/);
    assert.ok(deleted.every((url) => url.endsWith('/1')));
  } finally {server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));}
});

test('both clients preserve 40-bit random suffixes for short usernames and keep stages distinct', () => {
  for (const client of ['react', 'vue']) {
    const users = new Set();
    const online = new Set();
    for (let index = 0; index < 2000; index += 1) {
      const data = makeTestData(client);
      for (const name of [data.user.baseName, data.user.editedName, data.onlineUser.name]) {
        assert.ok(name.length <= 20);
        assert.match(name, /^e2e_[rv]_[ab]_.+_[a-f0-9]{10}$/u);
      }
      assert.notEqual(data.user.baseName, data.user.editedName);
      assert.ok(!users.has(data.user.baseName));
      assert.ok(!online.has(data.onlineUser.name));
      users.add(data.user.baseName);
      online.add(data.onlineUser.name);
    }
  }
});

test('successful CRUD finalization cleans data before stopping resources and persists once', async () => {
  const events = [];
  const report = {};
  await runTestLifecycle({report, execute: async () => events.push('write'), cleanup: async () => events.push('cleanup'), stop: async (status) => events.push(`stop:${status}`), persist: () => events.push(`persist:${report.status}`)});
  assert.deepEqual(events, ['write', 'cleanup', 'stop:passed', 'persist:passed']);
  assert.ok(report.finishedAt);
});

test('primary failure and cleanup failure are both retained and process-stop/report still run', async () => {
  const events = [];
  const report = {};
  await assert.rejects(runTestLifecycle({report, execute: async () => {throw new Error('wrong persisted value');}, cleanup: async () => {throw new Error('API cleanup denied');}, stop: async () => events.push('stop'), persist: () => events.push('persist')}), /wrong persisted value/);
  assert.equal(report.status, 'failed');
  assert.equal(report.error, 'wrong persisted value');
  assert.deepEqual(report.cleanupErrors, ['API cleanup denied']);
  assert.deepEqual(events, ['stop', 'persist']);
});

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  test(`${signal} aborts active work, then cleans data and persists an interrupted report`, async () => {
    const events = [];
    const report = {};
    const priorCode = process.exitCode;
    try {
      await assert.rejects(runTestLifecycle({report, execute: async (abortSignal) => {
        process.emit(signal);
        abortSignal.throwIfAborted();
      }, cleanup: async () => events.push('cleanup'), stop: async (status) => events.push(`stop:${status}`), persist: () => events.push(`persist:${report.status}`)}), /Interrupted by/);
      assert.equal(report.status, 'interrupted');
      assert.match(report.error, new RegExp(signal));
      assert.deepEqual(events, ['cleanup', 'stop:interrupted', 'persist:interrupted']);
      assert.equal(process.listenerCount(signal), 0);
    } finally { process.exitCode = priorCode; }
  });
}

test('cleanup failure and process-stop failure cannot produce a successful report', async () => {
  for (const stage of ['cleanup', 'stop']) {
    const report = {};
    let persisted;
    await assert.rejects(runTestLifecycle({report, execute: async () => {}, cleanup: async () => {if (stage === 'cleanup') throw new Error('cleanup failed');}, stop: async () => {if (stage === 'stop') throw new Error('owned process alive');}, persist: () => {persisted = report.status;}}));
    assert.equal(persisted, 'failed');
    assert.equal(report.cleanupErrors.length, 1);
  }
});

test('report persistence failure preserves the primary failure and cannot remain passed', async () => {
  for (const primary of [false, true]) {
    const report = {};
    await assert.rejects(runTestLifecycle({report, execute: async () => {if (primary) throw new Error('original failure');}, cleanup: async () => {}, stop: async () => {}, persist: () => {throw new Error('disk full');}}), primary ? /original failure; Report persistence: disk full/ : /disk full/);
    assert.equal(report.status, 'failed');
    assert.ok(report.cleanupErrors.some((error) => error.includes('disk full')));
  }
});

test('partial report write is rewritten with failed status without hiding the first disk error', async () => {
  const report = {};
  const written = [];
  await assert.rejects(runTestLifecycle({report, execute: async () => {}, cleanup: async () => {}, stop: async () => {}, persist: () => {
    written.push(report.status);
    if (written.length === 1) throw new Error('markdown write failed');
  }}), /markdown write failed/);
  assert.deepEqual(written, ['passed', 'failed']);
});

test('keep-stack remains allowed only when report persistence also succeeds', async () => {
  for (const failWrite of [false, true]) {
    const report = {};
    const statuses = [];
    let stackRunning = true;
    let writes = 0;
    const run = runTestLifecycle({report, execute: async () => {}, cleanup: async () => {}, stop: async (status) => {
      statuses.push(status);
      if (status !== 'passed') stackRunning = false;
    }, persist: () => {if (++writes === 1 && failWrite) throw new Error('fixture disk failure');}});
    if (failWrite) await assert.rejects(run, /fixture disk failure/);
    else await run;
    assert.deepEqual(statuses, failWrite ? ['passed', 'failed'] : ['passed']);
    assert.equal(stackRunning, !failWrite);
    assert.equal(report.status, failWrite ? 'failed' : 'passed');
  }
});

test('signal during report persistence revokes keep-stack and persists interrupted state', async () => {
  const report = {};
  const statuses = [];
  const written = [];
  const priorCode = process.exitCode;
  let stackRunning = true;
  try {
    await assert.rejects(runTestLifecycle({report, execute: async () => {}, cleanup: async () => {}, stop: async (status) => {
      statuses.push(status);
      if (status !== 'passed') stackRunning = false;
    }, persist: () => {
      written.push(report.status);
      if (written.length === 1) process.emit('SIGTERM');
    }}), /Interrupted by SIGTERM/);
    assert.deepEqual(statuses, ['passed', 'interrupted']);
    assert.deepEqual(written, ['passed', 'interrupted']);
    assert.equal(stackRunning, false);
    assert.equal(report.status, 'interrupted');
  } finally {process.exitCode = priorCode;}
});

test('late process cleanup failure retains both disk and cleanup errors without reporting success', async () => {
  const report = {};
  const statuses = [];
  let writes = 0;
  await assert.rejects(runTestLifecycle({report, execute: async () => {}, cleanup: async () => {}, stop: async (status) => {
    statuses.push(status);
    if (status === 'failed') throw new Error('owned stack still alive');
  }, persist: () => {if (++writes === 1) throw new Error('fixture disk failure');}}), /fixture disk failure; Process cleanup: owned stack still alive/);
  assert.deepEqual(statuses, ['passed', 'failed']);
  assert.equal(report.status, 'failed');
  assert.equal(report.error, 'fixture disk failure');
  assert.ok(report.cleanupErrors.some((error) => error.includes('fixture disk failure')));
  assert.ok(report.cleanupErrors.some((error) => error.includes('owned stack still alive')));
});
