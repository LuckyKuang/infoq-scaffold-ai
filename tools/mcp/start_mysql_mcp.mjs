import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {launchCachedMcpPackage} from '../launch_cached_mcp_package.mjs';
import {resolveBackendConfigSelection, resolveMysqlEnv} from '../resolve_backend_local_mcp_env.mjs';

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

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

try {
  const {configPath} = resolveBackendConfigSelection(rootDir);
  const env = resolveMysqlEnv(configPath);
  const child = launchCachedMcpPackage({
    repoRoot: rootDir,
    packageName: '@wenit/mysql-mcp-server',
    label: 'mysql mcp',
    env: {
      ...env,
      ...process.env,
    },
  });

  child.on('error', (error) => {
    console.error(`failed to start mysql mcp server: ${error.message}`);
    process.exit(1);
  });

  relayExit(child);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
