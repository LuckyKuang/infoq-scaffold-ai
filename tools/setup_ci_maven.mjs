#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const version = '3.9.12';
const sha512 = '0a1be79f02466533fc1a80abbef8796e4f737c46c6574ede5658b110899942a94db634477dfd3745501c80aef9aac0d4f841d38574373f7e2d24cce89d694f70';
const archiveUrl = `https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/${version}/apache-maven-${version}-bin.tar.gz`;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 下载、完整性和可执行版本是一个安装边界；全部通过后才向后续 Actions step 发布环境。
export async function setupCiMaven({
  installRoot = path.join(repoRoot, 'tmp', 'ci-maven'),
  githubEnvFile = process.env.GITHUB_ENV,
  githubPathFile = process.env.GITHUB_PATH,
  fetchImpl = fetch,
  expectedSha512 = sha512
} = {}) {
  for (const [name, file] of [['GITHUB_ENV', githubEnvFile], ['GITHUB_PATH', githubPathFile]]) {
    if (!file || !path.isAbsolute(file) || !fs.existsSync(file) || !fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink()) throw new Error(`${name} must name an existing absolute regular file`);
    fs.accessSync(file, fs.constants.W_OK);
  }
  if (githubEnvFile === githubPathFile) throw new Error('GITHUB_ENV and GITHUB_PATH must be separate files');
  if (!path.isAbsolute(installRoot) || /[\r\n]/u.test(installRoot)) throw new Error('Maven installRoot must be an absolute single-line path');
  if (!/^[a-f0-9]{128}$/u.test(expectedSha512)) throw new Error('Invalid Maven SHA-512 pin');
  fs.mkdirSync(installRoot, {recursive: true});
  const staging = fs.mkdtempSync(path.join(installRoot, 'maven-'));
  try {
    const response = await fetchImpl(archiveUrl, {signal: AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error(`Maven download failed: HTTP ${response.status}`);
    const archive = Buffer.from(await response.arrayBuffer());
    if (archive.length === 0 || archive.length > 32 * 1024 * 1024) throw new Error('Maven archive size is invalid');
    if (createHash('sha512').update(archive).digest('hex') !== expectedSha512) throw new Error('Maven archive SHA-512 mismatch');
    const archiveFile = path.join(staging, 'maven.tar.gz');
    fs.writeFileSync(archiveFile, archive, {mode: 0o600, flag: 'wx'});
    const extracted = spawnSync('tar', ['-xzf', archiveFile, '-C', staging], {encoding: 'utf8', timeout: 10000});
    if (extracted.error || extracted.status !== 0) throw new Error('Maven archive extraction failed');
    const mavenHome = path.join(staging, `apache-maven-${version}`);
    const command = path.join(mavenHome, 'bin', process.platform === 'win32' ? 'mvn.cmd' : 'mvn');
    if (!fs.existsSync(command) || !fs.lstatSync(command).isFile() || fs.lstatSync(command).isSymbolicLink()) throw new Error('Maven executable is missing or unsafe');
    if (process.platform !== 'win32') fs.accessSync(command, fs.constants.X_OK);
    const probe = spawnSync(command, ['-v'], {encoding: 'utf8', timeout: 10000, shell: process.platform === 'win32'});
    if (probe.error || probe.status !== 0) throw new Error('Maven version probe failed');
    const actual = `${probe.stdout || ''}${probe.stderr || ''}`.match(/Apache Maven\s+([0-9]+\.[0-9]+\.[0-9]+)(?=\s|$)/u)?.[1];
    if (actual !== version) throw new Error(`Expected Maven ${version}, found ${actual || 'unrecognized version'}`);
    fs.rmSync(archiveFile);
    fs.appendFileSync(githubEnvFile, `MAVEN_HOME=${mavenHome}\n`, 'utf8');
    fs.appendFileSync(githubPathFile, `${path.join(mavenHome, 'bin')}\n`, 'utf8');
    console.log(`[ci-maven] Apache Maven ${actual}; SHA-512 verified; MAVEN_HOME=${mavenHome}`);
    return mavenHome;
  } catch (error) {
    fs.rmSync(staging, {recursive: true, force: true});
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.slice(2).length !== 0) {
    console.error('Usage: node tools/setup_ci_maven.mjs (requires GITHUB_ENV and GITHUB_PATH; installs pinned Maven 3.9.12)');
    process.exitCode = 1;
  } else {
    try { await setupCiMaven(); } catch (error) { console.error(`[ci-maven] FAIL ${error.message}`); process.exitCode = 1; }
  }
}
