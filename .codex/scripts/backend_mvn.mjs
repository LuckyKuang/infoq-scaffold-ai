#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

function resolveRepoRoot(startDir) {
  let currentDir = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(currentDir, 'AGENTS.md')) && fs.existsSync(path.join(currentDir, '.codex'))) {
      return currentDir;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error(`Failed to resolve repository root from ${startDir}`);
    }
    currentDir = parentDir;
  }
}

const repoRoot = resolveRepoRoot(scriptDir);
const backendDir = path.join(repoRoot, 'infoq-scaffold-backend');

function usage() {
  console.log(`Usage: node .codex/scripts/backend_mvn.mjs [options] -- <maven args>

Runs backend Maven with the repository environment policy:
  1. Prefer .idea project Maven/JDK settings.
  2. Require JDK 17.
  3. Require Maven 3.9.x.
  4. Fall back to local OS search when .idea settings are unusable.

Options:
  --dry-run       Resolve and print the selected environment without running Maven.
  -h, --help      Show help.

Examples:
  node .codex/scripts/backend_mvn.mjs -- validate
  node .codex/scripts/backend_mvn.mjs -- -pl infoq-plugin/infoq-plugin-sensitive -am -DskipTests=false test`);
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    mavenArgs: []
  };

  let passthrough = false;
  for (const arg of argv) {
    if (passthrough) {
      options.mavenArgs.push(arg);
      continue;
    }
    switch (arg) {
      case '--':
        passthrough = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '-h':
      case '--help':
        usage();
        process.exit(0);
        break;
      default:
        options.mavenArgs.push(arg);
        break;
    }
  }

  if (options.mavenArgs.length === 0) {
    usage();
    throw new Error('Missing Maven arguments.');
  }

  return options;
}

function readFileIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function xmlOptionValue(source, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const match = source.match(new RegExp(`<option\\s+name="${escaped}"\\s+value="([^"]*)"`, 'u'));
  return match?.[1] ?? '';
}

function parseIdeaSettings() {
  const ideaDir = path.join(repoRoot, '.idea');
  const misc = readFileIfExists(path.join(ideaDir, 'misc.xml'));
  const workspace = readFileIfExists(path.join(ideaDir, 'workspace.xml'));
  const projectJdkMatch = misc.match(/project-jdk-name="([^"]+)"/u);

  return {
    projectJdkName: projectJdkMatch?.[1] ?? '',
    customMavenHome: xmlOptionValue(workspace, 'customMavenHome'),
    localRepository: xmlOptionValue(workspace, 'localRepository'),
    jdkForImporter: xmlOptionValue(workspace, 'jdkForImporter'),
    runnerJreName: xmlOptionValue(workspace, 'jreName')
  };
}

function isPathUsableOnCurrentOs(value) {
  if (!value) {
    return false;
  }
  if (process.platform !== 'win32' && /^[A-Za-z]:\\/u.test(value)) {
    return false;
  }
  if (process.platform === 'win32' && value.startsWith('/')) {
    return false;
  }
  return true;
}

function uniqueByPath(candidates) {
  const seen = new Set();
  const result = [];
  for (const candidate of candidates) {
    const key = `${candidate.command ?? ''}|${candidate.home ?? ''}|${candidate.source}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(candidate);
  }
  return result;
}

function normalizeToken(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/gu, '');
}

function javaCommandFromHome(home) {
  return path.join(home, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
}

function mavenCommandFromHome(home) {
  return path.join(home, 'bin', process.platform === 'win32' ? 'mvn.cmd' : 'mvn');
}

function parseJavaMajor(output) {
  const match = output.match(/version\s+"([^"]+)"/u);
  const version = match?.[1] ?? '';
  if (!version) {
    return {version: '', major: NaN};
  }
  const parts = version.split('.');
  const major = parts[0] === '1' ? Number(parts[1]) : Number(parts[0]);
  return {version, major};
}

function parseMavenVersion(output) {
  const match = output.match(/Apache Maven\s+([0-9]+(?:\.[0-9]+){1,2})/u);
  return match?.[1] ?? '';
}

function runVersion(command, args = [], env = process.env) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    shell: process.platform === 'win32' && /\.(?:cmd|bat)$/iu.test(command)
  });
  if (result.error || result.status !== 0) {
    return {
      ok: false,
      output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim(),
      error: result.error?.message ?? ''
    };
  }
  return {
    ok: true,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim(),
    error: ''
  };
}

function listDirectories(rootDir, depth = 1) {
  if (!rootDir || !fs.existsSync(rootDir)) {
    return [];
  }

  const result = [];
  function visit(currentDir, remainingDepth) {
    let entries = [];
    try {
      entries = fs.readdirSync(currentDir, {withFileTypes: true});
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const fullPath = path.join(currentDir, entry.name);
      result.push(fullPath);
      if (remainingDepth > 0) {
        visit(fullPath, remainingDepth - 1);
      }
    }
  }

  visit(rootDir, depth);
  return result;
}

function jdkSearchRoots() {
  if (process.platform === 'win32') {
    return [
      'C:\\DevTools',
      process.env.JAVA_HOME ? path.dirname(process.env.JAVA_HOME) : '',
      process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'Java') : '',
      process.env['ProgramFiles(x86)'] ? path.join(process.env['ProgramFiles(x86)'], 'Java') : ''
    ].filter(Boolean);
  }

  if (process.platform === 'darwin') {
    return [
      '/Library/Java/JavaVirtualMachines',
      path.join(os.homedir(), 'Library', 'Java', 'JavaVirtualMachines'),
      '/opt/homebrew/opt',
      '/usr/local/opt'
    ];
  }

  return [
    '/usr/lib/jvm',
    '/opt',
    '/opt/java',
    '/opt/jdk',
    path.join(os.homedir(), '.jdks')
  ];
}

function mavenSearchRoots() {
  if (process.platform === 'win32') {
    return [
      'C:\\DevTools',
      process.env.MAVEN_HOME ? path.dirname(process.env.MAVEN_HOME) : '',
      process.env.M2_HOME ? path.dirname(process.env.M2_HOME) : ''
    ].filter(Boolean);
  }

  if (process.platform === 'darwin') {
    return [
      '/opt/homebrew/opt',
      '/usr/local/opt',
      '/usr/local',
      '/opt',
      path.join(os.homedir(), '.maven')
    ];
  }

  return [
    '/usr/share',
    '/usr/local',
    '/opt',
    path.join(os.homedir(), '.maven')
  ];
}

function addMacJavaHomeCandidate(candidates) {
  if (process.platform !== 'darwin') {
    return;
  }

  const result = spawnSync('/usr/libexec/java_home', ['-v', '17'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    windowsHide: true
  });
  const home = result.status === 0 ? result.stdout.trim() : '';
  if (home) {
    candidates.push({home, source: 'macos java_home -v 17'});
  }
}

function discoverJdkHomes(idea) {
  const candidates = [];
  const preferredName = idea.runnerJreName || idea.jdkForImporter || idea.projectJdkName;
  const preferredToken = normalizeToken(preferredName);

  addMacJavaHomeCandidate(candidates);

  const searchedDirs = [];
  for (const root of jdkSearchRoots()) {
    const dirs = listDirectories(root, process.platform === 'win32' ? 2 : 2);
    searchedDirs.push(...dirs);
  }

  const matchingIdeaDirs = searchedDirs.filter((dir) => {
    const base = normalizeToken(path.basename(dir));
    return preferredToken && (base.includes(preferredToken) || preferredToken.includes(base));
  });

  for (const dir of matchingIdeaDirs) {
    candidates.push({home: dir, source: `.idea JDK name ${preferredName}`});
  }

  if (process.env.JAVA_HOME) {
    candidates.push({home: process.env.JAVA_HOME, source: 'JAVA_HOME'});
  }

  for (const dir of searchedDirs) {
    const base = normalizeToken(path.basename(dir));
    if (base.includes('jdk17') || base.includes('java17') || base.includes('zulu17') || base.includes('temurin17')) {
      candidates.push({home: dir, source: 'local JDK17 search'});
    }
  }

  candidates.push({command: 'java', source: 'PATH java'});
  return uniqueByPath(candidates);
}

function validateJdkCandidate(candidate) {
  const command = candidate.command || javaCommandFromHome(candidate.home);
  if (!candidate.command && !fs.existsSync(command)) {
    return null;
  }

  const versionResult = runVersion(command, ['-version']);
  if (!versionResult.ok) {
    return null;
  }

  const {version, major} = parseJavaMajor(versionResult.output);
  if (major !== 17) {
    return null;
  }

  return {
    ...candidate,
    command,
    version
  };
}

function resolveJdk(idea) {
  for (const candidate of discoverJdkHomes(idea)) {
    const validated = validateJdkCandidate(candidate);
    if (validated) {
      return validated;
    }
  }
  throw new Error('No usable JDK 17 found from .idea settings, JAVA_HOME, PATH, or local search.');
}

function discoverMavenHomes(idea) {
  const candidates = [];

  if (isPathUsableOnCurrentOs(idea.customMavenHome)) {
    candidates.push({home: idea.customMavenHome, source: '.idea customMavenHome'});
  }

  if (process.env.MAVEN_HOME) {
    candidates.push({home: process.env.MAVEN_HOME, source: 'MAVEN_HOME'});
  }

  if (process.env.M2_HOME) {
    candidates.push({home: process.env.M2_HOME, source: 'M2_HOME'});
  }

  const searchedDirs = [];
  for (const root of mavenSearchRoots()) {
    searchedDirs.push(...listDirectories(root, 2));
  }

  for (const dir of searchedDirs) {
    const base = normalizeToken(path.basename(dir));
    if (base.includes('maven') || base === 'libexec') {
      candidates.push({home: dir, source: 'local Maven search'});
    }
  }

  candidates.push({command: process.platform === 'win32' ? 'mvn.cmd' : 'mvn', source: 'PATH mvn'});
  return uniqueByPath(candidates);
}

function makeMavenEnv(jdk) {
  const env = {...process.env};
  if (jdk.home) {
    env.JAVA_HOME = jdk.home;
    env.Path = process.platform === 'win32'
      ? `${path.join(jdk.home, 'bin')}${path.delimiter}${env.Path ?? env.PATH ?? ''}`
      : env.Path;
    env.PATH = `${path.join(jdk.home, 'bin')}${path.delimiter}${env.PATH ?? env.Path ?? ''}`;
  }
  return env;
}

function validateMavenCandidate(candidate, env) {
  const command = candidate.command || mavenCommandFromHome(candidate.home);
  if (!candidate.command && !fs.existsSync(command)) {
    return null;
  }

  const versionResult = runVersion(command, ['-v'], env);
  if (!versionResult.ok) {
    return null;
  }

  const version = parseMavenVersion(versionResult.output);
  if (!/^3\.9\./u.test(version)) {
    return null;
  }

  return {
    ...candidate,
    command,
    version
  };
}

function resolveMaven(idea, env) {
  for (const candidate of discoverMavenHomes(idea)) {
    const validated = validateMavenCandidate(candidate, env);
    if (validated) {
      return validated;
    }
  }
  throw new Error('No usable Maven 3.9.x found from .idea settings, MAVEN_HOME/M2_HOME, PATH, or local search.');
}

function resolveLocalRepository(idea) {
  if (isPathUsableOnCurrentOs(idea.localRepository)) {
    return {path: idea.localRepository, source: '.idea localRepository'};
  }
  if (process.env.MAVEN_REPO_LOCAL) {
    return {path: process.env.MAVEN_REPO_LOCAL, source: 'MAVEN_REPO_LOCAL'};
  }
  return null;
}

function resolveDefaultLocalRepository() {
  const home = os.homedir();
  if (!home) {
    return null;
  }
  return {path: path.join(home, '.m2', 'repository'), source: 'default user home localRepository'};
}

function hasLocalRepoArg(args) {
  return args.some((arg) => arg === '-Dmaven.repo.local' || arg.startsWith('-Dmaven.repo.local='));
}

function hasSystemPropertyArg(args, name) {
  const propertyPrefix = `-D${name}`;
  return args.some((arg) => arg === propertyPrefix || arg.startsWith(`${propertyPrefix}=`));
}

function canWriteMapstructPlusIncrementMark() {
  const home = os.homedir();
  if (!home) {
    return false;
  }
  const markerDir = path.join(home, '.msp');
  const markerFile = path.join(markerDir, 'incrementMark');
  const probePath = fs.existsSync(markerFile)
    ? markerFile
    : fs.existsSync(markerDir)
      ? markerDir
      : home;
  try {
    fs.accessSync(probePath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveManagedUserHome(args) {
  if (hasSystemPropertyArg(args, 'user.home') || canWriteMapstructPlusIncrementMark()) {
    return null;
  }
  return {
    path: path.join(repoRoot, 'doc', 'tmp', 'backend-mvn-home'),
    source: 'mapstruct-plus incrementMark write guard'
  };
}

function printSelection(selection) {
  console.log(`[backend-mvn] cwd: ${backendDir}`);
  console.log(`[backend-mvn] JDK: ${selection.jdk.home || selection.jdk.command} (version=${selection.jdk.version}, source=${selection.jdk.source})`);
  console.log(`[backend-mvn] Maven: ${selection.maven.command} (version=${selection.maven.version}, source=${selection.maven.source})`);
  if (selection.managedUserHome) {
    console.log(`[backend-mvn] Maven user.home: ${selection.managedUserHome.path} (source=${selection.managedUserHome.source})`);
  }
  if (selection.localRepository) {
    console.log(`[backend-mvn] Maven local repo: ${selection.localRepository.path} (source=${selection.localRepository.source})`);
  } else {
    console.log('[backend-mvn] Maven local repo: Maven default');
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(backendDir)) {
    throw new Error(`Backend workspace not found: ${backendDir}`);
  }

  const idea = parseIdeaSettings();
  const jdk = resolveJdk(idea);
  const env = makeMavenEnv(jdk);
  const maven = resolveMaven(idea, env);
  const managedUserHome = resolveManagedUserHome(options.mavenArgs);
  let localRepository = resolveLocalRepository(idea);
  const mavenArgs = [...options.mavenArgs];

  if (managedUserHome) {
    fs.mkdirSync(managedUserHome.path, {recursive: true});
    mavenArgs.unshift(`-Duser.home=${managedUserHome.path}`);
    if (!localRepository && !hasLocalRepoArg(mavenArgs)) {
      localRepository = resolveDefaultLocalRepository();
    }
  }

  if (localRepository && !hasLocalRepoArg(mavenArgs)) {
    mavenArgs.unshift(`-Dmaven.repo.local=${localRepository.path}`);
  }

  const selection = {jdk, maven, managedUserHome, localRepository};
  printSelection(selection);

  if (options.dryRun) {
    console.log(`[backend-mvn] dry-run Maven args: ${mavenArgs.join(' ')}`);
    return;
  }

  const child = spawn(maven.command, mavenArgs, {
    cwd: backendDir,
    env,
    stdio: 'inherit',
    windowsHide: true,
    shell: process.platform === 'win32' && /\.(?:cmd|bat)$/iu.test(maven.command)
  });

  child.on('error', (error) => {
    console.error(error.message || error);
    process.exit(1);
  });
  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}

try {
  main();
} catch (error) {
  console.error(`[backend-mvn] ${error.message || error}`);
  process.exit(1);
}
