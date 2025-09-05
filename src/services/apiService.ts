import { apiRequest } from '../utils/supabase/client';
import { serverUrl, getAuthHeaders } from '../utils/supabase/client';
import type { 
  Pedido, 
  Cooperativa, 
  Cidade, 
  Operador, 
  AuditoriaLog,
  DashboardStats 
} from '../types';

class ApiService {
  // COOPERATIVAS
  async getCooperativas(): Promise<Cooperativa[]> {
    try {
      return await apiRequest('/cooperativas');
    } catch (error) {
      console.error('Erro ao buscar cooperativas:', error);
      throw error;
    }
  }

  // COOPERATIVAS PÚBLICAS (para registro)
  async getCooperativasPublic(): Promise<Cooperativa[]> {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${serverUrl}/cooperativas/public`, {
        method: 'GET',
        headers: {
          ...headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(errorData.error || `Erro HTTP: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('Erro ao buscar cooperativas públicas:', error);
      throw error;
    }
  }

  // CIDADES
  async getCidades(): Promise<Cidade[]> {
    try {
      return await apiRequest('/cidades');
    } catch (error) {
      console.error('Erro ao buscar cidades:', error);
      throw error;
    }
  }

  // OPERADORES
  async getOperadores(): Promise<Operador[]> {
    try {
      return await apiRequest('/operadores');
    } catch (error) {
      console.error('Erro ao buscar operadores:', error);
      throw error;
    }
  }

  // PEDIDOS
  async getPedidos(): Promise<Pedido[]> {
    try {
      return await apiRequest('/pedidos');
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error);
      throw error;
    }
  }

  async createPedido(pedidoData: {
    titulo: string;
    cidade_id: string;
    especialidades: string[];
    quantidade: number;
    observacoes: string;
    prioridade?: 'baixa' | 'media' | 'alta' | 'urgente';
  }): Promise<Pedido> {
    try {
      return await apiRequest('/pedidos', {
        method: 'POST',
        body: JSON.stringify(pedidoData),
      });
    } catch (error) {
      console.error('Erro ao criar pedido:', error);
      throw error;
    }
  }

  async updatePedido(pedidoId: string, updateData: Partial<Pedido>): Promise<Pedido> {
    try {
      return await apiRequest(`/pedidos/${pedidoId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
    } catch (error) {
      console.error('Erro ao atualizar pedido:', error);
      throw error;
    }
  }

  async getPedidoAuditoria(pedidoId: string): Promise<AuditoriaLog[]> {
    try {
      return await apiRequest(`/pedidos/${pedidoId}/auditoria`);
    } catch (error) {
      console.error('Erro ao buscar auditoria do pedido:', error);
      throw error;
    }
  }

  // DASHBOARD
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      return await apiRequest('/dashboard/stats');
    } catch (error) {
      console.error('Erro ao buscar estatísticas do dashboard:', error);
      throw error;
    }
  }

  // ADMIN
  async executeEscalonamento(): Promise<{ message: string }> {
    try {
      return await apiRequest('/admin/escalar-pedidos', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Erro ao executar escalonamento:', error);
      throw error;
    }
  }
}

export const apiService = new ApiService();
