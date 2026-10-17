#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolveRepoRoot} from './lib/skill_runtime.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(scriptDir);
const skippedDirectories = [
  '.git', 'node_modules', 'target', 'dist', 'coverage', 'tmp', 'logs',
  '.pnpm-store', '.idea', '.codex', 'openspec/changes',
];

function listMarkdownFiles() {
  return execFileSync('git', ['ls-files', '-z', '*.md'], {cwd: repoRoot, encoding: 'utf8'})
    .split('\0')
    .filter(Boolean)
    .filter((file) => !skippedDirectories.some((directory) => file === directory || file.startsWith(`${directory}/`)));
}

function stripFragments(target) {
  const hashIndex = target.indexOf('#');
  const queryIndex = target.indexOf('?');
  const cutIndex = [hashIndex, queryIndex].filter((index) => index >= 0).sort((a, b) => a - b)[0];
  return cutIndex === undefined ? target : target.slice(0, cutIndex);
}

function isExternal(target) {
  return /^(?:[a-z][a-z0-9+.-]*:)?\/\//iu.test(target)
    || target.startsWith('mailto:')
    || target.startsWith('tel:')
    || target.startsWith('#')
    || target.startsWith('data:');
}

function isTemplate(target) {
  return target.includes('<') || target.includes('>') || target.includes('{{') || target.includes('${');
}

const files = listMarkdownFiles();
const failures = [];
let checkedLinks = 0;

for (const relativeFile of files) {
  const absoluteFile = path.join(repoRoot, relativeFile);
  const lines = fs.readFileSync(absoluteFile, 'utf8').split(/\r?\n/u);
  let inFence = false;
  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const line = lines[lineNumber];
    if (/^\s*(```|~~~)/u.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    for (const match of line.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/gu)) {
      const rawTarget = match[1].trim();
      if (!rawTarget || isExternal(rawTarget) || isTemplate(rawTarget)) continue;
      const target = stripFragments(rawTarget);
      if (!target) continue;
      const resolved = target.startsWith('/')
        ? path.join(repoRoot, target.replace(/^\/+/u, ''))
        : path.resolve(path.dirname(absoluteFile), target);
      checkedLinks += 1;
      if (!fs.existsSync(resolved)) {
        failures.push(`${relativeFile}:${lineNumber + 1} -> ${rawTarget}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`[doc-links] FAIL: ${failures.length} broken link(s) across ${files.length} files`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`[doc-links] OK: checked ${checkedLinks} local links across ${files.length} markdown files`);
