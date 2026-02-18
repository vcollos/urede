import { ValidationErrors, SignatureFormState } from '../types';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URL_REGEX = /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(?:[\w\-./?%&=+#]*)?$/i;
const HEX_REGEX = /^#?([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/;

export const isValidEmail = (value: string): boolean => {
  if (!value.trim()) return true;
  return EMAIL_REGEX.test(value.trim());
};

export const isValidUrl = (value: string): boolean => {
  if (!value.trim()) return true;
  return URL_REGEX.test(value.trim());
};

export const isValidHex = (value: string): boolean => {
  return HEX_REGEX.test(value.trim());
};

export const normalizeHex = (value: string): string => {
  const sanitized = value.replace('#', '').trim().toUpperCase();
  return sanitized;
};

export const normalizeUrlInput = (value: string): string => {
  const raw = value.trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[\w.-]+\.[a-z]{2,}/i.test(raw)) {
    return `https://${raw}`;
  }
  return raw;
};

export const validateStep = (step: number, state: SignatureFormState, messages: {
  requiredField: string;
  invalidEmail: string;
  invalidUrl: string;
  customFieldLabelRequired: string;
  pronounsRequired: string;
  addressTooLong: string;
  invalidHex: string;
}): ValidationErrors => {
  const errors: ValidationErrors = {};

  if (step === 1) {
    if (!state.details.firstName.trim()) errors['details.firstName'] = messages.requiredField;
    if (!state.details.lastName.trim()) errors['details.lastName'] = messages.requiredField;

    if (!isValidEmail(state.details.email)) errors['details.email'] = messages.invalidEmail;

    const urlFields = [
      { path: 'details.website', value: state.details.website },
      { path: 'details.socialLinks.linkedin', value: state.details.socialLinks.linkedin },
      { path: 'details.socialLinks.facebook', value: state.details.socialLinks.facebook },
      { path: 'details.socialLinks.twitter', value: state.details.socialLinks.twitter },
      { path: 'details.socialLinks.instagram', value: state.details.socialLinks.instagram },
      { path: 'details.socialLinks.whatsapp', value: state.details.socialLinks.whatsapp },
    ];

    for (const field of urlFields) {
      if (!isValidUrl(field.value)) {
        errors[field.path] = messages.invalidUrl;
      }
    }

    if (state.details.pronounsOption === 'custom' && !state.details.customPronouns.trim()) {
      errors['details.customPronouns'] = messages.pronounsRequired;
    }

    if (state.details.address.length > 256) {
      errors['details.address'] = messages.addressTooLong;
    }

    state.details.customFields.forEach((field, index) => {
      if (field.value.trim() && !field.label.trim()) {
        errors[`details.customFields.${index}.label`] = messages.customFieldLabelRequired;
      }
    });
  }

  if (step === 2) {
    const imageFields = [
      { path: 'images.profile.url', value: state.images.profile.url },
      { path: 'images.logo.url', value: state.images.logo.url },
      { path: 'images.handwritten.url', value: state.images.handwritten.url },
    ];

    for (const field of imageFields) {
      if (!isValidUrl(field.value)) {
        errors[field.path] = messages.invalidUrl;
      }
    }
  }

  if (step === 4) {
    const colorFields = [
      { path: 'styles.themeColor', value: state.styles.themeColor },
      { path: 'styles.textColor', value: state.styles.textColor },
      { path: 'styles.linkColor', value: state.styles.linkColor },
    ];

    for (const field of colorFields) {
      if (!isValidHex(field.value)) {
        errors[field.path] = messages.invalidHex;
      }
    }

    if (state.styles.cta.show && !isValidUrl(state.styles.cta.url) && state.styles.cta.type !== 'none') {
      errors['styles.cta.url'] = messages.invalidUrl;
    }

    if (
      state.styles.cta.show
      && state.styles.cta.type === 'custom_image_button'
      && !isValidUrl(state.styles.cta.imageUrl)
    ) {
      errors['styles.cta.imageUrl'] = messages.invalidUrl;
    }
  }

  return errors;
};
