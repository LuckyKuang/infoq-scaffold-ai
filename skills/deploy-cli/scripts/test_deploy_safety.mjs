#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {repoRoot, readDeployEnv} from './deploy_cli.mjs';

const fixtureRoot = path.join(repoRoot, 'tmp', 'deploy-cli-tests');
fs.mkdirSync(fixtureRoot, {recursive: true});
let passed = 0;
const failures = [];
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
const bash = process.env.INFOQ_TEST_BASH || 'bash';
function test(name, run) {
  const fixture = fs.mkdtempSync(path.join(fixtureRoot, 'safety-'));
  try {
    run(fixture);
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`FAIL ${name}: ${error.stack}`);
  } finally {
    fs.rmSync(fixture, {recursive: true, force: true});
  }
}
function shell(script, env = {}) {
  return spawnSync(bash, ['-c', script], {cwd: repoRoot, env: {...process.env, ...env}, encoding: 'utf8', timeout: 10000});
}
function prepare(fixture, command = 'backend', extraEnv = {}) {
  const deployRoot = path.join(fixture, 'data');
  const envFile = path.join(fixture, 'deploy.env');
  const password = "fixture '&\\ $password : # value";
  fs.writeFileSync(envFile, `INFOQ_DEPLOY_ROOT=${quote(deployRoot)}\nREDIS_PASSWORD=${quote(password)}\n`, {encoding: 'utf8', mode: 0o600});
  const script = command === 'backend' ? 'deploy/bin/infoq.sh' : 'deploy/bin/deploy-frontend.sh';
  const result = shell(`umask 077\nbash ${script} prepare react`, {INFOQ_ENV_FILE: envFile, ...extraEnv});
  return {result, deployRoot, password};
}

test('prepare creates usable directories without world write and keeps Redis secrets out of config', (fixture) => {
  const {result, deployRoot, password} = prepare(fixture);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.statSync(path.join(deployRoot, 'redis', 'data')).mode & 0o777, 0o755);
  assert.equal(fs.statSync(path.join(deployRoot, 'redis', 'conf', 'redis.conf')).mode & 0o777, 0o644);
  const config = fs.readFileSync(path.join(deployRoot, 'redis', 'conf', 'redis.conf'), 'utf8');
  assert.ok(!config.includes(password));
  assert.ok(!/^requirepass\s/mu.test(config));
  assert.ok(!`${result.stdout}${result.stderr}`.includes(password));
  fs.chmodSync(path.join(deployRoot, 'server', 'logs'), 0o750);
  assert.equal(prepare(fixture).result.status, 0);
  assert.equal(fs.statSync(path.join(deployRoot, 'server', 'logs')).mode & 0o777, 0o750);
  const frontend = prepare(fixture, 'frontend');
  assert.equal(frontend.result.status, 0, frontend.result.stderr);
  assert.equal(fs.statSync(path.join(deployRoot, 'react', 'logs')).mode & 0o777, 0o755);
});

test('prepare rejects legacy world-writable directories before overwriting configuration', (fixture) => {
  const {deployRoot} = prepare(fixture);
  const config = path.join(deployRoot, 'redis', 'conf', 'redis.conf');
  fs.writeFileSync(config, 'preserve until permissions reviewed\n');
  fs.chmodSync(path.join(deployRoot, 'redis', 'data'), 0o777);
  const {result} = prepare(fixture);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /允许其他用户写入/u);
  assert.equal(fs.readFileSync(config, 'utf8'), 'preserve until permissions reviewed\n');
});

test('prepare rejects directory and configuration symlinks without touching their targets', (fixture) => {
  const outside = path.join(fixture, 'outside');
  fs.mkdirSync(outside);
  const deployRoot = path.join(fixture, 'data');
  fs.mkdirSync(path.join(deployRoot, 'redis'), {recursive: true});
  fs.symlinkSync(outside, path.join(deployRoot, 'redis', 'conf'));
  assert.notEqual(prepare(fixture).result.status, 0);
  assert.deepEqual(fs.readdirSync(outside), []);
  fs.unlinkSync(path.join(deployRoot, 'redis', 'conf'));
  assert.equal(prepare(fixture).result.status, 0);
  const output = path.join(deployRoot, 'redis', 'conf', 'redis.conf');
  const protectedFile = path.join(outside, 'protected');
  fs.writeFileSync(protectedFile, 'must remain');
  fs.unlinkSync(output);
  fs.symlinkSync(protectedFile, output);
  assert.notEqual(prepare(fixture).result.status, 0);
  assert.equal(fs.readFileSync(protectedFile, 'utf8'), 'must remain');
});

test('prepare marks only newly created service directories and does not claim existing data', (fixture) => {
  const root = path.join(fixture, 'data');
  fs.mkdirSync(path.join(root, 'mysql'), {recursive: true});
  const {result} = prepare(fixture);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(root, 'mysql', '.infoq-deploy-owner')), false);
  assert.equal(fs.readFileSync(path.join(root, 'redis', '.infoq-deploy-owner'), 'utf8'), 'infoq-scaffold-ai\n');
});

test('Redis Compose uses a literal argv secret and read-only secret-free config', () => {
  const result = spawnSync('python3', ['-c', 'import json,yaml; c=yaml.safe_load(open("deploy/docker/docker-compose.yml",encoding="utf-8"))["services"]["redis"]; print(json.dumps(c))'], {cwd: repoRoot, encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  const redis = JSON.parse(result.stdout);
  assert.deepEqual(redis.command.slice(0, 3), ['redis-server', '/redis/config/redis.conf', '--requirepass']);
  assert.match(redis.command[3], /^\$\{REDIS_PASSWORD:\?/u);
  assert.ok(redis.volumes.some((volume) => volume.endsWith(':/redis/config:ro')));
});

test('legacy Redis config remains intact until the owned container uses the new authenticated command', (fixture) => {
  const {deployRoot, password} = prepare(fixture);
  const config = path.join(deployRoot, 'redis', 'conf', 'redis.conf');
  const legacy = 'bind 0.0.0.0\nrequirepass legacy-fixture-password\n';
  const bin = path.join(fixture, 'bin');
  fs.mkdirSync(bin);
  const calls = path.join(fixture, 'calls');
  fs.writeFileSync(path.join(bin, 'docker'), `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
if (args[0] !== 'container' || args[1] !== 'inspect' || args[2] !== 'redis') process.exit(98);
fs.appendFileSync(process.env.INFOQ_TEST_CALLS, 'inspect\\n');
const mode = process.env.INFOQ_TEST_MODE;
if (mode === 'inspect-fail') process.exit(17);
const project = mode === 'foreign' ? 'another-project' : 'infoq-scaffold-ai';
const mount = process.env.INFOQ_DEPLOY_ROOT + (mode === 'wrong-mount' ? '/foreign' : '/redis/conf');
const command = ['redis-server', '/redis/config/redis.conf'];
if (mode !== 'legacy-command') command.push('--requirepass', mode === 'wrong-password' ? 'other-password' : process.env.REDIS_PASSWORD);
console.log([project, 'redis', mount+'|'+(mode === 'writable' ? 'true' : 'false'), ...command, 'END'].join('\\n'));
`, {mode: 0o755});
  for (const mode of ['inspect-fail', 'foreign', 'wrong-mount', 'writable', 'legacy-command', 'wrong-password', 'current']) {
    fs.writeFileSync(config, legacy);
    const {result} = prepare(fixture, 'backend', {PATH: `${bin}:${process.env.PATH}`, INFOQ_TEST_MODE: mode, INFOQ_TEST_CALLS: calls});
    assert.ok(!`${result.stdout}${result.stderr}`.includes(password));
    if (mode === 'current') {
      assert.equal(result.status, 0, result.stderr);
      assert.ok(!/^requirepass\s/mu.test(fs.readFileSync(config, 'utf8')));
    } else {
      assert.notEqual(result.status, 0, mode);
      assert.match(result.stderr, /旧 Redis 认证配置保留不变/u);
      assert.equal(fs.readFileSync(config, 'utf8'), legacy);
    }
  }
  assert.equal(fs.readFileSync(calls, 'utf8').trim().split('\n').length, 7);
});

test('missing default env fails instead of probing an unrelated default service', (fixture) => {
  assert.throws(() => readDeployEnv('docker', {INFOQ_ENV_FILE: path.join(fixture, 'missing')}), /does not exist/u);
  const defaultEnv = '/etc/infoq-scaffold-ai/deploy.env';
  if (!fs.existsSync(defaultEnv)) assert.throws(() => readDeployEnv('docker', {}), /does not exist/u);
});

function runnerFunctions(component) {
  const file = path.join(repoRoot, 'deploy', 'docker', component, `run-${component}-it.sh`);
  const source = fs.readFileSync(file, 'utf8');
  const end = source.indexOf('\n(( $# <= 2 )) || usage');
  assert.ok(end > 0);
  return source.slice(0, end).replace(/^script_dir=.*$/mu, `script_dir=${quote(path.dirname(file))}`);
}
for (const component of ['mqtt', 'elasticsearch']) {
  test(`${component} redacts literal secrets even when Compose config fails`, (fixture) => {
    const secret = 'literal.*[\\&/ secret';
    const env = path.join(fixture, 'compose.env');
    fs.writeFileSync(env, `REDIS_PASSWORD=${secret}\nMIDDLEWARE_RUN_ID=fixture-run\n`);
    const result = shell(`${runnerFunctions(component)}\nenv_file="$INFOQ_TEST_ENV"\nevidence_dir="$INFOQ_TEST_ROOT"\ncompose() { printf '%s\\n' "redis: $INFOQ_TEST_PASSWORD"; return 37; }\nset +e\nrender_config\nstatus=$?\nset -e\n[[ "$status" == 37 ]]`, {INFOQ_TEST_ROOT: fixture, INFOQ_TEST_ENV: env, INFOQ_TEST_PASSWORD: secret});
    assert.equal(result.status, 0, result.stderr);
    const output = path.join(fixture, `compose-${component}.yaml`);
    assert.equal(fs.readFileSync(output, 'utf8'), 'redis: <redacted>\n');
    assert.equal(fs.statSync(output).mode & 0o777, 0o600);
  });
  test(`${component} runner rejects traversal and malformed run ids before invoking Docker`, (fixture) => {
    const stub = path.join(fixture, 'bin');
    fs.mkdirSync(stub);
    const calls = path.join(fixture, 'docker-called');
    fs.writeFileSync(path.join(stub, 'docker'), '#!/usr/bin/env bash\nprintf called >> "$INFOQ_TEST_CALLS"\nexit 99\n', {mode: 0o755});
    for (const id of ['../escape', '/absolute', 'bad_id', 'UPPER', 'a'.repeat(49)]) {
      const result = spawnSync(bash, [path.join(repoRoot, 'deploy', 'docker', component, `run-${component}-it.sh`), 'prepare', id], {env: {...process.env, INFOQ_DEPLOY_ROOT: path.join(fixture, 'data'), INFOQ_TEST_CALLS: calls, PATH: `${stub}:${process.env.PATH}`}, encoding: 'utf8'});
      assert.equal(result.status, 64, result.stderr);
    }
    assert.equal(fs.existsSync(calls), false);
  });

  test(`${component} runs resolve independent data and refuse legacy or mismatched env files`, (fixture) => {
    const root = path.join(fixture, 'data');
    for (const runId of ['first-run', 'second-run']) {
      const secretDir = path.join(root, `${component}-it`, 'secrets', runId);
      fs.mkdirSync(secretDir, {recursive: true});
      const assignments = [`MIDDLEWARE_RUN_ID=${runId}`, `MIDDLEWARE_SECRET_DIR=${secretDir}`, `INFOQ_DEPLOY_ROOT=${root}`];
      if (component === 'elasticsearch') assignments.push(`MIDDLEWARE_ES_DATA_DIR=${root}/elasticsearch-it/${runId}/data`);
      else assignments.push(`MIDDLEWARE_MQTT_CONFIG_DIR=${root}/mqtt-it/${runId}/config`, `MIDDLEWARE_MQTT_DATA_DIR=${root}/mqtt-it/${runId}/data`);
      fs.writeFileSync(path.join(secretDir, 'compose.env'), `${assignments.join('\n')}\n`);
      const result = shell(`${runnerFunctions(component)}\nrun_id=${quote(runId)}\nresolve_paths\nprintf '%s' "\${data_dir:-\${runtime_dir}/data}"`, {INFOQ_DEPLOY_ROOT: root});
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, `${root}/${component}-it/${runId}/data`);
    }
    const bin = path.join(fixture, 'bin');
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'docker'), `#!/usr/bin/env bash\n[[ -z "\${${component === 'mqtt' ? 'MIDDLEWARE_MQTT_DATA_DIR' : 'MIDDLEWARE_ES_DATA_DIR'}+x}" && -z "\${MIDDLEWARE_SECRET_DIR+x}" && -z "\${INFOQ_DEPLOY_ROOT+x}" ]] || exit 98\nprintf isolated\n`, {mode: 0o755});
    const compose = shell(`${runnerFunctions(component)}\nrun_id=first-run\nresolve_paths\ncompose config`, {INFOQ_DEPLOY_ROOT: root, MIDDLEWARE_ES_DATA_DIR: '/production/elasticsearch/data', MIDDLEWARE_MQTT_DATA_DIR: '/production/mqtt/data', MIDDLEWARE_SECRET_DIR: '/production/secrets', PATH: `${bin}:${process.env.PATH}`});
    assert.equal(compose.status, 0, compose.stderr);
    assert.equal(compose.stdout, 'isolated');
    const legacy = path.join(root, `${component}-it`, 'secrets', 'first-run', 'compose.env');
    fs.writeFileSync(legacy, 'MIDDLEWARE_RUN_ID=first-run\n');
    const result = shell(`${runnerFunctions(component)}\nrun_id=first-run\nresolve_paths`, {INFOQ_DEPLOY_ROOT: root});
    assert.equal(result.status, 78, result.stderr);
  });
}

function uninstallFixture(fixture, mode, {dryRun = false, apps = false, configOutside = false} = {}) {
  const root = path.join(fixture, 'data');
  const config = path.join(fixture, 'infoq-scaffold-ai');
  const bin = path.join(fixture, 'bin');
  fs.mkdirSync(bin);
  fs.mkdirSync(config);
  fs.mkdirSync(path.join(root, 'mysql', 'data'), {recursive: true});
  fs.writeFileSync(path.join(root, 'mysql', 'data', 'keep-until-authorized'), 'fixture data');
  if (mode !== 'missing-unowned') fs.writeFileSync(path.join(root, 'mysql', '.infoq-deploy-owner'), 'infoq-scaffold-ai\n');
  const envFile = configOutside ? path.join(fixture, 'trusted.env') : path.join(config, 'deploy.env');
  fs.writeFileSync(envFile, `INFOQ_FRONTEND_TARGET=react\nINFOQ_DEPLOY_ROOT=${quote(root)}\n`);
  const calls = path.join(fixture, 'calls.jsonl');
  const docker = `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2); const mode = process.env.INFOQ_TEST_MODE;
fs.appendFileSync(process.env.INFOQ_TEST_CALLS, JSON.stringify(args)+'\\n');
const root = process.env.INFOQ_TEST_ROOT;
if (args[0] === 'container' && args[1] === 'ls') {
 if(mode === 'daemon-fail') process.exit(17);
 if(!mode.startsWith('missing')) console.log('mysql\\tfixture-mysql'+(process.env.INFOQ_TEST_APPS === 'yes' ? '\\ninfoq-admin\\tfixture-admin\\nnginx-web\\tfixture-nginx' : ''));
} else if (args[0] === 'container' && args[1] === 'inspect') {
 if(mode === 'inspect-fail') process.exit(19);
 for (const id of args.slice(2,args.indexOf('--format'))) {
 const name = id === 'fixture-mysql' ? 'mysql' : id === 'fixture-admin' ? 'infoq-admin' : 'nginx-web';
 console.log((mode === 'foreign' || (mode === 'late-foreign' && name === 'nginx-web') ? 'another-project' : 'infoq-scaffold-ai')+'|'+(mode === 'wrong-service' ? 'other-service' : name)+'|'+id);
 const source = mode === 'wrong-mount' ? root+'/foreign/data' : root+'/mysql/data';
 console.log('bind|'+(name === 'mysql' ? source : root+'/server/logs')+'|'+(name === 'mysql' ? '/var/lib/mysql' : '/infoq/server/logs')+'|true');
 console.log('END');
 }
} else if(args[0] === 'network' && args[1] === 'ls') {
 if(mode === 'network-fail') process.exit(23);
 if(mode.startsWith('network-') || mode === 'owned') console.log('infoq-scaffold-ai_default');
} else if(args[0] === 'network' && args[1] === 'inspect') {
 if(args.includes('{{len .Containers}}')) console.log('0');
 else console.log('fixture-network|'+(mode === 'network-foreign' ? 'foreign' : 'infoq-scaffold-ai')+'|default');
} else if(args[0] !== 'rm' && !(args[0] === 'network' && args[1] === 'rm')) process.exit(97);
`;
  fs.writeFileSync(path.join(bin, 'docker'), docker, {encoding: 'utf8', mode: 0o755});
  const result = spawnSync(bash, [path.join(repoRoot, 'deploy', 'uninstall.sh'), ...(dryRun ? ['--dry-run'] : [])], {env: {...process.env, PATH: `${bin}:${process.env.PATH}`, INFOQ_ENV_FILE: envFile, INFOQ_CONFIG_DIR: config, INFOQ_DEPLOY_ROOT: root, INFOQ_TEST_ROOT: root, INFOQ_TEST_MODE: mode, INFOQ_TEST_CALLS: calls, INFOQ_TEST_APPS: apps ? 'yes' : 'no', INFOQ_UNINSTALL_APPS: apps ? 'yes' : 'no', INFOQ_UNINSTALL_MYSQL: 'yes', INFOQ_UNINSTALL_REDIS: 'no', INFOQ_UNINSTALL_MINIO: 'no', INFOQ_UNINSTALL_CONFIG: configOutside ? 'yes' : 'no', INFOQ_UNINSTALL_EMPTY_ROOT: 'no', INFOQ_UNINSTALL_CONFIRM: 'DELETE INFOQ DEPLOYMENT'}, encoding: 'utf8', timeout: 10000});
  return {result, root, calls: fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8').trim().split('\n').map(JSON.parse) : []};
}
test('uninstall refuses an unrelated config directory before removing any selected data', (fixture) => {
  const {result, root, calls} = uninstallFixture(fixture, 'owned', {configOutside: true});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /配置目录不包含本次加载的环境文件/u);
  assert.ok(fs.existsSync(path.join(root, 'mysql', 'data', 'keep-until-authorized')));
  assert.ok(calls.every((args) => args[0] !== 'rm' && !(args[0] === 'network' && args[1] === 'rm')));
});
for (const mode of ['daemon-fail', 'inspect-fail', 'foreign', 'wrong-service', 'wrong-mount', 'network-fail', 'network-foreign', 'late-foreign', 'missing-unowned']) {
  test(`uninstall ${mode} fails before any container, network or data removal`, (fixture) => {
    const {result, root, calls} = uninstallFixture(fixture, mode, {apps: mode === 'late-foreign'});
    assert.notEqual(result.status, 0, result.stdout);
    assert.ok(fs.existsSync(path.join(root, 'mysql', 'data', 'keep-until-authorized')));
    assert.ok(calls.every((args) => args[0] !== 'rm' && !(args[0] === 'network' && args[1] === 'rm')));
  });
}
for (const mode of ['owned', 'missing']) {
  test(`uninstall ${mode} deletes only the confirmed scope after successful preflight`, (fixture) => {
    const {result, root, calls} = uninstallFixture(fixture, mode);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(path.join(root, 'mysql')), false);
    assert.deepEqual(calls.filter((args) => args[0] === 'rm'), mode === 'owned' ? [['rm', '-f', 'fixture-mysql']] : []);
  });
}
test('uninstall dry-run validates ownership and leaves all selected data and resources intact', (fixture) => {
  const {result, root, calls} = uninstallFixture(fixture, 'owned', {dryRun: true});
  assert.equal(result.status, 0, result.stderr);
  assert.ok(fs.existsSync(path.join(root, 'mysql', 'data', 'keep-until-authorized')));
  assert.ok(calls.some((args) => args[0] === 'container' && args[1] === 'inspect'));
  assert.ok(calls.every((args) => args[0] !== 'rm' && !(args[0] === 'network' && args[1] === 'rm')));
});

test('Apple custom credentials are encoded as YAML scalars and SQL literals', (fixture) => {
  const source = fs.readFileSync(path.join(repoRoot, 'deploy', 'apple-container.sh'), 'utf8');
  const script = source.replace(/\nmain "\$@"\s*$/u, '\n').replace(/^SCRIPT_DIR=.*$/mu, `SCRIPT_DIR=${quote(path.join(repoRoot, 'deploy'))}`);
  const configDir = path.join(fixture, 'server', 'config');
  fs.mkdirSync(configDir, {recursive: true});
  const password = "quote' slash\\ : # $value";
  const result = shell(`${script}\nDEPLOY_ROOT="$INFOQ_TEST_ROOT"\nMYSQL_ADDRESS=127.0.0.1\nREDIS_ADDRESS=127.0.0.2\nINFOQ_DB_USERNAME="user'quoted"\nINFOQ_DB_PASSWORD="$INFOQ_TEST_PASSWORD"\nREDIS_PASSWORD="$INFOQ_TEST_PASSWORD"\nDEPLOY_ID='deploy: # value'\nwrite_admin_config\nrun_with_timeout() { printf '%s\\n' "$@" > "$INFOQ_TEST_SQL_ARGS"; }\nensure_mysql_app_user\nvalidate_ipv4_address 127.0.0.1`, {INFOQ_TEST_ROOT: fixture, INFOQ_TEST_PASSWORD: password, INFOQ_TEST_SQL_ARGS: path.join(fixture, 'sql-args')});
  assert.equal(result.status, 0, result.stderr);
  const parsed = spawnSync('python3', ['-c', 'import json,yaml,sys;print(json.dumps(list(yaml.safe_load_all(open(sys.argv[1],encoding="utf-8")))))', path.join(configDir, 'application-prod.yml')], {encoding: 'utf8'});
  assert.equal(parsed.status, 0, parsed.stderr);
  const config = JSON.parse(parsed.stdout)[0];
  assert.equal(config.spring.datasource.dynamic.datasource.master.password, password);
  assert.equal(config['spring.data'].redis.password, password);
  const sqlArgs = fs.readFileSync(path.join(fixture, 'sql-args'), 'utf8');
  assert.ok(sqlArgs.includes("SET SESSION sql_mode='NO_BACKSLASH_ESCAPES';"));
  assert.ok(sqlArgs.includes("'user''quoted'@'%'") && sqlArgs.includes("'quote'' slash\\ : # $value'"));
  const invalid = shell(`${script}\nvalidate_ipv4_address 999.0.0.1`);
  assert.notEqual(invalid.status, 0);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  const name = `CLI ${signal} stops its owned shell process group and preserves interrupted state`;
  const fixture = fs.mkdtempSync(path.join(fixtureRoot, 'signal-'));
  let child;
  let observedExit;
  try {
    const cliPath = path.join(fixture, 'skills', 'deploy-cli', 'scripts', 'deploy_cli.mjs');
    fs.mkdirSync(path.dirname(cliPath), {recursive: true});
    fs.copyFileSync(path.join(repoRoot, 'skills', 'deploy-cli', 'scripts', 'deploy_cli.mjs'), cliPath);
    const stubPath = process.platform === 'darwin' ? path.join(fixture, 'deploy', 'apple-container.sh') : path.join(fixture, 'deploy', 'bin', 'infoq.sh');
    fs.mkdirSync(path.dirname(stubPath), {recursive: true});
    fs.writeFileSync(stubPath, '#!/usr/bin/env bash\nsleep 60 &\nprintf "%s %s\\n" "$$" "$!" > "$INFOQ_TEST_PIDS"\nwait\n');
    const envFile = path.join(fixture, 'deploy.env');
    fs.writeFileSync(envFile, 'INFOQ_FRONTEND_TARGET=react\nINFOQ_PUBLIC_BASE_URL=http://127.0.0.1\n', {mode: 0o600});
    const pidFile = path.join(fixture, 'pids');
    child = spawn(process.execPath, [cliPath, 'logs', '--service', process.platform === 'darwin' ? 'admin' : 'infoq-admin', ...(process.platform === 'darwin' ? [] : ['--execute'])], {cwd: fixture, env: {...process.env, INFOQ_ENV_FILE: envFile, INFOQ_TEST_PIDS: pidFile}, stdio: 'pipe'});
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    const exit = new Promise((resolve) => { child.once('exit', (code, exitSignal) => { observedExit = {code, exitSignal}; resolve(observedExit); }); });
    const deadline = Date.now() + 5000;
    while (!fs.existsSync(pidFile) && !observedExit && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
    assert.ok(fs.existsSync(pidFile), stderr);
    const pids = fs.readFileSync(pidFile, 'utf8').trim().split(' ').map(Number);
    child.kill(signal);
    const timer = setTimeout(() => child.kill('SIGKILL'), 7000);
    const result = await exit;
    clearTimeout(timer);
    assert.equal(result.code, signal === 'SIGINT' ? 130 : 143, stderr);
    assert.equal(JSON.parse(fs.readFileSync(path.join(fixture, 'tmp', 'deploy-cli', 'state.json'), 'utf8')).status, 'interrupted');
    for (const pid of pids) {
      let alive = false;
      try { process.kill(pid, 0); alive = true; } catch (error) { if (error.code !== 'ESRCH') throw error; }
      if (alive) {
        const state = spawnSync('ps', ['-o', 'stat=', '-p', String(pid)], {encoding: 'utf8'}).stdout.trim();
        assert.ok(state.startsWith('Z'), `owned process ${pid} remains alive (${state})`);
      }
    }
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`FAIL ${name}: ${error.stack}`);
  } finally {
    if (child && !observedExit) child.kill('SIGKILL');
    fs.rmSync(fixture, {recursive: true, force: true});
  }
}

if (failures.length) process.exitCode = 1;
console.log(`\n${passed} deployment safety tests passed; ${failures.length} failed`);
