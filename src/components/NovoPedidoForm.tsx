import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { X, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { Cidade } from '../types';

interface NovoPedidoFormProps {
  onClose: () => void;
  onSubmit?: (pedido: any) => void;
}

const especialidades = [
  'Clínico Geral',
  'Ortodontia',
  'Endodontia',
  'Periodontia',
  'Cirurgia Oral',
  'Prótese',
  'Implantodontia',
  'Odontopediatria',
  'Radiologia',
  'Estética'
];

export function NovoPedidoForm({ onClose, onSubmit }: NovoPedidoFormProps) {
  const { user } = useAuth();
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    titulo: '',
    cidade_id: '',
    quantidade: 1,
    observacoes: '',
    especialidades_selecionadas: [] as string[],
    prioridade: 'media' as 'baixa' | 'media' | 'alta' | 'urgente'
  });

  const [novaEspecialidade, setNovaEspecialidade] = useState('');

  // Carregar cidades
  useEffect(() => {
    const loadCidades = async () => {
      try {
        setIsLoading(true);
        const cidadesData = await apiService.getCidades();
        setCidades(cidadesData);
      } catch (err) {
        console.error('Erro ao carregar cidades:', err);
        setError('Erro ao carregar cidades');
      } finally {
        setIsLoading(false);
      }
    };

    loadCidades();
  }, []);

  const handleAddEspecialidade = () => {
    if (novaEspecialidade && !formData.especialidades_selecionadas.includes(novaEspecialidade)) {
      setFormData({
        ...formData,
        especialidades_selecionadas: [...formData.especialidades_selecionadas, novaEspecialidade]
      });
      setNovaEspecialidade('');
    }
  };

  const handleRemoveEspecialidade = (especialidade: string) => {
    setFormData({
      ...formData,
      especialidades_selecionadas: formData.especialidades_selecionadas.filter(e => e !== especialidade)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.titulo || !formData.cidade_id || formData.especialidades_selecionadas.length === 0) {
      setError('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      const novoPedidoData = {
        titulo: formData.titulo,
        cidade_id: formData.cidade_id,
        especialidades: formData.especialidades_selecionadas,
        quantidade: formData.quantidade,
        observacoes: formData.observacoes,
        prioridade: formData.prioridade
      };

      const pedidoCriado = await apiService.createPedido(novoPedidoData);
      
      if (onSubmit) {
        onSubmit(pedidoCriado);
      }
      
      onClose();
    } catch (err) {
      console.error('Erro ao criar pedido:', err);
      setError(err instanceof Error ? err.message : 'Erro ao criar pedido');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <Card className="border-0 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle>Novo Pedido de Credenciamento</CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose} disabled={isSubmitting}>
              <X className="w-4 h-4" />
            </Button>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Título */}
              <div className="space-y-2">
                <Label htmlFor="titulo">Título do Pedido *</Label>
                <Input
                  id="titulo"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  placeholder="Ex: Credenciamento Ortodontista - Urgente"
                  className="w-full"
                  disabled={isSubmitting}
                />
              </div>

              {/* Cidade */}
              <div className="space-y-2">
                <Label htmlFor="cidade">Cidade de Atendimento *</Label>
                <Select 
                  value={formData.cidade_id} 
                  onValueChange={(value) => setFormData({ ...formData, cidade_id: value })}
                  disabled={isSubmitting || isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoading ? "Carregando cidades..." : "Selecione a cidade"} />
                  </SelectTrigger>
                  <SelectContent>
                    {cidades.map((cidade) => (
                      <SelectItem key={cidade.cd_municipio_7} value={cidade.cd_municipio_7}>
                        {cidade.nm_cidade}, {cidade.uf_municipio} ({cidade.nm_regiao})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Especialidades */}
              <div className="space-y-2">
                <Label>Especialidades Necessárias *</Label>
                
                <div className="flex gap-2">
                  <Select 
                    value={novaEspecialidade} 
                    onValueChange={setNovaEspecialidade}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione uma especialidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {especialidades
                        .filter(e => !formData.especialidades_selecionadas.includes(e))
                        .map((especialidade) => (
                          <SelectItem key={especialidade} value={especialidade}>
                            {especialidade}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    type="button" 
                    onClick={handleAddEspecialidade} 
                    disabled={!novaEspecialidade || isSubmitting}
                    size="icon"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {/* Especialidades selecionadas */}
                {formData.especialidades_selecionadas.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-lg">
                    {formData.especialidades_selecionadas.map((especialidade) => (
                      <Badge 
                        key={especialidade} 
                        variant="secondary" 
                        className="flex items-center gap-1"
                      >
                        {especialidade}
                        <button
                          type="button"
                          onClick={() => handleRemoveEspecialidade(especialidade)}
                          className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                          disabled={isSubmitting}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Prioridade */}
              <div className="space-y-2">
                <Label htmlFor="prioridade">Prioridade</Label>
                <Select 
                  value={formData.prioridade} 
                  onValueChange={(value) => setFormData({ ...formData, prioridade: value as any })}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Quantidade */}
              <div className="space-y-2">
                <Label htmlFor="quantidade">Quantidade de Prestadores</Label>
                <Input
                  id="quantidade"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.quantidade}
                  onChange={(e) => setFormData({ ...formData, quantidade: parseInt(e.target.value) || 1 })}
                  className="w-32"
                  disabled={isSubmitting}
                />
              </div>

              {/* Observações */}
              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Detalhes adicionais sobre a necessidade do credenciamento..."
                  rows={4}
                  className="resize-none"
                  disabled={isSubmitting}
                />
              </div>

              {/* Informações do Sistema */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-medium text-blue-900 mb-2">Informações do Sistema</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• O pedido será roteado automaticamente para a cooperativa responsável pela cidade</li>
                  <li>• Prazo inicial: 30 dias para a Singular responsável</li>
                  <li>• Se não atendido, será escalado automaticamente para Federação (+ 30 dias)</li>
                  <li>• Por último, será escalado para Confederação (+ 30 dias)</li>
                </ul>
              </div>

              {/* Ações */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Criando...' : 'Criar Pedido'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}