import { SignatureFormState } from '../types';
import { sanitizeText } from '../utils/sanitizers';
import { getCtaLabel, getPronounsText } from '../utils/signatureView';

const addLine = (lines: string[], value: string): void => {
  const clean = sanitizeText(value);
  if (clean) lines.push(clean);
};

export const buildSignatureText = (state: SignatureFormState): string => {
  const lines: string[] = [];

  const fullName = sanitizeText(`${state.details.firstName} ${state.details.lastName}`.trim());
  const pronouns = state.styles.showPronouns
    ? sanitizeText(getPronounsText(state.details.pronounsOption, state.details.customPronouns))
    : '';

  addLine(lines, pronouns ? `${fullName} (${pronouns})` : fullName);
  addLine(lines, state.details.jobTitle);
  addLine(lines, state.details.department);
  addLine(lines, state.details.companyName);

  addLine(lines, state.details.fixedPhone);
  addLine(lines, state.details.mobilePhone);
  addLine(lines, state.details.email);
  addLine(lines, state.details.website);

  if (state.styles.showAddress) {
    addLine(lines, state.details.address);
  }

  if (state.styles.showSocial) {
    const socials = [
      ['LinkedIn', state.details.socialLinks.linkedin],
      ['Facebook', state.details.socialLinks.facebook],
      ['X/Twitter', state.details.socialLinks.twitter],
      ['Instagram', state.details.socialLinks.instagram],
      ['WhatsApp', state.details.socialLinks.whatsapp],
    ]
      .filter(([, value]) => sanitizeText(value))
      .map(([label, value]) => `${label}: ${sanitizeText(value)}`);

    lines.push(...socials);
  }

  state.details.customFields.forEach((field) => {
    const label = sanitizeText(field.label);
    const value = sanitizeText(field.value);
    if (label && value) {
      lines.push(`${label}: ${value}`);
    }
  });

  if (state.styles.cta.show && state.styles.cta.type !== 'none' && sanitizeText(state.styles.cta.url)) {
    const label = state.styles.cta.type === 'custom_button'
      ? sanitizeText(state.styles.cta.text) || 'CTA'
      : getCtaLabel(state.styles.cta.type, state.styles.cta.text);
    lines.push(`${label}: ${sanitizeText(state.styles.cta.url)}`);
  }

  if (state.styles.showLegal) {
    addLine(lines, state.details.legalNotice);
  }

  return lines.join('\n');
};
