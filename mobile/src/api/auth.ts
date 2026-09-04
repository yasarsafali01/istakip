import { api, request, setAccessToken, setRefreshToken, getRefreshToken, clearSession } from './client';
import type { User } from './types';

export async function login(email: string, password: string): Promise<User> {
  const data = await request<{ accessToken: string; refreshToken: string; user: User }>('/auth/login', {
    method: 'POST',
    body: { email, password },
    retry: false,
  });
  setAccessToken(data.accessToken);
  await setRefreshToken(data.refreshToken);
  return data.user;
}

export async function logout(): Promise<void> {
  const refreshToken = await getRefreshToken();
  await clearSession();
  if (refreshToken) {
    try {
      await request('/auth/logout', { method: 'POST', body: { refreshToken }, retry: false });
    } catch {
      // best-effort — session is already cleared client-side
    }
  }
}

/** Restores a session on app launch using the SecureStore-persisted refresh token. */
export async function restoreSession(): Promise<User | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  try {
    const data = await request<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      retry: false,
    });
    setAccessToken(data.accessToken);
    await setRefreshToken(data.refreshToken);
    return api.get<User>('/users/me');
  } catch {
    return null;
  }
}
