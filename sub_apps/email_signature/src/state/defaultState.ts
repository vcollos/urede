import { SignatureFormState } from '../types';

export const STORAGE_KEY = 'email_signature_wizard_v1';

export const FONT_FAMILIES = [
  'Arial',
  'Courier New',
  'Georgia',
  'Lucida Sans Unicode',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
] as const;

export const DEFAULT_STATE: SignatureFormState = {
  locale: 'pt-BR',
  currentStep: 1,
  details: {
    firstName: '',
    lastName: '',
    jobTitle: '',
    department: '',
    companyName: '',
    pronounsOption: 'prefer_not',
    customPronouns: '',
    fixedPhone: '',
    mobilePhone: '',
    website: '',
    email: '',
    address: '',
    socialLinks: {
      linkedin: '',
      facebook: '',
      twitter: '',
      instagram: '',
      whatsapp: '',
    },
    customFields: [],
    legalNotice: '',
  },
  images: {
    profile: { url: '', visible: true },
    logo: { url: '', visible: true },
    handwritten: { url: '', visible: false },
    shape: 'circle',
    size: 'medium',
  },
  template: 'template_01',
  styles: {
    themeColor: 'F86295',
    textColor: '000000',
    linkColor: '7075DB',
    fontFamily: 'Arial',
    fontSize: 'medium',
    showPronouns: true,
    showAddress: true,
    showSocial: true,
    showImages: true,
    showLegal: true,
    cta: {
      type: 'none',
      show: false,
      text: '',
      url: '',
      imageUrl: '',
      imageAlt: '',
      style: 'filled',
      radius: 8,
      padding: 12,
    },
  },
  output: {
    html: '',
    text: '',
    generatedAt: null,
  },
};
