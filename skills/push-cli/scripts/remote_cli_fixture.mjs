import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

// 真实 Git 只连接 tmp/ 内的 bare origin；预加载器隔离所有 gh 调用并记录行为。
export function createRemoteFixture(repoRoot, name) {
  const auditDir = path.join(repoRoot, 'tmp', 'documentation-reaudit');
  fs.mkdirSync(auditDir, {recursive: true});
  const base = fs.mkdtempSync(path.join(auditDir, `${name}-`));
  const root = path.join(base, 'repo');
  const origin = path.join(base, 'origin.git');
  const callsFile = path.join(base, 'calls.jsonl');
  const stateFile = path.join(base, 'gh-state.json');
  fs.mkdirSync(root);
  const env = {...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(base, 'empty-git-config'), GIT_TERMINAL_PROMPT: '0'};
  function git(...args) {
    const result = spawnSync('git', args, {cwd: root, env, encoding: 'utf8'});
    assert.equal(result.status, 0, `git ${args.join(' ')}: ${result.stderr}`);
    return result.stdout.trim();
  }
  function write(rel, content) {
    const target = path.join(root, rel);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, content, 'utf8');
  }
  write('AGENTS.md', '# fixture\n');
  write('.gitignore', 'tmp/\n');
  write('backend/pom.xml', '<project><revision>1.2.3</revision></project>\n');
  write('frontend-react/package.json', '{"version":"1.2.3"}\n');
  write('frontend-vue/package.json', '{"version":"1.2.3"}\n');
  for (const rel of ['skills/push-cli/scripts/push_cli.mjs', 'skills/push-cli/scripts/push_matrix.mjs', 'skills/push-cli/scripts/remote_target.mjs', 'skills/release-cli/scripts/release_cli.mjs', 'skills/release-cli/scripts/bump_version.mjs', 'tools/lib/skill_runtime.mjs']) {
    const target = path.join(root, rel);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.copyFileSync(path.join(repoRoot, rel), target);
  }
  git('init', '--bare', origin);
  git('init', '-b', 'main');
  git('config', 'user.name', 'CLI Fixture');
  git('config', 'user.email', 'fixture@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'tag.gpgsign', 'false');
  git('add', '.');
  git('commit', '-m', 'fixture');
  git('remote', 'add', 'origin', origin);
  git('push', '-u', 'origin', 'main');
  const head = git('rev-parse', 'HEAD');
  const state = {
    remoteFetchUrls: 'https://github.com/LuckyKuang/infoq-scaffold-ai.git',
    remotePushUrls: 'git@github.com:LuckyKuang/infoq-scaffold-ai.git',
    repo: {nameWithOwner: 'LuckyKuang/infoq-scaffold-ai', defaultBranchRef: {name: 'main'}, viewerPermission: 'WRITE'},
    pr: {number: 42, state: 'OPEN', isDraft: false, baseRefName: 'main', headRefOid: head, mergeable: 'MERGEABLE', statusCheckRollup: [{name: 'CI', status: 'COMPLETED', conclusion: 'SUCCESS'}], url: 'https://example.invalid/pr/42'},
    checks: [{name: 'CI', state: 'SUCCESS', bucket: 'pass'}],
    checksStatus: 0,
    runLogStatus: 0,
    runLogStdout: '',
    runLogStderr: '',
    release: null,
    releasesError: ''
  };
  function saveState() { fs.writeFileSync(stateFile, JSON.stringify(state), 'utf8'); }
  saveState();
  const preload = path.join(base, 'isolate.mjs');
  fs.writeFileSync(preload, `import cp from 'node:child_process';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
const original = cp.spawnSync;
cp.spawnSync = (command, args, options) => {
  if (command !== 'git' && command !== 'gh') return original(command, args, options);
  if (options?.cwd !== ${JSON.stringify(root)}) throw new Error('fixture escaped cwd');
  fs.appendFileSync(${JSON.stringify(callsFile)}, JSON.stringify({command, args}) + '\\n', 'utf8');
  const state = JSON.parse(fs.readFileSync(${JSON.stringify(stateFile)}, 'utf8'));
  if (command === 'git') {
    if (args[0] === 'remote' && args[1] === 'get-url') return {status: 0, stdout: args.includes('--push') ? state.remotePushUrls : state.remoteFetchUrls, stderr: ''};
    return original(command, args, options);
  }
  let value = ''; let status = 0; let stderr = '';
  if (args[0] === 'repo' && args[1] === 'view') value = state.repo;
  else if (args[0] === 'auth') value = '';
  else if (args[0] === 'pr' && args[1] === 'list') value = [];
  else if (args[0] === 'pr' && args[1] === 'view') value = state.pr;
  else if (args[0] === 'pr' && args[1] === 'checks') { value = state.checks; status = state.checksStatus; }
  else if (args[0] === 'pr' && args[1] === 'create') value = 'https://example.invalid/pr/42';
  else if (args[0] === 'pr' && args[1] === 'merge') value = '';
  else if (args[0] === 'run' && args[1] === 'view') { value = state.runLogStdout; status = state.runLogStatus; stderr = state.runLogStderr; }
  else if (args[0] === 'release' && args[1] === 'view') {
    if (state.releasesError || !state.release) { status = 1; stderr = state.releasesError || 'release not found'; }
    else value = state.release;
  } else if (args[0] === 'release' && args[1] === 'create') value = '';
  else throw new Error('unexpected gh fixture call: ' + args.join(' '));
  return {status, stdout: typeof value === 'string' ? value : JSON.stringify(value), stderr};
};
syncBuiltinESMExports();
`, 'utf8');
  function run(cli, args, expectedStatus = 0) {
    fs.writeFileSync(callsFile, '', 'utf8');
    saveState();
    const result = spawnSync(process.execPath, [path.join(root, 'skills', cli, 'scripts', cli.replace('-', '_') + '.mjs'), ...args], {
      cwd: root, env: {...env, NODE_OPTIONS: `--import=${pathToFileURL(preload).href}`}, encoding: 'utf8'
    });
    fs.appendFileSync(path.join(base, 'runs.log'), `$ ${cli} ${args.join(' ')}\nexit=${result.status}\n${result.stdout}${result.stderr}\n`, 'utf8');
    assert.equal(result.status, expectedStatus, `${cli} ${args.join(' ')}\n${result.stdout}${result.stderr}`);
    const calls = fs.readFileSync(callsFile, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    return {...result, calls};
  }
  function assertNoWrites(result) {
    assert.ok(!result.calls.some(({command, args}) =>
      (command === 'git' && ['push', 'checkout', 'switch', 'commit', 'add', 'tag'].includes(args[0])) ||
      (command === 'gh' && (['create', 'merge', 'edit', 'delete'].includes(args[1]) || (args[0] === 'auth' && args[1] === 'setup-git')))
    ), `preview wrote: ${JSON.stringify(result.calls)}`);
  }
  return {base, root, origin, state, git, write, run, assertNoWrites};
}
