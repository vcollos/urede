import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  Search, 
  Plus, 
  Filter,
  Calendar,
  MapPin,
  User,
  Clock,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { Pedido } from '../types';
import { getNivelBadgeClass, getStatusBadgeClass, getStatusCardColors } from '../utils/pedidoStyles';

interface PedidosListaProps {
  onCreatePedido: () => void;
  onViewPedido: (pedido: Pedido) => void;
}

export function PedidosLista({ onCreatePedido, onViewPedido }: PedidosListaProps) {
  const { user, isAuthenticated } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [nivelFilter, setNivelFilter] = useState('todos');
  const [viewMode, setViewMode] = useState<'lista' | 'kanban'>('kanban');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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

    return pedidosFiltrados;
  };

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
        <CardContent>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span className="uppercase tracking-wide font-semibold text-gray-600">
              {labelByPov(pedido)}
            </span>
            {(pedido.responsavel_atual_nome || pedido.cooperativa_responsavel_nome) && (
              <span>
                Resp.: {pedido.responsavel_atual_nome || pedido.cooperativa_responsavel_nome}
              </span>
            )}
          </div>

          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-semibold text-gray-900 leading-snug line-clamp-2">
              {pedido.titulo}
            </h3>
            {pedido.dias_restantes <= 7 && (
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            )}
          </div>

          <div className="pedido-card__meta">
            <span className="flex items-center gap-2">
              <MapPin />
              <span>{pedido.cidade_nome}, {pedido.estado}</span>
            </span>
            <span className="flex items-center gap-2">
              <User />
              <span>{pedido.cooperativa_solicitante_nome}</span>
            </span>
          </div>

          <div className="pedido-card__tags">
            {pedido.especialidades.map((esp, index) => (
              <Badge key={index} variant="secondary">
                {esp}
              </Badge>
            ))}
          </div>

          <div className="pedido-card__status">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className={getNivelBadgeClass(pedido.nivel_atual)}>
                {pedido.nivel_atual}
              </Badge>
              <Badge className={getStatusBadgeClass(pedido.status)}>
                {pedido.status.replace('_', ' ')}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
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
        {isAuthenticated && (
        <Button onClick={() => { onCreatePedido(); }} className="bg-purple-600 hover:bg-purple-700 self-start sm:self-auto">
          <Plus className="w-5 h-5 mr-2" />
          Novo Pedido
        </Button>
        )}
      </div>

      {/* Filtros */}
      <Card className="filtros-card">
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col md:flex-row gap-4 flex-1 w-full">
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
