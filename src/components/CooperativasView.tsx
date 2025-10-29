// Dependências de React e utilitários visuais.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import type { Cidade, CoberturaLog, Cooperativa, Operador } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Building2, Users, MapPin, Search, LayoutGrid, Loader2, History, ArrowLeft } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleMinus, faCirclePlus } from '@fortawesome/free-solid-svg-icons';
import { cn } from './ui/utils';

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

// Formata datas do histórico para o locale brasileiro.
const formatTimestamp = (value: string) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return value;
  }
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
  const [detailTab, setDetailTab] = useState<'overview' | 'coverage' | 'history'>('overview');

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
  // Solicitação de transferência de cidade entre cooperativas.
  const [transferPrompt, setTransferPrompt] = useState<{
    cityId: string;
    cityName: string;
    originCoopId: string;
    originCoopName: string;
  } | null>(null);

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
    if (!searchTerm) return sorted;
    const query = searchTerm.toLowerCase();
    return sorted.filter((coop) =>
      coop.uniodonto.toLowerCase().includes(query) ||
      coop.raz_social.toLowerCase().includes(query) ||
      coop.id_singular.toLowerCase().includes(query)
    );
  }, [cooperativas, searchTerm]);

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
  const handleOpenDetails = (coop: Cooperativa) => {
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
    setTransferPrompt(null);

    // Atualiza a URL para permitir rastreamento no analytics.
    previousPathRef.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const detailPath = `/cooperativas/${coop.id_singular}`;
    window.history.pushState({ coopDetail: true, coopId: coop.id_singular }, '', detailPath);
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
    setTransferPrompt(null);

    if (!options?.viaHistory) {
      const fallbackPath = previousPathRef.current ?? '/cooperativas';
      window.history.replaceState(null, '', fallbackPath);
      previousPathRef.current = null;
    }

    return true;
  }, [currentCoverageSet, hasCoverageChanges, isSavingCoverage]);

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
    if (!selectedCoop || !canEditSelected) return;

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

  // Carrega histórico quando o usuário abre a aba correspondente.
  useEffect(() => {
    if (detailTab === 'history' && selectedCoop) {
      ensureHistory(selectedCoop.id_singular);
    }
  }, [detailTab, selectedCoop]);

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
              <Building2 className="w-5 h-5" />
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
          <TabsList className="grid w-full max-w-xl grid-cols-3 gap-2">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="coverage">Cobertura de cidades</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0">
            {/* Bloco de resumo com dados estáticos da cooperativa */}
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-600">Informações legais</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">CNPJ</span>
                      <p className="font-medium text-gray-900">{selectedCoop.cnpj || '—'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Código ANS</span>
                      <p className="font-medium text-gray-900">{selectedCoop.codigo_ans || '—'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Data de fundação</span>
                      <p className="font-medium text-gray-900">{selectedCoop.data_fundacao || '—'}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-600">Operação</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Tipo</span>
                      <p className="font-medium text-gray-900">{selectedCoop.tipo_label ?? formatCooperativaTipo(selectedCoop.tipo)}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Federação</span>
                      <p className="font-medium text-gray-900">{selectedCoop.federacao || '—'}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Software</span>
                      <p className="font-medium text-gray-900">{selectedCoop.software || '—'}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-600">Resumo</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-3 text-sm">
                  <div>
                    <span className="text-gray-500">Cidades atendidas</span>
                    <p className="text-xl font-semibold text-gray-900">{currentCoverageSet.size}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Operadores ativos</span>
                    <p className="text-xl font-semibold text-gray-900">{operadorCountMap.get(selectedCoop.id_singular) ?? 0}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Área de cobertura</span>
                    <p className="text-sm text-gray-900">Atualize na aba &ldquo;Cobertura de cidades&rdquo;</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="coverage" className="mt-0">
            {/* Área interativa para manutenção da cobertura */}
            <div className="space-y-4 pb-28">
              {!canEditSelected && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-700">
                  Você não possui permissão para alterar a cobertura desta cooperativa.
                </div>
              )}

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
                              disabled={!canEditSelected}
                              onClick={() => {
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
                      {!canEditSelected ? (
                        <p className="text-sm text-gray-500 text-center py-8">
                          Sem permissão para alterar cobertura.
                        </p>
                      ) : !hasAvailableSearch ? (
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
            {/* Tabela com o histórico de movimentos de cobertura */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">Histórico de alterações</h3>
              </div>
              {historyError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                  {historyError}
                </div>
              )}
              {isHistoryLoading ? (
                <div className="py-12 text-center text-gray-500">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  Carregando histórico...
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhuma alteração registrada para esta cooperativa.</p>
              ) : (
                <div className="border border-gray-200 rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Cidade</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Destino</TableHead>
                        <TableHead>Usuário</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap">{formatTimestamp(log.timestamp)}</TableCell>
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
          </TabsContent>
        </Tabs>

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
              placeholder="Buscar cooperativa..."
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
                  <TableHead className="hidden md:table-cell">Cidades</TableHead>
                  <TableHead className="hidden md:table-cell">Operadores</TableHead>
                  <TableHead className="hidden lg:table-cell">Software</TableHead>
                  <TableHead className="hidden lg:table-cell">CNPJ</TableHead>
                  <TableHead className="w-28 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCooperativas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-gray-500">
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
                        <TableCell className="hidden lg:table-cell text-gray-600">
                          {coop.software || '—'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-gray-600">
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
