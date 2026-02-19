import { useState } from 'react';
import { Modality } from '../App';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select } from './ui/select';
import { Button } from './ui/button';
import { Plus, X, Link as LinkIcon } from 'lucide-react';

type ModalityFormProps = {
  modality: Modality;
  onChange: (modality: Modality) => void;
};

export function ModalityForm({ modality, onChange }: ModalityFormProps) {
  const [newIncludedItem, setNewIncludedItem] = useState('');
  const [newNotIncludedItem, setNewNotIncludedItem] = useState('');
  const [newAdvantage, setNewAdvantage] = useState('');

  const handleAddIncluded = () => {
    if (newIncludedItem.trim()) {
      onChange({
        ...modality,
        included: [...modality.included, newIncludedItem.trim()],
      });
      setNewIncludedItem('');
    }
  };

  const handleRemoveIncluded = (index: number) => {
    onChange({
      ...modality,
      included: modality.included.filter((_, i) => i !== index),
    });
  };

  const handleAddNotIncluded = () => {
    if (newNotIncludedItem.trim()) {
      onChange({
        ...modality,
        notIncluded: [...(modality.notIncluded || []), newNotIncludedItem.trim()],
      });
      setNewNotIncludedItem('');
    }
  };

  const handleRemoveNotIncluded = (index: number) => {
    onChange({
      ...modality,
      notIncluded: modality.notIncluded?.filter((_, i) => i !== index),
    });
  };

  const handleAddAdvantage = () => {
    if (newAdvantage.trim()) {
      onChange({
        ...modality,
        advantages: [...(modality.advantages || []), newAdvantage.trim()],
      });
      setNewAdvantage('');
    }
  };

  const handleRemoveAdvantage = (index: number) => {
    onChange({
      ...modality,
      advantages: modality.advantages?.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor={`name-${modality.id}`}>Nome da Modalidade</Label>
          <Input
            id={`name-${modality.id}`}
            value={modality.name}
            onChange={(e) =>
              onChange({ ...modality, name: e.target.value })
            }
            placeholder="Ex: SaaS (Aluguel)"
            required
          />
        </div>

        <div>
          <Label htmlFor={`price-${modality.id}`}>Valor</Label>
          <Input
            id={`price-${modality.id}`}
            value={modality.price}
            onChange={(e) =>
              onChange({ ...modality, price: e.target.value })
            }
            placeholder="Ex: R$ 490,00"
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor={`billingType-${modality.id}`}>Tipo de Cobrança</Label>
        <select
          id={`billingType-${modality.id}`}
          value={modality.billingType}
          onChange={(e) =>
            onChange({
              ...modality,
              billingType: e.target.value as Modality['billingType'],
            })
          }
          className="flex h-10 w-full rounded-lg border border-input bg-input-background px-3 py-2 ring-offset-background file:border-0 file:bg-transparent placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="monthly">Mensal</option>
          <option value="oneTime">Pagamento Único</option>
          <option value="custom">Customizado</option>
        </select>
      </div>

      {/* O que está incluso */}
      <div>
        <Label>O que está incluso</Label>
        <div className="mt-2 space-y-2">
          {modality.included.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm">
                {item}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveIncluded(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          
          <div className="flex gap-2">
            <Input
              value={newIncludedItem}
              onChange={(e) => setNewIncludedItem(e.target.value)}
              placeholder="Adicionar item incluído..."
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddIncluded();
                }
              }}
            />
            <Button
              type="button"
              onClick={handleAddIncluded}
              variant="outline"
              size="sm"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* O que não está incluso */}
      <div>
        <Label>O que não está incluso (opcional)</Label>
        <div className="mt-2 space-y-2">
          {modality.notIncluded?.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm">
                {item}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveNotIncluded(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          
          <div className="flex gap-2">
            <Input
              value={newNotIncludedItem}
              onChange={(e) => setNewNotIncludedItem(e.target.value)}
              placeholder="Adicionar item não incluído..."
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddNotIncluded();
                }
              }}
            />
            <Button
              type="button"
              onClick={handleAddNotIncluded}
              variant="outline"
              size="sm"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Responsabilidades */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label htmlFor={`provider-${modality.id}`}>
            Responsabilidades do Fornecedor
          </Label>
          <Textarea
            id={`provider-${modality.id}`}
            value={modality.responsibilities?.provider || ''}
            onChange={(e) =>
              onChange({
                ...modality,
                responsibilities: {
                  provider: e.target.value,
                  client: modality.responsibilities?.client || '',
                },
              })
            }
            placeholder="O que você vai fazer..."
            rows={4}
          />
        </div>

        <div>
          <Label htmlFor={`client-${modality.id}`}>
            Responsabilidades do Cliente
          </Label>
          <Textarea
            id={`client-${modality.id}`}
            value={modality.responsibilities?.client || ''}
            onChange={(e) =>
              onChange({
                ...modality,
                responsibilities: {
                  provider: modality.responsibilities?.provider || '',
                  client: e.target.value,
                },
              })
            }
            placeholder="O que o cliente vai fazer..."
            rows={4}
          />
        </div>
      </div>

      {/* Vantagens */}
      <div>
        <Label>Vantagens (opcional)</Label>
        <div className="mt-2 space-y-2">
          {modality.advantages?.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm">
                {item}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveAdvantage(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          
          <div className="flex gap-2">
            <Input
              value={newAdvantage}
              onChange={(e) => setNewAdvantage(e.target.value)}
              placeholder="Adicionar vantagem..."
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddAdvantage();
                }
              }}
            />
            <Button
              type="button"
              onClick={handleAddAdvantage}
              variant="outline"
              size="sm"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Link de Detalhamento */}
      <div>
        <Label htmlFor={`detailsLink-${modality.id}`}>
          <div className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4" />
            Link de Detalhamento (opcional)
          </div>
        </Label>
        <Input
          id={`detailsLink-${modality.id}`}
          type="url"
          value={modality.detailsLink || ''}
          onChange={(e) =>
            onChange({ ...modality, detailsLink: e.target.value })
          }
          placeholder="https://exemplo.com/detalhes.pdf"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Link para download ou mais informações sobre esta modalidade
        </p>
      </div>
    </div>
  );
}