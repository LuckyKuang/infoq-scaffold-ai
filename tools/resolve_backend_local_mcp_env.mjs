import fs from 'node:fs';
import path from 'node:path';
import {URL} from 'node:url';

function stripInlineComment(content) {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (inDoubleQuote && char === '\\') {
      index += 1;
      continue;
    }
    if (inSingleQuote && char === "'" && content[index + 1] === "'") {
      index += 1;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === '#' && !inSingleQuote && !inDoubleQuote) {
      if (index === 0 || /\s/.test(content[index - 1])) {
        return content.slice(0, index).trimEnd();
      }
    }
  }

  return content.trimEnd();
}

function parseScalar(rawValue) {
  const value = rawValue.trim();

  if (/^'(?:[^']|'')*'$/u.test(value)) {
    return value.slice(1, -1).replaceAll("''", "'");
  }
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      throw new Error('Unsupported quoted YAML scalar; use single quotes or JSON-compatible double quotes');
    }
  }

  if (value === 'null' || value === '~') {
    return null;
  }
  if (/^[|>&*!\[{'"]/u.test(value)) return {unsupportedScalar: true};

  // Connection properties are strings; numeric coercion corrupts passwords and large identifiers.
  return value;
}

function parseYamlDocuments(source) {
  const docs = [];
  const lines = source.split(/\r?\n/u);
  let current = Object.create(null);
  let stack = [{indent: -1, node: current}];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, '    ');

    if (/^\s*---(?:\s*#.*)?$/u.test(line)) {
      if (Object.keys(current).length > 0) {
        docs.push(current);
      }
      current = Object.create(null);
      stack = [{ indent: -1, node: current }];
      continue;
    }

    if (/^\s*$/u.test(line) || /^\s*#/u.test(line)) {
      continue;
    }

    const trimmedLeading = line.replace(/^\s+/u, '');
    const indent = line.length - trimmedLeading.length;
    const content = stripInlineComment(trimmedLeading);

    if (!content) {
      continue;
    }

    const match = content.match(/^([^:]+?):(?:\s*(.*))?$/u);
    if (!match) {
      continue;
    }

    const key = match[1].trim();
    const rawValue = match[2] ?? '';
    const hasValue = rawValue.length > 0;

    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    if (stack.length === 0) {
      throw new Error(`invalid YAML indentation near key: ${key}`);
    }

    const parent = stack[stack.length - 1].node;
    if (Object.hasOwn(parent, key)) throw new Error(`Duplicate YAML key: ${key}`);

    if (hasValue) {
      parent[key] = parseScalar(rawValue);
      continue;
    }

    const nextNode = Object.create(null);
    parent[key] = nextNode;
    stack.push({ indent, node: nextNode });
  }

  if (current !== null) {
    docs.push(current);
  }

  return docs;
}

function readYamlDocuments(configPath) {
  if (!fs.existsSync(configPath)) {
    throw new Error(`missing config file: ${configPath}`);
  }

  const source = fs.readFileSync(configPath, 'utf8');
  return parseYamlDocuments(source);
}

export function resolveBackendConfigSelection(rootDir) {
  const resourcesDir = path.join(
    rootDir,
    'backend',
    'infoq-admin',
    'src',
    'main',
    'resources'
  );
  const localPath = path.join(resourcesDir, 'application-local.yml');
  if (fs.existsSync(localPath)) {
    return {configPath: localPath, profile: 'local'};
  }

  const devPath = path.join(resourcesDir, 'application-dev.yml');
  if (fs.existsSync(devPath)) {
    return {configPath: devPath, profile: 'dev'};
  }

  throw new Error(`missing backend config file: expected ${localPath} or ${devPath}`);
}

function findDoc(docs, predicate, description, configPath) {
  const matched = docs.filter(predicate);
  if (matched.length === 0) {
    throw new Error(`${description} not found in ${path.basename(configPath)}`);
  }
  if (matched.length !== 1) {
    throw new Error(`ambiguous ${description} in ${path.basename(configPath)}; select one configuration document`);
  }
  return matched[0];
}

function connectionScalar(value, field, {allowEmpty = false} = {}) {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim()) || value.includes('${')) {
    throw new Error(`Invalid or unresolved ${field}; provide an explicit scalar connection value`);
  }
  return value;
}

function normalizeEnv(values) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value == null ? '' : String(value)])
  );
}

export function resolveMysqlEnv(configPath) {
  const docs = readYamlDocuments(configPath);
  const configLabel = path.basename(configPath);
  const springDoc = findDoc(
    docs,
    (doc) => doc.spring?.datasource?.dynamic?.datasource?.master,
    'mysql datasource config',
    configPath
  );

  const master = springDoc.spring.datasource.dynamic.datasource.master;
  const hikari = springDoc.spring.datasource.dynamic.hikari ?? {};
  const connectionLimit = connectionScalar(Object.hasOwn(hikari, 'maxPoolSize') ? hikari.maxPoolSize : '10', 'mysql connection limit');
  if (!/^[1-9]\d*$/u.test(connectionLimit) || !Number.isSafeInteger(Number(connectionLimit))) {
    throw new Error('Invalid mysql connection limit; provide a positive safe integer');
  }
  const jdbcUrl = connectionScalar(master.url, `mysql datasource url in ${configLabel}`);
  if (!jdbcUrl.startsWith('jdbc:mysql:')) throw new Error(`Expected jdbc:mysql datasource URL in ${configLabel}`);
  let parsedUrl;
  try {
    parsedUrl = new URL(jdbcUrl.replace(/^jdbc:/u, ''));
  } catch {
    throw new Error(`Invalid mysql datasource URL in ${configLabel}`);
  }
  if (parsedUrl.protocol !== 'mysql:') throw new Error(`Expected jdbc:mysql datasource URL in ${configLabel}`);
  const database = parsedUrl.pathname.replace(/^\/+/u, '');

  if (!parsedUrl.hostname) {
    throw new Error('mysql host missing in datasource url');
  }

  if (!database) {
    throw new Error('mysql database missing in datasource url');
  }

  return normalizeEnv({
    MYSQL_HOST: parsedUrl.hostname,
    MYSQL_PORT: parsedUrl.port || '3306',
    MYSQL_USER: connectionScalar(master.username, 'mysql username'),
    MYSQL_PASSWORD: connectionScalar(master.password ?? '', 'mysql password', {allowEmpty: true}),
    MYSQL_DATABASE: database,
    MYSQL_CONNECTION_LIMIT: connectionLimit,
    MYSQL_READONLY: 'true',
  });
}

export function resolveRedisEnv(configPath) {
  const docs = readYamlDocuments(configPath);
  const redisDoc = findDoc(docs, (doc) => doc['spring.data']?.redis || doc.spring?.data?.redis, 'redis config', configPath);
  if (redisDoc['spring.data']?.redis && redisDoc.spring?.data?.redis) {
    throw new Error(`ambiguous redis config in ${path.basename(configPath)}; use one spring.data notation`);
  }
  const redis = redisDoc['spring.data']?.redis ?? redisDoc.spring.data.redis;
  const port = connectionScalar(redis.port, 'redis port');
  const database = connectionScalar(redis.database, 'redis database');
  if (!/^\d+$/u.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error('Invalid redis port');
  if (!/^\d+$/u.test(database) || !Number.isSafeInteger(Number(database))) throw new Error('Invalid redis database');

  return normalizeEnv({
    REDIS_HOST: connectionScalar(redis.host, 'redis host'),
    REDIS_PORT: port,
    REDIS_PASSWORD: connectionScalar(redis.password ?? '', 'redis password', {allowEmpty: true}),
    REDIS_DB: database,
    REDIS_READONLY: 'true',
  });
}
