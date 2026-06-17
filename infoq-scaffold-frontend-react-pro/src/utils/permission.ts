const ALL_PERMISSION = '*:*:*';
const SUPER_ADMIN = 'admin';
let runtimeRoles: string[] = [];
let runtimePermissions: string[] = [];

const includesAny = (owned: string[] | undefined, expected: string[]) =>
  expected.some((item) => owned?.includes(item));

export const setPermissionContext = (
  roles: string[] = [],
  permissions: string[] = [],
) => {
  runtimeRoles = roles;
  runtimePermissions = permissions;
};

export const createPermissionAccess = (
  roles: string[] = [],
  permissions: string[] = [],
) => {
  setPermissionContext(roles, permissions);
  const hasSuperAdmin = roles.includes(SUPER_ADMIN);
  const hasAllPermission = permissions.includes(ALL_PERMISSION);

  return {
    canAdmin: hasSuperAdmin,
    hasPermi: (permission: string) =>
      hasAllPermission || permissions.includes(permission),
    hasPermiOr: (items: string[]) =>
      hasAllPermission || includesAny(permissions, items),
    hasRole: (role: string) => hasSuperAdmin || roles.includes(role),
    hasRoleOr: (items: string[]) => hasSuperAdmin || includesAny(roles, items),
  };
};

export const checkPermi = (value: string[]) => {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }
  return runtimePermissions.some(
    (permission) => permission === ALL_PERMISSION || value.includes(permission),
  );
};

export const checkRole = (value: string[]) => {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }
  return runtimeRoles.some(
    (role) => role === SUPER_ADMIN || value.includes(role),
  );
};

const auth = {
  hasPermiOr: (permissions: string[]) => checkPermi(permissions),
  hasRoleOr: (roles: string[]) => checkRole(roles),
};

export default auth;
