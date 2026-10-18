#!/usr/bin/env node
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {releaseVersionFromTag} from '../../../tools/lib/release_version.mjs';

export function releasePolicy(tag) {
  const version = releaseVersionFromTag(tag);
  if (!version) throw new Error(`无效发布 tag：${tag}；仅支持 vx.y.z 或 vx.y.z-rcN（N>0、无前导零）`);
  return {
    version: version.version,
    channel: version.isPrerelease ? 'rc' : 'stable',
    artifact_policy: version.isPrerelease ? 'source-only' : 'compiled',
    prerelease: version.isPrerelease,
    make_latest: !version.isPrerelease
  };
}

export function assertPublishAllowed(tag, verifyResult, adminResult) {
  const policy = releasePolicy(tag);
  const allowedResults = ['success', 'failure', 'cancelled', 'skipped'];
  for (const result of [verifyResult, adminResult]) {
    if (!allowedResults.includes(result)) throw new Error(`无效上游 job 结果：${result}`);
  }
  const expectedAdmin = policy.channel === 'rc' ? 'skipped' : 'success';
  if (verifyResult !== 'success' || adminResult !== expectedAdmin) {
    throw new Error(`禁止发布 ${tag}：verify=${verifyResult}, package-admin=${adminResult}；${policy.channel} 要求 verify=success, package-admin=${expectedAdmin}`);
  }
  return policy;
}

function main(args) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log('Usage: node skills/release-cli/scripts/release_policy.mjs classify --tag <vx.y.z[-rcN]> [--github-output <file>]\n       node skills/release-cli/scripts/release_policy.mjs gate --tag <vx.y.z[-rcN]> --verify-result <result> --admin-result <result>\n按已校验 tag 选择源码 RC 或受控正式产物；失败/取消的上游不得发布。');
    return;
  }
  const command = args.shift();
  if (!['classify', 'gate'].includes(command)) throw new Error('需要 classify 或 gate 子命令');
  const allowed = command === 'classify' ? ['--tag', '--github-output'] : ['--tag', '--verify-result', '--admin-result'];
  const options = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index];
    if (!allowed.includes(option)) throw new Error(`未知参数：${option}`);
    if (options.has(option)) throw new Error(`重复参数：${option}`);
    const value = args[index + 1];
    if (!value || value.startsWith('-')) throw new Error(`参数缺值：${option}`);
    options.set(option, value);
  }
  if (!options.has('--tag')) throw new Error('需要 --tag');
  const policy = command === 'gate'
    ? assertPublishAllowed(options.get('--tag'), options.get('--verify-result'), options.get('--admin-result'))
    : releasePolicy(options.get('--tag'));
  const output = options.get('--github-output');
  if (output) fs.appendFileSync(output, Object.entries(policy).map(([key, value]) => `${key}=${value}\n`).join(''), 'utf8');
  console.log(JSON.stringify(policy));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`Release policy failed: ${error.message}`);
    process.exitCode = 1;
  }
}
