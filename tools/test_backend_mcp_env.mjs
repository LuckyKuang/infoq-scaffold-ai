#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveMysqlEnv, resolveRedisEnv, resolveBackendConfigSelection} from './resolve_backend_local_mcp_env.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const parent = path.join(root, 'tmp', 'mcp-env-tests');
fs.mkdirSync(parent, {recursive: true});
const dir = fs.mkdtempSync(path.join(parent, 'run-'));
const config = path.join(dir, 'config.yml');
const mysql = `spring:
  datasource:
    dynamic:
      datasource:
        master:
          url: jdbc:mysql://127.0.0.1:3306/fixture
          username: audit
          password: 00001234
`;
const redis = `spring.data:
  redis:
    host: 127.0.0.1
    port: 6379
    password: ''
    database: 0
`;
const results = [];
function check(name, source, action) {
  fs.writeFileSync(config, source, 'utf8');
  action();
  results.push({name, passed: true});
  console.log(`[PASS] ${name}`);
}
check('ordinary first YAML document is read', mysql, () => {
  const env = resolveMysqlEnv(config);
  assert.equal(env.MYSQL_DATABASE, 'fixture');
  assert.equal(env.MYSQL_PASSWORD, '00001234');
  assert.equal(env.MYSQL_CONNECTION_LIMIT, '10');
});
const withPoolSize = (value) => mysql.replace('      datasource:', `      hikari:\n        maxPoolSize: ${value}\n      datasource:`);
check('explicit positive pool size is preserved', withPoolSize('20'), () => {
  assert.equal(resolveMysqlEnv(config).MYSQL_CONNECTION_LIMIT, '20');
});
for (const value of ['${POOL_SIZE:20}', '{ value: 20 }', '0', '-1', '1.5', '9007199254740992', 'null']) {
  check(`invalid pool size is rejected: ${value}`, withPoolSize(value), () => {
    assert.throws(() => resolveMysqlEnv(config), /mysql connection limit/u);
  });
}
check('marked documents select the relevant connection', `---\n${mysql}---\n${redis}`, () => {
  assert.equal(resolveMysqlEnv(config).MYSQL_PASSWORD, '00001234');
  assert.equal(resolveRedisEnv(config).REDIS_DB, '0');
});
const nestedRedis = `spring:\n  data:\n${redis.split('\n').slice(1).map((line) => line ? `  ${line}` : '').join('\n')}`;
check('nested spring.data.redis notation matches dotted notation', nestedRedis, () => {
  assert.equal(resolveRedisEnv(config).REDIS_HOST, '127.0.0.1');
});
check('single-quoted secret retains apostrophe, hash and leading characters', mysql.replace('00001234', "'!a''b # c & \\d' # comment"), () => {
  assert.equal(resolveMysqlEnv(config).MYSQL_PASSWORD, "!a'b # c & \\d");
});
check('invalid single-quoted secret is not accepted as valid YAML', mysql.replace('00001234', "'a'b'"), () => {
  assert.throws(() => resolveMysqlEnv(config), /mysql password/u);
});
check('duplicate connection key is rejected', mysql.replace('password: 00001234', 'password: first\n          password: second'), () => {
  assert.throws(() => resolveMysqlEnv(config), /Duplicate YAML key: password/u);
});
check('double-quoted secret decodes escapes and quoted hash', mysql.replace('00001234', '"a\\\" #b\\\\c" # comment'), () => {
  assert.equal(resolveMysqlEnv(config).MYSQL_PASSWORD, 'a" #b\\c');
});
check('ambiguous profile documents fail', `${mysql}---\n${mysql}`, () => {
  assert.throws(() => resolveMysqlEnv(config), /ambiguous mysql/u);
});
check('mixed redis notation fails instead of choosing silently', redis + nestedRedis, () => {
  assert.throws(() => resolveRedisEnv(config), /ambiguous redis/u);
});
check('unresolved secret placeholder fails without exposing it', mysql.replace('00001234', '${FIXTURE_SECRET:do-not-print}'), () => {
  assert.throws(() => resolveMysqlEnv(config), (error) => /unresolved mysql password/u.test(error.message) && !error.message.includes('do-not-print'));
});
check('unsupported complex connection scalar fails', mysql.replace('00001234', '|\n            block-secret'), () => {
  assert.throws(() => resolveMysqlEnv(config), /mysql password/u);
});
check('invalid JDBC URL fails without exposing credentials', mysql.replace('jdbc:mysql://127.0.0.1:3306/fixture', 'jdbc:mysql://secret:user@['), () => {
  assert.throws(() => resolveMysqlEnv(config), (error) => /Invalid mysql datasource/u.test(error.message) && !error.message.includes('secret'));
});
check('non-MySQL datasource is rejected', mysql.replace('jdbc:mysql:', 'jdbc:postgresql:'), () => {
  assert.throws(() => resolveMysqlEnv(config), /jdbc:mysql/u);
});
for (const [name, source, pattern] of [
  ['missing Redis host', redis.replace('host: 127.0.0.1', 'host:'), /redis host/u],
  ['invalid Redis port', redis.replace('6379', '65536'), /redis port/u],
  ['invalid Redis database', redis.replace('database: 0', 'database: -1'), /redis database/u],
]) check(name, source, () => assert.throws(() => resolveRedisEnv(config), pattern));
check('local profile selection does not silently merge incomplete dev fields', '', () => {
  const resources = path.join(dir, 'backend/infoq-admin/src/main/resources');
  fs.mkdirSync(resources, {recursive: true});
  fs.writeFileSync(path.join(resources, 'application-dev.yml'), mysql, 'utf8');
  fs.writeFileSync(path.join(resources, 'application-local.yml'), 'spring:\n  application:\n    name: fixture\n', 'utf8');
  const selected = resolveBackendConfigSelection(dir);
  assert.equal(selected.profile, 'local');
  assert.throws(() => resolveMysqlEnv(selected.configPath), /mysql datasource config not found/u);
});
fs.writeFileSync(path.join(dir, 'results.json'), `${JSON.stringify(results, null, 2)}\n`, 'utf8');
console.log(`[mcp-env] ${results.length} scenarios passed; ${path.relative(root, dir)}`);
