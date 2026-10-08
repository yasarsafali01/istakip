import { SCOPE_TO_BASE_ROLE } from '../constants';

/**
 * The UI is built around the five built-in roles. A custom role is presented to
 * it as the built-in role with the same data scope (`role`), while the real
 * role key is kept in `roleKey` and the permission list in `permissions`.
 */
// Narrowest → widest; with extra roles the widest scope decides the UI,
// matching the backend's services.RoleStore.Resolve.
const SCOPE_RANK = { own: 1, project: 2, manager: 3, unit: 4, all: 5 };

export function withBaseRole(user, rolesByKey) {
  if (!user) return user;
  const key = user.roleKey || user.role;
  // /auth/login and /users/me already carry the effective scope; other users
  // in a list only have role keys, so derive it here.
  const scope = user.scope || [key, ...(user.extraRoles || [])]
    .map((k) => rolesByKey?.[k]?.scope)
    .filter(Boolean)
    .reduce((best, s) => ((SCOPE_RANK[s] || 0) > (SCOPE_RANK[best] || 0) ? s : best), undefined);
  const baseRole = SCOPE_TO_BASE_ROLE[scope] || key;
  return { ...user, roleKey: key, role: baseRole };
}
