#!/usr/bin/env node
// release-cli：版本现状核对、按需升级、打 tag、发布并校验 GitHub Release。远程写操作默认 dry-run。
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {normalizeForwardedArgs, resolveRepoRoot} from '../../../tools/lib/skill_runtime.mjs';
import {githubRepositoryForRemote} from '../../push-cli/scripts/remote_target.mjs';
import {parseReleaseVersion, releaseVersionFromTag, compareReleaseVersions} from '../../../tools/lib/release_version.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
let repoRoot = resolveRepoRoot(scriptDir);
const args = normalizeForwardedArgs(process.argv.slice(2));

function usage() {
  console.log(`Usage: node skills/release-cli/scripts/release_cli.mjs <command> [options]

Commands:
  plan [--version x.y.z]                核对当前版本、最新远程 tag、是否必须先 bump
  bump --version x.y.z [--dry-run]      本地同步受管文件版本；默认写入，不提交或推送
  tag --version x.y.z [--execute | --dry-run]
                                        预览标注 tag；显式 --execute 才创建并推送
  publish --version x.y.z [--notes-file <path>] [--execute | --dry-run]
                                        创建 GitHub Release（无 notes-file 时使用 GitHub 生成说明）
  verify --version x.y.z                校验远端 tag、Release 状态与版本字段一致

Options:
  --repo-root <path>   指定仓库根（默认自动解析）
  --remote <name>      远端名，默认 origin
  --tag <name>         精确 tag 名，必须等于 v<version>
  --json               仅 plan：以 JSON 输出结果
  --execute            执行 tag/publish 远程写入；默认仅预览
  --dry-run            显式预览（bump 也不写入）；与 --execute 互斥
  -h, --help           显示帮助

version 支持 x.y.z 或 x.y.z-rcN（N > 0，无前导零）。RC 为源码 Pre-release，禁止设为 Latest。`);
}

const options = {
  command: '',
  version: '',
  tag: '',
  notesFile: '',
  remote: 'origin',
  dryRun: true,
  execute: false,
  json: false
};

let explicitDryRun = false;
const supplied = new Set();
const valueOptions = new Set(['--version', '--tag', '--notes-file', '--remote', '--repo-root']);
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '-h' || arg === '--help') {
    usage();
    process.exit(0);
  }
  if (valueOptions.has(arg) && (!args[index + 1] || args[index + 1].startsWith('-'))) {
    throw new Error(`missing value for ${arg}`);
  }
  if (arg.startsWith('-')) {
    if (supplied.has(arg)) throw new Error(`repeated option: ${arg}`);
    supplied.add(arg);
  }
  if (arg === '--dry-run') explicitDryRun = true;
  else if (arg === '--execute') options.execute = true;
  else if (arg === '--json') options.json = true;
  else if (arg === '--version') options.version = args[++index];
  else if (arg === '--tag') options.tag = args[++index];
  else if (arg === '--notes-file') options.notesFile = args[++index];
  else if (arg === '--remote') options.remote = args[++index];
  else if (arg === '--repo-root') repoRoot = path.resolve(args[++index]);
  else if (arg.startsWith('-')) throw new Error(`unknown option: ${arg}`);
  else if (!options.command) options.command = arg;
  else throw new Error(`unexpected argument: ${arg}`);
}

if (!options.command) {
  usage();
  process.exit(1);
}
if (!['plan', 'bump', 'tag', 'publish', 'verify'].includes(options.command)) {
  throw new Error(`unknown command: ${options.command}`);
}
if (options.version && !parseReleaseVersion(options.version)) {
  throw new Error(`--version 必须匹配 x.y.z 或 x.y.z-rcN（N > 0，无前导零），收到：${options.version}`);
}
if (options.tag && (!options.version || options.tag !== `v${options.version}`)) throw new Error('--tag 必须精确等于 v<version>，且须同时指定 --version');
const allowed = {
  plan: ['--version', '--remote', '--repo-root', '--json'],
  bump: ['--version', '--repo-root', '--dry-run'],
  tag: ['--version', '--tag', '--remote', '--repo-root', '--execute', '--dry-run'],
  publish: ['--version', '--tag', '--remote', '--repo-root', '--notes-file', '--execute', '--dry-run'],
  verify: ['--version', '--tag', '--remote', '--repo-root']
};
for (const flag of supplied) if (!allowed[options.command].includes(flag)) throw new Error(`${flag} 不适用于 ${options.command}`);
if (options.execute && explicitDryRun) throw new Error('--execute 与 --dry-run 不能同时使用');
if (options.execute && !['tag', 'publish'].includes(options.command)) throw new Error('--execute 只适用于 tag、publish');
options.dryRun = options.command === 'bump' ? explicitDryRun : !options.execute;

function fail(message) {
  console.error(`[release] FAIL ${message}`);
  process.exit(1);
}

function exec(command, commandArgs, {capture = true, allowFailure = false} = {}) {
  if (command === 'gh') {
    const target = githubRepository();
    commandArgs = commandArgs[0] === 'api'
      ? [...commandArgs, '--hostname', target.split('/')[0]]
      : commandArgs[0] === 'repo' && commandArgs[1] === 'view'
      ? [...commandArgs.slice(0, 2), target, ...commandArgs.slice(2)]
      : [...commandArgs, '--repo', target];
  }
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit'
  });
  if (result.status !== 0 && !allowFailure) {
    fail(`${command} ${commandArgs.join(' ')} 执行失败（exit=${result.status}）\n${(result.stderr || result.stdout || '').trim().slice(0, 2000)}`);
  }
  return result;
}

function git(commandArgs, allowFailure = false) {
  return exec('git', commandArgs, {allowFailure});
}

let boundRepository;
function githubRepository() {
  if (!boundRepository) {
    try { boundRepository = githubRepositoryForRemote(git, options.remote); } catch (error) { fail(error.message); }
  }
  return boundRepository;
}

function readFileVersion(relPath, pattern, description) {
  const file = path.join(repoRoot, relPath);
  if (!fs.existsSync(file)) {
    fail(`版本受管文件缺失：${relPath}`);
  }
  const match = fs.readFileSync(file, 'utf8').match(pattern);
  if (!match) {
    fail(`无法从 ${description} 解析版本：${relPath}`);
  }
  return match[1];
}

function currentVersions() {
  return {
    backend: readFileVersion('backend/pom.xml', /<revision>([^<]+)<\/revision>/, 'backend revision'),
    react: readFileVersion('frontend-react/package.json', /"version"\s*:\s*"([^"]+)"/, 'react package version'),
    vue: readFileVersion('frontend-vue/package.json', /"version"\s*:\s*"([^"]+)"/, 'vue package version')
  };
}

function assertVersionsConsistent(versions) {
  const unique = new Set([versions.backend, versions.react, versions.vue]);
  if (unique.size !== 1) {
    fail(`版本字段不一致：backend=${versions.backend} react=${versions.react} vue=${versions.vue}`);
  }
  if (!parseReleaseVersion(versions.backend)) fail(`无效的工作区版本：${versions.backend}`);
  return versions.backend;
}

function remoteTags() {
  githubRepository();
  const result = git(['ls-remote', '--tags', '--refs', options.remote], true);
  if (result.status !== 0) {
    fail(`无法读取远端 tag：git ls-remote --tags --refs ${options.remote}\n${(result.stderr || '').trim()}`);
  }
  return (result.stdout || '')
    .split('\n')
    .map((line) => line.trim().split(/\s+/)[1] ?? '')
    .map((ref) => ref.replace('refs/tags/', ''))
    .filter(Boolean);
}

function latestRemoteVersion() {
  const versions = remoteTags().map(tag => {
    const parsed = releaseVersionFromTag(tag);
    return parsed ? {...parsed, tag} : null;
  }).filter(Boolean);
  if (versions.length === 0) {
    return null;
  }
  versions.sort(compareReleaseVersions);
  return versions[versions.length - 1];
}

function nextVersion(version) {
  const parsed = parseReleaseVersion(version);
  const next = parsed.isPrerelease
    ? `${parsed.major}.${parsed.minor}.${parsed.patch}-rc${parsed.rc + 1}`
    : `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
  if (!parseReleaseVersion(next)) fail(`版本已超出可安全递增的范围：${version}`);
  return next;
}

function tagName(version) {
  return `v${version}`;
}

function assertNewRemoteVersion(version) {
  const latest = latestRemoteVersion();
  if (latest && compareReleaseVersions(version, latest) <= 0) fail(`目标版本 ${version} 不高于最新远端 tag ${latest.tag}；拒绝重复发布或降版`);
}

function assertRemoteTagCommit(name) {
  githubRepository();
  const result = git(['ls-remote', '--tags', options.remote, `refs/tags/${name}`, `refs/tags/${name}^{}`]);
  const refs = new Map(result.stdout.trim().split(/\r?\n/u).filter(Boolean).map(line => {
    const [sha, ref] = line.split(/\s+/u);
    return [ref, sha];
  }));
  const commit = refs.get(`refs/tags/${name}^{}`) || refs.get(`refs/tags/${name}`);
  if (!commit || !/^[a-f0-9]{40,64}$/u.test(commit)) fail(`远端缺少有效 tag SHA：${name}`);
  const head = git(['rev-parse', 'HEAD']).stdout.trim();
  if (head !== commit) fail(`远端 tag ${name} 的提交 SHA ${commit} 与已核验 HEAD ${head} 不一致`);
  return commit;
}

function commitsSince(tag) {
  const result = tag ? git(['log', '--oneline', `${tag}..HEAD`], true) : git(['log', '--oneline', '-n', '30'], true);
  if (result.status !== 0) fail(`无法读取发布提交清单（exit=${result.status}）；请先将远端 tag ${tag || '(none)'} 获取到本地再重试：${(result.stderr || '').trim().slice(0, 1000)}`);
  return (result.stdout || '').trim().split('\n').filter(Boolean);
}

function defaultBranchName() {
  const view = exec('gh', ['repo', 'view', '--json', 'nameWithOwner,defaultBranchRef'], {allowFailure: true});
  if (view.status !== 0) {
    fail('无法读取默认分支（需要 gh 已登录）');
  }
  const info = JSON.parse(view.stdout);
  if (String(info.nameWithOwner).toLowerCase() !== githubRepository().split('/').slice(1).join('/')) fail('gh 返回的仓库身份与 Git remote 不一致');
  return info.defaultBranchRef.name;
}

function releaseView(name) {
  const result = exec('gh', ['release', 'view', name, '--json', 'tagName,isDraft,isPrerelease,url,assets'], {allowFailure: true});
  if (result.status !== 0) {
    if (/release not found/i.test(`${result.stderr || ''}\n${result.stdout || ''}`)) return null;
    fail(`无法读取 Release ${name}（exit=${result.status}）：${(result.stderr || result.stdout || '').trim()}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    fail(`Release ${name} 返回无效 JSON：${error.message}`);
  }
}

function commandPlan() {
  const versions = currentVersions();
  const current = assertVersionsConsistent(versions);
  const latest = latestRemoteVersion();
  const latestText = latest ? latest.tag : '(none)';
  const needsBump = latest ? compareReleaseVersions(current, latest) <= 0 : false;
  const baseVersion = needsBump && latest ? latest.version : current;
  const suggested = options.version || nextVersion(baseVersion);
  if (options.version && latest && compareReleaseVersions(options.version, latest) <= 0) fail(`建议版本 ${options.version} 不高于最新远端 tag ${latest.tag}`);
  const commits = commitsSince(latest ? latest.tag : '');
  const report = {
    currentVersion: current,
    latestRemoteTag: latestText,
    needsBump,
    suggestedVersion: suggested,
    commitCount: commits.length,
    recentCommits: commits.slice(0, 10),
    remote: options.remote
  };
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`[release] 当前版本：${current}`);
    console.log(`[release] 最新远程 tag：${latestText}`);
    console.log(`[release] 是否需要先 bump：${needsBump ? 'YES' : 'NO'}`);
    console.log(`[release] 建议版本：${suggested}（自上次 tag 以来提交数：${commits.length}）`);
  }
  if (needsBump) {
    fail(`版本不是最新（当前 ${current} <= 最新 tag ${latestText}）；请先执行 bump --version ${suggested}`);
  }
}

function commandBump() {
  if (!options.version) {
    fail('bump 需要 --version x.y.z');
  }
  assertNewRemoteVersion(options.version);
  const bumper = path.join(scriptDir, 'bump_version.mjs');
  const bumpArgs = [bumper, '--repo-root', repoRoot, ...(options.dryRun ? ['--dry-run'] : []), options.version];
  exec(process.execPath, bumpArgs, {capture: false});
  console.log('[release] 下一步：通过 push-cli 提交并推送版本升级，合并到默认分支后再执行 tag。');
}

function commandTag() {
  if (!options.version) {
    fail('tag 需要 --version x.y.z');
  }
  if (git(['status', '--porcelain']).stdout.trim()) fail('tag 要求干净工作区；请先提交并合并版本与代码修改');
  const current = assertVersionsConsistent(currentVersions());
  if (current !== options.version) {
    fail(`工作区版本 ${current} 与 --version ${options.version} 不一致；请先 bump`);
  }
  const defaultBranch = defaultBranchName();
  exec('git', ['fetch', '--no-tags', options.remote, defaultBranch], {capture: true});
  const head = git(['rev-parse', 'HEAD']).stdout.trim();
  const remoteHead = git(['rev-parse', `${options.remote}/${defaultBranch}`]).stdout.trim();
  if (head !== remoteHead) {
    fail(`HEAD 与 ${options.remote}/${defaultBranch} 不一致（${head.slice(0, 8)} vs ${remoteHead.slice(0, 8)}）；请先合并 PR 并拉取最新默认分支`);
  }
  const name = tagName(options.version);
  const localExists = git(['rev-parse', '--verify', `refs/tags/${name}`], true).status === 0;
  const remoteExists = remoteTags().includes(name);
  if (localExists || remoteExists) {
    fail(`tag ${name} 已存在（local=${localExists} remote=${remoteExists}）；拒绝复用`);
  }
  assertNewRemoteVersion(options.version);
  console.log(`[release] 将在 ${head.slice(0, 8)} 创建标注 tag ${name}`);
  if (options.dryRun) {
    console.log(`[release] dry-run: git tag -a ${name} -m "Release ${name}" && git push ${options.remote} refs/tags/${name}`);
    return;
  }
  exec('git', ['tag', '-a', name, '-m', `Release ${name}`], {capture: false});
  exec('git', ['push', options.remote, `refs/tags/${name}`], {capture: false});
  console.log(`[release] tag ${name} 已推送；仓库 Release workflow 将构建并发布，等待成功后执行 verify --version ${options.version}；不要并发 publish。`);
}

function commandPublish() {
  if (!options.version) {
    fail('publish 需要 --version x.y.z');
  }
  const name = tagName(options.version);
  const current = assertVersionsConsistent(currentVersions());
  if (current !== options.version) fail(`工作区版本 ${current} 与 --version ${options.version} 不一致`);
  if (!remoteTags().includes(name)) {
    fail(`远端不存在 tag ${name}；请先执行 tag --version ${options.version}`);
  }
  const latest = latestRemoteVersion();
  if (latest && compareReleaseVersions(options.version, latest) < 0) fail(`目标版本 ${options.version} 低于最新远端 tag ${latest.tag}；拒绝发布旧版本`);
  assertRemoteTagCommit(name);
  const defaultBranch = defaultBranchName();
  git(['fetch', '--no-tags', options.remote, defaultBranch]);
  if (git(['merge-base', '--is-ancestor', 'HEAD', `${options.remote}/${defaultBranch}`], true).status !== 0) fail(`发布提交尚未进入 ${options.remote}/${defaultBranch}`);
  if (releaseView(name)) {
    fail(`Release ${name} 已存在；重复发布被拒绝（如需更新说明请使用 gh release edit）`);
  }
  const notesPath = options.notesFile ? path.resolve(repoRoot, options.notesFile) : '';
  if (notesPath && !fs.existsSync(notesPath)) {
    fail(`notes 文件不存在：${options.notesFile}`);
  }
  const publishArgs = ['release', 'create', name, '--title', name, '--verify-tag'];
  if (parseReleaseVersion(options.version).isPrerelease) publishArgs.push('--prerelease', '--latest=false');
  if (notesPath) {
    publishArgs.push('--notes-file', notesPath);
  } else {
    publishArgs.push('--generate-notes');
  }
  if (options.dryRun) {
    console.log(`[release] dry-run: gh ${publishArgs.join(' ')}`);
    return;
  }
  exec('gh', publishArgs, {capture: false});
  console.log(`[release] Release ${name} 已发布；下一步：verify --version ${options.version}`);
}

function commandVerify() {
  if (!options.version) {
    fail('verify 需要 --version x.y.z');
  }
  const name = tagName(options.version);
  const current = assertVersionsConsistent(currentVersions());
  if (current !== options.version) {
    fail(`工作区版本 ${current} 与 --version ${options.version} 不一致`);
  }
  if (!remoteTags().includes(name)) {
    fail(`远端缺少 tag ${name}`);
  }
  const commit = assertRemoteTagCommit(name);
  const release = releaseView(name);
  if (!release) {
    fail(`GitHub Release ${name} 未找到`);
  }
  if (release.isDraft !== false) {
    fail(`Release ${name} 仍是 draft 或缺少有效 draft 状态`);
  }
  if (release.tagName !== name) fail(`Release 返回 tag ${release.tagName} 与目标 ${name} 不一致`);
  const isPrerelease = parseReleaseVersion(options.version).isPrerelease;
  if (release.isPrerelease !== isPrerelease) fail(`Release ${name} 的 prerelease=${release.isPrerelease} 与版本渠道不符（期望 ${isPrerelease}）`);
  if (!Array.isArray(release.assets)) fail(`Release ${name} 缺少资产元数据`);
  if (isPrerelease) {
    if (release.assets.length !== 0) fail(`RC Release ${name} 必须只含自动源码归档，附加资产必须为空`);
    const repositoryPath = githubRepository().split('/').slice(1).join('/');
    const latest = exec('gh', ['api', `repos/${repositoryPath}/releases/latest`], {allowFailure: true});
    if (latest.status !== 0) {
      if (!/HTTP 404/u.test(latest.stderr || '')) fail(`无法核验 Latest Release（exit=${latest.status}）：${(latest.stderr || latest.stdout || '').trim()}`);
    } else {
      let latestRelease;
      try { latestRelease = JSON.parse(latest.stdout); } catch (error) { fail(`Latest Release 返回无效 JSON：${error.message}`); }
      if (typeof latestRelease.tag_name !== 'string') fail('Latest Release 缺少 tag_name');
      if (latestRelease.tag_name === name) fail(`RC Release ${name} 被设为 Latest`);
    }
  } else {
    const expected = ['infoq-admin.jar', 'react-dist.tar.gz', 'vue-dist.tar.gz'];
    const names = release.assets.map(asset => asset.name).sort();
    if (JSON.stringify(names) !== JSON.stringify(expected) || release.assets.some(asset => !Number.isSafeInteger(asset.size) || asset.size <= 0)) fail(`正式 Release ${name} 必须包含精确三个非空资产：${expected.join(', ')}`);
  }
  console.log(`[release] verify PASS：${release.tagName} ${release.url} SHA=${commit} prerelease=${isPrerelease} assets=${release.assets.length}`);
}

switch (options.command) {
  case 'plan':
    commandPlan();
    break;
  case 'bump':
    commandBump();
    break;
  case 'tag':
    commandTag();
    break;
  case 'publish':
    commandPublish();
    break;
  case 'verify':
    commandVerify();
    break;
  default:
    usage();
    process.exit(1);
}


