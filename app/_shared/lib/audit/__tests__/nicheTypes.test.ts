import { describe, it, expect } from 'vitest';
import {
  expectedTypesForNiche,
  isLocalBusinessType,
  isMedicalNiche,
} from '@/app/_shared/lib/audit/nicheTypes';

describe('expectedTypesForNiche', () => {
  it('maps dental niches to Dentist, even when "clinic" is also present', () => {
    expect(expectedTypesForNiche('Dentists')).toEqual(['Dentist']);
    expect(expectedTypesForNiche('pediatric dental clinic')).toEqual(['Dentist']);
  });

  it('maps medical niches to medical types', () => {
    expect(expectedTypesForNiche('chiropractor')).toContain('MedicalClinic');
  });

  it('maps education niches to educational types', () => {
    expect(expectedTypesForNiche('math tutoring')).toContain('EducationalOrganization');
  });

  it('returns null for niches without a rule', () => {
    expect(expectedTypesForNiche('plumber')).toBeNull();
    expect(expectedTypesForNiche(null)).toBeNull();
  });
});

describe('isMedicalNiche', () => {
  it('is true for dental and medical niches only', () => {
    expect(isMedicalNiche('dentist')).toBe(true);
    expect(isMedicalNiche('physiotherapy')).toBe(true);
    expect(isMedicalNiche('tutor')).toBe(false);
    expect(isMedicalNiche(null)).toBe(false);
  });
});

describe('isLocalBusinessType', () => {
  it('accepts business and school types, rejects page/org types', () => {
    expect(isLocalBusinessType('Dentist')).toBe(true);
    expect(isLocalBusinessType('School')).toBe(true);
    expect(isLocalBusinessType('WebSite')).toBe(false);
    expect(isLocalBusinessType('Organization')).toBe(false);
  });
});
