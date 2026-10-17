#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {TextDecoder} from 'node:util';
import {fileURLToPath} from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const decoder = new TextDecoder('utf-8', {fatal: true});

const skippedDirectoryNames = new Set([
  '.cache',
  '.git',
  '.next',
  '.nuxt',
  '.output',
  '.playwright-mcp',
  '.pnpm-store',
  '.runtime-logs',
  '.swc',
  '.svelte-kit',
  '.turbo',
  '.vite',
  'allure-results',
  'build',
  'coverage',
  'dist',
  'logs',
  'node_modules',
  'out',
  'playwright-report',
  'storybook-static',
  'target',
  'test-results'
]);

const skippedRelativeDirectories = new Set([
  'tmp'
]);

const skippedEntryNames = new Set([
  '.DS_Store'
]);

const binaryExtensions = new Set([
  '.7z',
  '.a',
  '.avi',
  '.avif',
  '.bin',
  '.bmp',
  '.bz2',
  '.class',
  '.dat',
  '.db',
  '.dll',
  '.doc',
  '.docx',
  '.dylib',
  '.eot',
  '.exe',
  '.gif',
  '.gz',
  '.ico',
  '.jar',
  '.jpeg',
  '.jpg',
  '.jks',
  '.keystore',
  '.mov',
  '.mp3',
  '.mp4',
  '.node',
  '.otf',
  '.p12',
  '.pdf',
  '.pfx',
  '.png',
  '.ppt',
  '.pptx',
  '.rar',
  '.so',
  '.sqlite',
  '.tar',
  '.tgz',
  '.tif',
  '.tiff',
  '.ttf',
  '.war',
  '.wasm',
  '.wav',
  '.webm',
  '.webp',
  '.woff',
  '.woff2',
  '.xls',
  '.xlsx',
  '.xdb',
  '.xz',
  '.zip'
]);

function resolveRepoRoot(startDir) {
  let currentDir = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(currentDir, 'AGENTS.md')) && fs.existsSync(path.join(currentDir, 'skills'))) {
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

function usage() {
  console.log(`Usage: node tools/validate_utf8.mjs [paths...]

Validates repository text files with the repository UTF-8 policy:
  - strict UTF-8 decoding
  - UTF-8 BOM is rejected
  - UTF-16/UTF-32 BOM is rejected
  - unreadable, missing, or outside-repository paths fail
  - dependency, build, cache, log, temp, macOS metadata, and obvious binary files are skipped

Path arguments are resolved relative to the repository root.
Explicit file paths are checked even if they are under a normally skipped directory,
except globally ignored metadata entries such as .DS_Store.

Examples:
  node tools/validate_utf8.mjs
  node tools/validate_utf8.mjs AGENTS.md frontend-react/src
  node tools/validate_utf8.mjs -- tools/validate_utf8.mjs`);
}

function parseArgs(argv) {
  const paths = [];
  let passthrough = false;

  for (const arg of argv) {
    if (!passthrough && arg === '--') {
      passthrough = true;
      continue;
    }
    if (!passthrough && (arg === '-h' || arg === '--help')) {
      usage();
      process.exit(0);
    }
    if (!passthrough && arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }
    paths.push(arg);
  }

  return paths.length > 0 ? paths : ['.'];
}

function repoRelative(filePath) {
  const relativePath = path.relative(repoRoot, filePath);
  return relativePath === '' ? '.' : relativePath.split(path.sep).join('/');
}

function isInsideRepo(filePath) {
  const relativePath = path.relative(repoRoot, filePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function resolveInputPath(inputPath) {
  const resolvedPath = path.resolve(repoRoot, inputPath);
  if (!isInsideRepo(resolvedPath)) {
    return {
      ok: false,
      path: resolvedPath,
      reason: 'path is outside repository root'
    };
  }
  return {
    ok: true,
    path: resolvedPath
  };
}

function shouldSkipDirectory(directoryPath) {
  const relativePath = repoRelative(directoryPath);
  return skippedDirectoryNames.has(path.basename(directoryPath)) || skippedRelativeDirectories.has(relativePath);
}

function shouldSkipEntry(entryPath) {
  return skippedEntryNames.has(path.basename(entryPath));
}

function shouldSkipBinaryExtension(filePath) {
  return binaryExtensions.has(path.extname(filePath).toLowerCase());
}

function hasUtf8Bom(buffer) {
  return buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
}

function detectNonUtf8Bom(buffer) {
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xfe && buffer[2] === 0x00 && buffer[3] === 0x00) {
    return 'UTF-32 LE BOM';
  }
  if (buffer.length >= 4 && buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0xfe && buffer[3] === 0xff) {
    return 'UTF-32 BE BOM';
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return 'UTF-16 LE BOM';
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return 'UTF-16 BE BOM';
  }
  return '';
}

function collectFiles(targetPaths) {
  const files = new Set();
  const failures = [];
  let skippedDirectories = 0;
  let skippedEntries = 0;

  function collectFile(filePath) {
    files.add(path.resolve(filePath));
  }

  function walkDirectory(directoryPath) {
    let entries;
    try {
      entries = fs.readdirSync(directoryPath, {withFileTypes: true});
    } catch (error) {
      failures.push({
        path: repoRelative(directoryPath),
        reason: `cannot read directory: ${error.message}`
      });
      return;
    }

    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const entryPath = path.join(directoryPath, entry.name);
      if (shouldSkipEntry(entryPath)) {
        skippedEntries += 1;
        continue;
      }
      if (entry.isSymbolicLink()) {
        skippedEntries += 1;
        continue;
      }
      if (entry.isDirectory()) {
        if (shouldSkipDirectory(entryPath)) {
          skippedDirectories += 1;
          continue;
        }
        walkDirectory(entryPath);
        continue;
      }
      if (entry.isFile()) {
        collectFile(entryPath);
        continue;
      }
      skippedEntries += 1;
    }
  }

  for (const inputPath of targetPaths) {
    const resolvedInput = resolveInputPath(inputPath);
    if (!resolvedInput.ok) {
      failures.push({
        path: inputPath,
        reason: resolvedInput.reason
      });
      continue;
    }

    let stats;
    try {
      stats = fs.lstatSync(resolvedInput.path);
    } catch (error) {
      failures.push({
        path: inputPath,
        reason: error.code === 'ENOENT' ? 'path does not exist' : `cannot read path: ${error.message}`
      });
      continue;
    }

    if (stats.isSymbolicLink()) {
      skippedEntries += 1;
      continue;
    }
    if (shouldSkipEntry(resolvedInput.path)) {
      skippedEntries += 1;
      continue;
    }
    if (stats.isFile()) {
      collectFile(resolvedInput.path);
      continue;
    }
    if (stats.isDirectory()) {
      if (resolvedInput.path !== repoRoot && shouldSkipDirectory(resolvedInput.path)) {
        skippedDirectories += 1;
        continue;
      }
      walkDirectory(resolvedInput.path);
      continue;
    }

    skippedEntries += 1;
  }

  return {
    files: Array.from(files).sort((left, right) => repoRelative(left).localeCompare(repoRelative(right))),
    failures,
    skippedDirectories,
    skippedEntries
  };
}

function validateFile(filePath) {
  if (shouldSkipBinaryExtension(filePath)) {
    return {
      status: 'skipped',
      reason: 'binary extension'
    };
  }

  let buffer;
  try {
    buffer = fs.readFileSync(filePath);
  } catch (error) {
    return {
      status: 'failed',
      reason: `cannot read file: ${error.message}`
    };
  }

  if (hasUtf8Bom(buffer)) {
    return {
      status: 'failed',
      reason: 'has UTF-8 BOM'
    };
  }

  const nonUtf8Bom = detectNonUtf8Bom(buffer);
  if (nonUtf8Bom) {
    return {
      status: 'failed',
      reason: `has ${nonUtf8Bom}`
    };
  }

  const nulIndex = buffer.indexOf(0);
  if (nulIndex !== -1) {
    return {
      status: 'failed',
      reason: `contains NUL byte at offset ${nulIndex} (binary or non-UTF-8 text)`
    };
  }

  try {
    decoder.decode(buffer);
  } catch (error) {
    return {
      status: 'failed',
      reason: `invalid UTF-8: ${error.message}`
    };
  }

  return {
    status: 'checked'
  };
}

function main() {
  const targetPaths = parseArgs(process.argv.slice(2));
  const collection = collectFiles(targetPaths);
  const failures = [...collection.failures];
  let checkedFiles = 0;
  let skippedFiles = 0;

  for (const filePath of collection.files) {
    const result = validateFile(filePath);
    if (result.status === 'checked') {
      checkedFiles += 1;
      continue;
    }
    if (result.status === 'skipped') {
      skippedFiles += 1;
      continue;
    }
    failures.push({
      path: repoRelative(filePath),
      reason: result.reason
    });
  }

  if (failures.length > 0) {
    console.error('[utf8] FAILED');
    for (const failure of failures) {
      console.error(`  ${failure.path}: ${failure.reason}`);
    }
    console.error(`[utf8] checked ${checkedFiles} text files, skipped ${skippedFiles} files, skipped ${collection.skippedDirectories} directories, skipped ${collection.skippedEntries} other entries, failures ${failures.length}.`);
    process.exit(1);
  }

  console.log(`[utf8] OK: checked ${checkedFiles} text files, skipped ${skippedFiles} files, skipped ${collection.skippedDirectories} directories, skipped ${collection.skippedEntries} other entries.`);
}

try {
  main();
} catch (error) {
  console.error(`[utf8] ${error.message}`);
  process.exit(1);
}
