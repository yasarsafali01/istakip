import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { ROLES } from '../../constants';
import { DepartmentHeadHome, ProjectManagerHome } from './ManagerDashboards';
import { AdminHome, WorkerHome } from './StaffHomes';
import RequesterHome from './RequesterHome';

export default function Dashboard() {
  const { currentUser } = useAuth();
  const { role } = usePermissions();

  if (!currentUser) return null;

  switch (role) {
    case ROLES.DEPARTMENT_HEAD: return <DepartmentHeadHome currentUser={currentUser} />;
    case ROLES.PROJECT_MANAGER: return <ProjectManagerHome currentUser={currentUser} />;
    case ROLES.WORKER:          return <WorkerHome currentUser={currentUser} />;
    case ROLES.EXTERNAL_USER:   return <RequesterHome currentUser={currentUser} />;
    default:                    return <AdminHome currentUser={currentUser} />;
  }
}
