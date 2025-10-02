// Configuração da API base (servidor local)
const envApiBaseUrl = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;

const deriveDefaultBase = () => {
  try {
    if (typeof window !== 'undefined' && window.location) {
      const proto = window.location.protocol || 'http:';
      const host = window.location.hostname || '127.0.0.1';
      const port = 8300;
      const portSuffix = `:${port}`;
      const isIp = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
      const localHosts = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

      if (localHosts.has(host)) {
        return `${proto}//127.0.0.1${portSuffix}`;
      }

      if (isIp) {
        return `${proto}//${host}${portSuffix}`;
      }

      if (host === 'urede.collos.com.br') {
        return `${proto}//apiurede.collos.com.br`;
      }

      if (host.endsWith('.collos.com.br')) {
        return `${proto}//api.${host}`;
      }

      const currentPort = window.location.port;
      if (currentPort && currentPort !== '80' && currentPort !== '443') {
        return `${proto}//${host}${portSuffix}`;
      }

      return `${proto}//${host}`;
    }
  } catch {}
  return '';
};

const DEFAULT_API_BASE = (envApiBaseUrl && envApiBaseUrl.trim())
  ? envApiBaseUrl.replace(/\/$/, '')
  : deriveDefaultBase();

export const serverUrl = DEFAULT_API_BASE || '';

// Armazenamento do token JWT local
const TOKEN_KEY = 'auth_token';

export const setAuthToken = (token: string) => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const getAuthToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const clearAuthToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

// Headers com Authorization: Bearer <token>
export const getAuthHeaders = async () => {
  const token = getAuthToken();
  return (
    token ? { 'Authorization': `Bearer ${token}` } : {}
  ) as Record<string, string>;
};

// Requisições autenticadas
export const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const headers = await getAuthHeaders();
  const base = serverUrl;
  const url = /^https?:\/\//i.test(endpoint) ? endpoint : (base ? `${base}${endpoint}` : endpoint);

  // Não definir Content-Type em GET para evitar preflight desnecessário
  const isGet = !options.method || options.method.toUpperCase() === 'GET';
  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(isGet ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
  }

  // Se a resposta não tiver corpo (204) ou não for JSON, evitar chamara response.json() que lança erro.
  const contentType = response.headers.get('content-type') || '';
  if (response.status === 204 || !contentType.includes('application/json')) {
    return {} as any;
  }

  return response.json();
};
