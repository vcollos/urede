import { useEffect, useMemo, useState } from 'react';
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
import { Building2, Users, MapPin, Search, LayoutGrid, Loader2, History } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleMinus, faCirclePlus } from '@fortawesome/free-solid-svg-icons';
import { cn } from './ui/utils';

interface CoberturaScope {
  level: 'none' | 'singular' | 'federacao' | 'confederacao';
  manageable: Set<string> | null;
}

const resolveScope = (userPapel: string | undefined, userCooperativaId: string | undefined, cooperativas: Cooperativa[]): CoberturaScope => {
  if (!userPapel) return { level: 'none', manageable: new Set() };

  const papel = userPapel.toLowerCase();
  const userCoop = cooperativas.find((coop) => coop.id_singular === userCooperativaId) || null;
  const tipo = userCoop?.tipo;

  if (papel === 'confederacao' || tipo === 'CONFEDERACAO') {
    return { level: 'confederacao', manageable: null };
  }

  if (papel === 'federacao' || tipo === 'FEDERAÇÃO') {
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

  if (papel === 'admin' && tipo === 'SINGULAR' && userCooperativaId) {
    return { level: 'singular', manageable: new Set([userCooperativaId]) };
  }

  return { level: 'none', manageable: new Set() };
};

const canManageSelected = (scope: CoberturaScope, cooperativaId: string | undefined) => {
  if (!cooperativaId) return false;
  if (scope.level === 'confederacao') return true;
  if (scope.level === 'none') return false;
  return scope.manageable?.has(cooperativaId) ?? false;
};

const formatCooperativaTipo = (tipo: string) => {
  if (tipo === 'CONFEDERACAO') return 'Confederação';
  if (tipo === 'FEDERAÇÃO') return 'Federação';
  if (tipo === 'SINGULAR') return 'Singular';
  return tipo || '—';
};

const formatTimestamp = (value: string) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return value;
  }
};

export function CooperativasView() {
  const { user } = useAuth();
  const [cooperativas, setCooperativas] = useState<Cooperativa[]>([]);
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedCoop, setSelectedCoop] = useState<Cooperativa | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'coverage' | 'history'>('overview');

  const [coverageDraft, setCoverageDraft] = useState<string[]>([]);
  const [coverageError, setCoverageError] = useState('');
  const [coverageSuccess, setCoverageSuccess] = useState('');
  const [isSavingCoverage, setIsSavingCoverage] = useState(false);
  const [availableFilter, setAvailableFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');

  const [history, setHistory] = useState<CoberturaLog[]>([]);
  const [historyLoadedFor, setHistoryLoadedFor] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

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

  const operadorCountMap = useMemo(() => {
    const counts = new Map<string, number>();
    operadores.forEach((op) => {
      if (!op.ativo) return;
      counts.set(op.id_singular, (counts.get(op.id_singular) ?? 0) + 1);
    });
    return counts;
  }, [operadores]);

  const cidadeCountMap = useMemo(() => {
    const counts = new Map<string, number>();
    cidades.forEach((cidade) => {
      if (!cidade.id_singular) return;
      counts.set(cidade.id_singular, (counts.get(cidade.id_singular) ?? 0) + 1);
    });
    return counts;
  }, [cidades]);

  const filteredCooperativas = useMemo(() => {
    if (!searchTerm) return cooperativas;
    const query = searchTerm.toLowerCase();
    return cooperativas.filter((coop) =>
      coop.uniodonto.toLowerCase().includes(query) ||
      coop.raz_social.toLowerCase().includes(query) ||
      coop.id_singular.toLowerCase().includes(query)
    );
  }, [cooperativas, searchTerm]);

  const scope = useMemo(() => resolveScope(user?.papel, user?.cooperativa_id, cooperativas), [user?.papel, user?.cooperativa_id, cooperativas]);

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

  const currentCoverageSet = useMemo(() => {
    if (!selectedCoop) return new Set<string>();
    const assigned = cidades
      .filter((cidade) => cidade.id_singular === selectedCoop.id_singular)
      .map((cidade) => cidade.cd_municipio_7);
    return new Set(assigned);
  }, [cidades, selectedCoop]);

  const draftSet = useMemo(() => new Set(coverageDraft), [coverageDraft]);

  const hasCoverageChanges = useMemo(() => {
    if (!selectedCoop) return false;
    if (draftSet.size !== currentCoverageSet.size) return true;
    for (const id of draftSet) {
      if (!currentCoverageSet.has(id)) return true;
    }
    return false;
  }, [selectedCoop, draftSet, currentCoverageSet]);

  const canEditSelected = selectedCoop ? canManageSelected(scope, selectedCoop.id_singular) : false;

  const assignedCities = useMemo(() => {
    const result = coverageDraft
      .map((id) => cidadeMap.get(id))
      .filter((cidade): cidade is Cidade => Boolean(cidade))
      .sort((a, b) => a.nm_cidade.localeCompare(b.nm_cidade, 'pt-BR'));
    if (!assignedFilter) return result;
    const query = assignedFilter.toLowerCase();
    return result.filter((cidade) =>
      cidade.nm_cidade.toLowerCase().includes(query) ||
      (cidade.cd_municipio_7 || '').toLowerCase().includes(query)
    );
  }, [coverageDraft, cidadeMap, assignedFilter]);

  const availableCities = useMemo(() => {
    if (!selectedCoop) return [] as Cidade[];
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
    if (!availableFilter) return sorted.slice(0, 100);
    const query = availableFilter.toLowerCase();
    return sorted
      .filter((cidade) =>
        cidade.nm_cidade.toLowerCase().includes(query) ||
        (cidade.cd_municipio_7 || '').toLowerCase().includes(query)
      )
      .slice(0, 100);
  }, [cidades, draftSet, selectedCoop, scope, canEditSelected, availableFilter]);

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
    setDetailTab('overview');
    setHistory([]);
    setHistoryError('');
    setHistoryLoadedFor(null);
    setIsDetailOpen(true);
  };

  const handleCloseDetails = () => {
    if (isSavingCoverage) return;
    if (hasCoverageChanges) {
      const confirmed = window.confirm('Existem alterações de cobertura não salvas. Deseja descartá-las?');
      if (!confirmed) return;
      const baseline = Array.from(currentCoverageSet);
      setCoverageDraft(baseline);
      setCoverageError('');
      setCoverageSuccess('');
    }
    setIsDetailOpen(false);
    setSelectedCoop(null);
  };

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

  useEffect(() => {
    if (detailTab === 'history' && selectedCoop) {
      ensureHistory(selectedCoop.id_singular);
    }
  }, [detailTab, selectedCoop]);

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
                              coop.tipo === 'FEDERAÇÃO' && 'bg-blue-100 text-blue-800 border-blue-200',
                              coop.tipo === 'CONFEDERACAO' && 'bg-red-100 text-red-800 border-red-200'
                            )}
                          >
                            {formatCooperativaTipo(coop.tipo)}
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

      <Dialog open={isDetailOpen} onOpenChange={(open) => (open ? setIsDetailOpen(true) : handleCloseDetails())}>
        <DialogContent className="w-[80vw] max-w-[80vw] max-h-[90dvh] p-0 overflow-hidden">
          {selectedCoop && (
            <Tabs
              value={detailTab}
              onValueChange={(value) => setDetailTab(value as typeof detailTab)}
              className="flex h-[90dvh] flex-col"
            >
              <div className="shrink-0 p-6">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-xl">
                    <Building2 className="w-5 h-5" />
                    {selectedCoop.uniodonto}
                  </DialogTitle>
                  <DialogDescription>
                    Gerencie informações, cobertura e histórico de alterações desta cooperativa.
                  </DialogDescription>
                </DialogHeader>

                <TabsList className="mt-4 grid grid-cols-3 gap-2">
                  <TabsTrigger value="overview">Visão Geral</TabsTrigger>
                  <TabsTrigger value="coverage">Cobertura de cidades</TabsTrigger>
                  <TabsTrigger value="history">Histórico</TabsTrigger>
                </TabsList>
              </div>

              <ScrollArea className="flex-1 min-h-0">
                <div className="p-6">
                <TabsContent value="overview" className="mt-0">
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
                            <p className="font-medium text-gray-900">{formatCooperativaTipo(selectedCoop.tipo)}</p>
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
                  <div className="space-y-4">
                    {!canEditSelected && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-700">
                        Você não possui permissão para alterar a cobertura desta cooperativa.
                      </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-gray-900">Cidades atribuídas ({coverageDraft.length})</h3>
                          <div className="relative w-48">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <Input
                              placeholder="Filtrar..."
                              value={assignedFilter}
                              onChange={(event) => setAssignedFilter(event.target.value)}
                              className="pl-10 h-9"
                              disabled={!coverageDraft.length}
                            />
                          </div>
                        </div>
                        <ScrollArea className="h-64 border border-gray-200 rounded-md">
                          <div className="p-2 space-y-2">
                            {assignedCities.length === 0 ? (
                              <p className="text-sm text-gray-500 text-center py-8">
                                Nenhuma cidade atribuída
                              </p>
                            ) : (
                              assignedCities.map((cidade) => (
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
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-gray-900">Disponíveis para atribuição</h3>
                          <div className="relative w-48">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <Input
                              placeholder="Buscar cidade..."
                              value={availableFilter}
                              onChange={(event) => setAvailableFilter(event.target.value)}
                              className="pl-10 h-9"
                              disabled={!canEditSelected}
                            />
                          </div>
                        </div>
                        <ScrollArea className="h-64 border border-gray-200 rounded-md">
                          <div className="p-2 space-y-2">
                            {!canEditSelected ? (
                              <p className="text-sm text-gray-500 text-center py-8">
                                Sem permissão para alterar cobertura.
                              </p>
                            ) : availableCities.length === 0 ? (
                              <p className="text-sm text-gray-500 text-center py-8">
                                Nenhuma cidade disponível ou correspondendo ao filtro.
                              </p>
                            ) : (
                              availableCities.map((cidade) => (
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
                                    onClick={() => {
                                      if (!canEditSelected) return;
                                      setCoverageDraft((prev) => [...new Set([...prev, cidade.cd_municipio_7])]);
                                    }}
                                  >
                                    <FontAwesomeIcon icon={faCirclePlus} className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="text-sm text-gray-600">
                        <p>
                          {hasCoverageChanges
                            ? 'Existem alterações não salvas na cobertura.'
                            : 'Nenhuma alteração pendente.'}
                        </p>
                        {coverageError && <p className="text-red-600 mt-1">{coverageError}</p>}
                        {coverageSuccess && <p className="text-green-600 mt-1">{coverageSuccess}</p>}
                      </div>
                      <div className="flex items-center gap-2">
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
                  </div>
                </TabsContent>

                <TabsContent value="history" className="mt-0">
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
                </div>
              </ScrollArea>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
