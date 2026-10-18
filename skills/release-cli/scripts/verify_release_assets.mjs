#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {parseReleaseVersion} from '../../../tools/lib/release_version.mjs';

const args = process.argv.slice(2);
if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
  console.log('Usage: node skills/release-cli/scripts/verify_release_assets.mjs <asset-directory> --version <x.y.z[-rcN]>\n按显式版本只读检查：RC 目录必须为空；正式版仅允许 backend-jar/infoq-admin.jar、vue-dist/vue-dist.tar.gz、react-dist/react-dist.tar.gz 三个非空普通文件。');
  process.exit(0);
}
try {
  if (args.length !== 3 || !args[0] || args[0].startsWith('-') || args[1] !== '--version') throw new Error('需要一个资产目录和显式 --version；未知、重复、缺值或多余参数不受支持');
  const version = parseReleaseVersion(args[2]);
  if (!version) throw new Error('无效 --version；仅支持 x.y.z 或 x.y.z-rcN（N>0、无前导零）');
  const directory = path.resolve(args[0]);
  const expected = {'backend-jar': 'infoq-admin.jar', 'react-dist': 'react-dist.tar.gz', 'vue-dist': 'vue-dist.tar.gz'};
  if (!fs.lstatSync(directory).isDirectory()) throw new Error('资产根路径必须是普通目录');
  const entries = fs.readdirSync(directory).sort();
  if (version.isPrerelease) {
    if (entries.length !== 0) throw new Error(`RC 源码发布禁止附加资产：${entries.join(', ')}`);
    console.log('Release assets check passed: source-only RC, 0 attached files');
    process.exit(0);
  }
  if (JSON.stringify(entries) !== JSON.stringify(Object.keys(expected))) throw new Error(`资产集合错误：期望目录 ${Object.keys(expected).join(', ')}，实际 ${entries.join(', ') || '(empty)'}`);
  for (const [artifact, name] of Object.entries(expected)) {
    const artifactDirectory = path.join(directory, artifact);
    if (!fs.lstatSync(artifactDirectory).isDirectory()) throw new Error(`artifact 必须是普通目录：${artifact}`);
    const files = fs.readdirSync(artifactDirectory);
    if (files.length !== 1 || files[0] !== name) throw new Error(`资产集合错误：${artifact} 仅允许 ${name}，实际 ${files.join(', ') || '(empty)'}`);
    const stat = fs.lstatSync(path.join(artifactDirectory, name));
    if (!stat.isFile() || stat.size === 0) throw new Error(`资产必须是非空普通文件：${artifact}/${name}`);
  }
  console.log('Release assets check passed: 3 non-empty files');
} catch (error) {
  console.error(`Release assets check failed: ${error.message}`);
  process.exitCode = 1;
}
