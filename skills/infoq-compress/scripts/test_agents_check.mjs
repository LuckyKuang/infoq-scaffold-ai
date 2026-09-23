#!/usr/bin/env node
// infoq-compress 校验器回归测试：用 tmp/ 下的 fixture 仓库验证通过/失败语义。
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..', '..');
const fixtureRoot = path.join(repoRoot, 'tmp', 'infoq-compress', `fixture-${Date.now()}`);
const checker = path.join(scriptDir, 'agents_check.mjs');

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
    '|Local Skills:skills:{infoq-alpha}',
    '|Skill Priority:alpha 工作使用 infoq-alpha。',
    '|Skill Trigger:alpha 场景使用 infoq-alpha。'
  ];
  for (const category of protectedCategories) {
    lines.push(`|${category}:keep`);
  }
  for (const [category, value] of Object.entries(extraCategories)) {
    lines.push(`|${category}:${value}`);
  }
  return `${lines.join('\n')}\n`;
}

function writeFixture({agentsBody, skills = [{name: 'infoq-alpha', withPrompt: true}], docsRows}) {
  fs.rmSync(fixtureRoot, {recursive: true, force: true});
  fs.mkdirSync(path.join(fixtureRoot, 'docs'), {recursive: true});
  fs.writeFileSync(path.join(fixtureRoot, 'AGENTS.md'), agentsBody, 'utf8');
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

function runChecker() {
  return spawnSync(
    process.execPath,
    [
      checker,
      'check',
      '--agents',
      path.join(fixtureRoot, 'AGENTS.md'),
      '--skills-dir',
      path.join(fixtureRoot, 'skills'),
      '--docs',
      path.join(fixtureRoot, 'docs', 'SKILLS.md'),
      '--skip-refs'
    ],
    {encoding: 'utf8'}
  );
}

const results = [];

function assertCase(name, fixture, matcher) {
  writeFixture(fixture);
  const run = runChecker();
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
      {name: 'infoq-alpha', withPrompt: true},
      {name: 'infoq-beta', withPrompt: true}
    ]
  },
  (status, output) => status === 1 && output.includes('未写入 Local Skills')
);

assertCase(
  'missing $name in openai.yaml fails',
  {agentsBody: validAgents(), skills: [{name: 'infoq-alpha', withPrompt: false}]},
  (status, output) => status === 1 && output.includes('default_prompt 必须包含')
);

assertCase(
  'bad first line fails',
  {agentsBody: `# agents\n${validAgents().split('\n').slice(1).join('\n')}`},
  (status, output) => status === 1 && output.includes('第 1 行必须是')
);

assertCase(
  'docs row for missing skill fails',
  {agentsBody: validAgents(), docsRows: ['| `infoq-alpha` | test | test |', '| `infoq-ghost` | test | test |']},
  (status, output) => status === 1 && output.includes('在 skills/ 下不存在')
);

const failed = results.filter((item) => !item.ok);
console.log(`[agents-check-test] ${failed.length === 0 ? 'pass' : 'fail'} (${results.length - failed.length}/${results.length})`);
console.log(`[agents-check-test] fixture root: ${fixtureRoot}`);
process.exit(failed.length === 0 ? 0 : 1);
