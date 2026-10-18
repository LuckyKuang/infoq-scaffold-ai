// 仓库发布契约只支持正式版与按数值递增的 rcN，不扩展通用预发布语法。
export function parseReleaseVersion(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-rc([1-9]\d*))?$/u);
  if (!match) return null;
  const [major, minor, patch] = match.slice(1, 4).map(Number);
  const rc = match[4] === undefined ? null : Number(match[4]);
  if (![major, minor, patch, ...(rc === null ? [] : [rc])].every(Number.isSafeInteger)) return null;
  return {version: value, major, minor, patch, rc, isPrerelease: rc !== null};
}

export function releaseVersionFromTag(tag) {
  return typeof tag === 'string' && tag.startsWith('v') ? parseReleaseVersion(tag.slice(1)) : null;
}

export function compareReleaseVersions(left, right) {
  const a = parseReleaseVersion(typeof left === 'string' ? left : left?.version);
  const b = parseReleaseVersion(typeof right === 'string' ? right : right?.version);
  if (!a || !b) throw new Error('Cannot compare invalid release versions');
  for (const key of ['major', 'minor', 'patch']) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  }
  if (a.rc === b.rc) return 0;
  if (a.rc === null) return 1;
  if (b.rc === null) return -1;
  return a.rc < b.rc ? -1 : 1;
}
