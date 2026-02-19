import { CtaType, FontSizeLevel, ImageSize, PronounOption } from '../types';

const FONT_SIZE_MAP: Record<FontSizeLevel, string> = {
  small: '12px',
  medium: '14px',
  large: '16px',
};

const IMAGE_SIZE_MAP: Record<ImageSize, number> = {
  small: 52,
  medium: 72,
  large: 96,
};

const PRONOUNS: Record<PronounOption, string> = {
  he_him: 'Ele/Dele',
  she_her: 'Ela/Dela',
  neutral: 'Neutro',
  prefer_not: '',
  custom: '',
};

const CTA_LABELS: Record<CtaType, string> = {
  none: '',
  custom_button: '',
  custom_image_button: '',
  online_payment: 'Pagamento online',
  schedule_meeting: 'Agendar reuniao',
  newsletter: 'Assinar newsletter',
  download_app: 'Baixar app',
};

export const getFontSize = (level: FontSizeLevel): string => FONT_SIZE_MAP[level];
export const getImageSize = (size: ImageSize): number => IMAGE_SIZE_MAP[size];

export const getPronounsText = (option: PronounOption, custom: string): string => {
  if (option === 'custom') return custom.trim();
  return PRONOUNS[option];
};

export const getCtaLabel = (type: CtaType, fallback?: string): string => {
  if (type === 'custom_button') return fallback?.trim() || 'Botao';
  return CTA_LABELS[type] || fallback || '';
};

export const toHashColor = (value: string): string => {
  const clean = value.replace('#', '').trim().toUpperCase();
  return `#${clean || '000000'}`;
};
