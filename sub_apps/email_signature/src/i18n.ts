import { Locale } from './types';

interface I18nCopy {
  appTitle: string;
  languageLabel: string;
  leftPanelTitle: string;
  rightPanelTitle: string;
  clearForm: string;
  generate: string;
  previous: string;
  next: string;
  step: string;
  steps: {
    details: string;
    images: string;
    templates: string;
    styles: string;
  };
  requiredField: string;
  invalidEmail: string;
  invalidUrl: string;
  invalidHex: string;
  customFieldLabelRequired: string;
  pronounsRequired: string;
  addressTooLong: string;
  previewTitle: string;
  emailPreviewFrom: string;
  emailPreviewTo: string;
  emailPreviewSubject: string;
  emailPreviewBody: string;
  outputTitle: string;
  htmlOutput: string;
  textOutput: string;
  copySignature: string;
  copyHtml: string;
  copyText: string;
  downloadHtml: string;
  copied: string;
  generateFirst: string;
  installTipsTitle: string;
  installTips: string[];
  placeholders: {
    firstName: string;
    lastName: string;
    jobTitle: string;
    department: string;
    companyName: string;
    website: string;
    email: string;
    fixedPhone: string;
    mobilePhone: string;
    address: string;
    legalNotice: string;
    pronounsCustom: string;
    customFieldLabel: string;
    customFieldValue: string;
    imageUrl: string;
    ctaText: string;
    ctaUrl: string;
    ctaImageUrl: string;
    ctaImageAlt: string;
  };
}

const COPY: Record<Locale, I18nCopy> = {
  'pt-BR': {
    appTitle: 'Gerador de Assinaturas de Email',
    languageLabel: 'Idioma',
    leftPanelTitle: 'Configuracao da assinatura',
    rightPanelTitle: 'Preview e resultado',
    clearForm: 'Limpar campos',
    generate: 'Gerar assinatura',
    previous: 'Anterior',
    next: 'Proximo',
    step: 'Etapa',
    steps: {
      details: 'Detalhes',
      images: 'Imagens',
      templates: 'Modelos',
      styles: 'Estilos',
    },
    requiredField: 'Campo obrigatorio.',
    invalidEmail: 'Email invalido.',
    invalidUrl: 'URL invalida.',
    invalidHex: 'Use HEX com 3 ou 6 caracteres.',
    customFieldLabelRequired: 'Informe o rotulo quando houver valor.',
    pronounsRequired: 'Informe os pronomes personalizados.',
    addressTooLong: 'Endereco deve ter ate 256 caracteres.',
    previewTitle: 'Preview em tempo real',
    emailPreviewFrom: 'De',
    emailPreviewTo: 'Para',
    emailPreviewSubject: 'Assunto',
    emailPreviewBody: 'Segue minha assinatura atualizada:',
    outputTitle: 'Resultado final',
    htmlOutput: 'HTML da assinatura',
    textOutput: 'Assinatura em texto simples',
    copySignature: 'Copiar Assinatura',
    copyHtml: 'Copiar HTML',
    copyText: 'Copiar Texto',
    downloadHtml: 'Download .html',
    copied: 'Copiado com sucesso.',
    generateFirst: 'Clique em "Gerar assinatura" para ver o resultado final.',
    installTipsTitle: 'Como instalar',
    installTips: [
      'Gmail: Configuracoes > Ver todas > Assinatura > cole o HTML.',
      'Outlook: Configuracoes > Email > Redigir e responder > Assinatura.',
      'Apple Mail: Ajustes > Assinaturas > cole o HTML no editor.',
    ],
    placeholders: {
      firstName: 'Ex: Ana',
      lastName: 'Ex: Silva',
      jobTitle: 'Ex: Coordenadora Comercial',
      department: 'Ex: Vendas',
      companyName: 'Ex: UHub',
      website: 'https://empresa.com',
      whatsapp: 'https://wa.me/',
      email: 'nome@empresa.com',
      fixedPhone: '(11) 3333-4444',
      mobilePhone: '(11) 99999-1111',
      address: 'Rua, numero, bairro, cidade, estado',
      legalNotice: 'Texto legal opcional',
      pronounsCustom: 'Ex: elu/delu',
      customFieldLabel: 'Rotulo',
      customFieldValue: 'Valor',
      imageUrl: 'https://...',
      ctaText: 'Texto do botao',
      ctaUrl: 'https://link',
      ctaImageUrl: 'https://imagem-botao.png',
      ctaImageAlt: 'Descricao da imagem',
    },
  },
  en: {
    appTitle: 'Email Signature Generator',
    languageLabel: 'Language',
    leftPanelTitle: 'Signature setup',
    rightPanelTitle: 'Preview and output',
    clearForm: 'Clear fields',
    generate: 'Generate signature',
    previous: 'Previous',
    next: 'Next',
    step: 'Step',
    steps: {
      details: 'Details',
      images: 'Images',
      templates: 'Templates',
      styles: 'Styles',
    },
    requiredField: 'Required field.',
    invalidEmail: 'Invalid email.',
    invalidUrl: 'Invalid URL.',
    invalidHex: 'Use HEX with 3 or 6 chars.',
    customFieldLabelRequired: 'Provide label when value exists.',
    pronounsRequired: 'Provide custom pronouns.',
    addressTooLong: 'Address must be up to 256 characters.',
    previewTitle: 'Live preview',
    emailPreviewFrom: 'From',
    emailPreviewTo: 'To',
    emailPreviewSubject: 'Subject',
    emailPreviewBody: 'Here is my updated signature:',
    outputTitle: 'Final output',
    htmlOutput: 'Signature HTML',
    textOutput: 'Plain text signature',
    copySignature: 'Copy signature',
    copyHtml: 'Copy HTML',
    copyText: 'Copy text',
    downloadHtml: 'Download .html',
    copied: 'Copied.',
    generateFirst: 'Click "Generate signature" to build final output.',
    installTipsTitle: 'Install tips',
    installTips: [
      'Gmail: Settings > See all settings > Signature > paste HTML.',
      'Outlook: Settings > Mail > Compose and reply > Signature.',
      'Apple Mail: Settings > Signatures > paste HTML into editor.',
    ],
    placeholders: {
      firstName: 'E.g. Ana',
      lastName: 'E.g. Silva',
      jobTitle: 'E.g. Sales Manager',
      department: 'E.g. Sales',
      companyName: 'E.g. UHub',
      website: 'https://company.com',
      whatsapp: 'https://wa.me/',
      email: 'name@company.com',
      fixedPhone: '(11) 3333-4444',
      mobilePhone: '(11) 99999-1111',
      address: 'Street, number, city, state',
      legalNotice: 'Optional legal notice',
      pronounsCustom: 'E.g. they/them',
      customFieldLabel: 'Label',
      customFieldValue: 'Value',
      imageUrl: 'https://...',
      ctaText: 'Button text',
      ctaUrl: 'https://link',
      ctaImageUrl: 'https://button-image.png',
      ctaImageAlt: 'Image description',
    },
  },
};

export const getCopy = (locale: Locale): I18nCopy => COPY[locale];
