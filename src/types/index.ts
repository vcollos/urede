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
  cooperativa_solicitante_id: string; // id_singular da cooperativa
  cooperativa_solicitante_nome?: string;
  cooperativa_responsavel_nome?: string;
  cidade_id: string; // cd_municipio_7
  cidade_nome?: string;
  estado?: string;
  especialidades: string[];
  quantidade: number;
  observacoes: string;
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

export interface SystemSettings {
  theme: 'light' | 'dark' | 'system';
  deadlines: {
    singularToFederacao: number;
    federacaoToConfederacao: number;
  };
  requireApproval: boolean;
  autoNotifyManagers: boolean;
  enableSelfRegistration: boolean;
}
