import {createPermissionAccess} from './utils/permission';

/**
 * @see https://umijs.org/docs/max/access#access
 * */
export default function access(
  initialState:
    | {
        currentUser?: API.CurrentUser;
        roles?: string[];
        permissions?: string[];
      }
    | undefined,
) {
  const roles = initialState?.roles || initialState?.currentUser?.roles || [];
  const permissions =
    initialState?.permissions || initialState?.currentUser?.permissions || [];
  return createPermissionAccess(roles, permissions);
}
