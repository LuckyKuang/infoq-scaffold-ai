import {createRequire} from 'node:module';
import {delimiter, dirname, join} from 'node:path';

export const createMaxCommand = (
  rootDir,
  argumentsList,
  inheritedEnv = process.env,
) => {
  const projectRequire = createRequire(join(rootDir, 'package.json'));
  const maxEntry = projectRequire.resolve('@umijs/max/bin/max.js');
  const maxPackageDir = dirname(dirname(maxEntry));
  const nodePath = [
    join(maxPackageDir, 'node_modules'),
    dirname(dirname(maxPackageDir)),
    join(rootDir, 'node_modules', '.pnpm', 'node_modules'),
    inheritedEnv.NODE_PATH,
  ]
    .filter(Boolean)
    .join(delimiter);

  return {
    command: process.execPath,
    arguments: [maxEntry, ...argumentsList],
    env: {
      ...inheritedEnv,
      NODE_PATH: nodePath,
    },
  };
};
