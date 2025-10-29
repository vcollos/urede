import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Search,
  MapPin,
  User,
  Clock,
  AlertCircle,
  Tag,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { Pedido } from '../types';
import { getNivelBadgeClass, getStatusBadgeClass, getStatusCardColors } from '../utils/pedidoStyles';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Checkbox } from './ui/checkbox';
import { cn } from './ui/utils';

export type PedidosFilterPreset = {
  status?: Pedido['status'] | 'todos';
  custom?: 'vencendo' | null;
  token?: number;
};

interface PedidosListaProps {
  onViewPedido: (pedido: Pedido) => void;
  presetFilter?: PedidosFilterPreset | null;
}

export function PedidosLista({ onViewPedido, presetFilter }: PedidosListaProps) {
  const { user, isAuthenticated } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const defaultStatusSelection: Pedido['status'][] = ['novo', 'em_andamento'];
  const allStatusValues: Pedido['status'][] = ['novo', 'em_andamento', 'concluido', 'cancelado'];

  const [statusFilter, setStatusFilter] = useState<Pedido['status'][]>(() => [...defaultStatusSelection]);
  const [nivelFilter, setNivelFilter] = useState('todos');
  const [viewMode, setViewMode] = useState<'lista' | 'kanban'>('lista');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [customFilter, setCustomFilter] = useState<'vencendo' | null>(null);

  // Carregar pedidos
  useEffect(() => {
    const loadPedidos = async () => {
      try {
        setIsLoading(true);
        let pedidosData = await apiService.getPedidos();

        const pedidosParaTransferir = pedidosData.filter(
          (pedido) =>
            !pedido.excluido &&
            pedido.dias_restantes <= 0 &&
            (pedido.status === 'novo' || pedido.status === 'em_andamento') &&
            pedido.nivel_atual !== 'confederacao'
        );

        if (pedidosParaTransferir.length > 0) {
          try {
            await Promise.all(
              pedidosParaTransferir.map((pedido) => apiService.transferirPedido(pedido.id))
            );
            pedidosData = await apiService.getPedidos();
          } catch (transferError) {
            console.error('Erro ao aplicar regra de transferência automática:', transferError);
          }
        }

        setPedidos(pedidosData.filter((pedido) => !pedido.excluido));
      } catch (err) {
        console.error('Erro ao carregar pedidos:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar pedidos');
      } finally {
        setIsLoading(false);
      }
    };

    if (!user) {
      return;
    }

    loadPedidos();
    const handler = () => { loadPedidos(); };

    window.addEventListener('pedido:deleted', handler);
    window.addEventListener('pedido:created', handler);
    window.addEventListener('pedido:updated', handler);

    return () => {
      window.removeEventListener('pedido:deleted', handler);
      window.removeEventListener('pedido:created', handler);
      window.removeEventListener('pedido:updated', handler);
    };
  }, [user]);

  const statusOptions: { label: string; value: Pedido['status'] }[] = [
    { label: 'Novo', value: 'novo' },
    { label: 'Em andamento', value: 'em_andamento' },
    { label: 'Concluído', value: 'concluido' },
    { label: 'Cancelado', value: 'cancelado' },
  ];
  const statusOrder = statusOptions.map((option) => option.value);

  const normalizeStatusSelection = (selection: Pedido['status'][]): Pedido['status'][] =>
    statusOrder.filter((value): value is Pedido['status'] => selection.includes(value));

  const arraysEqual = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((item) => b.includes(item));

  const normalizedDefaultStatuses = normalizeStatusSelection([...defaultStatusSelection]);
  const normalizedAllStatuses = normalizeStatusSelection([...allStatusValues]);

  const quickFilterValue = customFilter === 'vencendo'
    ? 'vencendo'
    : statusFilter.length === 1 && statusFilter[0] === 'em_andamento'
      ? 'em_andamento'
      : statusFilter.length === 1 && statusFilter[0] === 'concluido'
        ? 'concluido'
        : arraysEqual(statusFilter, normalizedDefaultStatuses)
          ? 'todos'
          : 'custom';

  const statusLabelMap = statusOptions.reduce<Record<Pedido['status'], string>>((acc, option) => {
    acc[option.value] = option.label;
    return acc;
  }, {} as Record<Pedido['status'], string>);

  const statusButtonLabel = (() => {
    if (statusFilter.length === 0) {
      return 'Status (0 selecionados)';
    }

    if (arraysEqual(statusFilter, normalizedDefaultStatuses)) {
      return 'Status (Ativos)';
    }

    if (arraysEqual(statusFilter, normalizedAllStatuses)) {
      return 'Status (Todos)';
    }

    const labels = statusFilter.map((value) => statusLabelMap[value]).filter(Boolean);
    if (labels.length <= 2) {
      return labels.join(', ');
    }

    return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`;
  })();

  const handleQuickFilterChange = (value: string) => {
    const defaultStatuses = normalizeStatusSelection([...defaultStatusSelection]);

    setSearchTerm('');
    setNivelFilter('todos');
    setStatusFilter(defaultStatuses);
    setCustomFilter(null);

    switch (value) {
      case 'vencendo':
        setCustomFilter('vencendo');
        setStatusFilter(defaultStatuses);
        break;
      case 'em_andamento':
        setStatusFilter(normalizeStatusSelection(['em_andamento']));
        break;
      case 'concluido':
        setStatusFilter(normalizeStatusSelection(['concluido']));
        break;
      default:
        setStatusFilter(defaultStatuses);
        break;
    }
  };

  // Filtrar pedidos baseado nos filtros aplicados
  const getFilteredPedidos = (): Pedido[] => {
    let pedidosFiltrados = pedidos
      .filter((pedido) => !pedido.excluido)
      .filter((pedido) => statusFilter.includes(pedido.status));

    // Aplicar filtros de busca
    if (searchTerm) {
      pedidosFiltrados = pedidosFiltrados.filter(p => 
        p.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.cidade_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.especialidades.some(e => e.toLowerCase().includes(searchTerm.toLowerCase())) ||
        p.cooperativa_solicitante_nome?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (nivelFilter !== 'todos') {
      pedidosFiltrados = pedidosFiltrados.filter(p => p.nivel_atual === nivelFilter);
    }

    if (customFilter === 'vencendo') {
      pedidosFiltrados = pedidosFiltrados.filter(
        (p) =>
          p.dias_restantes <= 7 &&
          (p.status === 'novo' || p.status === 'em_andamento'),
      );
    }

    return pedidosFiltrados;
  };

  useEffect(() => {
    if (!presetFilter) {
      return;
    }

    setStatusFilter(
      presetFilter.status && presetFilter.status !== 'todos'
        ? normalizeStatusSelection([presetFilter.status])
        : normalizeStatusSelection([...defaultStatusSelection])
    );
    setCustomFilter(presetFilter.custom ?? null);
    setSearchTerm('');
    setNivelFilter('todos');
  }, [presetFilter?.token, presetFilter?.status, presetFilter?.custom]);

  const pedidosFiltrados = getFilteredPedidos();

  const labelByPov = (p: Pedido) => {
    switch (p.ponto_de_vista) {
      case 'feita': return 'Solicitação feita';
      case 'recebida': return 'Solicitação recebida';
      case 'interna': return 'Interna';
      default: return 'Acompanhamento';
    }
  };

  const PedidoCard = ({ pedido }: { pedido: Pedido }) => {
    const { borderClass, backgroundClass, borderColor, backgroundColor } = getStatusCardColors(pedido.status);

    const especialidadesVisiveis = pedido.especialidades.slice(0, 3);
    const especialidadesRestantes = pedido.especialidades.length - especialidadesVisiveis.length;

    return (
      <Card
        key={pedido.id}
        className={`pedido-card cursor-pointer border-l-4 ${borderClass} ${backgroundClass}`}
        style={{
          borderLeftColor: borderColor,
          backgroundColor,
        }}
        onClick={() => onViewPedido(pedido)}
      >
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-gray-500">
            <span className="font-semibold text-gray-600">{labelByPov(pedido)}</span>
            {(pedido.responsavel_atual_nome || pedido.cooperativa_responsavel_nome) && (
              <span className="font-medium text-gray-500">
                Resp.: {pedido.responsavel_atual_nome || pedido.cooperativa_responsavel_nome}
              </span>
            )}
          </div>

          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-semibold text-gray-900 leading-snug line-clamp-2">
              {pedido.titulo}
            </h3>
            {pedido.dias_restantes <= 7 && (
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-gray-400" />
              <span>{pedido.cidade_nome}, {pedido.estado}</span>
            </span>
            <span className="flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-gray-400" />
              <span>{pedido.cooperativa_solicitante_nome}</span>
            </span>
          </div>

          {especialidadesVisiveis.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
              {especialidadesVisiveis.map((esp, index) => (
                <Badge key={index} variant="secondary" className="px-2 py-[2px]">
                  {esp}
                </Badge>
              ))}
              {especialidadesRestantes > 0 && (
                <Badge variant="outline" className="px-2 py-[2px] text-gray-500">
                  +{especialidadesRestantes}
                </Badge>
              )}
            </div>
          )}

          {(pedido.motivo_categoria || typeof pedido.beneficiarios_quantidade === 'number') && (
            <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
              {pedido.motivo_categoria && (
                <span className="flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-gray-400" />
                  <span>{pedido.motivo_categoria}</span>
                </span>
              )}
              {typeof pedido.beneficiarios_quantidade === 'number' && (
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-gray-400" />
                  <span>{pedido.beneficiarios_quantidade.toLocaleString('pt-BR')} beneficiários</span>
                </span>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={`${getNivelBadgeClass(pedido.nivel_atual)} px-2 py-[2px] text-[11px]`}
              >
                {pedido.nivel_atual}
              </Badge>
              <Badge
                className={`${getStatusBadgeClass(pedido.status)} px-2 py-[2px] text-[11px]`}
              >
                {pedido.status.replace('_', ' ')}
              </Badge>
            </div>
            <div className="flex items-center gap-1 text-gray-500">
              <Clock className="w-3.5 h-3.5" />
              <span className={pedido.dias_restantes <= 7 ? 'font-semibold text-red-500' : ''}>
                {pedido.dias_restantes}d
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const KanbanView = () => {
    const columns = [
      {
        id: 'novo',
        title: 'Backlog',
        pedidos: pedidosFiltrados.filter((p) => p.status === 'novo'),
        columnBg: 'bg-gradient-to-b from-[#F5F2FF] via-white to-white',
        headerColor: 'text-[#6C55D9]',
        badgeClass: 'bg-[#E6DFFF] text-[#6C55D9]',
        cardBg: 'bg-gradient-to-br from-[#F6F3FF] via-white to-white',
        accentDot: 'bg-[#7B6EF6]',
      },
      {
        id: 'em_andamento',
        title: 'Em andamento',
        pedidos: pedidosFiltrados.filter((p) => p.status === 'em_andamento'),
        columnBg: 'bg-gradient-to-b from-[#FFF2E8] via-white to-white',
        headerColor: 'text-[#D48C2B]',
        badgeClass: 'bg-[#FFE5CC] text-[#C8730E]',
        cardBg: 'bg-gradient-to-br from-[#FFF5EB] via-white to-white',
        accentDot: 'bg-[#F4B961]',
      },
      {
        id: 'concluido',
        title: 'Concluídos',
        pedidos: pedidosFiltrados.filter((p) => p.status === 'concluido'),
        columnBg: 'bg-gradient-to-b from-[#EAF6EF] via-white to-white',
        headerColor: 'text-[#2E8C63]',
        badgeClass: 'bg-[#DDF5E6] text-[#2E8C63]',
        cardBg: 'bg-gradient-to-br from-[#F0FBF4] via-white to-white',
        accentDot: 'bg-[#3EA975]',
      },
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {columns.map((column) => (
          <div
            key={column.id}
            className={cn(
              'rounded-3xl border border-white shadow-[0_24px_50px_-40px_rgba(107,86,217,0.5)] p-5 space-y-4',
              column.columnBg
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={cn('w-2 h-2 rounded-full', column.accentDot)} />
                <h3 className={cn('text-base font-semibold uppercase tracking-wide', column.headerColor)}>
                  {column.title}
                </h3>
              </div>
              <span
                className={cn(
                  'min-w-[32px] h-8 flex items-center justify-center rounded-full text-xs font-semibold shadow-sm',
                  column.badgeClass
                )}
              >
                {column.pedidos.length}
              </span>
            </div>
            <div className="space-y-4">
              {column.pedidos.length === 0 && (
                <div className="text-center py-8 text-sm text-gray-400 border border-dashed border-gray-200 rounded-2xl">
                  Nenhum pedido nesta etapa
                </div>
              )}
              {column.pedidos.map((pedido) => (
                <div
                  key={pedido.id}
                  className={cn(
                    'rounded-3xl p-5 space-y-4 border border-white/60 shadow-[0_24px_45px_-35px_rgba(88,71,192,0.55)] transition hover:-translate-y-0.5 hover:shadow-[0_28px_60px_-35px_rgba(88,71,192,0.6)]',
                    column.cardBg
                  )}
                  onClick={() => onViewPedido(pedido)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onViewPedido(pedido);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-base font-semibold text-gray-900 leading-snug">
                        {pedido.titulo}
                      </h4>
                      <p className="text-xs uppercase tracking-wide text-gray-400 mt-1">
                        {pedido.cooperativa_solicitante_nome || pedido.cooperativa_solicitante_id || '—'}
                      </p>
                    </div>
                    <Badge className="bg-white/80 text-[#6C55D9] border-none shadow-sm capitalize">
                      {pedido.nivel_atual}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {pedido.especialidades.map((esp, index) => (
                      <Badge
                        key={`${pedido.id}-kanban-${index}`}
                        variant="secondary"
                        className="px-3 py-[6px] text-xs font-medium bg-white/70 text-[#6C55D9] border border-white"
                      >
                        {esp}
                      </Badge>
                    ))}
                    {pedido.motivo_categoria && (
                      <Badge className="px-3 py-[6px] text-xs font-medium bg-[#FFF0F7] text-[#C23A82] border-none">
                        {pedido.motivo_categoria}
                      </Badge>
                    )}
                  </div>

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#7B6EF6]" />
                        <span className={pedido.dias_restantes <= 7 ? 'text-[#FF6B6B] font-semibold' : 'text-gray-600'}>
                          {pedido.dias_restantes} dia(s)
                        </span>
                      </div>
                      <button
                        type="button"
                        className="text-sm font-semibold text-[#5B3FD5] hover:text-[#3815B8]"
                        onClick={(event) => {
                          event.stopPropagation();
                          onViewPedido(pedido);
                        }}
                      >
                        Ver detalhes
                      </button>
                    </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const ListaView = () => {
    if (pedidosFiltrados.length === 0) {
      return (
        <div className="rounded-3xl border border-[#E7E8F7] bg-white py-16 text-center text-slate-500 shadow-sm">
          Nenhum pedido encontrado para os filtros atuais.
        </div>
      );
    }

    return (
      <div className="pedidos-tabela" role="region" aria-live="polite">
        <div className="pedidos-tabela__card">
          <table className="pedidos-tabela__table">
            <thead className="pedidos-tabela__head">
              <tr>
                <th>Título</th>
                <th>Cidade / UF</th>
                <th>Especialidades</th>
                <th>Solicitante</th>
                <th>Responsável</th>
                <th>Nível</th>
                <th>Status</th>
                <th>Prazo</th>
                <th className="pedidos-tabela__actions">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pedidosFiltrados.map((pedido, index) => {
                const prazoCritico = pedido.dias_restantes <= 7;
                const especialidadesVisiveis = pedido.especialidades.slice(0, 3);
                const especialidadesExtras = pedido.especialidades.length - especialidadesVisiveis.length;

                return (
                  <tr
                    key={pedido.id}
                    className={cn('pedidos-tabela__row', {
                      'is-first': index === 0,
                    })}
                    onClick={() => onViewPedido(pedido)}
                  >
                    <td className="pedidos-tabela__cell pedidos-tabela__cell--title">
                      <div className="pedidos-tabela__title">{pedido.titulo}</div>
                    </td>
                    <td className="pedidos-tabela__cell pedidos-tabela__cell--city">
                      <div className="pedidos-tabela__city">
                        {pedido.cidade_nome && pedido.estado
                          ? `${pedido.cidade_nome} / ${pedido.estado}`
                          : pedido.cidade_nome || 'Cidade não informada'}
                      </div>
                    </td>
                    <td className="pedidos-tabela__cell">
                      <div className="pedidos-chips">
                        {especialidadesVisiveis.length === 0 ? (
                          <span className="pedidos-chips__empty">—</span>
                        ) : (
                          especialidadesVisiveis.map((esp, idx) => (
                            <Badge key={`${pedido.id}-esp-${idx}`} variant="outline" className="pedidos-chip">
                              {esp}
                            </Badge>
                          ))
                        )}
                        {especialidadesExtras > 0 && (
                          <Badge variant="outline" className="pedidos-chip pedidos-chip--extra">
                            +{especialidadesExtras}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="pedidos-tabela__cell">
                      {pedido.cooperativa_solicitante_nome || '—'}
                    </td>
                    <td className="pedidos-tabela__cell">
                      {pedido.responsavel_atual_nome || pedido.cooperativa_responsavel_nome || '—'}
                    </td>
                    <td className="pedidos-tabela__cell">
                      <Badge
                        variant="outline"
                        className={cn('pedidos-nivel-badge', `pedidos-nivel-badge--${pedido.nivel_atual}`)}
                      >
                        {pedido.nivel_atual}
                      </Badge>
                    </td>
                    <td className="pedidos-tabela__cell">
                      <Badge
                        variant="outline"
                        className={cn('pedidos-status-badge', `pedidos-status-badge--${pedido.status}`)}
                      >
                        {pedido.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="pedidos-tabela__cell pedidos-tabela__cell--prazo">
                      <div className={cn('pedidos-prazo', { 'is-critical': prazoCritico })}>
                        <Clock className="pedidos-prazo__icon" />
                        <span>{pedido.dias_restantes}d</span>
                      </div>
                    </td>
                    <td className="pedidos-tabela__cell pedidos-tabela__cell--actions">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="pedidos-detalhes"
                        onClick={(event) => {
                          event.stopPropagation();
                          onViewPedido(pedido);
                        }}
                      >
                        Ver detalhes
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="section-stack">
      {/* Header */}
      <div className="space-y-1 max-w-3xl">
        <h1 className="text-3xl font-semibold text-gray-900">Pedidos de Credenciamento</h1>
        <p className="text-gray-600 leading-relaxed">
          Gerencie pedidos de credenciamento e suprimento da rede com visibilidade sobre status, níveis e prazos.
        </p>
      </div>

      {/* Filtros */}
      <Card className="filtros-card">
        <CardContent>
          {customFilter === 'vencendo' && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-red-700">
                <AlertCircle className="w-4 h-4" />
                Filtrando pedidos que vencem em até 7 dias
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleQuickFilterChange('todos')}>
                Limpar filtro
              </Button>
            </div>
          )}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col md:flex-row gap-4 flex-1 w-full">
              <Select value={quickFilterValue} onValueChange={handleQuickFilterChange}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filtro rápido" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os pedidos</SelectItem>
                  <SelectItem value="vencendo">Vencendo em 7 dias</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluido">Concluídos</SelectItem>
                </SelectContent>
              </Select>

              <div className="relative flex-1 md:max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Buscar pedidos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full md:w-48 justify-between"
                  >
                    <span className="truncate text-left">{statusButtonLabel}</span>
                    <svg
                      className="ml-2 h-4 w-4 text-slate-500"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-56 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <button
                      type="button"
                      className="hover:text-slate-800"
                      onClick={() => setStatusFilter(normalizeStatusSelection([...defaultStatusSelection]))}
                    >
                      Ativos
                    </button>
                    <button
                      type="button"
                      className="hover:text-slate-800"
                      onClick={() => setStatusFilter(normalizeStatusSelection([...allStatusValues]))}
                    >
                      Todos
                    </button>
                  </div>
                  <div className="space-y-2">
                    {statusOptions.map((option) => {
                      const isChecked = statusFilter.includes(option.value);
                      return (
                        <label
                          key={option.value}
                          className="flex items-center gap-2 text-sm text-slate-700"
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              setStatusFilter((prev) => {
                                const next = checked
                                  ? [...prev, option.value]
                                  : prev.filter((status) => status !== option.value);
                                return normalizeStatusSelection(Array.from(new Set(next)) as Pedido['status'][]);
                              });
                            }}
                          />
                          <span>{option.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>

              <Select value={nivelFilter} onValueChange={setNivelFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Nível" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os níveis</SelectItem>
                  <SelectItem value="singular">Singular</SelectItem>
                  <SelectItem value="federacao">Federação</SelectItem>
                  <SelectItem value="confederacao">Confederação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'lista' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('lista')}
                className={viewMode === 'lista' ? 'bg-purple-600 hover:bg-purple-700' : ''}
              >
                Lista
              </Button>
              <Button
                variant={viewMode === 'kanban' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('kanban')}
              >
                Kanban
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conteúdo */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-600 space-y-3">
          <div className="w-10 h-10 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p>Carregando pedidos...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-600 font-medium">
          Erro: {error}
        </div>
      ) : (
        <>
          {viewMode === 'kanban' ? <KanbanView /> : <ListaView />}
        </>
      )}

    </div>
  );
}
