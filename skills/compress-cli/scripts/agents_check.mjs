#!/usr/bin/env node
// 只读校验器：仓库根 AGENTS.md 的格式、受保护类别、路由一致性与引用路径存在性。
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {normalizeForwardedArgs, resolveRepoRoot} from '../../../tools/lib/skill_runtime.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(scriptDir);
const args = normalizeForwardedArgs(process.argv.slice(2));

const PROTECTED_CATEGORIES = [
  'Security And Validation',
  'Failure Policy',
  'Root Cause Fix Policy',
  'Redisson OSS Policy',
  'SQL Migration Policy',
  'Release Guardrails',
  'Acceptance Contract',
  'Execution Loop',
  'Spec Workflow',
  'Repo Skill Policy',
  'Skill Runtime Policy',
  'Encoding Gate',
  'Docs Sync',
  'MCP Config Truth'
];

const ALLOWED_PATH_PREFIXES = [
  'tools/',
  'docs/',
  'deploy/',
  'skills/',
  'sql/',
  'openspec/',
  '.codex/',
  'tmp/',
  'backend/',
  'frontend-vue/',
  'frontend-react/',
  'README.md',
  'README_CN.md',
  'README_JA.md',
  'README_ZH_TW.md',
  'AGENTS.md',
  'DEV_GUIDE.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'Makefile'
];

const SKIP_PATH_PATTERNS = [/[*<>{}]/, /YYYYMMDD/, /YYYY-MM-DD/, /x\.y\.z/, /\.\.\./, /\s/, /^https?:/];
const LOCAL_PLAN_DIRS = new Set(['docs/plan/', 'openspec/changes/']);
const localPlanDirs = new Set();

function usage() {
  console.log(`Usage: node skills/compress-cli/scripts/agents_check.mjs <check|budget> [options]

Options:
  --agents <file>       Path to AGENTS.md. Default: <repo>/AGENTS.md
  --skills-dir <dir>    Path to skills directory. Default: <repo>/skills
  --docs <file>         Path to docs/SKILLS.md. Default: <repo>/docs/SKILLS.md
  --json                Print machine-readable JSON summary
  --skip-refs           Skip reference-path checks (fixture diagnostics only)
  -h, --help            Show this help

Local plan directories docs/plan/ and openspec/changes/ may be absent,
but must be Git-ignored; other concrete references must exist.
Exit code 0 = all contracts pass, 1 = failure (never silently passes).`);
}

function fail(errors, message) {
  errors.push(message);
}

function readOption(index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`missing value for ${flag}`);
  }
  return value;
}

let command = '';
let agentsPath = path.join(repoRoot, 'AGENTS.md');
let skillsDir = path.join(repoRoot, 'skills');
let docsPath = path.join(repoRoot, 'docs', 'SKILLS.md');
let asJson = false;
let skipRefsFlag = false;

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '-h' || arg === '--help') {
    usage();
    process.exit(0);
  }
  if (arg === '--json') {
    asJson = true;
    continue;
  }
  if (arg === '--skip-refs') {
    skipRefsFlag = true;
    continue;
  }
  if (arg === '--agents' || arg === '--skills-dir' || arg === '--docs') {
    const value = readOption(index, arg);
    if (arg === '--agents') {
      agentsPath = path.resolve(value);
    } else if (arg === '--skills-dir') {
      skillsDir = path.resolve(value);
    } else {
      docsPath = path.resolve(value);
    }
    index += 1;
    continue;
  }
  if (!command) {
    command = arg;
    continue;
  }
  throw new Error(`unexpected argument: ${arg}`);
}

if (!command) {
  usage();
  process.exit(1);
}

if (!['check', 'budget'].includes(command)) {
  throw new Error(`unknown command: ${command}`);
}

if (!fs.existsSync(agentsPath)) {
  throw new Error(`AGENTS.md not found: ${agentsPath}`);
}

const agentsText = fs.readFileSync(agentsPath, 'utf8');

const errors = [];
const lines = agentsText.split('\n');

function parseCategories() {
  const categories = [];
  const seen = new Map();
  lines.forEach((line, index) => {
    const lineNo = index + 1;
    if (line.trim() === '') {
      return;
    }
    if (lineNo === 1) {
      if (line !== '# AGENTS.md') {
        fail(errors, `第 1 行必须是 \`# AGENTS.md\`，实际为：${line.slice(0, 40)}`);
      }
      return;
    }
    if (!line.startsWith('|')) {
      fail(errors, `第 ${lineNo} 行不是 \`|Category:value\` 格式：${line.slice(0, 60)}`);
      return;
    }
    const match = line.match(/^\|([^:|]+):(.*)$/);
    if (!match) {
      fail(errors, `第 ${lineNo} 行缺少 category 或 value 分隔符`);
      return;
    }
    const category = match[1];
    const value = match[2];
    if (!category.trim()) {
      fail(errors, `第 ${lineNo} 行 category 为空`);
    }
    if (!value.trim()) {
      fail(errors, `第 ${lineNo} 行 value 为空`);
    }
    if (line !== line.replace(/\s+$/, '')) {
      fail(errors, `第 ${lineNo} 行存在行尾空白`);
    }
    if (seen.has(category)) {
      fail(errors, `category 重复：${category}（第 ${seen.get(category)} 行与第 ${lineNo} 行）`);
    } else {
      seen.set(category, lineNo);
    }
    categories.push({category, value, lineNo, length: line.length});
  });
  return {categories, seen};
}

function valueOf(categories, category) {
  const hit = categories.find((entry) => entry.category === category);
  return hit ? hit.value : '';
}

function listSkillDirs() {
  if (!fs.existsSync(skillsDir)) {
    fail(errors, `skills 目录不存在：${skillsDir}`);
    return [];
  }
  return fs
    .readdirSync(skillsDir, {withFileTypes: true})
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function parseDeclaredSkills(localSkillsValue) {
  const match = localSkillsValue.match(/\{([^}]*)\}/);
  if (!match) {
    fail(errors, 'Local Skills 行缺少 `{...}` 列表');
    return [];
  }
  return match[1]
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseDocsSkills() {
  if (!fs.existsSync(docsPath)) {
    fail(errors, `docs skill 表不存在：${docsPath}`);
    return [];
  }
  const text = fs.readFileSync(docsPath, 'utf8');
  const names = new Set();
  for (const match of text.matchAll(/^\|\s*`([a-z0-9][a-z0-9-]*-cli)`/gm)) {
    names.add(match[1]);
  }
  return [...names].sort();
}

function checkSkillStructure(dirNames) {
  for (const name of dirNames) {
    const dir = path.join(skillsDir, name);
    const skillFile = path.join(dir, 'SKILL.md');
    const metaFile = path.join(dir, 'agents', 'openai.yaml');
    if (!fs.existsSync(skillFile)) {
      fail(errors, `${name} 缺少 SKILL.md`);
    }
    if (!fs.existsSync(metaFile)) {
      fail(errors, `${name} 缺少 agents/openai.yaml`);
      continue;
    }
    const meta = fs.readFileSync(metaFile, 'utf8');
    if (!meta.includes(`$${name}`)) {
      fail(errors, `${name}/agents/openai.yaml 的 default_prompt 必须包含 $${name}`);
    }
  }
}

function checkRouting(categories, dirNames) {
  const declared = parseDeclaredSkills(valueOf(categories, 'Local Skills'));
  const docsSkills = parseDocsSkills();
  const mentioned = new Set();
  for (const category of ['Skill Trigger', 'Skill Priority']) {
    for (const match of valueOf(categories, category).matchAll(/\b[a-z0-9][a-z0-9-]*-cli\b/g)) {
      mentioned.add(match[0]);
    }
  }
  const dirSet = new Set(dirNames);
  for (const name of declared) {
    if (!dirSet.has(name)) {
      fail(errors, `Local Skills 声明的 ${name} 在 skills/ 下不存在`);
    }
  }
  for (const name of dirNames) {
    if (!declared.includes(name)) {
      fail(errors, `skills/${name} 已存在但未写入 Local Skills`);
    }
    if (!docsSkills.includes(name)) {
      fail(errors, `skills/${name} 未收录进 docs/SKILLS.md 关键 skills 表`);
    }
  }
  for (const name of docsSkills) {
    if (!dirSet.has(name)) {
      fail(errors, `docs/SKILLS.md 收录的 ${name} 在 skills/ 下不存在`);
    }
  }
  for (const name of mentioned) {
    if (!dirSet.has(name)) {
      fail(errors, `Skill Trigger/Skill Priority 引用了不存在的 ${name}`);
    }
  }
  return {declared, docsSkills, mentioned: [...mentioned].sort()};
}

function checkProtectedCategories(categories) {
  const present = new Set(categories.map((entry) => entry.category));
  for (const required of PROTECTED_CATEGORIES) {
    if (!present.has(required)) {
      fail(errors, `受保护类别缺失：${required}`);
    }
  }
}

function checkReferencedPaths(skipRefs) {
  if (skipRefs) {
    return [];
  }
  const checked = [];
  for (const match of agentsText.matchAll(/`([^`]+)`/g)) {
    const token = match[1];
    if (token.startsWith('../') || token.startsWith('..\\')) {
      fail(errors, `AGENTS.md 引用的路径逃逸仓库根目录：${token}`);
      continue;
    }
    if (!ALLOWED_PATH_PREFIXES.some((prefix) => token.startsWith(prefix))) {
      continue;
    }
    if (SKIP_PATH_PATTERNS.some((pattern) => pattern.test(token))) {
      continue;
    }
    const referencedPath = path.resolve(repoRoot, token.replaceAll('\\', '/'));
    const relativePath = path.relative(repoRoot, referencedPath);
    if (relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
      fail(errors, `AGENTS.md 引用的路径逃逸仓库根目录：${token}`);
      continue;
    }
    checked.push(token);
    if (LOCAL_PLAN_DIRS.has(token)) {
      const ignored = spawnSync('git', ['check-ignore', '--no-index', '--quiet', '--', token], {
        cwd: repoRoot,
        encoding: 'utf8',
        windowsHide: true
      });
      if (ignored.error || ignored.status !== 0) {
        fail(errors, `本地计划目录必须由 Git 忽略：${token}${ignored.error ? `（${ignored.error.message}）` : ignored.stderr ? `（${ignored.stderr.trim()}）` : ''}`);
      }
      if (fs.existsSync(referencedPath) && !fs.statSync(referencedPath).isDirectory()) {
        fail(errors, `本地计划路径必须是目录：${token}`);
      }
      localPlanDirs.add(token);
      continue;
    }
    if (!fs.existsSync(referencedPath)) {
      fail(errors, `AGENTS.md 引用的路径不存在：${token}`);
    }
  }
  return checked;
}

const skipRefs = skipRefsFlag || args.includes('--skip-refs');

const {categories} = parseCategories();
const dirNames = listSkillDirs();
const routing = checkRouting(categories, dirNames);
checkSkillStructure(dirNames);
checkProtectedCategories(categories);
const checkedPaths = checkReferencedPaths(skipRefs);

function buildBudget() {
  const topValueLengths = categories
    .map((entry) => ({category: entry.category, length: entry.length}))
    .sort((a, b) => b.length - a.length)
    .slice(0, 5);
  const longCategories = categories.filter((entry) => entry.length > 400).map((entry) => entry.category);
  const valueMap = new Map();
  for (const entry of categories) {
    const key = entry.value.trim();
    if (!key) {
      continue;
    }
    valueMap.set(key, [...(valueMap.get(key) ?? []), entry.category]);
  }
  const duplicateValues = [...valueMap.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([value, list]) => ({categories: list, sample: value.slice(0, 60)}));
  return {
    agents: path.relative(repoRoot, agentsPath).split(path.sep).join('/'),
    lines: lines.length,
    nonEmptyLines: lines.filter((line) => line.trim() !== '').length,
    bytes: Buffer.byteLength(agentsText, 'utf8'),
    categories: categories.length,
    topValueLengths,
    longCategories,
    duplicateValues
  };
}

const report =
  command === 'budget'
    ? {command, ok: errors.length === 0, budget: buildBudget(), errors}
    : {
        command,
        ok: errors.length === 0,
        agents: path.relative(repoRoot, agentsPath).split(path.sep).join('/'),
        declared: routing.declared,
        docsSkills: routing.docsSkills,
        mentioned: routing.mentioned,
        skillDirs: dirNames,
        checkedPaths: checkedPaths.length,
        localPlanDirs: [...localPlanDirs].sort(),
        errors
      };

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else if (command === 'budget') {
  const budget = report.budget;
  console.log(`[agents-budget] ${budget.agents}`);
  console.log(`  lines=${budget.lines} nonEmpty=${budget.nonEmptyLines} bytes=${budget.bytes} categories=${budget.categories}`);
  console.log('  top value lengths:');
  for (const entry of budget.topValueLengths) {
    console.log(`    - ${entry.category}: ${entry.length}`);
  }
  console.log(`  lines > 400 chars: ${budget.longCategories.length ? budget.longCategories.join(', ') : 'none'}`);
  console.log(`  duplicate values: ${budget.duplicateValues.length ? budget.duplicateValues.map((item) => item.categories.join('/')).join('; ') : 'none'}`);
} else if (errors.length === 0) {
  console.log(`[agents-check] PASS ${report.agents}`);
  console.log(`  skills=${report.skillDirs.length} declared=${report.declared.length} docsSkills=${report.docsSkills.length} mentioned=${report.mentioned.length} referencedPaths=${report.checkedPaths}`);
  if (report.localPlanDirs.length) console.log(`  Git-ignored local plan directories (creation optional): ${report.localPlanDirs.join(', ')}`);
} else {
  console.error(`[agents-check] FAIL ${report.agents}`);
  for (const item of errors) {
    console.error(`  - ${item}`);
  }
}

process.exit(errors.length === 0 ? 0 : 1);


