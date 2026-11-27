#!/usr/bin/env node
// 只读台账：收集代码中的 shortcut: 标记，标出缺少升级触发条件的条目。
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {normalizeForwardedArgs, resolveRepoRoot} from './lib/skill_runtime.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const args = normalizeForwardedArgs(process.argv.slice(2));

// 前置引号排除字符串字面量里的伪注释；git grep 不做语法解析。
const MARKER_RE = /(?<!['"`])(?:#|\/\/|\/\*|<!--)\s*(shortcut|ponytail):\s*(.*)$/u;
// 块注释续行形如 " * shortcut: ..."，只允许出现在行首。
const BLOCK_LINE_RE = /^\s*\*\s*(shortcut|ponytail):\s*(.*)$/u;
const TRIGGER_SEPARATOR = /[,;，；]/u;
const SKIPPED_EXTENSIONS = new Set(['.md', '.mdx']);

function usage() {
  console.log(`Usage: node tools/check_shortcut_debt.mjs [options]

Options:
  --root <dir>   Git 仓库根目录。默认：本脚本所在仓库
  --json         输出机器可读 JSON
  --strict       存在缺少升级触发条件的标记时以非零退出码失败
  -h, --help     显示帮助

约定：临时妥协写成 shortcut: <上限>, <升级触发>。
只读扫描，不修改任何文件。`);
}

if (args.includes('-h') || args.includes('--help')) {
  usage();
  process.exit(0);
}

function readOption(index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} 缺少参数值`);
  }
  return value;
}

let rootArg = '';
let asJson = false;
let strict = false;

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--root') {
    rootArg = readOption(index, arg);
    index += 1;
    continue;
  }
  if (arg === '--json') {
    asJson = true;
    continue;
  }
  if (arg === '--strict') {
    strict = true;
    continue;
  }
  throw new Error(`unexpected argument: ${arg}`);
}

const repoRoot = rootArg ? path.resolve(rootArg) : resolveRepoRoot(scriptDir);
if (!fs.existsSync(repoRoot)) {
  throw new Error(`仓库根目录不存在：${repoRoot}`);
}
if (!fs.existsSync(path.join(repoRoot, '.git'))) {
  throw new Error(`不是 Git 仓库：${repoRoot}`);
}

function grepMarkers() {
  const grepArgs = ['-C', repoRoot, 'grep', '--no-index', '--exclude-standard', '-n', '-I', '-E', '(shortcut|ponytail):'];
  try {
    return execFileSync('git', grepArgs, {encoding: 'utf8', maxBuffer: 32 * 1024 * 1024});
  } catch (error) {
    if (error.status === 1) {
      return '';
    }
    throw new Error(`git grep 失败：${error.stderr?.trim() || error.message}`);
  }
}

function parseEntry(line) {
  const match = /^(.+?):(\d+):(.*)$/u.exec(line);
  if (!match) {
    return null;
  }
  const [, file, lineNo, content] = match;
  if (SKIPPED_EXTENSIONS.has(path.extname(file).toLowerCase())) {
    return null;
  }
  const marker = MARKER_RE.exec(content) ?? BLOCK_LINE_RE.exec(content);
  if (!marker) {
    return null;
  }
  const remainder = marker[2].trim();
  const separator = TRIGGER_SEPARATOR.exec(remainder);
  const summary = separator ? remainder.slice(0, separator.index).trim() : remainder;
  const trigger = separator ? remainder.slice(separator.index + 1).trim() : '';
  return {
    file,
    line: Number(lineNo),
    marker: marker[1],
    summary,
    trigger: trigger || null
  };
}

const entries = grepMarkers()
  .split(/\r?\n/u)
  .filter(Boolean)
  .map(parseEntry)
  .filter(Boolean)
  .sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line);

const withoutTrigger = entries.filter((entry) => !entry.trigger);
const report = {root: repoRoot, total: entries.length, withoutTrigger: withoutTrigger.length, entries};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else if (entries.length === 0) {
  console.log('[shortcut-debt] No shortcut debt. Clean ledger.');
} else {
  console.log(`[shortcut-debt] ${entries.length} markers, ${withoutTrigger.length} with no trigger`);
  for (const entry of entries) {
    const trigger = entry.trigger ? `trigger: ${entry.trigger}` : '[no-trigger]';
    console.log(`  ${entry.file}:${entry.line}  ${entry.summary}  ${trigger}`);
  }
}

process.exit(strict && withoutTrigger.length > 0 ? 1 : 0);
