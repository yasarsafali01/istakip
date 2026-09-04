import { useAuth } from '../context/AuthContext';
import { ROLES } from '../utils/constants';

// Mirrors frontend/src/hooks/usePermissions.js.
export function usePermissions() {
  const { currentUser } = useAuth();
  const role = currentUser?.role;

  return {
    role,
    canManageUnits: role === ROLES.SYSTEM_ADMIN,
    canCreateProject: [ROLES.SYSTEM_ADMIN, ROLES.DEPARTMENT_HEAD].includes(role as any),
    canManageIssues: [ROLES.SYSTEM_ADMIN, ROLES.DEPARTMENT_HEAD, ROLES.PROJECT_MANAGER].includes(role as any),
    isExternalUser: role === ROLES.EXTERNAL_USER,
    isSystemAdmin: role === ROLES.SYSTEM_ADMIN,
    isDepartmentHead: role === ROLES.DEPARTMENT_HEAD,
    isProjectManager: role === ROLES.PROJECT_MANAGER,
    isWorker: role === ROLES.WORKER,
  };
}
