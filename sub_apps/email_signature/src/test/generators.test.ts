import { describe, expect, it } from 'vitest';
import { buildSignatureHtml } from '../generators/signatureHtml';
import { buildSignatureText } from '../generators/signatureText';
import { DEFAULT_STATE } from '../state/defaultState';

describe('signature generators', () => {
  const sample = {
    ...DEFAULT_STATE,
    details: {
      ...DEFAULT_STATE.details,
      firstName: 'Ana',
      lastName: 'Silva',
      email: 'ana@company.com',
      mobilePhone: '(11) 99999-0000',
      website: 'company.com',
      socialLinks: {
        ...DEFAULT_STATE.details.socialLinks,
        linkedin: 'linkedin.com/company/test',
      },
    },
    styles: {
      ...DEFAULT_STATE.styles,
      cta: {
        ...DEFAULT_STATE.styles.cta,
        show: true,
        type: 'custom_button' as const,
        text: 'Agendar',
        url: 'https://cal.com/ana',
      },
    },
  };

  it('builds table-based html with safe contact links', () => {
    const html = buildSignatureHtml(sample);
    expect(html).toContain('<table');
    expect(html).toContain('mailto:ana@company.com');
    expect(html).toContain('tel:11999990000');
    expect(html).toContain('Agendar');
  });

  it('keeps phone numbers unbroken and removes empty fallback phone links', () => {
    const html = buildSignatureHtml(sample);

    expect(html).toContain('white-space: nowrap; display: inline-block;');
    expect(html).toContain('(11)&nbsp;9&nbsp;9999&#8209;0000');
    expect(html).not.toContain('| <a href="#">');
  });

  it('shows social icons only when the social URL is provided', () => {
    const html = buildSignatureHtml(sample);

    expect(html).toContain('href="https://linkedin.com/company/test"');
    expect(html).toContain('alt="linkedin"');
    expect(html).not.toContain('alt="twitter"');
    expect(html).not.toContain('alt="facebook"');
    expect(html).not.toContain('alt="instagram"');
    expect(html).not.toContain('alt="whatsapp"');
  });

  it('hides all social icons when no social URL is provided', () => {
    const state = {
      ...sample,
      details: {
        ...sample.details,
        socialLinks: {
          linkedin: '',
          twitter: '',
          facebook: '',
          instagram: '',
          whatsapp: '',
        },
      },
    };

    const html = buildSignatureHtml(state);

    expect(html).not.toContain('alt="linkedin"');
    expect(html).not.toContain('alt="twitter"');
    expect(html).not.toContain('alt="facebook"');
    expect(html).not.toContain('alt="instagram"');
    expect(html).not.toContain('alt="whatsapp"');
  });

  it('collapses profile image placeholders so text uses the freed space', () => {
    const state = {
      ...sample,
      template: 'template_7' as const,
      images: {
        ...sample.images,
        profile: {
          ...sample.images.profile,
          url: '',
          visible: true,
        },
      },
    };

    const html = buildSignatureHtml(state);

    expect(html).not.toContain('28f64af0-33eb-4d9c-8c49-5137d6b740e5');
    expect(html).not.toContain('width: 50%;');
    expect(html).toContain('width: 100%;');
  });

  it('builds plain text output', () => {
    const text = buildSignatureText(sample);
    expect(text).toContain('Ana Silva');
    expect(text).toContain('ana@company.com');
    expect(text).toContain('Agendar: https://cal.com/ana');
  });
});
