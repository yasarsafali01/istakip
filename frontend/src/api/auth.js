import { api, request, setAccessToken, setRefreshToken, getRefreshToken, clearSession } from './client';

export async function login(email, password) {
  const data = await request('/auth/login', { method: 'POST', body: { email, password }, retry: false });
  setAccessToken(data.accessToken);
  setRefreshToken(data.refreshToken);
  return data.user;
}

export async function logout() {
  const refreshToken = getRefreshToken();
  clearSession();
  if (refreshToken) {
    try {
      await request('/auth/logout', { method: 'POST', body: { refreshToken }, retry: false });
    } catch {
      // best-effort — session is already cleared client-side
    }
  }
}

/** Restores a session on app load using the persisted refresh token. */
export async function restoreSession() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const data = await request('/auth/refresh', { method: 'POST', body: { refreshToken }, retry: false });
  setAccessToken(data.accessToken);
  setRefreshToken(data.refreshToken);
  return api.get('/users/me');
}
