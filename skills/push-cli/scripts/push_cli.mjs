#!/usr/bin/env node
// push-cli：GitHub 推送、PR 创建/复用、校验轮询与受控合并。默认 dry-run，远程写操作必须显式确认。
import path from 'node:path';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {PROFILES, buildMatrix} from './push_matrix.mjs';
import {normalizeForwardedArgs, resolveRepoRoot} from '../../../tools/lib/skill_runtime.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(scriptDir);
const args = normalizeForwardedArgs(process.argv.slice(2));

function usage() {
  console.log(`Usage: node skills/push-cli/scripts/push_cli.mjs <command> [options]

Commands:
  ensure                     校验 gh 登录、仓库身份、默认分支与 git 传输配置
  status                     输出当前分支、脏文件、open PR 与默认分支落后情况
  check [--profile docs|ci|full]   运行本地校验矩阵（默认 docs）
  push [--dry-run] [--force-with-lease]
                             推送当前分支（拒绝默认分支、脏工作区与危险推送形式）
  submit-pr --message <msg> [--branch <name>] [--profile docs|ci|full] [--dry-run]
                             默认分支自动新建工作分支 -> 本地校验 -> 提交 -> 推送 -> 创建或复用 PR
  watch [--pr <number>] [--timeout-min <n>]
                             轮询 GitHub 校验；失败时输出失败 check 与日志摘要
  merge --pr <number> --yes [--method squash|merge|rebase]
                             校验全绿后合并 PR 到默认分支

Options:
  --dry-run       只打印将要执行的命令，不产生远程写入
  --json          以 JSON 输出结果摘要
  --yes           显式确认（merge 必需）
  --skip-check    submit-pr 时跳过本地校验矩阵（仅限已单独跑过 check 的场景）
  --no-watch      submit-pr 后不自动进入 watch
  -h, --help      显示帮助

Exit codes: 0 成功，1 失败（校验未通过、门禁未满足或远程操作失败）。`);
}

const EXPECTED_REMOTE_REPO = 'LuckyKuang/infoq-scaffold-ai';

function parseArgs(argv) {
  const options = {
    command: '',
    dryRun: false,
    json: false,
    yes: false,
    forceWithLease: false,
    profile: 'docs',
    message: '',
    branch: '',
    pr: '',
    method: 'squash',
    timeoutMin: 30,
    skipCheck: false,
    noWatch: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '-h' || arg === '--help') {
      usage();
      process.exit(0);
    }
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--yes') options.yes = true;
    else if (arg === '--force-with-lease') options.forceWithLease = true;
    else if (arg === '--skip-check') options.skipCheck = true;
    else if (arg === '--no-watch') options.noWatch = true;
    else if (arg === '--profile') options.profile = argv[++index];
    else if (arg === '--message') options.message = argv[++index];
    else if (arg === '--branch') options.branch = argv[++index];
    else if (arg === '--pr') options.pr = argv[++index];
    else if (arg === '--method') options.method = argv[++index];
    else if (arg === '--timeout-min') options.timeoutMin = Number(argv[++index]);
    else if (arg === '--repo') index += 1;
    else if (!options.command) options.command = arg;
    else throw new Error(`unexpected argument: ${arg}`);
  }
  if (!options.command) {
    usage();
    process.exit(1);
  }
  if (!['ensure', 'status', 'check', 'push', 'submit-pr', 'watch', 'merge'].includes(options.command)) {
    throw new Error(`unknown command: ${options.command}`);
  }
  if (!PROFILES.includes(options.profile)) {
    throw new Error(`unknown profile: ${options.profile}`);
  }
  return options;
}

const options = parseArgs(args);
const runId = `run-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`;
const evidenceDir = path.join(repoRoot, 'tmp', 'push-cli', runId);
const evidenceLog = path.join(evidenceDir, 'push.log');

function log(message) {
  console.log(message);
  fs.mkdirSync(evidenceDir, {recursive: true});
  fs.appendFileSync(evidenceLog, `${message}\n`, 'utf8');
}

function fail(message, code = 1) {
  console.error(`[push] FAIL ${message}`);
  fs.mkdirSync(evidenceDir, {recursive: true});
  fs.appendFileSync(evidenceLog, `[FAIL] ${message}\n`, 'utf8');
  process.exit(code);
}

function exec(command, commandArgs, {capture = true, allowFailure = false} = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit'
  });
  if (result.status !== 0 && !allowFailure) {
    const detail = `${command} ${commandArgs.join(' ')}`;
    fail(`${detail} 执行失败（exit=${result.status}）\n${(result.stderr || result.stdout || '').trim().slice(0, 2000)}`);
  }
  return result;
}

function ghJson(commandArgs, allowFailure = false) {
  const result = exec('gh', commandArgs, {allowFailure});
  if (result.status !== 0) {
    return null;
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    fail(`无法解析 gh 输出：${error.message}`);
    return null;
  }
}

function git(commandArgs, allowFailure = false) {
  return exec('git', commandArgs, {allowFailure});
}

function repoInfo() {
  const info = ghJson(['repo', 'view', '--json', 'nameWithOwner,defaultBranchRef,viewerPermission']);
  if (!info) {
    fail('无法读取 gh repo view；请确认 gh 已登录且当前目录 origin 可达');
  }
  if (info.nameWithOwner !== EXPECTED_REMOTE_REPO) {
    log(`[push] 注意：origin 仓库为 ${info.nameWithOwner}，期望 ${EXPECTED_REMOTE_REPO}`);
  }
  return info;
}

function currentBranch() {
  return git(['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
}

function worktreeEntries() {
  return git(['status', '--porcelain']).stdout.trim().split('\n').filter(Boolean);
}

function assertNoUnfinishedGitOp() {
  const gitDirRaw = git(['rev-parse', '--git-dir']).stdout.trim();
  const gitDir = path.resolve(repoRoot, gitDirRaw);
  for (const marker of ['MERGE_HEAD', 'REBASE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD']) {
    if (fs.existsSync(path.join(gitDir, marker))) {
      fail(`检测到未完成的 git 操作：${marker}，请先处理后再推送`);
    }
  }
}

function activeChangeIds() {
  const changesDir = path.join(repoRoot, 'openspec', 'changes');
  if (!fs.existsSync(changesDir)) {
    return [];
  }
  return fs
    .readdirSync(changesDir, {withFileTypes: true})
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(changesDir, entry.name, 'proposal.md')))
    .map((entry) => entry.name)
    .sort();
}

function runMatrix(profile) {
  const steps = [...buildMatrix(profile)];
  if (profile !== 'ci') {
    for (const changeId of activeChangeIds()) {
      steps.push({name: `openspec-check-${changeId}`, command: 'node', args: ['tools/openspec_check.mjs', changeId]});
    }
  }
  fs.mkdirSync(evidenceDir, {recursive: true});
  const failures = [];
  for (const step of steps) {
    const logFile = path.join(evidenceDir, `check-${step.name}.log`);
    const printable = `${step.command} ${step.args.join(' ')}`;
    log(`[push] check(${profile}) -> ${printable}`);
    const result = spawnSync(step.command, step.args, {cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
    fs.writeFileSync(logFile, `$ ${printable}\n\n${result.stdout ?? ''}${result.stderr ?? ''}\n`, 'utf8');
    if (result.status !== 0) {
      failures.push({name: step.name, command: printable, logFile, exit: result.status});
      log(`[push] check 失败：${step.name}（exit=${result.status}），日志：${path.relative(repoRoot, logFile)}`);
      continue;
    }
    log(`[push] check 通过：${step.name}`);
  }
  if (failures.length > 0) {
    for (const item of failures) {
      const excerpt = fs.readFileSync(item.logFile, 'utf8').split('\n').slice(-40).join('\n');
      console.error(`\n[FIX REQUEST] ${item.name} 失败（exit=${item.exit}）\n${excerpt}`);
    }
    fail(`本地校验矩阵 ${profile} 未通过：${failures.map((item) => item.name).join(', ')}`);
  }
  return steps;
}

function ensureEnvironment() {
  const auth = exec('gh', ['auth', 'status'], {allowFailure: true});
  if (auth.status !== 0) {
    fail('gh 未登录；请先执行 gh auth login（本工具不会自动登录，也不会回退其他凭证）');
  }
  const info = repoInfo();
  if (!['ADMIN', 'MAINTAIN', 'WRITE'].includes(info.viewerPermission)) {
    fail(`当前账号对 ${info.nameWithOwner} 无写权限（viewerPermission=${info.viewerPermission}）`);
  }
  if (!options.dryRun) {
    exec('gh', ['auth', 'setup-git']);
  }
  return info;
}

function commandEnsure() {
  const info = ensureEnvironment();
  log(`[push] ensure OK：repo=${info.nameWithOwner} default=${info.defaultBranchRef.name} permission=${info.viewerPermission}`);
}

function commandStatus() {
  const info = repoInfo();
  const branch = currentBranch();
  const entries = worktreeEntries();
  git(['fetch', 'origin', info.defaultBranchRef.name], true);
  const behind = git(['rev-list', '--count', `HEAD..origin/${info.defaultBranchRef.name}`], true).stdout.trim();
  const prs = ghJson(['pr', 'list', '--state', 'open', '--json', 'number,title,headRefName,baseRefName,url']) ?? [];
  const summary = {
    branch,
    dirtyFiles: entries.length,
    defaultBranch: info.defaultBranchRef.name,
    behindDefault: behind,
    openPrs: prs
  };
  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  log(`[push] branch=${branch} dirty=${entries.length} default=${info.defaultBranchRef.name} behind=${behind}`);
  for (const pr of prs) {
    log(`[push] open PR #${pr.number} ${pr.headRefName} -> ${pr.baseRefName} ${pr.url}`);
  }
}

function defaultAutoBranch() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `auto/${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function commandCheck() {
  runMatrix(options.profile);
  log(`[push] check(${options.profile}) 全部通过`);
}

function commandPush() {
  const info = ensureEnvironment();
  assertNoUnfinishedGitOp();
  const branch = currentBranch();
  if (branch === info.defaultBranchRef.name) {
    fail(`禁止直推默认分支 ${branch}；请使用 submit-pr 自动新建工作分支`);
  }
  if (branch === 'HEAD') {
    fail('detached HEAD，拒绝推送');
  }
  const entries = worktreeEntries();
  if (entries.length > 0) {
    fail(`工作区有 ${entries.length} 个未提交改动；请先提交，或使用 submit-pr 自动提交`);
  }
  const pushArgs = options.forceWithLease
    ? ['push', '--force-with-lease', 'origin', `HEAD:${branch}`]
    : ['push', 'origin', `HEAD:${branch}`];
  if (options.dryRun) {
    log(`[push] dry-run: git ${pushArgs.join(' ')}`);
    return;
  }
  exec('git', pushArgs, {capture: false});
  log(`[push] 已推送 ${branch}`);
}

function commandSubmitPr() {
  const info = ensureEnvironment();
  assertNoUnfinishedGitOp();
  const defaultBranch = info.defaultBranchRef.name;
  const startingBranch = currentBranch();
  let branch = startingBranch;

  if (startingBranch === defaultBranch) {
    branch = options.branch || defaultAutoBranch();
    log(`[push] 当前处于默认分支 ${defaultBranch}，自动切换工作分支 ${branch}`);
    if (options.dryRun) {
      log(`[push] dry-run: git fetch origin ${defaultBranch} && git checkout -b ${branch} origin/${defaultBranch}`);
    } else {
      exec('git', ['fetch', 'origin', defaultBranch], {capture: false});
      exec('git', ['checkout', '-b', branch, `origin/${defaultBranch}`], {capture: false});
    }
  } else if (options.branch && options.branch !== startingBranch) {
    fail(`--branch ${options.branch} 与当前分支 ${startingBranch} 不一致；请先手动切换分支`);
  }

  if (!options.skipCheck) {
    if (options.dryRun) {
      log(`[push] dry-run: 跳过本地校验矩阵（${options.profile}）`);
    } else {
      runMatrix(options.profile);
    }
  }

  const entries = worktreeEntries();
  if (entries.length > 0) {
    if (!options.message) {
      fail(`工作区有 ${entries.length} 个待提交改动，但未提供 --message <提交信息>`);
    }
    if (options.dryRun) {
      log(`[push] dry-run: git add -A && git commit -m "${options.message}"`);
    } else {
      exec('git', ['add', '-A'], {capture: false});
      exec('git', ['commit', '-m', options.message], {capture: false});
    }
  } else {
    log('[push] 工作区无待提交改动，跳过 commit');
  }

  if (options.dryRun) {
    log(`[push] dry-run: git push -u origin HEAD:${branch}`);
    log('[push] dry-run: gh pr create --base <default> --head <branch> ...');
    return;
  }

  exec('git', ['push', '-u', 'origin', `HEAD:${branch}`], {capture: false});

  const existing = ghJson(['pr', 'list', '--head', branch, '--state', 'open', '--json', 'number,url,baseRefName,headRefOid']) ?? [];
  let prNumber = '';
  if (existing.length === 1) {
    prNumber = String(existing[0].number);
    log(`[push] 复用已打开的 PR #${prNumber} ${existing[0].url}`);
  } else if (existing.length > 1) {
    fail(`分支 ${branch} 存在 ${existing.length} 个 open PR，无法安全复用；请先关闭多余 PR`);
  } else {
    const title = (options.message || git(['log', '-1', '--pretty=%s']).stdout.trim() || `chore: 更新 ${branch}`).split('\n')[0];
    const body = [
      '## 变更摘要',
      '',
      title,
      '',
      '## 本地校验',
      '',
      `- profile: ${options.profile}`,
      `- 命令与日志: tmp/push-cli/${runId}/check-*.log`,
      '',
      '## 影响面',
      '',
      '- docs / SQL / dependency / rollback: 见 change 或提交说明',
      '',
      '> 由 `skills/push-cli` 自动创建；合并前必须所有 GitHub 校验通过。'
    ].join('\n');
    const created = exec('gh', ['pr', 'create', '--base', defaultBranch, '--head', branch, '--title', title, '--body', body], {allowFailure: true});
    if (created.status !== 0) {
      fail(`gh pr create 失败：${(created.stderr || created.stdout || '').trim()}`);
    }
    const url = (created.stdout || '').trim().split('\n').pop();
    const view = ghJson(['pr', 'view', url, '--json', 'number,url']);
    prNumber = String(view?.number ?? '');
    log(`[push] 已创建 PR #${prNumber} ${url}`);
  }

  if (!options.noWatch && prNumber) {
    commandWatch(prNumber);
  } else if (prNumber) {
    log(`[push] 下一步：node skills/push-cli/scripts/push_cli.mjs watch --pr ${prNumber}`);
  }
}

function commandWatch(prNumberInput) {
  const pr = prNumberInput || options.pr;
  if (!pr) {
    fail('watch 需要 --pr <number>（或先执行 submit-pr）');
  }
  const deadline = Date.now() + options.timeoutMin * 60 * 1000;
  while (true) {
    const checks = ghJson(['pr', 'checks', pr, '--json', 'name,state,bucket,link,description']) ?? [];
    if (checks.length === 0) {
      fail(`PR #${pr} 没有任何 check；请确认仓库 required checks 配置与 PR 是否已触发工作流`);
    }
    const pending = checks.filter(
      (item) => item.bucket === 'pending' || ['PENDING', 'QUEUED', 'IN_PROGRESS', 'WAITING', 'REQUESTED'].includes(String(item.state).toUpperCase())
    );
    const failed = checks.filter(
      (item) => item.bucket === 'fail' || ['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE', 'ERROR'].includes(String(item.state).toUpperCase())
    );
    if (failed.length > 0) {
      for (const item of failed) {
        console.error(`\n[FIX REQUEST] 校验失败：${item.name}（${item.state}）`);
        console.error(`  link: ${item.link ?? 'n/a'} ${item.description ?? ''}`);
        const runMatch = String(item.link ?? '').match(/runs\/(\d+)/);
        if (runMatch) {
          const logResult = exec('gh', ['run', 'view', runMatch[1], '--log-failed'], {allowFailure: true});
          const excerpt = (logResult.stdout || logResult.stderr || '').split('\n').slice(-60).join('\n');
          console.error(`  失败日志摘要（gh run view ${runMatch[1]} --log-failed）：\n${excerpt}`);
        }
      }
      fail(`PR #${pr} 有 ${failed.length} 个校验失败；修复后重新执行 submit-pr（同一 PR 会被复用）`);
    }
    if (pending.length === 0) {
      log(`[push] PR #${pr} 全部 ${checks.length} 个校验通过`);
      log(`[push] 下一步：node skills/push-cli/scripts/push_cli.mjs merge --pr ${pr} --yes`);
      return;
    }
    if (Date.now() > deadline) {
      fail(`等待 PR #${pr} 校验超时（${options.timeoutMin} 分钟）；可重新执行 watch 继续观察`);
    }
    log(`[push] 等待 ${pending.length} 个校验完成：${pending.map((item) => item.name).join(', ')}`);
    sleep(15000);
  }
}

function commandMerge() {
  if (!options.pr) {
    fail('merge 需要 --pr <number>');
  }
  const view = ghJson(['pr', 'view', options.pr, '--json', 'number,state,isDraft,baseRefName,mergeable,statusCheckRollup,url']);
  if (!view) {
    fail(`无法读取 PR #${options.pr}`);
  }
  if (view.state !== 'OPEN') {
    fail(`PR #${options.pr} 状态为 ${view.state}，不可合并`);
  }
  if (view.isDraft) {
    fail(`PR #${options.pr} 仍是 draft，不可合并`);
  }
  const rollup = view.statusCheckRollup ?? [];
  const bad = rollup.filter((item) =>
    ['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'ERROR', 'STARTUP_FAILURE'].includes(String(item.conclusion ?? '').toUpperCase())
  );
  const pending = rollup.filter((item) => {
    const conclusion = String(item.conclusion ?? '').toUpperCase();
    const status = String(item.status ?? '').toUpperCase();
    return ['', 'NULL', 'UNDEFINED'].includes(conclusion) && ['IN_PROGRESS', 'QUEUED', 'PENDING', 'WAITING', 'REQUESTED', ''].includes(status);
  });
  if (bad.length > 0) {
    fail(`PR #${options.pr} 存在失败校验：${bad.map((item) => item.name ?? item.context).join(', ')}`);
  }
  if (pending.length > 0) {
    fail(`PR #${options.pr} 仍有 ${pending.length} 个校验未完成；请先执行 watch`);
  }
  if (!options.yes) {
    fail('合并属于高危操作，必须显式传入 --yes');
  }
  const mergeArgs = ['pr', 'merge', options.pr, `--${options.method}`, '--delete-branch'];
  if (options.dryRun) {
    log(`[push] dry-run: gh ${mergeArgs.join(' ')}`);
    log('[push] 合并后的下一步：node skills/release-cli/scripts/release_cli.mjs plan');
    return;
  }
  exec('gh', mergeArgs, {capture: false});
  log(`[push] PR #${options.pr} 已合并到 ${view.baseRefName}`);
  log('[push] 合并后的下一步：node skills/release-cli/scripts/release_cli.mjs plan');
}

switch (options.command) {
  case 'ensure':
    commandEnsure();
    break;
  case 'status':
    commandStatus();
    break;
  case 'check':
    commandCheck();
    break;
  case 'push':
    commandPush();
    break;
  case 'submit-pr':
    commandSubmitPr();
    break;
  case 'watch':
    commandWatch();
    break;
  case 'merge':
    commandMerge();
    break;
  default:
    usage();
    process.exit(1);
}



