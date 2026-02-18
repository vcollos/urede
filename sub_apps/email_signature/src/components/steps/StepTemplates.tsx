import { SignatureFormState } from '../../types';
import template1Icon from '../../../templates/icones_templates/template-1.svg';
import template10Icon from '../../../templates/icones_templates/template-10.svg';
import template11Icon from '../../../templates/icones_templates/template-11.svg';
import template12Icon from '../../../templates/icones_templates/template-12.svg';
import template2Icon from '../../../templates/icones_templates/template-2.svg';
import template3Icon from '../../../templates/icones_templates/template-3.svg';
import template4Icon from '../../../templates/icones_templates/template-4.svg';
import template5Icon from '../../../templates/icones_templates/template-5.svg';
import template6Icon from '../../../templates/icones_templates/template-6.svg';
import template7Icon from '../../../templates/icones_templates/template-7.svg';
import template8Icon from '../../../templates/icones_templates/template-8.svg';
import template9Icon from '../../../templates/icones_templates/template-9.svg';

interface StepTemplatesProps {
  locale: SignatureFormState['locale'];
  template: SignatureFormState['template'];
  onChange: (template: SignatureFormState['template']) => void;
}

const MODELS: SignatureFormState['template'][] = [
  'template_01',
  'template_2',
  'template_3',
  'template_4',
  'template_5',
  'template_6',
  'template_7',
  'template_8',
  'template_9',
  'template_10',
  'template_11',
  'template_12',
];

const PREVIEW_BY_TEMPLATE: Record<SignatureFormState['template'], string> = {
  template_01: template1Icon,
  template_2: template2Icon,
  template_3: template3Icon,
  template_4: template4Icon,
  template_5: template5Icon,
  template_6: template6Icon,
  template_7: template7Icon,
  template_8: template8Icon,
  template_9: template9Icon,
  template_10: template10Icon,
  template_11: template11Icon,
  template_12: template12Icon,
};

const LABELS = {
  'pt-BR': {
    title: 'Etapa 3: Modelos',
    subtitle: 'Escolha um modelo',
    selected: 'Selecionado',
  },
  en: {
    title: 'Step 3: Templates',
    subtitle: 'Choose a template',
    selected: 'Selected',
  },
} as const;

const formatTemplateLabel = (id: SignatureFormState['template']) => {
  const numeric = id.replace('template_', '').padStart(2, '0');
  return `Modelo ${numeric}`;
};

export function StepTemplates({ locale, template, onChange }: StepTemplatesProps) {
  const text = LABELS[locale];

  return (
    <section className="step-content" aria-label={text.title}>
      <h2>{text.title}</h2>
      <p className="step-subtitle">{text.subtitle}</p>

      <div className="template-grid" role="radiogroup" aria-label={text.subtitle}>
        {MODELS.map((id) => {
          const active = template === id;
          return (
            <label
              key={id}
              className={`template-card ${active ? 'is-active' : ''}`}
            >
              <input
                type="radio"
                name="template"
                value={id}
                checked={active}
                onChange={() => onChange(id)}
              />
              <span className="template-title">{formatTemplateLabel(id)}</span>
              <img
                src={PREVIEW_BY_TEMPLATE[id]}
                alt={`${formatTemplateLabel(id)} preview`}
                className="template-thumb"
                loading="lazy"
              />
              {active && <span className="template-selected-chip">{text.selected}</span>}
            </label>
          );
        })}
      </div>
    </section>
  );
}
