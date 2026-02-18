import { SignatureFormState, ValidationErrors } from '../../types';
import { FormField } from '../FormField';

interface StepDetailsProps {
  locale: SignatureFormState['locale'];
  state: SignatureFormState;
  errors: ValidationErrors;
  placeholders: {
    firstName: string;
    lastName: string;
    jobTitle: string;
    department: string;
    companyName: string;
    website: string;
    whatsapp: string;
    email: string;
    fixedPhone: string;
    mobilePhone: string;
    address: string;
    legalNotice: string;
    pronounsCustom: string;
    customFieldLabel: string;
    customFieldValue: string;
  };
  updateDetails: (field: keyof SignatureFormState['details'], value: string) => void;
  updateSocial: (key: keyof SignatureFormState['details']['socialLinks'], value: string) => void;
  normalizeUrlAt: (path: string) => void;
  addCustomField: () => void;
  removeCustomField: (id: string) => void;
  updateCustomField: (id: string, key: 'label' | 'value', value: string) => void;
}

const LABELS = {
  'pt-BR': {
    title: 'Etapa 1: Detalhes',
    subtitle: 'Informe os dados da assinatura (campos obrigatorios marcados)',
    firstName: 'Nome',
    lastName: 'Sobrenome',
    jobTitle: 'Cargo',
    department: 'Departamento',
    companyName: 'Nome da empresa',
    pronouns: 'Pronomes',
    pronounsCustom: 'Pronomes (personalizado)',
    fixedPhone: 'Telefone (fixo)',
    mobilePhone: 'Celular',
    website: 'Site (URL)',
    email: 'E-mail',
    address: 'Endereco',
    socialTitle: 'Redes sociais',
    linkedin: 'LinkedIn',
    facebook: 'Facebook',
    twitter: 'X/Twitter',
    instagram: 'Instagram',
    whatsapp: 'WhatsApp',
    customTitle: 'Campo personalizado',
    customAdd: 'Adicionar campo',
    customRemove: 'Remover',
    legalNotice: 'Aviso legal',
    charCounter: (count: number) => `${count}/256 caracteres`,
  },
  en: {
    title: 'Step 1: Details',
    subtitle: 'Fill in signature data (required fields are marked)',
    firstName: 'First name',
    lastName: 'Last name',
    jobTitle: 'Job title',
    department: 'Department',
    companyName: 'Company name',
    pronouns: 'Pronouns',
    pronounsCustom: 'Pronouns (custom)',
    fixedPhone: 'Phone (landline)',
    mobilePhone: 'Mobile',
    website: 'Website (URL)',
    email: 'Email',
    address: 'Address',
    socialTitle: 'Social links',
    linkedin: 'LinkedIn',
    facebook: 'Facebook',
    twitter: 'X/Twitter',
    instagram: 'Instagram',
    whatsapp: 'WhatsApp',
    customTitle: 'Custom fields',
    customAdd: 'Add field',
    customRemove: 'Remove',
    legalNotice: 'Legal notice',
    charCounter: (count: number) => `${count}/256 chars`,
  },
} as const;

const PRONOUN_OPTIONS = {
  'pt-BR': [
    { value: 'he_him', label: 'Ele/Dele' },
    { value: 'she_her', label: 'Ela/Dela' },
    { value: 'neutral', label: 'Neutro' },
    { value: 'prefer_not', label: 'Prefiro nao informar' },
    { value: 'custom', label: 'Personalizado' },
  ],
  en: [
    { value: 'he_him', label: 'He/Him' },
    { value: 'she_her', label: 'She/Her' },
    { value: 'neutral', label: 'Neutral' },
    { value: 'prefer_not', label: 'Prefer not to say' },
    { value: 'custom', label: 'Custom' },
  ],
};

const SOCIAL_KEYS: Array<keyof SignatureFormState['details']['socialLinks']> = [
  'linkedin',
  'facebook',
  'twitter',
  'instagram',
  'whatsapp',
];

export function StepDetails({
  locale,
  state,
  errors,
  placeholders,
  updateDetails,
  updateSocial,
  normalizeUrlAt,
  addCustomField,
  removeCustomField,
  updateCustomField,
}: StepDetailsProps) {
  const text = LABELS[locale];
  const pronounOptions = PRONOUN_OPTIONS[locale];

  return (
    <section className="step-content" aria-label={text.title}>
      <h2>{text.title}</h2>
      <p className="step-subtitle">{text.subtitle}</p>

      <div className="form-grid two-columns">
        <FormField id="firstName" label={text.firstName} required error={errors['details.firstName']}>
          <input
            id="firstName"
            value={state.details.firstName}
            onChange={(event) => updateDetails('firstName', event.target.value)}
            placeholder={placeholders.firstName}
          />
        </FormField>

        <FormField id="lastName" label={text.lastName} required error={errors['details.lastName']}>
          <input
            id="lastName"
            value={state.details.lastName}
            onChange={(event) => updateDetails('lastName', event.target.value)}
            placeholder={placeholders.lastName}
          />
        </FormField>

        <FormField id="jobTitle" label={text.jobTitle}>
          <input
            id="jobTitle"
            value={state.details.jobTitle}
            onChange={(event) => updateDetails('jobTitle', event.target.value)}
            placeholder={placeholders.jobTitle}
          />
        </FormField>

        <FormField id="department" label={text.department}>
          <input
            id="department"
            value={state.details.department}
            onChange={(event) => updateDetails('department', event.target.value)}
            placeholder={placeholders.department}
          />
        </FormField>

        <FormField id="companyName" label={text.companyName}>
          <input
            id="companyName"
            value={state.details.companyName}
            onChange={(event) => updateDetails('companyName', event.target.value)}
            placeholder={placeholders.companyName}
          />
        </FormField>

        <FormField id="pronounsOption" label={text.pronouns}>
          <select
            id="pronounsOption"
            value={state.details.pronounsOption}
            onChange={(event) => updateDetails('pronounsOption', event.target.value)}
          >
            {pronounOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      {state.details.pronounsOption === 'custom' && (
        <FormField
          id="customPronouns"
          label={text.pronounsCustom}
          required
          error={errors['details.customPronouns']}
        >
          <input
            id="customPronouns"
            value={state.details.customPronouns}
            onChange={(event) => updateDetails('customPronouns', event.target.value)}
            placeholder={placeholders.pronounsCustom}
          />
        </FormField>
      )}

      <div className="form-grid two-columns">
        <FormField id="fixedPhone" label={text.fixedPhone}>
          <input
            id="fixedPhone"
            value={state.details.fixedPhone}
            onChange={(event) => updateDetails('fixedPhone', event.target.value)}
            placeholder={placeholders.fixedPhone}
          />
        </FormField>

        <FormField id="mobilePhone" label={text.mobilePhone}>
          <input
            id="mobilePhone"
            value={state.details.mobilePhone}
            onChange={(event) => updateDetails('mobilePhone', event.target.value)}
            placeholder={placeholders.mobilePhone}
          />
        </FormField>

        <FormField id="website" label={text.website} error={errors['details.website']}>
          <input
            id="website"
            value={state.details.website}
            onChange={(event) => updateDetails('website', event.target.value)}
            onBlur={() => normalizeUrlAt('details.website')}
            placeholder={placeholders.website}
          />
        </FormField>

        <FormField id="email" label={text.email} error={errors['details.email']}>
          <input
            id="email"
            value={state.details.email}
            onChange={(event) => updateDetails('email', event.target.value)}
            placeholder={placeholders.email}
          />
        </FormField>
      </div>

      <FormField
        id="address"
        label={text.address}
        error={errors['details.address']}
        counter={text.charCounter(state.details.address.length)}
      >
        <textarea
          id="address"
          maxLength={256}
          value={state.details.address}
          onChange={(event) => updateDetails('address', event.target.value)}
          placeholder={placeholders.address}
        />
      </FormField>

      <h3>{text.socialTitle}</h3>
      <div className="form-grid two-columns">
        {SOCIAL_KEYS.map((key) => {
          const label = text[key];
          const fieldPath = `details.socialLinks.${key}`;
          return (
            <FormField
              key={key}
              id={key}
              label={label}
              error={errors[fieldPath]}
            >
              <input
                id={key}
                value={state.details.socialLinks[key]}
                onChange={(event) => updateSocial(key, event.target.value)}
                onBlur={() => normalizeUrlAt(fieldPath)}
                placeholder={key === 'whatsapp' ? placeholders.whatsapp : placeholders.website}
              />
            </FormField>
          );
        })}
      </div>

      <h3>{text.customTitle}</h3>
      <div className="custom-field-list">
        {state.details.customFields.map((field, index) => (
          <div key={field.id} className="custom-field-row">
            <FormField
              id={`custom-label-${field.id}`}
              label={placeholders.customFieldLabel}
              error={errors[`details.customFields.${index}.label`]}
            >
              <input
                id={`custom-label-${field.id}`}
                value={field.label}
                onChange={(event) => updateCustomField(field.id, 'label', event.target.value)}
                placeholder={placeholders.customFieldLabel}
              />
            </FormField>
            <FormField id={`custom-value-${field.id}`} label={placeholders.customFieldValue}>
              <input
                id={`custom-value-${field.id}`}
                value={field.value}
                onChange={(event) => updateCustomField(field.id, 'value', event.target.value)}
                placeholder={placeholders.customFieldValue}
              />
            </FormField>
            <button
              type="button"
              className="button danger small"
              onClick={() => removeCustomField(field.id)}
              aria-label={`${text.customRemove} ${field.label || field.id}`}
            >
              {text.customRemove}
            </button>
          </div>
        ))}
        <button
          type="button"
          className="button secondary"
          onClick={addCustomField}
          disabled={state.details.customFields.length >= 5}
        >
          {text.customAdd}
        </button>
      </div>

      <FormField id="legalNotice" label={text.legalNotice}>
        <textarea
          id="legalNotice"
          value={state.details.legalNotice}
          onChange={(event) => updateDetails('legalNotice', event.target.value)}
          placeholder={placeholders.legalNotice}
        />
      </FormField>
    </section>
  );
}
