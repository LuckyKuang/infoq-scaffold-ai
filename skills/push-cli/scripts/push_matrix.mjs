export const PROFILES = ['docs', 'ci', 'full'];

const docGates = [
  {name: 'utf8', command: 'node', args: ['tools/validate_utf8.mjs']},
  {name: 'readme-sync', command: 'node', args: ['tools/check_readme_sync.mjs']},
  {name: 'release-version', command: 'node', args: ['tools/check_release_version.mjs']},
  {name: 'doc-links', command: 'node', args: ['tools/check_doc_links.mjs']}
];

const docsExtra = [
  {name: 'agents-check', command: 'node', args: ['skills/compress-cli/scripts/agents_check.mjs', 'check']}
];

const releaseGates = [
  {name: 'release-cli-test', command: 'node', args: ['skills/release-cli/scripts/test_release_cli.mjs']},
  {name: 'release-bump-test', command: 'node', args: ['skills/release-cli/scripts/test_bump_version.mjs']},
  {name: 'release-version-test', command: 'node', args: ['tools/test_check_release_version.mjs']},
  {name: 'release-assets-test', command: 'node', args: ['skills/release-cli/scripts/test_release_assets.mjs']},
  {name: 'release-policy-test', command: 'node', args: ['skills/release-cli/scripts/test_release_policy.mjs']}
];

const frontend = [
  {name: 'react-lint', command: 'pnpm', args: ['--dir', 'frontend-react', 'run', 'lint']},
  {name: 'react-test', command: 'pnpm', args: ['--dir', 'frontend-react', 'run', 'test']},
  {name: 'react-build', command: 'pnpm', args: ['--dir', 'frontend-react', 'run', 'build:prod']},
  {name: 'vue-lint', command: 'pnpm', args: ['--dir', 'frontend-vue', 'run', 'lint:eslint']},
  {name: 'vue-test', command: 'pnpm', args: ['--dir', 'frontend-vue', 'run', 'test:unit']},
  {name: 'vue-build', command: 'pnpm', args: ['--dir', 'frontend-vue', 'run', 'build:prod']}
];

const backendCi = [{
  name: 'backend-package',
  command: 'node',
  args: ['tools/backend_mvn.mjs', '--', '-B', '-ntp', '-DskipTests=false', 'clean', 'package', '-P', 'dev']
}];

function uniqueByName(steps) {
  const seen = new Set();
  return steps.filter((step) => {
    if (seen.has(step.name)) {
      return false;
    }
    seen.add(step.name);
    return true;
  });
}

export function buildMatrix(profile) {
  if (!PROFILES.includes(profile)) {
    throw new Error(`unknown profile: ${profile}`);
  }
  if (profile === 'docs') {
    return [...docGates, ...docsExtra];
  }
  if (profile === 'ci') {
    return [...docGates, ...releaseGates, ...frontend, ...backendCi];
  }
  return uniqueByName([...docGates, ...docsExtra, ...releaseGates, ...frontend, ...backendCi]);
}
