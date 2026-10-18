export const convertPathToComponent = (path: string) => {
  const normalized = path.replace(/^\//, '');
  if (!normalized) {
    return 'index';
  }
  if (normalized === 'index') {
    return 'index';
  }
  if (normalized === 'user/profile') {
    return 'system/user/profile/index';
  }
  if (/^system\/user-auth\/role\/[^/]+$/.test(normalized)) {
    return 'system/user/authRole';
  }
  if (/^system\/role-auth\/user\/[^/]+$/.test(normalized)) {
    return 'system/role/authUser';
  }
  if (/^system\/dict-data\/index\/[^/]+$/.test(normalized)) {
    return 'system/dict/data';
  }
  return `${normalized}/index`;
};
