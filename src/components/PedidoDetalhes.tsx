import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  MapPin,
  Calendar,
  User,
  Clock,
  AlertTriangle,
  CheckCircle,
  MessageSquare,
  History,
  Users,
  MoreVertical,
} from 'lucide-react';
import { Pedido, AuditoriaLog } from '../types';
import { getNivelBadgeClass, getStatusBadgeClass } from '../utils/pedidoStyles';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { renderMarkdown } from '../utils/markdown';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface PedidoDetalhesProps {
  pedido: Pedido;
  onClose: () => void;
  onUpdatePedido: (pedidoId: string, updates: Partial<Pedido>) => void;
}

const comentarioRegex = /\(\d{2}\/\d{2}\/\d{4}.*\):/;

const extractInitialJustificativa = (conteudo: string) => {
  const lines = conteudo.split('\n');
  const cutoff = lines.findIndex((line) => comentarioRegex.test(line));
  if (cutoff === -1) return conteudo.trim();
  return lines.slice(0, cutoff).join('\n').trim();
};

export function PedidoDetalhes({ pedido, onClose, onUpdatePedido }: PedidoDetalhesProps) {
  const [novoStatus, setNovoStatus] = useState(pedido.status);
  const [comentario, setComentario] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAssumindo, setIsAssumindo] = useState(false);
  const [isLiberando, setIsLiberando] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  const { user } = useAuth();

  const [auditoriaLogs, setAuditoriaLogs] = useState<AuditoriaLog[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadAuditoria = async () => {
      try {
        const data = await apiService.getPedidoAuditoria(pedido.id);
        if (mounted) setAuditoriaLogs(data);
      } catch (e) {
        console.error('Erro ao buscar auditoria do pedido:', e);
        if (mounted) setAuditoriaLogs([]);
      }
    };
    loadAuditoria();
    return () => { mounted = false; };
  }, [pedido.id]);

  useEffect(() => {
    setNovoStatus(pedido.status);
  }, [pedido.status]);

  const applyUpdatedPedido = async (updated: Pedido, options?: { resetComment?: boolean }) => {
    onUpdatePedido(pedido.id, updated);
    try {
      window.dispatchEvent(new CustomEvent('pedido:updated', {
        detail: {
          id: pedido.id,
          updates: updated,
        },
      }));
    } catch {}

    try {
      const data = await apiService.getPedidoAuditoria(pedido.id);
      setAuditoriaLogs(data);
    } catch (e) {
      console.error('Erro ao recarregar auditoria após update:', e);
    }

    setNovoStatus(updated.status);
    if (options?.resetComment) {
      setComentario('');
    }
  };

  const getPriorityIcon = (diasRestantes: number) => {
    if (diasRestantes <= 3) return <AlertTriangle className="w-5 h-5 text-red-500" />;
    if (diasRestantes <= 7) return <Clock className="w-5 h-5 text-yellow-500" />;
    return <CheckCircle className="w-5 h-5 text-green-500" />;
  };

  const userEmailLower = user?.email?.toLowerCase() || null;
  const pedidoCreatorLower = pedido.criado_por_user?.toLowerCase() || null;
  const canChangeStatus = !!user && (
    user.papel === 'confederacao'
      || (user.papel === 'admin' && pedido.cooperativa_solicitante_id === user.cooperativa_id)
      || pedido.cooperativa_responsavel_id === user.cooperativa_id
  );
  const canAddUpdate = canChangeStatus
    || (!!user && user.papel === 'operador' && (
      (pedidoCreatorLower && userEmailLower && pedidoCreatorLower === userEmailLower)
      || (!pedido.criado_por_user && pedido.cooperativa_solicitante_id === user.cooperativa_id)
    ));

  const canDelete = () => {
    if (!user) return false;
    if (user.papel === 'confederacao') return true;
    if (user.papel === 'admin' && pedido.cooperativa_solicitante_id === user.cooperativa_id) return true;
    if (user.papel === 'operador') {
      // Operador que criou pode excluir (ou legado sem campo, se da mesma solicitante)
      const legacySameSolic = (pedido.cooperativa_solicitante_id === user.cooperativa_id) && !pedido.criado_por_user;
      const isCreator = userEmailLower && pedidoCreatorLower && userEmailLower === pedidoCreatorLower;
      return isCreator || legacySameSolic;
    }
    return false;
  };

  const handleDelete = async () => {
    if (!canDelete() || isDeleting) return;
    if (!confirm('Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita.')) return;
    try {
      setIsDeleting(true);
      await apiService.deletePedido(pedido.id);
      try {
        window.dispatchEvent(new CustomEvent('pedido:deleted', { detail: { id: pedido.id } }));
      } catch {}
      onClose();
    } catch (e) {
      console.error('Erro ao excluir pedido:', e);
      alert('Erro ao excluir pedido.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateStatus = async () => {
    const trimmedComment = comentario.trim();
    if (!canAddUpdate || isUpdating) return;
    if (!trimmedComment && (!canChangeStatus || novoStatus === pedido.status)) return;

    setIsUpdating(true);
    try {
      const updates: (Partial<Pedido> & { comentario_atual?: string }) = {};

      if (canChangeStatus && novoStatus !== pedido.status) {
        updates.status = novoStatus as Pedido['status'];
      }

      const userName = user?.display_name || user?.nome || 'Responsável';

      if (canChangeStatus && novoStatus === 'em_andamento' && user) {
        updates.responsavel_atual_id = user.id;
        updates.responsavel_atual_nome = userName;
      }

      if (trimmedComment) {
        const existingObservacoes = pedido.observacoes ? pedido.observacoes.trimEnd() : '';
        const prefix = existingObservacoes ? `${existingObservacoes}\n` : '';
        updates.observacoes = `${prefix}${userName} (${new Date().toLocaleString('pt-BR')}): ${trimmedComment}`;
        updates.comentario_atual = trimmedComment;
      }

      const updatedPedido = await apiService.updatePedido(pedido.id, updates);

      await applyUpdatedPedido(updatedPedido, { resetComment: true });
    } catch (e) {
      console.error('Erro ao atualizar status do pedido:', e);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAssumirPedido = async () => {
    if (!user || isAssumindo) return;
    setIsAssumindo(true);
    try {
      const updates: Partial<Pedido> = {
        responsavel_atual_id: user.id,
        responsavel_atual_nome: user.display_name || user.nome || user.email,
      };
      const updatedPedido = await apiService.updatePedido(pedido.id, updates);
      await applyUpdatedPedido(updatedPedido);
    } catch (e) {
      console.error('Erro ao assumir pedido:', e);
    } finally {
      setIsAssumindo(false);
    }
  };

  const handleLiberarPedido = async () => {
    if (isLiberando) return;
    setIsLiberando(true);
    try {
      const updates = {
        responsavel_atual_id: null,
        responsavel_atual_nome: null,
      } as Partial<Pedido>;
      const updatedPedido = await apiService.updatePedido(pedido.id, updates);
      await applyUpdatedPedido(updatedPedido);
    } catch (e) {
      console.error('Erro ao liberar pedido:', e);
    } finally {
      setIsLiberando(false);
    }
  };

  const handleTransferirPedido = async () => {
    if (!canTransfer || isTransferring) return;
    if (!confirm('Deseja transferir este pedido para o próximo nível imediatamente?')) return;
    setIsTransferring(true);
    try {
      const updatedPedido = await apiService.transferirPedido(pedido.id);
      await applyUpdatedPedido(updatedPedido);
    } catch (error) {
      console.error('Erro ao transferir pedido:', error);
      alert('Não foi possível transferir o pedido. Tente novamente mais tarde.');
    } finally {
      setIsTransferring(false);
    }
  };

  const formatDate = (value: string | Date) => {
    return new Date(value).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateShort = (value: string | Date) => {
    return new Date(value).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const hasComment = comentario.trim().length > 0;
  const sameCooperativaResponsavel = !!(user && pedido.cooperativa_responsavel_id === user.cooperativa_id);
  const isResponsavelAtual = !!(user && pedido.responsavel_atual_id === user.id);
  const canAssumir = canChangeStatus && sameCooperativaResponsavel && !isResponsavelAtual;
  const canLiberar = canChangeStatus && !!pedido.responsavel_atual_id;
  const canTransfer = !!user && pedido.nivel_atual !== 'confederacao' && (
    canChangeStatus || pedido.cooperativa_solicitante_id === user.cooperativa_id
  );

  const justificativaInicial = pedido.observacoes
    ? extractInitialJustificativa(pedido.observacoes)
    : '';

  return (
    <Dialog open onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent
        className="w-full max-h-[90vh] overflow-y-auto p-0"
        style={{ maxWidth: '960px' }}
      >
        <DialogHeader className="border-b p-6 text-left">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-xl font-semibold text-gray-900">
                {pedido.titulo}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-gray-500">
                ID: {pedido.id} • Criado em {formatDateShort(pedido.data_criacao)}
              </DialogDescription>
              <p className="text-xs text-gray-600 mt-1">
                {pedido.ponto_de_vista === 'feita' && 'Solicitação feita'}
                {pedido.ponto_de_vista === 'recebida' && 'Solicitação recebida'}
                {pedido.ponto_de_vista === 'interna' && 'Interna'}
                {(!pedido.ponto_de_vista || pedido.ponto_de_vista === 'acompanhamento') && 'Acompanhamento'}
                {(pedido.responsavel_atual_nome || pedido.cooperativa_responsavel_nome)
                  ? ` • Responsável: ${pedido.responsavel_atual_nome || pedido.cooperativa_responsavel_nome}`
                  : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {canDelete() && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Mais opções">
                      <MoreVertical className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={handleDelete}
                      disabled={isDeleting}
                    >
                      {isDeleting ? 'Excluindo...' : 'Excluir pedido'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6">
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
                      <label className="text-sm font-medium text-gray-600">Responsável</label>
                      <p className="font-medium">{pedido.cooperativa_responsavel_nome || 'A definir'}</p>
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
                        <Badge className={getStatusBadgeClass(pedido.status)}>
                          {pedido.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-600">Nível Atual</label>
                      <div className="mt-1">
                        <Badge variant="outline" className={getNivelBadgeClass(pedido.nivel_atual)}>
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
                      {pedido.status === 'concluido' && pedido.data_conclusao ? (
                        <div className="mt-1">
                          <p className="font-medium text-green-700">
                            Concluído em <span className="font-semibold">{pedido.dias_para_concluir ?? 0}</span> dia(s)
                          </p>
                          <p className="text-sm text-gray-500">
                            Data de conclusão: {formatDateShort(pedido.data_conclusao)}
                          </p>
                        </div>
                      ) : (
                        <div>
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
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      {canAssumir && (
                        <Button
                          size="sm"
                          onClick={handleAssumirPedido}
                          disabled={isAssumindo}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {isAssumindo ? 'Assumindo...' : 'Assumir pedido'}
                        </Button>
                      )}
                      {canLiberar && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleLiberarPedido}
                          disabled={isLiberando}
                        >
                          {isLiberando ? 'Liberando...' : 'Liberar responsabilidade'}
                        </Button>
                      )}
                      {canTransfer && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={handleTransferirPedido}
                          disabled={isTransferring}
                        >
                          {isTransferring ? 'Transferindo...' : 'Transferir pedido'}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Observações */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MessageSquare className="w-5 h-5 mr-2" />
                    Justificativa
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {justificativaInicial ? (
                    <div
                      className="prose prose-sm max-w-none text-gray-700"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(justificativaInicial) }}
                    />
                  ) : (
                    <p className="text-gray-500">Nenhuma justificativa cadastrada.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="andamento" className="space-y-6">
              {canAddUpdate ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Atualizar Status</CardTitle>
                    <CardDescription>
                      {canChangeStatus
                        ? 'Atualize o status do pedido e adicione comentários'
                        : 'Adicione comentários para manter o andamento atualizado'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600 mb-2 block">
                        Novo Status
                      </label>
                      <Select
                        value={novoStatus}
                        onValueChange={(value) => {
                          if (canChangeStatus) setNovoStatus(value);
                        }}
                      >
                        <SelectTrigger disabled={!canChangeStatus}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="novo">Novo</SelectItem>
                          <SelectItem value="em_andamento">Em Andamento</SelectItem>
                          <SelectItem value="concluido">Concluído</SelectItem>
                        </SelectContent>
                      </Select>
                      {!canChangeStatus && (
                        <p className="mt-2 text-xs text-gray-500">
                          Apenas responsáveis com permissão podem alterar o status. Você ainda pode registrar atualizações para o histórico.
                        </p>
                      )}
                    </div>
                    
                  <div>
                    <label className="text-sm font-medium text-gray-600 mb-2 block">
                      Comentário (Markdown opcional)
                    </label>
                    <Textarea
                      value={comentario}
                      onChange={(e) => setComentario(e.target.value)}
                      placeholder="Use markdown, ex.: **importante**, _texto_, - lista"
                      rows={4}
                    />
                    {comentario.trim() && (
                      <div className="mt-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                        <h4 className="mb-2 text-xs uppercase tracking-wide text-gray-500">Pré-visualização</h4>
                        <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(comentario) }} />
                      </div>
                    )}
                  </div>
                    
                    <Button 
                      onClick={handleUpdateStatus}
                      disabled={!canAddUpdate || isUpdating || (!hasComment && (!canChangeStatus || novoStatus === pedido.status))}
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
                      auditoriaLogs.map((log) => {
                        const detalhes = (log.detalhes || '')
                          .split('|')
                          .map((item) => item.trim())
                          .filter(Boolean);

                        return (
                          <div
                            key={log.id}
                            className="relative flex items-start space-x-3 rounded-lg bg-gray-50 p-3"
                          >
                            <span
                              className="absolute right-3 top-3 rounded-full text-xs font-medium"
                              style={{ backgroundColor: '#01CABE', color: '#00FFF0', padding: '5px 10px' }}
                            >
                              por {log.usuario_display_nome || log.usuario_nome}
                            </span>
                            <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900">{log.acao}</p>
                              {detalhes.map((item, index) => {
                                const isComentario = item.toLowerCase().startsWith('comentário:');
                                const content = isComentario
                                  ? item.replace(/^Comentário:\s*/i, '')
                                  : item;
                                return isComentario ? (
                                  <div
                                    key={index}
                                    className="mt-2 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700"
                                    dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                                  />
                                ) : (
                                  <p key={index} className="mt-1 text-sm text-gray-700">
                                    {item}
                                  </p>
                                );
                              })}
                              <p className="mt-1 text-xs text-gray-500">{formatDate(log.timestamp)}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
