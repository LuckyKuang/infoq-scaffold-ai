#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
  console.log('Usage: node skills/release-cli/scripts/verify_release_assets.mjs <asset-directory>\n只读检查 backend-jar/infoq-admin.jar、vue-dist/vue-dist.tar.gz、react-dist/react-dist.tar.gz；每个 artifact 目录仅允许对应的非空普通文件。');
  process.exit(0);
}
try {
  if (args.length !== 1 || args[0].startsWith('-')) throw new Error('需要一个资产目录；未知参数或多余参数不受支持');
  const directory = path.resolve(args[0]);
  const expected = {'backend-jar': 'infoq-admin.jar', 'react-dist': 'react-dist.tar.gz', 'vue-dist': 'vue-dist.tar.gz'};
  if (!fs.lstatSync(directory).isDirectory()) throw new Error('资产根路径必须是普通目录');
  const entries = fs.readdirSync(directory).sort();
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
