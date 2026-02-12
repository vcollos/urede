// Tipos do sistema de gestão Uniodonto

export interface User {
  id: string;
  nome: string;
  display_name: string;
  email: string;
  telefone: string;
  whatsapp: string;
  cargo: string;
  cooperativa_id: string;
  papel: 'admin' | 'operador' | 'federacao' | 'confederacao';
  ativo: boolean;
  data_cadastro: string;
  approval_status?: 'pending_confirmation' | 'pending_approval' | 'pending_manual' | 'approved' | 'rejected';
  email_confirmed_at?: string | null;
  approval_requested_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  requested_papel?: 'admin' | 'operador' | 'federacao' | 'confederacao' | null;
  must_change_password?: boolean;
}

export interface Cooperativa {
  id_singular: string;
  uniodonto: string;
  cnpj: string;
  cro_operadora: string;
  data_fundacao: string;
  raz_social: string;
  codigo_ans: string;
  federacao: string;
  software: string;
  tipo: 'SINGULAR' | 'FEDERACAO' | 'CONFEDERACAO';
  tipo_label?: string;
  op_pr: 'Operadora' | 'Institucional';
}

export interface Cidade {
  cd_municipio_7: string;
  cd_municipio: string;
  regional_saude: string;
  nm_cidade: string;
  uf_municipio: string;
  nm_regiao: string;
  cidades_habitantes: number;
  id_singular: string;
  id_singular_credenciamento?: string | null;
  id_singular_vendas?: string | null;
  reg_ans?: string | null;
  nm_singular?: string | null;
}

export interface Operador {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  whatsapp: string;
  cargo: string;
  id_singular: string;
  ativo: boolean;
  data_cadastro: string;
  papel?: 'operador' | 'admin' | 'federacao' | 'confederacao';
}

export interface Pedido {
  id: string;
  titulo: string;
  criado_por: string; // ID do operador que criou
  criado_por_user?: string | null;
  cooperativa_solicitante_id: string; // id_singular da cooperativa
  cooperativa_solicitante_nome?: string;
  cooperativa_responsavel_nome?: string;
  cidade_id: string; // cd_municipio_7
  cidade_nome?: string;
  estado?: string;
  especialidades: string[];
  quantidade: number;
  beneficiarios_quantidade?: number | null;
  observacoes: string;
  motivo_categoria?: string | null;
  nivel_atual: 'singular' | 'federacao' | 'confederacao';
  prazo_atual: string;
  status: 'novo' | 'em_andamento' | 'concluido' | 'cancelado';
  data_criacao: string;
  data_ultima_alteracao: string;
  responsavel_atual_id?: string; // ID do operador responsável
  responsavel_atual_nome?: string;
  cooperativa_responsavel_id?: string; // id_singular da cooperativa responsável
  dias_restantes: number;
  data_conclusao?: string | null;
  dias_para_concluir?: number;
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
  ponto_de_vista?: 'feita' | 'recebida' | 'acompanhamento' | 'interna';
  excluido?: boolean;
}

export type AlertaTipo = 'novo' | 'comentario' | 'status' | 'nivel' | 'responsavel' | 'atualizacao';

export interface Alerta {
  id: string;
  pedido_id: string;
  pedido_titulo: string;
  tipo: AlertaTipo;
  mensagem: string;
  detalhes?: string | null;
  lido: boolean;
  criado_em: string;
  disparado_por_email?: string | null;
  disparado_por_nome?: string | null;
}

export interface CooperativaConfig {
  cooperativa_id: string;
  nome: string;
  tipo: 'SINGULAR' | 'FEDERACAO' | 'CONFEDERACAO';
  auto_recusar: boolean;
}

export interface AuditoriaLog {
  id: string;
  pedido_id: string;
  usuario_id: string;
  usuario_nome: string;
  usuario_display_nome?: string;
  acao: string;
  timestamp: string;
  detalhes?: string;
}

export interface DashboardStats {
  total_pedidos: number;
  pedidos_vencendo: number;
  pedidos_em_andamento: number;
  pedidos_concluidos: number;
  sla_cumprido: number;
}

export interface CoberturaLog {
  id: string;
  cidade_id: string;
  cidade_nome: string | null;
  cidade_uf: string | null;
  cooperativa_origem: string | null;
  cooperativa_origem_nome: string | null;
  cooperativa_destino: string | null;
  cooperativa_destino_nome: string | null;
  usuario_email: string;
  usuario_nome: string;
  usuario_papel: string;
  detalhes?: string | null;
  timestamp: string;
}

export interface PendingUserApproval {
  id: string;
  email: string;
  nome: string;
  cooperativa_id: string | null;
  cooperativa_nome: string | null;
  requested_papel: 'admin' | 'operador' | 'federacao' | 'confederacao';
  approval_status: string;
  created_at: string;
}

export interface DiretorPhoneAccessRequest {
  id: string;
  cooperativa_id: string;
  diretor_id: string;
  diretor_nome: string;
  diretor_cargo?: string | null;
  requester_email: string;
  requester_nome: string;
  requester_cooperativa_id?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  motivo?: string | null;
  created_at: string;
  decided_at?: string | null;
  decided_by?: string | null;
  decision_notes?: string | null;
}

export interface SystemSettings {
  theme: 'light' | 'dark' | 'system';
  deadlines: {
    singularToFederacao: number;
    federacaoToConfederacao: number;
  };
  requireApproval: boolean;
  autoNotifyManagers: boolean;
  enableSelfRegistration: boolean;
  pedido_motivos: string[];
}

export interface PedidoImportPayloadItem {
  rowNumber: number;
  titulo: string;
  especialidade: string;
  cidadeCodigo: string;
  responsavelEmail?: string;
  detalhes?: string;
}

export interface PedidoImportPayload {
  items: PedidoImportPayloadItem[];
  meta?: {
    originalFilename?: string;
    mapping?: Record<string, string | null>;
  };
}

export interface PedidoImportError {
  rowNumber: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface PedidoImportSummary {
  total: number;
  imported: number;
  skipped: number;
  durationMs: number;
}

export interface PedidoImportResponse {
  summary: PedidoImportSummary;
  errors: PedidoImportError[];
  imported: Pedido[];
}

export interface ReportsOverviewRange {
  start: string;
  end: string;
}

export interface ReportCreationPoint {
  date: string;
  total: number;
  concluidos: number;
}

export interface ReportResponseEntry {
  cooperativa_id: string | null;
  cooperativa_nome?: string | null;
  total: number;
  responded: number;
  tempo_medio_min: number | null;
}

export interface ReportsOverview {
  range: ReportsOverviewRange;
  creationSeries: ReportCreationPoint[];
  responseByCooperativa: ReportResponseEntry[];
  statusBreakdown: Record<string, number>;
  nivelResumo: Record<string, number>;
  performanceSummary: {
    totalPedidos: number;
    mediaRespostaMin: number | null;
    mediaConclusaoMin: number | null;
    concluido: number;
    em_andamento: number;
    novo: number;
    cancelado: number;
  };
}
