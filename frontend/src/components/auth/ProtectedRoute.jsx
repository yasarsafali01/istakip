import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';

/**
 * Oturum açmamış kullanıcıları /login'e yönlendirir.
 * allowedRoles belirtilmişse, yetkisiz rolleri /dashboard'a yönlendirir.
 * permission belirtilmişse, o izne sahip olmayanları /dashboard'a yönlendirir.
 */
export default function ProtectedRoute({ children, allowedRoles, permission }) {
  const { isAuthenticated, currentUser, loading } = useAuth();
  const { can } = usePermissions();
  const location = useLocation();

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '100vh' }}>
        <span className="spinner-border text-primary" role="status" aria-hidden="true" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && currentUser && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (permission && !can(permission)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
