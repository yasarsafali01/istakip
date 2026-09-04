import { useContext } from 'react';
import AppContext from '../context/AppContext';
import { ACTIONS, ROLE_DEFAULT_ROUTES } from '../constants';
import * as authApi from '../api/auth';

export function useAuth() {
  const { state, dispatch, hydrateAll } = useContext(AppContext);
  const { auth } = state;

  const currentUser = auth?.currentUser || null;

  async function login(email, password) {
    const user = await authApi.login(email, password);
    dispatch({ type: ACTIONS.LOGIN, payload: user });
    await hydrateAll();
    return user;
  }

  async function logout() {
    await authApi.logout();
    dispatch({ type: ACTIONS.LOGOUT });
  }

  function getDefaultRoute() {
    if (!currentUser) return '/login';
    return ROLE_DEFAULT_ROUTES[currentUser.role] || '/dashboard';
  }

  return {
    currentUser,
    isAuthenticated: auth?.isAuthenticated || false,
    loading: state.loading,
    login,
    logout,
    getDefaultRoute,
  };
}
