#!/usr/bin/env node

import {spawn} from 'node:child_process';
import process from 'node:process';

const args = process.argv.slice(2);
const separatorIndex = args.indexOf('--');

if (separatorIndex <= 0 || separatorIndex === args.length - 1) {
  fail('Usage: node tools/run-env.mjs KEY=VALUE [KEY=VALUE ...] -- command [args ...]');
}

const assignments = args.slice(0, separatorIndex);
const command = args[separatorIndex + 1];
const commandArgs = args.slice(separatorIndex + 2);
const env = { ...process.env };

for (const assignment of assignments) {
  const equalsIndex = assignment.indexOf('=');
  if (equalsIndex <= 0) {
    fail(`Invalid environment assignment: ${assignment}`);
  }

  const key = assignment.slice(0, equalsIndex);
  const value = assignment.slice(equalsIndex + 1);

  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    fail(`Invalid environment variable name: ${key}`);
  }

  env[key] = value;
}

const child = spawn(command, commandArgs, {
  env,
  shell: process.platform === 'win32',
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(`Failed to start command "${command}": ${error.message}`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Command "${command}" exited due to signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 0);
});

function fail(message) {
  console.error(message);
  process.exit(1);
}
