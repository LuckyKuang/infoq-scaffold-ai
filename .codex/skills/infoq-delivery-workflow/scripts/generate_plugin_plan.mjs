#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeForwardedArgs, resolveDocTmpDir, resolveRepoRoot} from '../../../lib/skill_runtime.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(scriptDir);
const docTmpDir = resolveDocTmpDir(repoRoot);
const args = normalizeForwardedArgs(process.argv.slice(2));

let pluginName = '';
let pluginClass = '';
let needsFrontend = 'auto';
let outFile = '';

function usage() {
  console.log(`Usage:
  node .codex/skills/infoq-delivery-workflow/scripts/generate_plugin_plan.mjs --name <infoq-plugin-xxx> --class <fixed|reusable|toggle> [--frontend <none|vue|react|both|auto>] [--out <file>]

Examples:
  node .codex/skills/infoq-delivery-workflow/scripts/generate_plugin_plan.mjs --name infoq-plugin-audit --class reusable
  node .codex/skills/infoq-delivery-workflow/scripts/generate_plugin_plan.mjs --name infoq-plugin-sse --class toggle --frontend both --out doc/tmp/plugin-plan.md
`);
}

function readValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  switch (arg) {
    case '--name':
      pluginName = readValue(args, index, arg);
      index += 1;
      break;
    case '--class':
      pluginClass = readValue(args, index, arg);
      index += 1;
      break;
    case '--frontend':
      needsFrontend = readValue(args, index, arg);
      index += 1;
      break;
    case '--out':
      outFile = readValue(args, index, arg);
      index += 1;
      break;
    case '-h':
    case '--help':
      usage();
      process.exit(0);
      break;
    default:
      console.error(`Unknown argument: ${arg}`);
      usage();
      process.exit(1);
  }
}

if (!pluginName || !pluginClass) {
  console.error('Error: --name and --class are required.');
  usage();
  process.exit(1);
}

if (!['fixed', 'reusable', 'toggle'].includes(pluginClass)) {
  console.error('Error: --class must be one of fixed|reusable|toggle.');
  process.exit(1);
}

if (!['none', 'vue', 'react', 'both', 'auto'].includes(needsFrontend)) {
  console.error('Error: --frontend must be one of none|vue|react|both|auto.');
  process.exit(1);
}

function renderClassNote() {
  switch (pluginClass) {
    case 'fixed':
      return '- `fixed`：基座固定保留。目标是稳定接入，不做运行时开关。';
    case 'reusable':
      return '- `reusable`：通用能力插件。目标是模块按需依赖，保持接口通用与低耦合。';
    default:
      return '- `toggle`：可配置软关闭插件。目标是保留依赖，默认 `enabled=false`，按配置启停。';
  }
}

function renderConfigNote() {
  switch (pluginClass) {
    case 'fixed':
      return `### 配置策略
- 不新增 \`enabled\` 开关（除非有明确运维要求）。
- 避免在业务模块硬编码插件内部实现细节。`;
    case 'reusable':
      return `### 配置策略
- 插件保持通用 API（注解/接口/facade）。
- 由业务模块在各自 \`pom.xml\` 按需引入，不强制全局启用。`;
    default:
      return `### 配置策略
- 后端新增并默认关闭开关（示例：\`xxx.enabled=false\`）。
- 若涉及前端运行时行为，增加 \`VITE_APP_XXX=false\` 并做逻辑门控。`;
  }
}

function renderFrontendNote() {
  switch (needsFrontend) {
    case 'none':
      return `### 前端联动
- 本次标记为不需要前端开关。`;
    case 'vue':
      return `### 前端联动
- 需要补充 Vue 前端环境变量：
  - \`infoq-scaffold-frontend-vue/.env.development\`
  - \`infoq-scaffold-frontend-vue/.env.production\`
- 在 Vue 启动/请求链路中以 env 开关控制逻辑，关闭时走兼容分支。`;
    case 'react':
      return `### 前端联动
- 需要补充 React 前端环境变量：
  - \`infoq-scaffold-frontend-react/.env.development\`
  - \`infoq-scaffold-frontend-react/.env.production\`
- 在 React 启动/请求链路中以 env 开关控制逻辑，关闭时走兼容分支。`;
    case 'both':
      return `### 前端联动
- 需要补充双前端环境变量：
  - \`infoq-scaffold-frontend-vue/.env.development\`
  - \`infoq-scaffold-frontend-vue/.env.production\`
  - \`infoq-scaffold-frontend-react/.env.development\`
  - \`infoq-scaffold-frontend-react/.env.production\`
- 在受影响的 Vue / React 启动或请求链路中分别以 env 开关控制逻辑，关闭时走兼容分支。`;
    default:
      return `### 前端联动
- \`auto\`：若插件涉及前端运行时通信或请求链路（如 encrypt/sse/websocket），则必须按受影响前端增加开关，不要默认只改 Vue。`;
  }
}

function renderValidationCommands() {
  switch (needsFrontend) {
    case 'none':
      return 'node .codex/scripts/backend_mvn.mjs -- clean package -P dev -pl infoq-modules/infoq-system -am';
    case 'vue':
      return `node .codex/scripts/backend_mvn.mjs -- clean package -P dev -pl infoq-modules/infoq-system -am
cd infoq-scaffold-frontend-vue && pnpm run build:prod`;
    case 'react':
      return `node .codex/scripts/backend_mvn.mjs -- clean package -P dev -pl infoq-modules/infoq-system -am
cd infoq-scaffold-frontend-react && pnpm run build:prod`;
    case 'both':
      return `node .codex/scripts/backend_mvn.mjs -- clean package -P dev -pl infoq-modules/infoq-system -am
cd infoq-scaffold-frontend-vue && pnpm run build:prod
cd infoq-scaffold-frontend-react && pnpm run build:prod`;
    default:
      return `node .codex/scripts/backend_mvn.mjs -- clean package -P dev -pl infoq-modules/infoq-system -am
# If frontend impact is confirmed, run the affected frontend build(s); if impact is ambiguous, run both.
cd infoq-scaffold-frontend-vue && pnpm run build:prod
cd infoq-scaffold-frontend-react && pnpm run build:prod`;
  }
}

const planContent = `# Plugin Onboarding Plan

## 输入
- 插件名：\`${pluginName}\`
- 分类：\`${pluginClass}\`
- 前端联动：\`${needsFrontend}\`

## 分类说明
${renderClassNote()}

## 后端改动清单
1. 模块注册：
   - \`infoq-scaffold-backend/infoq-plugin/pom.xml\` 增加 \`${pluginName}\` module。
2. 版本管理：
   - \`infoq-scaffold-backend/infoq-core/infoq-core-bom/pom.xml\` 增加版本属性/依赖管理。
3. 消费模块依赖：
   - 目标模块（通常 \`infoq-scaffold-backend/infoq-modules/infoq-system/pom.xml\`）按需引入。
4. 代码耦合控制：
   - 通过注解/接口/facade 暴露能力，避免业务直接依赖插件内部实现。
5. 文档归档：
   - 更新 \`doc/collaboration/plugin-catalog.md\`，标注插件分档与开关策略。

${renderConfigNote()}

${renderFrontendNote()}

## 验证命令
优先使用 \`pnpm\`；如果当前环境没有 \`pnpm\`，则回退为等价的 \`npm\` 命令。
\`\`\`bash
${renderValidationCommands()}
\`\`\`

## 验收标准
- 插件分档明确，后端接线位置清晰。
- 若涉及前端，受影响前端范围与 env 开关定义清晰。
- 验证命令与构建范围和插件分类一致。
`;

const outputPath = outFile
  ? path.resolve(repoRoot, outFile)
  : path.join(docTmpDir, `${pluginName}-plan.md`);

fs.mkdirSync(path.dirname(outputPath), {recursive: true});
fs.writeFileSync(outputPath, `${planContent}\n`, 'utf8');
console.log(outputPath);
