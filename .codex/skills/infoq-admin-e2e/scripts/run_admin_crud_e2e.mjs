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

const CLIENTS = {
  vue: {
    shortName: 'vue',
    label: 'admin-crud-vue',
    frontendDirName: 'infoq-scaffold-frontend-vue',
    frontendDisplayName: 'Vue admin',
    frontendLogPrefix: 'frontend-vue',
    frontendPortFlag: '--vue-port',
    frontendPortEnv: 'VUE_PORT',
    defaultFrontendPort: 5173
  },
  react: {
    shortName: 'react',
    label: 'admin-crud-react',
    frontendDirName: 'infoq-scaffold-frontend-react',
    frontendDisplayName: 'React admin',
    frontendLogPrefix: 'frontend-react',
    frontendPortFlag: '--react-port',
    frontendPortEnv: 'REACT_PORT',
    defaultFrontendPort: 5174
  },
  'react-pro': {
    shortName: 'react-pro',
    label: 'admin-crud-react-pro',
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

const SAFE_MODULE_ORDER = ['role', 'user', 'menu', 'dept', 'post', 'dict', 'config', 'notice', 'client', 'invite', 'ossConfig', 'job', 'online'];
const OSS_CONFIG_KEY_PLACEHOLDER = /配置\s*[Kk]ey/u;
const SAFETY_GATES = [
  {
    key: 'nonE2eDelete',
    label: '非 e2e_ 数据保护',
    route: '*',
    reason: '不自动删除非 e2e_ 数据。'
  },
  {
    key: 'logClear',
    label: '日志清空保护',
    route: '/monitor/jobLog,/system/log/operLog,/system/log/loginInfo',
    reason: '不清空日志。'
  },
  {
    key: 'onlineForceLogout',
    label: '在线用户强退保护',
    route: '/monitor/online',
    reason: '不强退非当前 run 创建的 e2e_ 在线会话。'
  },
  {
    key: 'jobRunNow',
    label: '定时任务立即执行保护',
    route: '/monitor/job',
    reason: '不触发定时任务“立即执行”。'
  },
  {
    key: 'ossObjectMutation',
    label: 'OSS 对象保护',
    route: '/system/oss',
    reason: '不触碰真实 OSS 对象上传/删除。'
  },
  {
    key: 'missingIsolatedFixtures',
    label: '隔离 fixture 缺失保护',
    route: '/system/oss,/monitor/jobLog,/system/log/operLog,/system/log/loginInfo,/monitor/online',
    reason: '对 OSS 对象、日志、在线用户这类场景，缺少隔离 fixture 时记录 blocker，不伪造通过。'
  }
];

function printHelp() {
  console.log(`Usage:
  node .codex/skills/infoq-admin-e2e/scripts/run_admin_crud_e2e.mjs --client <vue|react|react-pro> [options]

Examples:
  node .codex/skills/infoq-admin-e2e/scripts/run_admin_crud_e2e.mjs --client react
  node .codex/skills/infoq-admin-e2e/scripts/run_admin_crud_e2e.mjs --client vue --modules post,notice
  node .codex/skills/infoq-admin-e2e/scripts/run_admin_crud_e2e.mjs --client react-pro --no-start-stack --frontend-origin http://127.0.0.1:4184

Options:
  --client <vue|react|react-pro>    Required admin client.
  --modules <csv>                   Module keys. Default: ${SAFE_MODULE_ORDER.join(',')}.
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
    modules: SAFE_MODULE_ORDER,
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
      case '--modules':
        options.modules = readValue(argv, index, arg).split(',').map((item) => item.trim()).filter(Boolean);
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
    throw new Error('Admin CRUD E2E is restricted to --profile local because it writes to application-local.yml test data only.');
  }
  const unknownModules = options.modules.filter((key) => !SAFE_MODULE_ORDER.includes(key));
  if (unknownModules.length > 0) {
    throw new Error(`Unknown module(s): ${unknownModules.join(', ')}. Supported: ${SAFE_MODULE_ORDER.join(', ')}`);
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
    scriptPath: '.codex/skills/infoq-admin-e2e/scripts/run_admin_crud_e2e.mjs',
    stateSlug: `infoq-admin-e2e/stack/${options.client}`,
    stateFile: path.join(stateDir, 'state.json'),
    stateContext: {
      runId: path.basename(runDir),
      evidenceDir: runDir,
      mode: 'admin-crud'
    },
    defaultBackendPort: 8080,
    defaultFrontendPort: clientConfig.defaultFrontendPort
  };
}

function buildStackArgs(options, clientConfig) {
  const args = [
    '--backend-port', options.backendPort,
    clientConfig.frontendPortFlag, options.frontendPort || String(clientConfig.defaultFrontendPort),
    '--frontend-host', options.frontendHost,
    '--profile', options.profile
  ];
  if (options.buildBackend) args.push('--build-backend');
  if (options.forceRestart) args.push('--force-restart');
  return args;
}

function buildFrontendOrigin(options) {
  if (options.frontendOrigin) return options.frontendOrigin;
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
  const configPath = path.join(repoRoot, 'infoq-scaffold-backend', 'infoq-admin', 'src', 'main', 'resources', `application-${profile}.yml`);
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
    if (!line) throw new Error(`${key} not found in master datasource block: ${configPath}`);
    return stripQuotes(line.replace(new RegExp(`^\\s*${key}:\\s*`), ''));
  };
  const jdbcUrl = readKey('url');
  const username = readKey('username');
  const password = readKey('password');
  const match = jdbcUrl.match(/^jdbc:mysql:\/\/([^/:?]+)(?::(\d+))?\/([^?]+)(?:\?(.*))?$/u);
  if (!match) throw new Error(`Unsupported JDBC URL in ${configPath}: ${jdbcUrl}`);
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

function compareVersionLike(a, b) {
  const parse = (value) => String(value).match(/\d+(?:\.\d+)+/u)?.[0].split('.').map(Number) || [0];
  const left = parse(a);
  const right = parse(b);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0);
    if (diff !== 0) return diff;
  }
  return String(a).localeCompare(String(b));
}

function collectConnectorJars(dir, result = []) {
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) collectConnectorJars(fullPath, result);
    else if (entry.isFile() && /^mysql-connector-(?:j|java)-.+\.jar$/u.test(entry.name) && !entry.name.includes('sources')) result.push(fullPath);
  }
  return result;
}

function resolveMysqlConnectorJar() {
  const home = os.homedir();
  const candidates = [
    path.join(home, '.m2', 'repository', 'com', 'mysql', 'mysql-connector-j'),
    path.join(home, '.m2', 'repository', 'mysql', 'mysql-connector-java')
  ].flatMap((dir) => collectConnectorJars(dir));
  if (candidates.length === 0) throw new Error('MySQL Connector/J jar not found under ~/.m2/repository. Run backend Maven build first.');
  return candidates.sort(compareVersionLike).at(-1);
}

function dbToolSource() {
  return String.raw`import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.util.ArrayList;
import java.util.List;

public class AdminCrudDbTool {
  private record Query(String table, String keyColumn, String idColumn, String activeClause, String[] columns) {}

  private static final java.util.Map<String, Query> QUERIES = java.util.Map.ofEntries(
    java.util.Map.entry("role", new Query("sys_role", "role_key", "role_id", "del_flag = \'0\'", new String[]{"role_id","role_name","role_key","status"})),
    java.util.Map.entry("user", new Query("sys_user", "user_name", "user_id", "del_flag = \'0\'", new String[]{"user_id","user_name","nick_name","status"})),
    java.util.Map.entry("menu", new Query("sys_menu", "menu_name", "menu_id", "", new String[]{"menu_id","menu_name","path","status","visible"})),
    java.util.Map.entry("dept", new Query("sys_dept", "dept_name", "dept_id", "del_flag = \'0\'", new String[]{"dept_id","dept_name","parent_id","status"})),
    java.util.Map.entry("post", new Query("sys_post", "post_code", "post_id", "", new String[]{"post_id","post_name","post_code","status"})),
    java.util.Map.entry("dictType", new Query("sys_dict_type", "dict_type", "dict_id", "", new String[]{"dict_id","dict_name","dict_type"})),
    java.util.Map.entry("dictData", new Query("sys_dict_data", "dict_label", "dict_code", "", new String[]{"dict_code","dict_label","dict_value","dict_type"})),
    java.util.Map.entry("config", new Query("sys_config", "config_key", "config_id", "", new String[]{"config_id","config_name","config_key","config_value","config_type"})),
    java.util.Map.entry("notice", new Query("sys_notice", "notice_title", "notice_id", "", new String[]{"notice_id","notice_title","notice_type","status"})),
    java.util.Map.entry("client", new Query("sys_client", "client_key", "id", "del_flag = \'0\'", new String[]{"id","client_id","client_key","status"})),
    java.util.Map.entry("invite", new Query("sys_invite_code", "remark", "invite_id", "", new String[]{"invite_id","invite_code","status","remark"})),
    java.util.Map.entry("ossConfig", new Query("sys_oss_config", "config_key", "oss_config_id", "", new String[]{"oss_config_id","config_key","bucket_name","status"})),
    java.util.Map.entry("job", new Query("sys_job", "job_name", "job_id", "del_flag = \'0\'", new String[]{"job_id","job_name","job_group","handler_key","status"}))
  );

  private static String env(String name) {
    String value = System.getenv(name);
    if (value == null || value.isBlank()) throw new IllegalArgumentException("Missing env: " + name);
    return value;
  }

  private static String json(String value) {
    if (value == null) return "null";
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
          if (c < 0x20) out.append(String.format("\\u%04x", (int)c));
          else out.append(c);
      }
    }
    out.append('"');
    return out.toString();
  }

  private static void requireE2eKey(String key) {
    if (key == null || !key.startsWith("e2e_")) throw new IllegalArgumentException("Refusing non-e2e key: " + key);
  }

  private static String rowToJson(ResultSet rs, ResultSetMetaData meta) throws Exception {
    StringBuilder item = new StringBuilder("{");
    for (int i = 1; i <= meta.getColumnCount(); i++) {
      if (i > 1) item.append(',');
      String label = meta.getColumnLabel(i);
      Object value = rs.getObject(i);
      item.append(json(label)).append(':').append(json(value == null ? null : String.valueOf(value)));
    }
    item.append('}');
    return item.toString();
  }

  public static void main(String[] args) throws Exception {
    if (args.length < 2) throw new IllegalArgumentException("Usage: AdminCrudDbTool <module> <e2e-key>...");
    String module = args[0];
    Query query = QUERIES.get(module);
    if (query == null) throw new IllegalArgumentException("Unsupported module: " + module);
    String jdbcUrl = env("INFOQ_E2E_JDBC_URL");
    String username = env("INFOQ_E2E_DB_USER");
    String password = env("INFOQ_E2E_DB_PASSWORD");
    Class.forName("com.mysql.cj.jdbc.Driver");
    List<String> rows = new ArrayList<>();
    try (Connection conn = DriverManager.getConnection(jdbcUrl, username, password)) {
      String sql = "SELECT " + String.join(", ", query.columns()) + " FROM " + query.table() + " WHERE " + query.keyColumn() + " = ?" + (query.activeClause().isBlank() ? "" : " AND " + query.activeClause()) + " ORDER BY " + query.idColumn();
      try (PreparedStatement ps = conn.prepareStatement(sql)) {
        for (int i = 1; i < args.length; i++) {
          String key = args[i];
          requireE2eKey(key);
          ps.setString(1, key);
          try (ResultSet rs = ps.executeQuery()) {
            ResultSetMetaData meta = rs.getMetaData();
            while (rs.next()) rows.add(rowToJson(rs, meta));
          }
        }
      }
    }
    StringBuilder out = new StringBuilder("{");
    out.append("\"module\":").append(json(module)).append(',');
    out.append("\"rows\":[");
    for (int i = 0; i < rows.size(); i++) {
      if (i > 0) out.append(',');
      out.append(rows.get(i));
    }
    out.append("],\"count\":").append(rows.size()).append('}');
    System.out.println(out);
  }
}
`;
}

async function prepareDbTool(runDir) {
  const dbDir = ensureDir(path.join(runDir, 'db'));
  const sourcePath = path.join(dbDir, 'AdminCrudDbTool.java');
  const classPath = path.join(dbDir, 'AdminCrudDbTool.class');
  const connectorJar = resolveMysqlConnectorJar();
  fs.writeFileSync(sourcePath, dbToolSource(), 'utf8');
  await runCommandChecked('javac', ['-encoding', 'UTF-8', '-cp', connectorJar, sourcePath], {cwd: dbDir, captureOutput: true});
  if (!fs.existsSync(classPath)) throw new Error(`DB tool compilation did not produce ${classPath}`);
  return {dbDir, sourcePath, connectorJar};
}

async function runDbTool(dbTool, dbConfig, module, keys) {
  for (const key of keys) assertE2eKey(key);
  const result = await runCommandChecked('java', ['-cp', `${dbTool.dbDir}${path.delimiter}${dbTool.connectorJar}`, 'AdminCrudDbTool', module, ...keys], {
    cwd: dbTool.dbDir,
    env: {...process.env, INFOQ_E2E_JDBC_URL: dbConfig.jdbcUrl, INFOQ_E2E_DB_USER: dbConfig.username, INFOQ_E2E_DB_PASSWORD: dbConfig.password},
    captureOutput: true
  });
  const line = result.stdout.trim().split(/\r?\n/u).at(-1) || '{}';
  try {
    return JSON.parse(line);
  } catch (error) {
    throw new Error(`Failed to parse DB tool output: ${line}\n${error.message || error}`);
  }
}

function buildApiHeaders(options, token) {
  return {Authorization: `Bearer ${token}`, clientid: options.clientId, 'Content-Language': 'zh-CN'};
}

async function apiRequest(options, token, method, apiPath, body = undefined) {
  const headers = buildApiHeaders(options, token);
  const requestOptions = {method, headers};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json;charset=UTF-8';
    requestOptions.body = JSON.stringify(body);
  }
  const {response, body: responseBody} = await fetchJson(`${options.backendUrl}${apiPath}`, requestOptions);
  if (response.status !== 200) throw new Error(`${method} ${apiPath} failed: http=${response.status}, body=${JSON.stringify(responseBody).slice(0, 500)}`);
  if (responseBody && Object.prototype.hasOwnProperty.call(responseBody, 'code') && responseBody.code !== 200) {
    throw new Error(`${method} ${apiPath} failed: code=${responseBody.code}, msg=${responseBody.msg || ''}`);
  }
  return responseBody;
}

function assertE2eKey(key) {
  if (!String(key || '').startsWith('e2e_')) throw new Error(`Refusing to operate on non-e2e key: ${key}`);
}

function uniqueKeys(keys) {
  return Array.from(new Set(keys.filter(Boolean)));
}

function flattenRows(rows) {
  const result = [];
  const visit = (items) => {
    for (const item of Array.isArray(items) ? items : []) {
      result.push(item);
      if (Array.isArray(item.children)) visit(item.children);
    }
  };
  visit(rows);
  return result;
}

function responseRows(body) {
  if (Array.isArray(body?.rows)) return body.rows;
  if (Array.isArray(body?.data)) return flattenRows(body.data);
  if (Array.isArray(body)) return flattenRows(body);
  return [];
}

async function listByDefinition(options, token, definition, key) {
  assertE2eKey(key);
  const params = new URLSearchParams({pageNum: '1', pageSize: '100', ...definition.query(key)});
  const body = await apiRequest(options, token, 'GET', `${definition.listPath}?${params.toString()}`);
  return responseRows(body).filter((row) => String(definition.rowKey(row) || '') === key);
}

async function deleteByDefinition(options, token, definition, row) {
  await apiRequest(options, token, 'DELETE', `${definition.deletePath}/${encodeURIComponent(String(definition.id(row)))}`);
}

async function cleanupDefinition(options, token, definition, keys) {
  const result = {module: definition.key, deleted: [], errors: [], skipped: []};
  for (const key of uniqueKeys(keys)) {
    try {
      assertE2eKey(key);
      const rows = await listByDefinition(options, token, definition, key);
      for (const row of rows) {
        if (!String(definition.rowKey(row) || '').startsWith('e2e_')) {
          result.skipped.push({key, id: definition.id(row), reason: 'non-e2e-row-key'});
          continue;
        }
        await deleteByDefinition(options, token, definition, row);
        result.deleted.push({key, id: definition.id(row)});
      }
    } catch (error) {
      result.errors.push({key, error: error.message || String(error)});
    }
  }
  return result;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rowSelector(client) {
  return client === 'vue' ? '.el-table__body-wrapper tbody tr, .el-table__body tbody tr' : '.ant-table-tbody tr';
}

async function waitForSettled(page, timeoutMs) {
  try {
    await page.waitForLoadState('networkidle', {timeout: Math.min(timeoutMs, 12000)});
  } catch {
    // Admin pages may keep long polling alive; element/API/DB assertions are the gate.
  }
  await page.waitForTimeout(350);
}

function textButton(page, label) {
  return page.locator('button').filter({hasText: new RegExp(`^\\s*${escapeRegExp(label)}\\s*$`, 'u')}).first();
}

async function clickButton(page, label, timeoutMs) {
  const button = textButton(page, label);
  await button.waitFor({state: 'visible', timeout: timeoutMs});
  await button.click();
}

async function clickEnabledButton(page, label, timeoutMs) {
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
  throw new Error(`Button did not become enabled: ${label}`);
}

function tableRows(page, client, text) {
  return page.locator(rowSelector(client)).filter({hasText: text});
}

async function waitForRow(page, client, text, timeoutMs) {
  const row = tableRows(page, client, text).first();
  await row.waitFor({state: 'visible', timeout: timeoutMs});
  return row;
}

async function waitForNoRow(page, client, text, timeoutMs) {
  const rows = tableRows(page, client, text);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await rows.count()) === 0) return;
    await page.waitForTimeout(400);
  }
  throw new Error(`Table row still visible: ${text}`);
}

async function waitForVisibleText(page, text, timeoutMs) {
  await page.getByText(text, {exact: false}).first().waitFor({state: 'visible', timeout: timeoutMs});
}

async function searchByPlaceholder(page, placeholder, value, timeoutMs, allowAbsent = false) {
  const input = page.getByPlaceholder(placeholder).first();
  await input.waitFor({state: 'visible', timeout: timeoutMs});
  await input.fill(value);
  await clickButton(page, '搜索', timeoutMs);
  await waitForSettled(page, timeoutMs);
  if (!allowAbsent) await waitForRow(page, 'react', value, 1).catch(() => undefined);
}

function activeContainer(page, client) {
  return client === 'vue'
    ? page.locator('.el-dialog:visible, .el-drawer:visible').last()
    : page.locator('.ant-modal:visible, .ant-drawer:visible').last();
}

function formItem(container, client, label) {
  const selector = client === 'vue' ? '.el-form-item' : '.ant-form-item';
  return container.locator(selector).filter({hasText: label}).first();
}

async function fillField(container, client, label, value, timeoutMs) {
  const item = formItem(container, client, label);
  await item.waitFor({state: 'visible', timeout: timeoutMs});
  const input = item.locator('textarea, input:not([type="hidden"]):not([disabled])').last();
  await input.waitFor({state: 'visible', timeout: timeoutMs});
  await input.fill(String(value));
}

async function chooseSelect(container, page, client, label, optionText, timeoutMs) {
  const item = formItem(container, client, label);
  await item.waitFor({state: 'visible', timeout: timeoutMs});
  if (client === 'vue') {
    await item.locator('.el-select, .el-tree-select').first().click();
    const options = page.locator('.el-select-dropdown:visible .el-select-dropdown__item:not(.is-disabled), .el-popper:visible .el-select-dropdown__item:not(.is-disabled)');
    await options.first().waitFor({state: 'visible', timeout: timeoutMs});
    if (optionText) await options.filter({hasText: optionText}).first().click();
    else await options.first().click();
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.waitForTimeout(150);
    return;
  }
  await item.locator('.ant-select-selector, .ant-select').first().click();
  const options = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option:not(.ant-select-item-option-disabled)');
  await options.first().waitFor({state: 'visible', timeout: timeoutMs});
  if (optionText) await options.filter({hasText: optionText}).first().click();
  else await options.first().click();
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.waitForTimeout(150);
}

async function chooseTreeSelect(container, page, client, label, timeoutMs) {
  const item = formItem(container, client, label);
  await item.waitFor({state: 'visible', timeout: timeoutMs});
  if (client === 'vue') {
    await item.locator('.el-select, .el-tree-select').first().click();
    const nodes = page.locator(
      [
        '.el-tree-select__popper:visible .el-tree-node:not(.is-disabled) .el-tree-node__content',
        '.el-popper:visible .el-tree-node:not(.is-disabled) .el-tree-node__content',
        '.el-tree-select__popper[aria-hidden="false"] .el-tree-node:not(.is-disabled) .el-tree-node__content',
        '.el-popper[aria-hidden="false"] .el-tree-node:not(.is-disabled) .el-tree-node__content',
        '.el-tree-select__popper:visible .el-tree-node:not(.is-disabled) .el-tree-node__label',
        '.el-popper:visible .el-tree-node:not(.is-disabled) .el-tree-node__label'
      ].join(', ')
    );
    await nodes.first().waitFor({state: 'visible', timeout: timeoutMs});
    await nodes.first().click();
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.waitForTimeout(150);
    return;
  }
  await item.locator('.ant-select-selector, .ant-select').first().click();
  const nodes = page.locator('.ant-select-tree-treenode:not(.ant-select-tree-treenode-disabled) .ant-select-tree-node-content-wrapper');
  await nodes.first().waitFor({state: 'visible', timeout: timeoutMs});
  await nodes.first().click();
}

async function chooseTreeSelectIfVisible(container, page, client, label, timeoutMs) {
  const item = formItem(container, client, label);
  if (!(await item.isVisible().catch(() => false))) return false;
  await chooseTreeSelect(container, page, client, label, timeoutMs);
  return true;
}

async function chooseRadio(container, client, label, optionText, timeoutMs) {
  const item = formItem(container, client, label);
  await item.waitFor({state: 'visible', timeout: timeoutMs});
  await item.getByText(optionText, {exact: false}).first().click();
}

async function submitDialog(page, client, timeoutMs, buttonText = '') {
  const container = activeContainer(page, client);
  await container.waitFor({state: 'visible', timeout: timeoutMs});
  if (buttonText) {
    await container.locator('button').filter({hasText: buttonText}).last().click();
  } else if (client === 'vue') {
    const ok = container.locator('.el-dialog__footer button.el-button--primary, button.el-button--primary').last();
    await ok.click();
  } else {
    const ok = container.locator('.ant-modal-footer .ant-btn-primary, button.ant-btn-primary').last();
    await ok.click();
  }
  await container.waitFor({state: 'hidden', timeout: timeoutMs}).catch(async () => {
    const messages = await page
      .locator('.el-message:visible, .el-form-item__error:visible, .ant-message:visible, .ant-form-item-explain-error:visible')
      .allTextContents()
      .catch(() => []);
    const detail = messages.map((item) => item.trim()).filter(Boolean).join(' | ');
    throw new Error(`Dialog did not close after submit${detail ? `: ${detail}` : ''}`);
  });
  await waitForSettled(page, timeoutMs);
}

async function confirmDanger(page, client, timeoutMs) {
  if (client === 'vue') {
    const box = page.locator('.el-message-box:visible, .el-overlay-message-box .el-message-box').last();
    await box.waitFor({state: 'visible', timeout: timeoutMs});
    await box.locator('button.el-button--primary').last().click();
    await box.waitFor({state: 'hidden', timeout: timeoutMs}).catch(() => undefined);
  } else {
    const confirm = page.locator('.ant-modal-confirm').last();
    await confirm.waitFor({state: 'visible', timeout: timeoutMs});
    await confirm.locator('.ant-btn-primary').last().click();
    await confirm.waitFor({state: 'hidden', timeout: timeoutMs}).catch(() => undefined);
  }
  await waitForSettled(page, timeoutMs);
}

async function selectRow(page, client, text, timeoutMs, forceClick = false) {
  const row = await waitForRow(page, client, text, timeoutMs);
  if (client === 'vue') {
    const checkedMarker = row.locator('.el-checkbox__input.is-checked').first();
    if (!forceClick && (await checkedMarker.isVisible().catch(() => false))) return;
    await row.locator('.el-checkbox__input, .el-checkbox__inner, input[type="checkbox"]').first().click({force: true});
    await row.locator('.el-checkbox__input.is-checked').first().waitFor({state: 'visible', timeout: Math.min(timeoutMs, 5000)}).catch(() => undefined);
  } else {
    await row.locator('input[type="checkbox"]').first().check({force: true});
  }
  await page.waitForTimeout(250);
}

async function clickToolbarActionForRow(page, options, rowText, label) {
  const button = textButton(page, label);
  await button.waitFor({state: 'visible', timeout: options.timeoutMs});
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await selectRow(page, options.client, rowText, options.timeoutMs, attempt > 0);
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      if (await button.isEnabled().catch(() => false)) {
        await button.click();
        return;
      }
      await page.waitForTimeout(250);
    }
  }
  throw new Error(`Button did not become enabled: ${label}`);
}

async function clickRowAction(page, client, rowText, actionIndex, timeoutMs) {
  const row = await waitForRow(page, client, rowText, timeoutMs);
  const cell = row.locator('td').last();
  const button = cell.locator('button').nth(actionIndex);
  await button.waitFor({state: 'visible', timeout: timeoutMs});
  await button.click();
}

async function clickFirstRowAction(page, client, actionIndex, timeoutMs) {
  const row = page.locator(rowSelector(client)).filter({has: page.locator('td')}).first();
  await row.waitFor({state: 'visible', timeout: timeoutMs});
  const button = row.locator('td').last().locator('button').nth(actionIndex);
  await button.waitFor({state: 'visible', timeout: timeoutMs});
  await button.click();
}

async function takeScreenshot(page, runDir, name) {
  const screenshotPath = path.join(runDir, 'screenshots', `${name}.png`);
  ensureDir(path.dirname(screenshotPath));
  await page.screenshot({path: screenshotPath, fullPage: true});
  return screenshotPath;
}

function makeTestData(client) {
  const clientSlug = {vue: 'vue', react: 'react', 'react-pro': 'rp'}[client];
  const unique = `${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
  const shortUnique = unique.replace(/_/g, '').slice(-8);
  const base = (module, max = 48) => `e2e_${module}_a_${clientSlug}_${shortUnique}`.slice(0, max);
  const edit = (module, max = 48) => `e2e_${module}_b_${clientSlug}_${shortUnique}`.slice(0, max);
  const code = (module, max = 28) => `e2e_${module}_${clientSlug}_${shortUnique}`.slice(0, max);
  const ossConfigKey = code('oss', 19);
  return {
    role: {baseName: base('role', 28), editedName: edit('role', 28), key: code('role'), keyEdited: `${code('role')}b`.slice(0, 30)},
    user: {baseName: base('user', 20), editedName: edit('user', 20), password: 'E2ePwd1!'},
    menu: {baseName: base('menu', 45), editedName: edit('menu', 45), path: `e2e-menu-${shortUnique}`},
    dept: {baseName: base('dept', 28), editedName: edit('dept', 28)},
    post: {baseName: base('post', 45), editedName: edit('post', 45), code: code('post'), codeEdited: `${code('post')}b`.slice(0, 30)},
    dict: {typeName: base('dict_type', 45), typeNameEdited: edit('dict_type', 45), dictType: code('dict'), label: base('dict_data', 45), labelEdited: edit('dict_data', 45), value: code('data')},
    config: {name: base('config', 45), nameEdited: edit('config', 45), key: code('config'), value: base('config_value', 45)},
    notice: {baseTitle: base('notice', 45), editedTitle: edit('notice', 45)},
    client: {key: code('client'), keyEdited: `${code('client')}b`.slice(0, 30), secret: `E2eSecret_${shortUnique}`},
    invite: {remark: base('invite', 60), reason: edit('invite_reason', 60)},
    ossConfig: {key: ossConfigKey, keyEdited: `${ossConfigKey}b`, bucket: `e2e-bucket-${shortUnique}`},
    job: {name: base('job', 45), nameEdited: edit('job', 45)},
    onlineUser: {name: base('online', 20), password: 'E2ePwd1!'}
  };
}

function moduleDefinitions(data) {
  return {
    role: {key: 'role', label: '角色管理', listPath: '/system/role/list', deletePath: '/system/role', query: (key) => ({roleKey: key}), rowKey: (row) => row.roleKey, id: (row) => row.roleId, dbModule: 'role', dbKeys: [data.role.key, data.role.keyEdited]},
    user: {key: 'user', label: '用户管理', listPath: '/system/user/list', deletePath: '/system/user', query: (key) => ({userName: key}), rowKey: (row) => row.userName, id: (row) => row.userId, dbModule: 'user', dbKeys: [data.user.baseName, data.user.editedName]},
    menu: {key: 'menu', label: '菜单管理', listPath: '/system/menu/list', deletePath: '/system/menu', query: (key) => ({menuName: key}), rowKey: (row) => row.menuName, id: (row) => row.menuId, dbModule: 'menu', dbKeys: [data.menu.baseName, data.menu.editedName]},
    dept: {key: 'dept', label: '部门管理', listPath: '/system/dept/list', deletePath: '/system/dept', query: (key) => ({deptName: key}), rowKey: (row) => row.deptName, id: (row) => row.deptId, dbModule: 'dept', dbKeys: [data.dept.baseName, data.dept.editedName]},
    post: {key: 'post', label: '岗位管理', listPath: '/system/post/list', deletePath: '/system/post', query: (key) => ({postCode: key}), rowKey: (row) => row.postCode, id: (row) => row.postId, dbModule: 'post', dbKeys: [data.post.code, data.post.codeEdited]},
    dictType: {key: 'dictType', label: '字典类型', listPath: '/system/dict/type/list', deletePath: '/system/dict/type', query: (key) => ({dictType: key}), rowKey: (row) => row.dictType, id: (row) => row.dictId, dbModule: 'dictType', dbKeys: [data.dict.dictType]},
    dictData: {key: 'dictData', label: '字典数据', listPath: '/system/dict/data/list', deletePath: '/system/dict/data', query: (key) => ({dictLabel: key, dictType: data.dict.dictType}), rowKey: (row) => row.dictLabel, id: (row) => row.dictCode, dbModule: 'dictData', dbKeys: [data.dict.label, data.dict.labelEdited]},
    config: {key: 'config', label: '参数配置', listPath: '/system/config/list', deletePath: '/system/config', query: (key) => ({configKey: key}), rowKey: (row) => row.configKey, id: (row) => row.configId, dbModule: 'config', dbKeys: [data.config.key]},
    notice: {key: 'notice', label: '通知公告', listPath: '/system/notice/list', deletePath: '/system/notice', query: (key) => ({noticeTitle: key}), rowKey: (row) => row.noticeTitle, id: (row) => row.noticeId, dbModule: 'notice', dbKeys: [data.notice.baseTitle, data.notice.editedTitle]},
    client: {key: 'client', label: '客户端管理', listPath: '/system/client/list', deletePath: '/system/client', query: (key) => ({clientKey: key}), rowKey: (row) => row.clientKey, id: (row) => row.id, dbModule: 'client', dbKeys: [data.client.key, data.client.keyEdited]},
    invite: {key: 'invite', label: '邀请码', listPath: '/system/invite/list', deletePath: '/system/invite', query: (key) => ({inviteCode: key}), rowKey: (row) => row.inviteCode, id: (row) => row.inviteId, dbModule: 'invite', dbKeys: [data.invite.remark]},
    ossConfig: {key: 'ossConfig', label: 'OSS 配置', listPath: '/resource/oss/config/list', deletePath: '/resource/oss/config', query: (key) => ({configKey: key}), rowKey: (row) => row.configKey, id: (row) => row.ossConfigId, dbModule: 'ossConfig', dbKeys: [data.ossConfig.key, data.ossConfig.keyEdited]},
    job: {key: 'job', label: '定时任务', listPath: '/monitor/job/list', deletePath: '/monitor/job', query: (key) => ({jobName: key}), rowKey: (row) => row.jobName, id: (row) => row.jobId, dbModule: 'job', dbKeys: [data.job.name, data.job.nameEdited]},
    onlineUser: {key: 'onlineUser', label: '在线强退测试用户', listPath: '/system/user/list', deletePath: '/system/user', query: (key) => ({userName: key}), rowKey: (row) => row.userName, id: (row) => row.userId, dbModule: 'user', dbKeys: [data.onlineUser.name]}
  };
}

async function currentRows(options, token, definitions, key) {
  const definition = definitions[key];
  return listByDefinition(options, token, definition, definition.dbKeys[0]);
}

async function listAllRows(options, token, pathName, params = {}) {
  const search = new URLSearchParams({pageNum: '1', pageSize: '100', ...params});
  const body = await apiRequest(options, token, 'GET', `${pathName}?${search.toString()}`);
  return responseRows(body);
}

async function getDictTypeId(options, token, definitions, data) {
  const rows = await listByDefinition(options, token, definitions.dictType, data.dict.dictType);
  if (rows.length !== 1) throw new Error(`Expected one dict type for ${data.dict.dictType}, got ${rows.length}`);
  return rows[0].dictId;
}

async function getInviteRowByRemark(options, token, remark) {
  const rows = await listAllRows(options, token, '/system/invite/list');
  const exact = rows.filter((row) => row.remark === remark);
  if (exact.length !== 1) throw new Error(`Expected one invite row with remark ${remark}, got ${exact.length}`);
  return exact[0];
}

async function getConfigPanelItem(options, token, configKey) {
  const body = await apiRequest(options, token, 'GET', '/system/config/panel');
  const groups = Array.isArray(body?.data?.groups) ? body.data.groups : [];
  for (const group of groups) {
    const items = Array.isArray(group.items) ? group.items : [];
    const item = items.find((entry) => entry?.configKey === configKey);
    if (item) return {groupName: group.groupName || group.groupKey || '', item};
  }
  throw new Error(`Expected config panel item for ${configKey}`);
}

async function revealConfigCard(page, options, configKey, groupName = '') {
  await page.getByText('参数设置').first().waitFor({state: 'visible', timeout: options.timeoutMs});
  await page.locator('.config-list-panel').first().waitFor({state: 'visible', timeout: options.timeoutMs});
  await page.locator('.config-setting-row, .config-list-panel .ant-empty').first().waitFor({state: 'visible', timeout: options.timeoutMs});

  if (groupName) {
    const groupButton = page.locator('.config-group-nav button').filter({hasText: groupName}).first();
    if (await groupButton.count()) {
      await groupButton.waitFor({state: 'visible', timeout: options.timeoutMs});
      await groupButton.click();
      await waitForSettled(page, options.timeoutMs);
      await page.locator('.config-setting-row, .config-list-panel .ant-empty').first().waitFor({state: 'visible', timeout: options.timeoutMs});
    }
  }

  const card = page.locator('.config-setting-row').filter({hasText: configKey}).first();
  for (let pageIndex = 0; pageIndex < 60; pageIndex += 1) {
    if (await card.isVisible().catch(() => false)) return card;
    const nextButton = page.locator('.config-list-pagination .ant-pagination-next:not(.ant-pagination-disabled) button').first();
    if ((await nextButton.count()) === 0 || !(await nextButton.isEnabled().catch(() => false))) break;
    await nextButton.click();
    await waitForSettled(page, options.timeoutMs);
  }
  await card.waitFor({state: 'visible', timeout: options.timeoutMs});
  return card;
}

async function verifyApiDb(report, label, options, token, definitions, dbTool, dbConfig, moduleKey, keys) {
  const definition = definitions[moduleKey];
  const api = {};
  for (const key of keys) {
    if (definition.key === 'invite') {
      const rows = await listAllRows(options, token, definition.listPath);
      api[key] = rows.filter((row) => row.remark === key || row.inviteCode === key);
    } else {
      api[key] = await listByDefinition(options, token, definition, key);
    }
  }
  const db = await runDbTool(dbTool, dbConfig, definition.dbModule, definition.dbKeys);
  const snapshot = {label, module: moduleKey, at: new Date().toISOString(), api, db};
  report.verification.push(snapshot);
  return snapshot;
}

async function createRole(page, options, data) {
  await clickButton(page, '新增', options.timeoutMs);
  const modal = activeContainer(page, options.client);
  await fillField(modal, options.client, '角色名称', data.role.baseName, options.timeoutMs);
  await fillField(modal, options.client, '权限字符', data.role.key, options.timeoutMs);
  await fillField(modal, options.client, '角色顺序', 99, options.timeoutMs);
  await chooseRadio(modal, options.client, '状态', '停用', options.timeoutMs).catch(() => undefined);
  await fillField(modal, options.client, '备注', data.role.baseName, options.timeoutMs);
  await submitDialog(page, options.client, options.timeoutMs);
}

async function editRole(page, options, data) {
  await clickRowAction(page, options.client, data.role.baseName, 0, options.timeoutMs);
  const modal = activeContainer(page, options.client);
  await fillField(modal, options.client, '角色名称', data.role.editedName, options.timeoutMs);
  await fillField(modal, options.client, '权限字符', data.role.keyEdited, options.timeoutMs);
  await submitDialog(page, options.client, options.timeoutMs);
}

async function createUser(page, options, data) {
  await clickButton(page, '新增', options.timeoutMs);
  const modal = activeContainer(page, options.client);
  await fillField(modal, options.client, '用户昵称', data.user.baseName, options.timeoutMs);
  await fillField(modal, options.client, '用户名称', data.user.baseName, options.timeoutMs);
  await fillField(modal, options.client, '用户密码', data.user.password, options.timeoutMs);
  await chooseRadio(modal, options.client, '状态', '停用', options.timeoutMs).catch(() => undefined);
  await chooseSelect(modal, page, options.client, '角色', '仅本人', options.timeoutMs).catch(async () => chooseSelect(modal, page, options.client, '角色', undefined, options.timeoutMs));
  await fillField(modal, options.client, '备注', data.user.baseName, options.timeoutMs);
  await submitDialog(page, options.client, options.timeoutMs);
}

async function editUser(page, options, data) {
  await clickRowAction(page, options.client, data.user.baseName, 0, options.timeoutMs);
  const modal = activeContainer(page, options.client);
  await fillField(modal, options.client, '用户昵称', data.user.editedName, options.timeoutMs);
  await submitDialog(page, options.client, options.timeoutMs);
}

async function createMenu(page, options, data) {
  await clickButton(page, '新增', options.timeoutMs);
  const modal = activeContainer(page, options.client);
  await fillField(modal, options.client, '菜单名称', data.menu.baseName, options.timeoutMs);
  await fillField(modal, options.client, '显示排序', 99, options.timeoutMs);
  await fillField(modal, options.client, '路由地址', data.menu.path, options.timeoutMs);
  await chooseRadio(modal, options.client, '显示状态', '隐藏', options.timeoutMs).catch(() => undefined);
  await chooseRadio(modal, options.client, '菜单状态', '停用', options.timeoutMs).catch(() => undefined);
  await submitDialog(page, options.client, options.timeoutMs);
}

async function editMenu(page, options, data) {
  await clickRowAction(page, options.client, data.menu.baseName, 0, options.timeoutMs);
  const modal = activeContainer(page, options.client);
  await fillField(modal, options.client, '菜单名称', data.menu.editedName, options.timeoutMs);
  await submitDialog(page, options.client, options.timeoutMs);
}

async function createDept(page, options, data) {
  await clickFirstRowAction(page, options.client, 1, options.timeoutMs);
  const modal = activeContainer(page, options.client);
  await fillField(modal, options.client, '部门名称', data.dept.baseName, options.timeoutMs);
  await fillField(modal, options.client, '类别编码', `e2e_${data.dept.baseName}`.slice(0, 60), options.timeoutMs);
  await fillField(modal, options.client, '显示排序', 99, options.timeoutMs);
  await chooseRadio(modal, options.client, '部门状态', '停用', options.timeoutMs).catch(() => undefined);
  await submitDialog(page, options.client, options.timeoutMs);
}

async function editDept(page, options, data) {
  await clickRowAction(page, options.client, data.dept.baseName, 0, options.timeoutMs);
  const modal = activeContainer(page, options.client);
  await fillField(modal, options.client, '部门名称', data.dept.editedName, options.timeoutMs);
  await submitDialog(page, options.client, options.timeoutMs);
}

async function createPost(page, options, data) {
  await clickButton(page, '新增', options.timeoutMs);
  const modal = activeContainer(page, options.client);
  await fillField(modal, options.client, '岗位名称', data.post.baseName, options.timeoutMs);
  await chooseTreeSelect(modal, page, options.client, '部门', options.timeoutMs);
  await fillField(modal, options.client, '岗位编码', data.post.code, options.timeoutMs);
  await fillField(modal, options.client, '类别编码', data.post.code, options.timeoutMs);
  await fillField(modal, options.client, '岗位顺序', 99, options.timeoutMs);
  await chooseRadio(modal, options.client, '岗位状态', '停用', options.timeoutMs).catch(() => undefined);
  await fillField(modal, options.client, '备注', data.post.baseName, options.timeoutMs);
  await submitDialog(page, options.client, options.timeoutMs);
}

async function editPost(page, options, data) {
  await clickRowAction(page, options.client, data.post.baseName, 0, options.timeoutMs);
  const modal = activeContainer(page, options.client);
  await fillField(modal, options.client, '岗位名称', data.post.editedName, options.timeoutMs);
  await fillField(modal, options.client, '岗位编码', data.post.codeEdited, options.timeoutMs);
  await submitDialog(page, options.client, options.timeoutMs);
}

async function createDictType(page, options, data) {
  await clickButton(page, '新增', options.timeoutMs);
  const modal = activeContainer(page, options.client);
  await fillField(modal, options.client, '字典名称', data.dict.typeName, options.timeoutMs);
  await fillField(modal, options.client, '字典类型', data.dict.dictType, options.timeoutMs);
  await fillField(modal, options.client, '备注', data.dict.typeName, options.timeoutMs);
  await submitDialog(page, options.client, options.timeoutMs);
}

async function editDictType(page, options, data) {
  await clickRowAction(page, options.client, data.dict.typeName, 0, options.timeoutMs);
  const modal = activeContainer(page, options.client);
  await fillField(modal, options.client, '字典名称', data.dict.typeNameEdited, options.timeoutMs);
  await submitDialog(page, options.client, options.timeoutMs);
}

async function createDictData(page, options, data) {
  await clickButton(page, '新增', options.timeoutMs);
  const modal = activeContainer(page, options.client);
  await fillField(modal, options.client, '数据标签', data.dict.label, options.timeoutMs);
  await fillField(modal, options.client, '数据键值', data.dict.value, options.timeoutMs);
  await fillField(modal, options.client, '显示排序', 99, options.timeoutMs);
  await fillField(modal, options.client, '备注', data.dict.label, options.timeoutMs);
  await submitDialog(page, options.client, options.timeoutMs);
}

async function editDictData(page, options, data) {
  await clickRowAction(page, options.client, data.dict.label, 0, options.timeoutMs);
  const modal = activeContainer(page, options.client);
  await fillField(modal, options.client, '数据标签', data.dict.labelEdited, options.timeoutMs);
  await submitDialog(page, options.client, options.timeoutMs);
}

async function createConfig(page, options, data, groupName = '') {
  await clickButton(page, '管理配置定义', options.timeoutMs);
  const drawer = activeContainer(page, options.client);
  await fillField(drawer, options.client, '参数名称', data.config.name, options.timeoutMs);
  await fillField(drawer, options.client, '参数键名', data.config.key, options.timeoutMs);
  await fillField(drawer, options.client, '当前值', data.config.value, options.timeoutMs);
  await fillField(drawer, options.client, '默认值', data.config.value, options.timeoutMs).catch(() => undefined);
  if (groupName) await chooseSelect(drawer, page, options.client, '分组', groupName, options.timeoutMs);
  await chooseSelect(drawer, page, options.client, '系统内置', '否', options.timeoutMs).catch(() => undefined);
  await fillField(drawer, options.client, '备注', data.config.name, options.timeoutMs);
  await drawer.locator('button').filter({hasText: '保存定义'}).first().click();
  await waitForSettled(page, options.timeoutMs);
  if (options.client === 'vue') await page.keyboard.press('Escape').catch(() => undefined);
  else await page.keyboard.press('Escape').catch(() => undefined);
  await waitForSettled(page, options.timeoutMs);
}

async function editConfig(page, options, data, groupName = '') {
  const card = await revealConfigCard(page, options, data.config.key, groupName);
  await card.locator('button').filter({hasText: '定义'}).first().click();
  const drawer = activeContainer(page, options.client);
  await fillField(drawer, options.client, '参数名称', data.config.nameEdited, options.timeoutMs);
  await drawer.locator('button').filter({hasText: '保存定义'}).first().click();
  await waitForSettled(page, options.timeoutMs);
  await page.keyboard.press('Escape').catch(() => undefined);
  await waitForSettled(page, options.timeoutMs);
}

async function deleteConfig(page, options, data, groupName = '') {
  const card = await revealConfigCard(page, options, data.config.key, groupName);
  await card.locator('button').filter({hasText: '删除'}).first().click();
  await confirmDanger(page, options.client, options.timeoutMs);
}

async function createNotice(page, options, data) {
  await clickButton(page, '新增', options.timeoutMs);
  const modal = activeContainer(page, options.client);
  await fillField(modal, options.client, '公告标题', data.notice.baseTitle, options.timeoutMs);
  await chooseSelect(modal, page, options.client, '公告类型', undefined, options.timeoutMs);
  await chooseRadio(modal, options.client, '状态', '正常', options.timeoutMs).catch(() => undefined);
  await submitDialog(page, options.client, options.timeoutMs);
}

async function editNotice(page, options, data) {
  await clickRowAction(page, options.client, data.notice.baseTitle, 0, options.timeoutMs);
  const modal = activeContainer(page, options.client);
  await fillField(modal, options.client, '公告标题', data.notice.editedTitle, options.timeoutMs);
  await submitDialog(page, options.client, options.timeoutMs);
}

async function createClient(page, options, data) {
  await clickButton(page, '新增', options.timeoutMs);
  const modal = activeContainer(page, options.client);
  await fillField(modal, options.client, '客户端Key', data.client.key, options.timeoutMs);
  await fillField(modal, options.client, '客户端秘钥', data.client.secret, options.timeoutMs);
  await chooseSelect(modal, page, options.client, '授权类型', undefined, options.timeoutMs);
  await chooseSelect(modal, page, options.client, '设备类型', 'PC', options.timeoutMs).catch(async () => chooseSelect(modal, page, options.client, '设备类型', undefined, options.timeoutMs));
  await chooseRadio(modal, options.client, '状态', '停用', options.timeoutMs).catch(() => undefined);
  await submitDialog(page, options.client, options.timeoutMs);
}

async function editClient(page, options, data) {
  await clickRowAction(page, options.client, data.client.key, 0, options.timeoutMs);
  const modal = activeContainer(page, options.client);
  await chooseRadio(modal, options.client, '状态', '停用', options.timeoutMs).catch(() => undefined);
  await submitDialog(page, options.client, options.timeoutMs);
}

async function createInvite(page, options, data) {
  await clickButton(page, '生成邀请码', options.timeoutMs);
  const modal = activeContainer(page, options.client);
  await fillField(modal, options.client, '生成数量', 1, options.timeoutMs);
  await fillField(modal, options.client, '备注', data.invite.remark, options.timeoutMs);
  await submitDialog(page, options.client, options.timeoutMs);
}

async function cancelInvite(page, options, inviteCode, data) {
  await clickToolbarActionForRow(page, options, inviteCode, '作废');
  const modal = activeContainer(page, options.client);
  await fillField(modal, options.client, '作废原因', data.invite.reason, options.timeoutMs);
  await submitDialog(page, options.client, options.timeoutMs);
}

async function createOssConfig(page, options, data) {
  await clickButton(page, '新增', options.timeoutMs);
  const modal = activeContainer(page, options.client);
  await fillField(modal, options.client, '配置Key', data.ossConfig.key, options.timeoutMs);
  await fillField(modal, options.client, '访问站点', 'e2e.invalid', options.timeoutMs);
  await fillField(modal, options.client, 'AccessKey', `ak_${data.ossConfig.key}`, options.timeoutMs);
  await fillField(modal, options.client, 'SecretKey', `sk_${data.ossConfig.key}`, options.timeoutMs);
  await fillField(modal, options.client, '桶名称', data.ossConfig.bucket, options.timeoutMs);
  await fillField(modal, options.client, '前缀', 'e2e/', options.timeoutMs);
  await fillField(modal, options.client, '备注', data.ossConfig.key, options.timeoutMs);
  await submitDialog(page, options.client, options.timeoutMs);
}

async function editOssConfig(page, options, data) {
  await clickRowAction(page, options.client, data.ossConfig.key, 0, options.timeoutMs);
  const modal = activeContainer(page, options.client);
  await fillField(modal, options.client, '配置Key', data.ossConfig.keyEdited, options.timeoutMs);
  await submitDialog(page, options.client, options.timeoutMs);
}

async function createJob(page, options, data) {
  await clickButton(page, '新增', options.timeoutMs);
  const modal = activeContainer(page, options.client);
  await fillField(modal, options.client, '任务名称', data.job.name, options.timeoutMs);
  await chooseSelect(modal, page, options.client, '处理器标识', undefined, options.timeoutMs);
  await fillField(modal, options.client, '处理器参数', '{}', options.timeoutMs);
  await fillField(modal, options.client, 'Cron表达式', '0 0/30 * * * ?', options.timeoutMs);
  await chooseRadio(modal, options.client, '任务状态', '暂停', options.timeoutMs).catch(() => undefined);
  await fillField(modal, options.client, '备注', data.job.name, options.timeoutMs);
  await submitDialog(page, options.client, options.timeoutMs);
}

async function editJob(page, options, data) {
  await clickRowAction(page, options.client, data.job.name, 1, options.timeoutMs);
  const modal = activeContainer(page, options.client);
  await fillField(modal, options.client, '任务名称', data.job.nameEdited, options.timeoutMs);
  await submitDialog(page, options.client, options.timeoutMs);
}

async function createOnlineFixtureUser(options, token, definitions, data) {
  assertE2eKey(data.onlineUser.name);
  await apiRequest(options, token, 'POST', '/system/user', {
    deptId: 103,
    userName: data.onlineUser.name,
    nickName: data.onlineUser.name,
    password: data.onlineUser.password,
    status: '0',
    roleIds: [4],
    postIds: [],
    remark: data.onlineUser.name
  });
  const rows = await listByDefinition(options, token, definitions.onlineUser, data.onlineUser.name);
  if (rows.length !== 1) throw new Error(`Expected one online fixture user for ${data.onlineUser.name}, got ${rows.length}`);
  return rows[0];
}

async function waitForOnlineRow(options, token, userName, expectedToken = '') {
  assertE2eKey(userName);
  const deadline = Date.now() + options.timeoutMs;
  let lastRows = [];
  while (Date.now() < deadline) {
    const rows = await listAllRows(options, token, '/monitor/online/list', {userName});
    lastRows = rows.filter((row) => row.userName === userName);
    const exact = expectedToken ? lastRows.find((row) => row.tokenId === expectedToken) : lastRows[0];
    if (exact) return exact;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Expected online row for ${userName}, got ${lastRows.length}`);
}

async function waitForOnlineRowGone(options, token, userName) {
  assertE2eKey(userName);
  const deadline = Date.now() + options.timeoutMs;
  let lastRows = [];
  while (Date.now() < deadline) {
    const rows = await listAllRows(options, token, '/monitor/online/list', {userName});
    lastRows = rows.filter((row) => row.userName === userName);
    if (lastRows.length === 0) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Online fixture user ${userName} still has ${lastRows.length} active session(s)`);
}

async function loginOnlineFixtureUser(options, runDir, data) {
  const loginDir = path.join(runDir, 'captcha-online');
  ensureDir(loginDir);
  return loginWithRealCaptcha({
    ...options,
    loginCandidates: `${data.onlineUser.name}:${data.onlineUser.password}`,
    logPrefix: 'admin-crud-online'
  }, loginDir);
}

async function deleteSelected(page, options, rowText) {
  await clickToolbarActionForRow(page, options, rowText, '删除');
  await confirmDanger(page, options.client, options.timeoutMs);
}

async function deleteRow(page, options, rowText, actionIndex) {
  await clickRowAction(page, options.client, rowText, actionIndex, options.timeoutMs);
  await confirmDanger(page, options.client, options.timeoutMs);
}

async function runModuleFlow(ctx, key) {
  const {page, options, runDir, token, report, definitions, dbTool, dbConfig, data} = ctx;
  const moduleReport = {key, status: 'running', startedAt: new Date().toISOString(), finishedAt: '', screenshots: {}, notes: [], error: ''};
  report.modules.push(moduleReport);
  const verify = async (label, moduleKey, keys) => verifyApiDb(report, `${key}:${label}`, options, token, definitions, dbTool, dbConfig, moduleKey, keys);
  try {
    if (key === 'role') {
      await page.goto(`${options.frontendOrigin}/system/role`, {waitUntil: 'domcontentloaded', timeout: options.timeoutMs});
      await page.getByPlaceholder('请输入角色名称').first().waitFor({state: 'visible', timeout: options.timeoutMs});
      await createRole(page, options, data);
      await searchByPlaceholder(page, '请输入角色名称', data.role.baseName, options.timeoutMs, true);
      moduleReport.screenshots.afterCreate = await takeScreenshot(page, runDir, `${key}-after-create`);
      await verify('after-create', 'role', [data.role.key]);
      await editRole(page, options, data);
      await searchByPlaceholder(page, '请输入角色名称', data.role.editedName, options.timeoutMs, true);
      await verify('after-edit', 'role', [data.role.key, data.role.keyEdited]);
      await deleteSelected(page, options, data.role.editedName);
      await searchByPlaceholder(page, '请输入角色名称', data.role.editedName, options.timeoutMs, true);
      await waitForNoRow(page, options.client, data.role.editedName, options.timeoutMs);
      await verify('after-delete', 'role', [data.role.key, data.role.keyEdited]);
    } else if (key === 'user') {
      await page.goto(`${options.frontendOrigin}/system/user`, {waitUntil: 'domcontentloaded', timeout: options.timeoutMs});
      await page.getByPlaceholder('请输入用户名称').first().waitFor({state: 'visible', timeout: options.timeoutMs});
      await createUser(page, options, data);
      await searchByPlaceholder(page, '请输入用户名称', data.user.baseName, options.timeoutMs, true);
      moduleReport.screenshots.afterCreate = await takeScreenshot(page, runDir, `${key}-after-create`);
      await verify('after-create', 'user', [data.user.baseName]);
      await editUser(page, options, data);
      await searchByPlaceholder(page, '请输入用户昵称', data.user.editedName, options.timeoutMs, true);
      await verify('after-edit', 'user', [data.user.baseName]);
      await deleteSelected(page, options, data.user.baseName);
      await searchByPlaceholder(page, '请输入用户名称', data.user.baseName, options.timeoutMs, true);
      await waitForNoRow(page, options.client, data.user.baseName, options.timeoutMs);
      await verify('after-delete', 'user', [data.user.baseName]);
    } else if (key === 'menu') {
      await page.goto(`${options.frontendOrigin}/system/menu`, {waitUntil: 'domcontentloaded', timeout: options.timeoutMs});
      await page.getByPlaceholder('请输入菜单名称').first().waitFor({state: 'visible', timeout: options.timeoutMs});
      await createMenu(page, options, data);
      await searchByPlaceholder(page, '请输入菜单名称', data.menu.baseName, options.timeoutMs, true);
      moduleReport.screenshots.afterCreate = await takeScreenshot(page, runDir, `${key}-after-create`);
      await verify('after-create', 'menu', [data.menu.baseName]);
      await editMenu(page, options, data);
      await searchByPlaceholder(page, '请输入菜单名称', data.menu.editedName, options.timeoutMs, true);
      await verify('after-edit', 'menu', [data.menu.baseName, data.menu.editedName]);
      moduleReport.notes.push('菜单页无表格行选择删除入口；使用当前 e2e 菜单行删除入口。');
      await deleteRow(page, options, data.menu.editedName, 2);
      await searchByPlaceholder(page, '请输入菜单名称', data.menu.editedName, options.timeoutMs, true);
      await waitForNoRow(page, options.client, data.menu.editedName, options.timeoutMs);
      await verify('after-delete', 'menu', [data.menu.baseName, data.menu.editedName]);
    } else if (key === 'dept') {
      await page.goto(`${options.frontendOrigin}/system/dept`, {waitUntil: 'domcontentloaded', timeout: options.timeoutMs});
      await page.getByPlaceholder('请输入部门名称').first().waitFor({state: 'visible', timeout: options.timeoutMs});
      await createDept(page, options, data);
      await searchByPlaceholder(page, '请输入部门名称', data.dept.baseName, options.timeoutMs, true);
      moduleReport.screenshots.afterCreate = await takeScreenshot(page, runDir, `${key}-after-create`);
      await verify('after-create', 'dept', [data.dept.baseName]);
      await editDept(page, options, data);
      await searchByPlaceholder(page, '请输入部门名称', data.dept.editedName, options.timeoutMs, true);
      await verify('after-edit', 'dept', [data.dept.baseName, data.dept.editedName]);
      moduleReport.notes.push('部门页无表格行选择删除入口；使用当前 e2e 部门行删除入口。');
      await deleteRow(page, options, data.dept.editedName, 2);
      await searchByPlaceholder(page, '请输入部门名称', data.dept.editedName, options.timeoutMs, true);
      await waitForNoRow(page, options.client, data.dept.editedName, options.timeoutMs);
      await verify('after-delete', 'dept', [data.dept.baseName, data.dept.editedName]);
    } else if (key === 'post') {
      await page.goto(`${options.frontendOrigin}/system/post`, {waitUntil: 'domcontentloaded', timeout: options.timeoutMs});
      await page.getByPlaceholder('请输入岗位编码').first().waitFor({state: 'visible', timeout: options.timeoutMs});
      await createPost(page, options, data);
      await searchByPlaceholder(page, '请输入岗位编码', data.post.code, options.timeoutMs, true);
      moduleReport.screenshots.afterCreate = await takeScreenshot(page, runDir, `${key}-after-create`);
      await verify('after-create', 'post', [data.post.code]);
      await editPost(page, options, data);
      await searchByPlaceholder(page, '请输入岗位编码', data.post.codeEdited, options.timeoutMs, true);
      await verify('after-edit', 'post', [data.post.code, data.post.codeEdited]);
      await deleteSelected(page, options, data.post.editedName);
      await searchByPlaceholder(page, '请输入岗位编码', data.post.codeEdited, options.timeoutMs, true);
      await waitForNoRow(page, options.client, data.post.editedName, options.timeoutMs);
      await verify('after-delete', 'post', [data.post.code, data.post.codeEdited]);
    } else if (key === 'dict') {
      await page.goto(`${options.frontendOrigin}/system/dict`, {waitUntil: 'domcontentloaded', timeout: options.timeoutMs});
      await page.getByPlaceholder('请输入字典名称').first().waitFor({state: 'visible', timeout: options.timeoutMs});
      await createDictType(page, options, data);
      await searchByPlaceholder(page, '请输入字典类型', data.dict.dictType, options.timeoutMs, true);
      moduleReport.screenshots.afterCreate = await takeScreenshot(page, runDir, `${key}-type-after-create`);
      await verify('type-after-create', 'dictType', [data.dict.dictType]);
      await editDictType(page, options, data);
      await searchByPlaceholder(page, '请输入字典类型', data.dict.dictType, options.timeoutMs, true);
      await verify('type-after-edit', 'dictType', [data.dict.dictType]);
      const dictId = await getDictTypeId(options, token, definitions, data);
      await page.goto(`${options.frontendOrigin}/system/dict-data/index/${dictId}`, {waitUntil: 'domcontentloaded', timeout: options.timeoutMs});
      await page.getByPlaceholder('请输入字典标签').first().waitFor({state: 'visible', timeout: options.timeoutMs});
      await waitForVisibleText(page, data.dict.typeNameEdited, options.timeoutMs);
      await createDictData(page, options, data);
      await searchByPlaceholder(page, '请输入字典标签', data.dict.label, options.timeoutMs, true);
      moduleReport.screenshots.afterDataCreate = await takeScreenshot(page, runDir, `${key}-data-after-create`);
      await verify('data-after-create', 'dictData', [data.dict.label]);
      await editDictData(page, options, data);
      await searchByPlaceholder(page, '请输入字典标签', data.dict.labelEdited, options.timeoutMs, true);
      await verify('data-after-edit', 'dictData', [data.dict.label, data.dict.labelEdited]);
      await deleteSelected(page, options, data.dict.labelEdited);
      await searchByPlaceholder(page, '请输入字典标签', data.dict.labelEdited, options.timeoutMs, true);
      await waitForNoRow(page, options.client, data.dict.labelEdited, options.timeoutMs);
      await verify('data-after-delete', 'dictData', [data.dict.label, data.dict.labelEdited]);
      await page.goto(`${options.frontendOrigin}/system/dict`, {waitUntil: 'domcontentloaded', timeout: options.timeoutMs});
      await page.getByPlaceholder('请输入字典类型').first().waitFor({state: 'visible', timeout: options.timeoutMs});
      await searchByPlaceholder(page, '请输入字典类型', data.dict.dictType, options.timeoutMs, true);
      await deleteSelected(page, options, data.dict.typeNameEdited);
      await searchByPlaceholder(page, '请输入字典类型', data.dict.dictType, options.timeoutMs, true);
      await waitForNoRow(page, options.client, data.dict.typeNameEdited, options.timeoutMs);
      await verify('type-after-delete', 'dictType', [data.dict.dictType]);
    } else if (key === 'config') {
      await page.goto(`${options.frontendOrigin}/system/config`, {waitUntil: 'domcontentloaded', timeout: options.timeoutMs});
      await page.getByText('参数设置').first().waitFor({state: 'visible', timeout: options.timeoutMs});
      await createConfig(page, options, data, '资源与文件');
      await page.reload({waitUntil: 'domcontentloaded', timeout: options.timeoutMs});
      const createdConfig = await getConfigPanelItem(options, token, data.config.key);
      moduleReport.notes.push(`配置定义测试数据分组：${createdConfig.groupName}`);
      await revealConfigCard(page, options, data.config.key, createdConfig.groupName);
      await page.getByText(data.config.name).first().waitFor({state: 'visible', timeout: options.timeoutMs});
      moduleReport.screenshots.afterCreate = await takeScreenshot(page, runDir, `${key}-after-create`);
      await verify('after-create', 'config', [data.config.key]);
      await editConfig(page, options, data, createdConfig.groupName);
      await page.reload({waitUntil: 'domcontentloaded', timeout: options.timeoutMs});
      const editedConfig = await getConfigPanelItem(options, token, data.config.key);
      await revealConfigCard(page, options, data.config.key, editedConfig.groupName);
      await page.getByText(data.config.nameEdited).first().waitFor({state: 'visible', timeout: options.timeoutMs});
      await verify('after-edit', 'config', [data.config.key]);
      await deleteConfig(page, options, data, editedConfig.groupName);
      await page.reload({waitUntil: 'domcontentloaded', timeout: options.timeoutMs});
      await page.getByText(data.config.nameEdited).waitFor({state: 'hidden', timeout: options.timeoutMs}).catch(() => undefined);
      await verify('after-delete', 'config', [data.config.key]);
    } else if (key === 'notice') {
      await page.goto(`${options.frontendOrigin}/system/notice`, {waitUntil: 'domcontentloaded', timeout: options.timeoutMs});
      await page.getByPlaceholder('请输入公告标题').first().waitFor({state: 'visible', timeout: options.timeoutMs});
      await createNotice(page, options, data);
      await searchByPlaceholder(page, '请输入公告标题', data.notice.baseTitle, options.timeoutMs, true);
      moduleReport.screenshots.afterCreate = await takeScreenshot(page, runDir, `${key}-after-create`);
      await verify('after-create', 'notice', [data.notice.baseTitle]);
      await editNotice(page, options, data);
      await searchByPlaceholder(page, '请输入公告标题', data.notice.editedTitle, options.timeoutMs, true);
      await verify('after-edit', 'notice', [data.notice.baseTitle, data.notice.editedTitle]);
      await deleteSelected(page, options, data.notice.editedTitle);
      await searchByPlaceholder(page, '请输入公告标题', data.notice.editedTitle, options.timeoutMs, true);
      await waitForNoRow(page, options.client, data.notice.editedTitle, options.timeoutMs);
      await verify('after-delete', 'notice', [data.notice.baseTitle, data.notice.editedTitle]);
    } else if (key === 'client') {
      await page.goto(`${options.frontendOrigin}/system/client`, {waitUntil: 'domcontentloaded', timeout: options.timeoutMs});
      await page.getByPlaceholder('请输入客户端Key').first().waitFor({state: 'visible', timeout: options.timeoutMs});
      await createClient(page, options, data);
      await searchByPlaceholder(page, '请输入客户端Key', data.client.key, options.timeoutMs, true);
      moduleReport.screenshots.afterCreate = await takeScreenshot(page, runDir, `${key}-after-create`);
      await verify('after-create', 'client', [data.client.key]);
      await editClient(page, options, data);
      await searchByPlaceholder(page, '请输入客户端Key', data.client.key, options.timeoutMs, true);
      await verify('after-edit', 'client', [data.client.key]);
      await deleteSelected(page, options, data.client.key);
      await searchByPlaceholder(page, '请输入客户端Key', data.client.key, options.timeoutMs, true);
      await waitForNoRow(page, options.client, data.client.key, options.timeoutMs);
      await verify('after-delete', 'client', [data.client.key]);
    } else if (key === 'invite') {
      await page.goto(`${options.frontendOrigin}/system/invite`, {waitUntil: 'domcontentloaded', timeout: options.timeoutMs});
      await page.getByText('生成邀请码').first().waitFor({state: 'visible', timeout: options.timeoutMs});
      await createInvite(page, options, data);
      const invite = await getInviteRowByRemark(options, token, data.invite.remark);
      await page.getByPlaceholder('请输入邀请码').first().fill(invite.inviteCode);
      await clickButton(page, '搜索', options.timeoutMs);
      await waitForRow(page, options.client, invite.inviteCode, options.timeoutMs);
      moduleReport.screenshots.afterCreate = await takeScreenshot(page, runDir, `${key}-after-create`);
      await verify('after-create', 'invite', [data.invite.remark]);
      await cancelInvite(page, options, invite.inviteCode, data);
      await verify('after-cancel', 'invite', [data.invite.remark]);
      await page.getByPlaceholder('请输入邀请码').first().fill(invite.inviteCode);
      await clickButton(page, '搜索', options.timeoutMs);
      await waitForRow(page, options.client, invite.inviteCode, options.timeoutMs);
      await deleteSelected(page, options, invite.inviteCode);
      await page.getByPlaceholder('请输入邀请码').first().fill(invite.inviteCode);
      await clickButton(page, '搜索', options.timeoutMs);
      await waitForNoRow(page, options.client, invite.inviteCode, options.timeoutMs);
      await verify('after-delete', 'invite', [data.invite.remark]);
    } else if (key === 'ossConfig') {
      await page.goto(`${options.frontendOrigin}/system/oss-config/index`, {waitUntil: 'domcontentloaded', timeout: options.timeoutMs});
      await page.getByPlaceholder(OSS_CONFIG_KEY_PLACEHOLDER).first().waitFor({state: 'visible', timeout: options.timeoutMs});
      await createOssConfig(page, options, data);
      await searchByPlaceholder(page, OSS_CONFIG_KEY_PLACEHOLDER, data.ossConfig.key, options.timeoutMs, true);
      moduleReport.screenshots.afterCreate = await takeScreenshot(page, runDir, `${key}-after-create`);
      await verify('after-create', 'ossConfig', [data.ossConfig.key]);
      await editOssConfig(page, options, data);
      await searchByPlaceholder(page, OSS_CONFIG_KEY_PLACEHOLDER, data.ossConfig.keyEdited, options.timeoutMs, true);
      await verify('after-edit', 'ossConfig', [data.ossConfig.key, data.ossConfig.keyEdited]);
      await deleteSelected(page, options, data.ossConfig.keyEdited);
      await searchByPlaceholder(page, OSS_CONFIG_KEY_PLACEHOLDER, data.ossConfig.keyEdited, options.timeoutMs, true);
      await waitForNoRow(page, options.client, data.ossConfig.keyEdited, options.timeoutMs);
      await verify('after-delete', 'ossConfig', [data.ossConfig.key, data.ossConfig.keyEdited]);
    } else if (key === 'job') {
      await page.goto(`${options.frontendOrigin}/monitor/job`, {waitUntil: 'domcontentloaded', timeout: options.timeoutMs});
      await page.getByPlaceholder('请输入任务名称').first().waitFor({state: 'visible', timeout: options.timeoutMs});
      await createJob(page, options, data);
      await searchByPlaceholder(page, '请输入任务名称', data.job.name, options.timeoutMs, true);
      moduleReport.screenshots.afterCreate = await takeScreenshot(page, runDir, `${key}-after-create`);
      await verify('after-create', 'job', [data.job.name]);
      await editJob(page, options, data);
      await searchByPlaceholder(page, '请输入任务名称', data.job.nameEdited, options.timeoutMs, true);
      await verify('after-edit', 'job', [data.job.name, data.job.nameEdited]);
      await deleteSelected(page, options, data.job.nameEdited);
      await searchByPlaceholder(page, '请输入任务名称', data.job.nameEdited, options.timeoutMs, true);
      await waitForNoRow(page, options.client, data.job.nameEdited, options.timeoutMs);
      await verify('after-delete', 'job', [data.job.name, data.job.nameEdited]);
    } else if (key === 'online') {
      await createOnlineFixtureUser(options, token, definitions, data);
      const fixtureLogin = await loginOnlineFixtureUser(options, runDir, data);
      data.onlineUser.token = fixtureLogin.token;
      moduleReport.notes.push(`在线强退测试用户：${data.onlineUser.name}`);
      await waitForOnlineRow(options, token, data.onlineUser.name, fixtureLogin.token);
      await page.goto(`${options.frontendOrigin}/monitor/online`, {waitUntil: 'domcontentloaded', timeout: options.timeoutMs});
      await page.getByPlaceholder('请输入用户名称').first().waitFor({state: 'visible', timeout: options.timeoutMs});
      await searchByPlaceholder(page, '请输入用户名称', data.onlineUser.name, options.timeoutMs, true);
      moduleReport.screenshots.afterCreate = await takeScreenshot(page, runDir, `${key}-after-login`);
      await clickRowAction(page, options.client, data.onlineUser.name, 0, options.timeoutMs);
      await confirmDanger(page, options.client, options.timeoutMs);
      await waitForOnlineRowGone(options, token, data.onlineUser.name);
      data.onlineUser.token = '';
      await searchByPlaceholder(page, '请输入用户名称', data.onlineUser.name, options.timeoutMs, true);
      await waitForNoRow(page, options.client, data.onlineUser.name, options.timeoutMs);
      report.verification.push({
        label: 'online:after-force-logout',
        module: 'online',
        at: new Date().toISOString(),
        api: {[data.onlineUser.name]: []},
        db: null
      });
      await verify('fixture-user-before-cleanup', 'onlineUser', [data.onlineUser.name]);
    } else {
      throw new Error(`No flow implemented for module ${key}`);
    }
    moduleReport.status = 'passed';
  } catch (error) {
    moduleReport.status = 'failed';
    moduleReport.error = error.message || String(error);
    throw error;
  } finally {
    moduleReport.finishedAt = new Date().toISOString();
  }
}

function buildModuleMatrix(modules) {
  const runSet = new Set(modules);
  return [
    ...SAFE_MODULE_ORDER.map((key) => ({
      key,
      status: runSet.has(key) ? 'auto-crud' : 'not-selected',
      deleteMode: ['menu', 'dept'].includes(key) ? 'row-delete-only' : key === 'config' ? 'card-delete-entry' : key === 'online' ? 'isolated-force-logout' : 'selected-toolbar-delete'
    })),
    ...SAFETY_GATES.map((item) => ({...item, status: 'safety-gate'}))
  ];
}

function writeMarkdownReport(reportPath, report) {
  const lines = [
    '# InfoQ Admin All Modules CRUD E2E Report',
    '',
    `- Run ID: ${report.runId}`,
    `- Client: ${report.client}`,
    `- Status: ${report.status}`,
    `- Backend: ${report.backendUrl}`,
    `- Frontend: ${report.frontendOrigin}`,
    `- User: ${report.username || ''}`,
    `- DB: ${report.dbTarget.host}:${report.dbTarget.port}/${report.dbTarget.database} (${report.dbTarget.profile})`,
    `- Console bad entries: ${report.browser.badConsoleEntries}`,
    `- Evidence: ${report.runDir}`,
    '',
    '## Modules',
    ''
  ];
  for (const moduleReport of report.modules) {
    lines.push(`- ${moduleReport.key}: ${moduleReport.status}${moduleReport.error ? ` — ${moduleReport.error}` : ''}`);
    for (const note of moduleReport.notes || []) lines.push(`  - Note: ${note}`);
  }
  lines.push('', '## Safety gates', '');
  for (const item of report.moduleMatrix.filter((entry) => entry.status === 'safety-gate')) lines.push(`- ${item.key} (${item.route}): ${item.reason}`);
  lines.push('', '## Verification snapshots', '');
  for (const item of report.verification) {
    const apiRows = Object.values(item.api || {}).reduce((sum, rows) => sum + rows.length, 0);
    lines.push(`- ${item.label}: apiRows=${apiRows}, dbRows=${item.db?.rows?.length ?? 'n/a'}`);
  }
  lines.push('', '## Cleanup', '');
  for (const item of report.cleanup.api || []) lines.push(`- ${item.module}: deleted=${item.deleted.length}, errors=${item.errors.length}`);
  lines.push(`- Final DB residue rows: ${report.cleanup.finalDbResidue}`);
  if (report.error) lines.push('', '## Error', '', `- ${report.error}`);
  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
}

async function runBrowser(options, runDir, token, dbTool, dbConfig, data, definitions, report) {
  let chromium;
  try {
    ({chromium} = browserRequire('playwright'));
  } catch (error) {
    throw new Error(`Playwright runtime is required. Install with pnpm --dir .codex/skills/infoq-browser-automate/scripts install. ${error.message || error}`);
  }
  const browser = await chromium.launch({headless: !options.headed});
  const consoleEntries = [];
  const consoleLogPath = path.join(runDir, 'console', 'admin-crud.json');
  ensureDir(path.dirname(consoleLogPath));
  try {
    const context = await browser.newContext({viewport: {width: 1440, height: 900}});
    await context.addInitScript(({key, value}) => window.localStorage.setItem(key, value), {key: 'Admin-Token', value: token});
    const page = await context.newPage();
    page.on('console', (message) => consoleEntries.push({type: message.type(), text: message.text(), location: message.location()}));
    page.on('pageerror', (error) => consoleEntries.push({type: 'pageerror', text: error.message}));
    for (const moduleKey of options.modules) {
      console.log(`[admin-crud] module: ${moduleKey}`);
      await runModuleFlow({page, options, runDir, token, report, definitions, dbTool, dbConfig, data}, moduleKey);
    }
  } catch (error) {
    fs.writeFileSync(consoleLogPath, `${JSON.stringify(consoleEntries, null, 2)}\n`, 'utf8');
    report.browser.consoleLogPath = consoleLogPath;
    report.browser.consoleEntries = consoleEntries.length;
    report.browser.badConsoleEntries = consoleEntries.filter((entry) => entry.type === 'error' || entry.type === 'pageerror').length;
    throw error;
  } finally {
    await browser.close();
    fs.writeFileSync(consoleLogPath, `${JSON.stringify(consoleEntries, null, 2)}\n`, 'utf8');
    report.browser.consoleLogPath = consoleLogPath;
    report.browser.consoleEntries = consoleEntries.length;
    report.browser.badConsoleEntries = consoleEntries.filter((entry) => entry.type === 'error' || entry.type === 'pageerror').length;
  }
}

async function cleanupAll(options, token, definitions, data) {
  const cleanupOrder = ['onlineUser', 'job', 'ossConfig', 'invite', 'client', 'notice', 'config', 'dictData', 'dictType', 'post', 'dept', 'menu', 'user', 'role'];
  const results = [];
  if (data.onlineUser?.token) {
    const result = {module: 'onlineSession', deleted: [], errors: [], skipped: []};
    try {
      await apiRequest(options, token, 'DELETE', `/monitor/online/${encodeURIComponent(data.onlineUser.token)}`);
      result.deleted.push({key: data.onlineUser.name, token: 'current-run-token'});
    } catch (error) {
      result.errors.push({key: data.onlineUser.name, error: error.message || String(error)});
    }
    results.push(result);
  }
  for (const key of cleanupOrder) {
    const definition = definitions[key];
    if (!definition) continue;
    const keys = definition.key === 'invite' ? [data.invite.remark] : definition.dbKeys;
    if (definition.key === 'invite') {
      const result = {module: 'invite', deleted: [], errors: [], skipped: []};
      try {
        const rows = await listAllRows(options, token, definition.listPath);
        for (const row of rows.filter((item) => item.remark === data.invite.remark)) {
          await deleteByDefinition(options, token, definition, row);
          result.deleted.push({key: row.inviteCode, id: row.inviteId});
        }
      } catch (error) {
        result.errors.push({key: data.invite.remark, error: error.message || String(error)});
      }
      results.push(result);
    } else {
      results.push(await cleanupDefinition(options, token, definition, keys));
    }
  }
  return results;
}

async function finalDbResidue(definitions, dbTool, dbConfig) {
  const result = [];
  for (const definition of Object.values(definitions)) {
    const db = await runDbTool(dbTool, dbConfig, definition.dbModule, definition.dbKeys).catch((error) => ({error: error.message || String(error), rows: []}));
    if (db.error || db.rows?.length) result.push({module: definition.key, db});
  }
  return result;
}

async function main() {
  const options = parseArgs(normalizeForwardedArgs(process.argv.slice(2)));
  const clientConfig = CLIENTS[options.client];
  const runId = options.runId || `admin-crud-${options.client}-${timestampSlug()}`;
  const runDir = resolveDocTmpPath(repoRoot, 'infoq-admin-e2e', runId);
  ensureDir(runDir);
  options.backendUrl = options.backendUrl.replace(/\/+$/, '');
  if (options.backendUrl === DEFAULTS.backendUrl && options.backendPort !== DEFAULTS.backendPort) options.backendUrl = `http://127.0.0.1:${options.backendPort}`;
  if (!options.frontendPort) options.frontendPort = String(clientConfig.defaultFrontendPort);
  if (!options.frontendOrigin) options.frontendOrigin = buildFrontendOrigin(options);

  const dbConfig = readApplicationDbConfig(options.profile);
  const dbTool = await prepareDbTool(runDir);
  const data = makeTestData(options.client);
  const definitions = moduleDefinitions(data);
  const moduleMatrix = buildModuleMatrix(options.modules);
  writeJson(path.join(runDir, 'module-matrix.json'), moduleMatrix);
  writeJson(path.join(runDir, 'test-data.json'), data);
  writeJson(path.join(runDir, 'db-target.json'), {profile: dbConfig.profile, configPath: path.relative(repoRoot, dbConfig.configPath), jdbcUrl: dbConfig.sanitizedJdbcUrl, host: dbConfig.host, port: dbConfig.port, database: dbConfig.database, username: dbConfig.username});

  const report = {
    runId,
    runDir,
    client: options.client,
    modulesRequested: options.modules,
    moduleMatrix,
    backendUrl: options.backendUrl,
    frontendOrigin: options.frontendOrigin,
    username: '',
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: '',
    dbTarget: {profile: dbConfig.profile, configPath: path.relative(repoRoot, dbConfig.configPath), jdbcUrl: dbConfig.sanitizedJdbcUrl, host: dbConfig.host, port: dbConfig.port, database: dbConfig.database, username: dbConfig.username},
    browser: {consoleLogPath: '', consoleEntries: 0, badConsoleEntries: 0},
    loginAttempts: [],
    modules: [],
    verification: [],
    cleanup: {api: [], finalDb: [], finalDbResidue: null},
    error: ''
  };

  const stackConfig = buildStackConfig(options, runDir);
  const stopStaleStackBeforeRun = async () => {
    const state = readJsonFile(stackConfig.stateFile, null);
    const shouldStop = ['starting', 'interrupted'].includes(state?.status) || (state?.status === 'running' && state.keepAlive !== true);
    if (shouldStop) await stopAdminDevStackState(stackConfig, {status: 'stopped', reason: 'stale-before-admin-crud'});
  };
  let token = '';
  let finalStatus = 'stopped';
  let stopReason = 'admin-crud-complete';
  const stopStackIfNeeded = async (status, reason) => {
    if (options.startStack && (options.stopStackAfter || status !== 'stopped')) await stopAdminDevStackState(stackConfig, {status, reason});
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
    console.log(`[admin-crud] DB target: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database} via ${path.relative(repoRoot, dbConfig.configPath)}`);
    console.log(`[admin-crud] modules: ${options.modules.join(', ')}`);
    console.log(`[admin-crud] evidence: ${runDir}`);
    if (options.startStack) {
      await stopStaleStackBeforeRun();
      await runAdminDevStack(stackConfig, buildStackArgs(options, clientConfig));
    }
    const login = await loginWithRealCaptcha({...options, logPrefix: 'admin-crud'}, runDir);
    token = login.token;
    report.username = login.username;
    report.loginAttempts = login.attempts;
    report.cleanup.api = await cleanupAll(options, token, definitions, data);
    const cleanupErrors = report.cleanup.api.flatMap((item) => item.errors || []);
    if (cleanupErrors.length > 0) throw new Error(`Pre-run API cleanup failed: ${JSON.stringify(cleanupErrors)}`);
    await runBrowser(options, runDir, token, dbTool, dbConfig, data, definitions, report);
    const finalCleanup = await cleanupAll(options, token, definitions, data);
    report.cleanup.api = finalCleanup;
    const finalCleanupErrors = finalCleanup.flatMap((item) => item.errors || []);
    if (finalCleanupErrors.length > 0) throw new Error(`Final API cleanup failed: ${JSON.stringify(finalCleanupErrors)}`);
    report.cleanup.finalDb = await finalDbResidue(definitions, dbTool, dbConfig);
    report.cleanup.finalDbResidue = report.cleanup.finalDb.reduce((sum, item) => sum + (item.db?.rows?.length || 0), 0);
    if (report.cleanup.finalDbResidue > 0) throw new Error(`Final DB residue rows found: ${JSON.stringify(report.cleanup.finalDb)}`);
    if (!options.allowConsoleErrors && report.browser.badConsoleEntries > 0) throw new Error(`Console check failed with ${report.browser.badConsoleEntries} bad entries. See ${report.browser.consoleLogPath}`);
    report.status = 'passed';
    if (options.startStack && !options.stopStackAfter) markRunState(stackConfig.stateFile, {status: 'running', validationStatus: 'passed', keepAlive: true, keepReason: '--keep-stack-after', context: stackConfig.stateContext});
    console.log('[admin-crud] completed successfully');
  } catch (error) {
    finalStatus = 'failed';
    stopReason = error.message || String(error);
    report.status = 'failed';
    report.error = stopReason;
    if (token) {
      report.cleanup.api = await cleanupAll(options, token, definitions, data).catch((cleanupError) => [{module: 'all', deleted: [], skipped: [], errors: [{error: cleanupError.message || String(cleanupError)}]}]);
    }
    report.cleanup.finalDb = await finalDbResidue(definitions, dbTool, dbConfig).catch((dbError) => [{module: 'all', db: {error: dbError.message || String(dbError), rows: []}}]);
    report.cleanup.finalDbResidue = report.cleanup.finalDb.reduce((sum, item) => sum + (item.db?.rows?.length || 0), 0);
    throw error;
  } finally {
    report.finishedAt = new Date().toISOString();
    writeJson(path.join(runDir, 'report.json'), report);
    writeMarkdownReport(path.join(runDir, 'report.md'), report);
    console.log(`[admin-crud] report: ${path.join(runDir, 'report.md')}`);
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
