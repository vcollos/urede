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

const isLoopbackHostname = (host: string) =>
  host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';

const isLoopbackUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return isLoopbackHostname(parsed.hostname);
  } catch {
    return false;
  }
};

const deriveApiBase = () => {
  const trimmed = envApiBaseUrl?.trim();
  const derived = deriveDefaultBase();

  if (!trimmed) return derived;

  // Se o frontend estiver aberto por IP/rede e o env apontar para loopback,
  // priorizamos a URL derivada para evitar chamadas locais inválidas no celular.
  if (typeof window !== 'undefined' && window.location) {
    const currentHost = window.location.hostname || '';
    if (!isLoopbackHostname(currentHost) && isLoopbackUrl(trimmed)) {
      return derived || trimmed.replace(/\/$/, '');
    }
  }

  return trimmed.replace(/\/$/, '');
};

const DEFAULT_API_BASE = deriveApiBase();

export const serverUrl = DEFAULT_API_BASE || '';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

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
    throw new ApiError(errorData.error || `Erro HTTP: ${response.status}`, response.status, errorData);
  }

  // Se a resposta não tiver corpo (204) ou não for JSON, evitar chamara response.json() que lança erro.
  const contentType = response.headers.get('content-type') || '';
  if (response.status === 204 || !contentType.includes('application/json')) {
    return {} as any;
  }

  return response.json();
};
