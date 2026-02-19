const TOKEN_KEY = 'auth_token';

const deriveDefaultBase = () => {
  try {
    if (typeof window !== 'undefined' && window.location) {
      const protocol = window.location.protocol || 'http:';
      const hostname = window.location.hostname || '127.0.0.1';
      const port = 8300;
      const localHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0']);
      if (localHosts.has(hostname)) {
        return `${protocol}//127.0.0.1:${port}`;
      }
      return `${protocol}//${hostname}`;
    }
  } catch {
    // noop
  }
  return '';
};

const envBase = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;

export const API_BASE_URL = (envBase?.trim() || deriveDefaultBase()).replace(/\/$/, '');

export const getAuthToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const apiRequest = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const token = getAuthToken();
  const isGet = !options.method || options.method.toUpperCase() === 'GET';
  const url = /^https?:\/\//i.test(endpoint)
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(isGet ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: 'Erro inesperado' }));
    const detail = typeof payload?.details === 'string' ? payload.details.trim() : '';
    const base = payload?.error || `Erro HTTP ${response.status}`;
    throw new Error(detail ? `${base}: ${detail}` : base);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return {} as T;
  }

  return response.json() as Promise<T>;
};
