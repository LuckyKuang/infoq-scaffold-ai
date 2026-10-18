import { useUserStore } from '@/store/modules/user';

export const checkPermi = (value: string[]) => {
  if (value && Array.isArray(value) && value.length > 0) {
    const permissions = useUserStore.getState().permissions;
    const allPermission = '*:*:*';
    return permissions.some((permission) => allPermission === permission || value.includes(permission));
  }
  return false;
};

export const checkRole = (value: string[]) => {
  if (value && Array.isArray(value) && value.length > 0) {
    const roles = useUserStore.getState().roles;
    const superAdmin = 'admin';
    return roles.some((role) => superAdmin === role || value.includes(role));
  }
  return false;
};

const auth = {
  hasPermiOr: (permis: string[]) => checkPermi(permis),
  hasRoleOr: (roles: string[]) => checkRole(roles)
};

export default auth;
