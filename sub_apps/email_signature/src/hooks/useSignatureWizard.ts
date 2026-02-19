import { useEffect, useMemo, useState } from 'react';
import { buildSignatureHtml } from '../generators/signatureHtml';
import { buildSignatureText } from '../generators/signatureText';
import { getCopy } from '../i18n';
import { DEFAULT_STATE, STORAGE_KEY } from '../state/defaultState';
import { loadState, saveState } from '../state/storage';
import { SignatureFormState, ValidationErrors } from '../types';
import { normalizeHex, normalizeUrlInput, validateStep } from '../utils/validators';

const MAX_STEP = 4;

const withColorNormalization = (state: SignatureFormState): SignatureFormState => {
  return {
    ...state,
    styles: {
      ...state.styles,
      themeColor: normalizeHex(state.styles.themeColor),
      textColor: normalizeHex(state.styles.textColor),
      linkColor: normalizeHex(state.styles.linkColor),
    },
  };
};

export const useSignatureWizard = () => {
  const [state, setState] = useState<SignatureFormState>(() => {
    if (typeof window === 'undefined') return DEFAULT_STATE;
    return withColorNormalization(loadState(STORAGE_KEY));
  });
  const [errors, setErrors] = useState<ValidationErrors>({});

  const copy = useMemo(() => getCopy(state.locale), [state.locale]);

  useEffect(() => {
    saveState(STORAGE_KEY, state);
  }, [state]);

  const updateState = (updater: (prev: SignatureFormState) => SignatureFormState) => {
    setState((previous) => withColorNormalization(updater(previous)));
  };

  const updateDetails = (field: keyof SignatureFormState['details'], value: string) => {
    updateState((previous) => ({
      ...previous,
      details: {
        ...previous.details,
        [field]: value,
      },
    }));
  };

  const updateSocial = (key: keyof SignatureFormState['details']['socialLinks'], value: string) => {
    updateState((previous) => ({
      ...previous,
      details: {
        ...previous.details,
        socialLinks: {
          ...previous.details.socialLinks,
          [key]: value,
        },
      },
    }));
  };

  const updateImageUrl = (key: 'profile' | 'logo' | 'handwritten', value: string) => {
    updateState((previous) => ({
      ...previous,
      images: {
        ...previous.images,
        [key]: {
          ...previous.images[key],
          url: value,
        },
      },
    }));
  };

  const setImageShape = (shape: SignatureFormState['images']['shape']) => {
    updateState((previous) => ({
      ...previous,
      images: {
        ...previous.images,
        shape,
      },
    }));
  };

  const setImageSize = (size: SignatureFormState['images']['size']) => {
    updateState((previous) => ({
      ...previous,
      images: {
        ...previous.images,
        size,
      },
    }));
  };

  const setImageVisibility = (key: 'profile' | 'logo' | 'handwritten', visible: boolean) => {
    updateState((previous) => ({
      ...previous,
      images: {
        ...previous.images,
        [key]: {
          ...previous.images[key],
          visible,
        },
      },
    }));
  };

  const updateStyleField = (field: keyof SignatureFormState['styles'], value: SignatureFormState['styles'][keyof SignatureFormState['styles']]) => {
    updateState((previous) => ({
      ...previous,
      styles: {
        ...previous.styles,
        [field]: value,
      },
    }));
  };

  const updateCtaField = (field: keyof SignatureFormState['styles']['cta'], value: SignatureFormState['styles']['cta'][keyof SignatureFormState['styles']['cta']]) => {
    updateState((previous) => ({
      ...previous,
      styles: {
        ...previous.styles,
        cta: {
          ...previous.styles.cta,
          [field]: value,
        },
      },
    }));
  };

  const addCustomField = () => {
    updateState((previous) => {
      if (previous.details.customFields.length >= 5) return previous;
      return {
        ...previous,
        details: {
          ...previous.details,
          customFields: [
            ...previous.details.customFields,
            {
              id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              label: '',
              value: '',
            },
          ],
        },
      };
    });
  };

  const removeCustomField = (id: string) => {
    updateState((previous) => ({
      ...previous,
      details: {
        ...previous.details,
        customFields: previous.details.customFields.filter((field) => field.id !== id),
      },
    }));
  };

  const updateCustomField = (id: string, key: 'label' | 'value', value: string) => {
    updateState((previous) => ({
      ...previous,
      details: {
        ...previous.details,
        customFields: previous.details.customFields.map((field) => {
          if (field.id !== id) return field;
          return {
            ...field,
            [key]: value,
          };
        }),
      },
    }));
  };

  const normalizeUrlAt = (path: string) => {
    if (path === 'details.website') {
      updateDetails('website', normalizeUrlInput(state.details.website));
      return;
    }

    if (path.startsWith('details.socialLinks.')) {
      const key = path.replace('details.socialLinks.', '') as keyof SignatureFormState['details']['socialLinks'];
      updateSocial(key, normalizeUrlInput(state.details.socialLinks[key]));
      return;
    }

    if (path.startsWith('images.')) {
      const key = path.replace('images.', '').replace('.url', '') as 'profile' | 'logo' | 'handwritten';
      updateImageUrl(key, normalizeUrlInput(state.images[key].url));
      return;
    }

    if (path === 'styles.cta.url') {
      updateCtaField('url', normalizeUrlInput(state.styles.cta.url));
      return;
    }

    if (path === 'styles.cta.imageUrl') {
      updateCtaField('imageUrl', normalizeUrlInput(state.styles.cta.imageUrl));
    }
  };

  const validateCurrentStep = (): boolean => {
    const nextErrors = validateStep(state.currentStep, state, {
      requiredField: copy.requiredField,
      invalidEmail: copy.invalidEmail,
      invalidUrl: copy.invalidUrl,
      customFieldLabelRequired: copy.customFieldLabelRequired,
      pronounsRequired: copy.pronounsRequired,
      addressTooLong: copy.addressTooLong,
      invalidHex: copy.invalidHex,
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const nextStep = () => {
    if (!validateCurrentStep()) return;
    updateState((previous) => ({
      ...previous,
      currentStep: Math.min(previous.currentStep + 1, MAX_STEP),
    }));
  };

  const previousStep = () => {
    updateState((previous) => ({
      ...previous,
      currentStep: Math.max(previous.currentStep - 1, 1),
    }));
  };

  const generateOutput = () => {
    const errorsByStep: ValidationErrors = {};

    for (let step = 1; step <= MAX_STEP; step += 1) {
      const stepErrors = validateStep(step, state, {
        requiredField: copy.requiredField,
        invalidEmail: copy.invalidEmail,
        invalidUrl: copy.invalidUrl,
        customFieldLabelRequired: copy.customFieldLabelRequired,
        pronounsRequired: copy.pronounsRequired,
        addressTooLong: copy.addressTooLong,
        invalidHex: copy.invalidHex,
      });
      Object.assign(errorsByStep, stepErrors);
    }

    setErrors(errorsByStep);

    if (Object.keys(errorsByStep).length > 0) {
      return false;
    }

    const html = buildSignatureHtml(state);
    const text = buildSignatureText(state);

    updateState((previous) => ({
      ...previous,
      output: {
        html,
        text,
        generatedAt: new Date().toISOString(),
      },
    }));

    return true;
  };

  const clearAll = () => {
    setErrors({});
    setState((previous) => ({
      ...DEFAULT_STATE,
      locale: previous.locale,
    }));
  };

  const setLocale = (locale: SignatureFormState['locale']) => {
    updateState((previous) => ({
      ...previous,
      locale,
    }));
  };

  const goToStep = (step: number) => {
    updateState((previous) => ({
      ...previous,
      currentStep: Math.min(Math.max(step, 1), MAX_STEP),
    }));
  };

  const setTemplate = (template: SignatureFormState['template']) => {
    updateState((previous) => ({
      ...previous,
      template,
    }));
  };

  return {
    state,
    copy,
    errors,
    updateDetails,
    updateSocial,
    updateImageUrl,
    setImageShape,
    setImageSize,
    setImageVisibility,
    updateStyleField,
    updateCtaField,
    addCustomField,
    removeCustomField,
    updateCustomField,
    normalizeUrlAt,
    nextStep,
    previousStep,
    goToStep,
    setTemplate,
    clearAll,
    generateOutput,
    setLocale,
  };
};
