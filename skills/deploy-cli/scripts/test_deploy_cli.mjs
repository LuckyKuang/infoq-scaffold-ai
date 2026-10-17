#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  buildSmokeChecks,
  normalizeBindHost,
  parseArgs,
  parseEnvFile,
  parsePort,
  resolveRuntime,
  withPort,
} from './deploy_cli.mjs';

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push({name, error});
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

test('parseEnvFile ignores comments and strips matching quotes', () => {
  const env = parseEnvFile([
    '# comment',
    'APPLE_CONTAINER_HOST_PORT=19090',
    'INFOQ_PUBLIC_BASE_URL="http://127.0.0.1"',
    "INFOQ_DB_USERNAME='infoq_app'",
    '',
  ].join('\n'));
  assert.deepEqual(env, {
    APPLE_CONTAINER_HOST_PORT: '19090',
    INFOQ_PUBLIC_BASE_URL: 'http://127.0.0.1',
    INFOQ_DB_USERNAME: 'infoq_app',
  });
});

test('parseEnvFile rejects malformed lines', () => {
  assert.throws(() => parseEnvFile('NOT_AN_ASSIGNMENT'), /Invalid env line/u);
  assert.throws(() => parseEnvFile('1BAD=value'), /Invalid env key/u);
});

test('parseArgs treats --help as help', () => {
  assert.deepEqual(parseArgs(['--help']), {command: 'help', flags: {}, values: {}});
  assert.deepEqual(parseArgs([]), {command: 'help', flags: {}, values: {}});
});

test('parseArgs accepts up flags and value options', () => {
  assert.deepEqual(parseArgs(['up', '--recreate', '--no-build']), {
    command: 'up',
    flags: {recreate: true, 'no-build': true},
    values: {},
  });
  assert.deepEqual(parseArgs(['logs', '--service', 'mysql', '--follow']), {
    command: 'logs',
    flags: {follow: true},
    values: {service: 'mysql'},
  });
  assert.deepEqual(parseArgs(['smoke', '--base-url=http://127.0.0.1:19090', '--timeout-ms', '500']), {
    command: 'smoke',
    flags: {},
    values: {'base-url': 'http://127.0.0.1:19090', 'timeout-ms': '500'},
  });
});

test('parseArgs rejects unknown commands, options, and positional arguments', () => {
  assert.throws(() => parseArgs(['deploy']), /Unknown command/u);
  assert.throws(() => parseArgs(['status', '--bogus']), /Unknown argument/u);
  assert.throws(() => parseArgs(['status', '--base-url']), /Missing value/u);
  assert.throws(() => parseArgs(['status', '--', 'extra']), /pass-through/u);
});

test('parsePort only accepts valid TCP ports', () => {
  assert.equal(parsePort('19090', 1), 19090);
  assert.equal(parsePort('0', 19090), 19090);
  assert.equal(parsePort('65536', 19090), 19090);
  assert.equal(parsePort(undefined, 19090), 19090);
});

test('normalizeBindHost maps wildcard binds to loopback probes', () => {
  assert.equal(normalizeBindHost('0.0.0.0'), '127.0.0.1');
  assert.equal(normalizeBindHost('::'), '127.0.0.1');
  assert.equal(normalizeBindHost('192.168.1.10'), '192.168.1.10');
  assert.equal(normalizeBindHost(undefined), '127.0.0.1');
});

test('withPort preserves an explicit URL port', () => {
  assert.equal(withPort('http://127.0.0.1', 9090), 'http://127.0.0.1:9090');
  assert.equal(withPort('http://127.0.0.1:19090', 9090), 'http://127.0.0.1:19090');
  assert.equal(withPort('https://example.com', 9090), 'https://example.com:9090');
});

test('buildSmokeChecks covers Apple readiness, liveness, and captcha', () => {
  const checks = buildSmokeChecks({runtime: 'apple', baseUrl: 'http://127.0.0.1:19090/'});
  assert.deepEqual(checks.map((check) => check.url), [
    'http://127.0.0.1:19090/monitor/health/readiness',
    'http://127.0.0.1:19090/monitor/health/liveness',
    'http://127.0.0.1:19090/auth/code',
  ]);
});

test('buildSmokeChecks selects Docker frontend targets', () => {
  const all = buildSmokeChecks({runtime: 'docker', baseUrl: 'http://127.0.0.1', frontendTarget: 'all'});
  assert.ok(all.some((check) => check.name === 'vue-console'));
  assert.ok(all.some((check) => check.name === 'react-console'));
  assert.ok(all.every((check) => check.url.startsWith('http://127.0.0.1')));

  const vue = buildSmokeChecks({runtime: 'docker', baseUrl: 'http://127.0.0.1', frontendTarget: 'vue'});
  assert.ok(vue.some((check) => check.name === 'vue-console'));
  assert.ok(!vue.some((check) => check.name === 'react-console'));
});

test('resolveRuntime follows the supported platform matrix', () => {
  assert.equal(resolveRuntime('darwin'), 'apple');
  assert.equal(resolveRuntime('linux'), 'docker');
  assert.equal(resolveRuntime('win32'), 'wsl2');
  assert.throws(() => resolveRuntime('freebsd'), /Unsupported platform/u);
});

if (failures.length > 0) {
  console.error(`\n${failures.length} test(s) failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\nAll ${passed} deploy-cli tests passed`);
