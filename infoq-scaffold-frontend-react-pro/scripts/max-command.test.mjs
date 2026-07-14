import assert from 'node:assert/strict';
import {test} from 'node:test';
import {delimiter, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createMaxCommand} from './max-command.mjs';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

test('starts Max through the current Node executable with pnpm dependency paths', () => {
  const command = createMaxCommand(rootDir, ['build'], {
    NODE_PATH: 'inherited-node-path',
  });
  const maxPackageDir = dirname(dirname(command.arguments[0]));

  assert.equal(command.command, process.execPath);
  assert.equal(command.arguments[1], 'build');
  assert.deepEqual(command.env.NODE_PATH.split(delimiter), [
    join(maxPackageDir, 'node_modules'),
    dirname(dirname(maxPackageDir)),
    join(rootDir, 'node_modules', '.pnpm', 'node_modules'),
    'inherited-node-path',
  ]);
});
