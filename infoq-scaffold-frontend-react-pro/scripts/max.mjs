#!/usr/bin/env node

import {spawn} from 'node:child_process';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createMaxCommand} from './max-command.mjs';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

let maxCommand;
try {
  maxCommand = createMaxCommand(rootDir, process.argv.slice(2), {
    ...process.env,
    DID_YOU_KNOW: 'none',
  });
} catch (error) {
  console.error(
    `[react-pro-max] Cannot resolve Umi Max. Run pnpm install in ${rootDir} first. ${error.message}`,
  );
  process.exit(1);
}

const child = spawn(maxCommand.command, maxCommand.arguments, {
  cwd: rootDir,
  env: maxCommand.env,
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
