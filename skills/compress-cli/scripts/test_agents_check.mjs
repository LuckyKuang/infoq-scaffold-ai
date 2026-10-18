#!/usr/bin/env node
// compress-cli 校验器回归测试：用 tmp/ 下的 fixture 仓库验证通过/失败语义。
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..', '..');
const fixtureRoot = path.join(repoRoot, 'tmp', 'compress-cli', `fixture-${Date.now()}`);
const checker = path.join(scriptDir, 'agents_check.mjs');
const fixtureChecker = path.join(fixtureRoot, 'tmp', 'compress-cli', 'scripts', 'agents_check.mjs');

const checkerSource = fs.readFileSync(checker, 'utf8');
const protectedBlock = checkerSource.match(/const PROTECTED_CATEGORIES = \[([\s\S]*?)\];/);
if (!protectedBlock) {
  throw new Error('[agents-check-test] cannot read PROTECTED_CATEGORIES from checker');
}
const protectedCategories = [...protectedBlock[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
if (protectedCategories.length === 0) {
  throw new Error('[agents-check-test] PROTECTED_CATEGORIES is empty');
}

function validAgents(extraCategories = {}) {
  const lines = [
    '# AGENTS.md',
    '|Local Skills:skills:{alpha-cli}',
    '|Skill Priority:alpha 工作使用 alpha-cli。',
    '|Skill Trigger:alpha 场景使用 alpha-cli。'
  ];
  for (const category of protectedCategories) {
    lines.push(`|${category}:keep`);
  }
  for (const [category, value] of Object.entries(extraCategories)) {
    lines.push(`|${category}:${value}`);
  }
  return `${lines.join('\n')}\n`;
}

function writeFixture({agentsBody, skills = [{name: 'alpha-cli', withPrompt: true}], docsRows, ignore = '/docs/plan/\n/openspec/changes/\n', files = {}}) {
  fs.rmSync(fixtureRoot, {recursive: true, force: true});
  fs.mkdirSync(path.join(fixtureRoot, 'docs'), {recursive: true});
  fs.writeFileSync(path.join(fixtureRoot, 'AGENTS.md'), agentsBody, 'utf8');
  fs.writeFileSync(path.join(fixtureRoot, '.gitignore'), ignore, 'utf8');
  fs.mkdirSync(path.dirname(fixtureChecker), {recursive: true});
  fs.writeFileSync(fixtureChecker, checkerSource, 'utf8');
  const runtime = path.join(fixtureRoot, 'tools', 'lib', 'skill_runtime.mjs');
  fs.mkdirSync(path.dirname(runtime), {recursive: true});
  fs.copyFileSync(path.join(repoRoot, 'tools', 'lib', 'skill_runtime.mjs'), runtime);
  for (const [file, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(fixtureRoot, file)), {recursive: true});
    fs.writeFileSync(path.join(fixtureRoot, file), body, 'utf8');
  }
  const init = spawnSync('git', ['init', '--quiet'], {cwd: fixtureRoot, encoding: 'utf8'});
  if (init.error || init.status !== 0) throw new Error(`fixture git init failed: ${init.error?.message || init.stderr}`);
  for (const skill of skills) {
    const dir = path.join(fixtureRoot, 'skills', skill.name, 'agents');
    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(
      path.join(fixtureRoot, 'skills', skill.name, 'SKILL.md'),
      `---\nname: ${skill.name}\n---\n\n# ${skill.name}\n`,
      'utf8'
    );
    fs.writeFileSync(
      path.join(dir, 'openai.yaml'),
      skill.withPrompt
        ? `interface:\n  display_name: "${skill.name}"\n  short_description: "test"\n  default_prompt: "使用 $${skill.name} 执行任务。"\n`
        : 'interface:\n  display_name: "no variable"\n  short_description: "test"\n  default_prompt: "missing prompt variable"\n',
      'utf8'
    );
  }
  const rows = docsRows ?? skills.map((skill) => `| \`${skill.name}\` | test | test |`);
  fs.writeFileSync(path.join(fixtureRoot, 'docs', 'SKILLS.md'), `${rows.join('\n')}\n`, 'utf8');
}

function runChecker(skipRefs = true) {
  const args = [
    fixtureChecker,
    'check',
    '--agents',
    path.join(fixtureRoot, 'AGENTS.md'),
    '--skills-dir',
    path.join(fixtureRoot, 'skills'),
    '--docs',
    path.join(fixtureRoot, 'docs', 'SKILLS.md')
  ];
  if (skipRefs) args.push('--skip-refs');
  return spawnSync(process.execPath, args, {encoding: 'utf8'});
}

const results = [];

function assertCase(name, fixture, matcher, skipRefs = true) {
  writeFixture(fixture);
  const run = runChecker(skipRefs);
  const output = `${run.stdout}${run.stderr}`;
  const ok = Boolean(matcher(run.status, output));
  results.push({name, ok});
  console.log(`${ok ? '[PASS]' : '[FAIL]'} ${name} (exit=${run.status})`);
  if (!ok) {
    console.log(output.trim());
  }
}

assertCase('valid AGENTS passes', {agentsBody: validAgents()}, (status) => status === 0);

assertCase(
  'duplicate category fails',
  {agentsBody: `${validAgents()}|Duplicate:value\n|Duplicate:value2\n`},
  (status, output) => status === 1 && output.includes('category 重复')
);

assertCase(
  'missing protected category fails',
  {agentsBody: validAgents().replace(`|${protectedCategories[0]}:keep\n`, '')},
  (status, output) => status === 1 && output.includes('受保护类别缺失')
);

assertCase(
  'undeclared skill dir fails',
  {
    agentsBody: validAgents(),
    skills: [
      {name: 'alpha-cli', withPrompt: true},
      {name: 'beta-cli', withPrompt: true}
    ]
  },
  (status, output) => status === 1 && output.includes('未写入 Local Skills')
);

assertCase(
  'missing $name in openai.yaml fails',
  {agentsBody: validAgents(), skills: [{name: 'alpha-cli', withPrompt: false}]},
  (status, output) => status === 1 && output.includes('default_prompt 必须包含')
);

assertCase(
  'bad first line fails',
  {agentsBody: `# agents\n${validAgents().split('\n').slice(1).join('\n')}`},
  (status, output) => status === 1 && output.includes('第 1 行必须是')
);

assertCase(
  'docs row for missing skill fails',
  {agentsBody: validAgents(), docsRows: ['| `alpha-cli` | test | test |', '| `ghost-cli` | test | test |']},
  (status, output) => status === 1 && output.includes('在 skills/ 下不存在')
);

// Path traversal must fail instead of being silently skipped.
writeFixture({
  agentsBody: validAgents({'Path Ref': '`../outside.md`'})
});
const escapedPathRun = runChecker(false);
const escapedPathOutput = `${escapedPathRun.stdout}${escapedPathRun.stderr}`;
const escapedPathOk = escapedPathRun.status === 1 && escapedPathOutput.includes('逃逸仓库根目录');
results.push({name: 'path traversal fails', ok: escapedPathOk});
console.log(`${escapedPathOk ? '[PASS]' : '[FAIL]'} path traversal fails (exit=${escapedPathRun.status})`);
if (!escapedPathOk) {
  console.log(escapedPathOutput.trim());
}

assertCase(
  'absent ignored local plan directories pass',
  {agentsBody: validAgents({'Path Ref': '`docs/plan/` and `openspec/changes/`'})},
  (status, output) => status === 0 && output.includes('creation optional'),
  false
);
assertCase(
  'existing ignored local plans are preserved',
  {agentsBody: validAgents({'Path Ref': '`docs/plan/`'}), files: {'docs/plan/future.md': '# local plan\n'}},
  (status) => status === 0 && fs.readFileSync(path.join(fixtureRoot, 'docs/plan/future.md'), 'utf8') === '# local plan\n',
  false
);
assertCase(
  'local plan directory without ignore policy fails',
  {agentsBody: validAgents({'Path Ref': '`docs/plan/`'}), ignore: ''},
  (status, output) => status === 1 && output.includes('必须由 Git 忽略'),
  false
);
assertCase(
  'ignoring only a probe file does not ignore the plan directory',
  {agentsBody: validAgents({'Path Ref': '`docs/plan/`'}), ignore: '/docs/plan/__local_plan_probe__\n'},
  (status, output) => status === 1 && output.includes('必须由 Git 忽略'),
  false
);
assertCase(
  'missing concrete document still fails',
  {agentsBody: validAgents({'Path Ref': '`docs/plan/missing.md`'})},
  (status, output) => status === 1 && output.includes('引用的路径不存在'),
  false
);
assertCase(
  'nested path traversal fails',
  {agentsBody: validAgents({'Path Ref': '`docs/../../outside.md`'})},
  (status, output) => status === 1 && output.includes('逃逸仓库根目录'),
  false
);

const failed = results.filter((item) => !item.ok);
console.log(`[agents-check-test] ${failed.length === 0 ? 'pass' : 'fail'} (${results.length - failed.length}/${results.length})`);
console.log(`[agents-check-test] fixture root: ${fixtureRoot}`);
process.exit(failed.length === 0 ? 0 : 1);
