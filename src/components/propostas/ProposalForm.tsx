import { Eye, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Modality, ProposalData } from '../../types/propostas';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { ModalityForm } from './ModalityForm';

interface ProposalFormProps {
  initialData: ProposalData;
  onSave: (data: ProposalData) => void;
  onChange?: (data: ProposalData) => void;
  livePreview?: boolean;
  onSaveToLibrary?: (data: ProposalData) => void;
}

const createModality = (): Modality => ({
  id: crypto.randomUUID(),
  name: '',
  price: '',
  billingType: 'oneTime',
  included: [],
});

export function ProposalForm({
  initialData,
  onSave,
  onChange,
  livePreview,
  onSaveToLibrary,
}: ProposalFormProps) {
  const [formData, setFormData] = useState<ProposalData>(initialData);

  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  useEffect(() => {
    if (livePreview && onChange) {
      onChange(formData);
    }
  }, [formData, livePreview, onChange]);

  const handleAddModality = () => {
    const next = createModality();
    if (formData.modalities.length > 0) {
      const base = formData.modalities[0];
      next.included = [...base.included];
      next.notIncluded = base.notIncluded ? [...base.notIncluded] : undefined;
      next.advantages = base.advantages ? [...base.advantages] : undefined;
    }
    setFormData((prev) => ({
      ...prev,
      modalities: [...prev.modalities, next],
    }));
  };

  return (
    <form
      className="space-y-8"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(formData);
      }}
    >
      <Card className="space-y-6 rounded-2xl border border-[#E7E4FB] bg-white p-6">
        <h2 className="text-xl font-semibold text-gray-900">Informações Gerais</h2>

        <div className="space-y-4">
          <div>
            <Label htmlFor="proposal-title">Título da Proposta</Label>
            <Input
              id="proposal-title"
              value={formData.title}
              onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Ex: Plano Uniodonto Pré-Pagamento"
              required
            />
          </div>

          <div>
            <Label htmlFor="proposal-client">Nome do Cliente</Label>
            <Input
              id="proposal-client"
              value={formData.clientName}
              onChange={(event) => setFormData((prev) => ({ ...prev, clientName: event.target.value }))}
              placeholder="Ex: Empresa Exemplo Ltda"
              required
            />
          </div>

          <div>
            <Label htmlFor="proposal-objective">Objetivo</Label>
            <Textarea
              id="proposal-objective"
              value={formData.objective}
              onChange={(event) => setFormData((prev) => ({ ...prev, objective: event.target.value }))}
              placeholder="Ex: Apresentar proposta do Plano Uniodonto Pré-Pagamento para colaboradores, com foco em cobertura odontológica nacional e previsibilidade de custo mensal."
              rows={4}
              required
            />
          </div>
        </div>
      </Card>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Modalidades de Produtos/Serviços</h2>
          <Button type="button" variant="outline" className="gap-2" onClick={handleAddModality}>
            <Plus className="h-4 w-4" />
            Adicionar Modalidade
          </Button>
        </div>

        {formData.modalities.length === 0 ? (
          <Card className="rounded-2xl border border-[#E7E4FB] bg-white p-10 text-center">
            <p className="text-gray-500">Nenhuma modalidade adicionada ainda.</p>
            <p className="mt-2 text-sm text-gray-500">Clique em "Adicionar Modalidade" para começar.</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {formData.modalities.map((modality, index) => (
              <Card key={modality.id} className="rounded-2xl border border-[#E7E4FB] bg-white p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-900">
                    Modalidade {index + 1}
                    {modality.name ? `: ${modality.name}` : ''}
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-[#C53030] hover:text-[#9B2C2C]"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        modalities: prev.modalities.filter((item) => item.id !== modality.id),
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    Remover
                  </Button>
                </div>

                <ModalityForm
                  modality={modality}
                  onChange={(updated) =>
                    setFormData((prev) => ({
                      ...prev,
                      modalities: prev.modalities.map((item) =>
                        item.id === modality.id ? updated : item
                      ),
                    }))
                  }
                />
              </Card>
            ))}
          </div>
        )}
      </div>

      <Card className="space-y-4 rounded-2xl border border-[#E7E4FB] bg-white p-6">
        <h2 className="text-xl font-semibold text-gray-900">Informações Adicionais</h2>

        <div>
          <Label htmlFor="paymentMethods">Formas de Pagamento</Label>
            <Textarea
              id="paymentMethods"
              value={formData.paymentMethods || ''}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, paymentMethods: event.target.value }))
              }
              placeholder="Ex: Faturamento mensal via boleto bancário, com vencimento em 10 dias após emissão."
              rows={3}
            />
          </div>

        <div>
          <Label htmlFor="discounts">Descontos</Label>
            <Textarea
              id="discounts"
              value={formData.discounts || ''}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, discounts: event.target.value }))
              }
              placeholder="Ex: Isenção de taxa de implantação para contratos com mais de 100 vidas."
              rows={3}
            />
          </div>

        <div>
          <Label htmlFor="observations">Observações</Label>
            <Textarea
              id="observations"
              value={formData.observations || ''}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, observations: event.target.value }))
              }
              placeholder="Ex: Rede credenciada sujeita à disponibilidade regional e regras contratuais vigentes."
              rows={4}
            />
          </div>

        <div>
          <Label htmlFor="technicalNotes">Notas Técnicas</Label>
            <Textarea
              id="technicalNotes"
              value={formData.technicalNotes || ''}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, technicalNotes: event.target.value }))
              }
              placeholder="Ex: Cobertura conforme Rol ANS vigente, incluindo urgência/emergência e procedimentos preventivos."
              rows={4}
            />
          </div>

        <div>
          <Label htmlFor="terms">Termos e Condições</Label>
            <Textarea
              id="terms"
              value={formData.terms || ''}
              onChange={(event) =>
                setFormData((prev) => ({ ...prev, terms: event.target.value }))
              }
              placeholder="Ex: Vigência inicial de 12 meses, reajuste anual conforme índice contratual e regras da ANS."
              rows={6}
            />
          </div>
      </Card>

      {!livePreview && (
        <div className="flex justify-end gap-3">
          {onSaveToLibrary && (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => onSaveToLibrary(formData)}
              disabled={!formData.title || !formData.clientName}
            >
              <Save className="h-4 w-4" />
              Salvar Proposta
            </Button>
          )}

          <Button type="submit" className="gap-2" disabled={formData.modalities.length === 0}>
            <Eye className="h-4 w-4" />
            Visualizar Proposta
          </Button>
        </div>
      )}
    </form>
  );
}
