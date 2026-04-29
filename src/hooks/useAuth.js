import { useContext } from 'react';
import AppContext from '../context/AppContext';
import { ACTIONS, ROLE_DEFAULT_ROUTES } from '../constants';
import { validateCredentials } from '../utils/authUtils';

export function useAuth() {
  const { state, dispatch } = useContext(AppContext);
  const { auth, users } = state;

  const currentUser = auth?.currentUser
    ? users.find(u => u.id === auth.currentUser.id) || null
    : null;

  function login(email, password) {
    const result = validateCredentials(users, email, password);
    if (!result.success) {
      throw new Error(result.error);
    }
    const { user } = result;
    dispatch({
      type: ACTIONS.LOGIN,
      payload: { id: user.id, role: user.role, unitId: user.unitId },
    });
    return user;
  }

  function logout() {
    dispatch({ type: ACTIONS.LOGOUT });
  }

  function getDefaultRoute() {
    if (!currentUser) return '/login';
    return ROLE_DEFAULT_ROUTES[currentUser.role] || '/dashboard';
  }

  return {
    currentUser,
    isAuthenticated: auth?.isAuthenticated || false,
    login,
    logout,
    getDefaultRoute,
  };
}
