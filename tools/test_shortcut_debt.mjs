#!/usr/bin/env node
// check_shortcut_debt 回归测试：在 tmp/ 下构造 Git fixture 验证台账与失败语义。
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolveRepoRoot} from './lib/skill_runtime.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(scriptDir);
const checker = path.join(repoRoot, 'tools', 'check_shortcut_debt.mjs');
const fixtureBase = path.join(repoRoot, 'tmp', 'shortcut-debt', `fixture-${Date.now()}`);
let fixtureRoot = fixtureBase;
let caseIndex = 0;

function writeFixture(files) {
  caseIndex += 1;
  fixtureRoot = path.join(fixtureBase, `case-${String(caseIndex).padStart(2, '0')}`);
  fs.mkdirSync(fixtureRoot, {recursive: true});
  const init = spawnSync('git', ['init', '--quiet'], {cwd: fixtureRoot, encoding: 'utf8'});
  if (init.error || init.status !== 0) {
    throw new Error(`fixture git init failed: ${init.error?.message || init.stderr}`);
  }
  for (const [file, body] of Object.entries(files)) {
    const target = path.join(fixtureRoot, file);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, body, 'utf8');
  }
}

function runChecker(extraArgs = []) {
  return spawnSync(process.execPath, [checker, '--root', fixtureRoot, ...extraArgs], {encoding: 'utf8'});
}

const results = [];

function check(name, run, matcher) {
  const output = `${run.stdout}${run.stderr}`;
  const ok = Boolean(matcher(run.status, output));
  results.push({name, ok});
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${name} (exit=${run.status})`);
  if (!ok) {
    console.log(output.trim());
  }
}

writeFixture({
  'src/a.ts': '// shortcut: single node only, upgrade when cluster mode lands\n',
  'src/b.ts': '# shortcut: no trigger recorded here\n',
  'src/c.ts': "const note = 'shortcut: mentioned in a string';\n",
  'src/d.ts': '/* ponytail: legacy marker, migrate after v4 */\n',
  'src/e.ts': '/**\n * shortcut: inline cache, upgrade when redis cluster lands\n */\n',
  'src/f.ts': "const fake = '/* shortcut: string literal, not a marker */';\n",
  'docs/note.md': '<!-- shortcut: documentation example, ignored -->\n'
});

const jsonRun = runChecker(['--json']);
let parsed = null;
try {
  parsed = JSON.parse(jsonRun.stdout);
} catch {
  parsed = null;
}

check('json output reports four code markers', jsonRun, (status) => status === 0 && parsed?.total === 4 && parsed?.withoutTrigger === 1);
check('string literals and markdown are excluded', jsonRun, () => {
  const files = (parsed?.entries ?? []).map((entry) => entry.file);
  return ['src/c.ts', 'src/f.ts', 'docs/note.md'].every((file) => !files.includes(file));
});
check('block comment continuation is collected', jsonRun, () => {
  const entry = (parsed?.entries ?? []).find((item) => item.file === 'src/e.ts');
  return Boolean(entry) && entry.trigger === 'upgrade when redis cluster lands';
});
check('legacy ponytail marker is collected', jsonRun, () => {
  const entry = (parsed?.entries ?? []).find((item) => item.file === 'src/d.ts');
  return Boolean(entry) && entry.trigger === 'migrate after v4 */';
});
check('default mode is report-only', runChecker([]), (status) => status === 0);
check('strict mode fails on missing trigger', runChecker(['--strict']), (status) => status === 1);

writeFixture({'src/clean.ts': '// shortcut: cache once, upgrade when config reload lands\n'});
check('strict mode passes when every marker has a trigger', runChecker(['--strict']), (status) => status === 0);

writeFixture({'src/empty.ts': 'export const value = 1;\n'});
const emptyRun = runChecker(['--json']);
let emptyParsed = null;
try {
  emptyParsed = JSON.parse(emptyRun.stdout);
} catch {
  emptyParsed = null;
}
check('clean ledger passes', emptyRun, (status) => status === 0 && emptyParsed?.total === 0);

const unknownArgRun = spawnSync(process.execPath, [checker, '--root', fixtureRoot, '--bogus'], {encoding: 'utf8'});
check('unknown argument fails', unknownArgRun, (status, output) => status !== 0 && output.includes('unexpected argument'));

const failed = results.filter((item) => !item.ok);
console.log(`[shortcut-debt-test] ${failed.length === 0 ? 'pass' : 'fail'} (${results.length - failed.length}/${results.length})`);
console.log(`[shortcut-debt-test] fixture root: ${fixtureBase}`);
process.exit(failed.length === 0 ? 0 : 1);
