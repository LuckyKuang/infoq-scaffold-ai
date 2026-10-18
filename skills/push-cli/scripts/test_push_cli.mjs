#!/usr/bin/env node
import assert from 'node:assert/strict';
import {PROFILES, buildMatrix} from './push_matrix.mjs';

function names(profile) {
  return buildMatrix(profile).map((step) => step.name);
}

assert.deepEqual(PROFILES, ['docs', 'ci', 'full']);
assert.throws(() => buildMatrix('unknown'), /unknown profile/);

const docs = names('docs');
assert.ok(docs.includes('utf8'));
assert.ok(docs.includes('agents-check'));
assert.ok(!docs.includes('backend-package'));
assert.ok(!docs.includes('vue-test'));

const ci = names('ci');
assert.ok(ci.includes('utf8'));
assert.ok(ci.includes('backend-package'));
assert.ok(ci.includes('vue-test'));
assert.ok(ci.includes('react-test'));
assert.ok(!ci.includes('agents-check'));

const full = names('full');
for (const name of docs) assert.ok(full.includes(name), `full missing ${name}`);
for (const name of ci) assert.ok(full.includes(name), `full missing ${name}`);
assert.equal(new Set(full).size, full.length, 'full profile must not contain duplicate steps');

const backend = buildMatrix('ci').find((step) => step.name === 'backend-package');
assert.deepEqual(backend.args, ['tools/backend_mvn.mjs', '--', '-B', '-ntp', '-DskipTests=false', 'clean', 'package', '-P', 'dev']);

console.log('[push-cli-test] pass: profiles docs/ci/full and CI parity matrix');
