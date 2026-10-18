import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {launchCachedMcpPackage} from '../launch_cached_mcp_package.mjs';

const scriptFile = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptFile);
const rootDir = path.resolve(scriptDir, '..', '..');

function relayExit(child) {
  const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];

  for (const signal of signals) {
    process.on(signal, () => {
      if (!child.killed) {
        child.kill(signal);
      }
    });
  }

  child.on('close', (code, signal) => {
    // Re-sending a signal to this wrapper would hit its forwarding listener and lose the failure.
    process.exitCode = signal ? 128 + (os.constants.signals[signal] ?? 1) : (code ?? 1);
  });
}

try {
  const child = launchCachedMcpPackage({
    repoRoot: rootDir,
    packageName: '@playwright/mcp',
    label: 'playwright mcp',
    env: process.env,
  });

  child.on('error', (error) => {
    console.error(`failed to start playwright mcp server: ${error.message}`);
    process.exit(1);
  });

  relayExit(child);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
