import { useState, useEffect, FormEvent, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Checkbox } from './ui/checkbox';
import { 
  Search, 
  Plus, 
  Phone,
  Building,
  Edit,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { Operador, Cooperativa, PendingUserApproval } from '../types';
import { deriveRole, toBaseRole, describeRole } from '../utils/roleMapping';
import { hasWhatsAppFlag } from '../utils/whatsapp';
import { normalizeModuleAccess } from '../utils/moduleAccess';
import { authService } from '../services/authService';
import { Alert, AlertDescription } from './ui/alert';

interface OperadoresListaProps {
  onRequestEdit?: (operador: Operador) => void;
  onEditOperador?: (operador: Operador) => void;
}

export function OperadoresLista({ onRequestEdit, onEditOperador }: OperadoresListaProps = {}) {
  const { user, isAuthenticated, refreshUser } = useAuth();
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [cooperativas, setCooperativas] = useState<Cooperativa[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cooperativaFilter, setCooperativaFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingOperador, setEditingOperador] = useState<Operador | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [editForm, setEditForm] = useState({
    nome: '',
    cargo: '',
    telefone: '',
    wpp: false,
    ativo: true,
    papel: 'operador' as 'operador' | 'admin',
    definir_senha: false,
    senha_provisoria: '',
    confirmar_senha: '',
    forcar_troca_senha: true,
    cooperativas_ids: [] as string[],
    cooperativa_principal_id: '',
    modulos_acesso: ['hub'] as Array<'hub' | 'urede'>,
  });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createForm, setCreateForm] = useState({
    nome: '',
    email: '',
    cargo: '',
    telefone: '',
    wpp: false,
    id_singular: '',
    senha_provisoria: '',
    confirmar_senha: '',
    forcar_troca_senha: true,
    cooperativas_ids: [] as string[],
    cooperativa_principal_id: '',
    modulos_acesso: ['hub'] as Array<'hub' | 'urede'>,
  });
  const fetchPendingApprovals = useCallback(async () => {
    if (!user || user.papel !== 'admin' || user.approval_status !== 'approved') {
      setPendingApprovals([]);
      return;
    }

    try {
      setIsLoadingPending(true);
      setPendingError('');
      const result = await authService.getPendingApprovals();
      setPendingApprovals(result);
    } catch (err) {
      setPendingError(err instanceof Error ? err.message : 'Erro ao carregar solicitações pendentes');
    } finally {
      setIsLoadingPending(false);
    }
  }, [user]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingUserApproval[]>([]);
  const [pendingError, setPendingError] = useState('');
  const [isLoadingPending, setIsLoadingPending] = useState(false);
  const [processingApprovalId, setProcessingApprovalId] = useState<string | null>(null);

  // Carregar dados
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [operadoresData, cooperativasData] = await Promise.all([
          apiService.getOperadores(),
          apiService.getCooperativas()
        ]);
        
        setOperadores(operadoresData);
        setCooperativas(cooperativasData);
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
      } finally {
        setIsLoading(false);
      }
    };

    if (user) loadData();
  }, [user]);

  useEffect(() => {
    if (user?.papel === 'admin' && user.approval_status === 'approved') {
      void fetchPendingApprovals();
    } else {
      setPendingApprovals([]);
      setPendingError('');
    }
  }, [user?.papel, user?.approval_status, fetchPendingApprovals]);

  // Filtrar operadores
  const getFilteredOperadores = (): Operador[] => {
    let operadoresFiltrados = operadores;

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      operadoresFiltrados = operadoresFiltrados.filter(op => 
        (op.nome || '').toLowerCase().includes(q) ||
        (op.email || '').toLowerCase().includes(q) ||
        (op.cargo || '').toLowerCase().includes(q) ||
        (op.papel || '').toLowerCase().includes(q)
      );
    }

    if (cooperativaFilter !== 'todos') {
      operadoresFiltrados = operadoresFiltrados.filter((op) => {
        const ids = op.cooperativas_ids?.length ? op.cooperativas_ids : [op.id_singular];
        return ids.includes(cooperativaFilter);
      });
    }

    if (statusFilter !== 'todos') {
      const isAtivo = statusFilter === 'ativo';
      operadoresFiltrados = operadoresFiltrados.filter(op => op.ativo === isAtivo);
    }

    return operadoresFiltrados;
  };

  const operadoresFiltrados = getFilteredOperadores();

  const getCooperativaNome = (idSingular: string) => {
    const coop = cooperativas.find(c => c.id_singular === idSingular);
    return coop?.uniodonto || idSingular || 'N/A';
  };

  const getOperadorCooperativas = (operador: Operador) => {
    const ids = operador.cooperativas_ids?.length
      ? operador.cooperativas_ids
      : (operador.id_singular ? [operador.id_singular] : []);
    return Array.from(new Set(ids));
  };

  const getOperadorCooperativasResumo = (operador: Operador) => {
    const ids = getOperadorCooperativas(operador);
    if (ids.length === 0) return 'N/A';
    const nomes = ids.map(getCooperativaNome);
    if (nomes.length === 1) return nomes[0];
    return `${nomes[0]} +${nomes.length - 1}`;
  };

  const formatDate = (value: string | Date) => {
    return new Date(value).toLocaleDateString('pt-BR');
  };

  const formatDateTime = (value: string | Date) => {
    return new Date(value).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPhone = (phone: string) => {
    return phone || 'N/A';
  };

  const isOperadorWpp = (operador: Operador) => {
    return hasWhatsAppFlag(
      { wpp: operador.wpp, whatsapp: operador.whatsapp, telefone: operador.telefone },
      { inferFromPhone: true },
    );
  };

  const currentCooperativa = cooperativas.find((c) => c.id_singular === user?.cooperativa_id);
  const isConfUser = !!user && (user.papel === 'confederacao' || currentCooperativa?.tipo === 'CONFEDERACAO');
  const isFederacaoUser = !!user && (user.papel === 'federacao' || currentCooperativa?.tipo === 'FEDERACAO');
  const isAdminUser = !!user && user.papel === 'admin';
  const canCreate = !!user && (user.papel === 'admin' || isConfUser || isFederacaoUser);
  const canManageRoles = !!user && (user.papel === 'admin' || isConfUser);

  const availableCooperativas = (() => {
    if (!user) return cooperativas;
    if (isConfUser) return cooperativas;
    if (isFederacaoUser && currentCooperativa) {
      return cooperativas.filter(
        (c) => c.id_singular === currentCooperativa.id_singular || c.federacao === currentCooperativa.uniodonto
      );
    }
    if (currentCooperativa) {
      return cooperativas.filter((c) => c.id_singular === currentCooperativa.id_singular);
    }
    return cooperativas;
  })();

  const roleOptions = [
    { value: 'operador', label: 'Responsável' },
    { value: 'admin', label: 'Administrador' },
  ] as const;
  const moduloOptions: Array<{ id: 'hub' | 'urede'; label: string; description: string }> = [
    { id: 'hub', label: 'UHub', description: 'Módulo cadastral e administrativo.' },
    { id: 'urede', label: 'URede', description: 'Módulo operacional de pedidos.' },
  ];

  const toggleEditCooperativa = (idSingular: string, checked: boolean) => {
    setEditForm((prev) => {
      const atual = new Set(prev.cooperativas_ids);
      if (checked) {
        atual.add(idSingular);
      } else {
        atual.delete(idSingular);
      }
      const ids = Array.from(atual);
      const principal = ids.includes(prev.cooperativa_principal_id)
        ? prev.cooperativa_principal_id
        : (ids[0] || '');
      return {
        ...prev,
        cooperativas_ids: ids,
        cooperativa_principal_id: principal,
      };
    });
  };

  const toggleCreateCooperativa = (idSingular: string, checked: boolean) => {
    setCreateForm((prev) => {
      const atual = new Set(prev.cooperativas_ids);
      if (checked) {
        atual.add(idSingular);
      } else {
        atual.delete(idSingular);
      }
      const ids = Array.from(atual);
      const principal = ids.includes(prev.cooperativa_principal_id)
        ? prev.cooperativa_principal_id
        : (ids[0] || '');
      return {
        ...prev,
        cooperativas_ids: ids,
        cooperativa_principal_id: principal,
        id_singular: principal,
      };
    });
  };

  const toggleEditModulo = (modulo: 'hub' | 'urede', checked: boolean) => {
    setEditForm((prev) => {
      const atual = new Set(prev.modulos_acesso);
      if (checked) {
        atual.add(modulo);
      } else {
        atual.delete(modulo);
      }
      return {
        ...prev,
        modulos_acesso: normalizeModuleAccess(Array.from(atual), ['hub']),
      };
    });
  };

  const toggleCreateModulo = (modulo: 'hub' | 'urede', checked: boolean) => {
    setCreateForm((prev) => {
      const atual = new Set(prev.modulos_acesso);
      if (checked) {
        atual.add(modulo);
      } else {
        atual.delete(modulo);
      }
      return {
        ...prev,
        modulos_acesso: normalizeModuleAccess(Array.from(atual), ['hub']),
      };
    });
  };

  const handleApprovePending = async (requestId: string) => {
    try {
      setProcessingApprovalId(requestId);
      setPendingError('');
      await authService.approvePending(requestId);
      await fetchPendingApprovals();
      await refreshUser();
    } catch (err) {
      setPendingError(err instanceof Error ? err.message : 'Erro ao aprovar usuário');
    } finally {
      setProcessingApprovalId(null);
    }
  };

  const handleRejectPending = async (requestId: string) => {
    const notes = window.prompt('Informe o motivo da rejeição (opcional):') || '';
    try {
      setProcessingApprovalId(requestId);
      setPendingError('');
      await authService.rejectPending(requestId, notes.trim() ? notes.trim() : undefined);
      await fetchPendingApprovals();
      await refreshUser();
    } catch (err) {
      setPendingError(err instanceof Error ? err.message : 'Erro ao rejeitar usuário');
    } finally {
      setProcessingApprovalId(null);
    }
  };

  const handleOpenEdit = (operador: Operador) => {
    const cooperativasOperador = operador.cooperativas_ids?.length
      ? operador.cooperativas_ids
      : (operador.id_singular ? [operador.id_singular] : []);
    const cooperativaPrincipal = operador.cooperativa_principal_id || operador.id_singular || cooperativasOperador[0] || '';
    setEditingOperador(operador);
    setEditForm({
      nome: operador.nome,
      cargo: operador.cargo,
      telefone: operador.telefone || '',
      wpp: isOperadorWpp(operador),
      ativo: operador.ativo,
      papel: toBaseRole(operador.papel),
      definir_senha: false,
      senha_provisoria: '',
      confirmar_senha: '',
      forcar_troca_senha: true,
      cooperativas_ids: cooperativasOperador,
      cooperativa_principal_id: cooperativaPrincipal,
      modulos_acesso: normalizeModuleAccess(operador.modulos_acesso, ['hub']),
    });
    setSaveError('');
    setIsEditOpen(true);
  };

  const handleCloseEdit = () => {
    if (isSaving) return;
    setIsEditOpen(false);
    setEditingOperador(null);
    setSaveError('');
  };

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingOperador) return;
    setIsSaving(true);
    setSaveError('');
    const canResetPassword = canCreate && editingOperador.email !== user?.email;

    try {
      const cooperativasIds = Array.from(new Set(editForm.cooperativas_ids.filter(Boolean)));
      const cooperativaPrincipal = editForm.cooperativa_principal_id || cooperativasIds[0] || '';
      if (canCreate && cooperativasIds.length === 0) {
        setSaveError('Selecione ao menos uma singular para o usuário.');
        setIsSaving(false);
        return;
      }
      if (canCreate && !cooperativaPrincipal) {
        setSaveError('Defina a cooperativa principal do usuário.');
        setIsSaving(false);
        return;
      }

      const payload: any = {
        nome: editForm.nome.trim(),
        cargo: editForm.cargo.trim(),
        telefone: editForm.telefone.trim(),
        wpp: editForm.wpp,
        ativo: editForm.ativo,
      };

      if (canCreate) {
        payload.cooperativas_ids = cooperativasIds;
        payload.cooperativa_principal_id = cooperativaPrincipal;
        payload.id_singular = cooperativaPrincipal;
      }

      if (canManageRoles) {
        const coop = cooperativas.find((c) => c.id_singular === (cooperativaPrincipal || editingOperador.id_singular));
        payload.papel = deriveRole(editForm.papel, coop);
        payload.modulos_acesso = normalizeModuleAccess(editForm.modulos_acesso, ['hub']);
      }

      if (canResetPassword && editForm.definir_senha) {
        const novaSenha = editForm.senha_provisoria.trim();
        const confirmacao = editForm.confirmar_senha.trim();
        if (!novaSenha || novaSenha.length < 8) {
          setSaveError('Defina uma senha provisória com pelo menos 8 caracteres.');
          setIsSaving(false);
          return;
        }
        if (novaSenha !== confirmacao) {
          setSaveError('A confirmação da senha provisória não confere.');
          setIsSaving(false);
          return;
        }
        payload.senha_temporaria = novaSenha;
        payload.forcar_troca_senha = editForm.forcar_troca_senha;
      }

      const updated = await apiService.updateOperador(editingOperador.id, payload);
      setOperadores((prev) => prev.map((op) => (op.id === updated.id ? updated : op)));
      if (updated.email && updated.email === user?.email) {
        await refreshUser();
      }
      setIsEditOpen(false);
      setEditingOperador(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao atualizar operador');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenCreate = () => {
    const defaultSingular = user?.cooperativa_id || availableCooperativas[0]?.id_singular || '';
    setCreateForm({
      nome: '',
      email: '',
      cargo: '',
      telefone: '',
      wpp: false,
      id_singular: defaultSingular,
      senha_provisoria: '',
      confirmar_senha: '',
      forcar_troca_senha: true,
      cooperativas_ids: defaultSingular ? [defaultSingular] : [],
      cooperativa_principal_id: defaultSingular,
      modulos_acesso: ['hub'],
    });
    setCreateError('');
    setIsCreateOpen(true);
  };

  const handleCloseCreate = () => {
    if (isCreating) return;
    setIsCreateOpen(false);
    setCreateError('');
    setCreateForm((prev) => ({
      ...prev,
      nome: '',
      email: '',
      cargo: '',
      telefone: '',
      wpp: false,
      senha_provisoria: '',
      confirmar_senha: '',
      forcar_troca_senha: true,
      cooperativas_ids: [],
      cooperativa_principal_id: '',
      modulos_acesso: ['hub'],
    }));
  };

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsCreating(true);
    setCreateError('');

    try {
      const senhaTemporaria = createForm.senha_provisoria.trim();
      const confirmacao = createForm.confirmar_senha.trim();

      if (!senhaTemporaria || senhaTemporaria.length < 8) {
        setCreateError('Defina uma senha provisória com pelo menos 8 caracteres.');
        setIsCreating(false);
        return;
      }

      if (senhaTemporaria !== confirmacao) {
        setCreateError('A confirmação da senha provisória não confere.');
        setIsCreating(false);
        return;
      }

      const payload = {
        nome: createForm.nome.trim(),
        email: createForm.email.trim().toLowerCase(),
        cargo: createForm.cargo.trim(),
        telefone: createForm.telefone.trim(),
        wpp: createForm.wpp,
        id_singular: createForm.id_singular,
        cooperativas_ids: [] as string[],
        cooperativa_principal_id: '',
        modulos_acesso: normalizeModuleAccess(createForm.modulos_acesso, ['hub']),
        senha_temporaria: senhaTemporaria,
        forcar_troca_senha: createForm.forcar_troca_senha,
      };

      const cooperativasIds = Array.from(new Set(createForm.cooperativas_ids.filter(Boolean)));
      const cooperativaPrincipal = createForm.cooperativa_principal_id || cooperativasIds[0] || '';
      if (!cooperativasIds.length) {
        setCreateError('Selecione ao menos uma singular para o usuário.');
        setIsCreating(false);
        return;
      }
      if (!cooperativaPrincipal) {
        setCreateError('Defina a cooperativa principal do usuário.');
        setIsCreating(false);
        return;
      }
      payload.id_singular = cooperativaPrincipal;
      payload.cooperativas_ids = cooperativasIds;
      payload.cooperativa_principal_id = cooperativaPrincipal;

      const novo = await apiService.createOperador(payload);
      setOperadores((prev) => [...prev, novo]);
      setIsCreateOpen(false);
      const defaultSingular = user?.cooperativa_id || availableCooperativas[0]?.id_singular || '';
      setCreateForm({
        nome: '',
        email: '',
        cargo: '',
        telefone: '',
        wpp: false,
        id_singular: defaultSingular,
        senha_provisoria: '',
        confirmar_senha: '',
        forcar_troca_senha: true,
        cooperativas_ids: defaultSingular ? [defaultSingular] : [],
        cooperativa_principal_id: defaultSingular,
        modulos_acesso: ['hub'],
      });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Erro ao criar operador');
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
          <p className="text-gray-600">Gerencie os usuários do sistema</p>
        </div>
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando usuários...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
          <p className="text-gray-600">Gerencie os usuários do sistema</p>
        </div>
        <div className="text-center py-8">
          <p className="text-red-600">Erro: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
        <p className="text-gray-600">Gerencie os usuários do sistema</p>
      </div>
        {isAuthenticated && canCreate && (
          <Button
            onClick={handleOpenCreate}
            className="bg-blue-600 hover:bg-blue-700"
            disabled={availableCooperativas.length === 0}
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Usuário
          </Button>
        )}
      </div>

      {isAdminUser && (
        <Card>
          <CardHeader>
            <CardTitle>Solicitações de acesso pendentes</CardTitle>
            <CardDescription>
              Aprove as contas recém-cadastradas para liberar o acesso ao sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingError && (
              <Alert variant="destructive">
                <AlertDescription>{pendingError}</AlertDescription>
              </Alert>
            )}
            {isLoadingPending ? (
              <div className="text-sm text-gray-500">Carregando solicitações...</div>
            ) : pendingApprovals.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma solicitação pendente.</p>
            ) : (
              <div className="space-y-3">
                {pendingApprovals.map((pending) => (
                  <div
                    key={pending.id}
                    className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border border-gray-200 rounded-lg p-3 bg-gray-50"
                  >
                    <div className="space-y-1 text-left">
                      <div className="font-medium text-gray-900">{pending.nome}</div>
                      <div className="text-sm text-gray-500">{pending.email}</div>
                      {pending.cooperativa_nome && (
                        <div className="text-sm text-gray-500">
                          Cooperativa: {pending.cooperativa_nome}
                        </div>
                      )}
                      <div className="text-sm text-gray-500">
                        Papel solicitado: {describeRole(pending.requested_papel)}
                      </div>
                      <div className="text-xs text-gray-400">
                        Solicitação em {formatDateTime(pending.created_at)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprovePending(pending.id)}
                        disabled={processingApprovalId === pending.id}
                      >
                        {processingApprovalId === pending.id ? 'Processando...' : 'Aprovar'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRejectPending(pending.id)}
                        disabled={processingApprovalId === pending.id}
                      >
                        {processingApprovalId === pending.id ? 'Processando...' : 'Rejeitar'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col md:flex-row gap-4 flex-1">
              <div className="relative flex-1 md:max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Buscar usuários..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={cooperativaFilter} onValueChange={setCooperativaFilter}>
                <SelectTrigger className="w-full md:w-56">
                  <SelectValue placeholder="Cooperativa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as cooperativas</SelectItem>
                  {cooperativas.map((coop) => (
                    <SelectItem key={coop.id_singular} value={coop.id_singular}>
                      {coop.uniodonto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="text-sm text-gray-500">
              {operadoresFiltrados.length} usuário(s) encontrado(s)
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Usuários */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuários</CardTitle>
          <CardDescription>
            Visualize e gerencie todos os usuários cadastrados no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead className="hidden md:table-cell">Cooperativa</TableHead>
                  <TableHead className="hidden lg:table-cell">Cargo</TableHead>
                  <TableHead className="hidden lg:table-cell">Acesso</TableHead>
                  <TableHead className="hidden xl:table-cell">Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Data Cadastro</TableHead>
                  <TableHead className="w-12">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operadoresFiltrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  operadoresFiltrados.map((operador) => (
                    <TableRow key={operador.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                              {operador.nome.split(' ').map(n => n[0]).join('').substring(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-gray-900">{operador.nome}</p>
                            <p className="text-sm text-gray-500">{operador.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center space-x-2">
                          <Building className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">{getOperadorCooperativasResumo(operador)}</span>
                        </div>
                      </TableCell>

                      <TableCell className="hidden lg:table-cell">
                        <Badge variant="secondary" className="text-xs">
                          {operador.cargo}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant="outline" className="text-xs capitalize">
                          {describeRole(operador.papel)}
                        </Badge>
                      </TableCell>

                      <TableCell className="hidden xl:table-cell">
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Phone className="w-3 h-3" />
                          <span>{formatPhone(operador.telefone)}</span>
                          {isOperadorWpp(operador) && <i className="fa-brands fa-whatsapp text-emerald-600 text-sm" aria-label="WhatsApp" />}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Badge 
                          className={operador.ativo 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                          }
                        >
                          {operador.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      
                      <TableCell className="hidden lg:table-cell text-sm text-gray-600">
                        {formatDate(operador.data_cadastro)}
                      </TableCell>
                      
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (onRequestEdit) return onRequestEdit(operador);
                            if (onEditOperador) return onEditOperador(operador);
                            handleOpenEdit(operador);
                          }}
                          className="w-8 h-8"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseEdit();
        }}
      >
        <DialogContent className="w-full max-w-[min(520px,calc(100dvw-2rem))] max-h-[min(90dvh,calc(100dvh-2rem))] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
            <DialogDescription>
              Atualize as informações do usuário. Algumas alterações dependem da sua permissão.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="operador-nome">Nome</Label>
                <Input
                  id="operador-nome"
                  value={editForm.nome}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, nome: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={editingOperador?.email || ''} disabled readOnly />
              </div>
              <div className="space-y-2">
                <Label htmlFor="operador-cargo">Cargo</Label>
                <Input
                  id="operador-cargo"
                  value={editForm.cargo}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, cargo: e.target.value }))}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="operador-telefone">Telefone</Label>
                  <Input
                    id="operador-telefone"
                    value={editForm.telefone}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, telefone: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="operador-wpp">WhatsApp</Label>
                  <div className="h-10 flex items-center rounded-md border border-input px-3">
                    <Switch
                      id="operador-wpp"
                      checked={editForm.wpp}
                      onCheckedChange={(value) => setEditForm((prev) => ({ ...prev, wpp: value }))}
                    />
                  </div>
                </div>
              </div>

              {canManageRoles ? (
                <div className="space-y-2">
                  <Label htmlFor="operador-papel">Tipo de acesso</Label>
                  <Select
                    value={editForm.papel}
                    onValueChange={(value) => setEditForm((prev) => ({ ...prev, papel: toBaseRole(value) }))}
                  >
                    <SelectTrigger id="operador-papel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Tipo de acesso</Label>
                  <Input value={describeRole(editingOperador?.papel)} disabled readOnly />
                </div>
              )}

              {canManageRoles ? (
                <div className="rounded-lg border border-gray-200 p-3 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Módulos com acesso</p>
                    <p className="text-xs text-gray-500">
                      O padrão é UHub. Marque URede quando o usuário também precisar operar pedidos.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {moduloOptions.map((modulo) => (
                      <label
                        key={`edit-modulo-${modulo.id}`}
                        className="flex items-start gap-2 text-sm text-gray-700"
                      >
                        <Checkbox
                          checked={editForm.modulos_acesso.includes(modulo.id)}
                          onCheckedChange={(checked) => toggleEditModulo(modulo.id, checked === true)}
                          disabled={modulo.id === 'hub'}
                        />
                        <span className="flex flex-col">
                          <span className="font-medium">{modulo.label}</span>
                          <span className="text-xs text-gray-500">{modulo.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Módulos com acesso</Label>
                  <Input
                    value={normalizeModuleAccess(editingOperador?.modulos_acesso, ['hub']).join(', ').toUpperCase()}
                    disabled
                    readOnly
                  />
                </div>
              )}

              {canCreate && (
                <div className="rounded-lg border border-gray-200 p-3 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Singulares vinculadas</p>
                    <p className="text-xs text-gray-500">
                      Selecione uma ou mais singulares para este usuário.
                    </p>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                    {availableCooperativas.map((coop) => (
                      <label
                        key={`edit-coop-${coop.id_singular}`}
                        className="flex items-center gap-2 text-sm text-gray-700"
                      >
                        <Checkbox
                          checked={editForm.cooperativas_ids.includes(coop.id_singular)}
                          onCheckedChange={(checked) =>
                            toggleEditCooperativa(coop.id_singular, checked === true)
                          }
                        />
                        <span>{coop.uniodonto}</span>
                      </label>
                    ))}
                    {availableCooperativas.length === 0 && (
                      <p className="text-xs text-gray-500">Nenhuma singular disponível para vinculação.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="operador-cooperativa-principal">Singular principal</Label>
                    <Select
                      value={editForm.cooperativa_principal_id}
                      onValueChange={(value) =>
                        setEditForm((prev) => ({
                          ...prev,
                          cooperativa_principal_id: value,
                        }))
                      }
                      disabled={editForm.cooperativas_ids.length === 0}
                    >
                      <SelectTrigger id="operador-cooperativa-principal">
                        <SelectValue placeholder="Selecione a singular principal" />
                      </SelectTrigger>
                      <SelectContent>
                        {editForm.cooperativas_ids.map((id) => (
                          <SelectItem key={`edit-principal-${id}`} value={id}>
                            {getCooperativaNome(id)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">Responsável ativo</p>
                  <p className="text-xs text-gray-500">Desative para suspender temporariamente o acesso.</p>
                </div>
                <Switch
                  checked={editForm.ativo}
                  onCheckedChange={(value) => setEditForm((prev) => ({ ...prev, ativo: value }))}
                />
              </div>

              {editingOperador && canCreate && editingOperador.email !== user?.email && (
                <div className="rounded-lg border border-gray-200 p-3 space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Definir nova senha provisória</p>
                      <p className="text-xs text-gray-500">
                        Use quando o operador ainda não possui acesso ou perdeu a senha. Compartilhe manualmente.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={editForm.definir_senha ? 'outline' : 'default'}
                      onClick={() =>
                        setEditForm((prev) => ({
                          ...prev,
                          definir_senha: !prev.definir_senha,
                          senha_provisoria: prev.definir_senha ? '' : prev.senha_provisoria,
                          confirmar_senha: prev.definir_senha ? '' : prev.confirmar_senha,
                        }))
                      }
                    >
                      {editForm.definir_senha ? 'Cancelar redefinição' : 'Definir senha provisória'}
                    </Button>
                  </div>

                  {editForm.definir_senha && (
                    <div className="space-y-3">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="operador-senha-prov">Senha provisória *</Label>
                          <Input
                            id="operador-senha-prov"
                            type="password"
                            minLength={8}
                            value={editForm.senha_provisoria}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, senha_provisoria: e.target.value }))}
                            required={editForm.definir_senha}
                          />
                          <p className="text-xs text-gray-500">Mínimo de 8 caracteres.</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="operador-senha-confirma">Confirmar senha *</Label>
                          <Input
                            id="operador-senha-confirma"
                            type="password"
                            minLength={8}
                            value={editForm.confirmar_senha}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, confirmar_senha: e.target.value }))}
                            required={editForm.definir_senha}
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-gray-100 bg-gray-50 p-3">
                        <div>
                          <p className="text-sm font-medium text-gray-700">Exigir troca no primeiro acesso</p>
                          <p className="text-xs text-gray-500">
                            Obriga o operador a escolher uma nova senha após usar a provisória.
                          </p>
                        </div>
                        <Switch
                          checked={editForm.forcar_troca_senha}
                          onCheckedChange={(checked) =>
                            setEditForm((prev) => ({ ...prev, forcar_troca_senha: checked }))
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {saveError && (
              <p className="text-sm text-red-600">{saveError}</p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseEdit} disabled={isSaving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseCreate();
        }}
      >
        <DialogContent className="w-full max-w-[min(520px,calc(100dvw-2rem))] max-h-[min(90dvh,calc(100dvh-2rem))] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
            <DialogDescription>
              Preencha os campos abaixo para convidar um novo usuário para sua cooperativa.
              O acesso inicial é de operador; níveis superiores podem ser atribuídos posteriormente.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="space-y-3">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="novo-nome">Nome</Label>
                  <Input
                    id="novo-nome"
                    value={createForm.nome}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, nome: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="novo-email">Email</Label>
                  <Input
                    id="novo-email"
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="novo-cargo">Cargo</Label>
                <Input
                  id="novo-cargo"
                  value={createForm.cargo}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, cargo: e.target.value }))}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="novo-telefone">Telefone</Label>
                  <Input
                    id="novo-telefone"
                    value={createForm.telefone}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, telefone: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="novo-whatsapp">WhatsApp</Label>
                  <div className="h-10 flex items-center rounded-md border border-input px-3">
                    <Switch
                      id="novo-whatsapp"
                      checked={createForm.wpp}
                      onCheckedChange={(checked) =>
                        setCreateForm((prev) => ({ ...prev, wpp: checked }))
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">Módulos com acesso</p>
                  <p className="text-xs text-gray-500">
                    Novos usuários iniciam no UHub. Marque URede para liberar pedidos e relatórios operacionais.
                  </p>
                </div>
                <div className="space-y-2">
                  {moduloOptions.map((modulo) => (
                    <label
                      key={`create-modulo-${modulo.id}`}
                      className="flex items-start gap-2 text-sm text-gray-700"
                    >
                      <Checkbox
                        checked={createForm.modulos_acesso.includes(modulo.id)}
                        onCheckedChange={(checked) => toggleCreateModulo(modulo.id, checked === true)}
                        disabled={modulo.id === 'hub'}
                      />
                      <span className="flex flex-col">
                        <span className="font-medium">{modulo.label}</span>
                        <span className="text-xs text-gray-500">{modulo.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Singulares vinculadas</Label>
                <div className="rounded-lg border border-gray-200 p-3 space-y-3">
                  <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                    {availableCooperativas.map((coop) => (
                      <label
                        key={`create-coop-${coop.id_singular}`}
                        className="flex items-center gap-2 text-sm text-gray-700"
                      >
                        <Checkbox
                          checked={createForm.cooperativas_ids.includes(coop.id_singular)}
                          onCheckedChange={(checked) =>
                            toggleCreateCooperativa(coop.id_singular, checked === true)
                          }
                        />
                        <span>{coop.uniodonto}</span>
                      </label>
                    ))}
                    {availableCooperativas.length === 0 && (
                      <p className="text-xs text-gray-500">Nenhuma singular disponível para vinculação.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="novo-cooperativa-principal">Singular principal</Label>
                    <Select
                      value={createForm.cooperativa_principal_id}
                      onValueChange={(value) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          cooperativa_principal_id: value,
                          id_singular: value,
                        }))
                      }
                      disabled={createForm.cooperativas_ids.length === 0}
                    >
                      <SelectTrigger id="novo-cooperativa-principal">
                        <SelectValue placeholder="Selecione a singular principal" />
                      </SelectTrigger>
                      <SelectContent>
                        {createForm.cooperativas_ids.map((id) => (
                          <SelectItem key={`create-principal-${id}`} value={id}>
                            {getCooperativaNome(id)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  O operador inicia com acesso padrão. Administradores podem ampliar o nível posteriormente.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="novo-senha-prov">Senha provisória *</Label>
                  <Input
                    id="novo-senha-prov"
                    type="password"
                    minLength={8}
                    value={createForm.senha_provisoria}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, senha_provisoria: e.target.value }))}
                    placeholder="Mínimo de 8 caracteres"
                    required
                  />
                  <p className="text-xs text-gray-500">
                    Compartilhe essa senha com o operador para o primeiro acesso.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="novo-senha-confirmacao">Confirmar senha *</Label>
                  <Input
                    id="novo-senha-confirmacao"
                    type="password"
                    minLength={8}
                    value={createForm.confirmar_senha}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, confirmar_senha: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="flex items-start justify-between rounded-lg border border-gray-200 p-3 gap-4 flex-col sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-medium text-gray-700">Exigir troca de senha no primeiro acesso</p>
                  <p className="text-xs text-gray-500">
                    Ative para forçar o operador a definir uma nova senha após entrar com a provisória.
                  </p>
                </div>
                <Switch
                  checked={createForm.forcar_troca_senha}
                  onCheckedChange={(checked) =>
                    setCreateForm((prev) => ({ ...prev, forcar_troca_senha: checked }))
                  }
                />
              </div>
            </div>

            {createError && <p className="text-sm text-red-600">{createError}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseCreate} disabled={isCreating}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Cadastrando...' : 'Cadastrar operador'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
