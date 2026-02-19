const normalizeText = (value: unknown) =>
  String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const onlyDigits = (value: unknown) => String(value ?? '').replace(/\D/g, '');

const TRUE_VALUES = new Set(['1', 'true', 't', 'yes', 'y', 'sim']);
const FALSE_VALUES = new Set(['0', 'false', 'f', 'no', 'n', 'nao', 'não']);

export const parseBooleanLike = (value: unknown) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = normalizeText(value);
  if (!normalized) return false;
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return false;
};

export const isLikelyBrazilMobile = (value: unknown) => {
  const digits = onlyDigits(value);
  if (!digits) return false;
  if (digits.startsWith('55') && digits.length >= 13) return digits.charAt(4) === '9';
  if (digits.length >= 11) return digits.charAt(2) === '9';
  return false;
};

const hasLegacyWhatsappValue = (value: unknown) => {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  if (normalized.includes('whats')) return true;
  // Alguns fluxos legados persistem o número no campo whatsapp.
  return onlyDigits(value).length >= 8;
};

const isWhatsappType = (value: unknown) => {
  const normalized = normalizeText(value);
  return normalized === 'whatsapp' || normalized.includes('whats');
};

type WhatsAppSource = {
  wpp?: unknown;
  whatsapp?: unknown;
  tipo?: unknown;
  telefone?: unknown;
  valor?: unknown;
  numero_ou_url?: unknown;
};

export const hasWhatsAppFlag = (value: unknown, options?: { inferFromPhone?: boolean }) => {
  if (value && typeof value === 'object') {
    const source = value as WhatsAppSource;
    if (parseBooleanLike(source.wpp)) return true;
    if (hasLegacyWhatsappValue(source.whatsapp)) return true;
    if (isWhatsappType(source.tipo)) return true;

    if (options?.inferFromPhone) {
      return isLikelyBrazilMobile(source.telefone ?? source.valor ?? source.numero_ou_url);
    }
    return false;
  }
  return parseBooleanLike(value);
};

