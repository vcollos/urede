import { SignatureFormState } from '../../types';

interface StepTemplatesProps {
  locale: SignatureFormState['locale'];
  template: SignatureFormState['template'];
  onChange: (template: SignatureFormState['template']) => void;
}

const LABELS = {
  'pt-BR': {
    title: 'Etapa 3: Modelos',
    subtitle: 'Escolha um modelo',
    options: [
      { id: 'model_1', label: 'Modelo 1', description: 'Coluna lateral de imagens e informacoes.' },
      { id: 'model_2', label: 'Modelo 2', description: 'Cartao com imagens no topo.' },
      { id: 'model_3', label: 'Modelo 3', description: 'Faixa superior com visual compacto.' },
    ],
  },
  en: {
    title: 'Step 3: Templates',
    subtitle: 'Choose a template',
    options: [
      { id: 'model_1', label: 'Template 1', description: 'Side image column with details.' },
      { id: 'model_2', label: 'Template 2', description: 'Card layout with top images.' },
      { id: 'model_3', label: 'Template 3', description: 'Top stripe with compact visual.' },
    ],
  },
} as const;

export function StepTemplates({ locale, template, onChange }: StepTemplatesProps) {
  const text = LABELS[locale];

  return (
    <section className="step-content" aria-label={text.title}>
      <h2>{text.title}</h2>
      <p className="step-subtitle">{text.subtitle}</p>

      <div className="template-grid" role="radiogroup" aria-label={text.subtitle}>
        {text.options.map((option) => {
          const active = template === option.id;
          return (
            <label
              key={option.id}
              className={`template-card ${active ? 'is-active' : ''}`}
            >
              <input
                type="radio"
                name="template"
                value={option.id}
                checked={active}
                onChange={() => onChange(option.id as SignatureFormState['template'])}
              />
              <span className="template-title">{option.label}</span>
              <span className="template-description">{option.description}</span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
