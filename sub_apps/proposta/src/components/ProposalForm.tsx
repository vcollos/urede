import { useState, useEffect } from 'react';
import { ProposalData, Modality } from '../App';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card } from './ui/card';
import { Plus, Trash2, Eye, Save } from 'lucide-react';
import { ModalityForm } from './ModalityForm';
import { toast } from 'sonner';

type ProposalFormProps = {
  initialData: ProposalData;
  onSave: (data: ProposalData) => void;
  onChange?: (data: ProposalData) => void;
  livePreview?: boolean;
  onSaveToLibrary?: (data: ProposalData) => void;
};

export function ProposalForm({ initialData, onSave, onChange, livePreview, onSaveToLibrary }: ProposalFormProps) {
  const [formData, setFormData] = useState<ProposalData>(initialData);

  // Atualizar formData quando initialData mudar (carregar proposta salva)
  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  // Atualizar preview em tempo real
  useEffect(() => {
    if (onChange && livePreview) {
      onChange(formData);
    }
  }, [formData, onChange, livePreview]);

  const handleAddModality = () => {
    const newModality: Modality = {
      id: crypto.randomUUID(),
      name: '',
      price: '',
      billingType: 'oneTime',
      included: [],
    };
    
    // Se já existe uma modalidade, copiar os dados dela para a nova
    if (formData.modalities.length > 0) {
      const firstModality = formData.modalities[0];
      newModality.included = [...firstModality.included];
      newModality.notIncluded = firstModality.notIncluded ? [...firstModality.notIncluded] : undefined;
      newModality.advantages = firstModality.advantages ? [...firstModality.advantages] : undefined;
    }
    
    setFormData({
      ...formData,
      modalities: [...formData.modalities, newModality],
    });
  };

  const handleUpdateModality = (id: string, updatedModality: Modality) => {
    setFormData({
      ...formData,
      modalities: formData.modalities.map((m) =>
        m.id === id ? updatedModality : m
      ),
    });
  };

  const handleRemoveModality = (id: string) => {
    setFormData({
      ...formData,
      modalities: formData.modalities.filter((m) => m.id !== id),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleSaveToLibrary = () => {
    if (onSaveToLibrary && formData.title && formData.clientName) {
      onSaveToLibrary(formData);
      toast.success('Proposta salva na biblioteca!');
    } else {
      toast.error('Preencha pelo menos o título e nome do cliente.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Informações Gerais */}
      <Card className="p-6">
        <h2 className="mb-6 text-foreground">Informações Gerais</h2>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Título da Proposta</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Ex: Proposta de Desenvolvimento de Website"
              required
            />
          </div>

          <div>
            <Label htmlFor="clientName">Nome do Cliente</Label>
            <Input
              id="clientName"
              value={formData.clientName}
              onChange={(e) =>
                setFormData({ ...formData, clientName: e.target.value })
              }
              placeholder="Ex: Uniodonto Rio Claro"
              required
            />
          </div>

          <div>
            <Label htmlFor="objective">Objetivo</Label>
            <Textarea
              id="objective"
              value={formData.objective}
              onChange={(e) =>
                setFormData({ ...formData, objective: e.target.value })
              }
              placeholder="Descreva o objetivo do projeto..."
              rows={4}
              required
            />
          </div>
        </div>
      </Card>

      {/* Modalidades */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-foreground">Modalidades de Produtos/Serviços</h2>
          <Button
            type="button"
            onClick={handleAddModality}
            className="gap-2"
            variant="outline"
          >
            <Plus className="h-4 w-4" />
            Adicionar Modalidade
          </Button>
        </div>

        {formData.modalities.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">
              Nenhuma modalidade adicionada ainda.
            </p>
            <p className="text-muted-foreground text-sm mt-2">
              Clique em "Adicionar Modalidade" para começar.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {formData.modalities.map((modality, index) => (
              <Card key={modality.id} className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-foreground">
                    Modalidade {index + 1}
                    {modality.name && `: ${modality.name}`}
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveModality(modality.id)}
                    className="gap-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remover
                  </Button>
                </div>
                
                <ModalityForm
                  modality={modality}
                  onChange={(updated) =>
                    handleUpdateModality(modality.id, updated)
                  }
                />
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Informações Adicionais */}
      <Card className="p-6">
        <h2 className="mb-6 text-foreground">Informações Adicionais</h2>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="paymentMethods">Formas de Pagamento</Label>
            <Textarea
              id="paymentMethods"
              value={formData.paymentMethods || ''}
              onChange={(e) =>
                setFormData({ ...formData, paymentMethods: e.target.value })
              }
              placeholder="Ex: PIX, Boleto, Cartão de Crédito (até 12x)..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="discounts">Descontos</Label>
            <Textarea
              id="discounts"
              value={formData.discounts || ''}
              onChange={(e) =>
                setFormData({ ...formData, discounts: e.target.value })
              }
              placeholder="Ex: 10% de desconto para pagamento à vista..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="observations">Observações</Label>
            <Textarea
              id="observations"
              value={formData.observations || ''}
              onChange={(e) =>
                setFormData({ ...formData, observations: e.target.value })
              }
              placeholder="Observações gerais sobre a proposta..."
              rows={4}
            />
          </div>

          <div>
            <Label htmlFor="technicalNotes">Notas Técnicas</Label>
            <Textarea
              id="technicalNotes"
              value={formData.technicalNotes || ''}
              onChange={(e) =>
                setFormData({ ...formData, technicalNotes: e.target.value })
              }
              placeholder="Notas técnicas relevantes..."
              rows={4}
            />
          </div>

          <div>
            <Label htmlFor="terms">Termos e Condições</Label>
            <Textarea
              id="terms"
              value={formData.terms || ''}
              onChange={(e) =>
                setFormData({ ...formData, terms: e.target.value })
              }
              placeholder="Termos de compra/contratação..."
              rows={6}
            />
          </div>
        </div>
      </Card>

      {/* Submit Button */}
      {!livePreview && (
        <div className="flex justify-end gap-3">
          {onSaveToLibrary && (
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="gap-2"
              onClick={handleSaveToLibrary}
              disabled={!formData.title || !formData.clientName}
            >
              <Save className="h-4 w-4" />
              Salvar Proposta
            </Button>
          )}
          <Button
            type="submit"
            size="lg"
            className="gap-2"
            disabled={formData.modalities.length === 0}
          >
            <Eye className="h-4 w-4" />
            Visualizar Proposta
          </Button>
        </div>
      )}
    </form>
  );
}