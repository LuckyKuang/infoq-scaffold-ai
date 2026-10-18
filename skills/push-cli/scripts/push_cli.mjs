#!/usr/bin/env node
// push-cli：GitHub 推送、PR 创建/复用、校验轮询与受控合并。默认 dry-run，远程写操作必须显式确认。
import path from 'node:path';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {PROFILES, buildMatrix} from './push_matrix.mjs';
import {githubRepositoryForRemote} from './remote_target.mjs';
import {normalizeForwardedArgs, resolveRepoRoot} from '../../../tools/lib/skill_runtime.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(scriptDir);
const args = normalizeForwardedArgs(process.argv.slice(2));

function usage() {
  console.log(`Usage: node skills/push-cli/scripts/push_cli.mjs <command> [options]

Commands:
  ensure                     读取 gh 登录、仓库信息、默认分支与写权限
  status                     输出当前分支、脏文件、open PR 与默认分支落后情况
  check [--profile docs|ci|full]   运行本地校验矩阵（默认 docs）
  push [--execute | --dry-run] [--force-with-lease]
                             推送当前分支（拒绝默认分支、脏工作区与危险推送形式）
  submit-pr --message <msg> [--branch <name>] [--profile docs|ci|full] [--execute | --dry-run]
                             默认分支自动新建工作分支 -> 本地校验 -> 提交 -> 推送 -> 创建或复用 PR
  watch [--pr <number>] [--timeout-min <n>]
                             轮询 GitHub 校验；失败时输出失败 check 与日志摘要
  merge --pr <number> --yes [--execute | --dry-run] [--method squash|merge|rebase]
                             校验全绿后合并 PR 到默认分支

Options:
  --execute       执行远程写入；push/submit-pr/merge 默认仅预览
  --dry-run       显式预览；与 --execute 互斥，不新建分支或提交
  --json          仅 status：以 JSON 输出结果摘要
  --yes           显式确认（merge 必需）
  --skip-check    submit-pr 时跳过本地校验矩阵（仅限已单独跑过 check 的场景）
  --no-watch      submit-pr 后不自动进入 watch
  -h, --help      显示帮助

Exit codes: 0 成功，1 失败（校验未通过、门禁未满足或远程操作失败）。`);
}

function parseArgs(argv) {
  const options = {
    command: '',
    dryRun: true,
    execute: false,
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
  let explicitDryRun = false;
  const supplied = new Set();
  const valueOptions = new Set(['--profile', '--message', '--branch', '--pr', '--method', '--timeout-min']);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '-h' || arg === '--help') {
      usage();
      process.exit(0);
    }
    if (valueOptions.has(arg) && (!argv[index + 1] || argv[index + 1].startsWith('-'))) {
      throw new Error(`missing value for ${arg}`);
    }
    if (arg.startsWith('-')) supplied.add(arg);
    if (arg === '--dry-run') explicitDryRun = true;
    else if (arg === '--execute') options.execute = true;
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
    else if (arg.startsWith('-')) throw new Error(`unknown option: ${arg}`);
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
  const allowed = {
    ensure: [], status: ['--json'], check: ['--profile'],
    push: ['--execute', '--dry-run', '--force-with-lease'],
    'submit-pr': ['--execute', '--dry-run', '--message', '--branch', '--profile', '--skip-check', '--no-watch'],
    watch: ['--pr', '--timeout-min'], merge: ['--execute', '--dry-run', '--pr', '--yes', '--method']
  };
  for (const flag of supplied) if (!allowed[options.command].includes(flag)) throw new Error(`${flag} 不适用于 ${options.command}`);
  if (options.execute && explicitDryRun) throw new Error('--execute 与 --dry-run 不能同时使用');
  if (options.execute && !['push', 'submit-pr', 'merge'].includes(options.command)) {
    throw new Error('--execute 只适用于 push、submit-pr、merge');
  }
  if (!['squash', 'merge', 'rebase'].includes(options.method)) throw new Error(`unknown merge method: ${options.method}`);
  if (options.pr && !/^[1-9]\d*$/.test(options.pr)) throw new Error('--pr 必须是正整数');
  if (!Number.isFinite(options.timeoutMin) || options.timeoutMin <= 0) throw new Error('--timeout-min 必须是大于 0 的有限数字');
  options.dryRun = !options.execute;
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
  if (command === 'gh' && commandArgs[0] !== 'auth') {
    const target = githubRepository();
    commandArgs = commandArgs[0] === 'repo' && commandArgs[1] === 'view'
      ? [...commandArgs.slice(0, 2), target, ...commandArgs.slice(2)]
      : [...commandArgs, '--repo', target];
  }
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

let boundRepository;
function githubRepository() {
  if (!boundRepository) {
    try { boundRepository = githubRepositoryForRemote(git, 'origin'); } catch (error) { fail(error.message); }
  }
  return boundRepository;
}

function repoInfo() {
  const info = ghJson(['repo', 'view', '--json', 'nameWithOwner,defaultBranchRef,viewerPermission']);
  if (!info) {
    fail('无法读取 gh repo view；请确认 gh 已登录且当前目录 origin 可达');
  }
  if (String(info.nameWithOwner).toLowerCase() !== githubRepository().split('/').slice(1).join('/')) fail('gh 返回的仓库身份与 origin 不一致');
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
  git(['fetch', '--no-tags', 'origin', info.defaultBranchRef.name]);
  const behind = git(['rev-list', '--count', `HEAD..origin/${info.defaultBranchRef.name}`]).stdout.trim();
  const prs = ghJson(['pr', 'list', '--state', 'open', '--json', 'number,title,headRefName,baseRefName,url']);
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
  if (options.forceWithLease && !git(['ls-remote', '--heads', 'origin', `refs/heads/${branch}`]).stdout.trim()) {
    fail(`--force-with-lease 要求远端分支 ${branch} 已存在；新分支请使用普通 push`);
  }
  const pushArgs = options.forceWithLease
    ? ['push', '--force-with-lease', 'origin', `HEAD:${branch}`]
    : ['push', 'origin', `HEAD:${branch}`];
  if (options.dryRun) {
    log(`[push] dry-run: git ${pushArgs.join(' ')}`);
    return;
  }
  exec('gh', ['auth', 'setup-git']);
  exec('git', pushArgs, {capture: false});
  log(`[push] 已推送 ${branch}`);
}

function commandSubmitPr() {
  const startingBranch = currentBranch();
  if (startingBranch === 'HEAD') fail('detached HEAD，拒绝提交或推送；请先切换工作分支');
  const info = ensureEnvironment();
  assertNoUnfinishedGitOp();
  const defaultBranch = info.defaultBranchRef.name;
  let branch = startingBranch;

  if (startingBranch === defaultBranch) {
    branch = options.branch || defaultAutoBranch();
    log(`[push] 当前处于默认分支 ${defaultBranch}，自动切换工作分支 ${branch}`);
    if (options.dryRun) {
      log(`[push] dry-run: git fetch --no-tags origin ${defaultBranch} && git checkout -b ${branch} origin/${defaultBranch}`);
    } else {
      exec('git', ['fetch', '--no-tags', 'origin', defaultBranch], {capture: false});
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

  exec('gh', ['auth', 'setup-git']);
  exec('git', ['push', '-u', 'origin', `HEAD:${branch}`], {capture: false});

  const existing = ghJson(['pr', 'list', '--head', branch, '--state', 'open', '--json', 'number,url,baseRefName,headRefOid']) ?? [];
  let prNumber = '';
  if (existing.length === 1) {
    if (existing[0].baseRefName !== defaultBranch) fail(`分支 ${branch} 的 PR 目标不是默认分支 ${defaultBranch}；拒绝复用`);
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
    const result = exec('gh', ['pr', 'checks', pr, '--json', 'name,state,bucket,link,description'], {allowFailure: true});
    if (![0, 8].includes(result.status)) fail(`无法读取 PR #${pr} 校验（exit=${result.status}）：${(result.stderr || result.stdout || '').trim()}`);
    let checks;
    try { checks = JSON.parse(result.stdout); } catch (error) { fail(`无法解析 PR #${pr} 校验：${error.message}`); }
    if (!Array.isArray(checks)) fail(`PR #${pr} 校验响应必须是数组`);
    if (checks.length === 0) {
      fail(`PR #${pr} 没有任何 check；请确认仓库 required checks 配置与 PR 是否已触发工作流`);
    }
    const pending = checks.filter(
      (item) => item.bucket === 'pending' || ['PENDING', 'QUEUED', 'IN_PROGRESS', 'WAITING', 'REQUESTED'].includes(String(item.state).toUpperCase())
    );
    const failed = checks.filter(
      (item) => item.bucket === 'fail' || ['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE', 'ERROR'].includes(String(item.state).toUpperCase())
    );
    const unknown = checks.filter((item) => !pending.includes(item) && !failed.includes(item) &&
      !['pass', 'skipping'].includes(item.bucket) && !['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(String(item.state).toUpperCase()));
    if (unknown.length > 0) fail(`PR #${pr} 存在无法识别的校验状态：${unknown.map(item => `${item.name} (${item.state}/${item.bucket})`).join(', ')}`);
    if (failed.length > 0) {
      for (const item of failed) {
        console.error(`\n[FIX REQUEST] 校验失败：${item.name}（${item.state}）`);
        console.error(`  link: ${item.link ?? 'n/a'} ${item.description ?? ''}`);
        const runMatch = String(item.link ?? '').match(/runs\/(\d+)/);
        if (runMatch) {
          const logResult = exec('gh', ['run', 'view', runMatch[1], '--log-failed'], {allowFailure: true});
          if (logResult.status !== 0) console.error(`[push] 失败日志抓取失败：category=${logResult.error ? 'spawn' : logResult.signal ? 'signal' : 'exit'}，exit=${logResult.status}，signal=${logResult.signal || 'none'}，error=${logResult.error?.code || 'none'}，stderr=${(logResult.stderr || '').trim().slice(0, 1000)}；原校验仍失败`);
          const excerpt = (logResult.stdout || '').split('\n').slice(-60).join('\n');
          console.error(`  失败日志摘要（gh run view ${runMatch[1]} --log-failed）：\n${excerpt}`);
        }
      }
      fail(`PR #${pr} 有 ${failed.length} 个校验失败；修复后重新执行 submit-pr（同一 PR 会被复用）`);
    }
    if (pending.length === 0) {
      log(`[push] PR #${pr} 全部 ${checks.length} 个校验通过`);
      log(`[push] 下一步先预览：node skills/push-cli/scripts/push_cli.mjs merge --pr ${pr} --yes；确认后追加 --execute`);
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
  const info = repoInfo();
  const view = ghJson(['pr', 'view', options.pr, '--json', 'number,state,isDraft,baseRefName,headRefOid,mergeable,statusCheckRollup,url']);
  if (!view) {
    fail(`无法读取 PR #${options.pr}`);
  }
  if (view.state !== 'OPEN') {
    fail(`PR #${options.pr} 状态为 ${view.state}，不可合并`);
  }
  if (view.isDraft) {
    fail(`PR #${options.pr} 仍是 draft，不可合并`);
  }
  if (view.baseRefName !== info.defaultBranchRef.name) fail(`PR #${options.pr} 目标不是默认分支 ${info.defaultBranchRef.name}`);
  if (view.mergeable !== 'MERGEABLE') fail(`PR #${options.pr} 合并状态为 ${view.mergeable}；请先解决冲突或等待 GitHub 计算`);
  if (!/^[0-9a-f]{40,64}$/i.test(view.headRefOid || '')) fail(`PR #${options.pr} 缺少有效 head SHA`);
  const rollup = view.statusCheckRollup ?? [];
  if (rollup.length === 0) fail(`PR #${options.pr} 没有任何校验；拒绝合并`);
  const bad = rollup.filter((item) =>
    ['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'ERROR', 'STARTUP_FAILURE'].includes(String(item.conclusion ?? item.state ?? '').toUpperCase())
  );
  const pending = rollup.filter((item) => {
    const conclusion = String(item.conclusion ?? item.state ?? '').toUpperCase();
    return !['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(conclusion);
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
  const mergeArgs = ['pr', 'merge', options.pr, `--${options.method}`, '--delete-branch', '--match-head-commit', view.headRefOid];
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



