import { User, Cooperativa, Cidade, Operador, Pedido, AuditoriaLog, DashboardStats } from '../types';

export const mockCidades: Cidade[] = [
  {
    cd_municipio_7: '5200050',
    cd_municipio: '520005',
    regional_saude: 'Central',
    nm_cidade: 'Abadia de Goiás',
    uf_municipio: 'GO',
    nm_regiao: 'Centro-Oeste',
    cidades_habitantes: 9158,
    id_singular: '020'
  },
  {
    cd_municipio_7: '3100104',
    cd_municipio: '310010',
    regional_saude: 'Uberlândia',
    nm_cidade: 'Abadia dos Dourados',
    uf_municipio: 'MG',
    nm_regiao: 'Sudeste',
    cidades_habitantes: 7022,
    id_singular: '045'
  },
  {
    cd_municipio_7: '5200100',
    cd_municipio: '520010',
    regional_saude: 'Pirineus',
    nm_cidade: 'Abadiânia',
    uf_municipio: 'GO',
    nm_regiao: 'Centro-Oeste',
    cidades_habitantes: 20873,
    id_singular: '020'
  },
  {
    cd_municipio_7: '3500105',
    cd_municipio: '350010',
    regional_saude: 'São Paulo Capital',
    nm_cidade: 'São Paulo',
    uf_municipio: 'SP',
    nm_regiao: 'Sudeste',
    cidades_habitantes: 12396372,
    id_singular: '010'
  },
  {
    cd_municipio_7: '3304557',
    cd_municipio: '330455',
    regional_saude: 'Metropolitana I',
    nm_cidade: 'Rio de Janeiro',
    uf_municipio: 'RJ',
    nm_regiao: 'Sudeste',
    cidades_habitantes: 6747815,
    id_singular: '015'
  }
];

export const mockCooperativas: Cooperativa[] = [
  {
    id_singular: '801',
    uniodonto: 'FEDERAÇÃO RS',
    cnpj: '72.120.124/0001-11',
    cro_operadora: '1100 RS',
    data_fundacao: '29/11/1991',
    raz_social: 'UNIODONTO RS FEDERAÇÃO DAS UNIODONTOS DO RS LTDA.',
    codigo_ans: '305421',
    federacao: 'BRASIL',
    software: 'OBJETIVA',
    tipo: 'FEDERACAO',
    op_pr: 'Operadora'
  },
  {
    id_singular: '800',
    uniodonto: 'FEDERAÇÃO MINAS',
    cnpj: '01.182.248/0001-83',
    cro_operadora: 'EPAO-1089',
    data_fundacao: '15/01/1996',
    raz_social: 'FEDERAÇÃO DAS UNIODONTOS DO ESTADO DE MINAS GERAIS',
    codigo_ans: '344583',
    federacao: 'BRASIL',
    software: 'ODONTOSFERA',
    tipo: 'FEDERACAO',
    op_pr: 'Operadora'
  },
  {
    id_singular: '805',
    uniodonto: 'FEDERAÇÃO AMAZÔNIA DO BRASIL',
    cnpj: '32.085.871/0001-41',
    cro_operadora: '',
    data_fundacao: '10/08/2018',
    raz_social: 'FEDERAÇÃO DAS COOPERATIVAS UNIODONTO DA AMAZÔNIA DO BRASIL',
    codigo_ans: '',
    federacao: 'BRASIL',
    software: '',
    tipo: 'FEDERACAO',
    op_pr: 'Institucional'
  },
  {
    id_singular: '010',
    uniodonto: 'UNIODONTO SP CAPITAL',
    cnpj: '60.196.097/0001-14',
    cro_operadora: 'SP CD-230',
    data_fundacao: '12/03/1985',
    raz_social: 'COOPERATIVA DE TRABALHO ODONTOLÓGICO DE SÃO PAULO',
    codigo_ans: '305642',
    federacao: 'BRASIL',
    software: 'ODONTOSYSTEM',
    tipo: 'SINGULAR',
    op_pr: 'Operadora'
  },
  {
    id_singular: '015',
    uniodonto: 'UNIODONTO RIO',
    cnpj: '42.465.418/0001-67',
    cro_operadora: 'RJ-147',
    data_fundacao: '18/07/1987',
    raz_social: 'COOPERATIVA DE TRABALHO ODONTOLÓGICO DO RIO DE JANEIRO',
    codigo_ans: '305758',
    federacao: 'BRASIL',
    software: 'DENTAL CLINIC',
    tipo: 'SINGULAR',
    op_pr: 'Operadora'
  },
  {
    id_singular: '020',
    uniodonto: 'UNIODONTO GOIÁS',
    cnpj: '01.355.442/0001-89',
    cro_operadora: 'GO-089',
    data_fundacao: '05/11/1989',
    raz_social: 'COOPERATIVA DE TRABALHO ODONTOLÓGICO DE GOIÁS',
    codigo_ans: '305891',
    federacao: 'BRASIL',
    software: 'GESTÃO ODONTO',
    tipo: 'SINGULAR',
    op_pr: 'Operadora'
  }
];

export const mockOperadores: Operador[] = [
  {
    id: '1',
    nome: 'João Silva Santos',
    email: 'joao.santos@uniodonto-sp.com.br',
    telefone: '(11) 3456-7890',
    whatsapp: '(11) 98765-4321',
    cargo: 'Coordenador de Credenciamento',
    id_singular: '010',
    ativo: true,
    data_cadastro: new Date('2023-01-15').toISOString()
  },
  {
    id: '2',
    nome: 'Maria Oliveira Costa',
    email: 'maria.costa@uniodonto-rj.com.br',
    telefone: '(21) 2345-6789',
    whatsapp: '(21) 99876-5432',
    cargo: 'Gerente de Rede',
    id_singular: '015',
    ativo: true,
    data_cadastro: new Date('2023-02-20').toISOString()
  },
  {
    id: '3',
    nome: 'Carlos Ferreira Lima',
    email: 'carlos.lima@federacao-rs.com.br',
    telefone: '(51) 3234-5678',
    whatsapp: '(51) 99765-4321',
    cargo: 'Supervisor Regional',
    id_singular: '801',
    ativo: true,
    data_cadastro: new Date('2023-03-10').toISOString()
  },
  {
    id: '4',
    nome: 'Ana Paula Rodrigues',
    email: 'ana.rodrigues@uniodonto.coop.br',
    telefone: '(61) 3123-4567',
    whatsapp: '(61) 99654-3210',
    cargo: 'Diretora Nacional',
    id_singular: '800',
    ativo: true,
    data_cadastro: new Date('2023-01-05').toISOString()
  },
  {
    id: '5',
    nome: 'Roberto Almeida Sousa',
    email: 'roberto.sousa@uniodonto-go.com.br',
    telefone: '(62) 3567-8901',
    whatsapp: '(62) 99543-2109',
    cargo: 'Analista de Credenciamento',
    id_singular: '020',
    ativo: true,
    data_cadastro: new Date('2023-04-12').toISOString()
  }
];

export const mockUsers: User[] = [
  {
    id: '1',
    nome: 'João Silva Santos',
    email: 'joao.santos@uniodonto-sp.com.br',
    cooperativa_id: '010',
    papel: 'operador'
  },
  {
    id: '2',
    nome: 'Maria Oliveira Costa',
    email: 'maria.costa@uniodonto-rj.com.br',
    cooperativa_id: '015',
    papel: 'admin'
  },
  {
    id: '3',
    nome: 'Carlos Ferreira Lima',
    email: 'carlos.lima@federacao-rs.com.br',
    cooperativa_id: '801',
    papel: 'federacao'
  },
  {
    id: '4',
    nome: 'Ana Paula Rodrigues',
    email: 'ana.rodrigues@uniodonto.coop.br',
    cooperativa_id: '800',
    papel: 'confederacao'
  },
];

// Mock current user - você pode alterar para testar diferentes perfis
export const currentUser: User = mockUsers[0];

export const mockPedidos: Pedido[] = [
  {
    id: '1',
    titulo: 'Credenciamento Ortodontista - Urgente',
    criado_por: '1',
    cooperativa_solicitante_id: '010',
    cooperativa_solicitante_nome: 'UNIODONTO SP CAPITAL',
    cidade_id: '3304557',
    cidade_nome: 'Rio de Janeiro',
    estado: 'RJ',
    especialidades: ['Ortodontia'],
    quantidade: 2,
    observacoes: 'Necessário credenciamento urgente de ortodontistas na região central do RJ. Demanda crescente de beneficiários.',
    nivel_atual: 'singular',
    prazo_atual: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 dias restantes
    status: 'em_andamento',
    data_criacao: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(), // 25 dias atrás
    data_ultima_alteracao: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    responsavel_atual_id: '2',
    responsavel_atual_nome: 'Maria Oliveira Costa',
    cooperativa_responsavel_id: '015',
    dias_restantes: 5,
    prioridade: 'urgente'
  },
  {
    id: '2',
    titulo: 'Endodontista - Abadia dos Dourados',
    criado_por: '2',
    cooperativa_solicitante_id: '015',
    cooperativa_solicitante_nome: 'UNIODONTO RIO',
    cidade_id: '3100104',
    cidade_nome: 'Abadia dos Dourados',
    estado: 'MG',
    especialidades: ['Endodontia'],
    quantidade: 1,
    observacoes: 'Beneficiário necessita de tratamento endodôntico especializado. Região sem cobertura adequada.',
    nivel_atual: 'federacao',
    prazo_atual: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 dias restantes
    status: 'em_andamento',
    data_criacao: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(), // 45 dias atrás
    data_ultima_alteracao: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    responsavel_atual_id: '4',
    responsavel_atual_nome: 'Ana Paula Rodrigues',
    cooperativa_responsavel_id: '800',
    dias_restantes: 15,
    prioridade: 'alta'
  },
  {
    id: '3',
    titulo: 'Implantodontista - Abadiânia',
    criado_por: '1',
    cooperativa_solicitante_id: '010',
    cooperativa_solicitante_nome: 'UNIODONTO SP CAPITAL',
    cidade_id: '5200100',
    cidade_nome: 'Abadiânia',
    estado: 'GO',
    especialidades: ['Implantodontia'],
    quantidade: 1,
    observacoes: 'Beneficiário precisa de implante dentário. Cidade com crescimento populacional significativo.',
    nivel_atual: 'singular',
    prazo_atual: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(), // 20 dias restantes
    status: 'em_andamento',
    data_criacao: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 dias atrás
    data_ultima_alteracao: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    responsavel_atual_id: '5',
    responsavel_atual_nome: 'Roberto Almeida Sousa',
    cooperativa_responsavel_id: '020',
    dias_restantes: 20,
    prioridade: 'media'
  },
  {
    id: '4',
    titulo: 'Clínica Geral - São Paulo Capital',
    criado_por: '1',
    cooperativa_solicitante_id: '010',
    cooperativa_solicitante_nome: 'UNIODONTO SP CAPITAL',
    cidade_id: '3500105',
    cidade_nome: 'São Paulo',
    estado: 'SP',
    especialidades: ['Clínica Geral'],
    quantidade: 3,
    observacoes: 'Necessário aumento da rede de clínicos gerais na região metropolitana. Alta demanda de beneficiários.',
    nivel_atual: 'singular',
    prazo_atual: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(), // 28 dias restantes
    status: 'novo',
    data_criacao: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 dias atrás
    data_ultima_alteracao: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    responsavel_atual_id: '1',
    responsavel_atual_nome: 'João Silva Santos',
    cooperativa_responsavel_id: '010',
    dias_restantes: 28,
    prioridade: 'alta'
  },
  {
    id: '5',
    titulo: 'Periodontista - Abadia de Goiás',
    criado_por: '5',
    cooperativa_solicitante_id: '020',
    cooperativa_solicitante_nome: 'UNIODONTO GOIÁS',
    cidade_id: '5200050',
    cidade_nome: 'Abadia de Goiás',
    estado: 'GO',
    especialidades: ['Periodontia'],
    quantidade: 2,
    observacoes: 'Necessidade de especialistas em periodontia para atender demanda local.',
    nivel_atual: 'singular',
    prazo_atual: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(), // 25 dias restantes
    status: 'novo',
    data_criacao: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 dias atrás
    data_ultima_alteracao: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    responsavel_atual_id: '5',
    responsavel_atual_nome: 'Roberto Almeida Sousa',
    cooperativa_responsavel_id: '020',
    dias_restantes: 25,
    prioridade: 'media'
  }
];

export const mockAuditoria: AuditoriaLog[] = [
  {
    id: '1',
    pedido_id: '1',
    usuario_id: '1',
    usuario_nome: 'João Silva',
    acao: 'Pedido criado',
    timestamp: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    detalhes: 'Pedido criado para credenciamento de ortodontista no RJ'
  },
  {
    id: '2',
    pedido_id: '1',
    usuario_id: '2',
    usuario_nome: 'Maria Santos',
    acao: 'Pedido aceito',
    timestamp: new Date(Date.now() - 23 * 24 * 60 * 60 * 1000).toISOString(),
    detalhes: 'Responsável da Singular aceitou o pedido'
  },
  {
    id: '3',
    pedido_id: '2',
    usuario_id: '3',
    usuario_nome: 'Carlos Ferreira',
    acao: 'Pedido escalado para Federação',
    timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    detalhes: 'SLA da Singular expirou, pedido escalado automaticamente'
  },
];

export const mockDashboardStats: DashboardStats = {
  total_pedidos: 4,
  pedidos_vencendo: 1,
  pedidos_em_andamento: 3,
  pedidos_concluidos: 0,
  sla_cumprido: 75
};

export const especialidades = [
  'Clínica Geral',
  'Ortodontia',
  'Endodontia',
  'Periodontia',
  'Cirurgia Oral',
  'Cirurgia Bucomaxilofacial',
  'Implantodontia',
  'Prótese Dentária',
  'Odontopediatria',
  'Radiologia Oral'
];
