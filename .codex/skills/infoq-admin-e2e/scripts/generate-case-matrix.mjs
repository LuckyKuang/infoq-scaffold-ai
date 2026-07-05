#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ensureDir, normalizeForwardedArgs, resolveRepoRoot} from '../../../lib/skill_runtime.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = resolveRepoRoot(scriptDir);
const args = normalizeForwardedArgs(process.argv.slice(2));

const DEFAULT_OUTPUT_DIR = path.join(repoRoot, 'doc', 'test', 'frontend-web-automation');
const VALID_PRIORITIES = new Set(['P0', 'P1', 'P2']);
const SAFETY_GATES = [
  '不自动删除非 e2e_ 数据。',
  '不清空日志。',
  '不强退非当前 run 创建的 e2e_ 在线会话。',
  '不触发定时任务“立即执行”。',
  '不触碰真实 OSS 对象上传/删除。',
  '对 OSS 对象、日志、在线用户这类场景，缺少隔离 fixture 时记录 blocker，不伪造通过。'
];

function printHelp() {
  console.log(`Usage:
  node .codex/skills/infoq-admin-e2e/scripts/generate-case-matrix.mjs [options]

Options:
  --output-dir <dir>     Output directory. Default: doc/test/frontend-web-automation
  --json <path>          JSON output path. Default: <output-dir>/case-matrix.json
  --markdown <path>      Markdown output path. Default: <output-dir>/case-matrix.md
  --gaps <path>          Gaps report path. Default: <output-dir>/gaps.md
  --quiet                Only print summary.
  -h, --help             Show help.`);
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
    outputDir: DEFAULT_OUTPUT_DIR,
    jsonPath: '',
    markdownPath: '',
    gapsPath: '',
    quiet: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--output-dir':
        options.outputDir = path.resolve(repoRoot, readValue(argv, index, arg));
        index += 1;
        break;
      case '--json':
        options.jsonPath = path.resolve(repoRoot, readValue(argv, index, arg));
        index += 1;
        break;
      case '--markdown':
        options.markdownPath = path.resolve(repoRoot, readValue(argv, index, arg));
        index += 1;
        break;
      case '--gaps':
        options.gapsPath = path.resolve(repoRoot, readValue(argv, index, arg));
        index += 1;
        break;
      case '--quiet':
        options.quiet = true;
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

  options.jsonPath ||= path.join(options.outputDir, 'case-matrix.json');
  options.markdownPath ||= path.join(options.outputDir, 'case-matrix.md');
  options.gapsPath ||= path.join(options.outputDir, 'gaps.md');
  return options;
}

function listFiles(dirPath, predicate = () => true) {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  const result = [];
  for (const entry of fs.readdirSync(dirPath, {withFileTypes: true})) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      result.push(...listFiles(fullPath, predicate));
      continue;
    }
    if (entry.isFile() && predicate(fullPath)) {
      result.push(fullPath);
    }
  }
  return result.sort((left, right) => rel(left).localeCompare(rel(right)));
}

function rel(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/');
}

function stripSqlCommentLines(sql) {
  return sql
    .split(/\r?\n/u)
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');
}

function splitSqlStatements(sql) {
  const statements = [];
  let buffer = '';
  let inQuote = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];
    buffer += char;

    if (char === "'" && next === "'") {
      buffer += next;
      index += 1;
      continue;
    }

    if (char === "'") {
      inQuote = !inQuote;
      continue;
    }

    if (char === ';' && !inQuote) {
      const statement = buffer.trim();
      if (statement) {
        statements.push(statement);
      }
      buffer = '';
    }
  }

  const trailing = buffer.trim();
  if (trailing) {
    statements.push(trailing);
  }
  return statements;
}

function splitSqlCsv(text) {
  const values = [];
  let buffer = '';
  let inQuote = false;
  let depth = 0;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "'" && next === "'") {
      buffer += char + next;
      index += 1;
      continue;
    }

    if (char === "'") {
      inQuote = !inQuote;
      buffer += char;
      continue;
    }

    if (!inQuote) {
      if (char === '(') {
        depth += 1;
      } else if (char === ')' && depth > 0) {
        depth -= 1;
      } else if (char === ',' && depth === 0) {
        values.push(buffer.trim());
        buffer = '';
        continue;
      }
    }

    buffer += char;
  }

  if (buffer.trim()) {
    values.push(buffer.trim());
  }
  return values;
}

function unquoteSqlValue(value) {
  const trimmed = value.trim();
  if (/^null$/iu.test(trimmed)) {
    return '';
  }
  if (/^now\(\)$/iu.test(trimmed)) {
    return '';
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/gu, "'").replace(/\\'/gu, "'");
  }
  return trimmed;
}

function extractParenthesizedTuples(text) {
  const tuples = [];
  let buffer = '';
  let inQuote = false;
  let depth = 0;
  let started = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "'" && next === "'") {
      if (started) {
        buffer += char + next;
      }
      index += 1;
      continue;
    }

    if (char === "'") {
      inQuote = !inQuote;
      if (started) {
        buffer += char;
      }
      continue;
    }

    if (!inQuote && char === '(') {
      if (depth === 0) {
        started = true;
        buffer = '';
      } else {
        buffer += char;
      }
      depth += 1;
      continue;
    }

    if (!inQuote && char === ')') {
      depth -= 1;
      if (depth === 0 && started) {
        tuples.push(buffer.trim());
        started = false;
        buffer = '';
      } else if (started) {
        buffer += char;
      }
      continue;
    }

    if (started) {
      buffer += char;
    }
  }

  return tuples;
}

function parseInsertStatement(statement, sourceFile) {
  if (!/insert\s+into\s+`?sys_menu`?/iu.test(statement)) {
    return [];
  }

  const insertMatch = statement.match(/insert\s+into\s+`?sys_menu`?\s*\(([\s\S]*?)\)\s*(values|select)\s*/iu);
  if (!insertMatch) {
    return [];
  }

  const columns = splitSqlCsv(insertMatch[1]).map((column) => column.replace(/[`"' ]/gu, '').trim());
  const mode = insertMatch[2].toLowerCase();
  const tail = statement.slice(insertMatch.index + insertMatch[0].length).replace(/;$/u, '').trim();

  const rows = [];
  if (mode === 'values') {
    for (const tuple of extractParenthesizedTuples(tail)) {
      rows.push(splitSqlCsv(tuple));
    }
  } else {
    const selectList = tail.split(/\bwhere\b|\bfrom\b/iu)[0].trim();
    rows.push(splitSqlCsv(selectList));
  }

  return rows
    .filter((row) => row.length >= columns.length)
    .map((row) => {
      const record = {};
      columns.forEach((column, index) => {
        record[column] = unquoteSqlValue(row[index] ?? '');
      });
      record.__sourceFile = sourceFile;
      return record;
    })
    .filter((record) => record.menu_id && record.menu_name);
}

function readMenuRows(sqlFiles) {
  const byId = new Map();
  for (const filePath of sqlFiles) {
    const sql = stripSqlCommentLines(fs.readFileSync(filePath, 'utf8'));
    for (const statement of splitSqlStatements(sql)) {
      for (const row of parseInsertStatement(statement, rel(filePath))) {
        byId.set(String(row.menu_id), row);
      }
    }
  }
  return [...byId.values()].sort((left, right) => Number(left.menu_id) - Number(right.menu_id));
}

function normalizePathSegment(value) {
  return String(value || '')
    .trim()
    .replace(/^\/+/u, '')
    .replace(/\/+$/u, '');
}

function buildRoutePath(menu, byId) {
  const segments = [];
  const visited = new Set();
  let current = menu;

  while (current && current.parent_id && current.parent_id !== '0' && !visited.has(String(current.menu_id))) {
    visited.add(String(current.menu_id));
    const segment = normalizePathSegment(current.path);
    if (segment && segment !== '#') {
      segments.unshift(segment);
    }
    current = byId.get(String(current.parent_id));
  }

  if (current && current.parent_id === '0') {
    const segment = normalizePathSegment(current.path);
    if (segment && segment !== '#') {
      segments.unshift(segment);
    }
  } else if (segments.length === 0) {
    const segment = normalizePathSegment(menu.path);
    if (segment && segment !== '#') {
      segments.push(segment);
    }
  }

  return `/${segments.join('/')}`.replace(/\/+/gu, '/');
}

function normalizeComponent(component) {
  return String(component || '').trim().replace(/^\/+/u, '').replace(/\.(vue|tsx|ts|jsx)$/iu, '');
}

function componentToModuleKey(component, fallbackPath = '') {
  const normalized = normalizeComponent(component || fallbackPath)
    .replace(/\/index$/u, '')
    .replace(/\/+/gu, '.');
  return normalized || 'unknown';
}

function slug(value) {
  return String(value || 'unknown')
    .replace(/([a-z])([A-Z])/gu, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
    .toUpperCase();
}

function componentCandidates(component) {
  return Array.isArray(component) ? component : [component];
}

function fileExists(rootDir, component, extension) {
  const normalized = normalizeComponent(component);
  if (!normalized) {
    return false;
  }
  const candidates = [
    path.join(rootDir, `${normalized}${extension}`),
    path.join(rootDir, normalized, `index${extension}`)
  ];
  return candidates.some((candidate) => fs.existsSync(candidate));
}

function fileExistsAny(rootDir, components, extension) {
  return componentCandidates(components).some((component) => fileExists(rootDir, component, extension));
}

function routeHasTests(component, moduleKey, testFiles) {
  const needles = new Set();
  for (const item of componentCandidates(component).filter(Boolean)) {
    needles.add(normalizeComponent(item).toLowerCase());
    needles.add(normalizeComponent(item).replace(/\/index$/u, '').toLowerCase());
  }
  if (moduleKey) {
    needles.add(moduleKey.toLowerCase().replace(/\./gu, '/'));
    needles.add(moduleKey.toLowerCase().replace(/\./gu, '-'));
  }

  return testFiles
    .map(rel)
    .filter((file) => {
      const normalizedFile = file.toLowerCase();
      return [...needles].some((needle) => needle && normalizedFile.includes(needle));
    });
}

function operationFromPermission(permission, name) {
  const text = `${permission || ''}:${name || ''}`.toLowerCase();
  if (/batch|forcelogout|unlock|clean|clear|run|execute|remove|delete/u.test(text)) {
    return 'danger';
  }
  if (/add|create|edit|update|import|upload|resetpwd|status/u.test(text)) {
    return 'write';
  }
  if (/export|download/u.test(text)) {
    return 'download';
  }
  if (/query|list|view|detail/u.test(text)) {
    return 'read';
  }
  return 'permission';
}

function classifyPriority(source, menu, operation) {
  if (source === 'fixed-route') {
    return ['/login', '/index', '/401', '/404', '/redirect/:path*'].includes(menu.routePath) ? 'P0' : 'P1';
  }
  if (menu.menu_type === 'C' && menu.visible === '0') {
    return 'P0';
  }
  if (operation === 'danger') {
    return 'P2';
  }
  return 'P1';
}

function classifyAutomationType(menu, operation) {
  if (menu.menu_type === 'fixed') {
    return 'smoke';
  }
  if (menu.menu_type === 'M') {
    return 'route';
  }
  if (menu.menu_type === 'C') {
    return menu.visible === '0' ? 'smoke' : 'route';
  }
  if (['write', 'download', 'danger'].includes(operation)) {
    return 'CRUD';
  }
  return 'permission';
}

function dependenciesFor(moduleKey, routePath, source) {
  const dependencies = new Set(['backend']);
  const text = `${moduleKey} ${routePath}`.toLowerCase();
  if (source === 'fixed-route' && /login|register|forgot/u.test(text)) {
    dependencies.add('captcha');
  }
  if (/cache|online|logininfo|operlog/u.test(text)) {
    dependencies.add('Redis');
  }
  if (/oss|file/u.test(text)) {
    dependencies.add('OSS');
    dependencies.add('file');
  }
  if (/job/u.test(text)) {
    dependencies.add('scheduled-job');
  }
  return [...dependencies];
}

function buildCase({source, menu, parent, routePath, component, clients, reactExists, reactProExists, vueExists, testFiles}) {
  const inheritedComponent = component || parent?.component || '';
  const moduleKey = menu.moduleKey || componentToModuleKey(inheritedComponent || routePath);
  const operation = operationFromPermission(menu.perms, menu.menu_name);
  const priority = classifyPriority(source, {...menu, routePath}, operation);
  const automationType = classifyAutomationType(menu, operation);
  const sideEffect = ['write', 'danger'].includes(operation);
  const id = source === 'fixed-route'
    ? `FE-${slug(moduleKey)}`
    : `FE-${slug(moduleKey)}-${menu.menu_id}`;

  const gaps = [];
  if (menu.menu_type === 'C' && component) {
    if (!reactExists) {
      gaps.push('React 页面组件缺失');
    }
    if (!reactProExists) {
      gaps.push('React Pro 页面组件缺失');
    }
    if (!vueExists) {
      gaps.push('Vue 页面组件缺失');
    }
  }
  if (clients.length === 0) {
    gaps.push('未匹配到可执行客户端');
  }
  if (priority === 'P0' && testFiles.length === 0) {
    gaps.push('未发现直接关联的页面或路由单测');
  }

  return {
    id,
    source,
    menuId: String(menu.menu_id || ''),
    parentMenuId: String(menu.parent_id || ''),
    moduleKey,
    menuName: menu.menu_name,
    menuType: menu.menu_type || 'fixed',
    routePath,
    component: inheritedComponent,
    clients,
    permissions: menu.perms ? [menu.perms] : [],
    priority,
    automationType,
    sideEffect,
    dependencies: dependenciesFor(moduleKey, routePath, source),
    preconditions: buildPreconditions(priority, source, automationType),
    steps: buildSteps(source, automationType, routePath, menu.menu_name),
    assertions: buildAssertions(source, automationType, menu.menu_name),
    testData: sideEffect ? '使用 e2e_ 前缀测试数据，并避免污染系统基础数据。' : '只读或固定入口数据。',
    cleanup: sideEffect ? '必须在用例内清理测试数据；失败时记录人工回滚提示。' : '无需业务数据清理。',
    existingTests: testFiles,
    gaps,
    sourceFile: menu.__sourceFile || ''
  };
}

function buildPreconditions(priority, source, automationType) {
  if (source === 'fixed-route') {
    return ['前端应用已启动', '公开路由无需登录；受保护固定路由需要有效登录态'];
  }
  const items = ['后端服务可用', '管理端前端已启动', '可通过真实验证码登录'];
  if (priority !== 'P0' || automationType !== 'smoke') {
    items.push('具备对应权限和受控测试数据');
  }
  return items;
}

function buildSteps(source, automationType, routePath, menuName) {
  if (source === 'fixed-route') {
    return [`打开 ${routePath}`, `等待 ${menuName} 首屏渲染`];
  }
  if (automationType === 'smoke' || automationType === 'route') {
    return ['完成真实验证码登录', '加载用户信息和动态菜单', `打开 ${routePath}`, `等待 ${menuName} 页面首屏渲染`];
  }
  if (automationType === 'CRUD') {
    return [`进入 ${menuName} 所属页面`, '执行对应按钮或表单操作', '校验接口结果和页面反馈', '执行 cleanup'];
  }
  return [`进入 ${menuName} 所属页面`, '校验权限按钮显示或隐藏', '校验无越权入口'];
}

function buildAssertions(source, automationType, menuName) {
  const common = ['无阻断性 console error', '无 pageerror'];
  if (source === 'fixed-route') {
    return [`${menuName} 路由可访问`, ...common];
  }
  if (automationType === 'smoke' || automationType === 'route') {
    return [`${menuName} 首屏可渲染`, '不误跳 401 或 404', ...common];
  }
  if (automationType === 'CRUD') {
    return ['操作结果可见', '数据状态符合预期', '失败时错误提示明确', ...common];
  }
  return ['权限入口符合当前账号权限', ...common];
}

function collectPageComponents(files, rootDir, extension) {
  return new Set(files.map((filePath) => rel(path.relative(repoRoot, filePath).startsWith(rootDir) ? filePath : filePath)));
}

function componentSet(files, baseDir, extension) {
  const result = new Set();
  for (const filePath of files) {
    const relative = path.relative(baseDir, filePath).replace(/\\/g, '/');
    result.add(relative.replace(new RegExp(`${extension.replace('.', '\\.')}$`, 'u'), ''));
  }
  return result;
}

const FIXED_ROUTES = [
  {
    moduleKey: 'auth.login',
    menuName: '登录',
    routePath: '/login',
    component: 'login',
    clientComponents: {
      'react-pro': ['login', 'user/login/index']
    }
  },
  {moduleKey: 'auth.register', menuName: '注册', routePath: '/register', component: 'register'},
  {moduleKey: 'auth.forgot-password', menuName: '忘记密码', routePath: '/forgot-password', component: 'forgot-password'},
  {moduleKey: 'auth.oauth-callback', menuName: 'OAuth 回调', routePath: '/oauth/callback', component: 'oauth-callback'},
  {moduleKey: 'home.index', menuName: '首页', routePath: '/index', component: 'index'},
  {moduleKey: 'system.user.profile', menuName: '个人中心', routePath: '/user/profile', component: 'system/user/profile/index'},
  {moduleKey: 'error.401', menuName: '401', routePath: '/401', component: 'error/401'},
  {moduleKey: 'error.404', menuName: '404', routePath: '/404', component: 'error/404'},
  {moduleKey: 'route.redirect', menuName: '路由跳转', routePath: '/redirect/:path*', component: 'redirect/index'}
];

function componentForClient(route, client) {
  return route.clientComponents?.[client] || route.component;
}

function buildFixedRouteCases(reactPagesDir, reactProPagesDir, vueViewsDir, reactTests, reactProTests, vueTests) {
  return FIXED_ROUTES.map((route, index) => {
    const reactComponent = componentForClient(route, 'react');
    const reactProComponent = componentForClient(route, 'react-pro');
    const vueComponent = componentForClient(route, 'vue');
    const reactExists = fileExistsAny(reactPagesDir, reactComponent, '.tsx');
    const reactProExists = fileExistsAny(reactProPagesDir, reactProComponent, '.tsx');
    const vueExists = fileExistsAny(vueViewsDir, vueComponent, '.vue');
    const clients = [
      reactExists ? 'react' : '',
      reactProExists ? 'react-pro' : '',
      vueExists ? 'vue' : ''
    ].filter(Boolean);
    const testFiles = [
      ...routeHasTests(reactComponent, route.moduleKey, reactTests),
      ...routeHasTests(reactProComponent, route.moduleKey, reactProTests),
      ...routeHasTests(vueComponent, route.moduleKey, vueTests)
    ];
    return buildCase({
      source: 'fixed-route',
      menu: {
        menu_id: `fixed-${index + 1}`,
        parent_id: '',
        menu_name: route.menuName,
        menu_type: 'fixed',
        moduleKey: route.moduleKey,
        routePath: route.routePath,
        component: route.component,
        visible: '0',
        perms: ''
      },
      parent: null,
      routePath: route.routePath,
      component: route.component,
      clients,
      reactExists,
      reactProExists,
      vueExists,
      testFiles
    });
  });
}

function buildMenuCases({menus, reactPagesDir, reactProPagesDir, vueViewsDir, reactTests, reactProTests, vueTests}) {
  const byId = new Map(menus.map((menu) => [String(menu.menu_id), menu]));
  const cases = [];

  for (const menu of menus) {
    const menuType = menu.menu_type || '';
    if (!['M', 'C', 'F'].includes(menuType)) {
      continue;
    }

    const parent = byId.get(String(menu.parent_id));
    const routeSource = menuType === 'F' && parent ? parent : menu;
    const routePath = buildRoutePath(routeSource, byId);
    const component = normalizeComponent(menuType === 'F' ? parent?.component : menu.component);
    const reactExists = component ? fileExists(reactPagesDir, component, '.tsx') : menuType === 'M';
    const reactProExists = component ? fileExists(reactProPagesDir, component, '.tsx') : menuType === 'M';
    const vueExists = component ? fileExists(vueViewsDir, component, '.vue') : menuType === 'M';
    const clients = [
      reactExists ? 'react' : '',
      reactProExists ? 'react-pro' : '',
      vueExists ? 'vue' : ''
    ].filter(Boolean);
    const moduleKey = componentToModuleKey(component || routePath);
    const testFiles = [
      ...routeHasTests(component, moduleKey, reactTests),
      ...routeHasTests(component, moduleKey, reactProTests),
      ...routeHasTests(component, moduleKey, vueTests)
    ];

    cases.push(buildCase({
      source: menuType === 'F' ? 'permission' : 'menu',
      menu,
      parent,
      routePath,
      component,
      clients,
      reactExists,
      reactProExists,
      vueExists,
      testFiles
    }));
  }

  return cases;
}

function uniqueById(cases) {
  const seen = new Map();
  for (const item of cases) {
    if (!seen.has(item.id)) {
      seen.set(item.id, item);
      continue;
    }
    const duplicate = seen.get(item.id);
    duplicate.gaps.push(`重复用例 ID 来源：${item.menuId || item.source}`);
  }
  return [...seen.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function collectGlobalGaps(cases, menus, reactComponents, reactProComponents, vueComponents) {
  const gaps = [];
  for (const item of cases) {
    for (const gap of item.gaps) {
      gaps.push({
        type: 'case-gap',
        id: item.id,
        moduleKey: item.moduleKey,
        message: gap
      });
    }
  }

  const menuComponents = new Set(
    menus
      .map((menu) => normalizeComponent(menu.component))
      .filter((component) => component && !['Layout', 'ParentView', 'InnerLink'].includes(component))
  );
  for (const route of FIXED_ROUTES) {
    menuComponents.add(route.component);
    for (const components of Object.values(route.clientComponents || {})) {
      for (const component of componentCandidates(components)) {
        menuComponents.add(normalizeComponent(component));
      }
    }
  }

  const isKnownNonMenuComponent = (component) =>
    component === 'BackendRouteView' ||
    component === 'system/role/selectUser' ||
    component.includes('/profile/') ||
    component.endsWith('oper-info-dialog');

  for (const component of reactComponents) {
    if (!menuComponents.has(component) && !isKnownNonMenuComponent(component)) {
      gaps.push({type: 'react-page-without-menu', component, message: 'React 页面未直接匹配菜单组件'});
    }
  }
  for (const component of reactProComponents) {
    if (!menuComponents.has(component) && !isKnownNonMenuComponent(component)) {
      gaps.push({type: 'react-pro-page-without-menu', component, message: 'React Pro 页面未直接匹配菜单组件'});
    }
  }
  for (const component of vueComponents) {
    if (!menuComponents.has(component) && !isKnownNonMenuComponent(component)) {
      gaps.push({type: 'vue-view-without-menu', component, message: 'Vue 页面未直接匹配菜单组件'});
    }
  }
  return gaps;
}

function summarize(cases, gaps) {
  const summary = {
    totalCases: cases.length,
    p0: cases.filter((item) => item.priority === 'P0').length,
    p1: cases.filter((item) => item.priority === 'P1').length,
    p2: cases.filter((item) => item.priority === 'P2').length,
    reactCases: cases.filter((item) => item.clients.includes('react')).length,
    reactProCases: cases.filter((item) => item.clients.includes('react-pro')).length,
    vueCases: cases.filter((item) => item.clients.includes('vue')).length,
    sideEffectCases: cases.filter((item) => item.sideEffect).length,
    gaps: gaps.length,
    safetyGates: SAFETY_GATES.length
  };
  for (const priority of Object.keys(summary).filter((key) => key.startsWith('p'))) {
    if (!VALID_PRIORITIES.has(priority.toUpperCase())) {
      delete summary[priority];
    }
  }
  return summary;
}

function escapeMd(value) {
  return String(value ?? '').replace(/\|/gu, '\\|').replace(/\n/gu, ' ');
}

function renderMarkdown(matrix) {
  const lines = [
    '# 管理端 Web 自动化测试矩阵',
    '',
    `生成时间：${matrix.generatedAt}`,
    '',
    '## 摘要',
    '',
    `- 用例总数：${matrix.summary.totalCases}`,
    `- P0：${matrix.summary.p0}`,
    `- P1：${matrix.summary.p1}`,
    `- P2：${matrix.summary.p2}`,
    `- React 适用用例：${matrix.summary.reactCases}`,
    `- React Pro 适用用例：${matrix.summary.reactProCases}`,
    `- Vue 适用用例：${matrix.summary.vueCases}`,
    `- 副作用用例：${matrix.summary.sideEffectCases}`,
    `- 缺口数：${matrix.summary.gaps}`,
    `- 安全门禁：${matrix.summary.safetyGates}`,
    '',
    '## 用例清单',
    '',
    '| ID | 优先级 | 类型 | 模块 | 名称 | 路由 | 组件 | 客户端 | 副作用 | 缺口 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'
  ];

  for (const item of matrix.cases) {
    lines.push([
      item.id,
      item.priority,
      item.automationType,
      item.moduleKey,
      item.menuName,
      item.routePath,
      item.component,
      item.clients.join(','),
      item.sideEffect ? 'yes' : 'no',
      item.gaps.join('; ')
    ].map(escapeMd).join(' | ').replace(/^/u, '| ').replace(/$/u, ' |'));
  }

  lines.push('');
  return `${lines.join('\n')}\n`;
}

function renderGaps(matrix) {
  const lines = [
    '# 管理端 Web 自动化缺口报告',
    '',
    `生成时间：${matrix.generatedAt}`,
    '',
    `缺口总数：${matrix.gaps.length}`,
    ''
  ];

  if (matrix.gaps.length === 0) {
    lines.push('未发现结构性缺口。', '');
  } else {
    for (const gap of matrix.gaps) {
      const target = gap.id || gap.component || gap.moduleKey || 'unknown';
      lines.push(`- [${gap.type}] ${target}: ${gap.message}`);
    }
    lines.push('');
  }

  lines.push('## 安全门禁', '');
  for (const gate of matrix.safetyGates) {
    lines.push(`- ${gate}`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main() {
  const options = parseArgs(args);
  const sqlDir = path.join(repoRoot, 'sql');
  const reactPagesDir = path.join(repoRoot, 'infoq-scaffold-frontend-react', 'src', 'pages');
  const reactProPagesDir = path.join(repoRoot, 'infoq-scaffold-frontend-react-pro', 'src', 'pages');
  const vueViewsDir = path.join(repoRoot, 'infoq-scaffold-frontend-vue', 'src', 'views');
  const reactTestsDir = path.join(repoRoot, 'infoq-scaffold-frontend-react', 'tests');
  const reactProTestsDir = path.join(repoRoot, 'infoq-scaffold-frontend-react-pro', 'tests');
  const vueTestsDir = path.join(repoRoot, 'infoq-scaffold-frontend-vue', 'tests');

  const sqlFiles = listFiles(sqlDir, (file) => /infoq_scaffold(_update_\d{8}|_2\.0\.0)\.sql$/u.test(path.basename(file)));
  const reactPages = listFiles(reactPagesDir, (file) => file.endsWith('.tsx') || file.endsWith('.ts'));
  const reactProPages = listFiles(reactProPagesDir, (file) => file.endsWith('.tsx') || file.endsWith('.ts'));
  const vueViews = listFiles(vueViewsDir, (file) => file.endsWith('.vue') || file.endsWith('.ts'));
  const reactTests = listFiles(reactTestsDir, (file) => /\.(test|spec)\.(ts|tsx|js|jsx)$/u.test(file));
  const reactProTests = listFiles(reactProTestsDir, (file) => /\.(test|spec)\.(ts|tsx|js|jsx)$/u.test(file));
  const vueTests = listFiles(vueTestsDir, (file) => /\.(test|spec)\.(ts|tsx|js|jsx)$/u.test(file));

  const menus = readMenuRows(sqlFiles);
  const menuCases = buildMenuCases({menus, reactPagesDir, reactProPagesDir, vueViewsDir, reactTests, reactProTests, vueTests});
  const fixedCases = buildFixedRouteCases(reactPagesDir, reactProPagesDir, vueViewsDir, reactTests, reactProTests, vueTests);
  const cases = uniqueById([...fixedCases, ...menuCases]);
  const reactComponents = componentSet(reactPages, reactPagesDir, '.tsx');
  const reactProComponents = componentSet(reactProPages, reactProPagesDir, '.tsx');
  const vueComponents = componentSet(vueViews, vueViewsDir, '.vue');
  const gaps = collectGlobalGaps(cases, menus, reactComponents, reactProComponents, vueComponents);

  const matrix = {
    generatedAt: new Date().toISOString(),
    repoRoot: '.',
    sources: {
      sqlFiles: sqlFiles.map(rel),
      reactPages: reactPages.map(rel),
      reactProPages: reactProPages.map(rel),
      vueViews: vueViews.map(rel),
      reactTests: reactTests.map(rel),
      reactProTests: reactProTests.map(rel),
      vueTests: vueTests.map(rel)
    },
    summary: summarize(cases, gaps),
    cases,
    gaps,
    safetyGates: SAFETY_GATES
  };

  ensureDir(path.dirname(options.jsonPath));
  ensureDir(path.dirname(options.markdownPath));
  ensureDir(path.dirname(options.gapsPath));
  fs.writeFileSync(options.jsonPath, `${JSON.stringify(matrix, null, 2)}\n`, 'utf8');
  fs.writeFileSync(options.markdownPath, renderMarkdown(matrix), 'utf8');
  fs.writeFileSync(options.gapsPath, renderGaps(matrix), 'utf8');

  if (!options.quiet) {
    console.log(`Generated ${rel(options.jsonPath)}`);
    console.log(`Generated ${rel(options.markdownPath)}`);
    console.log(`Generated ${rel(options.gapsPath)}`);
  }
  console.log(`cases=${matrix.summary.totalCases} p0=${matrix.summary.p0} p1=${matrix.summary.p1} p2=${matrix.summary.p2} gaps=${matrix.summary.gaps}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
