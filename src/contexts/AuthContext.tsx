import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService } from '../services/authService';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    nome: string;
    display_name: string;
    telefone: string;
    whatsapp: string;
    cargo: string;
    cooperativa_id: string;
    papel: 'admin' | 'operador' | 'federacao' | 'confederacao';
  }) => Promise<{ message: string; status?: string; autoApprove?: boolean }>;
  updateProfile: (data: Partial<Pick<User, 'nome' | 'display_name' | 'telefone' | 'whatsapp' | 'cargo'>>) => Promise<User | null>;
  changePassword: (data: { current_password?: string; new_password: string }) => Promise<void>;
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Verificar sessão existente ao carregar
  useEffect(() => {
    const checkSession = async () => {
      try {
        setIsLoading(true);
        const session = await authService.getSession();
        
        if (session) {
          const userData = await authService.getCurrentUser();
          setUser(userData);
        }
      } catch (error) {
        console.error('Erro ao verificar sessão:', error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();

    // Listener para mudanças no estado de autenticação
    const { data: { subscription } } = authService.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        try {
          const userData = await authService.getCurrentUser();
          setUser(userData);
        } catch (error) {
          console.error('Erro ao obter dados do usuário após login:', error);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const { user: userData } = await authService.login({ email, password });
      setUser(userData);
    } catch (error) {
      console.error('Erro no login:', error);
      if (error instanceof Error) {
        const code = error.message;
        let friendly = code;
        switch (code) {
          case 'pending_confirmation':
            friendly = 'Confirme seu e-mail antes de acessar o sistema.';
            break;
          case 'pending_approval':
            friendly = 'Sua conta está aguardando aprovação.';
            break;
          case 'pending_manual':
            friendly = 'Sua conta aguarda revisão manual. Aguarde contato.';
            break;
          case 'rejected':
            friendly = 'Sua solicitação foi rejeitada.';
            break;
          default:
            friendly = error.message;
        }
        throw new Error(friendly);
      }
      throw error as Error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await authService.logout();
      setUser(null);
    } catch (error) {
      console.error('Erro no logout:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: {
    email: string;
    password: string;
    nome: string;
    display_name: string;
    telefone: string;
    whatsapp: string;
    cargo: string;
    cooperativa_id: string;
    papel: 'admin' | 'operador' | 'federacao' | 'confederacao';
  }) => {
    try {
      setIsLoading(true);
      const response = await authService.register(data);
      return {
        message: response?.message || 'Cadastro realizado com sucesso.',
        status: response?.status,
        autoApprove: response?.autoApprove,
      };
    } catch (error) {
      console.error('Erro no registro:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (data: Partial<Pick<User, 'nome' | 'display_name' | 'telefone' | 'whatsapp' | 'cargo'>>) => {
    try {
      const updated = await authService.updateProfile(data);
      if (updated) {
        setUser(updated);
      }
      return updated ?? null;
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      throw error;
    }
  };

  const changePassword = async (data: { current_password?: string; new_password: string }) => {
    try {
      await authService.changePassword(data);
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      throw error;
    }
  };

  const refreshUser = async () => {
    try {
      const current = await authService.getCurrentUser();
      setUser(current);
      return current;
    } catch (error) {
      console.error('Erro ao atualizar sessão:', error);
      throw error;
    }
  };

  const value = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    register,
    updateProfile,
    changePassword,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
