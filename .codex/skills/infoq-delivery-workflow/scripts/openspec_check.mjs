#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeForwardedArgs, resolveRepoRoot} from '../../../lib/skill_runtime.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(scriptDir);
const args = normalizeForwardedArgs(process.argv.slice(2));

function usage() {
  console.log('Usage: node .codex/skills/infoq-delivery-workflow/scripts/openspec_check.mjs <change-id|change-dir>');
}

if (args.includes('-h') || args.includes('--help')) {
  usage();
  process.exit(0);
}

if (args.length !== 1) {
  usage();
  process.exit(1);
}

const [input] = args;

function resolveChangeDir(changeInput) {
  const candidates = [];
  if (path.isAbsolute(changeInput)) {
    candidates.push(changeInput);
  } else {
    candidates.push(path.join(repoRoot, changeInput));
    candidates.push(path.join(repoRoot, 'openspec', 'changes', changeInput));
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return path.resolve(candidate);
    }
  }

  throw new Error(`Active change not found: ${changeInput}`);
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function hasHeading(text, heading) {
  return text.includes(heading);
}

function hasCheckbox(text) {
  return /- \[[ x]\]/u.test(text);
}

function pushMissing(errors, text, type, values) {
  values.forEach((value) => {
    if (!text.includes(value)) {
      errors.push(`${type} 缺少：${value}`);
    }
  });
}

function collectMarkdownFiles(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  const result = [];
  for (const entry of fs.readdirSync(dirPath, {withFileTypes: true})) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectMarkdownFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      result.push(fullPath);
    }
  }
  return result;
}

const requiredProposalSections = [
  '## 背景',
  '## 问题陈述',
  '## 目标与成功指标',
  '## 变更内容',
  '### 用户故事',
  '### 范围',
  '### 非目标',
  '### 约束',
  '## 验收约定',
  '## 延期范围',
  '## 风险与待确认'
];

const requiredContractRows = [
  '- 功能范围：',
  '- 非目标：',
  '- 异常处理与阻塞：',
  '- 必需日志/验证证据：',
  '- 回滚触发条件：'
];

const requiredTaskSections = [
  '## 交付概览',
  '## 影响矩阵',
  '## 实施任务',
  '## 验证映射',
  '### 主流程验证',
  '### 定向测试',
  '### lint / build',
  '### 差异审查',
  '## 延期范围',
  '## 阻塞与残余风险'
];

const requiredImpactRows = [
  'infoq-scaffold-backend',
  'infoq-scaffold-frontend-react',
  'infoq-scaffold-frontend-vue',
  'infoq-scaffold-frontend-weapp-react',
  'infoq-scaffold-frontend-weapp-vue',
  'infoq-scaffold-docs',
  'script / deploy'
];

const errors = [];
const warnings = [];

let changeDir = '';

try {
  changeDir = resolveChangeDir(input);
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}

const proposalPath = path.join(changeDir, 'proposal.md');
const tasksPath = path.join(changeDir, 'tasks.md');
const designPath = path.join(changeDir, 'design.md');
const specsDir = path.join(changeDir, 'specs');

if (!fs.existsSync(proposalPath)) {
  errors.push('缺少 proposal.md');
}
if (!fs.existsSync(tasksPath)) {
  errors.push('缺少 tasks.md');
}

let proposalText = '';
let tasksText = '';

if (fs.existsSync(proposalPath)) {
  proposalText = readUtf8(proposalPath);
  pushMissing(errors, proposalText, 'proposal.md 章节', requiredProposalSections);
  pushMissing(errors, proposalText, 'proposal.md 验收约定', requiredContractRows);
}

if (fs.existsSync(tasksPath)) {
  tasksText = readUtf8(tasksPath);
  pushMissing(errors, tasksText, 'tasks.md 章节', requiredTaskSections);
  pushMissing(errors, tasksText, 'tasks.md 影响矩阵', requiredImpactRows);
  if (!hasCheckbox(tasksText)) {
    errors.push('tasks.md 缺少 checklist 项');
  }
}

if (!fs.existsSync(designPath)) {
  warnings.push('未检测到 design.md；若本次变更存在长期技术或 UI 决策，应补充设计文档。');
}

const specDeltaFiles = collectMarkdownFiles(specsDir);
if (specDeltaFiles.length === 0) {
  warnings.push('未检测到 spec delta；若本次变更属于 L3 或涉及稳定行为修改，应补充 specs/.../spec.md。');
}

const relativeChangeDir = path.relative(repoRoot, changeDir).replace(/\\/g, '/');

if (errors.length > 0) {
  console.error(`OpenSpec check failed: ${relativeChangeDir}`);
  errors.forEach((item) => {
    console.error(`- ${item}`);
  });
  if (warnings.length > 0) {
    console.error('Warnings:');
    warnings.forEach((item) => {
      console.error(`- ${item}`);
    });
  }
  process.exit(1);
}

console.log(`OpenSpec check passed: ${relativeChangeDir}`);
if (warnings.length > 0) {
  console.log('Warnings:');
  warnings.forEach((item) => {
    console.log(`- ${item}`);
  });
}
