import { apiRequest, setAuthToken, clearAuthToken, getAuthToken } from '../utils/api/client';
import type { User, PendingUserApproval } from '../types';

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

  async updateProfile(data: Partial<Pick<User, 'nome' | 'display_name' | 'telefone' | 'whatsapp' | 'cargo'>>): Promise<User | null> {
    try {
      const response = await apiRequest('/auth/me', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      return response?.user ?? null;
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      throw error;
    }
  }

  async changePassword(data: { current_password?: string; new_password: string }): Promise<void> {
    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      throw error;
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

  async confirmEmail(token: string): Promise<{ message: string; status?: string }> {
    try {
      return await apiRequest('/auth/confirm-email', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
    } catch (error) {
      console.error('Erro ao confirmar email:', error);
      throw error;
    }
  }

  async getPendingApprovals(): Promise<PendingUserApproval[]> {
    try {
      const result = await apiRequest('/auth/pending');
      return Array.isArray(result) ? result : [];
    } catch (error) {
      console.error('Erro ao carregar aprovações pendentes:', error);
      throw error;
    }
  }

  async approvePending(id: string, notes?: string): Promise<void> {
    try {
      await apiRequest(`/auth/pending/${id}/approve`, {
        method: 'POST',
        body: notes ? JSON.stringify({ notes }) : undefined,
      });
    } catch (error) {
      console.error('Erro ao aprovar usuário:', error);
      throw error;
    }
  }

  async rejectPending(id: string, notes?: string): Promise<void> {
    try {
      await apiRequest(`/auth/pending/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ notes: notes || '' }),
      });
    } catch (error) {
      console.error('Erro ao rejeitar usuário:', error);
      throw error;
    }
  }
}

export const authService = new AuthService();
