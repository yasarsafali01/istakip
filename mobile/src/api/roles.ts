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

export function withBaseRole(user: User, scopeByRoleKey?: Record<string, string>): User {
  const key = user.roleKey || (user.role as string);
  const scope = user.scope || scopeByRoleKey?.[key];
  const base = (scope && SCOPE_TO_BASE_ROLE[scope]) || (key as Role);
  return { ...user, roleKey: key, role: base };
}
