import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

// Permite configuração via .env (Vite) com fallback para valores do arquivo info.tsx
const envSupabaseUrl = (import.meta as any)?.env?.VITE_SUPABASE_URL as string | undefined;
const envAnonKey = (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY as string | undefined;
const envApiBaseUrl = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;

const SUPABASE_URL = (envSupabaseUrl && envSupabaseUrl.trim())
  ? envSupabaseUrl.replace(/\/$/, '')
  : `https://${projectId}.supabase.co`;

const SUPABASE_ANON_KEY = (envAnonKey && envAnonKey.trim())
  ? envAnonKey
  : publicAnonKey;

// Cliente Supabase para autenticação e operações do frontend
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Base das Edge Functions.
// Por padrão aponta para a função 'server' com prefixo de rotas 'make-server-96c6e32f'.
// Para rodar local, defina VITE_API_BASE_URL por exemplo como:
//   http://127.0.0.1:54321/functions/v1/server
const DEFAULT_API_BASE = `${SUPABASE_URL}/functions/v1/server`;

// URL base para o servidor backend
export const serverUrl = (envApiBaseUrl && envApiBaseUrl.trim())
  ? envApiBaseUrl.replace(/\/$/, '')
  : DEFAULT_API_BASE;

// Função para obter headers de autorização
export const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  
  return {
    'Content-Type': 'application/json',
    'Authorization': session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${SUPABASE_ANON_KEY}`,
    'apikey': SUPABASE_ANON_KEY,
  };
};

// Função para fazer requisições autenticadas ao servidor
export const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  // Dev-only diagnostics to aid deploy/debug
  if ((import.meta as any)?.env?.DEV && !(globalThis as any).__SUPA_DEBUG_PRINTED__) {
    (globalThis as any).__SUPA_DEBUG_PRINTED__ = true;
    try {
      console.info('[Supabase] URL:', SUPABASE_URL);
      console.info('[API Base] serverUrl:', serverUrl);
    } catch {}
  }

  const headers = await getAuthHeaders();
  
  const response = await fetch(`${serverUrl}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
  }

  return response.json();
};
