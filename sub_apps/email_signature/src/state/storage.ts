import { DEFAULT_STATE } from './defaultState';
import { SignatureFormState } from '../types';

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const mergeShallow = (base: SignatureFormState, value: unknown): SignatureFormState => {
  if (!isObject(value)) return base;

  return {
    ...base,
    ...value,
    details: {
      ...base.details,
      ...(isObject(value.details) ? value.details : {}),
      socialLinks: {
        ...base.details.socialLinks,
        ...(isObject((value as Record<string, unknown>).details) &&
        isObject((value as Record<string, unknown>).details.socialLinks)
          ? (value as Record<string, unknown>).details.socialLinks
          : {}),
      },
      customFields: Array.isArray((value as Record<string, unknown>).details?.customFields)
        ? ((value as Record<string, unknown>).details?.customFields as SignatureFormState['details']['customFields'])
        : base.details.customFields,
    },
    images: {
      ...base.images,
      ...(isObject(value.images) ? value.images : {}),
      profile: {
        ...base.images.profile,
        ...(isObject((value as Record<string, unknown>).images?.profile)
          ? (value as Record<string, unknown>).images?.profile
          : {}),
      },
      logo: {
        ...base.images.logo,
        ...(isObject((value as Record<string, unknown>).images?.logo)
          ? (value as Record<string, unknown>).images?.logo
          : {}),
      },
      handwritten: {
        ...base.images.handwritten,
        ...(isObject((value as Record<string, unknown>).images?.handwritten)
          ? (value as Record<string, unknown>).images?.handwritten
          : {}),
      },
    },
    styles: {
      ...base.styles,
      ...(isObject(value.styles) ? value.styles : {}),
      cta: {
        ...base.styles.cta,
        ...(isObject((value as Record<string, unknown>).styles?.cta)
          ? (value as Record<string, unknown>).styles?.cta
          : {}),
      },
    },
    output: {
      ...base.output,
      ...(isObject(value.output) ? value.output : {}),
    },
  };
};

export const loadState = (storageKey: string): SignatureFormState => {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return mergeShallow(DEFAULT_STATE, parsed);
  } catch {
    return DEFAULT_STATE;
  }
};

export const saveState = (storageKey: string, state: SignatureFormState): void => {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // silent
  }
};
