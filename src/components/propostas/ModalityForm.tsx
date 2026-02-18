import { Link as LinkIcon, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Modality } from '../../types/propostas';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

interface ModalityFormProps {
  modality: Modality;
  onChange: (modality: Modality) => void;
}

export function ModalityForm({ modality, onChange }: ModalityFormProps) {
  const [newIncludedItem, setNewIncludedItem] = useState('');
  const [newNotIncludedItem, setNewNotIncludedItem] = useState('');
  const [newAdvantage, setNewAdvantage] = useState('');

  const handleAddIncluded = () => {
    if (!newIncludedItem.trim()) return;
    onChange({
      ...modality,
      included: [...modality.included, newIncludedItem.trim()],
    });
    setNewIncludedItem('');
  };

  const handleAddNotIncluded = () => {
    if (!newNotIncludedItem.trim()) return;
    onChange({
      ...modality,
      notIncluded: [...(modality.notIncluded || []), newNotIncludedItem.trim()],
    });
    setNewNotIncludedItem('');
  };

  const handleAddAdvantage = () => {
    if (!newAdvantage.trim()) return;
    onChange({
      ...modality,
      advantages: [...(modality.advantages || []), newAdvantage.trim()],
    });
    setNewAdvantage('');
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor={`name-${modality.id}`}>Nome da Modalidade</Label>
          <Input
            id={`name-${modality.id}`}
            value={modality.name}
            onChange={(event) => onChange({ ...modality, name: event.target.value })}
            placeholder="Ex: Plano Uniodonto Pré-Pagamento"
            required
          />
        </div>

        <div>
          <Label htmlFor={`price-${modality.id}`}>Valor</Label>
          <Input
            id={`price-${modality.id}`}
            value={modality.price}
            onChange={(event) => onChange({ ...modality, price: event.target.value })}
            placeholder="Ex: R$ 39,90 por beneficiário"
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor={`billingType-${modality.id}`}>Tipo de Cobrança</Label>
        <select
          id={`billingType-${modality.id}`}
          value={modality.billingType}
          onChange={(event) =>
            onChange({
              ...modality,
              billingType: event.target.value as Modality['billingType'],
            })
          }
          className="flex h-10 w-full rounded-lg border border-input bg-input-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="monthly">Mensal</option>
          <option value="oneTime">Pagamento único</option>
          <option value="custom">Customizado</option>
        </select>
      </div>

      <div>
        <Label>O que está incluso</Label>
        <div className="mt-2 space-y-2">
          {modality.included.map((item, index) => (
            <div key={`${modality.id}-included-${index}`} className="flex items-center gap-2">
              <div className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm">
                {item}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  onChange({
                    ...modality,
                    included: modality.included.filter((_, itemIndex) => itemIndex !== index),
                  })
                }
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="flex gap-2">
            <Input
              value={newIncludedItem}
              onChange={(event) => setNewIncludedItem(event.target.value)}
              placeholder="Ex: Consultas e procedimentos preventivos"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleAddIncluded();
                }
              }}
            />
            <Button type="button" onClick={handleAddIncluded} variant="outline" size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div>
        <Label>O que não está incluso (opcional)</Label>
        <div className="mt-2 space-y-2">
          {modality.notIncluded?.map((item, index) => (
            <div key={`${modality.id}-notIncluded-${index}`} className="flex items-center gap-2">
              <div className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm">
                {item}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  onChange({
                    ...modality,
                    notIncluded: modality.notIncluded?.filter((_, itemIndex) => itemIndex !== index),
                  })
                }
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="flex gap-2">
            <Input
              value={newNotIncludedItem}
              onChange={(event) => setNewNotIncludedItem(event.target.value)}
              placeholder="Ex: Procedimentos estéticos odontológicos"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleAddNotIncluded();
                }
              }}
            />
            <Button type="button" onClick={handleAddNotIncluded} variant="outline" size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor={`provider-${modality.id}`}>Responsabilidades do Fornecedor</Label>
          <Textarea
            id={`provider-${modality.id}`}
            value={modality.responsibilities?.provider || ''}
            onChange={(event) =>
              onChange({
                ...modality,
                responsibilities: {
                  provider: event.target.value,
                  client: modality.responsibilities?.client || '',
                },
              })
            }
            rows={4}
            placeholder="Ex: Garantir rede credenciada, autorização de procedimentos e suporte ao RH."
          />
        </div>
        <div>
          <Label htmlFor={`client-${modality.id}`}>Responsabilidades do Cliente</Label>
          <Textarea
            id={`client-${modality.id}`}
            value={modality.responsibilities?.client || ''}
            onChange={(event) =>
              onChange({
                ...modality,
                responsibilities: {
                  provider: modality.responsibilities?.provider || '',
                  client: event.target.value,
                },
              })
            }
            rows={4}
            placeholder="Ex: Enviar movimentação cadastral mensal e cumprir prazos contratuais."
          />
        </div>
      </div>

      <div>
        <Label>Vantagens (opcional)</Label>
        <div className="mt-2 space-y-2">
          {modality.advantages?.map((item, index) => (
            <div key={`${modality.id}-advantages-${index}`} className="flex items-center gap-2">
              <div className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm">
                {item}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  onChange({
                    ...modality,
                    advantages: modality.advantages?.filter((_, itemIndex) => itemIndex !== index),
                  })
                }
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="flex gap-2">
            <Input
              value={newAdvantage}
              onChange={(event) => setNewAdvantage(event.target.value)}
              placeholder="Ex: Atendimento nacional e previsibilidade de custos"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleAddAdvantage();
                }
              }}
            />
            <Button type="button" onClick={handleAddAdvantage} variant="outline" size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor={`detailsLink-${modality.id}`}>
          <div className="inline-flex items-center gap-2">
            <LinkIcon className="h-4 w-4" />
            Link de detalhamento (opcional)
          </div>
        </Label>
        <Input
          id={`detailsLink-${modality.id}`}
          type="url"
          value={modality.detailsLink || ''}
          onChange={(event) => onChange({ ...modality, detailsLink: event.target.value })}
          placeholder="https://www.uniodonto.com.br/rede-credenciada"
        />
        <div className="mt-3">
          <Label htmlFor={`detailsLinkTitle-${modality.id}`}>Título do link (opcional)</Label>
          <Input
            id={`detailsLinkTitle-${modality.id}`}
            type="text"
            value={modality.detailsLinkTitle || ''}
            onChange={(event) => onChange({ ...modality, detailsLinkTitle: event.target.value })}
            placeholder="Ex: Consultar rede credenciada"
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Link para download ou para mais informações sobre esta modalidade.
        </p>
      </div>
    </div>
  );
}
