#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveRepoRoot} from '../../../lib/skill_runtime.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(scriptDir);
const root = path.join(repoRoot, 'infoq-scaffold-backend', 'infoq-modules', 'infoq-system', 'src', 'main', 'java', 'cc', 'infoq', 'system');
const testRoot = path.join(repoRoot, 'infoq-scaffold-backend', 'infoq-modules', 'infoq-system', 'src', 'test', 'java', 'cc', 'infoq', 'system');

function collectJavaStems(baseDir) {
  const items = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.java')) {
        items.push(path.basename(entry.name, '.java'));
      }
    }
  };
  visit(baseDir);
  return items;
}

const tests = new Set(
  collectJavaStems(testRoot)
    .filter((name) => name.endsWith('Test'))
    .map((name) => name.slice(0, -4))
);

for (const relPath of ['controller', path.join('service', 'impl')]) {
  const classes = collectJavaStems(path.join(root, relPath));
  const missing = classes.filter((name) => !tests.has(name)).sort();
  console.log(`${relPath.replace(/\\/g, '/')} missing=${missing.length}`);
  if (missing.length > 0) {
    console.log(`  ${missing.join(', ')}`);
  }
}
