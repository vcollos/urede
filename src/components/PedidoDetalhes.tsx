import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  X, 
  MapPin, 
  Calendar, 
  User, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  History,
  Users
} from 'lucide-react';
import { Pedido, AuditoriaLog } from '../types';
import { mockAuditoria, currentUser } from '../data/mockData';

interface PedidoDetalhesProps {
  pedido: Pedido;
  onClose: () => void;
  onUpdatePedido: (pedidoId: string, updates: Partial<Pedido>) => void;
}

export function PedidoDetalhes({ pedido, onClose, onUpdatePedido }: PedidoDetalhesProps) {
  const [novoStatus, setNovoStatus] = useState(pedido.status);
  const [comentario, setComentario] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const auditoriaLogs = mockAuditoria.filter(log => log.pedido_id === pedido.id);

  const getNivelBadgeColor = (nivel: string) => {
    switch (nivel) {
      case 'singular': return 'bg-green-100 text-green-800 border-green-200';
      case 'federacao': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'confederacao': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'novo': return 'bg-blue-100 text-blue-800';
      case 'em_andamento': return 'bg-yellow-100 text-yellow-800';
      case 'concluido': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityIcon = (diasRestantes: number) => {
    if (diasRestantes <= 3) return <AlertTriangle className="w-5 h-5 text-red-500" />;
    if (diasRestantes <= 7) return <Clock className="w-5 h-5 text-yellow-500" />;
    return <CheckCircle className="w-5 h-5 text-green-500" />;
  };

  const canUpdateStatus = () => {
    // Verificar se o usuário pode atualizar o pedido
    if (currentUser.papel === 'confederacao') return true;
    if (currentUser.papel === 'federacao' && (pedido.nivel_atual === 'federacao' || pedido.nivel_atual === 'singular')) return true;
    if (currentUser.papel === 'admin' || currentUser.papel === 'operador') {
      return pedido.responsavel_atual_id === currentUser.id || 
             pedido.cooperativa_solicitante_id === currentUser.cooperativa_id;
    }
    return false;
  };

  const handleUpdateStatus = async () => {
    if (!canUpdateStatus() || isUpdating) return;

    setIsUpdating(true);
    
    // Simular API call
    setTimeout(() => {
      onUpdatePedido(pedido.id, { 
        status: novoStatus as any,
        data_ultima_alteracao: new Date()
      });
      
      // Adicionar log de auditoria (mock)
      if (comentario.trim()) {
        // Em um sistema real, isso seria salvo via API
        console.log('Novo comentário:', comentario);
      }
      
      setIsUpdating(false);
      setComentario('');
    }, 1000);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateShort = (date: Date) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-gray-900 truncate">
              {pedido.titulo}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              ID: {pedido.id} • Criado em {formatDateShort(pedido.data_criacao)}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6">
          <Tabs defaultValue="detalhes" className="h-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
              <TabsTrigger value="andamento">Andamento</TabsTrigger>
              <TabsTrigger value="historico">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="detalhes" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Informações Principais */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <User className="w-5 h-5 mr-2" />
                      Informações Principais
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Solicitante</label>
                      <p className="font-medium">{pedido.cooperativa_solicitante_nome}</p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-600">Local de Atendimento</label>
                      <div className="flex items-center mt-1">
                        <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                        <p className="font-medium">{pedido.cidade_nome}, {pedido.estado}</p>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-600">Especialidades</label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {pedido.especialidades.map((esp, index) => (
                          <Badge key={index} variant="secondary">
                            {esp}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-600">Quantidade</label>
                      <p className="font-medium">{pedido.quantidade} prestador(es)</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Status e Responsabilidade */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Clock className="w-5 h-5 mr-2" />
                      Status e Responsabilidade
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Status Atual</label>
                      <div className="mt-1">
                        <Badge className={getStatusBadgeColor(pedido.status)}>
                          {pedido.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-600">Nível Atual</label>
                      <div className="mt-1">
                        <Badge variant="outline" className={getNivelBadgeColor(pedido.nivel_atual)}>
                          {pedido.nivel_atual}
                        </Badge>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-600">Responsável</label>
                      <p className="font-medium">
                        {pedido.responsavel_atual_nome || 'Aguardando atribuição'}
                      </p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-600">Prazo</label>
                      <div className="flex items-center mt-1">
                        {getPriorityIcon(pedido.dias_restantes)}
                        <span className={`ml-2 font-medium ${
                          pedido.dias_restantes <= 7 ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          {pedido.dias_restantes} dias restantes
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        Vencimento: {formatDateShort(pedido.prazo_atual)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Observações */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MessageSquare className="w-5 h-5 mr-2" />
                    Observações
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {pedido.observacoes || 'Nenhuma observação adicional.'}
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="andamento" className="space-y-6">
              {canUpdateStatus() ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Atualizar Status</CardTitle>
                    <CardDescription>
                      Atualize o status do pedido e adicione comentários
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600 mb-2 block">
                        Novo Status
                      </label>
                      <Select value={novoStatus} onValueChange={setNovoStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="novo">Novo</SelectItem>
                          <SelectItem value="em_andamento">Em Andamento</SelectItem>
                          <SelectItem value="concluido">Concluído</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-600 mb-2 block">
                        Comentário (opcional)
                      </label>
                      <Textarea
                        value={comentario}
                        onChange={(e) => setComentario(e.target.value)}
                        placeholder="Adicione detalhes sobre a atualização..."
                        rows={3}
                      />
                    </div>
                    
                    <Button 
                      onClick={handleUpdateStatus}
                      disabled={isUpdating || novoStatus === pedido.status}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {isUpdating ? 'Atualizando...' : 'Atualizar Pedido'}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-gray-500">
                      Você não tem permissão para atualizar este pedido.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="historico" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <History className="w-5 h-5 mr-2" />
                    Histórico de Atividades
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {auditoriaLogs.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">
                        Nenhuma atividade registrada
                      </p>
                    ) : (
                      auditoriaLogs.map((log) => (
                        <div key={log.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900">{log.acao}</p>
                            <p className="text-sm text-gray-600">por {log.usuario_nome}</p>
                            {log.detalhes && (
                              <p className="text-sm text-gray-700 mt-1">{log.detalhes}</p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDate(log.timestamp)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}