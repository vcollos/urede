const ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:'];

export const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export const sanitizeText = (value: string): string => {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
};

export const sanitizeUrl = (value: string): string => {
  const raw = value.trim();
  if (!raw) return '';

  try {
    const asUrl = new URL(raw.includes('://') ? raw : `https://${raw}`);
    if (!ALLOWED_PROTOCOLS.includes(asUrl.protocol)) return '';
    return asUrl.toString();
  } catch {
    return '';
  }
};

export const sanitizeEmail = (value: string): string => {
  return sanitizeText(value).replace(/\s+/g, '');
};

export const toTelHref = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  return digits ? `tel:${digits}` : '';
};
