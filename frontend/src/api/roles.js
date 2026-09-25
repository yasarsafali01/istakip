import { SCOPE_TO_BASE_ROLE } from '../constants';

/**
 * The UI is built around the five built-in roles. A custom role is presented to
 * it as the built-in role with the same data scope (`role`), while the real
 * role key is kept in `roleKey` and the permission list in `permissions`.
 */
export function withBaseRole(user, rolesByKey) {
  if (!user) return user;
  const key = user.roleKey || user.role;
  const scope = user.scope || rolesByKey?.[key]?.scope;
  const baseRole = SCOPE_TO_BASE_ROLE[scope] || key;
  return { ...user, roleKey: key, role: baseRole };
}
