import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';
const REFRESH_TOKEN_KEY = 'istakip_refresh_token';

// Access token lives only in memory — lost on app restart, re-derived from
// the SecureStore-backed refresh token via restoreSession() on boot.
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export async function getRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setRefreshToken(token: string | null) {
  try {
    if (token) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
    } else {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    }
  } catch {
    // ignore storage failures
  }
}

export async function clearSession() {
  accessToken = null;
  await setRefreshToken(null);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let refreshPromise: Promise<string> | null = null;

async function doRefresh(): Promise<string> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) throw new ApiError('no refresh token', 401);

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    await clearSession();
    throw new ApiError('session expired', 401);
  }
  const data = await res.json();
  setAccessToken(data.accessToken);
  await setRefreshToken(data.refreshToken);
  return data.accessToken;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  retry?: boolean;
}

/**
 * Core request helper. On a 401, tries exactly one refresh + retry before
 * giving up (concurrent 401s share a single in-flight refresh call).
 */
export async function request<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, retry = true } = opts;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry && (await getRefreshToken())) {
    refreshPromise = refreshPromise || doRefresh().finally(() => {
      refreshPromise = null;
    });
    await refreshPromise;
    return request<T>(path, { method, body, retry: false });
  }

  if (res.status === 204) return null as T;

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // empty body
  }

  if (!res.ok) {
    throw new ApiError(data?.error || `İstek başarısız oldu (${res.status})`, res.status);
  }
  return data as T;
}

export const api = {
  get: <T = unknown>(path: string) => request<T>(path),
  post: <T = unknown>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T = unknown>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T = unknown>(path: string) => request<T>(path, { method: 'DELETE' }),
};
