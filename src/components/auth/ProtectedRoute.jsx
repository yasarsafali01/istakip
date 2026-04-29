import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

/**
 * Oturum açmamış kullanıcıları /login'e yönlendirir.
 * allowedRoles belirtilmişse, yetkisiz rolleri /dashboard'a yönlendirir.
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, currentUser } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && currentUser && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
