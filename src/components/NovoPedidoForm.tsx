import { useState, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react';
import { apiService } from '../services/apiService';
import { Cidade, Pedido, SystemSettings } from '../types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from './ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';

interface NovoPedidoFormProps {
  onClose: () => void;
  onSubmit?: (pedido: Pedido) => void;
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
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCategorias, setIsLoadingCategorias] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [pedidoMotivos, setPedidoMotivos] = useState<string[]>([]);
  const [deadlines, setDeadlines] = useState<SystemSettings['deadlines'] | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isCidadeSelectOpen, setIsCidadeSelectOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    titulo: '',
    cidade_id: '',
    quantidade: 1,
    observacoes: '',
    especialidades_selecionadas: [] as string[],
    prioridade: 'media' as 'baixa' | 'media' | 'alta' | 'urgente',
    motivo_categoria: '',
    beneficiarios_quantidade: '',
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

  useEffect(() => {
    const loadCategorias = async () => {
      try {
        setIsLoadingCategorias(true);
        setIsLoadingSettings(true);
        const settings = await apiService.getSystemSettings();
        setPedidoMotivos(settings?.pedido_motivos ?? []);
        if (settings?.deadlines) {
          setDeadlines(settings.deadlines);
        }
      } catch (err) {
        console.error('Erro ao carregar categorias de pedido:', err);
      } finally {
        setIsLoadingCategorias(false);
        setIsLoadingSettings(false);
      }
    };

    loadCategorias();
  }, []);

  const cidadeSelecionada = useMemo(() => {
    if (!formData.cidade_id) return null;
    return cidades.find((cidade) => cidade.cd_municipio_7 === formData.cidade_id) ?? null;
  }, [formData.cidade_id, cidades]);

  const cidadePlaceholder = isLoading ? 'Carregando cidades...' : 'Selecione a cidade';

  const especialidadeOptions = useMemo(() => (
    especialidades
      .filter((especialidade) => !formData.especialidades_selecionadas.includes(especialidade))
      .map((especialidade) => (
        <SelectItem key={especialidade} value={especialidade}>
          {especialidade}
        </SelectItem>
      ))
  ), [formData.especialidades_selecionadas]);

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

      const motivoCategoria = formData.motivo_categoria.trim();
      const beneficiariosRaw = Number(formData.beneficiarios_quantidade);
      const beneficiariosQuantidade = Number.isFinite(beneficiariosRaw)
        ? Math.max(0, Math.round(beneficiariosRaw))
        : undefined;

      const novoPedidoData = {
        titulo: formData.titulo,
        cidade_id: formData.cidade_id,
        especialidades: formData.especialidades_selecionadas,
        quantidade: formData.quantidade,
        observacoes: formData.observacoes,
        prioridade: formData.prioridade,
        motivo_categoria: motivoCategoria ? motivoCategoria : undefined,
        beneficiarios_quantidade: beneficiariosQuantidade,
      };

      const pedidoCriado = await apiService.createPedido(novoPedidoData);

      try {
        window.dispatchEvent(new CustomEvent('pedido:created', { detail: pedidoCriado }));
      } catch {}
      
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

  const singularToFederacaoDays = deadlines?.singularToFederacao;
  const federacaoToConfederacaoDays = deadlines?.federacaoToConfederacao;
  const formatPrazo = (days?: number | null) => {
    if (typeof days !== 'number' || !Number.isFinite(days)) {
      return null;
    }
    const normalized = Math.max(1, Math.round(days));
    return `${normalized} dia${normalized === 1 ? '' : 's'}`;
  };
  const singularPrazoText = formatPrazo(singularToFederacaoDays);
  const federacaoPrazoText = formatPrazo(federacaoToConfederacaoDays);
  const prazoResumoText = isLoadingSettings ? 'seguindo as configurações do sistema (carregando prazos...)' : 'conforme definido nas configurações do sistema';
  const prazoEscalonamento = (prazo?: string | null) => {
    if (prazo) {
      return ` (+ ${prazo})`;
    }
    return isLoadingSettings ? ' (carregando prazos...)' : ' (seguindo o prazo configurado)';
  };

  return (
    <Dialog open onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
    <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto bg-white/95 border border-slate-200 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.65)]">
      <DialogHeader className="text-left">
        <div className="flex items-center justify-between gap-4">
          <div>
            <DialogTitle>Novo Pedido de Credenciamento</DialogTitle>
            <DialogDescription>
                Informe os dados do pedido para iniciar o credenciamento.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

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
                <Popover open={isCidadeSelectOpen} onOpenChange={setIsCidadeSelectOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="cidade"
                      variant="outline"
                      role="combobox"
                      aria-expanded={isCidadeSelectOpen}
                      className="w-full justify-between text-left font-normal"
                      disabled={isSubmitting || isLoading}
                    >
                      <span className="line-clamp-1">
                        {cidadeSelecionada
                          ? `${cidadeSelecionada.nm_cidade}, ${cidadeSelecionada.uf_municipio} (${cidadeSelecionada.nm_regiao})`
                          : cidadePlaceholder}
                      </span>
                      <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-[min(560px,calc(100vw-2rem))] p-0"
                  >
                    <Command className="[&_[cmdk-input-wrapper]]:px-4 [&_[cmdk-input]]:h-11">
                      <CommandInput
                        placeholder="Busque pelo nome da cidade..."
                        disabled={isLoading}
                      />
                      <CommandList className="max-h-80 overflow-y-auto">
                        <CommandEmpty>
                          {isLoading ? 'Carregando cidades...' : 'Nenhuma cidade encontrada.'}
                        </CommandEmpty>
                        <CommandGroup>
                          {cidades.map((cidade) => (
                            <CommandItem
                              key={cidade.cd_municipio_7}
                              value={`${cidade.nm_cidade} ${cidade.uf_municipio} ${cidade.nm_regiao}`}
                              onSelect={() => {
                                setFormData({ ...formData, cidade_id: cidade.cd_municipio_7 });
                                setIsCidadeSelectOpen(false);
                              }}
                              className="items-start gap-3 px-3 py-2"
                            >
                              <div className="flex flex-col text-left leading-tight">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{cidade.nm_cidade}</span>
                                  <Badge variant="secondary" className="text-[11px]">
                                    {cidade.uf_municipio}
                                  </Badge>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {cidade.nm_regiao}
                                </span>
                              </div>
                              {cidadeSelecionada?.cd_municipio_7 === cidade.cd_municipio_7 && (
                                <Check className="ml-auto mt-1 size-4 text-primary" />
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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
                      {especialidadeOptions}
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

              {/* Beneficiários na cidade */}
              <div className="space-y-2">
                <Label htmlFor="beneficiarios_quantidade">Beneficiários na cidade</Label>
                <Input
                  id="beneficiarios_quantidade"
                  type="number"
                  min="0"
                  value={formData.beneficiarios_quantidade}
                  onChange={(e) => setFormData({ ...formData, beneficiarios_quantidade: e.target.value })}
                  className="w-40"
                  placeholder="Ex: 1200"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-gray-500">Informe o total estimado de beneficiários na localidade.</p>
              </div>

              {/* Categoria do pedido */}
              <div className="space-y-2">
                <Label htmlFor="motivo_categoria">Categoria do pedido</Label>
                <Select
                  value={formData.motivo_categoria || '__sem_categoria'}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      motivo_categoria: value === '__sem_categoria' || value === '__none' ? '' : value
                    })
                  }
                  disabled={isSubmitting || isLoadingCategorias}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingCategorias ? 'Carregando categorias...' : 'Selecione a categoria'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__sem_categoria">Sem categoria</SelectItem>
                    {pedidoMotivos.length === 0 && (
                      <SelectItem value="__none" disabled>
                        Nenhuma categoria cadastrada
                      </SelectItem>
                    )}
                    {pedidoMotivos.map((motivo) => (
                      <SelectItem key={motivo} value={motivo}>
                        {motivo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Justificativa */}
              <div className="space-y-2">
                <Label htmlFor="observacoes">Justificativa</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Detalhe a justificativa e informações adicionais sobre a necessidade do credenciamento..."
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
                  <li>
                    • Prazo inicial: {singularPrazoText ?? prazoResumoText} para a Singular responsável
                  </li>
                  <li>
                    • Se não atendido, será escalado automaticamente para Federação{prazoEscalonamento(singularPrazoText)}
                  </li>
                  <li>
                    • Por último, será escalado para Confederação{prazoEscalonamento(federacaoPrazoText)}
                  </li>
                </ul>
              </div>

              {/* Ações */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t">
              <DialogClose asChild>
                <Button 
                  type="button" 
                  variant="outline"
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
              </DialogClose>
              <Button 
                type="submit" 
                className="bg-blue-600 hover:bg-blue-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Criando...' : 'Criar Pedido'}
              </Button>
            </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
