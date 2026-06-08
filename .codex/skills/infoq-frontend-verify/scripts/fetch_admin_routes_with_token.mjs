#!/usr/bin/env node
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {fetchJson, normalizeForwardedArgs, resolveRepoRoot} from '../../../lib/skill_runtime.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(scriptDir);
const verifyLoginPath = path.join(repoRoot, '.codex', 'skills', 'infoq-backend-verify', 'scripts', 'verify_login.mjs');
const args = normalizeForwardedArgs(process.argv.slice(2));
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:8080';
const clientId = process.env.CLIENT_ID || 'e5cd7e4891bf95d1d19206ce24a7b32e';

function printHelp() {
  console.log(`Usage:
  node .codex/skills/infoq-frontend-verify/scripts/fetch_admin_routes_with_token.mjs [verify-login options]

Examples:
  node .codex/skills/infoq-frontend-verify/scripts/fetch_admin_routes_with_token.mjs
  node .codex/skills/infoq-frontend-verify/scripts/fetch_admin_routes_with_token.mjs --allow-captcha-disabled

Environment:
  BASE_URL    Backend base URL. Default: ${baseUrl}
  CLIENT_ID   Login client id. Default: ${clientId}`);
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

function joinPath(prefix, routePath) {
  if (!routePath) return prefix || '/';
  if (routePath.startsWith('/')) return routePath;
  const base = (prefix || '').replace(/\/$/, '');
  return `${base}/${routePath}`.replace(/\/+/g, '/');
}

function collectPaths(nodes, prefix = '', set = new Set()) {
  for (const node of nodes) {
    const fullPath = joinPath(prefix, node.path || '');
    if (node.component && node.component !== 'Layout') {
      set.add(fullPath);
    }
    if (Array.isArray(node.children) && node.children.length > 0) {
      collectPaths(node.children, fullPath, set);
    }
  }
  return set;
}

async function main() {
  const rawOutput = await runVerifyLogin();
  const token = rawOutput.match(/^TOKEN=(.+)$/m)?.[1]?.trim() || '';
  if (!token) {
    throw new Error(`failed to acquire token; login output:\n${rawOutput}`);
  }

  const {response, body} = await fetchJson(`${baseUrl}/system/menu/getRouters`, {
    headers: {
      Authorization: `Bearer ${token}`,
      clientid: clientId
    }
  });

  if (!response.ok || body.code !== 200 || !Array.isArray(body.data)) {
    throw new Error(`router api failed: ${body.msg || body.code || response.status}`);
  }

  for (const routePath of Array.from(collectPaths(body.data)).sort()) {
    console.log(routePath);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
