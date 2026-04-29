import { useAuth } from './useAuth';
import { ROLES } from '../constants';

export function usePermissions() {
  const { currentUser } = useAuth();
  const role = currentUser?.role;

  return {
    role,
    canManageUnits: role === ROLES.SYSTEM_ADMIN,
    canCreateProject: [ROLES.SYSTEM_ADMIN, ROLES.DEPARTMENT_HEAD].includes(role),
    canManageIssues: [ROLES.SYSTEM_ADMIN, ROLES.DEPARTMENT_HEAD, ROLES.PROJECT_MANAGER].includes(role),
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
