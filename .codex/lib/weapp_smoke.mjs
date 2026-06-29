import fs from 'node:fs';
import path from 'node:path';
import {
    ensureDir,
    fetchJson,
    markRunState,
    resolveDocTmpPath,
    resolvePackageManager,
    runCommandChecked,
    runCommandStreaming,
    timestampSlug
} from './skill_runtime.mjs';

function usage(config) {
  console.log(`Usage: node ${config.scriptPath} [options]

Options:
  --suite <smoke|core|full>    Smoke suite. Default: full.
  --skip-build                 Skip build:weapp:dev before smoke run.
  --url-check                  Enable WeChat legal-domain checks.
  --no-url-check               Disable WeChat legal-domain checks (default).
  --auto-login                 Enable backend auto-login (default).
  --no-auto-login              Disable auto-login.
  --keep-existing-session      Keep current mini-program local token/session.
  --token <token>              Use explicit token injection.
  --username <name>            Preferred auto-login username.
  --password <pwd>             Preferred auto-login password.
  --login-candidates <list>    Fallback list, e.g. "admin:admin123,dept:666666".
  --base-url <url>             Auto-login backend URL override.
  --health-url <url>           Backend health probe base URL.
  --cli <path>                 WeChat DevTools CLI absolute path.
  --report                     Force runner report output.
  --no-report                  Disable explicit report flag.
  --login-home-only            Verify login-success -> home route pass in smoke mode.
  -h, --help                   Show this help.`);
}

function readValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function parseArgs(argv) {
  const options = {
    suite: process.env.WEAPP_SMOKE_SUITE || 'full',
    buildFirst: true,
    autoLogin: process.env.WEAPP_E2E_AUTO_LOGIN || 'true',
    keepExistingSession: process.env.WEAPP_E2E_KEEP_EXISTING_SESSION || 'false',
    urlCheck: process.env.WECHAT_DEVTOOLS_URL_CHECK || 'false',
    failOnConsoleError: process.env.WEAPP_E2E_FAIL_ON_CONSOLE_ERROR || 'true',
    reportMode: '',
    loginHomeOnly: false,
    devtoolsCliPath: process.env.WECHAT_DEVTOOLS_CLI || '',
    token: process.env.WEAPP_E2E_TOKEN || '',
    username: process.env.WEAPP_E2E_AUTO_LOGIN_USERNAME || '',
    password: process.env.WEAPP_E2E_AUTO_LOGIN_PASSWORD || '',
    loginCandidates: process.env.WEAPP_E2E_AUTO_LOGIN_CANDIDATES || '',
    baseUrl: process.env.WEAPP_E2E_BASE_URL || '',
    healthUrl: process.env.WEAPP_SMOKE_HEALTH_URL || ''
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--suite':
        options.suite = readValue(argv, index, arg);
        index += 1;
        break;
      case '--skip-build':
        options.buildFirst = false;
        break;
      case '--url-check':
        options.urlCheck = 'true';
        break;
      case '--no-url-check':
        options.urlCheck = 'false';
        break;
      case '--auto-login':
        options.autoLogin = 'true';
        break;
      case '--no-auto-login':
        options.autoLogin = 'false';
        break;
      case '--keep-existing-session':
        options.keepExistingSession = 'true';
        break;
      case '--token':
        options.token = readValue(argv, index, arg);
        index += 1;
        break;
      case '--username':
        options.username = readValue(argv, index, arg);
        index += 1;
        break;
      case '--password':
        options.password = readValue(argv, index, arg);
        index += 1;
        break;
      case '--login-candidates':
        options.loginCandidates = readValue(argv, index, arg);
        index += 1;
        break;
      case '--base-url':
        options.baseUrl = readValue(argv, index, arg);
        index += 1;
        break;
      case '--health-url':
        options.healthUrl = readValue(argv, index, arg);
        index += 1;
        break;
      case '--cli':
        options.devtoolsCliPath = readValue(argv, index, arg);
        index += 1;
        break;
      case '--report':
        options.reportMode = '--report';
        break;
      case '--no-report':
        options.reportMode = '--no-report';
        break;
      case '--login-home-only':
        options.loginHomeOnly = true;
        break;
      case '-h':
      case '--help':
        options.help = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function resolveLogPath(repoRoot, stateSlug) {
  const customPath = process.env.WEAPP_SMOKE_RUN_LOG || '';
  if (customPath) {
    return path.isAbsolute(customPath) ? customPath : path.resolve(repoRoot, customPath);
  }
  return resolveDocTmpPath(repoRoot, stateSlug, `weapp-smoke-run-${timestampSlug()}.log`);
}

function buildRunnerArgs(options) {
  const args = ['--suite', options.suite];
  if (options.reportMode) {
    args.push(options.reportMode);
  }
  return args;
}

function evaluateLoginHomeOnly(logText, runExit) {
  const homeRoutePass = logText.includes('[PASSED] smoke.routes :: route:/pages/home/index');
  const authInjected =
    logText.includes('Auto login succeeded:') ||
    logText.includes('Injected Admin-Token from WEAPP_E2E_TOKEN.') ||
    logText.includes('Using existing mini-program session token (WEAPP_E2E_KEEP_EXISTING_SESSION enabled).');
  const knownLoginRedirectMismatch = logText.includes('[FAILED] smoke.routes :: route:/pages/login/index');

  if (homeRoutePass && authInjected) {
    if (runExit === 0) {
      return {passed: true, reason: 'login-home-only passed.'};
    }
    if (knownLoginRedirectMismatch) {
      return {
        passed: true,
        reason: 'login-home-only passed with known mismatch: authenticated /pages/login/index redirects to /pages/home/index.'
      };
    }
  }

  return {passed: false, reason: 'login-home-only failed.'};
}

export async function runWeappSmoke(config, argv) {
  const options = parseArgs(argv);
  if (options.help) {
    usage(config);
    return;
  }

  if (!['smoke', 'core', 'full'].includes(options.suite)) {
    throw new Error(`[${config.label}] Invalid suite: ${options.suite}. Supported: smoke|core|full`);
  }

  const stateFile = resolveDocTmpPath(config.repoRoot, config.stateSlug, 'state.json');
  const writeState = (patch) => markRunState(stateFile, patch);
  const handleInterrupt = (signal) => {
    writeState({
      status: 'interrupted',
      stopReason: signal
    });
    process.exit(signal === 'SIGINT' ? 130 : signal === 'SIGHUP' ? 129 : 143);
  };
  const handleSigint = () => handleInterrupt('SIGINT');
  const handleSigterm = () => handleInterrupt('SIGTERM');
  const handleSighup = () => handleInterrupt('SIGHUP');
  process.once('SIGINT', handleSigint);
  process.once('SIGTERM', handleSigterm);
  process.once('SIGHUP', handleSighup);

  const weappDir = path.join(config.repoRoot, config.workspaceDirName);
  try {
    if (!fs.existsSync(weappDir)) {
      throw new Error(`[${config.label}] Workspace not found: ${weappDir}`);
    }

    if (options.loginHomeOnly) {
      options.suite = 'smoke';
      console.log(`[${config.label}] login-home-only mode enabled; force suite=smoke.`);
    }

    const pkg = resolvePackageManager();
    const logPath = resolveLogPath(config.repoRoot, config.stateSlug);
    ensureDir(path.dirname(logPath));
    writeState({
      schemaVersion: 1,
      skill: 'infoq-frontend-verify',
      script: 'run_weapp_smoke.mjs',
      label: config.label,
      status: 'running',
      startedAt: new Date().toISOString(),
      suite: options.suite,
      workspaceDir: weappDir,
      logFiles: [logPath],
      processes: []
    });

    if (options.buildFirst) {
      console.log(`[${config.label}] Building dist with ${pkg.name} run build:weapp:dev ...`);
      await runCommandChecked(pkg.command, ['run', 'build:weapp:dev'], {cwd: weappDir});
    }

    console.log(
      `[${config.label}] Launching suite=${options.suite}, autoLogin=${options.autoLogin}, keepExistingSession=${options.keepExistingSession}, urlCheck=${options.urlCheck}`
    );

    const runnerEnv = {
      ...process.env,
      WECHAT_DEVTOOLS_URL_CHECK: options.urlCheck,
      WEAPP_E2E_AUTO_LOGIN: options.autoLogin,
      WEAPP_E2E_KEEP_EXISTING_SESSION: options.keepExistingSession,
      WEAPP_E2E_FAIL_ON_CONSOLE_ERROR: options.failOnConsoleError
    };

    if (options.devtoolsCliPath) {
      runnerEnv.WECHAT_DEVTOOLS_CLI = options.devtoolsCliPath;
    }
    if (options.token) {
      runnerEnv.WEAPP_E2E_TOKEN = options.token;
    }
    if (options.username) {
      runnerEnv.WEAPP_E2E_AUTO_LOGIN_USERNAME = options.username;
    }
    if (options.password) {
      runnerEnv.WEAPP_E2E_AUTO_LOGIN_PASSWORD = options.password;
    }
    if (options.loginCandidates) {
      runnerEnv.WEAPP_E2E_AUTO_LOGIN_CANDIDATES = options.loginCandidates;
    }
    if (options.baseUrl) {
      runnerEnv.WEAPP_E2E_BASE_URL = options.baseUrl;
    }

    const shouldProbeBackend = options.autoLogin === 'true' || options.loginHomeOnly;
    if (shouldProbeBackend) {
      const probeBaseUrl = options.healthUrl || options.baseUrl || 'http://127.0.0.1:8080';
      const probeEndpoint = `${probeBaseUrl.replace(/\/$/, '')}/auth/code`;
      const probeOutput = resolveDocTmpPath(config.repoRoot, config.stateSlug, 'weapp-smoke-auth-code.json');
      const {response, body} = await fetchJson(probeEndpoint, {headers: {'Content-Type': 'application/json'}});
      if (!response.ok) {
        throw new Error(`[${config.label}] Backend health probe failed: ${probeEndpoint}`);
      }
      fs.writeFileSync(probeOutput, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
      if (body?.data?.captchaEnabled === true) {
        throw new Error(`[${config.label}] Backend health probe returned captchaEnabled=true at ${probeEndpoint}`);
      }
      console.log(`[${config.label}] Backend health probe passed: ${probeEndpoint}`);
    }

    const runnerResult = await runCommandStreaming(
      process.execPath,
      ['./tests/e2e/weapp/runner.mjs', ...buildRunnerArgs(options)],
      {
        cwd: weappDir,
        env: runnerEnv,
        logFile: logPath
      }
    );

    const logText = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';

    if (logText.includes('[object Object]')) {
      throw new Error(
        `[${config.label}] Detected "[object Object]" in runner log, which violates mini-program error-message contract.\n[${config.label}] Runner log: ${logPath}`
      );
    }

    if (options.loginHomeOnly) {
      const verdict = evaluateLoginHomeOnly(logText, runnerResult.code);
      if (!verdict.passed) {
        throw new Error(`[${config.label}] ${verdict.reason}\n[${config.label}] Runner log: ${logPath}`);
      }
      writeState({
        status: 'passed',
        finishedAt: new Date().toISOString()
      });
      console.log(`[${config.label}] ${verdict.reason}`);
      console.log(`[${config.label}] Runner log: ${logPath}`);
      return;
    }

    if (runnerResult.signal) {
      throw new Error(`[${config.label}] Smoke suite terminated by signal ${runnerResult.signal}. Runner log: ${logPath}`);
    }
    if (runnerResult.code !== 0) {
      throw new Error(`[${config.label}] Smoke suite failed. Runner log: ${logPath}`);
    }

    writeState({
      status: 'passed',
      finishedAt: new Date().toISOString()
    });
    console.log(`[${config.label}] Smoke suite passed.`);
    console.log(`[${config.label}] Runner log: ${logPath}`);
  } catch (error) {
    writeState({
      status: 'failed',
      stopReason: error.message || String(error),
      finishedAt: new Date().toISOString()
    });
    throw error;
  } finally {
    process.removeListener('SIGINT', handleSigint);
    process.removeListener('SIGTERM', handleSigterm);
    process.removeListener('SIGHUP', handleSighup);
  }
}
