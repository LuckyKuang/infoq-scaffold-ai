#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const parent = path.join(root, 'tmp', 'openspec-tools');
fs.mkdirSync(parent, {recursive: true});
const fixture = fs.mkdtempSync(path.join(parent, 'fixture-'));
fs.mkdirSync(path.join(fixture, 'skills'));
fs.writeFileSync(path.join(fixture, 'AGENTS.md'), '# AGENTS.md\n', 'utf8');
for (const file of ['tools/init_change_dir.mjs', 'tools/openspec_check.mjs', 'tools/generate_plugin_plan.mjs', 'tools/lib/skill_runtime.mjs']) {
  fs.mkdirSync(path.dirname(path.join(fixture, file)), {recursive: true});
  fs.copyFileSync(path.join(root, file), path.join(fixture, file));
}
const runs = [];
function run(script, args, status = 0, diagnostic) {
  const result = spawnSync(process.execPath, [path.join(fixture, 'tools', script), ...args], {
    cwd: fixture, encoding: 'utf8', timeout: 10000,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  runs.push({script, args, status: result.status, output});
  assert.equal(result.status, status, output);
  if (diagnostic) assert.match(output, diagnostic);
  return output;
}
try {
  run('init_change_dir.mjs', ['audit-fixture']);
  const change = path.join(fixture, 'openspec', 'changes', 'audit-fixture');
  const tasksFile = path.join(change, 'tasks.md');
  const originalTasks = fs.readFileSync(tasksFile, 'utf8');
  run('openspec_check.mjs', ['audit-fixture']);
  for (const domain of ['backend', 'frontend-react', 'frontend-vue', 'docs', 'script / deploy', 'skills']) {
    // Mentioning a domain elsewhere must not disguise its absence from the impact matrix.
    fs.writeFileSync(tasksFile, originalTasks.replace(`- [ ] ${domain}：\n`, '') + `\n附注：${domain}\n`, 'utf8');
    run('openspec_check.mjs', ['audit-fixture'], 1, /影响矩阵 缺少/u);
  }
  fs.writeFileSync(tasksFile, originalTasks, 'utf8');
  const proposalFile = path.join(change, 'proposal.md');
  const originalProposal = fs.readFileSync(proposalFile, 'utf8');
  fs.writeFileSync(proposalFile, originalProposal.replace('- 回滚触发条件：\n', ''), 'utf8');
  run('openspec_check.mjs', ['audit-fixture'], 1, /验收约定 缺少/u);
  run('init_change_dir.mjs', ['audit-fixture']);
  assert.equal(fs.readFileSync(proposalFile, 'utf8'), originalProposal.replace('- 回滚触发条件：\n', ''), 'initialization must preserve existing edits');
  run('init_change_dir.mjs', ['../outside'], 1, /Invalid change-id/u);
  run('openspec_check.mjs', ['missing-change'], 1, /Active change not found/u);
  fs.cpSync(path.join(root, 'openspec', 'examples', 'demo-change'), path.join(fixture, 'openspec', 'changes', 'template'), {recursive: true});
  run('openspec_check.mjs', ['template']);
  const planFile = path.join(fixture, 'tmp', 'plugin-plan.md');
  run('generate_plugin_plan.mjs', ['--name', 'infoq-plugin-audit', '--class', 'toggle', '--frontend', 'both', '--out', 'tmp/plugin-plan.md']);
  const plan = fs.readFileSync(planFile, 'utf8');
  const commands = plan.split('\n').filter((line) => line.startsWith('pnpm '));
  assert.equal(commands.length, 2, 'both admin workspaces need build commands');
  for (const command of commands) {
    const [, flag, workspace, verb, script] = command.split(' ');
    assert.equal(flag, '--dir', 'commands must not depend on a previous cd');
    assert.equal(verb, 'run');
    assert.equal(typeof JSON.parse(fs.readFileSync(path.join(root, workspace, 'package.json'), 'utf8')).scripts[script], 'string');
  }
  const before = fs.readFileSync(planFile, 'utf8');
  run('generate_plugin_plan.mjs', ['--name', '../escape', '--class', 'toggle', '--out', 'tmp/plugin-plan.md'], 1, /--name/u);
  run('generate_plugin_plan.mjs', ['--name', 'infoq-plugin-audit', '--class', 'unknown'], 1, /--class/u);
  run('generate_plugin_plan.mjs', ['--name', 'infoq-plugin-audit', '--class', 'toggle', '--frontend', 'unknown'], 1, /--frontend/u);
  assert.equal(fs.readFileSync(planFile, 'utf8'), before, 'invalid inputs must not overwrite output');
  console.log(`[openspec-tools-test] PASS: ${runs.length} isolated CLI scenarios`);
} finally {
  fs.writeFileSync(path.join(fixture, 'results.json'), `${JSON.stringify(runs, null, 2)}\n`, 'utf8');
  console.log(`[openspec-tools-test] evidence: ${path.relative(root, fixture)}`);
}
