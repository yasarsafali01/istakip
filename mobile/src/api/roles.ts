import type { Role, User } from './types';

// The UI is organised around the five built-in roles. A custom role is shown as
// the built-in role that has the same data scope (`role`), while its real key
// stays in `roleKey` and its permission list in `permissions`.
const SCOPE_TO_BASE_ROLE: Record<string, Role> = {
  all: 'System_Admin',
  unit: 'Department_Head',
  manager: 'Project_Manager',
  project: 'Worker',
  own: 'External_User',
};

// Narrowest → widest; with extra roles the widest scope decides the UI,
// matching the backend's services.RoleStore.Resolve (and the web's withBaseRole).
const SCOPE_RANK: Record<string, number> = { own: 1, project: 2, manager: 3, unit: 4, all: 5 };

export function withBaseRole(user: User, scopeByRoleKey?: Record<string, string>): User {
  const key = user.roleKey || (user.role as string);
  // /auth/login and /users/me carry the effective scope; list entries only role keys.
  const scope = user.scope || [key, ...(user.extraRoles || [])]
    .map((k) => scopeByRoleKey?.[k])
    .filter(Boolean)
    .reduce<string | undefined>((best, s) => ((SCOPE_RANK[s!] || 0) > (SCOPE_RANK[best || ''] || 0) ? s : best), undefined);
  const base = (scope && SCOPE_TO_BASE_ROLE[scope]) || (key as Role);
  return { ...user, roleKey: key, role: base };
}
