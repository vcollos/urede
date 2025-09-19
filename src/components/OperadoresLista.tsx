import { useState, useEffect, FormEvent } from 'react';
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
import { 
  Search, 
  Plus, 
  Phone,
  MessageSquare,
  Building,
  User,
  Edit,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { Operador, Cooperativa } from '../types';

interface OperadoresListaProps {
  onRequestEdit?: (operador: Operador) => void;
  onEditOperador?: (operador: Operador) => void;
}

export function OperadoresLista({ onRequestEdit, onEditOperador }: OperadoresListaProps = {}) {
  const { user, isAuthenticated } = useAuth();
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
    whatsapp: '',
    ativo: true,
    papel: 'operador' as Operador['papel'],
  });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createForm, setCreateForm] = useState({
    nome: '',
    email: '',
    cargo: '',
    telefone: '',
    whatsapp: '',
    id_singular: '',
  });

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
      operadoresFiltrados = operadoresFiltrados.filter(op => op.id_singular === cooperativaFilter);
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
    return coop?.uniodonto || 'N/A';
  };

  const formatDate = (value: string | Date) => {
    return new Date(value).toLocaleDateString('pt-BR');
  };

  const formatPhone = (phone: string) => {
    return phone || 'N/A';
  };

  const currentCooperativa = cooperativas.find((c) => c.id_singular === user?.cooperativa_id);
  const isConfUser = !!user && (user.papel === 'confederacao' || currentCooperativa?.tipo === 'CONFEDERACAO');
  const isFederacaoUser = !!user && (user.papel === 'federacao' || currentCooperativa?.tipo === 'FEDERAÇÃO');
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
    { value: 'operador', label: 'Operador' },
    { value: 'admin', label: 'Administrador' },
  ];
  if (isConfUser) {
    roleOptions.push({ value: 'federacao', label: 'Federação' }, { value: 'confederacao', label: 'Confederação' });
  } else if (isFederacaoUser) {
    roleOptions.push({ value: 'federacao', label: 'Federação' });
  }

  const handleOpenEdit = (operador: Operador) => {
    setEditingOperador(operador);
    setEditForm({
      nome: operador.nome,
      cargo: operador.cargo,
      telefone: operador.telefone || '',
      whatsapp: operador.whatsapp || '',
      ativo: operador.ativo,
      papel: operador.papel || 'operador',
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

    try {
      const payload: any = {
        nome: editForm.nome.trim(),
        cargo: editForm.cargo.trim(),
        telefone: editForm.telefone.trim(),
        whatsapp: editForm.whatsapp.trim(),
        ativo: editForm.ativo,
      };

      if (canManageRoles) {
        payload.papel = editForm.papel;
      }

      const updated = await apiService.updateOperador(editingOperador.id, payload);
      setOperadores((prev) => prev.map((op) => (op.id === updated.id ? updated : op)));
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
      whatsapp: '',
      id_singular: defaultSingular,
    });
    setCreateError('');
    setIsCreateOpen(true);
  };

  const handleCloseCreate = () => {
    if (isCreating) return;
    setIsCreateOpen(false);
    setCreateError('');
    setCreateForm((prev) => ({ ...prev, nome: '', email: '', cargo: '', telefone: '', whatsapp: '' }));
  };

  const handleCreateSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsCreating(true);
    setCreateError('');

    try {
      const payload = {
        nome: createForm.nome.trim(),
        email: createForm.email.trim().toLowerCase(),
        cargo: createForm.cargo.trim(),
        telefone: createForm.telefone.trim(),
        whatsapp: createForm.whatsapp.trim(),
        id_singular: createForm.id_singular,
      };

      if (!payload.id_singular) {
        setCreateError('Selecione a cooperativa do operador.');
        setIsCreating(false);
        return;
      }

      const novo = await apiService.createOperador(payload);
      setOperadores((prev) => [...prev, novo]);
      setIsCreateOpen(false);
      setCreateForm({
        nome: '',
        email: '',
        cargo: '',
        telefone: '',
        whatsapp: '',
        id_singular: payload.id_singular,
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
          <h1 className="text-2xl font-bold text-gray-900">Operadores</h1>
          <p className="text-gray-600">Gerencie os operadores do sistema</p>
        </div>
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando operadores...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Operadores</h1>
          <p className="text-gray-600">Gerencie os operadores do sistema</p>
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
          <h1 className="text-2xl font-bold text-gray-900">Operadores</h1>
          <p className="text-gray-600">Gerencie os operadores do sistema</p>
        </div>
        {isAuthenticated && canCreate && (
          <Button
            onClick={handleOpenCreate}
            className="bg-blue-600 hover:bg-blue-700"
            disabled={availableCooperativas.length === 0}
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Operador
          </Button>
        )}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col md:flex-row gap-4 flex-1">
              <div className="relative flex-1 md:max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Buscar operadores..."
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
              {operadoresFiltrados.length} operador(es) encontrado(s)
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Operadores */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Operadores</CardTitle>
          <CardDescription>
            Visualize e gerencie todos os operadores cadastrados no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operador</TableHead>
                  <TableHead>Cooperativa</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Acesso</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data Cadastro</TableHead>
                  <TableHead className="w-12">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operadoresFiltrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                      Nenhum operador encontrado
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
                      
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Building className="w-4 h-4 text-gray-400" />
                          <span className="text-sm">{getCooperativaNome(operador.id_singular)}</span>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {operador.cargo}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">
                          {operador.papel || 'operador'}
                        </Badge>
                      </TableCell>
                      
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Phone className="w-3 h-3" />
                            <span>{formatPhone(operador.telefone)}</span>
                          </div>
                          {operador.whatsapp && (
                            <div className="flex items-center space-x-2 text-sm text-gray-600">
                              <MessageSquare className="w-3 h-3" />
                              <span>{formatPhone(operador.whatsapp)}</span>
                            </div>
                          )}
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
                      
                      <TableCell className="text-sm text-gray-600">
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar operador</DialogTitle>
            <DialogDescription>
              Atualize as informações do operador. Algumas alterações dependem da sua permissão.
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
                  <Label htmlFor="operador-whatsapp">WhatsApp</Label>
                  <Input
                    id="operador-whatsapp"
                    value={editForm.whatsapp}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, whatsapp: e.target.value }))}
                  />
                </div>
              </div>

              {canManageRoles ? (
                <div className="space-y-2">
                  <Label htmlFor="operador-papel">Tipo de acesso</Label>
                  <Select
                    value={editForm.papel || 'operador'}
                    onValueChange={(value) => setEditForm((prev) => ({ ...prev, papel: value as Operador['papel'] }))}
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
                  <Input value={editingOperador?.papel || 'operador'} disabled readOnly />
                </div>
              )}

              <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">Operador ativo</p>
                  <p className="text-xs text-gray-500">Desative para suspender temporariamente o acesso.</p>
                </div>
                <Switch
                  checked={editForm.ativo}
                  onCheckedChange={(value) => setEditForm((prev) => ({ ...prev, ativo: value }))}
                />
              </div>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo operador</DialogTitle>
            <DialogDescription>
              Preencha os campos abaixo para convidar um novo operador para sua cooperativa.
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
                  <Input
                    id="novo-whatsapp"
                    value={createForm.whatsapp}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, whatsapp: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="novo-cooperativa">Cooperativa</Label>
                <Select
                  value={createForm.id_singular}
                  onValueChange={(value) => setCreateForm((prev) => ({ ...prev, id_singular: value }))}
                  disabled={availableCooperativas.length <= 1}
                >
                  <SelectTrigger id="novo-cooperativa">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCooperativas.map((coop) => (
                      <SelectItem key={coop.id_singular} value={coop.id_singular}>
                        {coop.uniodonto}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  O operador inicia com acesso padrão. Administradores podem ampliar o nível posteriormente.
                </p>
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
