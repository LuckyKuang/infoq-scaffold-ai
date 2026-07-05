import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';

function getCommand(baseName) {
  return process.platform === 'win32' ? `${baseName}.cmd` : baseName;
}

function getDefaultNpmCacheDir() {
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      return path.join(localAppData, 'npm-cache');
    }
  }

  return path.join(os.homedir(), '.npm');
}

function getNpmCacheDirs(repoRoot) {
  const candidates = [];
  const repoCache = path.join(repoRoot, '.codex', 'tmp', 'npm-cache');

  candidates.push(repoCache);

  if (process.env.npm_config_cache) {
    candidates.push(process.env.npm_config_cache);
  }

  const npmCommand = getCommand('npm');
  const result = spawnSync(npmCommand, ['config', 'get', 'cache'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  if (result.status === 0) {
    const cacheDir = result.stdout.trim();
    if (cacheDir && cacheDir !== 'undefined' && cacheDir !== 'null') {
      candidates.push(cacheDir);
    }
  }

  candidates.push(getDefaultNpmCacheDir());

  return [...new Set(candidates.filter(Boolean))];
}

function findPackageEntry(packageRoot) {
  const candidate = path.join(packageRoot, 'dist', 'index.js');
  if (fs.existsSync(candidate)) {
    return candidate;
  }

  const packageJsonPath = path.join(packageRoot, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const bin = packageJson.bin;
    const binEntry = typeof bin === 'string' ? bin : Object.values(bin || {})[0];

    if (typeof binEntry === 'string') {
      const binCandidate = path.join(packageRoot, binEntry);
      if (fs.existsSync(binCandidate)) {
        return binCandidate;
      }
    }
  }

  const indexCandidate = path.join(packageRoot, 'index.js');
  return fs.existsSync(indexCandidate) ? indexCandidate : null;
}

function findEntryFromNodeModulesRoot(nodeModulesRoot, packageName) {
  const packageRoot = path.join(nodeModulesRoot, ...packageName.split('/'));
  return findPackageEntry(packageRoot);
}

function findEntryInCache(cacheDir, packageName) {
  const npxRoot = path.join(cacheDir, '_npx');
  if (!fs.existsSync(npxRoot)) {
    return null;
  }

  const installDirs = fs
    .readdirSync(npxRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => b.name.localeCompare(a.name));

  for (const installDir of installDirs) {
    const entryFile = findEntryFromNodeModulesRoot(
      path.join(npxRoot, installDir.name, 'node_modules'),
      packageName
    );
    if (entryFile) {
      return entryFile;
    }
  }

  return null;
}

export function launchCachedMcpPackage({ repoRoot, packageName, env, label }) {
  const cacheDirs = getNpmCacheDirs(repoRoot);

  for (const cacheDir of cacheDirs) {
    const directNodeModulesEntry = findEntryFromNodeModulesRoot(path.join(cacheDir, 'node_modules'), packageName);
    if (directNodeModulesEntry) {
      console.error(`[${label}] launching cached package from ${directNodeModulesEntry}`);
      return spawn(process.execPath, [directNodeModulesEntry], {
        cwd: repoRoot,
        env,
        stdio: 'inherit',
      });
    }

    const npxCacheEntry = findEntryInCache(cacheDir, packageName);
    if (npxCacheEntry) {
      console.error(`[${label}] launching cached npx package from ${npxCacheEntry}`);
      return spawn(process.execPath, [npxCacheEntry], {
        cwd: repoRoot,
        env,
        stdio: 'inherit',
      });
    }
  }

  const repoCache = path.join(repoRoot, '.codex', 'tmp', 'npm-cache');
  fs.mkdirSync(repoCache, { recursive: true });

  console.error(`[${label}] cached package not found; falling back to npx download`);
  return spawn(getCommand('npx'), ['-y', packageName], {
    cwd: repoRoot,
    env: {
      ...env,
      npm_config_cache: repoCache,
    },
    stdio: 'inherit',
  });
}
