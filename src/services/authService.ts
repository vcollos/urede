import { supabase, apiRequest } from '../utils/supabase/client';
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        throw new Error(`Erro de login: ${error.message}`);
      }

      // Buscar dados adicionais do usuário no backend
      const userData = await this.getCurrentUser();
      
      return {
        session: data.session,
        user: userData
      };
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
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw new Error(`Erro ao fazer logout: ${error.message}`);
      }
    } catch (error) {
      console.error('Erro no logout:', error);
      throw error;
    }
  }

  // Obter usuário atual
  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        return null;
      }

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
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        throw new Error(`Erro ao obter sessão: ${error.message}`);
      }

      return session;
    } catch (error) {
      console.error('Erro ao verificar sessão:', error);
      throw error;
    }
  }

  // Listener para mudanças no estado de autenticação
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }
}

export const authService = new AuthService();