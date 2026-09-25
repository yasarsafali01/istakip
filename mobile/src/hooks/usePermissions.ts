import { useAuth } from '../context/AuthContext';
import { ROLES } from '../utils/constants';

// Mirrors frontend/src/hooks/usePermissions.js. Role flags say which built-in
// role's screens the user gets (custom roles borrow the one with the same
// scope); can(permission) says whether an individual action is allowed.
export function usePermissions() {
  const { currentUser } = useAuth();
  const role = currentUser?.role;
  const permissions = currentUser?.permissions ?? [];
  const can = (permission: string) => permissions.includes(permission);

  return {
    role,
    permissions,
    can,
    canManageUnits: can('unit.manage'),
    canCreateProject: can('project.create'),
    canManageIssues: can('issue.create'),
    canManageRoles: can('role.manage'),
    isExternalUser: role === ROLES.EXTERNAL_USER,
    isSystemAdmin: role === ROLES.SYSTEM_ADMIN,
    isDepartmentHead: role === ROLES.DEPARTMENT_HEAD,
    isProjectManager: role === ROLES.PROJECT_MANAGER,
    isWorker: role === ROLES.WORKER,
  };
}
