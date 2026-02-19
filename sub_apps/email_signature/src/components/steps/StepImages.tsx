import { SignatureFormState, ValidationErrors } from '../../types';
import { FormField } from '../FormField';

interface StepImagesProps {
  locale: SignatureFormState['locale'];
  state: SignatureFormState;
  errors: ValidationErrors;
  placeholders: {
    imageUrl: string;
  };
  updateImageUrl: (key: 'profile' | 'logo' | 'handwritten', value: string) => void;
  setImageVisibility: (key: 'profile' | 'logo' | 'handwritten', visible: boolean) => void;
  normalizeUrlAt: (path: string) => void;
  updateShape: (shape: SignatureFormState['images']['shape']) => void;
  updateSize: (size: SignatureFormState['images']['size']) => void;
}

const LABELS = {
  'pt-BR': {
    title: 'Etapa 2: Imagens',
    subtitle: 'Imagem da assinatura',
    profile: 'Foto de Perfil ou QRCode',
    logo: 'Logotipo da empresa',
    handwritten: 'Assinatura manuscrita',
    show: 'Mostrar',
    shape: 'Formato',
    size: 'Tamanho',
    shapeSquare: 'Quadrado',
    shapeCircle: 'Circular',
    sizeSmall: 'Pequeno',
    sizeMedium: 'Medio',
    sizeLarge: 'Grande',
    hint: 'Dica: use links diretos de imagem (Google Drive publico, CDN ou site institucional).',
  },
  en: {
    title: 'Step 2: Images',
    subtitle: 'Signature images',
    profile: 'Profile Photo or QR Code',
    logo: 'Company logo',
    handwritten: 'Handwritten signature',
    show: 'Show',
    shape: 'Shape',
    size: 'Size',
    shapeSquare: 'Square',
    shapeCircle: 'Circle',
    sizeSmall: 'Small',
    sizeMedium: 'Medium',
    sizeLarge: 'Large',
    hint: 'Tip: use direct image links (public Google Drive, CDN, or website).',
  },
} as const;

export function StepImages({
  locale,
  state,
  errors,
  placeholders,
  updateImageUrl,
  setImageVisibility,
  normalizeUrlAt,
  updateShape,
  updateSize,
}: StepImagesProps) {
  const text = LABELS[locale];

  return (
    <section className="step-content" aria-label={text.title}>
      <h2>{text.title}</h2>
      <p className="step-subtitle">{text.subtitle}</p>
      <p className="field-hint">{text.hint}</p>

      <div className="form-grid one-column">
        <FormField id="image-profile" label={text.profile} error={errors['images.profile.url']}>
          <div className="field-inline">
            <input
              id="image-profile"
              value={state.images.profile.url}
              onChange={(event) => updateImageUrl('profile', event.target.value)}
              onBlur={() => normalizeUrlAt('images.profile.url')}
              placeholder={placeholders.imageUrl}
            />
            <label className="checkbox-inline" htmlFor="show-profile">
              <input
                id="show-profile"
                type="checkbox"
                checked={state.images.profile.visible}
                onChange={(event) => setImageVisibility('profile', event.target.checked)}
              />
              {text.show}
            </label>
          </div>
        </FormField>

        <FormField id="image-logo" label={text.logo} error={errors['images.logo.url']}>
          <div className="field-inline">
            <input
              id="image-logo"
              value={state.images.logo.url}
              onChange={(event) => updateImageUrl('logo', event.target.value)}
              onBlur={() => normalizeUrlAt('images.logo.url')}
              placeholder={placeholders.imageUrl}
            />
            <label className="checkbox-inline" htmlFor="show-logo">
              <input
                id="show-logo"
                type="checkbox"
                checked={state.images.logo.visible}
                onChange={(event) => setImageVisibility('logo', event.target.checked)}
              />
              {text.show}
            </label>
          </div>
        </FormField>

        <FormField id="image-handwritten" label={text.handwritten} error={errors['images.handwritten.url']}>
          <div className="field-inline">
            <input
              id="image-handwritten"
              value={state.images.handwritten.url}
              onChange={(event) => updateImageUrl('handwritten', event.target.value)}
              onBlur={() => normalizeUrlAt('images.handwritten.url')}
              placeholder={placeholders.imageUrl}
            />
            <label className="checkbox-inline" htmlFor="show-handwritten">
              <input
                id="show-handwritten"
                type="checkbox"
                checked={state.images.handwritten.visible}
                onChange={(event) => setImageVisibility('handwritten', event.target.checked)}
              />
              {text.show}
            </label>
          </div>
        </FormField>

        <div className="form-grid two-columns">
          <FormField id="image-shape" label={text.shape}>
            <select
              id="image-shape"
              value={state.images.shape}
              onChange={(event) => updateShape(event.target.value as SignatureFormState['images']['shape'])}
            >
              <option value="square">{text.shapeSquare}</option>
              <option value="circle">{text.shapeCircle}</option>
            </select>
          </FormField>

          <FormField id="image-size" label={text.size}>
            <select
              id="image-size"
              value={state.images.size}
              onChange={(event) => updateSize(event.target.value as SignatureFormState['images']['size'])}
            >
              <option value="small">{text.sizeSmall}</option>
              <option value="medium">{text.sizeMedium}</option>
              <option value="large">{text.sizeLarge}</option>
            </select>
          </FormField>
        </div>
      </div>
    </section>
  );
}
