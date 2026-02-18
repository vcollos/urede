import { describe, expect, it } from 'vitest';
import { DEFAULT_STATE } from '../state/defaultState';
import { validateStep, normalizeUrlInput, normalizeHex } from '../utils/validators';

describe('validators', () => {
  const messages = {
    requiredField: 'Required',
    invalidEmail: 'Invalid email',
    invalidUrl: 'Invalid URL',
    customFieldLabelRequired: 'Need label',
    pronounsRequired: 'Need pronouns',
    addressTooLong: 'Address too long',
    invalidHex: 'Invalid HEX',
  };

  it('blocks step 1 when mandatory names are missing', () => {
    const result = validateStep(1, DEFAULT_STATE, messages);
    expect(result['details.firstName']).toBe('Required');
    expect(result['details.lastName']).toBe('Required');
  });

  it('validates custom fields and custom pronouns', () => {
    const state = {
      ...DEFAULT_STATE,
      details: {
        ...DEFAULT_STATE.details,
        firstName: 'Ana',
        lastName: 'Silva',
        pronounsOption: 'custom' as const,
        customPronouns: '',
        customFields: [{ id: '1', label: '', value: 'foo' }],
      },
    };

    const result = validateStep(1, state, messages);
    expect(result['details.customPronouns']).toBe('Need pronouns');
    expect(result['details.customFields.0.label']).toBe('Need label');
  });

  it('normalizes urls and hex values', () => {
    expect(normalizeUrlInput('company.com')).toBe('https://company.com');
    expect(normalizeHex('#f86295')).toBe('F86295');
  });
});
