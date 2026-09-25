import { useAuth } from './useAuth';
import { ROLES, DEFAULT_ROLE_PERMISSIONS } from '../constants';

/**
 * Role flags describe which built-in role's screens the user gets (a custom
 * role borrows the built-in role with the same data scope); `can(permission)`
 * says whether an individual action is allowed.
 */
export function usePermissions() {
  const { currentUser } = useAuth();
  const role = currentUser?.role;

  // The list comes from the backend; fall back to the built-in defaults only
  // when a session has no scope yet (unit tests, very old sessions).
  const permissions = currentUser?.scope
    ? currentUser.permissions || []
    : currentUser?.permissions || DEFAULT_ROLE_PERMISSIONS[role] || [];
  const can = (permission) => permissions.includes(permission);

  return {
    role,
    permissions,
    can,
    canManageUnits: can('unit.manage'),
    canCreateProject: can('project.create'),
    canManageIssues: can('issue.create'),
    canManageRoles: can('role.manage'),
    canViewAllProjects: role === ROLES.SYSTEM_ADMIN,
    canViewOwnUnit: role === ROLES.DEPARTMENT_HEAD,
    canManageOwnProject: role === ROLES.PROJECT_MANAGER,
    isExternalUser: role === ROLES.EXTERNAL_USER,
    isSystemAdmin: role === ROLES.SYSTEM_ADMIN,
    isDepartmentHead: role === ROLES.DEPARTMENT_HEAD,
    isProjectManager: role === ROLES.PROJECT_MANAGER,
    isWorker: role === ROLES.WORKER,
    // Worker can view issues in their assigned project
    canViewOwnProject: [ROLES.PROJECT_MANAGER, ROLES.WORKER].includes(role),
  };
}
