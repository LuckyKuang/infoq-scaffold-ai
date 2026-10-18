#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {runCommand, runCommandChecked, terminateProcessTree, stopRecordedRunState, isProcessAlive} from './lib/skill_runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const parent = path.join(root, 'tmp', 'runtime-tests');
fs.mkdirSync(parent, {recursive: true});
const evidence = fs.mkdtempSync(path.join(parent, 'run-'));
const results = [];
async function check(name, action) {
  await action();
  results.push({name, passed: true});
  console.log(`[PASS] ${name}`);
}

await check('capture waits for full stdout/stderr close', async () => {
  const result = await runCommandChecked(process.execPath, ['-e', 'process.stdout.write("a".repeat(1024*1024));process.stderr.write("b".repeat(1024*1024));'], {captureOutput: true});
  assert.equal(result.stdout, 'a'.repeat(1024 * 1024));
  assert.equal(result.stderr, 'b'.repeat(1024 * 1024));
});
await check('nonzero exit and spawn error are failures', async () => {
  await assert.rejects(runCommandChecked(process.execPath, ['-e', 'process.stderr.write("fixture failure");process.exitCode=7'], {captureOutput: true}), /code 7[\s\S]*fixture failure/u);
  await assert.rejects(runCommandChecked(path.join(evidence, 'not-an-executable')), /ENOENT/u);
});
await check('timeout stops an owned hung command and fails', async () => {
  const pidFile = path.join(evidence, 'timeout.pid');
  await assert.rejects(runCommandChecked(process.execPath, ['-e', 'require("fs").writeFileSync(process.argv[1],String(process.pid));process.on("SIGTERM",()=>{});setInterval(()=>{},1000);', pidFile], {captureOutput: true, timeoutMs: 1000}), (error) => error.code === 'ETIMEDOUT' && error.name === 'TimeoutError');
  assert.equal(isProcessAlive(fs.readFileSync(pidFile, 'utf8')), false);
});
await check('aborted-before-start command has no side effect', async () => {
  const controller = new AbortController();
  controller.abort();
  const target = path.join(evidence, 'must-not-exist');
  await assert.rejects(runCommand(process.execPath, ['-e', 'require("fs").writeFileSync(process.argv[1],"unexpected")', target], {signal: controller.signal}), (error) => error.name === 'AbortError' && error.code === 'ABORT_ERR');
  assert.equal(fs.existsSync(target), false);
});
await check('running cancellation waits for the child to exit', async () => {
  const controller = new AbortController();
  const pidFile = path.join(evidence, 'abort.pid');
  const pending = runCommandChecked(process.execPath, ['-e', 'require("fs").writeFileSync(process.argv[1],String(process.pid));setInterval(()=>{},1000)', pidFile], {signal: controller.signal, captureOutput: true, timeoutMs: 5000});
  const rejection = assert.rejects(pending, /abort/iu);
  while (!fs.existsSync(pidFile)) await new Promise((resolve) => setTimeout(resolve, 10));
  controller.abort();
  await rejection;
  assert.equal(isProcessAlive(fs.readFileSync(pidFile, 'utf8')), false);
});
for (const detached of [false, true]) {
  await check(`cleanup stops ${detached ? 'detached' : 'non-detached'} owned child`, async () => {
    const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {detached, stdio: 'ignore'});
    await once(child, 'spawn');
    try {
      assert.equal(await terminateProcessTree(child.pid, {graceMs: 40}), true);
      assert.equal(isProcessAlive(child.pid), false);
    } finally {
      if (isProcessAlive(child.pid)) child.kill('SIGKILL');
    }
  });
}
await check('state cleanup preserves an explicitly unowned process', async () => {
  const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {stdio: 'ignore'});
  await once(child, 'spawn');
  try {
    const stateFile = path.join(evidence, 'state.json');
    fs.writeFileSync(stateFile, JSON.stringify({processes: [{pid: child.pid, owned: false}]}), 'utf8');
    const state = await stopRecordedRunState(stateFile);
    assert.equal(state.stoppedProcesses[0].skippedReason, 'not-owned');
    assert.equal(isProcessAlive(child.pid), true);
  } finally {
    child.kill('SIGKILL');
    await once(child, 'close');
  }
});
await check('invalid timeout is rejected before running', async () => {
  await assert.rejects(runCommand(process.execPath, [], {timeoutMs: -1}), /positive integer/u);
});
await check('self cleanup is rejected without signalling the current process', async () => {
  await assert.rejects(terminateProcessTree(process.pid), /current process/u);
});
if (process.platform !== 'win32') {
  const active = (pid) => {
    const result = spawnSync('ps', ['-p', String(pid), '-o', 'stat='], {encoding: 'utf8'});
    assert.equal(result.error, undefined);
    assert.ok([0, 1].includes(result.status), `Unexpected ps exit ${result.status}`);
    return result.status === 0 && !/^[ZX]/u.test(result.stdout.trim());
  };
  const waitForPid = async (file) => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      if (fs.existsSync(file)) return Number(fs.readFileSync(file, 'utf8'));
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Fixture process did not write ${path.basename(file)}`);
  };
  const grandchildSource = 'const fs=require("fs");process.on("SIGTERM",()=>{});fs.writeFileSync(process.argv[1],String(process.pid));setInterval(()=>{},1000);';
  const parentSource = `require('child_process').spawn(process.execPath,['-e',${JSON.stringify(grandchildSource)},process.argv[1]],{stdio:'inherit'});setInterval(()=>{},1000);`;
  for (const detached of [false, true]) {
    await check(`cleanup stops SIGTERM-resistant descendants, detached=${detached}`, async () => {
      const pidFile = path.join(evidence, `descendant-${detached}.pid`);
      const sibling = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {stdio: 'ignore'});
      const child = spawn(process.execPath, ['-e', parentSource, pidFile], {detached, stdio: 'ignore'});
      let grandchild;
      try {
        grandchild = await waitForPid(pidFile);
        assert.equal(await terminateProcessTree(child.pid, {graceMs: 40}), true);
        assert.equal(active(child.pid), false);
        assert.equal(active(grandchild), false);
        assert.equal(active(sibling.pid), true, 'cleanup must preserve a sibling in the caller process group');
      } finally {
        for (const pid of [child.pid, grandchild, sibling.pid].filter(Boolean)) {
          if (isProcessAlive(pid)) process.kill(pid, 'SIGKILL');
        }
      }
    });
  }
  await check('recorded detached group is cleaned after the leader exits', async () => {
    const pidFile = path.join(evidence, 'orphan.pid');
    const child = spawn(process.execPath, ['-e', parentSource.replace(/setInterval\(\(\)=>\{\},1000\);$/u, 'setTimeout(()=>process.exit(0),100);'), pidFile], {detached: true, stdio: 'ignore'});
    const exited = once(child, 'exit');
    let grandchild;
    try {
      grandchild = await waitForPid(pidFile);
      await exited;
      assert.equal(active(grandchild), true);
      const stateFile = path.join(evidence, 'orphan-state.json');
      fs.writeFileSync(stateFile, JSON.stringify({processes: [{pid: child.pid, owned: true}]}), 'utf8');
      const state = await stopRecordedRunState(stateFile, {graceMs: 40});
      assert.equal(state.stoppedProcesses[0].aliveBeforeStop, false);
      assert.equal(state.stoppedProcesses[0].stopped, true);
      assert.equal(active(grandchild), false);
    } finally {
      for (const pid of [child.pid, grandchild].filter(Boolean)) if (isProcessAlive(pid)) process.kill(pid, 'SIGKILL');
    }
  });
  for (const mode of ['timeout', 'abort', 'timeout-after-parent-exit']) {
    await check(`${mode} closes inherited pipes and stops command descendants`, async () => {
      const pidFile = path.join(evidence, `${mode}-tree.pid`);
      const controller = new AbortController();
      const source = mode === 'timeout-after-parent-exit'
        ? parentSource.replace(/setInterval\(\(\)=>\{\},1000\);$/u, 'setTimeout(()=>process.exit(0),100);')
        : parentSource;
      const startedAt = Date.now();
      const pending = runCommandChecked(process.execPath, ['-e', source, pidFile], {captureOutput: true, timeoutMs: 500, ...(mode === 'abort' ? {signal: controller.signal} : {})});
      let result;
      const settled = pending.then(() => { result = {ok: true}; }, (error) => { result = {error}; });
      let grandchild;
      try {
        grandchild = await waitForPid(pidFile);
        if (mode === 'abort') controller.abort();
        for (let attempt = 0; attempt < 200 && !result; attempt += 1) await new Promise((resolve) => setTimeout(resolve, 10));
        assert.ok(result, 'cancellation must complete even when descendants hold the captured pipes');
        assert.equal(result.error?.code, mode === 'abort' ? 'ABORT_ERR' : 'ETIMEDOUT');
        assert.equal(active(grandchild), false);
        assert.ok(Date.now() - startedAt < 2500, 'cleanup must be bounded');
      } finally {
        if (grandchild && isProcessAlive(grandchild)) process.kill(grandchild, 'SIGKILL');
        await settled;
      }
    });
  }
}
fs.writeFileSync(path.join(evidence, 'results.json'), `${JSON.stringify(results, null, 2)}\n`, 'utf8');
console.log(`[runtime] ${results.length} scenarios passed; ${path.relative(root, evidence)}`);
