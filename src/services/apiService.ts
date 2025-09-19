import { apiRequest } from '../utils/api/client';
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
    // rota protegida
    return await apiRequest('/cooperativas');
  }

  // COOPERATIVAS PÚBLICAS (para registro)
  async getCooperativasPublic(): Promise<Cooperativa[]> {
    try {
      return await apiRequest('/cooperativas/public');
    } catch (error) {
      console.error('Erro ao buscar cooperativas públicas:', error);
      throw error;
    }
  }

  // CIDADES
  async getCidades(): Promise<Cidade[]> {
    return await apiRequest('/cidades');
  }

  // OPERADORES
  async getOperadores(): Promise<Operador[]> {
    return await apiRequest('/operadores');
  }

  async createOperador(data: {
    nome: string;
    email: string;
    cargo?: string;
    telefone?: string;
    whatsapp?: string;
    id_singular: string;
  }): Promise<Operador> {
    try {
      return await apiRequest('/operadores', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error('Erro ao criar operador:', error);
      throw error;
    }
  }

  async updateOperador(operadorId: string, updateData: Partial<Operador>): Promise<Operador> {
    try {
      return await apiRequest(`/operadores/${operadorId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
    } catch (error) {
      console.error('Erro ao atualizar operador:', error);
      throw error;
    }
  }

  // PEDIDOS
  async getPedidos(): Promise<Pedido[]> {
    return await apiRequest('/pedidos');
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

  async updatePedido(pedidoId: string, updateData: Partial<Pedido> & Record<string, unknown> = {}): Promise<Pedido> {
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

  async deletePedido(pedidoId: string): Promise<{ ok: boolean }> {
    try {
      return await apiRequest(`/pedidos/${pedidoId}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Erro ao excluir pedido:', error);
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
