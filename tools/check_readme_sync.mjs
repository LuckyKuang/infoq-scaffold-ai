#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const READMES = ['README.md', 'README_CN.md'];
const EXPECTED_SECTIONS = [
  'notice',
  'overview',
  'features',
  'quick-start',
  'deployment',
  'documentation',
  'license',
];
const REQUIRED_LINKS = [
  'doc/README.md',
  'deploy/README.md',
  'deploy/DOCKER.md',
  'deploy/APPLE_CONTAINER.md',
  'deploy/.env.example',
  'CONTRIBUTING.md',
  'DEV_GUIDE.md',
  'SECURITY.md',
  'AGENTS.md',
  'LICENSE',
  'doc/design/DESIGN.md',
  'sql/infoq_scaffold_3.0.0.sql',
];
const SECTION_RE = /<!--\s*readme-section:([a-z0-9-]+)\s*-->/g;
const LINK_RE = /!?\[[^\]]*]\(([^)]+)\)/g;

function localLinkTarget(readmePath, rawTarget) {
  const target = rawTarget.trim().split(/\s+/, 1)[0].replace(/^<|>$/g, '');
  if (!target || /^(#|https?:|mailto:)/i.test(target)) {
    return null;
  }
  const pathText = target.split('#', 1)[0];
  if (!pathText) {
    return null;
  }
  return path.resolve(path.dirname(readmePath), pathText);
}

function main() {
  const errors = [];

  for (const name of READMES) {
    const readmePath = path.join(ROOT, name);
    const text = fs.readFileSync(readmePath, 'utf8');
    const sections = [...text.matchAll(SECTION_RE)].map((match) => match[1]);
    if (sections.join(',') !== EXPECTED_SECTIONS.join(',')) {
      errors.push(
        `${name}: section IDs are ${JSON.stringify(sections)}, expected ${JSON.stringify(EXPECTED_SECTIONS)}`,
      );
    }

    for (const required of REQUIRED_LINKS) {
      if (!text.includes(`](${required})`)) {
        errors.push(`${name}: missing required link ${required}`);
      }
    }

    for (const match of text.matchAll(LINK_RE)) {
      const target = localLinkTarget(readmePath, match[1]);
      if (target && !fs.existsSync(target)) {
        errors.push(`${name}: broken local link ${match[1]}`);
      }
    }
  }

  if (errors.length > 0) {
    console.error('README synchronization check failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log('README structures and local links are synchronized.');
}

main();
