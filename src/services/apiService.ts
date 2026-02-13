import { apiRequest } from '../utils/api/client';
import type {
  Pedido,
  Cooperativa,
  Cidade,
  Operador,
  AuditoriaLog,
  DashboardStats,
  CoberturaLog,
  CooperativaOverviewLog,
  SystemSettings,
  Alerta,
  CooperativaConfig,
  PedidoImportPayload,
  PedidoImportResponse,
  ReportsOverview,
  DiretorPhoneAccessRequest,
} from '../types';

const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  theme: 'light',
  deadlines: {
    singularToFederacao: 30,
    federacaoToConfederacao: 30,
  },
  requireApproval: true,
  autoNotifyManagers: true,
  enableSelfRegistration: true,
  pedido_motivos: [],
  hub_cadastros: {
    tipos_endereco: ['Sede', 'Filial', 'Núcleo', 'Clínica', 'Ponto de Venda', 'Plantão de Urgência & Emergência', 'Atendimento'],
    tipos_conselho: ['Fiscal', 'Administrativo', 'Técnico'],
    tipos_contato: ['E-mail', 'Telefone', 'Website', 'Rede social', 'Outro'],
    subtipos_contato: [
      'LGPD',
      'Plantão',
      'Geral',
      'Emergência',
      'Divulgação',
      'Comercial PF',
      'Comercial PJ',
      'Institucional',
      'Portal do Prestador',
      'Portal do Cliente',
      'Portal da Empresa',
      'Portal do Corretor',
      'E-Commerce',
      'Portal do Cooperado',
    ],
    redes_sociais: ['Instagram', 'Facebook', 'LinkedIn', 'YouTube', 'TikTok', 'X'],
    departamentos: ['INTERCÂMBIO', 'COMERCIAL', 'ATENDIMENTO', 'FINANCEIRO'],
  },
};

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

  async getCooperativaOverviewHistorico(cooperativaId: string, limit = 200): Promise<CooperativaOverviewLog[]>
  {
    const result = await apiRequest(`/cooperativas/${cooperativaId}/overview/historico?limit=${limit}`);
    return result?.logs ?? [];
  }

  async updateCooperativaOverview(
    cooperativaId: string,
    data: {
      cnpj?: string;
      codigo_ans?: string;
      data_fundacao?: string;
      federacao?: string;
      software?: string;
      raz_social?: string;
      website?: string;
    },
  ): Promise<{ cooperativa: Cooperativa; website: string | null }>
  {
    return await apiRequest(`/cooperativas/${cooperativaId}/overview`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
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
    wpp?: boolean;
    id_singular: string;
    cooperativas_ids?: string[];
    cooperativa_principal_id?: string;
    senha_temporaria?: string;
    forcar_troca_senha?: boolean;
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

  async updateOperador(
    operadorId: string,
    updateData: Partial<Operador> & {
      senha_temporaria?: string;
      forcar_troca_senha?: boolean;
    }
  ): Promise<Operador> {
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

  // COOPERATIVAS (AUXILIARES)
  async getCooperativaAux<T = any>(cooperativaId: string, resource: string): Promise<T[]> {
    return await apiRequest(`/cooperativas/${cooperativaId}/aux/${resource}`);
  }

  async createCooperativaAuxItem<T = any>(
    cooperativaId: string,
    resource: string,
    data: Record<string, unknown>,
  ): Promise<T> {
    return await apiRequest(`/cooperativas/${cooperativaId}/aux/${resource}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCooperativaAuxItem<T = any>(
    cooperativaId: string,
    resource: string,
    itemId: string,
    data: Record<string, unknown>,
  ): Promise<T> {
    return await apiRequest(`/cooperativas/${cooperativaId}/aux/${resource}/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCooperativaAuxItem(
    cooperativaId: string,
    resource: string,
    itemId: string,
  ): Promise<void> {
    await apiRequest(`/cooperativas/${cooperativaId}/aux/${resource}/${itemId}`, {
      method: 'DELETE',
    });
  }

  async importCooperativaAux(
    cooperativaId: string,
    resource: string,
    items: Record<string, unknown>[],
    mode: 'replace' | 'append' = 'replace',
  ): Promise<{ ok: boolean; inserted?: number }> {
    return await apiRequest(`/cooperativas/${cooperativaId}/aux/${resource}/import?mode=${mode}`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  }

  async importCooperativaAuxBulk(
    resource: string,
    items: Record<string, unknown>[],
    mode: 'replace' | 'append' = 'replace',
  ): Promise<{ ok: boolean; inserted?: number; targets?: Record<string, { inserted: number }>; denied?: string[] }> {
    return await apiRequest(`/admin/gestao-dados/aux/${resource}/import?mode=${mode}`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  }

  async requestDiretorPhoneAccess(
    cooperativaId: string,
    diretorId: string,
    motivo?: string,
  ): Promise<{ ok?: boolean; id?: string; status?: string; message?: string }> {
    return await apiRequest(`/cooperativas/${cooperativaId}/diretores/${diretorId}/solicitar-celular`, {
      method: 'POST',
      body: JSON.stringify({ motivo: motivo || '' }),
    });
  }

  async getDiretorPhoneAccessRequests(
    cooperativaId: string,
    status: 'pending' | 'approved' | 'rejected' | 'all' = 'pending',
  ): Promise<DiretorPhoneAccessRequest[]> {
    const result = await apiRequest(`/cooperativas/${cooperativaId}/diretores/celular-requests?status=${status}`);
    return Array.isArray(result) ? result : [];
  }

  async approveDiretorPhoneAccessRequest(
    cooperativaId: string,
    requestId: string,
    notes?: string,
  ): Promise<void> {
    await apiRequest(`/cooperativas/${cooperativaId}/diretores/celular-requests/${requestId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ notes: notes || '' }),
    });
  }

  async rejectDiretorPhoneAccessRequest(
    cooperativaId: string,
    requestId: string,
    notes?: string,
  ): Promise<void> {
    await apiRequest(`/cooperativas/${cooperativaId}/diretores/celular-requests/${requestId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ notes: notes || '' }),
    });
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
    return response?.settings ?? DEFAULT_SYSTEM_SETTINGS;
  }

  async updateSystemSettings(settings: SystemSettings): Promise<SystemSettings> {
    const response = await apiRequest('/configuracoes/sistema', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
    return response?.settings ?? settings;
  }

  async getReportsOverview(params?: { start?: string; end?: string }): Promise<ReportsOverview> {
    const searchParams = new URLSearchParams();
    if (params?.start) searchParams.set('start', params.start);
    if (params?.end) searchParams.set('end', params.end);
    const qs = searchParams.toString();
    return await apiRequest(`/reports/overview${qs ? `?${qs}` : ''}`);
  }
}

export const apiService = new ApiService();
