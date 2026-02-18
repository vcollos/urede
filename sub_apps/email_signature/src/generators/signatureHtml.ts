import template01 from '../../templates/modelos/template_01.html?raw';
import template10 from '../../templates/modelos/template_10.html?raw';
import template11 from '../../templates/modelos/template_11.html?raw';
import template12 from '../../templates/modelos/template_12.html?raw';
import template2 from '../../templates/modelos/template_2.html?raw';
import template3 from '../../templates/modelos/template_3.html?raw';
import template4 from '../../templates/modelos/template_4.html?raw';
import template5 from '../../templates/modelos/template_5.html?raw';
import template6 from '../../templates/modelos/template_6.html?raw';
import template7 from '../../templates/modelos/template_7.html?raw';
import template8 from '../../templates/modelos/template_8.html?raw';
import template9 from '../../templates/modelos/template_9.html?raw';
import { SignatureFormState, TemplateId } from '../types';
import { escapeHtml, sanitizeEmail, sanitizeText, sanitizeUrl } from '../utils/sanitizers';
import { getCtaLabel, getPronounsText, toHashColor } from '../utils/signatureView';

const SAMPLE = {
  firstName: 'Vitor',
  lastName: 'Collos',
  jobTitle: 'Assessor',
  department: 'Inovação',
  company: 'Uniodonto do Brasil',
  customField: 'Campo Personalizado aparece aqui.',
  phoneOne: '+55 (16) 9 9775-8116',
  phoneTwo: '+55 (16) 9 9703-5686',
  email: 'vitor@collos.com.br',
  websiteHref: '//uniodonto.coop.br',
  websiteLabel: 'uniodonto.coop.br',
  address: 'Rua Correia Dias, 185 - Paraíso - SP - 04104-000',
  legalNotice: 'Aqui a gente apresenta o aviso legal',
  profileImage: 'https://www.uniodonto.coop.br/wp-content/uploads/2025/01/28f64af0-33eb-4d9c-8c49-5137d6b740e5.png',
  logoImage: 'https://www.uniodonto.coop.br/wp-content/uploads/2025/10/Vinho-Positivo-horizontal-Proxima.png',
  linkedin: 'https://www.linkedin.com/company/uniodonto-do-brasil/',
  twitter: 'https://x.com/uniodontobr',
  facebook: 'https://www.facebook.com/uniodonto.br',
  instagram: 'https://www.instagram.com/uniodonto.br',
  whatsapp: 'https://wa.me/551155728111',
} as const;

const TEMPLATE_BY_ID: Record<TemplateId, string> = {
  template_01: template01,
  template_2: template2,
  template_3: template3,
  template_4: template4,
  template_5: template5,
  template_6: template6,
  template_7: template7,
  template_8: template8,
  template_9: template9,
  template_10: template10,
  template_11: template11,
  template_12: template12,
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toDigits = (value: string): string => value.replace(/\D/g, '');

const replaceAllLiteral = (source: string, target: string, replacement: string): string => {
  return source.split(target).join(replacement);
};

const formatPhoneDisplay = (digits: string, fallbackRaw: string): string => {
  if (!digits) return sanitizeText(fallbackRaw);

  if (digits.length === 12 && digits.startsWith('0800')) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)}`;
  }

  if (digits.length === 11 && digits[2] === '9') {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }

  return sanitizeText(fallbackRaw) || digits;
};

const removeImageBySource = (html: string, source: string): string => {
  const imageRegex = new RegExp(`<img[^>]*src="${escapeRegExp(source)}"[^>]*>`, 'g');
  return html.replace(imageRegex, '');
};

const formatPhoneForHtml = (value: string): string => {
  return escapeHtml(value)
    .replace(/ /g, '&nbsp;')
    .replace(/-/g, '&#8209;');
};

const addNoWrapToTelephoneAnchors = (html: string): string => {
  return html.replace(
    /(<a\b[^>]*href="tel:[^"]*"[^>]*style=")([^"]*)"/gi,
    (_match, prefix: string, styleValue: string) => {
      if (/white-space\s*:/i.test(styleValue)) {
        return `${prefix}${styleValue}"`;
      }

      const normalized = styleValue.trim();
      const separator = normalized && !normalized.endsWith(';') ? '; ' : '';
      return `${prefix}${normalized}${separator}white-space: nowrap; display: inline-block;"`;
    },
  );
};

const cleanupPhoneLinks = (html: string): string => {
  let next = html.replace(/\s*\|\s*<a href="#">[\s\S]*?<\/a>/gi, '');
  next = next.replace(/<a href="#">\s*<span>\s*<\/span>\s*<\/a>/gi, '');
  return next;
};

const removeProfilePlaceholder = (html: string): string => {
  const profileImgRegex = `<img[^>]*src="${escapeRegExp(SAMPLE.profileImage)}"[^>]*>`;
  let next = html;

  next = next.replace(
    new RegExp(`<tr[^>]*>\\s*<td[^>]*>\\s*${profileImgRegex}\\s*<\\/td>\\s*<\\/tr>`, 'gi'),
    '',
  );
  next = next.replace(
    new RegExp(`<td[^>]*>\\s*(?:<span[^>]*>)?\\s*${profileImgRegex}\\s*(?:<\\/span>)?\\s*<\\/td>`, 'gi'),
    '',
  );

  next = next.replace(/padding-left:\s*1rem;/gi, 'padding-left: 0;');
  next = next.replace(/padding-left:\s*15px;/gi, 'padding-left: 0;');
  next = next.replace(/width:\s*50%;/gi, 'width: 100%;');
  next = next.replace(/<tr[^>]*>\s*<\/tr>/gi, '');
  return next;
};

const applyEmailClientCompatibility = (html: string): string => {
  let next = html;
  next = next.replace(/min-width:\s*375px;?/gi, 'width: 100%; max-width: 640px;');
  next = next.replace(/^<table\s+/i, '<table role="presentation" width="100%" ');
  next = next.replace(
    /(<img\b[^>]*style=")([^"]*)"/gi,
    (_match, prefix: string, styleValue: string) => {
      const normalized = styleValue.trim();
      const safe = normalized && !normalized.endsWith(';') ? `${normalized};` : normalized;
      const withHeight = /height\s*:/i.test(safe) ? safe : `${safe}height: auto;`;
      return `${prefix}${withHeight}"`;
    },
  );
  return next;
};

const SOCIAL_SEPARATOR_REGEX = '<span[^>]*display:\\s*inline-block;\\s*width:\\s*5px;[^>]*><\\/span>';

const removeSocialLinkBySourceHref = (html: string, sourceHref: string): string => {
  const anchorRegex = `<a[^>]*href="${escapeRegExp(sourceHref)}"[^>]*>[\\s\\S]*?<\\/a>`;
  let next = html.replace(new RegExp(`${SOCIAL_SEPARATOR_REGEX}\\s*${anchorRegex}`, 'gi'), '');
  next = next.replace(new RegExp(`${anchorRegex}\\s*${SOCIAL_SEPARATOR_REGEX}`, 'gi'), '');
  next = next.replace(new RegExp(anchorRegex, 'gi'), '');
  return next;
};

const cleanupSocialContainers = (html: string): string => {
  let next = html.replace(
    new RegExp(`(<div[^>]*min-width:\\s*140px;[^>]*>)\\s*(?:${SOCIAL_SEPARATOR_REGEX}\\s*)+`, 'gi'),
    '$1',
  );
  next = next.replace(
    new RegExp(`(?:\\s*${SOCIAL_SEPARATOR_REGEX})+\\s*(</div>)`, 'gi'),
    '$1',
  );
  next = next.replace(/<div[^>]*min-width:\s*140px;[^>]*>\s*<\/div>/gi, '');
  return next;
};

const appendBlocks = (html: string, blocks: string[]): string => {
  const content = blocks.filter(Boolean).join('');
  if (!content) return html;
  return `${html}<table cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;"><tbody>${content}</tbody></table>`;
};

const buildCtaBlock = (state: SignatureFormState, themeColor: string): string => {
  if (!state.styles.cta.show || state.styles.cta.type === 'none') return '';

  const ctaUrl = sanitizeUrl(state.styles.cta.url);
  if (!ctaUrl) return '';

  if (state.styles.cta.type === 'custom_image_button') {
    const imageUrl = sanitizeUrl(state.styles.cta.imageUrl);
    if (!imageUrl) return '';
    const alt = sanitizeText(state.styles.cta.imageAlt) || 'CTA';
    return `<tr><td><a href="${escapeHtml(ctaUrl)}" style="text-decoration:none;"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(alt)}" style="display:block;max-width:220px;height:auto;border:0;" /></a></td></tr>`;
  }

  const label = state.styles.cta.type === 'custom_button'
    ? sanitizeText(state.styles.cta.text) || 'CTA'
    : getCtaLabel(state.styles.cta.type, state.styles.cta.text);

  const filled = state.styles.cta.style === 'filled';

  return `<tr><td><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;text-decoration:none;font-size:12px;font-weight:600;padding:${state.styles.cta.padding}px ${state.styles.cta.padding + 6}px;border-radius:${state.styles.cta.radius}px;border:1px solid ${themeColor};background:${filled ? themeColor : 'transparent'};color:${filled ? '#FFFFFF' : themeColor};">${escapeHtml(label)}</a></td></tr>`;
};

const buildHandwrittenBlock = (state: SignatureFormState): string => {
  if (!state.styles.showImages || !state.images.handwritten.visible) return '';

  const handwrittenUrl = sanitizeUrl(state.images.handwritten.url);
  if (!handwrittenUrl) return '';

  return `<tr><td style="padding-top:8px;"><img src="${escapeHtml(handwrittenUrl)}" alt="Assinatura manuscrita" style="display:block;max-width:180px;height:auto;border:0;" /></td></tr>`;
};

export const buildSignatureHtml = (state: SignatureFormState): string => {
  const template = TEMPLATE_BY_ID[state.template] || TEMPLATE_BY_ID.template_01;

  const fullNameFirst = sanitizeText(state.details.firstName) || '';
  const fullNameLast = sanitizeText(state.details.lastName) || '';
  const jobTitle = sanitizeText(state.details.jobTitle);
  const department = sanitizeText(state.details.department);
  const company = sanitizeText(state.details.companyName);
  const email = sanitizeEmail(state.details.email);
  const website = sanitizeUrl(state.details.website);
  const websiteLabel = website.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  const address = state.styles.showAddress ? sanitizeText(state.details.address) : '';
  const legalNotice = state.styles.showLegal ? sanitizeText(state.details.legalNotice) : '';

  const customFieldsText = state.details.customFields
    .map((field) => ({
      label: sanitizeText(field.label),
      value: sanitizeText(field.value),
    }))
    .filter((field) => field.label && field.value)
    .map((field) => `${field.label}: ${field.value}`)
    .join(' | ');

  const pronouns = state.styles.showPronouns
    ? sanitizeText(getPronounsText(state.details.pronounsOption, state.details.customPronouns))
    : '';

  const mobileDigits = toDigits(state.details.mobilePhone);
  const fixedDigits = toDigits(state.details.fixedPhone);
  const firstPhoneDigits = mobileDigits || fixedDigits;
  const secondPhoneDigits = fixedDigits && fixedDigits !== firstPhoneDigits ? fixedDigits : '';

  const firstPhoneDisplay = formatPhoneDisplay(firstPhoneDigits, state.details.mobilePhone || state.details.fixedPhone);
  const secondPhoneDisplay = formatPhoneDisplay(secondPhoneDigits, state.details.fixedPhone);

  const themeColor = toHashColor(state.styles.themeColor);
  const textColor = toHashColor(state.styles.textColor);
  const linkColor = toHashColor(state.styles.linkColor);

  const baseFontSize = state.styles.fontSize === 'small' ? 12 : state.styles.fontSize === 'large' ? 16 : 14;
  const nameFontSize = baseFontSize + 4;
  const legalFontSize = Math.max(baseFontSize - 2, 10);

  let html = template;

  html = replaceAllLiteral(html, SAMPLE.firstName, escapeHtml(fullNameFirst));
  html = replaceAllLiteral(html, SAMPLE.lastName, escapeHtml(fullNameLast));
  html = replaceAllLiteral(html, SAMPLE.jobTitle, escapeHtml(jobTitle));
  html = replaceAllLiteral(html, SAMPLE.department, escapeHtml(department));
  html = replaceAllLiteral(html, SAMPLE.company, escapeHtml(company));
  html = replaceAllLiteral(html, SAMPLE.customField, escapeHtml(customFieldsText));

  html = replaceAllLiteral(html, SAMPLE.phoneOne, formatPhoneForHtml(firstPhoneDisplay));
  html = replaceAllLiteral(html, SAMPLE.phoneTwo, formatPhoneForHtml(secondPhoneDisplay));

  let telIndex = 0;
  const telValues = [firstPhoneDigits, secondPhoneDigits];
  html = html.replace(/href="tel:[^"]*"/g, () => {
    const digits = telValues[telIndex] || '';
    telIndex += 1;
    return digits ? `href="tel:${digits}"` : 'href="#"';
  });
  html = addNoWrapToTelephoneAnchors(html);
  html = cleanupPhoneLinks(html);

  html = replaceAllLiteral(html, SAMPLE.email, escapeHtml(email));
  html = html.replace(/href="mailto:[^"]*"/g, email ? `href="mailto:${escapeHtml(email)}"` : 'href="#"');

  html = replaceAllLiteral(html, SAMPLE.websiteHref, escapeHtml(website));
  html = html.replace(
    /<span>uniodonto\.coop\.br<\/span>/g,
    `<span>${escapeHtml(websiteLabel)}</span>`,
  );
  if (!website) {
    html = html.replace(/href="\/\/uniodonto\.coop\.br"/g, 'href="#"');
  }

  html = replaceAllLiteral(html, SAMPLE.address, escapeHtml(address));
  if (!state.styles.showAddress) {
    html = html.replace(/<tr style="vertical-align: middle; height: 28px;">[\s\S]*?alt="address"[\s\S]*?<\/tr>/g, '');
  }

  html = replaceAllLiteral(html, SAMPLE.legalNotice, escapeHtml(legalNotice));
  if (!state.styles.showLegal) {
    html = html.replace(/<tr><td colspan="3"[\s\S]*?<div class="legal-content">[\s\S]*?<\/tr>/g, '');
  }

  if (!state.styles.showSocial) {
    html = html.replace(/<div[^>]*min-width:\s*140px;[^>]*>[\s\S]*?<\/div>/gi, '');
  } else {
    const socials = [
      { sourceHref: SAMPLE.linkedin, value: state.details.socialLinks.linkedin },
      { sourceHref: SAMPLE.twitter, value: state.details.socialLinks.twitter },
      { sourceHref: SAMPLE.facebook, value: state.details.socialLinks.facebook },
      { sourceHref: SAMPLE.instagram, value: state.details.socialLinks.instagram },
      { sourceHref: SAMPLE.whatsapp, value: state.details.socialLinks.whatsapp },
    ];

    socials.forEach(({ sourceHref, value }) => {
      const socialUrl = sanitizeUrl(value);
      if (socialUrl) {
        html = replaceAllLiteral(html, sourceHref, escapeHtml(socialUrl));
      } else {
        html = removeSocialLinkBySourceHref(html, sourceHref);
      }
    });

    html = cleanupSocialContainers(html);
  }

  const profileUrl = state.styles.showImages && state.images.profile.visible
    ? sanitizeUrl(state.images.profile.url)
    : '';
  const logoUrl = state.styles.showImages && state.images.logo.visible
    ? sanitizeUrl(state.images.logo.url)
    : '';

  if (profileUrl) {
    html = replaceAllLiteral(html, SAMPLE.profileImage, escapeHtml(profileUrl));
  } else {
    html = removeProfilePlaceholder(html);
    html = removeImageBySource(html, SAMPLE.profileImage);
  }

  if (logoUrl) {
    html = replaceAllLiteral(html, SAMPLE.logoImage, escapeHtml(logoUrl));
  } else {
    html = removeImageBySource(html, SAMPLE.logoImage);
  }

  html = html.replace(/rgb\(255,\s*99,\s*126\)/g, themeColor);
  html = html.replace(/rgb\(166,\s*0,\s*105\)/g, themeColor);
  html = html.replace(/rgb\(0,\s*0,\s*0\)/g, textColor);
  html = html.replace(/(<a\b[^>]*style="[^\"]*?color:\s*)([^;\"]+)/g, `$1${linkColor}`);

  html = html.replace(/font-family:\s*Arial/g, `font-family: ${escapeHtml(state.styles.fontFamily)}`);
  html = html.replace(/font-size:\s*18px/g, `font-size: ${nameFontSize}px`);
  html = html.replace(/font-size:\s*14px/g, `font-size: ${baseFontSize}px`);
  html = html.replace(/font-size:\s*12px/g, `font-size: ${legalFontSize}px`);

  if (pronouns) {
    html = html.replace(
      '</h2>',
      ` <span style="font-size:${legalFontSize}px;font-weight:400;color:${textColor};">(${escapeHtml(pronouns)})</span></h2>`,
    );
  }

  const ctaBlock = buildCtaBlock(state, themeColor);
  const handwrittenBlock = buildHandwrittenBlock(state);
  html = appendBlocks(html, [ctaBlock, handwrittenBlock]);

  html = applyEmailClientCompatibility(html);
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');

  return html;
};
