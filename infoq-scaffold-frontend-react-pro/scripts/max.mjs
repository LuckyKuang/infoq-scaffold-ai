#!/usr/bin/env node

import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const maxBin = join(
  rootDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'max.cmd' : 'max',
);

if (!existsSync(maxBin)) {
  console.error(
    `[react-pro-max] Cannot find ${maxBin}. Run pnpm install in ${rootDir} first.`,
  );
  process.exit(1);
}

const child = spawn(maxBin, process.argv.slice(2), {
  cwd: rootDir,
  env: {
    ...process.env,
    DID_YOU_KNOW: 'none',
  },
  stdio: 'inherit',
  windowsHide: false,
});

child.on('error', (error) => {
  console.error(`[react-pro-max] Failed to start Umi Max: ${error.message}`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    const signalExitCodes = {
      SIGINT: 130,
      SIGTERM: 143,
    };
    process.exit(signalExitCodes[signal] ?? 1);
    return;
  }
  process.exit(code ?? 0);
});
