import { FONT_FAMILIES } from '../../state/defaultState';
import { SignatureFormState, ValidationErrors } from '../../types';
import { FormField } from '../FormField';

interface StepStylesProps {
  locale: SignatureFormState['locale'];
  state: SignatureFormState;
  errors: ValidationErrors;
  placeholders: {
    ctaText: string;
    ctaUrl: string;
    ctaImageUrl: string;
    ctaImageAlt: string;
  };
  updateStyle: (field: keyof SignatureFormState['styles'], value: SignatureFormState['styles'][keyof SignatureFormState['styles']]) => void;
  updateCta: (field: keyof SignatureFormState['styles']['cta'], value: SignatureFormState['styles']['cta'][keyof SignatureFormState['styles']['cta']]) => void;
  normalizeUrlAt: (path: string) => void;
}

const LABELS = {
  'pt-BR': {
    title: 'Etapa 4: Estilos',
    subtitle: 'Estilize sua assinatura',
    themeColor: 'Cor do tema',
    textColor: 'Cor do texto',
    linkColor: 'Cor dos links',
    colorPreview: 'Exemplo da cor',
    font: 'Fonte',
    fontSize: 'Tamanho da fonte',
    sizeSmall: 'Pequeno',
    sizeMedium: 'Medio',
    sizeLarge: 'Grande',
    ctaType: 'Tipo de CTA',
    ctaShow: 'Mostrar CTA',
    ctaTypes: {
      none: 'Selecione um tipo',
      custom_button: 'Criar botao personalizado',
      custom_image_button: 'Enviar botao personalizado (URL)',
      online_payment: 'Pagamento online',
      schedule_meeting: 'Agendar reuniao',
      newsletter: 'Assinar newsletter',
      download_app: 'Baixar app',
    },
    ctaStyle: 'Estilo do botao',
    ctaStyleFilled: 'Filled',
    ctaStyleOutline: 'Outline',
    ctaRadius: 'Borda (radius)',
    ctaPadding: 'Padding',
    switchesTitle: 'Switches de exibicao',
    showPronouns: 'Mostrar pronomes',
    showAddress: 'Mostrar endereco',
    showSocial: 'Mostrar redes sociais',
    showImages: 'Mostrar imagens',
    showLegal: 'Mostrar aviso legal',
  },
  en: {
    title: 'Step 4: Styles',
    subtitle: 'Style your signature',
    themeColor: 'Theme color',
    textColor: 'Text color',
    linkColor: 'Link color',
    colorPreview: 'Color sample',
    font: 'Font',
    fontSize: 'Font size',
    sizeSmall: 'Small',
    sizeMedium: 'Medium',
    sizeLarge: 'Large',
    ctaType: 'CTA type',
    ctaShow: 'Show CTA',
    ctaTypes: {
      none: 'Select a type',
      custom_button: 'Create custom button',
      custom_image_button: 'Send custom button (URL)',
      online_payment: 'Online payment',
      schedule_meeting: 'Schedule meeting',
      newsletter: 'Subscribe newsletter',
      download_app: 'Download app',
    },
    ctaStyle: 'Button style',
    ctaStyleFilled: 'Filled',
    ctaStyleOutline: 'Outline',
    ctaRadius: 'Radius',
    ctaPadding: 'Padding',
    switchesTitle: 'Display switches',
    showPronouns: 'Show pronouns',
    showAddress: 'Show address',
    showSocial: 'Show social links',
    showImages: 'Show images',
    showLegal: 'Show legal notice',
  },
} as const;

const FONT_SIZE_MAP: Record<SignatureFormState['styles']['fontSize'], number> = {
  small: 0,
  medium: 1,
  large: 2,
};

const SLIDER_TO_SIZE = ['small', 'medium', 'large'] as const;

const parseHexPreview = (value: string): { isValid: boolean; preview: string } => {
  const normalized = value.trim().replace(/^#/, '');
  const isValid = /^[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(normalized);
  return {
    isValid,
    preview: isValid ? `#${normalized}` : 'transparent',
  };
};

export function StepStyles({
  locale,
  state,
  errors,
  placeholders,
  updateStyle,
  updateCta,
  normalizeUrlAt,
}: StepStylesProps) {
  const text = LABELS[locale];
  const ctaType = state.styles.cta.type;
  const themePreview = parseHexPreview(state.styles.themeColor);
  const textPreview = parseHexPreview(state.styles.textColor);
  const linkPreview = parseHexPreview(state.styles.linkColor);

  return (
    <section className="step-content" aria-label={text.title}>
      <h2>{text.title}</h2>
      <p className="step-subtitle">{text.subtitle}</p>

      <div className="form-grid three-columns">
        <FormField id="themeColor" label={text.themeColor} error={errors['styles.themeColor']}>
          <div className="color-input-row">
            <input
              id="themeColor"
              value={state.styles.themeColor}
              maxLength={7}
              onChange={(event) => updateStyle('themeColor', event.target.value)}
            />
            <span
              className={`color-swatch ${themePreview.isValid ? '' : 'is-invalid'}`}
              aria-label={`${text.colorPreview}: ${state.styles.themeColor || '--'}`}
            >
              <span
                className="color-swatch-fill"
                style={{ backgroundColor: themePreview.preview }}
              />
            </span>
          </div>
        </FormField>

        <FormField id="textColor" label={text.textColor} error={errors['styles.textColor']}>
          <div className="color-input-row">
            <input
              id="textColor"
              value={state.styles.textColor}
              maxLength={7}
              onChange={(event) => updateStyle('textColor', event.target.value)}
            />
            <span
              className={`color-swatch ${textPreview.isValid ? '' : 'is-invalid'}`}
              aria-label={`${text.colorPreview}: ${state.styles.textColor || '--'}`}
            >
              <span
                className="color-swatch-fill"
                style={{ backgroundColor: textPreview.preview }}
              />
            </span>
          </div>
        </FormField>

        <FormField id="linkColor" label={text.linkColor} error={errors['styles.linkColor']}>
          <div className="color-input-row">
            <input
              id="linkColor"
              value={state.styles.linkColor}
              maxLength={7}
              onChange={(event) => updateStyle('linkColor', event.target.value)}
            />
            <span
              className={`color-swatch ${linkPreview.isValid ? '' : 'is-invalid'}`}
              aria-label={`${text.colorPreview}: ${state.styles.linkColor || '--'}`}
            >
              <span
                className="color-swatch-fill"
                style={{ backgroundColor: linkPreview.preview }}
              />
            </span>
          </div>
        </FormField>
      </div>

      <div className="form-grid two-columns">
        <FormField id="fontFamily" label={text.font}>
          <select
            id="fontFamily"
            value={state.styles.fontFamily}
            onChange={(event) => updateStyle('fontFamily', event.target.value)}
          >
            {FONT_FAMILIES.map((font) => (
              <option key={font} value={font}>{font}</option>
            ))}
          </select>
        </FormField>

        <FormField id="fontSize" label={text.fontSize}>
          <input
            id="fontSize"
            type="range"
            min={0}
            max={2}
            step={1}
            value={FONT_SIZE_MAP[state.styles.fontSize]}
            onChange={(event) => updateStyle('fontSize', SLIDER_TO_SIZE[Number(event.target.value)])}
          />
          <div className="range-labels" aria-hidden="true">
            <span>{text.sizeSmall}</span>
            <span>{text.sizeMedium}</span>
            <span>{text.sizeLarge}</span>
          </div>
        </FormField>
      </div>

      <div className="styles-cta-stack">
        <div className="switch-row">
          <label className="checkbox-inline" htmlFor="cta-show">
            <input
              id="cta-show"
              type="checkbox"
              checked={state.styles.cta.show}
              onChange={(event) => updateCta('show', event.target.checked)}
            />
            {text.ctaShow}
          </label>
        </div>

        <FormField id="ctaType" label={text.ctaType}>
          <select
            id="ctaType"
            value={ctaType}
            onChange={(event) => updateCta('type', event.target.value as SignatureFormState['styles']['cta']['type'])}
          >
            <option value="none">{text.ctaTypes.none}</option>
            <option value="custom_button">{text.ctaTypes.custom_button}</option>
            <option value="custom_image_button">{text.ctaTypes.custom_image_button}</option>
            <option value="online_payment">{text.ctaTypes.online_payment}</option>
            <option value="schedule_meeting">{text.ctaTypes.schedule_meeting}</option>
            <option value="newsletter">{text.ctaTypes.newsletter}</option>
            <option value="download_app">{text.ctaTypes.download_app}</option>
          </select>
        </FormField>
      </div>

      {state.styles.cta.show && ctaType !== 'none' && (
        <div className="cta-box">
          {ctaType === 'custom_image_button' ? (
            <>
              <FormField id="ctaImageUrl" label="CTA image URL" error={errors['styles.cta.imageUrl']}>
                <input
                  id="ctaImageUrl"
                  value={state.styles.cta.imageUrl}
                  onChange={(event) => updateCta('imageUrl', event.target.value)}
                  onBlur={() => normalizeUrlAt('styles.cta.imageUrl')}
                  placeholder={placeholders.ctaImageUrl}
                />
              </FormField>
              <FormField id="ctaUrl" label="CTA target URL" error={errors['styles.cta.url']}>
                <input
                  id="ctaUrl"
                  value={state.styles.cta.url}
                  onChange={(event) => updateCta('url', event.target.value)}
                  onBlur={() => normalizeUrlAt('styles.cta.url')}
                  placeholder={placeholders.ctaUrl}
                />
              </FormField>
              <FormField id="ctaImageAlt" label="CTA image alt">
                <input
                  id="ctaImageAlt"
                  value={state.styles.cta.imageAlt}
                  onChange={(event) => updateCta('imageAlt', event.target.value)}
                  placeholder={placeholders.ctaImageAlt}
                />
              </FormField>
            </>
          ) : (
            <>
              <FormField id="ctaText" label="CTA text">
                <input
                  id="ctaText"
                  value={state.styles.cta.text}
                  onChange={(event) => updateCta('text', event.target.value)}
                  placeholder={placeholders.ctaText}
                />
              </FormField>
              <FormField id="ctaUrlText" label="CTA URL" error={errors['styles.cta.url']}>
                <input
                  id="ctaUrlText"
                  value={state.styles.cta.url}
                  onChange={(event) => updateCta('url', event.target.value)}
                  onBlur={() => normalizeUrlAt('styles.cta.url')}
                  placeholder={placeholders.ctaUrl}
                />
              </FormField>

              {ctaType === 'custom_button' && (
                <>
                  <FormField id="ctaStyle" label={text.ctaStyle}>
                    <select
                      id="ctaStyle"
                      value={state.styles.cta.style}
                      onChange={(event) => updateCta('style', event.target.value as SignatureFormState['styles']['cta']['style'])}
                    >
                      <option value="filled">{text.ctaStyleFilled}</option>
                      <option value="outline">{text.ctaStyleOutline}</option>
                    </select>
                  </FormField>
                  <div className="form-grid two-columns">
                    <FormField id="ctaRadius" label={text.ctaRadius}>
                      <input
                        id="ctaRadius"
                        type="number"
                        min={0}
                        max={20}
                        value={state.styles.cta.radius}
                        onChange={(event) => updateCta('radius', Number(event.target.value) || 0)}
                      />
                    </FormField>
                    <FormField id="ctaPadding" label={text.ctaPadding}>
                      <input
                        id="ctaPadding"
                        type="number"
                        min={6}
                        max={24}
                        value={state.styles.cta.padding}
                        onChange={(event) => updateCta('padding', Number(event.target.value) || 0)}
                      />
                    </FormField>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      <h3>{text.switchesTitle}</h3>
      <div className="switch-grid">
        <label className="checkbox-inline" htmlFor="show-pronouns">
          <input
            id="show-pronouns"
            type="checkbox"
            checked={state.styles.showPronouns}
            onChange={(event) => updateStyle('showPronouns', event.target.checked)}
          />
          {text.showPronouns}
        </label>
        <label className="checkbox-inline" htmlFor="show-address">
          <input
            id="show-address"
            type="checkbox"
            checked={state.styles.showAddress}
            onChange={(event) => updateStyle('showAddress', event.target.checked)}
          />
          {text.showAddress}
        </label>
        <label className="checkbox-inline" htmlFor="show-social">
          <input
            id="show-social"
            type="checkbox"
            checked={state.styles.showSocial}
            onChange={(event) => updateStyle('showSocial', event.target.checked)}
          />
          {text.showSocial}
        </label>
        <label className="checkbox-inline" htmlFor="show-images">
          <input
            id="show-images"
            type="checkbox"
            checked={state.styles.showImages}
            onChange={(event) => updateStyle('showImages', event.target.checked)}
          />
          {text.showImages}
        </label>
        <label className="checkbox-inline" htmlFor="show-legal">
          <input
            id="show-legal"
            type="checkbox"
            checked={state.styles.showLegal}
            onChange={(event) => updateStyle('showLegal', event.target.checked)}
          />
          {text.showLegal}
        </label>
      </div>
    </section>
  );
}
