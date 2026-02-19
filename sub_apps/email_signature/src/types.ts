export type Locale = 'pt-BR' | 'en';

export type PronounOption =
  | 'he_him'
  | 'she_her'
  | 'neutral'
  | 'prefer_not'
  | 'custom';

export type TemplateId =
  | 'template_01'
  | 'template_2'
  | 'template_3'
  | 'template_4'
  | 'template_5'
  | 'template_6'
  | 'template_7'
  | 'template_8'
  | 'template_9'
  | 'template_10'
  | 'template_11'
  | 'template_12';
export type ImageShape = 'square' | 'circle';
export type ImageSize = 'small' | 'medium' | 'large';
export type FontSizeLevel = 'small' | 'medium' | 'large';
export type CtaStyle = 'filled' | 'outline';

export type CtaType =
  | 'none'
  | 'custom_button'
  | 'custom_image_button'
  | 'online_payment'
  | 'schedule_meeting'
  | 'newsletter'
  | 'download_app';

export interface CustomField {
  id: string;
  label: string;
  value: string;
}

export interface SocialLinks {
  linkedin: string;
  facebook: string;
  twitter: string;
  instagram: string;
  whatsapp: string;
}

export interface SignatureDetails {
  firstName: string;
  lastName: string;
  jobTitle: string;
  department: string;
  companyName: string;
  pronounsOption: PronounOption;
  customPronouns: string;
  fixedPhone: string;
  mobilePhone: string;
  website: string;
  email: string;
  address: string;
  socialLinks: SocialLinks;
  customFields: CustomField[];
  legalNotice: string;
}

export interface SignatureImage {
  url: string;
  visible: boolean;
}

export interface SignatureImages {
  profile: SignatureImage;
  logo: SignatureImage;
  handwritten: SignatureImage;
  shape: ImageShape;
  size: ImageSize;
}

export interface CtaConfig {
  type: CtaType;
  show: boolean;
  text: string;
  url: string;
  imageUrl: string;
  imageAlt: string;
  style: CtaStyle;
  radius: number;
  padding: number;
}

export interface SignatureStyles {
  themeColor: string;
  textColor: string;
  linkColor: string;
  fontFamily: string;
  fontSize: FontSizeLevel;
  showPronouns: boolean;
  showAddress: boolean;
  showSocial: boolean;
  showImages: boolean;
  showLegal: boolean;
  cta: CtaConfig;
}

export interface SignatureOutput {
  html: string;
  text: string;
  generatedAt: string | null;
}

export interface SignatureFormState {
  locale: Locale;
  currentStep: number;
  details: SignatureDetails;
  images: SignatureImages;
  template: TemplateId;
  styles: SignatureStyles;
  output: SignatureOutput;
}

export type ValidationErrors = Record<string, string>;
