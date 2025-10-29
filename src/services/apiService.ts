import { apiRequest } from '../utils/api/client';
import type {
  Pedido,
  Cooperativa,
  Cidade,
  Operador,
  AuditoriaLog,
  DashboardStats,
  CoberturaLog,
  SystemSettings,
  Alerta,
  CooperativaConfig,
  PedidoImportPayload,
  PedidoImportResponse,
} from '../types';

class ApiService {
  // COOPERATIVAS
  async getCooperativas(): Promise<Cooperativa[]> {
    // rota protegida
    return await apiRequest('/cooperativas');
  }

  async updateCooperativaCobertura(cooperativaId: string, cidadeIds: string[]): Promise<{ message?: string; updated: Cidade[] }>
  {
    return await apiRequest(`/cooperativas/${cooperativaId}/cobertura`, {
      method: 'PUT',
      body: JSON.stringify({ cidade_ids: cidadeIds })
    });
  }

  async getCooperativaCoberturaHistorico(cooperativaId: string, limit = 200): Promise<CoberturaLog[]>
  {
    const result = await apiRequest(`/cooperativas/${cooperativaId}/cobertura/historico?limit=${limit}`);
    return result?.logs ?? [];
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

  async getPedidoById(pedidoId: string): Promise<Pedido> {
    return await apiRequest(`/pedidos/${pedidoId}`);
  }

  async createPedido(pedidoData: {
    titulo: string;
    cidade_id: string;
    especialidades: string[];
    quantidade: number;
    observacoes: string;
    prioridade?: 'baixa' | 'media' | 'alta' | 'urgente';
    motivo_categoria?: string | null;
    beneficiarios_quantidade?: number | null;
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

  async transferirPedido(pedidoId: string, motivo?: string): Promise<Pedido> {
    try {
      return await apiRequest(`/pedidos/${pedidoId}/transferir`, {
        method: 'POST',
        body: motivo ? JSON.stringify({ motivo }) : undefined,
      });
    } catch (error) {
      console.error('Erro ao transferir pedido:', error);
      throw error;
    }
  }

  async deletePedido(pedidoId: string): Promise<Pedido> {
    try {
      return await apiRequest(`/pedidos/${pedidoId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'cancelado', excluido: true }),
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

  async importPedidos(payload: PedidoImportPayload): Promise<PedidoImportResponse> {
    try {
      return await apiRequest('/pedidos/import', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('Erro ao importar pedidos:', error);
      throw error;
    }
  }

  async getAlertas(limit = 50): Promise<Alerta[]> {
    try {
      const response = await apiRequest(`/alertas?limit=${limit}`);
      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error('Erro ao buscar alertas:', error);
      throw error;
    }
  }

  async marcarAlertaComoLido(alertaId: string, lido = true): Promise<void> {
    try {
      await apiRequest(`/alertas/${alertaId}/lido`, {
        method: 'POST',
        body: JSON.stringify({ lido }),
      });
    } catch (error) {
      console.error('Erro ao marcar alerta como lido:', error);
      throw error;
    }
  }

  async marcarTodosAlertasComoLidos(): Promise<void> {
    try {
      await apiRequest('/alertas/marcar-todos', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Erro ao marcar todos os alertas como lidos:', error);
      throw error;
    }
  }

  async getCooperativaConfig(cooperativaId: string): Promise<CooperativaConfig> {
    try {
      return await apiRequest(`/cooperativas/${cooperativaId}/config`);
    } catch (error) {
      console.error('Erro ao carregar configurações da cooperativa:', error);
      throw error;
    }
  }

  async updateCooperativaConfig(cooperativaId: string, data: { auto_recusar: boolean }): Promise<CooperativaConfig> {
    try {
      return await apiRequest(`/cooperativas/${cooperativaId}/config`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error('Erro ao atualizar configurações da cooperativa:', error);
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

  // CONFIGURAÇÕES
  async getSystemSettings(): Promise<SystemSettings> {
    const response = await apiRequest('/configuracoes/sistema');
    return response?.settings ?? null;
  }

  async updateSystemSettings(settings: SystemSettings): Promise<SystemSettings> {
    const response = await apiRequest('/configuracoes/sistema', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
    return response?.settings ?? settings;
  }
}

export const apiService = new ApiService();
