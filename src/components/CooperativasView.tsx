// Dependências de React e utilitários visuais.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import type { Cidade, CoberturaLog, Cooperativa, CooperativaOverviewLog, Operador } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Building2, Users, MapPin, Search, LayoutGrid, Loader2, History, ArrowLeft, Pencil } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleMinus, faCirclePlus } from '@fortawesome/free-solid-svg-icons';
import { cn } from './ui/utils';
import { hasWhatsAppFlag } from '../utils/whatsapp';
import { CooperativaAuxiliaresTab } from './CooperativaAuxiliaresTab';
import { PessoasView } from './PessoasView';

// Representa o escopo de cobertura que o usuário pode administrar.
interface CoberturaScope {
  level: 'none' | 'singular' | 'federacao' | 'confederacao';
  manageable: Set<string> | null;
}

// Determina o escopo de atuação do usuário com base no papel e na cooperativa vinculada.
const resolveScope = (userPapel: string | undefined, userCooperativaId: string | undefined, cooperativas: Cooperativa[]): CoberturaScope => {
  if (!userPapel) return { level: 'none', manageable: new Set() };

  const papel = userPapel.toLowerCase();
  const userCoop = cooperativas.find((coop) => coop.id_singular === userCooperativaId) || null;
  const tipo = userCoop?.tipo;

  // Confederação gerencia tudo.
  if (papel === 'confederacao' || tipo === 'CONFEDERACAO') {
    return { level: 'confederacao', manageable: null };
  }

  // Federação gerencia cooperativas filiadas.
  if (papel === 'federacao' || tipo === 'FEDERACAO') {
    const federacaoNome = userCoop?.uniodonto;
    const ids = new Set<string>();
    if (userCooperativaId) ids.add(userCooperativaId);
    cooperativas.forEach((coop) => {
      if (coop.federacao === federacaoNome || coop.id_singular === userCooperativaId) {
        ids.add(coop.id_singular);
      }
    });
    return { level: 'federacao', manageable: ids };
  }

  // Administradores de singulares só editam a própria cooperativa.
  if (papel === 'admin' && tipo === 'SINGULAR' && userCooperativaId) {
    return { level: 'singular', manageable: new Set([userCooperativaId]) };
  }

  return { level: 'none', manageable: new Set() };
};

// Verifica se o usuário pode alterar dados da cooperativa selecionada.
const canManageSelected = (scope: CoberturaScope, cooperativaId: string | undefined) => {
  if (!cooperativaId) return false;
  if (scope.level === 'confederacao') return true;
  if (scope.level === 'none') return false;
  return scope.manageable?.has(cooperativaId) ?? false;
};

// Traduz o tipo técnico para exibição amigável.
const formatCooperativaTipo = (tipo: string) => {
  if (tipo === 'CONFEDERACAO') return 'Confederação';
  if (tipo === 'FEDERACAO') return 'Federação';
  if (tipo === 'SINGULAR') return 'Singular';
  return tipo || '—';
};

const formatCooperativaPapel = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  const normalized = raw.toLowerCase();
  if (normalized === 'operadora') return 'Operadora';
  if (normalized === 'institucional') return 'Institucional';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

const cooperativaPapelBadgeClass = (value: unknown) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'operadora') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (normalized === 'institucional') return 'bg-blue-100 text-blue-800 border-blue-200';
  if (normalized) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
};

// Formata datas para o padrão brasileiro DD/MM/AAAA.
const formatDateBR = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';

  // Já está no padrão DD/MM/AAAA.
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;

  // ISO simples YYYY-MM-DD (evita efeito de timezone).
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    const [, year, month, day] = ymd;
    return `${day}/${month}/${year}`;
  }

  try {
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;
    return date.toLocaleDateString('pt-BR');
  } catch {
    return raw;
  }
};

const formatDateTimeBR = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return formatDateBR(raw);
  return date
    .toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(',', ' •');
};

const onlyDigits = (value: unknown) => String(value ?? '').replace(/\D/g, '');

const formatCnpj = (value: unknown) => {
  const digits = onlyDigits(value).slice(0, 14);
  if (!digits) return '—';
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
};

const formatCep = (value: unknown) => {
  const digits = onlyDigits(value).slice(0, 8);
  if (!digits) return '';
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
};

const formatPhone = (value: unknown) => {
  let digits = onlyDigits(value);
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('0800')) {
    const base = digits.slice(0, 12);
    if (base.length <= 4) return base;
    if (base.length <= 8) return `${base.slice(0, 4)} ${base.slice(4)}`;
    return `${base.slice(0, 4)} ${base.slice(4, 8)} ${base.slice(8, 12)}`;
  }
  if (digits.length === 11 && digits.charAt(2) === '9') {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }
  if (digits.length <= 10) {
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
};

const formatEnderecoTipo = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const normalized = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (normalized === 'sede' || normalized === 'correspondencia') return 'Sede';
  if (normalized === 'filial') return 'Filial';
  if (normalized === 'nucleo') return 'Núcleo';
  if (normalized === 'clinica') return 'Clínica';
  if (normalized === 'ponto_venda' || normalized === 'ponto de venda') return 'Ponto de Venda';
  if (
    normalized === 'plantao_urgencia_emergencia' ||
    normalized === 'plantao urgencia e emergencia' ||
    normalized === 'plantao de urgencia e emergencia'
  ) return 'Plantão de Urgência & Emergência';
  if (normalized === 'atendimento') return 'Atendimento';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

type EnderecoAux = {
  id: string;
  tipo?: string;
  nome_local?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  telefone?: string;
  wpp?: boolean | number | string;
  whatsapp?: boolean | number | string;
  exibir_visao_geral?: boolean | number | string;
  ativo?: boolean;
};

type ContatoAux = {
  id: string;
  tipo?: string;
  subtipo?: string;
  valor?: string;
  principal?: number | string | boolean;
  ativo?: number | string | boolean;
  label?: string;
  wpp?: number | string | boolean;
  whatsapp?: number | string | boolean;
};

const toBool = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const s = String(value ?? '').toLowerCase().trim();
  return ['1', 'true', 't', 'yes', 'y', 'sim'].includes(s);
};

const formatContatoTipo = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const normalized = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const map: Record<string, string> = {
    email: 'E-mail',
    telefone: 'Telefone',
    outro: 'Outro',
  };
  return map[normalized] ?? raw.charAt(0).toUpperCase() + raw.slice(1);
};

const formatContatoSubtipo = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const normalized = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const map: Record<string, string> = {
    lgpd: 'LGPD',
    plantao: 'Plantão',
    geral: 'Geral',
    emergencia: 'Emergência',
    divulgacao: 'Divulgação',
    'comercial pf': 'Comercial PF',
    'comercial pj': 'Comercial PJ',
  };
  return map[normalized] ?? raw.charAt(0).toUpperCase() + raw.slice(1);
};

const contatoBadgeClass = (kind: 'tipo' | 'subtipo', value: unknown) => {
  const normalized = String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (kind === 'tipo') {
    const map: Record<string, string> = {
      email: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      telefone: 'bg-sky-50 text-sky-700 border-sky-200',
      outro: 'bg-slate-100 text-slate-700 border-slate-200',
    };
    return map[normalized] ?? 'bg-slate-100 text-slate-700 border-slate-200';
  }

  const map: Record<string, string> = {
    lgpd: 'bg-rose-50 text-rose-700 border-rose-200',
    plantao: 'bg-amber-50 text-amber-700 border-amber-200',
    emergencia: 'bg-red-50 text-red-700 border-red-200',
    geral: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    divulgacao: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  return map[normalized] ?? 'bg-slate-100 text-slate-700 border-slate-200';
};

const normalizeWebsiteUrl = (raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const isLikelyUrl = (raw: string) => {
  const s = raw.trim();
  if (!s) return false;
  if (/^https?:\/\//i.test(s)) return true;
  return /^[^\s]+\.[^\s]+$/.test(s);
};

const pickWebsiteContato = (contatos: ContatoAux[]) => {
  const enabled = contatos.filter((c) => toBool(c.ativo ?? 1));
  const primaries = enabled.filter((c) => toBool(c.principal));

  // Preferir tipo=website (novo padrão)
  const websitePrimary = primaries.find((c) => String(c.tipo ?? '').toLowerCase() === 'website') || null;
  const websiteAny = enabled.find((c) => String(c.tipo ?? '').toLowerCase() === 'website') || null;

  // Fallback legado: tipo=outro com label/valor parecendo site
  const legacyPrimary = primaries
    .filter((c) => String(c.tipo ?? '').toLowerCase() === 'outro')
    .find((c) => {
      const label = String(c.label ?? '').toLowerCase();
      const valor = String(c.valor ?? '');
      return isLikelyUrl(valor) || label.includes('site') || label.includes('web');
    }) || null;

  return websitePrimary || websiteAny || legacyPrimary;
};

const getWebsiteRawValue = (contatos: ContatoAux[]) => {
  const raw = String(pickWebsiteContato(contatos)?.valor ?? '').trim();
  return raw;
};

const formatOverviewHistoryField = (value: string) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  const labels: Record<string, string> = {
    website: 'Website',
    cnpj: 'CNPJ',
    codigo_ans: 'Código ANS',
    data_fundacao: 'Data de fundação',
    federacao: 'Federação',
    software: 'Software',
    raz_social: 'Razão social',
  };
  return labels[normalized] || value || '—';
};

const formatOverviewHistoryAction = (value: string) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'create') return 'Criado';
  if (normalized === 'delete') return 'Removido';
  return 'Atualizado';
};

type DetailTab =
  | 'overview'
  | 'coverage'
  | 'enderecos'
  | 'contatos'
  | 'diretores'
  | 'regulatorio'
  | 'conselhos'
  | 'departamentos'
  | 'plantao'
  | 'ouvidores'
  | 'lgpd'
  | 'auditores'
  | 'pessoas'
  | 'history';

type OverviewFormState = {
  cnpj: string;
  codigo_ans: string;
  data_fundacao: string;
  federacao: string;
  software: string;
  raz_social: string;
  website: string;
};

export function CooperativasView() {
  // Usuário autenticado controla permissões e filtros de dados.
  const { user } = useAuth();
  // Dados principais carregados da API.
  const [cooperativas, setCooperativas] = useState<Cooperativa[]>([]);
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [cidades, setCidades] = useState<Cidade[]>([]);
  // Estado de carregamento/erro global da tela.
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Referência ao caminho anterior para restaurar a URL ao sair do detalhe.
  const previousPathRef = useRef<string | null>(null);
  const [selectedCoop, setSelectedCoop] = useState<Cooperativa | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [overviewEnderecos, setOverviewEnderecos] = useState<EnderecoAux[]>([]);
  const [isLoadingOverviewEnderecos, setIsLoadingOverviewEnderecos] = useState(false);
  const [overviewEnderecosError, setOverviewEnderecosError] = useState('');
  const [overviewContatos, setOverviewContatos] = useState<ContatoAux[]>([]);
  const [isLoadingOverviewContatos, setIsLoadingOverviewContatos] = useState(false);
  const [overviewContatosError, setOverviewContatosError] = useState('');
  const [isOverviewEditorOpen, setIsOverviewEditorOpen] = useState(false);
  const [overviewForm, setOverviewForm] = useState<OverviewFormState>({
    cnpj: '',
    codigo_ans: '',
    data_fundacao: '',
    federacao: '',
    software: '',
    raz_social: '',
    website: '',
  });
  const [overviewSaveStatus, setOverviewSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSavingOverview, setIsSavingOverview] = useState(false);

  // Estados relacionados à edição de cobertura de cidades.
  const [coverageDraft, setCoverageDraft] = useState<string[]>([]);
  const [coverageError, setCoverageError] = useState('');
  const [coverageSuccess, setCoverageSuccess] = useState('');
  const [isSavingCoverage, setIsSavingCoverage] = useState(false);
  const [availableFilter, setAvailableFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');
  const [globalCoverageFilter, setGlobalCoverageFilter] = useState('');
  const [assignedPage, setAssignedPage] = useState(0);
  const [availablePage, setAvailablePage] = useState(0);

  // Histórico de alterações para a aba correspondente.
  const [history, setHistory] = useState<CoberturaLog[]>([]);
  const [historyLoadedFor, setHistoryLoadedFor] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [overviewHistory, setOverviewHistory] = useState<CooperativaOverviewLog[]>([]);
  const [overviewHistoryLoadedFor, setOverviewHistoryLoadedFor] = useState<string | null>(null);
  const [isOverviewHistoryLoading, setIsOverviewHistoryLoading] = useState(false);
  const [overviewHistoryError, setOverviewHistoryError] = useState('');
  // Solicitação de transferência de cidade entre cooperativas.
  const [transferPrompt, setTransferPrompt] = useState<{
    cityId: string;
    cityName: string;
    originCoopId: string;
    originCoopName: string;
  } | null>(null);

  const sortedCoverageHistory = useMemo(
    () => [...history].sort((a, b) => {
      const tsA = new Date(a.timestamp).getTime();
      const tsB = new Date(b.timestamp).getTime();
      const safeA = Number.isNaN(tsA) ? 0 : tsA;
      const safeB = Number.isNaN(tsB) ? 0 : tsB;
      return safeB - safeA;
    }),
    [history]
  );

  const sortedOverviewHistory = useMemo(
    () => [...overviewHistory].sort((a, b) => {
      const tsA = new Date(a.timestamp).getTime();
      const tsB = new Date(b.timestamp).getTime();
      const safeA = Number.isNaN(tsA) ? 0 : tsA;
      const safeB = Number.isNaN(tsB) ? 0 : tsB;
      return safeB - safeA;
    }),
    [overviewHistory]
  );

  // Carrega cooperativas, operadores e cidades em paralelo na montagem.
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [cooperativasData, operadoresData, cidadesData] = await Promise.all([
          apiService.getCooperativas(),
          apiService.getOperadores(),
          apiService.getCidades()
        ]);
        setCooperativas(cooperativasData);
        setOperadores(operadoresData);
        setCidades(cidadesData);
      } catch (err) {
        console.error('Erro ao carregar cooperativas:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Mapeia quantidade de operadores ativos por cooperativa.
  const operadorCountMap = useMemo(() => {
    const counts = new Map<string, number>();
    operadores.forEach((op) => {
      if (!op.ativo) return;
      counts.set(op.id_singular, (counts.get(op.id_singular) ?? 0) + 1);
    });
    return counts;
  }, [operadores]);

  // Mapeia quantidade de cidades atribuídas por cooperativa.
  const cidadeCountMap = useMemo(() => {
    const counts = new Map<string, number>();
    cidades.forEach((cidade) => {
      if (!cidade.id_singular) return;
      counts.set(cidade.id_singular, (counts.get(cidade.id_singular) ?? 0) + 1);
    });
    return counts;
  }, [cidades]);

  // Aplica filtro de busca na tabela principal.
  const filteredCooperativas = useMemo(() => {
    const sorted = [...cooperativas].sort((a, b) =>
      a.uniodonto.localeCompare(b.uniodonto, 'pt-BR', { sensitivity: 'base' })
    );
    const normalizedQuery = searchTerm
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    if (!normalizedQuery) return sorted;

    const queryTerms = normalizedQuery.split(/\s+/).filter(Boolean);

    return sorted.filter((coop) => {
      const cidadesCount = cidadeCountMap.get(coop.id_singular) ?? 0;
      const operadoresCount = operadorCountMap.get(coop.id_singular) ?? 0;

      const searchableRow = [
        coop.uniodonto,
        coop.raz_social,
        coop.id_singular,
        coop.tipo_label ?? formatCooperativaTipo(coop.tipo),
        formatCooperativaPapel(coop.op_pr),
        cidadesCount,
        operadoresCount,
        coop.software,
        coop.cnpj,
        coop.codigo_ans,
        coop.federacao,
      ]
        .join(' ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

      return queryTerms.every((term) => searchableRow.includes(term));
    });
  }, [cooperativas, searchTerm, cidadeCountMap, operadorCountMap]);

  // Calcula o escopo de edição sempre que usuário ou cooperativas mudarem.
  const scope = useMemo(() => resolveScope(user?.papel, user?.cooperativa_id, cooperativas), [user?.papel, user?.cooperativa_id, cooperativas]);

  // Mapas auxiliares para renderização rápida.
  const cooperativaNomeMap = useMemo(() => {
    const map = new Map<string, string>();
    cooperativas.forEach((coop) => {
      map.set(coop.id_singular, coop.uniodonto);
    });
    return map;
  }, [cooperativas]);

  const cidadeMap = useMemo(() => {
    const map = new Map<string, Cidade>();
    cidades.forEach((cidade) => {
      map.set(cidade.cd_municipio_7, cidade);
    });
    return map;
  }, [cidades]);

  // Conjunto base das cidades atualmente atribuídas à cooperativa selecionada.
  const currentCoverageSet = useMemo(() => {
    if (!selectedCoop) return new Set<string>();
    const assigned = cidades
      .filter((cidade) => cidade.id_singular === selectedCoop.id_singular)
      .map((cidade) => cidade.cd_municipio_7);
    return new Set(assigned);
  }, [cidades, selectedCoop]);

  // Conjunto derivado do draft para consultas rápidas.
  const draftSet = useMemo(() => new Set(coverageDraft), [coverageDraft]);

  // Indica se existem mudanças pendentes na cobertura.
  const hasCoverageChanges = useMemo(() => {
    if (!selectedCoop) return false;
    if (draftSet.size !== currentCoverageSet.size) return true;
    for (const id of draftSet) {
      if (!currentCoverageSet.has(id)) return true;
    }
    return false;
  }, [selectedCoop, draftSet, currentCoverageSet]);

  // Permissão efetiva de edição no contexto atual.
  const canEditSelected = selectedCoop ? canManageSelected(scope, selectedCoop.id_singular) : false;
  const overviewWebsiteRaw = useMemo(() => getWebsiteRawValue(overviewContatos), [overviewContatos]);
  const overviewEnderecosVisiveis = useMemo(
    () => overviewEnderecos.filter((endereco) => {
      if (!toBool(endereco.ativo ?? 1)) return false;
      if (endereco.exibir_visao_geral === undefined || endereco.exibir_visao_geral === null) return true;
      return toBool(endereco.exibir_visao_geral);
    }),
    [overviewEnderecos],
  );

  // Normaliza textos removendo acentos para facilitar buscas.
  const normalizeText = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  // Faz a busca tolerante a acentos e múltiplos termos.
  const matchesQuery = (texto: string, query: string) => {
    if (!query) return true;
    const normalizedText = normalizeText(texto);
    const normalizedQuery = normalizeText(query);
    return normalizedQuery
      .split(/\s+/)
      .filter(Boolean)
      .every((parte) => normalizedText.includes(parte));
  };

  // Filtro aplicado à lista de cidades já atribuídas.
  const assignedQueryRaw = assignedFilter || globalCoverageFilter;
  const assignedQuery = assignedQueryRaw.trim();
  const assignedCities = useMemo(() => {
    const result = coverageDraft
      .map((id) => cidadeMap.get(id))
      .filter((cidade): cidade is Cidade => Boolean(cidade))
      .sort((a, b) => a.nm_cidade.localeCompare(b.nm_cidade, 'pt-BR'));
    if (!assignedQuery) return result;
    return result.filter((cidade) =>
      matchesQuery(`${cidade.nm_cidade} ${cidade.cd_municipio_7}`, assignedQuery)
    );
  }, [coverageDraft, cidadeMap, assignedQuery]);

  // Filtro aplicado à lista de cidades disponíveis para atribuição.
  const availableQueryRaw = availableFilter || globalCoverageFilter;
  const availableQuery = availableQueryRaw.trim();
  const hasAvailableSearch = availableQuery.length >= 2;
  const availableCities = useMemo(() => {
    if (!selectedCoop || !hasAvailableSearch) return [] as Cidade[];
    const lista = cidades.filter((cidade) => {
      if (draftSet.has(cidade.cd_municipio_7)) return false;
      if (!canEditSelected) return false;

      if (scope.level === 'confederacao') {
        return true;
      }

      if (scope.level === 'federacao') {
        if (!cidade.id_singular) return true;
        return scope.manageable?.has(cidade.id_singular) ?? false;
      }

      if (scope.level === 'singular') {
        return !cidade.id_singular || cidade.id_singular === selectedCoop.id_singular;
      }

      return false;
    });

    const sorted = lista.sort((a, b) => a.nm_cidade.localeCompare(b.nm_cidade, 'pt-BR'));
    return sorted.filter((cidade) =>
      matchesQuery(`${cidade.nm_cidade} ${cidade.cd_municipio_7}`, availableQuery)
    );
  }, [cidades, draftSet, selectedCoop, scope, canEditSelected, availableQuery, hasAvailableSearch]);

  // Paginação simples compartilhada pelas duas colunas.
  const PAGE_SIZE = 10;
  const totalAssignedPages = Math.ceil(assignedCities.length / PAGE_SIZE);
  const totalAvailablePages = Math.ceil(availableCities.length / PAGE_SIZE);
  const assignedSlice = assignedCities.slice(assignedPage * PAGE_SIZE, assignedPage * PAGE_SIZE + PAGE_SIZE);
  const availableSlice = availableCities.slice(availablePage * PAGE_SIZE, availablePage * PAGE_SIZE + PAGE_SIZE);

  const canTransferCity = (cidade: Cidade) => {
    if (!selectedCoop) return false;
    if (!cidade.id_singular) return true;
    if (cidade.id_singular === selectedCoop.id_singular) return true;
    if (scope.level === 'confederacao') return true;
    if (scope.level === 'federacao') {
      return scope.manageable?.has(cidade.id_singular) ?? false;
    }
    return false;
  };

  // Abre a página de detalhes carregando o estado base da cooperativa.
  const handleOpenDetails = (coop: Cooperativa, options?: { fromDeepLink?: boolean }) => {
    setSelectedCoop(coop);
    const cobertura = cidades
      .filter((cidade) => cidade.id_singular === coop.id_singular)
      .map((cidade) => cidade.cd_municipio_7);
    setCoverageDraft(cobertura);
    setCoverageError('');
    setCoverageSuccess('');
    setAssignedFilter('');
    setAvailableFilter('');
    setGlobalCoverageFilter('');
    setAssignedPage(0);
    setAvailablePage(0);
    setDetailTab('overview');
    setHistory([]);
    setHistoryError('');
    setHistoryLoadedFor(null);
    setOverviewHistory([]);
    setOverviewHistoryError('');
    setOverviewHistoryLoadedFor(null);
    setIsOverviewEditorOpen(false);
    setOverviewSaveStatus(null);
    setTransferPrompt(null);

    // Atualiza a URL para permitir rastreamento no analytics.
    const detailPath = `/cooperativas/${coop.id_singular}`;
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (options?.fromDeepLink || window.location.pathname === detailPath) {
      previousPathRef.current = '/cooperativas';
      window.history.replaceState({ coopDetail: true, coopId: coop.id_singular }, '', detailPath);
    } else {
      previousPathRef.current = currentPath;
      window.history.pushState({ coopDetail: true, coopId: coop.id_singular }, '', detailPath);
    }
  };

  // Fecha a página de detalhes, garantindo que alterações não salvas sejam validadas com o usuário.
  const handleCloseDetails = useCallback((options?: { viaHistory?: boolean }) => {
    if (isSavingCoverage) return false;
    if (hasCoverageChanges) {
      const confirmed = window.confirm('Existem alterações de cobertura não salvas. Deseja descartá-las?');
      if (!confirmed) return false;
      const baseline = Array.from(currentCoverageSet);
      setCoverageDraft(baseline);
      setCoverageError('');
      setCoverageSuccess('');
    }

    setSelectedCoop(null);
    setDetailTab('overview');
    setHistory([]);
    setHistoryError('');
    setHistoryLoadedFor(null);
    setOverviewHistory([]);
    setOverviewHistoryError('');
    setOverviewHistoryLoadedFor(null);
    setIsOverviewEditorOpen(false);
    setOverviewSaveStatus(null);
    setTransferPrompt(null);

    if (!options?.viaHistory) {
      window.history.replaceState(null, '', '/cooperativas');
      previousPathRef.current = null;
    }

    return true;
  }, [currentCoverageSet, hasCoverageChanges, isSavingCoverage]);

  const navigateToDashboard = () => {
    window.history.pushState(null, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const syncOverviewFormFromSelection = useCallback(() => {
    if (!selectedCoop) return;
    setOverviewForm({
      cnpj: selectedCoop.cnpj || '',
      codigo_ans: selectedCoop.codigo_ans || '',
      data_fundacao: selectedCoop.data_fundacao || '',
      federacao: selectedCoop.federacao || '',
      software: selectedCoop.software || '',
      raz_social: selectedCoop.raz_social || '',
      website: overviewWebsiteRaw || '',
    });
  }, [overviewWebsiteRaw, selectedCoop]);

  const handleOpenOverviewEditor = () => {
    if (!selectedCoop || !canEditSelected) return;
    syncOverviewFormFromSelection();
    setOverviewSaveStatus(null);
    setIsOverviewEditorOpen(true);
  };

  const handleSaveOverview = async () => {
    if (!selectedCoop || !canEditSelected || isSavingOverview) return;
    const websiteTrimmed = overviewForm.website.trim();
    if (websiteTrimmed && !isLikelyUrl(websiteTrimmed)) {
      setOverviewSaveStatus({ type: 'error', message: 'Website inválido. Informe uma URL válida.' });
      return;
    }

    try {
      setIsSavingOverview(true);
      setOverviewSaveStatus(null);
      const response = await apiService.updateCooperativaOverview(selectedCoop.id_singular, {
        cnpj: onlyDigits(overviewForm.cnpj).slice(0, 14),
        codigo_ans: overviewForm.codigo_ans.trim(),
        data_fundacao: overviewForm.data_fundacao.trim(),
        federacao: overviewForm.federacao.trim(),
        software: overviewForm.software.trim(),
        raz_social: overviewForm.raz_social.trim(),
        website: websiteTrimmed,
      });

      const updatedCooperativa = response?.cooperativa;
      if (updatedCooperativa?.id_singular) {
        setCooperativas((prev) => prev.map((coop) =>
          coop.id_singular === updatedCooperativa.id_singular ? updatedCooperativa : coop
        ));
        setSelectedCoop(updatedCooperativa);
      }

      try {
        const contatos = await apiService.getCooperativaAux<ContatoAux>(selectedCoop.id_singular, 'contatos');
        setOverviewContatos(Array.isArray(contatos) ? contatos : []);
        setOverviewContatosError('');
      } catch (contatosError) {
        console.error('Erro ao recarregar contatos após salvar visão geral:', contatosError);
      }

      if (overviewHistoryLoadedFor === selectedCoop.id_singular) {
        try {
          const logs = await apiService.getCooperativaOverviewHistorico(selectedCoop.id_singular, 200);
          setOverviewHistory(logs);
        } catch (historyErr) {
          console.error('Erro ao recarregar histórico da visão geral:', historyErr);
        }
      }

      setOverviewSaveStatus({ type: 'success', message: 'Visão geral atualizada com sucesso.' });
      setIsOverviewEditorOpen(false);
    } catch (err) {
      console.error('Erro ao salvar visão geral:', err);
      setOverviewSaveStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Erro ao salvar visão geral',
      });
    } finally {
      setIsSavingOverview(false);
    }
  };

  // Persiste a cobertura e mantém o cache local sincronizado.
  const handleSaveCoverage = async () => {
    if (!selectedCoop) return;
    const confirmed = window.confirm('Confirmar salvamento das alterações de cobertura?');
    if (!confirmed) return;
    try {
      setIsSavingCoverage(true);
      setCoverageError('');
      setCoverageSuccess('');
      const response = await apiService.updateCooperativaCobertura(selectedCoop.id_singular, coverageDraft);
      const updated = response?.updated ?? [];
      if (updated.length) {
        setCidades((prev) => {
          const updates = new Map(updated.map((cidade) => [cidade.cd_municipio_7, cidade]));
          return prev.map((cidade) => updates.get(cidade.cd_municipio_7) ?? cidade);
        });
      } else {
        // fallback para garantir consistência
        const cidadesAtualizadas = await apiService.getCidades();
        setCidades(cidadesAtualizadas);
      }
      setCoverageSuccess('Cobertura atualizada com sucesso.');
      if (historyLoadedFor === selectedCoop.id_singular) {
        try {
          const historico = await apiService.getCooperativaCoberturaHistorico(selectedCoop.id_singular, 200);
          setHistory(historico);
        } catch (err) {
          console.error('Erro ao recarregar histórico:', err);
        }
      }
    } catch (err) {
      console.error('Erro ao salvar cobertura:', err);
      setCoverageError(err instanceof Error ? err.message : 'Erro ao salvar cobertura');
    } finally {
      setIsSavingCoverage(false);
    }
  };

  const handleConfirmTransfer = () => {
    if (!transferPrompt) return;
    setCoverageDraft((prev) => [...new Set([...prev, transferPrompt.cityId])]);
    setTransferPrompt(null);
    setCoverageError('');
    setCoverageSuccess('Cidade marcada para transferência. Salve para confirmar a alteração.');
  };

  const handleCancelTransfer = () => {
    setTransferPrompt(null);
  };

  const requestAddCity = (cidade: Cidade) => {
    if (!selectedCoop) return;
    if (!canEditSelected) {
      setCoverageError('Você não possui permissão para alterar a cobertura desta cooperativa.');
      setCoverageSuccess('');
      return;
    }

    if (cidade.id_singular && cidade.id_singular !== selectedCoop.id_singular) {
      if (!canTransferCity(cidade)) {
        setCoverageError('Você não possui permissão para transferir esta cidade.');
        setCoverageSuccess('');
        return;
      }

      setTransferPrompt({
        cityId: cidade.cd_municipio_7,
        cityName: `${cidade.nm_cidade} (${cidade.uf_municipio})`,
        originCoopId: cidade.id_singular,
        originCoopName: cooperativaNomeMap.get(cidade.id_singular) ?? cidade.id_singular,
      });
      return;
    }

    setCoverageDraft((prev) => [...new Set([...prev, cidade.cd_municipio_7])]);
    setCoverageError('');
    setCoverageSuccess('Cidade adicionada ao rascunho. Salve para confirmar.');
  };

  // Busca o histórico apenas quando necessário para reduzir chamadas.
  const ensureHistory = async (coopId: string) => {
    if (historyLoadedFor === coopId) return;
    try {
      setIsHistoryLoading(true);
      setHistoryError('');
      const registros = await apiService.getCooperativaCoberturaHistorico(coopId, 200);
      setHistory(registros);
      setHistoryLoadedFor(coopId);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
      setHistoryError(err instanceof Error ? err.message : 'Erro ao carregar histórico');
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const ensureOverviewHistory = async (coopId: string) => {
    if (overviewHistoryLoadedFor === coopId) return;
    try {
      setIsOverviewHistoryLoading(true);
      setOverviewHistoryError('');
      const registros = await apiService.getCooperativaOverviewHistorico(coopId, 200);
      setOverviewHistory(registros);
      setOverviewHistoryLoadedFor(coopId);
    } catch (err) {
      console.error('Erro ao carregar histórico da visão geral:', err);
      setOverviewHistoryError(err instanceof Error ? err.message : 'Erro ao carregar histórico da visão geral');
    } finally {
      setIsOverviewHistoryLoading(false);
    }
  };

  // Carrega histórico quando o usuário abre a aba correspondente.
  useEffect(() => {
    if (detailTab === 'history' && selectedCoop) {
      ensureHistory(selectedCoop.id_singular);
      ensureOverviewHistory(selectedCoop.id_singular);
    }
  }, [detailTab, selectedCoop]);

  useEffect(() => {
    const loadOverviewEnderecos = async () => {
      if (!selectedCoop) {
        setOverviewEnderecos([]);
        setOverviewEnderecosError('');
        return;
      }
      try {
        setIsLoadingOverviewEnderecos(true);
        setOverviewEnderecosError('');
        const enderecos = await apiService.getCooperativaAux<EnderecoAux>(selectedCoop.id_singular, 'enderecos');
        setOverviewEnderecos(Array.isArray(enderecos) ? enderecos : []);
      } catch (err) {
        console.error('Erro ao carregar endereços:', err);
        setOverviewEnderecosError(err instanceof Error ? err.message : 'Erro ao carregar endereços');
      } finally {
        setIsLoadingOverviewEnderecos(false);
      }
    };

    const loadOverviewContatos = async () => {
      if (!selectedCoop) {
        setOverviewContatos([]);
        setOverviewContatosError('');
        return;
      }
      try {
        setIsLoadingOverviewContatos(true);
        setOverviewContatosError('');
        const contatos = await apiService.getCooperativaAux<ContatoAux>(selectedCoop.id_singular, 'contatos');
        setOverviewContatos(Array.isArray(contatos) ? contatos : []);
      } catch (err) {
        console.error('Erro ao carregar contatos (overview):', err);
        setOverviewContatosError(err instanceof Error ? err.message : 'Erro ao carregar contatos');
      } finally {
        setIsLoadingOverviewContatos(false);
      }
    };

    loadOverviewEnderecos();
    loadOverviewContatos();
  }, [selectedCoop?.id_singular]);

  useEffect(() => {
    if (!isOverviewEditorOpen) {
      syncOverviewFormFromSelection();
    }
  }, [isOverviewEditorOpen, syncOverviewFormFromSelection]);

  // Reseta a página ao mudar filtros ou tamanho da lista atribuída.
  useEffect(() => {
    setAssignedPage(0);
  }, [assignedFilter, globalCoverageFilter, coverageDraft.length]);

  // Reseta a página ao alterar filtros ou cooperativa selecionada.
  useEffect(() => {
    setAvailablePage(0);
  }, [availableFilter, globalCoverageFilter, coverageDraft.length, selectedCoop?.id_singular]);

  // Mantém o índice válido mesmo que a quantidade total de páginas diminua.
  useEffect(() => {
    if (assignedPage > totalAssignedPages - 1) {
      setAssignedPage(0);
    }
  }, [assignedPage, totalAssignedPages]);

  // Idem para a lista de cidades disponíveis.
  useEffect(() => {
    if (availablePage > totalAvailablePages - 1) {
      setAvailablePage(0);
    }
  }, [availablePage, totalAvailablePages]);

  // Permite que o botão de voltar do navegador feche a página de detalhes.
  useEffect(() => {
    const handlePopState = () => {
      if (!selectedCoop) return;
      const closed = handleCloseDetails({ viaHistory: true });
      if (!closed) {
        window.history.pushState({ coopDetail: true, coopId: selectedCoop.id_singular }, '', `/cooperativas/${selectedCoop.id_singular}`);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedCoop, handleCloseDetails, hasCoverageChanges, isSavingCoverage, currentCoverageSet]);

  useEffect(() => {
    const goToList = () => {
      if (!selectedCoop) {
        window.history.replaceState(null, '', '/cooperativas');
        return;
      }
      handleCloseDetails();
    };
    window.addEventListener('cooperativas:go-list', goToList as EventListener);
    return () => window.removeEventListener('cooperativas:go-list', goToList as EventListener);
  }, [selectedCoop, handleCloseDetails]);

  // Deep link: /cooperativas/:id_singular deve abrir automaticamente o detalhe.
  useEffect(() => {
    if (selectedCoop) return;
    const m = window.location.pathname.match(/^\/cooperativas\/([^/]+)$/);
    if (!m) return;
    const id = (m[1] || '').trim();
    if (!id) return;
    const coop = cooperativas.find((c) => c.id_singular === id);
    if (!coop) return;
    handleOpenDetails(coop, { fromDeepLink: true });
  }, [cooperativas, handleOpenDetails, selectedCoop]);

  // Estado inicial de carregamento global.
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cooperativas</h1>
          <p className="text-gray-600">Gerencie as cooperativas e suas áreas de cobertura</p>
        </div>
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando cooperativas...</p>
        </div>
      </div>
    );
  }

  // Feedback simples caso a requisição inicial falhe.
  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cooperativas</h1>
          <p className="text-gray-600">Gerencie as cooperativas e suas áreas de cobertura</p>
        </div>
        <div className="text-center py-8">
          <p className="text-red-600">Erro: {error}</p>
        </div>
      </div>
    );
  }

  if (selectedCoop) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4">
          <Button
            variant="ghost"
            className="w-fit"
            onClick={() => {
              handleCloseDetails();
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para cooperativas
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
              <button
                type="button"
                onClick={navigateToDashboard}
                className="rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7B6EF6]"
                aria-label="Voltar para o dashboard"
                title="Voltar para o dashboard"
              >
                <Building2 className="w-5 h-5" />
              </button>
              {selectedCoop.uniodonto}
            </h1>
            <p className="text-gray-600">
              Gerencie informações, cobertura e histórico de alterações desta cooperativa.
            </p>
          </div>
        </div>

        <Tabs
          value={detailTab}
          onValueChange={(value) => setDetailTab(value as typeof detailTab)}
          className="flex flex-col gap-6"
        >
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 rounded-lg bg-muted/60 p-1">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="coverage">Cidades</TabsTrigger>
            <TabsTrigger value="enderecos">Endereços</TabsTrigger>
            <TabsTrigger value="contatos">Contatos</TabsTrigger>
            <TabsTrigger value="diretores">Diretores</TabsTrigger>
            <TabsTrigger value="regulatorio">Regulatório</TabsTrigger>
            <TabsTrigger value="conselhos">Conselhos</TabsTrigger>
            <TabsTrigger value="departamentos">Colaboradores</TabsTrigger>
            <TabsTrigger value="plantao">Urgência &amp; Emergência</TabsTrigger>
            <TabsTrigger value="ouvidores">Ouvidoria</TabsTrigger>
            <TabsTrigger value="lgpd">LGPD</TabsTrigger>
            <TabsTrigger value="auditores">Auditores</TabsTrigger>
            <TabsTrigger value="pessoas">Pessoas</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0">
            {/* Bloco de resumo com dados estáticos da cooperativa */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-500">
                  Use esta visão para revisar e, quando necessário, corrigir dados cadastrais.
                </p>
                {canEditSelected && (
                  <Button variant="outline" size="sm" onClick={handleOpenOverviewEditor}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar visão geral
                  </Button>
                )}
              </div>
              {overviewSaveStatus && (
                <div
                  className={cn(
                    'rounded-md border px-3 py-2 text-sm',
                    overviewSaveStatus.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-red-200 bg-red-50 text-red-700',
                  )}
                >
                  {overviewSaveStatus.message}
                </div>
              )}
              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-600">Informações legais</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">CNPJ</span>
                      <p className="font-medium text-gray-900">{formatCnpj(selectedCoop.cnpj)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Código ANS</span>
                      <p className="font-medium text-gray-900">{selectedCoop.codigo_ans || '—'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Data de fundação</span>
                      <p className="font-medium text-gray-900">{formatDateBR(selectedCoop.data_fundacao)}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-600">Operação</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Tipo</span>
                      <p className="font-medium text-gray-900">{selectedCoop.tipo_label ?? formatCooperativaTipo(selectedCoop.tipo)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Papel</span>
                      <div className="pt-1">
                        <Badge
                          variant="outline"
                          className={cn('text-xs', cooperativaPapelBadgeClass(selectedCoop.op_pr))}
                        >
                          {formatCooperativaPapel(selectedCoop.op_pr)}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500">Federação</span>
                      <p className="font-medium text-gray-900">{selectedCoop.federacao || '—'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Software</span>
                      <p className="font-medium text-gray-900">{selectedCoop.software || '—'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Website</span>
                      {!overviewWebsiteRaw ? (
                        <p className="font-medium text-gray-900">—</p>
                      ) : (
                        <p className="font-medium text-gray-900">
                          <a
                            href={normalizeWebsiteUrl(overviewWebsiteRaw)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#3145C4] underline-offset-4 hover:underline break-all"
                          >
                            {overviewWebsiteRaw}
                          </a>
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-600">Resumo</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <span className="text-gray-500">Cidades atendidas</span>
                        <p className="text-xl font-semibold text-gray-900">{currentCoverageSet.size}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Responsáveis ativos</span>
                        <p className="text-xl font-semibold text-gray-900">{operadorCountMap.get(selectedCoop.id_singular) ?? 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-600">Endereços</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 md:items-start text-sm">
                  {/* Coluna 1: endereços */}
                  <div className="flex h-full flex-col gap-3">
                    <div className="min-h-6 flex items-center">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Endereços</p>
                    </div>
                    {overviewEnderecosError && (
                      <p className="text-red-600">{overviewEnderecosError}</p>
                    )}
                    {isLoadingOverviewEnderecos ? (
                      <p className="text-gray-500">Carregando endereços...</p>
                    ) : overviewEnderecosVisiveis.length === 0 ? (
                      <p className="text-gray-500">Nenhum endereço cadastrado.</p>
                    ) : (
                      overviewEnderecosVisiveis.map((endereco) => {
                        const cepFormatado = formatCep(endereco.cep);
                        const telefone = formatPhone(endereco.telefone);
                        const logradouroNumero = [endereco.logradouro, endereco.numero].filter(Boolean).join(', ');
                        const phoneLine = telefone || '';
                        const parts = [
                          logradouroNumero,
                          endereco.complemento,
                          endereco.bairro,
                          endereco.cidade,
                          endereco.uf,
                          cepFormatado,
                        ].filter((item) => String(item ?? '').trim().length > 0);
                        const linhaUnica = parts.join(' • ');

                        return (
                          <div key={endereco.id} className="rounded-md border border-gray-200 p-3">
                            <p className="font-semibold text-gray-900">
                              {[formatEnderecoTipo(endereco.tipo), endereco.nome_local].filter(Boolean).join(' • ') || 'Endereço'}
                            </p>
                            <p className="text-gray-700 leading-relaxed">{linhaUnica || '—'}</p>
                            {phoneLine && (
                              <p className="mt-1 inline-flex items-center gap-1.5 text-gray-700">
                                <span>{phoneLine}</span>
                                {hasWhatsAppFlag(endereco) && <i className="fa-brands fa-whatsapp text-emerald-600 text-sm" aria-label="WhatsApp" />}
                              </p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Coluna 2: contatos principais */}
                  <div className="flex h-full flex-col gap-3">
                    <div className="min-h-6 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Contatos principais</p>
                      {isLoadingOverviewContatos && <span className="text-xs text-gray-400">Carregando...</span>}
                    </div>
                    {overviewContatosError && (
                      <p className="text-red-600">{overviewContatosError}</p>
                    )}
                    {(() => {
                      const principais = overviewContatos
                        .filter((c) => toBool(c.ativo ?? 1))
                        .filter((c) => toBool(c.principal));

                      if (!principais.length) {
                        return <p className="text-gray-500">Nenhum contato principal cadastrado.</p>;
                      }

                      const renderValor = (c: ContatoAux) => {
                        const tipoRaw = String(c.tipo ?? '').toLowerCase();
                        const valorRaw = String(c.valor ?? '').trim();
                        if (tipoRaw === 'telefone' || tipoRaw === 'whatsapp') {
                          const formatted = formatPhone(valorRaw) || '—';
                          return (
                            <span className="inline-flex items-center gap-1.5">
                              <span>{formatted}</span>
                              {hasWhatsAppFlag(c) && <i className="fa-brands fa-whatsapp text-emerald-600 text-sm" aria-label="WhatsApp" />}
                            </span>
                          );
                        }
                        return valorRaw || '—';
                      };

                      return (
                        <div className="rounded-md border border-gray-200 overflow-hidden bg-white">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Subtipo</TableHead>
                                <TableHead>Valor</TableHead>
                                <TableHead>Label</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {principais.map((c) => {
                                const tipoLabel = formatContatoTipo(c.tipo) || '—';
                                const subtipoLabel = formatContatoSubtipo(c.subtipo) || '—';
                                return (
                                  <TableRow key={c.id}>
                                    <TableCell>
                                      <Badge
                                        variant="outline"
                                        className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', contatoBadgeClass('tipo', c.tipo))}
                                      >
                                        {tipoLabel}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant="outline"
                                        className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', contatoBadgeClass('subtipo', c.subtipo))}
                                      >
                                        {subtipoLabel}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="font-medium text-gray-900 break-all">
                                      {renderValor(c)}
                                    </TableCell>
                                    <TableCell className="text-gray-600 break-all">
                                      {String(c.label ?? '').trim() || '—'}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="coverage" className="mt-0">
            {/* Área interativa para manutenção da cobertura */}
            <div className="space-y-4 pb-28">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Gerenciar cobertura</h3>
                  <p className="text-xs text-gray-500">Pesquise por nome ou código IBGE para localizar uma cidade rapidamente.</p>
                </div>
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    value={globalCoverageFilter}
                    onChange={(event) => {
                      const value = event.target.value;
                      setGlobalCoverageFilter(value);
                      setAssignedFilter(value);
                      setAvailableFilter(value);
                    }}
                    placeholder="Buscar em todas as listas..."
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {/* Coluna da esquerda: cidades atuais */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">Cidades atribuídas ({coverageDraft.length})</h3>
                    <div className="relative w-48">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <Input
                        placeholder="Filtrar..."
                        value={assignedFilter}
                        onChange={(event) => setAssignedFilter(event.target.value)}
                        className="pl-10"
                        disabled={!coverageDraft.length}
                      />
                    </div>
                  </div>
                  <ScrollArea className="h-[24rem] border border-gray-200 rounded-md">
                    <div className="p-2 space-y-2">
                      {assignedSlice.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-8">
                          Nenhuma cidade atribuída
                        </p>
                      ) : (
                        assignedSlice.map((cidade) => (
                          <div
                            key={cidade.cd_municipio_7}
                            className="flex items-center justify-between gap-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
                          >
                            <div>
                              <p className="font-medium text-gray-900">{cidade.nm_cidade} ({cidade.uf_municipio})</p>
                              <p className="text-xs text-gray-500">{cidade.cd_municipio_7}</p>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-gray-500 hover:text-red-600"
                              onClick={() => {
                                if (!canEditSelected) {
                                  setCoverageError('Você não possui permissão para alterar a cobertura desta cooperativa.');
                                  setCoverageSuccess('');
                                  return;
                                }
                                setCoverageDraft((prev) => prev.filter((id) => id !== cidade.cd_municipio_7));
                              }}
                            >
                              <FontAwesomeIcon icon={faCircleMinus} className="h-4 w-4" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                  {assignedCities.length > PAGE_SIZE && (
                    <div className="flex items-center justify-between pt-2 text-xs text-gray-500">
                      <span>
                        Exibindo {Math.min(PAGE_SIZE, Math.max(0, assignedCities.length - assignedPage * PAGE_SIZE))} de {assignedCities.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={assignedPage === 0}
                          onClick={() => setAssignedPage((prev) => Math.max(0, prev - 1))}
                        >
                          Anterior
                        </Button>
                        <span>
                          {assignedPage + 1}/{Math.max(1, totalAssignedPages)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={assignedPage >= totalAssignedPages - 1}
                          onClick={() => setAssignedPage((prev) => Math.min(totalAssignedPages - 1, prev + 1))}
                        >
                          Próxima
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Coluna da direita: cidades disponíveis */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">Disponíveis para atribuição</h3>
                    <div className="relative w-48">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <Input
                        placeholder="Buscar cidade..."
                        value={availableFilter}
                        onChange={(event) => setAvailableFilter(event.target.value)}
                        className="pl-10"
                        disabled={!canEditSelected}
                      />
                    </div>
                  </div>
                  <ScrollArea className="h-[24rem] border border-gray-200 rounded-md">
                    <div className="p-2 space-y-2">
                      {!hasAvailableSearch ? (
                        <p className="text-sm text-gray-500 text-center py-8">
                          Digite pelo menos 2 caracteres para localizar cidades.
                        </p>
                      ) : availableSlice.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-8">
                          Nenhuma cidade disponível ou correspondendo ao filtro.
                        </p>
                      ) : (
                        availableSlice.map((cidade) => (
                          <div
                            key={cidade.cd_municipio_7}
                            className="flex items-center justify-between gap-3 rounded-md border border-gray-100 px-3 py-2 text-sm"
                          >
                            <div>
                              <p className="font-medium text-gray-900">{cidade.nm_cidade} ({cidade.uf_municipio})</p>
                              <p className="text-xs text-gray-500">
                                {cidade.cd_municipio_7}
                                {cidade.id_singular && (
                                  <span className="ml-2 text-[11px] uppercase text-amber-600">
                                    Atual: {cooperativaNomeMap.get(cidade.id_singular) ?? cidade.id_singular}
                                  </span>
                                )}
                              </p>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-gray-500 hover:text-blue-600"
                              onClick={() => requestAddCity(cidade)}
                            >
                              <FontAwesomeIcon icon={faCirclePlus} className="h-4 w-4" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                  {hasAvailableSearch && availableCities.length > PAGE_SIZE && (
                    <div className="flex items-center justify-between pt-2 text-xs text-gray-500">
                      <span>
                        Exibindo {Math.min(PAGE_SIZE, Math.max(0, availableCities.length - availablePage * PAGE_SIZE))} de {availableCities.length}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={availablePage === 0}
                          onClick={() => setAvailablePage((prev) => Math.max(0, prev - 1))}
                        >
                          Anterior
                        </Button>
                        <span>
                          {availablePage + 1}/{Math.max(1, totalAvailablePages)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={availablePage >= totalAvailablePages - 1}
                          onClick={() => setAvailablePage((prev) => Math.min(totalAvailablePages - 1, prev + 1))}
                        >
                          Próxima
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />
            </div>
            {/* Barra fixa no rodapé garantindo acesso aos botões de ação */}
            <div className="sticky bottom-0 left-0 right-0 mt-4 flex flex-col gap-3 border-t border-gray-200 bg-white/95 p-4 backdrop-blur">
              <div className="text-sm text-gray-600">
                <p>
                  {hasCoverageChanges
                    ? 'Existem alterações não salvas na cobertura.'
                    : 'Nenhuma alteração pendente.'}
                </p>
                {coverageError && <p className="text-red-600 mt-1">{coverageError}</p>}
                {coverageSuccess && <p className="text-green-600 mt-1">{coverageSuccess}</p>}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!selectedCoop) return;
                    const baseline = Array.from(currentCoverageSet);
                    setCoverageDraft(baseline);
                    setCoverageError('');
                    setCoverageSuccess('');
                  }}
                  disabled={!hasCoverageChanges || isSavingCoverage}
                >
                  Descartar alterações
                </Button>
                <Button
                  onClick={handleSaveCoverage}
                  disabled={!hasCoverageChanges || !canEditSelected || isSavingCoverage}
                >
                  {isSavingCoverage && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Salvar cobertura
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">Histórico de alterações</h3>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-gray-800">Cobertura de cidades</h4>
                  <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-medium text-indigo-700">
                    Ordem: mais novo para mais antigo
                  </span>
                </div>
                {historyError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                    {historyError}
                  </div>
                )}
                {isHistoryLoading ? (
                  <div className="py-8 text-center text-gray-500 text-sm">
                    Carregando histórico de cobertura...
                  </div>
                ) : sortedCoverageHistory.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhuma alteração de cobertura registrada para esta cooperativa.</p>
                ) : (
                  <div className="border border-gray-200 rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Cidade</TableHead>
                          <TableHead>Origem</TableHead>
                          <TableHead>Destino</TableHead>
                          <TableHead>Responsável</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedCoverageHistory.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="whitespace-nowrap">
                              <span className="inline-flex items-center rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                                {formatDateTimeBR(log.timestamp)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium text-gray-900">{log.cidade_nome || log.cidade_id}</span>
                                <span className="text-xs text-gray-500">{log.cidade_id}{log.cidade_uf ? ` • ${log.cidade_uf}` : ''}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {log.cooperativa_origem_nome || log.cooperativa_origem || '—'}
                            </TableCell>
                            <TableCell>
                              {log.cooperativa_destino_nome || log.cooperativa_destino || '—'}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium text-gray-900">{log.usuario_nome || log.usuario_email}</span>
                                <span className="text-xs text-gray-500 uppercase">{log.usuario_papel || '—'}</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-gray-800">Visão geral</h4>
                  <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-medium text-indigo-700">
                    Ordem: mais novo para mais antigo
                  </span>
                </div>
                {overviewHistoryError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                    {overviewHistoryError}
                  </div>
                )}
                {isOverviewHistoryLoading ? (
                  <div className="py-8 text-center text-gray-500 text-sm">
                    Carregando histórico da visão geral...
                  </div>
                ) : sortedOverviewHistory.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhuma alteração da visão geral registrada para esta cooperativa.</p>
                ) : (
                  <div className="border border-gray-200 rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Campo</TableHead>
                          <TableHead>Ação</TableHead>
                          <TableHead>De</TableHead>
                          <TableHead>Para</TableHead>
                          <TableHead>Responsável</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedOverviewHistory.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="whitespace-nowrap">
                              <span className="inline-flex items-center rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                                {formatDateTimeBR(log.timestamp)}
                              </span>
                            </TableCell>
                            <TableCell>{formatOverviewHistoryField(log.campo)}</TableCell>
                            <TableCell>{formatOverviewHistoryAction(log.acao)}</TableCell>
                            <TableCell className="max-w-60 break-all text-gray-600">
                              {String(log.valor_anterior ?? '').trim() || '—'}
                            </TableCell>
                            <TableCell className="max-w-60 break-all font-medium text-gray-900">
                              {String(log.valor_novo ?? '').trim() || '—'}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium text-gray-900">{log.usuario_nome || log.usuario_email}</span>
                                <span className="text-xs text-gray-500 uppercase">{log.usuario_papel || '—'}</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="enderecos" className="mt-0">
            <CooperativaAuxiliaresTab idSingular={selectedCoop.id_singular} canEdit={canEditSelected} resourceKey="enderecos" />
          </TabsContent>

          <TabsContent value="contatos" className="mt-0">
            <CooperativaAuxiliaresTab idSingular={selectedCoop.id_singular} canEdit={canEditSelected} resourceKey="contatos" />
          </TabsContent>

          <TabsContent value="diretores" className="mt-0">
            <CooperativaAuxiliaresTab idSingular={selectedCoop.id_singular} canEdit={canEditSelected} resourceKey="diretores" />
          </TabsContent>

          <TabsContent value="regulatorio" className="mt-0">
            <CooperativaAuxiliaresTab idSingular={selectedCoop.id_singular} canEdit={canEditSelected} resourceKey="regulatorio" />
          </TabsContent>

          <TabsContent value="conselhos" className="mt-0">
            <CooperativaAuxiliaresTab idSingular={selectedCoop.id_singular} canEdit={canEditSelected} resourceKey="conselhos" />
          </TabsContent>

          <TabsContent value="departamentos" className="mt-0">
            <CooperativaAuxiliaresTab idSingular={selectedCoop.id_singular} canEdit={canEditSelected} resourceKey="colaboradores" />
          </TabsContent>

          <TabsContent value="plantao" className="mt-0">
            <CooperativaAuxiliaresTab idSingular={selectedCoop.id_singular} canEdit={canEditSelected} resourceKey="plantao" />
          </TabsContent>

          <TabsContent value="ouvidores" className="mt-0">
            <CooperativaAuxiliaresTab idSingular={selectedCoop.id_singular} canEdit={canEditSelected} resourceKey="ouvidores" />
          </TabsContent>

          <TabsContent value="lgpd" className="mt-0">
            <CooperativaAuxiliaresTab idSingular={selectedCoop.id_singular} canEdit={canEditSelected} resourceKey="lgpd" />
          </TabsContent>

          <TabsContent value="auditores" className="mt-0">
            <CooperativaAuxiliaresTab idSingular={selectedCoop.id_singular} canEdit={canEditSelected} resourceKey="auditores" />
          </TabsContent>

          <TabsContent value="pessoas" className="mt-0">
            <PessoasView idSingular={selectedCoop.id_singular} canEdit={canEditSelected} embedded />
          </TabsContent>
        </Tabs>

        <Dialog
          open={isOverviewEditorOpen}
          onOpenChange={(open) => {
            if (isSavingOverview) return;
            if (!open) {
              syncOverviewFormFromSelection();
            }
            setIsOverviewEditorOpen(open);
          }}
        >
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Editar visão geral</DialogTitle>
              <DialogDescription>
                Atualize dados cadastrais da cooperativa. Todas as alterações ficam registradas no histórico.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <span className="text-sm text-gray-600">Razão social</span>
                <Input
                  value={overviewForm.raz_social}
                  onChange={(event) => setOverviewForm((prev) => ({ ...prev, raz_social: event.target.value }))}
                  placeholder="Razão social"
                  disabled={isSavingOverview}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <span className="text-sm text-gray-600">CNPJ</span>
                  <Input
                    value={overviewForm.cnpj}
                    onChange={(event) => setOverviewForm((prev) => ({ ...prev, cnpj: event.target.value }))}
                    placeholder="Somente números"
                    disabled={isSavingOverview}
                  />
                </div>
                <div className="grid gap-2">
                  <span className="text-sm text-gray-600">Código ANS</span>
                  <Input
                    value={overviewForm.codigo_ans}
                    onChange={(event) => setOverviewForm((prev) => ({ ...prev, codigo_ans: event.target.value }))}
                    placeholder="Código ANS"
                    disabled={isSavingOverview}
                  />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <span className="text-sm text-gray-600">Data de fundação</span>
                  <Input
                    value={overviewForm.data_fundacao}
                    onChange={(event) => setOverviewForm((prev) => ({ ...prev, data_fundacao: event.target.value }))}
                    placeholder="Ex.: 12/03/1988"
                    disabled={isSavingOverview}
                  />
                </div>
                <div className="grid gap-2">
                  <span className="text-sm text-gray-600">Federação</span>
                  <Input
                    value={overviewForm.federacao}
                    onChange={(event) => setOverviewForm((prev) => ({ ...prev, federacao: event.target.value }))}
                    placeholder="Federação"
                    disabled={isSavingOverview}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <span className="text-sm text-gray-600">Software</span>
                <Input
                  value={overviewForm.software}
                  onChange={(event) => setOverviewForm((prev) => ({ ...prev, software: event.target.value }))}
                  placeholder="Software de gestão utilizado"
                  disabled={isSavingOverview}
                />
              </div>
              <div className="grid gap-2">
                <span className="text-sm text-gray-600">Website</span>
                <Input
                  value={overviewForm.website}
                  onChange={(event) => setOverviewForm((prev) => ({ ...prev, website: event.target.value }))}
                  placeholder="Ex.: campinas.uniodonto.coop.br"
                  disabled={isSavingOverview}
                />
                <p className="text-xs text-gray-500">
                  Para remover o website, deixe o campo vazio e salve.
                </p>
              </div>
            </div>
            <div className="mt-2 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  syncOverviewFormFromSelection();
                  setIsOverviewEditorOpen(false);
                }}
                disabled={isSavingOverview}
              >
                Cancelar
              </Button>
              <Button onClick={handleSaveOverview} disabled={isSavingOverview}>
                {isSavingOverview && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar alterações
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(transferPrompt)}
          onOpenChange={(open) => {
            if (!open) handleCancelTransfer();
          }}
        >
          {transferPrompt && (
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-lg">Confirmar transferência</DialogTitle>
                <DialogDescription>
                  Tem certeza que deseja remover {transferPrompt.cityName} da Uniodonto &ldquo;{transferPrompt.originCoopName}&rdquo;?
                  A cidade passará a pertencer a {selectedCoop.uniodonto}.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <Button onClick={handleConfirmTransfer}>Sim</Button>
                <Button variant="outline" onClick={handleCancelTransfer}>
                  Não
                </Button>
              </div>
            </DialogContent>
          )}
        </Dialog>
      </div>
    );
  }

  // Layout principal: cabeçalho e lista de cooperativas.
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cooperativas</h1>
          <p className="text-gray-600">Visualize e administre as cooperativas, operadores e cobertura de cidades</p>
        </div>
        <div className="max-w-xs">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Buscar em qualquer campo..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Panorama geral das cooperativas listadas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <LayoutGrid className="w-5 h-5" />
            Panorama das cooperativas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cooperativa</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="hidden md:table-cell">Papel</TableHead>
                  <TableHead>Cidades</TableHead>
                  <TableHead className="hidden md:table-cell">Responsáveis</TableHead>
                  <TableHead className="hidden md:table-cell">Software</TableHead>
                  <TableHead className="hidden md:table-cell">CNPJ</TableHead>
                  <TableHead className="w-28 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCooperativas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-6 text-gray-500">
                      Nenhuma cooperativa encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCooperativas.map((coop) => {
                    const cidadesCount = cidadeCountMap.get(coop.id_singular) ?? 0;
                    const operadoresCount = operadorCountMap.get(coop.id_singular) ?? 0;
                    return (
                      <TableRow
                        key={coop.id_singular}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleOpenDetails(coop)}
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">{coop.uniodonto}</span>
                            <span className="text-xs text-gray-500">{coop.raz_social}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs capitalize',
                              coop.tipo === 'SINGULAR' && 'bg-green-100 text-green-800 border-green-200',
                              coop.tipo === 'FEDERACAO' && 'bg-blue-100 text-blue-800 border-blue-200',
                              coop.tipo === 'CONFEDERACAO' && 'bg-red-100 text-red-800 border-red-200'
                            )}
                          >
                            {coop.tipo_label ?? formatCooperativaTipo(coop.tipo)}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge
                            variant="outline"
                            className={cn('text-xs', cooperativaPapelBadgeClass(coop.op_pr))}
                          >
                            {formatCooperativaPapel(coop.op_pr)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">{cidadesCount}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">{operadoresCount}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-gray-600">
                          {coop.software || '—'}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-gray-600">
                          {coop.cnpj || '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); handleOpenDetails(coop); }}>
                            Detalhes
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
