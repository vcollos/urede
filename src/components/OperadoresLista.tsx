import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Avatar, AvatarFallback } from './ui/avatar';
import { 
  Search, 
  Plus, 
  Phone,
  MessageSquare,
  Mail,
  Building,
  User,
  Edit,
  MoreHorizontal
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { Operador, Cooperativa } from '../types';

interface OperadoresListaProps {
  onCreateOperador: () => void;
  onEditOperador: (operador: Operador) => void;
}

export function OperadoresLista({ onCreateOperador, onEditOperador }: OperadoresListaProps) {
  const { user } = useAuth();
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [cooperativas, setCooperativas] = useState<Cooperativa[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cooperativaFilter, setCooperativaFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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

    if (user) {
      loadData();
    }
  }, [user]);

  // Filtrar operadores
  const getFilteredOperadores = (): Operador[] => {
    let operadoresFiltrados = operadores;

    if (searchTerm) {
      operadoresFiltrados = operadoresFiltrados.filter(op => 
        op.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        op.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        op.cargo.toLowerCase().includes(searchTerm.toLowerCase())
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

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const formatPhone = (phone: string) => {
    return phone || 'N/A';
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
        <Button onClick={onCreateOperador} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Novo Operador
        </Button>
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
                  <TableHead>Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data Cadastro</TableHead>
                  <TableHead className="w-12">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operadoresFiltrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
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
                          onClick={() => onEditOperador(operador)}
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
    </div>
  );
}