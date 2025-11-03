import introducao from './introducao.md?raw';
import operacaoDiaria from './operacao-diaria.md?raw';
import gestaoEstrategica from './gestao-estrategica.md?raw';
import auditoriaConformidade from './auditoria-e-conformidade.md?raw';
import arquiteturaDados from './arquitetura-dados.md?raw';

export interface UsuarioDocPage {
  slug: string;
  title: string;
  description: string;
  category: 'Fundamentos' | 'Operação' | 'Gestão' | 'Governança';
  audience: string[];
  content: string;
  keywords: string[];
}

export const usuarioDocPages: UsuarioDocPage[] = [
  {
    slug: 'introducao',
    title: 'Visão Geral do Portal',
    description: 'Resumo da proposta, objetivos e perfis atendidos pelo uRede.',
    category: 'Fundamentos',
    audience: ['Operadores', 'Gestores', 'Diretoria', 'Auditoria'],
    content: introducao,
    keywords: ['overview', 'portal', 'perfis', 'objetivos'],
  },
  {
    slug: 'operacao-diaria',
    title: 'Operação Diária',
    description: 'Guias de uso para cadastro, acompanhamento e importação de pedidos.',
    category: 'Operação',
    audience: ['Operadores', 'Gestores'],
    content: operacaoDiaria,
    keywords: ['pedidos', 'importação', 'alertas', 'cooperativas'],
  },
  {
    slug: 'gestao-estrategica',
    title: 'Gestão Estratégica',
    description: 'Indicadores, exportações e configurações voltadas à liderança.',
    category: 'Gestão',
    audience: ['Gestores', 'Diretoria'],
    content: gestaoEstrategica,
    keywords: ['relatórios', 'indicadores', 'configurações', 'governança'],
  },
  {
    slug: 'auditoria-e-conformidade',
    title: 'Auditoria e Conformidade',
    description: 'Rastreabilidade, permissões e recomendações para auditorias.',
    category: 'Governança',
    audience: ['Auditoria', 'Gestores'],
    content: auditoriaConformidade,
    keywords: ['auditoria', 'controles', 'logs', 'permissões'],
  },
  {
    slug: 'arquitetura-dados',
    title: 'Arquitetura de Dados',
    description: 'Panorama das entidades principais e integrações do sistema.',
    category: 'Fundamentos',
    audience: ['Gestores', 'Diretoria', 'Auditoria'],
    content: arquiteturaDados,
    keywords: ['dados', 'entidades', 'integrações', 'segurança'],
  },
];

export const DEFAULT_USUARIO_DOC_SLUG = 'introducao';

export const usuarioDocBySlug = usuarioDocPages.reduce<Record<string, UsuarioDocPage>>(
  (acc, page) => {
    acc[page.slug] = page;
    return acc;
  },
  {},
);

export const usuarioDocCategories = Array.from(
  new Set(usuarioDocPages.map((doc) => doc.category)),
) as UsuarioDocPage['category'][];
