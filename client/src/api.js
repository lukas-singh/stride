const TOKEN_KEY = 'stride_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

const CACHE_PREFIX = 'stride_cache:';

// Read-through cache so previously fetched GET data is viewable offline.
function cacheGet(path) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + path);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}
function cacheSet(path, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + path, JSON.stringify(data));
  } catch {
    /* quota — ignore */
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // network failure — serve cached GET if we have it
    if (method === 'GET') {
      const cached = cacheGet(path);
      if (cached !== undefined) return cached;
    }
    throw new Error('Network unavailable. Showing cached data where possible.');
  }

  if (res.status === 401) {
    setToken(null);
    window.dispatchEvent(new Event('stride:logout'));
    throw new Error('Session expired. Please log in again.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  if (method === 'GET') cacheSet(path, data);
  return data;
}
