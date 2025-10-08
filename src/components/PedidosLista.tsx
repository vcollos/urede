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
  UploadCloud,
  Plus,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { Pedido } from '../types';
import { getNivelBadgeClass, getStatusBadgeClass, getStatusCardColors } from '../utils/pedidoStyles';

export type PedidosFilterPreset = {
  status?: Pedido['status'] | 'todos';
  custom?: 'vencendo' | null;
  token?: number;
};

interface PedidosListaProps {
  onCreatePedido: () => void;
  onViewPedido: (pedido: Pedido) => void;
  presetFilter?: PedidosFilterPreset | null;
  onOpenImportacao?: () => void;
}

export function PedidosLista({ onCreatePedido, onViewPedido, presetFilter, onOpenImportacao }: PedidosListaProps) {
  const { user, isAuthenticated } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<Pedido['status'] | 'todos'>('todos');
  const [nivelFilter, setNivelFilter] = useState('todos');
  const [viewMode, setViewMode] = useState<'lista' | 'kanban'>('kanban');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [customFilter, setCustomFilter] = useState<'vencendo' | null>(null);

  // Carregar pedidos
  useEffect(() => {
    const loadPedidos = async () => {
      try {
        setIsLoading(true);
        const pedidosData = await apiService.getPedidos();
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

  const canCreatePedido = !!user && ['operador', 'admin', 'confederacao'].includes(user.papel);

  const quickFilterValue = customFilter === 'vencendo'
    ? 'vencendo'
    : statusFilter === 'em_andamento'
      ? 'em_andamento'
      : statusFilter === 'concluido'
        ? 'concluido'
        : 'todos';

  const handleQuickFilterChange = (value: string) => {
    setSearchTerm('');
    setNivelFilter('todos');
    setCustomFilter(null);

    switch (value) {
      case 'vencendo':
        setCustomFilter('vencendo');
        setStatusFilter('todos');
        break;
      case 'em_andamento':
        setStatusFilter('em_andamento');
        break;
      case 'concluido':
        setStatusFilter('concluido');
        break;
      default:
        setStatusFilter('todos');
        break;
    }
  };

  // Filtrar pedidos baseado nos filtros aplicados
  const getFilteredPedidos = (): Pedido[] => {
    let pedidosFiltrados = pedidos.filter((pedido) => !pedido.excluido);

    // Aplicar filtros de busca
    if (searchTerm) {
      pedidosFiltrados = pedidosFiltrados.filter(p => 
        p.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.cidade_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.especialidades.some(e => e.toLowerCase().includes(searchTerm.toLowerCase())) ||
        p.cooperativa_solicitante_nome?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'todos') {
      pedidosFiltrados = pedidosFiltrados.filter(p => p.status === statusFilter);
    }

    if (nivelFilter !== 'todos') {
      pedidosFiltrados = pedidosFiltrados.filter(p => p.nivel_atual === nivelFilter);
    }

    if (customFilter === 'vencendo') {
      pedidosFiltrados = pedidosFiltrados.filter(p => p.dias_restantes <= 7 && p.status !== 'concluido');
    }

    return pedidosFiltrados;
  };

  useEffect(() => {
    if (!presetFilter) {
      return;
    }

    setStatusFilter(presetFilter.status ?? 'todos');
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
    const colunas = [
      { id: 'novo', title: 'Novos', pedidos: pedidosFiltrados.filter(p => p.status === 'novo') },
      { id: 'em_andamento', title: 'Em Andamento', pedidos: pedidosFiltrados.filter(p => p.status === 'em_andamento') },
      { id: 'concluido', title: 'Concluídos', pedidos: pedidosFiltrados.filter(p => p.status === 'concluido') }
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {colunas.map((coluna) => (
          <div key={coluna.id} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">{coluna.title}</h3>
              <Badge variant="secondary">{coluna.pedidos.length}</Badge>
            </div>
            <div className="space-y-4">
              {coluna.pedidos.map((pedido) => (
                <PedidoCard key={pedido.id} pedido={pedido} />
              ))}
              {coluna.pedidos.length === 0 && (
                <div className="text-center py-8 text-gray-500 border border-dashed border-gray-200 rounded-xl">
                  Nenhum pedido
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const ListaView = () => (
    <div className="space-y-6">
      {pedidosFiltrados.map((pedido) => (
        <PedidoCard key={pedido.id} pedido={pedido} />
      ))}
      {pedidosFiltrados.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">Nenhum pedido encontrado</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="section-stack">
      {/* Header com ações */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 max-w-3xl">
          <h1 className="text-3xl font-semibold text-gray-900">Pedidos de Credenciamento</h1>
          <p className="text-gray-600 leading-relaxed">
            Gerencie pedidos de credenciamento e suprimento da rede com visibilidade sobre status, níveis e prazos.
          </p>
        </div>
        {canCreatePedido && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="flex items-center gap-2" onClick={onCreatePedido}>
              <Plus className="h-4 w-4" />
              Novo pedido
            </Button>
            {typeof onOpenImportacao === 'function' && (
              <Button
                size="sm"
                variant="secondary"
                className="flex items-center gap-2"
                onClick={onOpenImportacao}
              >
                <UploadCloud className="h-4 w-4" />
                Pedidos em lote
              </Button>
            )}
          </div>
        )}
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
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  <SelectItem value="novo">Novo</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                </SelectContent>
              </Select>
              
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
                variant={viewMode === 'kanban' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('kanban')}
              >
                Kanban
              </Button>
              <Button
                variant={viewMode === 'lista' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('lista')}
              >
                Lista
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
