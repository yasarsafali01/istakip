const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';
const REFRESH_TOKEN_KEY = 'istakip_refresh_token';

// Access token lives only in memory (module-level) — never persisted, so a
// leaked localStorage/XSS payload can't lift it. Losing it on a hard reload
// is fine: restoreSession() re-derives it from the refresh token on boot.
let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getRefreshToken() {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setRefreshToken(token) {
  try {
    if (token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  } catch {
    // ignore storage failures (private mode etc.)
  }
}

export function clearSession() {
  accessToken = null;
  setRefreshToken(null);
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

let refreshPromise = null;

async function doRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new ApiError('no refresh token', 401);

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    clearSession();
    throw new ApiError('session expired', 401);
  }
  const data = await res.json();
  setAccessToken(data.accessToken);
  setRefreshToken(data.refreshToken);
  return data.accessToken;
}

/**
 * Core request helper. On a 401, tries exactly one refresh + retry before
 * giving up (concurrent 401s share a single in-flight refresh call).
 */
export async function request(path, { method = 'GET', body, retry = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry && getRefreshToken()) {
    refreshPromise = refreshPromise || doRefresh().finally(() => {
      refreshPromise = null;
    });
    try {
      await refreshPromise;
    } catch (err) {
      throw err;
    }
    return request(path, { method, body, retry: false });
  }

  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch {
    // empty body
  }

  if (!res.ok) {
    throw new ApiError(data?.error || `İstek başarısız oldu (${res.status})`, res.status);
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
};

export { ApiError };
