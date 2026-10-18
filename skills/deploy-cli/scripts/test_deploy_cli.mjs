#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {
  buildSmokeChecks,
  DOCKER_COMMANDS,
  normalizeBindHost,
  parseArgs,
  parseEnvFile,
  parsePort,
  readDeployEnv,
  repoRoot,
  resolveRuntime,
  smoke,
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

test('parsePort rejects invalid configured ports instead of probing a different service', () => {
  assert.equal(parsePort('19090', 1), 19090);
  assert.throws(() => parsePort('0', 19090), /Invalid TCP port/u);
  assert.throws(() => parsePort('65536', 19090), /Invalid TCP port/u);
  assert.throws(() => parsePort('19090oops', 19090), /Invalid TCP port/u);
  assert.equal(parsePort(undefined, 19090), 19090);
});

test('normalizeBindHost maps wildcard binds to loopback probes', () => {
  assert.equal(normalizeBindHost('0.0.0.0'), '127.0.0.1');
  assert.equal(normalizeBindHost('::'), '127.0.0.1');
  assert.equal(normalizeBindHost('192.168.1.10'), '192.168.1.10');
  assert.equal(normalizeBindHost(undefined), '127.0.0.1');
});

test('Docker direct API probes stay on local HTTP when the public gateway uses HTTPS or a custom port', () => {
  const checks = buildSmokeChecks({runtime: 'docker', baseUrl: 'https://example.com:8443', frontendTarget: 'react'});
  assert.equal(checks[0].url, 'http://127.0.0.1:9090/monitor/health/readiness');
  assert.equal(checks[2].url, 'https://example.com:8443/prod-api/monitor/health/readiness');
  assert.equal(checks[3].url, 'https://example.com:8443/');
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
  assert.equal(vue.find((check) => check.name === 'vue-console').url, 'http://127.0.0.1/');
  assert.equal(all.find((check) => check.name === 'vue-console').url, 'http://127.0.0.1/vue/');
  assert.equal(all.find((check) => check.name === 'react-console').url, 'http://127.0.0.1/react/');
  assert.throws(() => buildSmokeChecks({runtime: 'docker', baseUrl: 'http://127.0.0.1', frontendTarget: 'typo'}), /INFOQ_FRONTEND_TARGET/u);
});

const fixturesRoot = path.join(repoRoot, 'tmp', 'deploy-cli-tests');
fs.mkdirSync(fixturesRoot, {recursive: true});
const fixture = fs.mkdtempSync(path.join(fixturesRoot, 'env-'));
const envFile = path.join(fixture, 'deploy.env');
fs.writeFileSync(envFile, "INFOQ_PUBLIC_BASE_URL='https://gateway.example:8443'\nINFOQ_FRONTEND_TARGET='react'\n", 'utf8');
try {
  test('runtime env uses the explicitly selected file with the same precedence as shell helpers', () => {
    const env = readDeployEnv('docker', {INFOQ_ENV_FILE: envFile, INFOQ_FRONTEND_TARGET: 'vue'});
    assert.equal(env.INFOQ_FRONTEND_TARGET, 'react');
    assert.equal(env.INFOQ_PUBLIC_BASE_URL, 'https://gateway.example:8443');
    assert.throws(() => readDeployEnv('docker', {INFOQ_ENV_FILE: path.join(fixture, 'missing')}), /does not exist/u);
    assert.equal(readDeployEnv('apple', {INFOQ_ENV_FILE: envFile}).INFOQ_FRONTEND_TARGET, 'react');
    assert.doesNotThrow(() => readDeployEnv('docker', {INFOQ_ENV_FILE: path.join(fixture, 'new-install')}, true));
  });

  const originalFetch = globalThis.fetch;
  const originalEnvFile = process.env.INFOQ_ENV_FILE;
  try {
    process.env.INFOQ_ENV_FILE = envFile;
    for (const status of [200, 302, 503]) {
      const requested = [];
      globalThis.fetch = async (url) => {
        requested.push(url);
        return {status};
      };
      const result = await smoke('docker');
      test(`smoke loads Docker env and treats HTTP ${status} accurately`, () => {
        assert.equal(result.passed, status === 200);
        assert.equal(result.baseUrl, 'https://gateway.example:8443');
        assert.equal(requested.at(-1), 'https://gateway.example:8443/');
        assert.equal(requested.length, 4);
      });
    }
    globalThis.fetch = async () => { throw new Error('connection refused'); };
    const failed = await smoke('docker');
    test('smoke reports connection failures without claiming success', () => {
      assert.equal(failed.passed, false);
      assert.ok(failed.checks.every((check) => check.error === 'connection refused'));
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEnvFile === undefined) delete process.env.INFOQ_ENV_FILE;
    else process.env.INFOQ_ENV_FILE = originalEnvFile;
  }
} finally {
  fs.rmSync(fixture, {recursive: true});
}

test('installer output protects secrets by default', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'deploy', 'install.sh'), 'utf8');
  const credentialsDir = fs.mkdtempSync(path.join(fixturesRoot, 'credentials-'));
  const credentialsFile = path.join(credentialsDir, 'credentials.txt');
  fs.writeFileSync(credentialsFile, 'Generated credentials:\n  private-fixture-password\n', 'utf8');
  const env = {...process.env, INFOQ_FRONTEND_TARGET: 'all', INFOQ_PUBLIC_BASE_URL: 'http://127.0.0.1', INFOQ_CREDENTIALS_FILE: credentialsFile};
  delete env.INFOQ_PRINT_SECRETS;
  try {
    // Exercise only the reporting function; never run the installer lifecycle.
    const script = source.replace(/\nmain "\$@"\s*$/u, '\nprint_summary\n');
    assert.notEqual(script, source);
    const result = spawnSync('bash', ['-c', script], {env, encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    assert.ok(!result.stdout.includes('private-fixture-password'));
    assert.ok(result.stdout.includes(`Credentials saved to ${credentialsFile}`));
    const explicit = spawnSync('bash', ['-c', script], {env: {...env, INFOQ_PRINT_SECRETS: '1'}, encoding: 'utf8'});
    assert.equal(explicit.status, 0, explicit.stderr);
    assert.ok(explicit.stdout.includes('private-fixture-password'));
  } finally {
    fs.rmSync(credentialsDir, {recursive: true});
  }
});

test('Apple image build stages its jar under repo tmp without touching a runtime', () => {
  const buildFixture = fs.mkdtempSync(path.join(fixturesRoot, 'apple-build-'));
  try {
    const deployDir = path.join(buildFixture, 'deploy');
    const jarDir = path.join(buildFixture, 'backend', 'infoq-admin', 'target');
    fs.mkdirSync(deployDir, {recursive: true});
    fs.mkdirSync(jarDir, {recursive: true});
    fs.writeFileSync(path.join(jarDir, 'infoq-admin.jar'), 'isolated fixture jar', 'utf8');
    const source = fs.readFileSync(path.join(repoRoot, 'deploy', 'apple-container.sh'), 'utf8');
    const declarations = source.replace(/\nmain "\$@"\s*$/u, '\n');
    assert.notEqual(declarations, source);
    const fixtureScript = path.join(deployDir, 'apple-container.sh');
    fs.writeFileSync(fixtureScript, declarations, 'utf8');
    const result = spawnSync('bash', ['-c', `
source "$INFOQ_TEST_SCRIPT"
ensure_system() { :; }
prepare_environment() { :; }
container() { printf '%s\\n' "$@" > "$INFOQ_TEST_CONTAINER_ARGS"; }
ADMIN_IMAGE=fixture-only
cmd_build --from-existing-jar
`], {
      env: {...process.env, INFOQ_TEST_SCRIPT: fixtureScript, INFOQ_TEST_CONTAINER_ARGS: path.join(buildFixture, 'container-args.txt')},
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.equal(result.status, 0, result.stderr);
    const context = path.join(buildFixture, 'tmp', 'deploy-cli', 'apple-build');
    assert.equal(fs.readFileSync(path.join(context, 'app.jar'), 'utf8'), 'isolated fixture jar');
    assert.equal(fs.existsSync(path.join(deployDir, '.apple-build')), false);
    const args = fs.readFileSync(path.join(buildFixture, 'container-args.txt'), 'utf8').trimEnd().split('\n');
    assert.equal(args[0], 'build');
    assert.equal(args.at(-1), context);
  } finally {
    fs.rmSync(buildFixture, {recursive: true, force: true});
  }
});

test('manual Nginx examples define each React route once', () => {
  for (const name of ['infoq-http.conf', 'infoq-https.conf']) {
    const source = fs.readFileSync(path.join(repoRoot, 'deploy', 'examples', 'nginx', name), 'utf8');
    assert.equal([...source.matchAll(/location = \/react \{/gu)].length, 1, name);
    assert.equal([...source.matchAll(/location \^~ \/react\/ \{/gu)].length, 1, name);
  }
});

test('interactive uninstall choices return only the normalized answer', () => {
  const source = fs.readFileSync(path.join(repoRoot, 'deploy', 'uninstall.sh'), 'utf8');
  const start = source.indexOf('normalize_choice() {');
  const end = source.indexOf('normalize_frontend_target() {', start);
  assert.ok(start >= 0 && end > start);
  const functions = source.slice(start, end);
  for (const [input, answer] of [['y\n', 'yes'], ['n\n', 'no'], ['\n', 'no']]) {
    const result = spawnSync('bash', ['-c', `${functions}\nchoice=$(choice_from_env_or_prompt INFOQ_UNINSTALL_APPS 'Remove apps?' no)\nprintf '%s' "$choice"\n`], {
      input,
      encoding: 'utf8',
      env: {...process.env, INFOQ_UNINSTALL_APPS: ''},
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, answer);
    assert.ok(result.stderr.includes('Remove apps? [y/N]'));
  }
});

test('Docker command gate only allows supported lifecycle commands', () => {
  assert.deepEqual([...DOCKER_COMMANDS].sort(), ['down', 'logs', 'up']);
  assert.equal(DOCKER_COMMANDS.has('up'), true);
  assert.equal(DOCKER_COMMANDS.has('build'), false);
  assert.equal(DOCKER_COMMANDS.has('restart'), false);
  assert.equal(DOCKER_COMMANDS.has('destroy'), false);
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
