#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeForwardedArgs, resolveRepoRoot} from '../../../lib/skill_runtime.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(scriptDir);
const args = normalizeForwardedArgs(process.argv.slice(2));

function usage() {
  console.log('Usage: node .codex/skills/infoq-delivery-workflow/scripts/init_change_dir.mjs <change-id>');
}

if (args.includes('-h') || args.includes('--help')) {
  usage();
  process.exit(0);
}

if (args.length !== 1) {
  usage();
  process.exit(1);
}

const [changeId] = args;

if (!/^[a-z0-9][a-z0-9-]*$/.test(changeId)) {
  console.error(`Invalid change-id: ${changeId}`);
  console.error('change-id must match: /^[a-z0-9][a-z0-9-]*$/');
  usage();
  process.exit(1);
}

const changeDir = path.join(repoRoot, 'openspec', 'changes', changeId);
const specDir = path.join(changeDir, 'specs');

fs.mkdirSync(specDir, {recursive: true});

function createIfMissing(targetPath, content) {
  if (fs.existsSync(targetPath)) {
    return;
  }
  fs.writeFileSync(targetPath, content, 'utf8');
}

createIfMissing(path.join(changeDir, 'proposal.md'), `# Proposal: ${changeId}

## 背景

## 问题陈述

## 目标与成功指标

- 成功指标 1：
- 成功指标 2：

## 变更内容

### 用户故事

- 作为：
- 我希望：
- 以便：

### 范围

- 

### 非目标

- 

### 约束

- 

## 验收约定

- 功能范围：
- 非目标：
- 异常处理与阻塞：
- 必需日志/验证证据：
- 回滚触发条件：

## 延期范围

- 无；若后续确认延期范围，请显式记录在此。

## 风险与待确认

- 
`);

createIfMissing(path.join(changeDir, 'tasks.md'), `# Tasks: ${changeId}

## 交付概览

- [ ] 明确本次 change 的主交付物与退出条件

## 影响矩阵

- [ ] infoq-scaffold-backend：
- [ ] infoq-scaffold-frontend-react：
- [ ] infoq-scaffold-frontend-vue：
- [ ] infoq-scaffold-frontend-weapp-react：
- [ ] infoq-scaffold-frontend-weapp-vue：
- [ ] infoq-scaffold-docs：
- [ ] script / deploy：

## 实施任务

### 规格与方案

- [ ] 完成 \`proposal.md\`、\`tasks.md\` 与必要 spec delta
- [ ] 如存在重大技术或 UI 决策，补 \`design.md\`

### 实现

- [ ] 按影响矩阵逐项实现或显式记录“不受影响原因”

## 验证映射

### 主流程验证

- [ ] 记录主流程步骤、预期结果与留证方式

### 定向测试

- [ ] 记录受影响工作区的定向测试命令或 blocker

### lint / build

- [ ] 记录受影响工作区的 lint / build 命令或 blocker

### 差异审查

- [ ] 审核 diff、计划文件、active change 和 stable specs 是否一致

## 延期范围

- [ ] 无；若本轮显式延期，请在此记录

## 阻塞与残余风险

- [ ] 无；若验证受阻或有残余风险，请在此记录
`);

console.log(`Initialized ${path.relative(repoRoot, changeDir)}`);
