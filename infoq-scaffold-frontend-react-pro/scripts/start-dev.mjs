#!/usr/bin/env node

import {existsSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const maxBin = join(
  rootDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'max.cmd' : 'max',
);

const printHelp = () => {
  console.log(`Usage: node scripts/start-dev.mjs [options] [-- max-dev-args]

Options:
  --umi-env <name>   UMI_ENV value, defaults to dev
  --mock <value>     MOCK value, defaults to none
  --no-open          Do not open the browser after the dev server is ready
  --open=false       Same as --no-open
  -h, --help         Show this help

Environment:
  PORT or VITE_APP_PORT sets the dev server port. Default: 80
  INFOQ_REACT_PRO_OPEN=false or BROWSER=none disables browser opening
`);
};

const readOptionValue = (arg, args, index) => {
  const equalsIndex = arg.indexOf('=');
  if (equalsIndex >= 0) {
    return [arg.slice(equalsIndex + 1), index];
  }
  return [args[index + 1], index + 1];
};

const parseArgs = (args) => {
  const options = {
    umiEnv: process.env.UMI_ENV || 'dev',
    mock: process.env.MOCK || 'none',
    open:
      process.env.INFOQ_REACT_PRO_OPEN !== 'false' &&
      process.env.BROWSER !== 'none',
    passthrough: [],
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') {
      continue;
    }
    if (arg === '-h' || arg === '--help') {
      options.help = true;
      continue;
    }
    if (arg === '--no-open' || arg === '--open=false') {
      options.open = false;
      continue;
    }
    if (arg.startsWith('--umi-env')) {
      const [value, nextIndex] = readOptionValue(arg, args, index);
      if (!value) {
        throw new Error('--umi-env requires a value');
      }
      options.umiEnv = value;
      index = nextIndex;
      continue;
    }
    if (arg.startsWith('--mock')) {
      const [value, nextIndex] = readOptionValue(arg, args, index);
      if (!value) {
        throw new Error('--mock requires a value');
      }
      options.mock = value;
      index = nextIndex;
      continue;
    }
    options.passthrough.push(arg);
  }

  return options;
};

const normalizeUrl = (url) =>
  url.replace(/0\.0\.0\.0|\[::\]/, 'localhost').replace(/[),.;]+$/, '');

const getReadyUrl = (output, fallbackPort) => {
  const appListeningMatch = output.match(
    /App listening at\s+(https?:\/\/[^\s]+)/i,
  );
  if (appListeningMatch) {
    return normalizeUrl(appListeningMatch[1]);
  }

  const localMatch = output.match(/Local:\s+(https?:\/\/[^\s]+)/i);
  if (localMatch) {
    return normalizeUrl(localMatch[1]);
  }

  if (/App listening at|ready\s+-/i.test(output)) {
    return `http://localhost:${fallbackPort}`;
  }

  return '';
};

const openBrowser = (url) => {
  const command =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'cmd'
        : 'xdg-open';
  const args =
    process.platform === 'win32' ? ['/c', 'start', '', url] : [url];

  const opener = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });

  opener.on('error', (error) => {
    console.warn(
      `[react-pro-dev] Browser open failed for ${url}: ${error.message}`,
    );
  });
  opener.unref();
};

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(`[react-pro-dev] ${error.message}`);
  process.exit(1);
}

if (options.help) {
  printHelp();
  process.exit(0);
}

if (!existsSync(maxBin)) {
  console.error(
    `[react-pro-dev] Cannot find ${maxBin}. Run pnpm install in ${rootDir} first.`,
  );
  process.exit(1);
}

const port = process.env.PORT || process.env.VITE_APP_PORT || '80';
const child = spawn(maxBin, ['dev', ...options.passthrough], {
  cwd: rootDir,
  env: {
    ...process.env,
    PORT: port,
    VITE_APP_PORT: process.env.VITE_APP_PORT || port,
    UMI_ENV: options.umiEnv,
    MOCK: options.mock,
    DID_YOU_KNOW: 'none',
  },
  stdio: ['inherit', 'pipe', 'pipe'],
  windowsHide: false,
});

let opened = false;
let recentOutput = '';

const handleOutput = (chunk, target) => {
  target.write(chunk);
  if (opened || !options.open) {
    return;
  }

  recentOutput = `${recentOutput}${chunk.toString('utf-8')}`.slice(-6000);
  const readyUrl = getReadyUrl(recentOutput, port);
  if (!readyUrl) {
    return;
  }

  opened = true;
  console.log(`[react-pro-dev] Opening ${readyUrl}`);
  openBrowser(readyUrl);
};

child.stdout.on('data', (chunk) => handleOutput(chunk, process.stdout));
child.stderr.on('data', (chunk) => handleOutput(chunk, process.stderr));

child.on('error', (error) => {
  console.error(`[react-pro-dev] Failed to start Umi Max: ${error.message}`);
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

const shutdown = (signal) => {
  if (!child.killed) {
    child.kill(signal);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
