import fs from 'node:fs';
import path from 'node:path';
import {URL} from 'node:url';

function stripInlineComment(content) {
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

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

  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    return value.slice(1, -1);
  }

  if (value === 'null' || value === '~') {
    return null;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    return Number(value);
  }

  return value;
}

function parseYamlDocuments(source) {
  const docs = [];
  const lines = source.split(/\r?\n/u);
  let current = null;
  let stack = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, '    ');

    if (/^\s*---(?:\s*#.*)?$/u.test(line)) {
      if (current !== null) {
        docs.push(current);
      }
      current = {};
      stack = [{ indent: -1, node: current }];
      continue;
    }

    if (current === null) {
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

    if (hasValue) {
      parent[key] = parseScalar(rawValue);
      continue;
    }

    const nextNode = {};
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
    'infoq-scaffold-backend',
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
  const matched = docs.find(predicate);
  if (!matched) {
    throw new Error(`${description} not found in ${path.basename(configPath)}`);
  }
  return matched;
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
  const jdbcUrl = String(master.url ?? '');

  if (!jdbcUrl) {
    throw new Error(`mysql datasource url missing in ${configLabel}`);
  }

  const parsedUrl = new URL(jdbcUrl.replace(/^jdbc:/u, ''));
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
    MYSQL_USER: master.username,
    MYSQL_PASSWORD: master.password,
    MYSQL_DATABASE: database,
    MYSQL_CONNECTION_LIMIT: hikari.maxPoolSize ?? '10',
    MYSQL_READONLY: 'true',
  });
}

export function resolveRedisEnv(configPath) {
  const docs = readYamlDocuments(configPath);
  const redisDoc = findDoc(docs, (doc) => doc['spring.data']?.redis, 'redis config', configPath);
  const redis = redisDoc['spring.data'].redis;

  return normalizeEnv({
    REDIS_HOST: redis.host,
    REDIS_PORT: redis.port,
    REDIS_PASSWORD: redis.password ?? '',
    REDIS_DB: redis.database,
    REDIS_READONLY: 'true',
  });
}
