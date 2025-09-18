import { apiRequest, setAuthToken, clearAuthToken, getAuthToken } from '../utils/api/client';
import type { User } from '../types';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  nome: string;
  display_name: string;
  telefone: string;
  whatsapp: string;
  cargo: string;
  cooperativa_id: string;
  papel: 'admin' | 'operador' | 'federacao' | 'confederacao';
}

class AuthService {
  // Login com email e senha
  async login(credentials: LoginCredentials) {
    try {
      const res = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
        })
      });

      if (!res?.token) {
        throw new Error('Token não retornado pelo servidor');
      }

      setAuthToken(res.token);
      const user = await this.getCurrentUser();
      return { session: { access_token: res.token }, user };
    } catch (error) {
      console.error('Erro no login:', error);
      throw error;
    }
  }

  // Registro de novo usuário
  async register(registerData: RegisterData) {
    try {
      const response = await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(registerData),
      });
      if (response?.token) {
        setAuthToken(response.token);
      }
      return response;
    } catch (error) {
      console.error('Erro no registro:', error);
      throw error;
    }
  }

  // Logout
  async logout() {
    try {
      clearAuthToken();
    } catch (error) {
      console.error('Erro no logout:', error);
      throw error;
    }
  }

  // Obter usuário atual
  async getCurrentUser(): Promise<User | null> {
    try {
      const token = getAuthToken();
      if (!token) return null;
      const userData = await apiRequest('/auth/me');
      return userData.user;
    } catch (error) {
      console.error('Erro ao obter usuário atual:', error);
      return null;
    }
  }

  // Verificar se há sessão ativa
  async getSession() {
    try {
      const token = getAuthToken();
      return token ? { access_token: token } : null;
    } catch (error) {
      console.error('Erro ao verificar sessão:', error);
      throw error;
    }
  }

  // Listener para mudanças no estado de autenticação
  onAuthStateChange(callback: (event: string, session: any) => void) {
    // Stub para manter compatível com o AuthContext; dispara apenas eventos manuais
    const unsubscribe = () => {};
    // Opcionalmente, poderíamos escutar storage events para multi-aba
    return { data: { subscription: { unsubscribe } } } as any;
  }
}

export const authService = new AuthService();
