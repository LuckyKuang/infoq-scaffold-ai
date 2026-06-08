#!/usr/bin/env node
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {normalizeForwardedArgs, resolveRepoRoot} from '../../../lib/skill_runtime.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(scriptDir);
const verifyLoginPath = path.join(repoRoot, '.codex', 'skills', 'infoq-backend-verify', 'scripts', 'verify_login.mjs');
const args = normalizeForwardedArgs(process.argv.slice(2));

function printHelp() {
  console.log(`Usage:
  node .codex/skills/infoq-frontend-verify/scripts/print_admin_login_inject_snippet.mjs [verify-login options]

Examples:
  node .codex/skills/infoq-frontend-verify/scripts/print_admin_login_inject_snippet.mjs
  node .codex/skills/infoq-frontend-verify/scripts/print_admin_login_inject_snippet.mjs --allow-captcha-disabled`);
}

if (args.includes('-h') || args.includes('--help')) {
  printHelp();
  process.exit(0);
}

function runVerifyLogin() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [verifyLoginPath, '--print-token', ...args], {
      cwd: scriptDir,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || stdout || `verify_login exited with code ${code}`));
        return;
      }
      resolve(stdout);
    });
  });
}

async function main() {
  const rawOutput = await runVerifyLogin();
  const token = rawOutput.match(/^TOKEN=(.+)$/m)?.[1]?.trim() || '';
  if (!token) {
    throw new Error(`failed to acquire token; login output:\n${rawOutput}`);
  }

  console.log(`(localStorage.setItem('Admin-Token','${token}'),location.href='/index','ok')`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
