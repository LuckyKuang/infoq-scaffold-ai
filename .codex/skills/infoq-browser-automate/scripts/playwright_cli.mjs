#!/usr/bin/env node
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runPlaywrightFlow} from './playwright_core.mjs';
import {runAdminRouteProbe} from './admin_route_probe.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..', '..', '..');

function formatTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('') + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function resolveEvidencePath(value) {
  if (!value) {
    return '';
  }
  return path.isAbsolute(value) ? value : path.join(repoRoot, value);
}

function buildDefaultFlowEvidencePath(extension) {
  return path.join(repoRoot, 'test-results', 'browser-automation', `${formatTimestamp()}.${extension}`);
}

function normalizeCommandArgs(rawArgs) {
  if (rawArgs[0] === '--') {
    return rawArgs.slice(1);
  }
  return rawArgs;
}

function printHelp() {
  console.log(`Usage:
  pnpm --dir .codex/skills/infoq-browser-automate/scripts run playwright-cli flow [options]
  pnpm --dir .codex/skills/infoq-browser-automate/scripts run playwright-cli admin-route-probe [options]

Compatibility:
  The CLI also accepts an optional leading "--" before the command to tolerate
  package-manager argument forwarding differences across Windows / macOS / Linux.

Commands:
  flow               Open a page, optionally inject localStorage, wait, capture screenshot and console logs
  admin-route-probe  Acquire backend token, list routes, or probe a protected admin route
`);
}

function printFlowHelp() {
  console.log(`Usage:
  pnpm --dir .codex/skills/infoq-browser-automate/scripts run playwright-cli flow --url <url> [options]

Options:
  --url <url>
  --storage-key <key>
  --storage-value <value>
  --wait-for-text <text>
  --wait-for-url <pattern>
  --screenshot-path <path>
  --console-log-path <path>
  --timeout-ms <ms>
  --headed
  --ignore-https-errors
  --allow-console-errors
`);
}

function printAdminProbeHelp() {
  console.log(`Usage:
  pnpm --dir .codex/skills/infoq-browser-automate/scripts run playwright-cli admin-route-probe [options]

Options:
  --frontend-origin <origin>
  --route <route>
  --backend-url <url>
  --client-id <id>
  --username <value>
  --password <value>
  --wait-for-text <text>
  --screenshot-path <path>
  --console-log-path <path>
  --timeout-ms <ms>
  --list-routes
  --headed
  --allow-console-errors
`);
}

function requireValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function parseFlowArgs(args) {
  const options = {
    storageKey: 'Admin-Token',
    storageValue: '',
    waitForText: '',
    waitForUrl: '',
    screenshotPath: '',
    consoleLogPath: '',
    timeoutMs: 45000,
    headed: false,
    ignoreHTTPSErrors: false,
    allowConsoleErrors: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case '--url':
        options.targetUrl = requireValue(args, index, arg);
        index += 1;
        break;
      case '--storage-key':
        options.storageKey = requireValue(args, index, arg);
        index += 1;
        break;
      case '--storage-value':
        options.storageValue = requireValue(args, index, arg);
        index += 1;
        break;
      case '--wait-for-text':
        options.waitForText = requireValue(args, index, arg);
        index += 1;
        break;
      case '--wait-for-url':
        options.waitForUrl = requireValue(args, index, arg);
        index += 1;
        break;
      case '--screenshot-path':
        options.screenshotPath = resolveEvidencePath(requireValue(args, index, arg));
        index += 1;
        break;
      case '--console-log-path':
        options.consoleLogPath = resolveEvidencePath(requireValue(args, index, arg));
        index += 1;
        break;
      case '--timeout-ms':
        options.timeoutMs = Number(requireValue(args, index, arg));
        index += 1;
        break;
      case '--headed':
        options.headed = true;
        break;
      case '--ignore-https-errors':
        options.ignoreHTTPSErrors = true;
        break;
      case '--allow-console-errors':
        options.allowConsoleErrors = true;
        break;
      case '--help':
      case '-h':
        printFlowHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown option for flow: ${arg}`);
    }
  }

  if (!options.targetUrl) {
    throw new Error('--url is required for flow.');
  }

  return options;
}

function parseAdminProbeArgs(args) {
  const options = {
    frontendOrigin: '',
    route: '/index',
    backendUrl: 'http://127.0.0.1:8080',
    clientId: 'e5cd7e4891bf95d1d19206ce24a7b32e',
    username: '',
    password: '',
    waitForText: '',
    screenshotPath: '',
    consoleLogPath: '',
    timeoutMs: 45000,
    listRoutes: false,
    headed: false,
    allowConsoleErrors: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case '--frontend-origin':
        options.frontendOrigin = requireValue(args, index, arg);
        index += 1;
        break;
      case '--route':
        options.route = requireValue(args, index, arg);
        index += 1;
        break;
      case '--backend-url':
        options.backendUrl = requireValue(args, index, arg);
        index += 1;
        break;
      case '--client-id':
        options.clientId = requireValue(args, index, arg);
        index += 1;
        break;
      case '--username':
        options.username = requireValue(args, index, arg);
        index += 1;
        break;
      case '--password':
        options.password = requireValue(args, index, arg);
        index += 1;
        break;
      case '--wait-for-text':
        options.waitForText = requireValue(args, index, arg);
        index += 1;
        break;
      case '--screenshot-path':
        options.screenshotPath = resolveEvidencePath(requireValue(args, index, arg));
        index += 1;
        break;
      case '--console-log-path':
        options.consoleLogPath = resolveEvidencePath(requireValue(args, index, arg));
        index += 1;
        break;
      case '--timeout-ms':
        options.timeoutMs = Number(requireValue(args, index, arg));
        index += 1;
        break;
      case '--list-routes':
        options.listRoutes = true;
        break;
      case '--headed':
        options.headed = true;
        break;
      case '--allow-console-errors':
        options.allowConsoleErrors = true;
        break;
      case '--help':
      case '-h':
        printAdminProbeHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown option for admin-route-probe: ${arg}`);
    }
  }

  if (!options.listRoutes && !options.frontendOrigin) {
    throw new Error('--frontend-origin is required unless --list-routes is used.');
  }

  return options;
}

async function main() {
  const [command, ...args] = normalizeCommandArgs(process.argv.slice(2));

  if (!command || command === '--help' || command === '-h') {
    printHelp();
    process.exit(command ? 0 : 1);
  }

  switch (command) {
    case 'flow': {
      const options = parseFlowArgs(args);
      const screenshotPath = options.screenshotPath || buildDefaultFlowEvidencePath('png');
      const consoleLogPath = options.consoleLogPath || buildDefaultFlowEvidencePath('console.json');
      console.log(`[browser-flow] url: ${options.targetUrl}`);
      console.log(`[browser-flow] screenshot: ${screenshotPath}`);
      console.log(`[browser-flow] console log: ${consoleLogPath}`);
      await runPlaywrightFlow({
        ...options,
        screenshotPath,
        consoleLogPath,
        failOnConsoleErrors: !options.allowConsoleErrors
      });
      console.log('[browser-flow] completed successfully');
      return;
    }
    case 'admin-route-probe': {
      const options = parseAdminProbeArgs(args);
      await runAdminRouteProbe(options);
      return;
    }
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
