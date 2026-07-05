#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {
    ensureDir,
    fetchJson,
    markRunState,
    normalizeForwardedArgs,
    readJsonFile,
    resolveDocTmpPath,
    resolveRepoRoot,
    runCommandChecked,
    timestampSlug
} from '../../../lib/skill_runtime.mjs';
import {runAdminDevStack, stopAdminDevStackState} from '../../../lib/admin_dev_stack.mjs';
import {DEFAULT_CAPTCHA_LOGIN_OPTIONS, loginWithRealCaptcha} from './captcha_login.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(scriptDir);
const browserScriptsDir = path.join(repoRoot, '.codex', 'skills', 'infoq-browser-automate', 'scripts');
const browserRequire = createRequire(path.join(browserScriptsDir, 'package.json'));
const DEFAULT_CRUD_LOGIN_CANDIDATES = 'admin:admin123';
const NOTICE_ROUTE = '/system/notice';

const CLIENTS = {
  vue: {
    shortName: 'vue',
    label: 'admin-e2e-vue',
    frontendDirName: 'infoq-scaffold-frontend-vue',
    frontendDisplayName: 'Vue admin',
    frontendLogPrefix: 'frontend-vue',
    frontendPortFlag: '--vue-port',
    frontendPortEnv: 'VUE_PORT',
    defaultFrontendPort: 5173
  },
  react: {
    shortName: 'react',
    label: 'admin-e2e-react',
    frontendDirName: 'infoq-scaffold-frontend-react',
    frontendDisplayName: 'React admin',
    frontendLogPrefix: 'frontend-react',
    frontendPortFlag: '--react-port',
    frontendPortEnv: 'REACT_PORT',
    defaultFrontendPort: 5174
  },
  'react-pro': {
    shortName: 'react-pro',
    label: 'admin-e2e-react-pro',
    frontendDirName: 'infoq-scaffold-frontend-react-pro',
    frontendDisplayName: 'React Pro admin',
    frontendLogPrefix: 'frontend-react-pro',
    frontendPortFlag: '--react-pro-port',
    frontendPortEnv: 'REACT_PRO_PORT',
    defaultFrontendPort: 4184
  }
};

const DEFAULTS = {
  backendUrl: DEFAULT_CAPTCHA_LOGIN_OPTIONS.backendUrl,
  backendPort: '8080',
  frontendHost: '127.0.0.1',
  profile: 'local',
  clientId: DEFAULT_CAPTCHA_LOGIN_OPTIONS.clientId,
  loginCandidates: DEFAULT_CRUD_LOGIN_CANDIDATES,
  maxCaptchaAttempts: DEFAULT_CAPTCHA_LOGIN_OPTIONS.maxCaptchaAttempts,
  timeoutMs: 60000,
  rsaPublicKey: DEFAULT_CAPTCHA_LOGIN_OPTIONS.rsaPublicKey
};

function printHelp() {
  console.log(`Usage:
  node .codex/skills/infoq-admin-e2e/scripts/run_notice_crud_e2e.mjs --client <vue|react|react-pro> [options]

Examples:
  node .codex/skills/infoq-admin-e2e/scripts/run_notice_crud_e2e.mjs --client react
  node .codex/skills/infoq-admin-e2e/scripts/run_notice_crud_e2e.mjs --client react-pro --run-id notice-crud-react-pro
  node .codex/skills/infoq-admin-e2e/scripts/run_notice_crud_e2e.mjs --client vue --no-start-stack --backend-url http://127.0.0.1:8080 --frontend-origin http://127.0.0.1:5173

Options:
  --client <vue|react|react-pro>    Required admin client.
  --backend-url <url>               Backend base URL. Default: ${DEFAULTS.backendUrl}
  --frontend-origin <url>           Frontend origin. Default follows --client.
  --start-stack                     Start or reuse backend + frontend dev stack. Default.
  --no-start-stack                  Reuse existing services only.
  --build-backend                   Build backend jar before startup.
  --force-restart                   Stop recorded stack processes before startup.
  --stop-stack-after                Stop processes started by this skill after the run. Default.
  --keep-stack-after                Keep processes started by this skill after a successful run.
  --backend-port <port>             Backend port when starting stack. Default: ${DEFAULTS.backendPort}
  --frontend-port <port>            Frontend port when starting stack.
  --frontend-host <host>            Frontend host when starting stack. Default: ${DEFAULTS.frontendHost}
  --profile <name>                  Spring profile and application-<name>.yml. Default: ${DEFAULTS.profile}
  --username <name>                 Preferred username.
  --password <pwd>                  Preferred password.
  --login-candidates <csv>          Candidate accounts. Default: ${DEFAULTS.loginCandidates}
  --client-id <id>                  Login client id. Default: ${DEFAULTS.clientId}
  --rsa-public-key <base64>         Request encryption public key.
  --max-captcha-attempts <n>        Captcha attempts per account. Default: ${DEFAULTS.maxCaptchaAttempts}
  --timeout-ms <ms>                 UI timeout. Default: ${DEFAULTS.timeoutMs}
  --headed                          Show browser.
  --allow-console-errors            Do not fail CRUD run on console errors.
  --run-id <slug>                   Evidence run id.
  -h, --help                        Show help.`);
}

function readValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function parseArgs(argv) {
  const options = {
    client: '',
    backendUrl: process.env.BACKEND_URL || DEFAULTS.backendUrl,
    frontendOrigin: process.env.FRONTEND_ORIGIN || '',
    startStack: true,
    buildBackend: false,
    forceRestart: false,
    stopStackAfter: true,
    backendPort: String(process.env.BACKEND_PORT || DEFAULTS.backendPort),
    frontendPort: '',
    frontendHost: String(process.env.FRONTEND_HOST || DEFAULTS.frontendHost),
    profile: String(process.env.PROFILE || DEFAULTS.profile),
    username: process.env.USERNAME || '',
    password: process.env.PASSWORD || '',
    loginCandidates: process.env.LOGIN_CANDIDATES || DEFAULTS.loginCandidates,
    clientId: process.env.CLIENT_ID || DEFAULTS.clientId,
    rsaPublicKey: process.env.RSA_PUBLIC_KEY || DEFAULTS.rsaPublicKey,
    maxCaptchaAttempts: DEFAULTS.maxCaptchaAttempts,
    timeoutMs: DEFAULTS.timeoutMs,
    headed: false,
    allowConsoleErrors: false,
    runId: ''
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--client':
        options.client = readValue(argv, index, arg);
        index += 1;
        break;
      case '--backend-url':
        options.backendUrl = readValue(argv, index, arg).replace(/\/+$/, '');
        index += 1;
        break;
      case '--frontend-origin':
        options.frontendOrigin = readValue(argv, index, arg).replace(/\/+$/, '');
        index += 1;
        break;
      case '--start-stack':
        options.startStack = true;
        break;
      case '--no-start-stack':
        options.startStack = false;
        break;
      case '--build-backend':
        options.buildBackend = true;
        break;
      case '--force-restart':
        options.forceRestart = true;
        break;
      case '--stop-stack-after':
        options.stopStackAfter = true;
        break;
      case '--keep-stack-after':
        options.stopStackAfter = false;
        break;
      case '--backend-port':
        options.backendPort = readValue(argv, index, arg);
        index += 1;
        break;
      case '--frontend-port':
        options.frontendPort = readValue(argv, index, arg);
        index += 1;
        break;
      case '--frontend-host':
        options.frontendHost = readValue(argv, index, arg);
        index += 1;
        break;
      case '--profile':
        options.profile = readValue(argv, index, arg);
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
      case '--client-id':
        options.clientId = readValue(argv, index, arg);
        index += 1;
        break;
      case '--rsa-public-key':
        options.rsaPublicKey = readValue(argv, index, arg);
        index += 1;
        break;
      case '--max-captcha-attempts':
        options.maxCaptchaAttempts = Number(readValue(argv, index, arg));
        index += 1;
        break;
      case '--timeout-ms':
        options.timeoutMs = Number(readValue(argv, index, arg));
        index += 1;
        break;
      case '--headed':
        options.headed = true;
        break;
      case '--allow-console-errors':
        options.allowConsoleErrors = true;
        break;
      case '--run-id':
        options.runId = readValue(argv, index, arg);
        index += 1;
        break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!CLIENTS[options.client]) {
    throw new Error('--client must be one of: vue, react, react-pro');
  }
  if (options.profile !== 'local') {
    throw new Error('Notice CRUD E2E is restricted to --profile local because it writes to application-local.yml test data only.');
  }
  if (!Number.isInteger(options.maxCaptchaAttempts) || options.maxCaptchaAttempts <= 0) {
    throw new Error('--max-captcha-attempts must be a positive integer.');
  }
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new Error('--timeout-ms must be a positive integer.');
  }

  return options;
}

function buildStackConfig(options, runDir) {
  const clientConfig = CLIENTS[options.client];
  const stateDir = resolveDocTmpPath(repoRoot, 'infoq-admin-e2e', 'stack', options.client);
  return {
    ...clientConfig,
    repoRoot,
    defaultProfile: 'local',
    scriptPath: '.codex/skills/infoq-admin-e2e/scripts/run_notice_crud_e2e.mjs',
    stateSlug: `infoq-admin-e2e/stack/${options.client}`,
    stateFile: path.join(stateDir, 'state.json'),
    stateContext: {
      runId: path.basename(runDir),
      evidenceDir: runDir,
      mode: 'notice-crud'
    },
    defaultBackendPort: 8080,
    defaultFrontendPort: clientConfig.defaultFrontendPort
  };
}

function buildStackArgs(options, clientConfig) {
  const args = [
    '--backend-port',
    options.backendPort,
    clientConfig.frontendPortFlag,
    options.frontendPort || String(clientConfig.defaultFrontendPort),
    '--frontend-host',
    options.frontendHost,
    '--profile',
    options.profile
  ];
  if (options.buildBackend) {
    args.push('--build-backend');
  }
  if (options.forceRestart) {
    args.push('--force-restart');
  }
  return args;
}

function buildFrontendOrigin(options) {
  if (options.frontendOrigin) {
    return options.frontendOrigin;
  }
  const clientConfig = CLIENTS[options.client];
  const frontendPort = options.frontendPort || String(clientConfig.defaultFrontendPort);
  return `http://${options.frontendHost}:${frontendPort}`;
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function stripQuotes(value) {
  const trimmed = String(value || '').trim();
  if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function readApplicationDbConfig(profile) {
  const configPath = path.join(
    repoRoot,
    'infoq-scaffold-backend',
    'infoq-admin',
    'src',
    'main',
    'resources',
    `application-${profile}.yml`
  );
  if (!fs.existsSync(configPath)) {
    throw new Error(`Backend profile config not found: ${configPath}`);
  }
  const text = fs.readFileSync(configPath, 'utf8');
  const masterIndex = text.indexOf('        master:');
  if (masterIndex < 0) {
    throw new Error(`master datasource block not found in ${configPath}`);
  }
  const scopedLines = text.slice(masterIndex).split(/\r?\n/).slice(0, 24);
  const readKey = (key) => {
    const line = scopedLines.find((item) => new RegExp(`^\\s*${key}:\\s*`).test(item));
    if (!line) {
      throw new Error(`${key} not found in master datasource block: ${configPath}`);
    }
    return stripQuotes(line.replace(new RegExp(`^\\s*${key}:\\s*`), ''));
  };
  const jdbcUrl = readKey('url');
  const username = readKey('username');
  const password = readKey('password');
  const match = jdbcUrl.match(/^jdbc:mysql:\/\/([^/:?]+)(?::(\d+))?\/([^?]+)(?:\?(.*))?$/u);
  if (!match) {
    throw new Error(`Unsupported JDBC URL in ${configPath}: ${jdbcUrl}`);
  }
  return {
    profile,
    configPath,
    jdbcUrl,
    username,
    password,
    host: match[1],
    port: match[2] || '3306',
    database: decodeURIComponent(match[3]),
    sanitizedJdbcUrl: jdbcUrl.replace(/([?&]password=)[^&]+/giu, '$1***')
  };
}

function makeTestData(client) {
  const clientSlug = {
    vue: 'vue',
    react: 'react',
    'react-pro': 'rp'
  }[client];
  const unique = `${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
  const baseTitle = `e2e_notice_${clientSlug}_a_${unique}`;
  const editedTitle = `e2e_notice_${clientSlug}_b_${unique}`;
  if (editedTitle.length > 50) {
    throw new Error(`Generated notice title exceeds backend limit: ${editedTitle.length}`);
  }
  return {
    module: 'system_notice',
    route: NOTICE_ROUTE,
    baseTitle,
    editedTitle,
    noticeType: '1',
    status: '0',
    content: `<p>${baseTitle}</p>`
  };
}

function assertE2eTitle(title) {
  if (!String(title || '').startsWith('e2e_')) {
    throw new Error(`Refusing to operate on non-e2e title: ${title}`);
  }
}

function uniqueTitles(titles) {
  return Array.from(new Set(titles.filter(Boolean)));
}

function buildApiHeaders(options, token) {
  return {
    Authorization: `Bearer ${token}`,
    clientid: options.clientId,
    'Content-Language': 'zh-CN'
  };
}

async function apiRequest(options, token, method, apiPath, body = undefined) {
  const headers = buildApiHeaders(options, token);
  const requestOptions = {method, headers};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json;charset=UTF-8';
    requestOptions.body = JSON.stringify(body);
  }
  const {response, body: responseBody} = await fetchJson(`${options.backendUrl}${apiPath}`, requestOptions);
  if (response.status !== 200) {
    throw new Error(`${method} ${apiPath} failed: http=${response.status}, body=${JSON.stringify(responseBody).slice(0, 500)}`);
  }
  if (responseBody && Object.prototype.hasOwnProperty.call(responseBody, 'code') && responseBody.code !== 200) {
    throw new Error(`${method} ${apiPath} failed: code=${responseBody.code}, msg=${responseBody.msg || ''}`);
  }
  return responseBody;
}

async function listNoticeByTitle(options, token, title) {
  const params = new URLSearchParams({
    pageNum: '1',
    pageSize: '50',
    noticeTitle: title
  });
  const body = await apiRequest(options, token, 'GET', `/system/notice/list?${params.toString()}`);
  const rows = Array.isArray(body.rows) ? body.rows : [];
  return rows.filter((row) => row?.noticeTitle === title);
}

async function deleteNoticeById(options, token, noticeId) {
  return apiRequest(options, token, 'DELETE', `/system/notice/${encodeURIComponent(String(noticeId))}`);
}

async function cleanupByApi(options, token, titles) {
  const result = {
    mode: 'api',
    attempted: Boolean(token),
    deleted: [],
    skipped: [],
    errors: []
  };
  if (!token) {
    result.skipped.push({reason: 'no-token'});
    return result;
  }
  for (const title of uniqueTitles(titles)) {
    try {
      assertE2eTitle(title);
      const rows = await listNoticeByTitle(options, token, title);
      for (const row of rows) {
        if (!String(row.noticeTitle || '').startsWith('e2e_')) {
          result.skipped.push({title: row.noticeTitle, noticeId: row.noticeId, reason: 'non-e2e-title'});
          continue;
        }
        await deleteNoticeById(options, token, row.noticeId);
        result.deleted.push({title, noticeId: row.noticeId});
      }
    } catch (error) {
      result.errors.push({title, error: error.message || String(error)});
    }
  }
  return result;
}

function compareVersionLike(a, b) {
  const parse = (value) => String(value).match(/\d+(?:\.\d+)+/u)?.[0].split('.').map(Number) || [0];
  const left = parse(a);
  const right = parse(b);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return String(a).localeCompare(String(b));
}

function collectConnectorJars(dir, result = []) {
  if (!fs.existsSync(dir)) {
    return result;
  }
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectConnectorJars(fullPath, result);
    } else if (
      entry.isFile() &&
      /^mysql-connector-(?:j|java)-.+\.jar$/u.test(entry.name) &&
      !entry.name.includes('sources')
    ) {
      result.push(fullPath);
    }
  }
  return result;
}

function resolveMysqlConnectorJar() {
  const home = os.homedir();
  const candidates = [
    path.join(home, '.m2', 'repository', 'com', 'mysql', 'mysql-connector-j'),
    path.join(home, '.m2', 'repository', 'mysql', 'mysql-connector-java')
  ].flatMap((dir) => collectConnectorJars(dir));
  if (candidates.length === 0) {
    throw new Error('MySQL Connector/J jar not found under ~/.m2/repository. Run backend Maven build first.');
  }
  return candidates.sort(compareVersionLike).at(-1);
}

function javaDbToolSource() {
  return String.raw`import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.util.ArrayList;
import java.util.List;

public class NoticeDbTool {
  private static String env(String name) {
    String value = System.getenv(name);
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException("Missing env: " + name);
    }
    return value;
  }

  private static String json(String value) {
    if (value == null) {
      return "null";
    }
    StringBuilder out = new StringBuilder("\"");
    for (int i = 0; i < value.length(); i++) {
      char c = value.charAt(i);
      switch (c) {
        case '"': out.append("\\\""); break;
        case '\\': out.append("\\\\"); break;
        case '\b': out.append("\\b"); break;
        case '\f': out.append("\\f"); break;
        case '\n': out.append("\\n"); break;
        case '\r': out.append("\\r"); break;
        case '\t': out.append("\\t"); break;
        default:
          if (c < 0x20) {
            out.append(String.format("\\u%04x", (int) c));
          } else {
            out.append(c);
          }
      }
    }
    out.append('"');
    return out.toString();
  }

  private static void requireE2eTitle(String title) {
    if (title == null || !title.startsWith("e2e_")) {
      throw new IllegalArgumentException("Refusing non-e2e title: " + title);
    }
  }

  private static List<String> rowsForTitle(Connection conn, String title) throws Exception {
    String sql = "SELECT notice_id, notice_title, notice_type, status, create_by, update_by, create_time, update_time FROM sys_notice WHERE notice_title = ? ORDER BY notice_id";
    List<String> rows = new ArrayList<>();
    try (PreparedStatement ps = conn.prepareStatement(sql)) {
      ps.setString(1, title);
      try (ResultSet rs = ps.executeQuery()) {
        ResultSetMetaData meta = rs.getMetaData();
        while (rs.next()) {
          StringBuilder item = new StringBuilder("{");
          for (int i = 1; i <= meta.getColumnCount(); i++) {
            if (i > 1) {
              item.append(',');
            }
            String label = meta.getColumnLabel(i);
            Object value = rs.getObject(i);
            item.append(json(label)).append(':').append(json(value == null ? null : String.valueOf(value)));
          }
          item.append('}');
          rows.add(item.toString());
        }
      }
    }
    return rows;
  }

  public static void main(String[] args) throws Exception {
    if (args.length < 2) {
      throw new IllegalArgumentException("Usage: NoticeDbTool <select|delete> <e2e-title>...");
    }
    String mode = args[0];
    String jdbcUrl = env("INFOQ_E2E_JDBC_URL");
    String username = env("INFOQ_E2E_DB_USER");
    String password = env("INFOQ_E2E_DB_PASSWORD");
    Class.forName("com.mysql.cj.jdbc.Driver");
    int deleted = 0;
    List<String> rows = new ArrayList<>();
    try (Connection conn = DriverManager.getConnection(jdbcUrl, username, password)) {
      for (int i = 1; i < args.length; i++) {
        String title = args[i];
        requireE2eTitle(title);
        if ("select".equals(mode)) {
          rows.addAll(rowsForTitle(conn, title));
        } else if ("delete".equals(mode)) {
          try (PreparedStatement ps = conn.prepareStatement("DELETE FROM sys_notice WHERE notice_title = ?")) {
            ps.setString(1, title);
            deleted += ps.executeUpdate();
          }
        } else {
          throw new IllegalArgumentException("Unsupported mode: " + mode);
        }
      }
    }
    StringBuilder out = new StringBuilder("{");
    out.append("\"mode\":").append(json(mode)).append(',');
    out.append("\"rows\":[");
    for (int i = 0; i < rows.size(); i++) {
      if (i > 0) {
        out.append(',');
      }
      out.append(rows.get(i));
    }
    out.append("],");
    out.append("\"count\":").append(rows.size()).append(',');
    out.append("\"deleted\":").append(deleted);
    out.append('}');
    System.out.println(out);
  }
}
`;
}

async function prepareDbTool(runDir) {
  const dbDir = ensureDir(path.join(runDir, 'db'));
  const sourcePath = path.join(dbDir, 'NoticeDbTool.java');
  const classPath = path.join(dbDir, 'NoticeDbTool.class');
  const connectorJar = resolveMysqlConnectorJar();
  fs.writeFileSync(sourcePath, javaDbToolSource(), 'utf8');
  await runCommandChecked('javac', ['-encoding', 'UTF-8', '-cp', connectorJar, sourcePath], {
    cwd: dbDir,
    captureOutput: true
  });
  if (!fs.existsSync(classPath)) {
    throw new Error(`DB tool compilation did not produce ${classPath}`);
  }
  return {dbDir, sourcePath, connectorJar};
}

async function runDbTool(dbTool, dbConfig, mode, titles) {
  for (const title of titles) {
    assertE2eTitle(title);
  }
  const result = await runCommandChecked(
    'java',
    ['-cp', `${dbTool.dbDir}${path.delimiter}${dbTool.connectorJar}`, 'NoticeDbTool', mode, ...titles],
    {
      cwd: dbTool.dbDir,
      env: {
        ...process.env,
        INFOQ_E2E_JDBC_URL: dbConfig.jdbcUrl,
        INFOQ_E2E_DB_USER: dbConfig.username,
        INFOQ_E2E_DB_PASSWORD: dbConfig.password
      },
      captureOutput: true
    }
  );
  const line = result.stdout.trim().split(/\r?\n/u).at(-1) || '{}';
  try {
    return JSON.parse(line);
  } catch (error) {
    throw new Error(`Failed to parse DB tool output: ${line}\n${error.message || error}`);
  }
}

async function takeScreenshot(page, runDir, name) {
  const screenshotPath = path.join(runDir, 'screenshots', `${name}.png`);
  ensureDir(path.dirname(screenshotPath));
  await page.screenshot({path: screenshotPath, fullPage: true});
  return screenshotPath;
}

function rowSelector(client) {
  return client === 'vue'
    ? '.el-table__body-wrapper tbody tr, .el-table__body tbody tr'
    : '.ant-table-tbody tr';
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function waitForSettled(page, timeoutMs) {
  try {
    await page.waitForLoadState('networkidle', {timeout: Math.min(timeoutMs, 12000)});
  } catch {
    // Admin pages may keep polling/SSE alive; element and API/DB assertions are the gate.
  }
  await page.waitForTimeout(350);
}

function textButton(page, label) {
  return page.locator('button').filter({hasText: new RegExp(`^\\s*${escapeRegExp(label)}\\s*$`, 'u')}).first();
}

async function clickToolbarButton(page, label, timeoutMs) {
  const button = textButton(page, label);
  await button.waitFor({state: 'visible', timeout: timeoutMs});
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await button.isEnabled()) {
      await button.click();
      return;
    }
    await page.waitForTimeout(250);
  }
  throw new Error(`Toolbar button did not become enabled: ${label}`);
}

function titleRows(page, client, title) {
  return page.locator(rowSelector(client)).filter({hasText: title});
}

async function waitForTitleRow(page, client, title, timeoutMs) {
  const row = titleRows(page, client, title).first();
  await row.waitFor({state: 'visible', timeout: timeoutMs});
  return row;
}

async function waitForNoTitleRow(page, client, title, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const rows = titleRows(page, client, title);
  while (Date.now() < deadline) {
    if ((await rows.count()) === 0) {
      return;
    }
    await page.waitForTimeout(400);
  }
  throw new Error(`Table row still visible for title: ${title}`);
}

async function searchTitle(page, client, title, timeoutMs) {
  const input = page.getByPlaceholder('请输入公告标题').first();
  await input.waitFor({state: 'visible', timeout: timeoutMs});
  await input.fill(title);
  await clickToolbarButton(page, '搜索', timeoutMs);
  await waitForSettled(page, timeoutMs);
  if (title) {
    await waitForTitleRow(page, client, title, timeoutMs);
  }
}

async function searchTitleExpectAbsent(page, client, title, timeoutMs) {
  const input = page.getByPlaceholder('请输入公告标题').first();
  await input.waitFor({state: 'visible', timeout: timeoutMs});
  await input.fill(title);
  await clickToolbarButton(page, '搜索', timeoutMs);
  await waitForSettled(page, timeoutMs);
  await waitForNoTitleRow(page, client, title, timeoutMs);
}

async function selectRow(page, client, title, timeoutMs) {
  const row = await waitForTitleRow(page, client, title, timeoutMs);
  if (client === 'vue') {
    const checkbox = row.locator('.el-checkbox__input, .el-checkbox__inner, input[type="checkbox"]').first();
    await checkbox.click({force: true});
  } else {
    const checkbox = row.locator('input[type="checkbox"]').first();
    await checkbox.check({force: true});
  }
  await page.waitForTimeout(250);
}

async function clickRowAction(page, client, title, actionIndex, timeoutMs) {
  const row = await waitForTitleRow(page, client, title, timeoutMs);
  const button = row.locator('button').nth(actionIndex);
  await button.waitFor({state: 'visible', timeout: timeoutMs});
  await button.click();
}

async function selectNoticeTypeInAntd(page, modal, timeoutMs) {
  const formItem = modal.locator('.ant-form-item').filter({hasText: '公告类型'}).first();
  await formItem.locator('.ant-select').click();
  const options = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option');
  await options.first().waitFor({state: 'visible', timeout: timeoutMs});
  await options.filter({hasText: /通知|公告/u}).first().click();
}

async function selectNoticeTypeInVue(page, dialog, timeoutMs) {
  const formItem = dialog.locator('.el-form-item').filter({hasText: '公告类型'}).first();
  await formItem.locator('.el-select').click();
  const options = page.locator('.el-select-dropdown:visible .el-select-dropdown__item');
  await options.first().waitFor({state: 'visible', timeout: timeoutMs});
  await options.filter({hasText: /通知|公告/u}).first().click();
}

async function fillReactNoticeModal(page, title, mode, timeoutMs) {
  const modalTitle = mode === 'add' ? '新增公告' : '修改公告';
  const modal = page.locator('.ant-modal').filter({hasText: modalTitle}).last();
  await modal.waitFor({state: 'visible', timeout: timeoutMs});
  const titleInput = modal.locator('.ant-form-item').filter({hasText: '公告标题'}).locator('input').first();
  await titleInput.fill(title);
  if (mode === 'add') {
    await selectNoticeTypeInAntd(page, modal, timeoutMs);
  }
  await modal.locator('.ant-modal-footer .ant-btn-primary').click();
  await modal.waitFor({state: 'hidden', timeout: timeoutMs});
}

async function fillVueNoticeDialog(page, title, mode, timeoutMs) {
  const dialogTitle = mode === 'add' ? '添加公告' : '修改公告';
  const dialog = page.locator('.el-dialog').filter({hasText: dialogTitle}).last();
  await dialog.waitFor({state: 'visible', timeout: timeoutMs});
  const titleInput = dialog.locator('.el-form-item').filter({hasText: '公告标题'}).locator('input').first();
  await titleInput.fill(title);
  if (mode === 'add') {
    await selectNoticeTypeInVue(page, dialog, timeoutMs);
  }
  await dialog.locator('.el-dialog__footer button.el-button--primary').click();
  await dialog.waitFor({state: 'hidden', timeout: timeoutMs});
}

async function createNoticeViaUi(page, options, data) {
  await clickToolbarButton(page, '新增', options.timeoutMs);
  if (options.client === 'vue') {
    await fillVueNoticeDialog(page, data.baseTitle, 'add', options.timeoutMs);
  } else {
    await fillReactNoticeModal(page, data.baseTitle, 'add', options.timeoutMs);
  }
  await waitForSettled(page, options.timeoutMs);
}

async function editNoticeViaUi(page, options, data) {
  await clickRowAction(page, options.client, data.baseTitle, 0, options.timeoutMs);
  if (options.client === 'vue') {
    await fillVueNoticeDialog(page, data.editedTitle, 'edit', options.timeoutMs);
  } else {
    await fillReactNoticeModal(page, data.editedTitle, 'edit', options.timeoutMs);
  }
  await waitForSettled(page, options.timeoutMs);
}

async function deleteNoticeViaUi(page, options, data) {
  await selectRow(page, options.client, data.editedTitle, options.timeoutMs);
  await clickToolbarButton(page, '删除', options.timeoutMs);
  if (options.client === 'vue') {
    const box = page.locator('.el-message-box').filter({hasText: '系统提示'}).last();
    await box.waitFor({state: 'visible', timeout: options.timeoutMs});
    await box.locator('button.el-button--primary').click();
    await box.waitFor({state: 'hidden', timeout: options.timeoutMs});
  } else {
    const confirm = page.locator('.ant-modal-confirm').filter({hasText: '系统提示'}).last();
    await confirm.waitFor({state: 'visible', timeout: options.timeoutMs});
    await confirm.locator('.ant-btn-primary').click();
    await confirm.waitFor({state: 'hidden', timeout: options.timeoutMs});
  }
  await waitForSettled(page, options.timeoutMs);
}

async function verifyNoticeApiDb(report, label, options, token, dbTool, dbConfig, titles) {
  const api = {};
  for (const title of titles) {
    api[title] = (await listNoticeByTitle(options, token, title)).map((row) => ({
      noticeId: row.noticeId,
      noticeTitle: row.noticeTitle,
      noticeType: row.noticeType,
      status: row.status,
      createByName: row.createByName
    }));
  }
  const db = await runDbTool(dbTool, dbConfig, 'select', titles);
  const snapshot = {
    label,
    at: new Date().toISOString(),
    api,
    db
  };
  report.verification.push(snapshot);
  return snapshot;
}

async function runBrowserCrud(options, runDir, token, data, report, dbTool, dbConfig) {
  let chromium;
  try {
    ({chromium} = browserRequire('playwright'));
  } catch (error) {
    throw new Error(
      `Playwright runtime is required. Install it with:\n` +
      `pnpm --dir .codex/skills/infoq-browser-automate/scripts install\n` +
      `pnpm --dir .codex/skills/infoq-browser-automate/scripts exec playwright install chromium\n` +
      `${error.message || error}`
    );
  }

  const browser = await chromium.launch({headless: !options.headed});
  const consoleEntries = [];
  const consoleLogPath = path.join(runDir, 'console', 'notice-crud.json');
  ensureDir(path.dirname(consoleLogPath));

  try {
    const context = await browser.newContext({
      viewport: {width: 1440, height: 900}
    });
    await context.addInitScript(
      ({key, value}) => {
        window.localStorage.setItem(key, value);
      },
      {key: 'Admin-Token', value: token}
    );
    const page = await context.newPage();
    page.on('console', (message) => {
      consoleEntries.push({
        type: message.type(),
        text: message.text(),
        location: message.location()
      });
    });
    page.on('pageerror', (error) => {
      consoleEntries.push({
        type: 'pageerror',
        text: error.message
      });
    });

    const targetUrl = `${options.frontendOrigin}${NOTICE_ROUTE}`;
    report.browser.targetUrl = targetUrl;
    await page.goto(targetUrl, {waitUntil: 'domcontentloaded', timeout: options.timeoutMs});
    await page.getByPlaceholder('请输入公告标题').first().waitFor({state: 'visible', timeout: options.timeoutMs});
    await clickToolbarButton(page, '新增', options.timeoutMs);
    if (options.client === 'vue') {
      await fillVueNoticeDialog(page, data.baseTitle, 'add', options.timeoutMs);
    } else {
      await fillReactNoticeModal(page, data.baseTitle, 'add', options.timeoutMs);
    }
    await waitForSettled(page, options.timeoutMs);
    await searchTitle(page, options.client, data.baseTitle, options.timeoutMs);
    report.browser.screenshots.afterCreate = await takeScreenshot(page, runDir, 'after-create');
    await verifyNoticeApiDb(report, 'after-create', options, token, dbTool, dbConfig, [data.baseTitle, data.editedTitle]);

    await editNoticeViaUi(page, options, data);
    await searchTitle(page, options.client, data.editedTitle, options.timeoutMs);
    await waitForNoTitleRow(page, options.client, data.baseTitle, options.timeoutMs);
    report.browser.screenshots.afterEdit = await takeScreenshot(page, runDir, 'after-edit');
    await verifyNoticeApiDb(report, 'after-edit', options, token, dbTool, dbConfig, [data.baseTitle, data.editedTitle]);

    await deleteNoticeViaUi(page, options, data);
    await searchTitleExpectAbsent(page, options.client, data.editedTitle, options.timeoutMs);
    report.browser.screenshots.afterDelete = await takeScreenshot(page, runDir, 'after-delete');
    await verifyNoticeApiDb(report, 'after-delete', options, token, dbTool, dbConfig, [data.baseTitle, data.editedTitle]);

    fs.writeFileSync(consoleLogPath, `${JSON.stringify(consoleEntries, null, 2)}\n`, 'utf8');
    report.browser.consoleLogPath = consoleLogPath;
    report.browser.consoleEntries = consoleEntries.length;
    report.browser.badConsoleEntries = consoleEntries.filter((entry) => entry.type === 'error' || entry.type === 'pageerror').length;
    if (!options.allowConsoleErrors && report.browser.badConsoleEntries > 0) {
      throw new Error(`Console check failed with ${report.browser.badConsoleEntries} bad entries. See ${consoleLogPath}`);
    }
  } catch (error) {
    fs.writeFileSync(consoleLogPath, `${JSON.stringify(consoleEntries, null, 2)}\n`, 'utf8');
    report.browser.consoleLogPath = consoleLogPath;
    report.browser.consoleEntries = consoleEntries.length;
    report.browser.badConsoleEntries = consoleEntries.filter((entry) => entry.type === 'error' || entry.type === 'pageerror').length;
    throw error;
  } finally {
    await browser.close();
  }
}

function summarizeVerification(report, baseTitle, editedTitle) {
  const afterCreate = report.verification.find((item) => item.label === 'after-create');
  const afterEdit = report.verification.find((item) => item.label === 'after-edit');
  const afterDelete = report.verification.find((item) => item.label === 'after-delete');
  const finalDb = report.cleanup?.finalDb || null;
  return {
    afterCreateApiRows: afterCreate?.api?.[baseTitle]?.length ?? null,
    afterCreateDbRows: afterCreate?.db?.rows?.filter((row) => row.notice_title === baseTitle).length ?? null,
    afterEditOldApiRows: afterEdit?.api?.[baseTitle]?.length ?? null,
    afterEditNewApiRows: afterEdit?.api?.[editedTitle]?.length ?? null,
    afterEditDbRows: afterEdit?.db?.rows?.length ?? null,
    afterDeleteApiRows: Object.values(afterDelete?.api || {}).reduce((sum, rows) => sum + rows.length, 0),
    afterDeleteDbRows: afterDelete?.db?.rows?.length ?? null,
    finalDbRows: finalDb?.rows?.length ?? null
  };
}

function writeMarkdownReport(reportPath, report) {
  const lines = [
    '# InfoQ Admin Notice CRUD E2E Report',
    '',
    `- Run ID: ${report.runId}`,
    `- Client: ${report.client}`,
    `- Status: ${report.status}`,
    `- Backend: ${report.backendUrl}`,
    `- Frontend: ${report.frontendOrigin}`,
    `- Route: ${NOTICE_ROUTE}`,
    `- User: ${report.username || ''}`,
    `- DB: ${report.dbTarget.host}:${report.dbTarget.port}/${report.dbTarget.database} (${report.dbTarget.profile})`,
    `- Test data: ${report.testData.baseTitle} -> ${report.testData.editedTitle}`,
    `- Console bad entries: ${report.browser.badConsoleEntries}`,
    `- Evidence: ${report.runDir}`,
    '',
    '## Verification',
    ''
  ];

  for (const item of report.verification) {
    const apiCount = Object.values(item.api || {}).reduce((sum, rows) => sum + rows.length, 0);
    lines.push(`- ${item.label}: apiRows=${apiCount}, dbRows=${item.db?.rows?.length ?? 'n/a'}`);
  }

  lines.push('', '## Cleanup', '');
  lines.push(`- API cleanup deleted: ${report.cleanup?.api?.deleted?.length ?? 0}`);
  lines.push(`- DB fallback deleted: ${report.cleanup?.dbFallback?.deleted ?? 0}`);
  lines.push(`- Final DB rows: ${report.cleanup?.finalDb?.rows?.length ?? 'n/a'}`);
  if (report.error) {
    lines.push('', '## Error', '', `- ${report.error}`);
  }
  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
}

async function main() {
  const options = parseArgs(normalizeForwardedArgs(process.argv.slice(2)));
  const clientConfig = CLIENTS[options.client];
  const runId = options.runId || `notice-crud-${options.client}-${timestampSlug()}`;
  const runDir = resolveDocTmpPath(repoRoot, 'infoq-admin-e2e', runId);
  ensureDir(runDir);
  options.backendUrl = options.backendUrl.replace(/\/+$/, '');
  if (options.backendUrl === DEFAULTS.backendUrl && options.backendPort !== DEFAULTS.backendPort) {
    options.backendUrl = `http://127.0.0.1:${options.backendPort}`;
  }
  if (!options.frontendPort) {
    options.frontendPort = String(clientConfig.defaultFrontendPort);
  }
  if (!options.frontendOrigin) {
    options.frontendOrigin = buildFrontendOrigin(options);
  }

  const dbConfig = readApplicationDbConfig(options.profile);
  const dbTool = await prepareDbTool(runDir);
  const testData = makeTestData(options.client);
  const report = {
    runId,
    runDir,
    client: options.client,
    backendUrl: options.backendUrl,
    frontendOrigin: options.frontendOrigin,
    username: '',
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: '',
    dbTarget: {
      profile: dbConfig.profile,
      configPath: path.relative(repoRoot, dbConfig.configPath),
      jdbcUrl: dbConfig.sanitizedJdbcUrl,
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      username: dbConfig.username
    },
    testData,
    browser: {
      targetUrl: '',
      screenshots: {},
      consoleLogPath: '',
      consoleEntries: 0,
      badConsoleEntries: 0
    },
    loginAttempts: [],
    verification: [],
    cleanup: {
      api: null,
      dbFallback: null,
      finalDb: null
    },
    summary: {},
    error: ''
  };
  writeJson(path.join(runDir, 'db-target.json'), report.dbTarget);
  writeJson(path.join(runDir, 'test-data.json'), testData);

  const stackConfig = buildStackConfig(options, runDir);
  const stopStaleStackBeforeRun = async () => {
    const state = readJsonFile(stackConfig.stateFile, null);
    const shouldStop =
      ['starting', 'interrupted'].includes(state?.status) ||
      (state?.status === 'running' && state.keepAlive !== true);
    if (!shouldStop) {
      return;
    }
    console.log(`[notice-crud] cleaning recorded stack state before run: ${stackConfig.stateFile}`);
    await stopAdminDevStackState(stackConfig, {status: 'stopped', reason: 'stale-before-notice-crud'});
  };
  let token = '';
  let finalStatus = 'stopped';
  let stopReason = 'notice-crud-complete';
  const stopStackIfNeeded = async (status, reason) => {
    if (options.startStack && (options.stopStackAfter || status !== 'stopped')) {
      await stopAdminDevStackState(stackConfig, {status, reason});
    }
  };
  const handleInterrupt = async (signal) => {
    await stopStackIfNeeded('interrupted', signal);
    process.exit(signal === 'SIGINT' ? 130 : signal === 'SIGHUP' ? 129 : 143);
  };
  const handleSigint = () => handleInterrupt('SIGINT');
  const handleSigterm = () => handleInterrupt('SIGTERM');
  const handleSighup = () => handleInterrupt('SIGHUP');
  process.once('SIGINT', handleSigint);
  process.once('SIGTERM', handleSigterm);
  process.once('SIGHUP', handleSighup);

  try {
    console.log(`[notice-crud] DB target: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database} via ${path.relative(repoRoot, dbConfig.configPath)}`);
    console.log(`[notice-crud] test data: ${testData.baseTitle} -> ${testData.editedTitle}`);
    if (options.startStack) {
      await stopStaleStackBeforeRun();
      console.log(`[notice-crud] starting/reusing stack for ${options.client}`);
      await runAdminDevStack(stackConfig, buildStackArgs(options, clientConfig));
    }

    const beforeDb = await runDbTool(dbTool, dbConfig, 'select', [testData.baseTitle, testData.editedTitle]);
    report.verification.push({label: 'before', at: new Date().toISOString(), api: {}, db: beforeDb});
    if (beforeDb.rows.length > 0) {
      const deleted = await runDbTool(dbTool, dbConfig, 'delete', [testData.baseTitle, testData.editedTitle]);
      report.cleanup.dbFallback = {reason: 'pre-run-exact-title-collision', ...deleted};
      const afterPreCleanup = await runDbTool(dbTool, dbConfig, 'select', [testData.baseTitle, testData.editedTitle]);
      if (afterPreCleanup.rows.length > 0) {
        throw new Error(`Pre-run DB cleanup failed for exact test titles: ${JSON.stringify(afterPreCleanup.rows)}`);
      }
    }

    console.log(`[notice-crud] backend: ${options.backendUrl}`);
    console.log(`[notice-crud] frontend: ${options.frontendOrigin}`);
    console.log(`[notice-crud] evidence: ${runDir}`);
    const login = await loginWithRealCaptcha({
      ...options,
      logPrefix: 'notice-crud'
    }, runDir);
    token = login.token;
    report.username = login.username;
    report.loginAttempts = login.attempts;

    const userInfoResponse = await apiRequest(options, token, 'GET', '/system/user/getInfo');
    const userInfo = userInfoResponse?.data || userInfoResponse;
    const permissions = Array.isArray(userInfo?.permissions) ? userInfo.permissions : [];
    for (const permission of ['system:notice:list', 'system:notice:query', 'system:notice:add', 'system:notice:edit', 'system:notice:remove']) {
      if (!permissions.includes(permission) && !permissions.includes('*:*:*')) {
        throw new Error(`Login user ${login.username} lacks required permission: ${permission}`);
      }
    }

    const apiCleanup = await cleanupByApi(options, token, [testData.baseTitle, testData.editedTitle]);
    report.cleanup.api = apiCleanup;
    if (apiCleanup.errors.length > 0) {
      throw new Error(`Pre-run API cleanup failed: ${JSON.stringify(apiCleanup.errors)}`);
    }

    await runBrowserCrud(options, runDir, token, testData, report, dbTool, dbConfig);

    const finalApiCleanup = await cleanupByApi(options, token, [testData.baseTitle, testData.editedTitle]);
    report.cleanup.api = {
      ...finalApiCleanup,
      deleted: [...(report.cleanup.api?.deleted || []), ...finalApiCleanup.deleted],
      errors: [...(report.cleanup.api?.errors || []), ...finalApiCleanup.errors],
      skipped: [...(report.cleanup.api?.skipped || []), ...finalApiCleanup.skipped]
    };
    if (report.cleanup.api.errors.length > 0) {
      throw new Error(`Final API cleanup failed: ${JSON.stringify(report.cleanup.api.errors)}`);
    }
    const finalDb = await runDbTool(dbTool, dbConfig, 'select', [testData.baseTitle, testData.editedTitle]);
    report.cleanup.finalDb = finalDb;
    if (finalDb.rows.length > 0) {
      const fallback = await runDbTool(dbTool, dbConfig, 'delete', [testData.baseTitle, testData.editedTitle]);
      report.cleanup.dbFallback = {reason: 'final-db-residue', ...fallback};
      const afterFallback = await runDbTool(dbTool, dbConfig, 'select', [testData.baseTitle, testData.editedTitle]);
      report.cleanup.finalDb = afterFallback;
      if (afterFallback.rows.length > 0) {
        throw new Error(`DB cleanup failed; rows remain: ${JSON.stringify(afterFallback.rows)}`);
      }
    }

    report.status = 'passed';
    if (options.startStack && !options.stopStackAfter) {
      markRunState(stackConfig.stateFile, {
        status: 'running',
        validationStatus: 'passed',
        keepAlive: true,
        keepReason: '--keep-stack-after',
        context: stackConfig.stateContext
      });
    }
    console.log('[notice-crud] completed successfully');
  } catch (error) {
    finalStatus = 'failed';
    stopReason = error.message || String(error);
    report.status = 'failed';
    report.error = stopReason;
    if (!report.cleanup.api && token) {
      report.cleanup.api = await cleanupByApi(options, token, [testData.baseTitle, testData.editedTitle]).catch((cleanupError) => ({
        mode: 'api',
        attempted: true,
        deleted: [],
        skipped: [],
        errors: [{error: cleanupError.message || String(cleanupError)}]
      }));
    }
    const finalDb = await runDbTool(dbTool, dbConfig, 'select', [testData.baseTitle, testData.editedTitle]).catch((dbError) => ({
      mode: 'select',
      rows: [],
      count: null,
      deleted: 0,
      error: dbError.message || String(dbError)
    }));
    report.cleanup.finalDb = finalDb;
    if (Array.isArray(finalDb.rows) && finalDb.rows.length > 0) {
      report.cleanup.dbFallback = await runDbTool(dbTool, dbConfig, 'delete', [testData.baseTitle, testData.editedTitle]).catch((dbError) => ({
        mode: 'delete',
        rows: [],
        count: null,
        deleted: 0,
        error: dbError.message || String(dbError)
      }));
      report.cleanup.finalDb = await runDbTool(dbTool, dbConfig, 'select', [testData.baseTitle, testData.editedTitle]).catch((dbError) => ({
        mode: 'select',
        rows: [],
        count: null,
        deleted: 0,
        error: dbError.message || String(dbError)
      }));
    }
    throw error;
  } finally {
    report.finishedAt = new Date().toISOString();
    report.summary = summarizeVerification(report, testData.baseTitle, testData.editedTitle);
    writeJson(path.join(runDir, 'report.json'), report);
    writeMarkdownReport(path.join(runDir, 'report.md'), report);
    console.log(`[notice-crud] report: ${path.join(runDir, 'report.md')}`);
    process.removeListener('SIGINT', handleSigint);
    process.removeListener('SIGTERM', handleSigterm);
    process.removeListener('SIGHUP', handleSighup);
    await stopStackIfNeeded(finalStatus, stopReason);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
