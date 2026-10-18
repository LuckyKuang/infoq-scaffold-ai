#!/usr/bin/env node
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveRepoRoot} from '../../../tools/lib/skill_runtime.mjs';
import {createRemoteFixture} from '../../push-cli/scripts/remote_cli_fixture.mjs';

const fixture = createRemoteFixture(resolveRepoRoot(path.dirname(fileURLToPath(import.meta.url))), 'release-cli');
const {run, git, write, state, assertNoWrites} = fixture;
const beforeHead = git('rev-parse', 'HEAD');
git('--git-dir', fixture.origin, 'tag', 'v1.0.0', beforeHead);
const missingHistory = run('release-cli', ['plan'], 1);
assertNoWrites(missingHistory);
assert.match(missingHistory.stderr, /无法读取发布提交清单.*获取到本地/u);
assertNoWrites(run('release-cli', ['tag', '--version', '1.2.3']));
assertNoWrites(run('release-cli', ['tag', '--version', '1.2.3', '--dry-run']));
assert.equal(git('tag', '--list'), '');
assert.equal(git('rev-parse', 'HEAD'), beforeHead);
for (const rel of ['frontend-react/package.json', 'frontend-vue/package.json']) write(rel, '{"version":"1.2.4"}\n');
write('backend/pom.xml', '<project><revision>1.2.4</revision></project>\n');
const dirty = run('release-cli', ['tag', '--version', '1.2.4', '--execute'], 1);
assertNoWrites(dirty);
assert.match(dirty.stderr, /干净工作区/u);
for (const rel of ['frontend-react/package.json', 'frontend-vue/package.json']) write(rel, '{"version":"1.2.3"}\n');
write('backend/pom.xml', '<project><revision>1.2.3</revision></project>\n');
assertNoWrites(run('release-cli', ['tag', '--version', '1.2.4', '--execute'], 1));
write('frontend-react/package.json', '{"version":"1.2.4"}\n');
assertNoWrites(run('release-cli', ['tag', '--version', '1.2.3', '--execute'], 1));
write('frontend-react/package.json', '{"version":"1.2.3"}\n');
assertNoWrites(run('release-cli', ['publish', '--version', '1.2.3', '--execute'], 1));
for (const args of [
  ['tag', '--version', '1.2.3', '--execute', '--dry-run'],
  ['tag', '--version', '1.2.3', '--dry-run', '--execute'],
  ['publish', '--version', '1.2.3', '--execute', '--dry-run'],
  ['publish', '--version', '1.2.3', '--dry-run', '--execute'],
  ['tag', '--version'], ['tag', '--remote', '--execute'],
  ['tag', '--version', '1.2.3', '--bogus'], ['--bogus'],
  ['plan', '--execute'], ['publish', '--notes-file'], ['plan', '--dry-run'], ['publish', '--json'], ['bump', '--remote', 'origin'],
  ['tag', '--version', '1.2.3', '--version', '1.2.3'], ['plan', '--json', '--json'],
  ['tag', '--version', '1.2.3', '--tag', 'v1.2.4'], ['publish', '--version', '1.2.3', '--tag', 'release-1.2.3'],
  ['verify', '--version', '1.2.3', '--tag', 'v1.2.4'], ['tag', '--version', '1.2.3-rc0'],
  ['tag', '--version', '1.2.3-rc01'], ['tag', '--version', '1.2.3-beta1'], ['tag', '--version', '1.2.3+build']
]) assertNoWrites(run('release-cli', args, 1));
const originalTarget = state.remotePushUrls;
state.remotePushUrls = 'https://github.com/other/repository.git';
assertNoWrites(run('release-cli', ['tag', '--version', '1.2.3', '--execute'], 1));
state.remotePushUrls = originalTarget;
const originalIdentity = state.repo.nameWithOwner;
state.repo.nameWithOwner = 'other/repository';
assertNoWrites(run('release-cli', ['tag', '--version', '1.2.3', '--execute'], 1));
state.repo.nameWithOwner = originalIdentity;
git('branch', 'v1.2.3');
const tagged = run('release-cli', ['tag', '--version', '1.2.3', '--execute']);
assert.ok(tagged.calls.some(call => call.command === 'git' && call.args[0] === 'push'));
assert.ok(git('ls-remote', '--tags', 'origin').includes('refs/tags/v1.2.3'));
assertNoWrites(run('release-cli', ['tag', '--version', '1.2.3'], 1));
assertNoWrites(run('release-cli', ['publish', '--version', '1.2.3']));
assertNoWrites(run('release-cli', ['publish', '--version', '1.2.3', '--dry-run']));
assertNoWrites(run('release-cli', ['publish', '--version', '1.2.3', '--notes-file', 'missing.md', '--execute'], 1));
const published = run('release-cli', ['publish', '--version', '1.2.3', '--execute']);
assert.ok(published.calls.some(call => call.command === 'gh' && call.args[0] === 'release' && call.args[1] === 'create'));
assert.ok(published.calls.find(call => call.command === 'gh' && call.args[1] === 'create').args.includes('--repo'));
const stableAssets = ['infoq-admin.jar', 'vue-dist.tar.gz', 'react-dist.tar.gz'].map(name => ({name, size: 10}));
state.release = {tagName: 'v1.2.3', isDraft: false, isPrerelease: false, assets: stableAssets, url: 'https://example.invalid/release/v1.2.3'};
assertNoWrites(run('release-cli', ['publish', '--version', '1.2.3', '--execute'], 1));
assertNoWrites(run('release-cli', ['verify', '--version', '1.2.3']));
state.release.isDraft = true;
assertNoWrites(run('release-cli', ['verify', '--version', '1.2.3'], 1));
state.release.isDraft = false;
state.release.isPrerelease = true;
assertNoWrites(run('release-cli', ['verify', '--version', '1.2.3'], 1));
state.release.isPrerelease = false;
state.release.assets = [];
assertNoWrites(run('release-cli', ['verify', '--version', '1.2.3'], 1));
state.release.assets = [...stableAssets, {name: 'config.json', size: 100}];
assertNoWrites(run('release-cli', ['verify', '--version', '1.2.3'], 1));
state.release.assets = stableAssets.map(asset => ({...asset, size: 0}));
assertNoWrites(run('release-cli', ['verify', '--version', '1.2.3'], 1));
state.release = null;
state.releasesError = 'authentication failed';
assertNoWrites(run('release-cli', ['publish', '--version', '1.2.3', '--execute'], 1));
state.releasesError = '';

function setVersion(targetFixture, version) {
  targetFixture.write('backend/pom.xml', `<project><revision>${version}</revision></project>\n`);
  for (const rel of ['frontend-react/package.json', 'frontend-vue/package.json']) targetFixture.write(rel, `{"version":"${version}"}\n`);
  targetFixture.git('add', '.');
  targetFixture.git('commit', '-m', `version ${version}`);
  targetFixture.git('push', 'origin', 'main');
}

// 已公开稳定版禁止被相同基线 RC 降版；校验应在调用同步内核之前失败。
const rejectedBump = run('release-cli', ['bump', '--version', '1.2.3-rc1', '--dry-run'], 1);
assertNoWrites(rejectedBump);
assert.match(rejectedBump.stderr, /不高于最新远端 tag/u);

setVersion(fixture, '1.3.0-rc1');
assertNoWrites(run('release-cli', ['tag', '--version', '1.3.0-rc1']));
run('release-cli', ['tag', '--version', '1.3.0-rc1', '--execute']);
assertNoWrites(run('release-cli', ['publish', '--version', '1.3.0-rc1']));
const rcPublished = run('release-cli', ['publish', '--version', '1.3.0-rc1', '--execute']);
const rcCreate = rcPublished.calls.find(call => call.command === 'gh' && call.args[1] === 'create');
assert.ok(rcCreate.args.includes('--prerelease'));
assert.ok(rcCreate.args.includes('--latest=false'));
assert.ok(!published.calls.find(call => call.command === 'gh' && call.args[1] === 'create').args.includes('--prerelease'));
state.release = {tagName: 'v1.3.0-rc1', isDraft: false, isPrerelease: true, assets: [], url: 'https://example.invalid/release/v1.3.0-rc1'};
const rcVerified = run('release-cli', ['verify', '--version', '1.3.0-rc1']);
assertNoWrites(rcVerified);
assert.match(rcVerified.stdout, /SHA=[a-f0-9]+ prerelease=true assets=0/u);
const latestCall = rcVerified.calls.find(call => call.command === 'gh' && call.args[0] === 'api');
assert.ok(latestCall.args.includes('--hostname'));
assert.ok(!latestCall.args.includes('--repo'));
state.release.tagName = 'v1.3.0';
assertNoWrites(run('release-cli', ['verify', '--version', '1.3.0-rc1'], 1));
state.release.tagName = 'v1.3.0-rc1';
state.release.isPrerelease = false;
assertNoWrites(run('release-cli', ['verify', '--version', '1.3.0-rc1'], 1));
state.release.isPrerelease = true;
state.release.isDraft = undefined;
assertNoWrites(run('release-cli', ['verify', '--version', '1.3.0-rc1'], 1));
state.release.isDraft = false;
state.release.assets = [{name: 'test-config.json', size: 3}];
assertNoWrites(run('release-cli', ['verify', '--version', '1.3.0-rc1'], 1));
state.release.assets = [];
state.latestRelease = {tag_name: 'v1.3.0-rc1'};
assertNoWrites(run('release-cli', ['verify', '--version', '1.3.0-rc1'], 1));
state.latestRelease = '{broken JSON';
assertNoWrites(run('release-cli', ['verify', '--version', '1.3.0-rc1'], 1));
state.latestRelease = {};
assertNoWrites(run('release-cli', ['verify', '--version', '1.3.0-rc1'], 1));
state.latestReleaseError = 'authentication failed (HTTP 401)';
assertNoWrites(run('release-cli', ['verify', '--version', '1.3.0-rc1'], 1));
state.latestReleaseError = 'Not Found (HTTP 404)';
assertNoWrites(run('release-cli', ['verify', '--version', '1.3.0-rc1']));
state.latestReleaseError = '';
state.latestRelease = {tag_name: 'v1.0.0'};
write('unrelated.txt', 'advance HEAD after release\n');
git('add', '.');
git('commit', '-m', 'advance HEAD');
const shaMismatch = run('release-cli', ['verify', '--version', '1.3.0-rc1'], 1);
assertNoWrites(shaMismatch);
assert.match(shaMismatch.stderr, /提交 SHA.*HEAD.*不一致/u);

// 远端 RC 的数值顺序与正式晋级通过真实 bare-origin tags 验证。
const order = createRemoteFixture(resolveRepoRoot(path.dirname(fileURLToPath(import.meta.url))), 'release-order');
setVersion(order, '3.0.0-rc1');
for (const tag of ['v3.0.0-rc2', 'v3.0.0-rc10']) {
  order.git('tag', tag);
  order.git('push', 'origin', `refs/tags/${tag}`);
}
const behind = order.run('release-cli', ['plan', '--json'], 1);
order.assertNoWrites(behind);
assert.match(behind.stdout, /"latestRemoteTag": "v3\.0\.0-rc10"/u);
assert.match(behind.stdout, /"suggestedVersion": "3\.0\.0-rc11"/u);
order.assertNoWrites(order.run('release-cli', ['tag', '--version', '3.0.0-rc1', '--execute'], 1));
setVersion(order, '3.0.0');
order.assertNoWrites(order.run('release-cli', ['plan']));
order.assertNoWrites(order.run('release-cli', ['tag', '--version', '3.0.0']));
order.git('tag', 'v3.0.0');
order.git('push', 'origin', 'refs/tags/v3.0.0');
setVersion(order, '3.0.0-rc11');
order.assertNoWrites(order.run('release-cli', ['tag', '--version', '3.0.0-rc11', '--execute'], 1));
order.assertNoWrites(order.run('release-cli', ['plan', '--version', '3.0.0-rc12'], 1));
order.assertNoWrites(order.run('release-cli', ['bump', '--version', '3.0.0-rc12', '--dry-run'], 1));
console.log(`[release-cli-test] PASS preview/execute, RC ordering/promotion, immutable tags, SHA/channel/latest/assets/API gates; fixtures: ${fixture.base}, ${order.base}`);
