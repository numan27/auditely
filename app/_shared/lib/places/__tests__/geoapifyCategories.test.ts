import { describe, it, expect } from 'vitest';
import { categoriesForNiche, nicheNameStem } from '@/app/_shared/lib/places/geoapifyCategories';

describe('categoriesForNiche', () => {
  it('maps dental niches to the dentist category', () => {
    expect(categoriesForNiche('dentists')).toEqual(['healthcare.dentist']);
    expect(categoriesForNiche('Dental Clinic')).toEqual(['healthcare.dentist']);
  });

  it('maps orthodontists to the orthodontics subcategory', () => {
    expect(categoriesForNiche('orthodontists')).toEqual(['healthcare.dentist.orthodontics']);
  });

  it('maps legal niches to lawyers', () => {
    expect(categoriesForNiche('law firms')).toEqual(['office.lawyer']);
    expect(categoriesForNiche('personal injury attorney')).toEqual(['office.lawyer']);
  });

  it('matches whole words, not substrings', () => {
    // "barbers" must not hit the bar rule, "spanish" must not hit the spa rule
    expect(categoriesForNiche('barbers')).toEqual(['service.beauty.hairdresser']);
    expect(categoriesForNiche('spanish restaurants')).toEqual(['catering.restaurant']);
    expect(categoriesForNiche('bars')).toEqual(['catering.bar', 'catering.pub']);
    expect(categoriesForNiche('caribbean restaurants')).toEqual(['catering.restaurant']);
  });

  it('prefers the more specific rule when niches overlap', () => {
    expect(categoriesForNiche('animal hospital')).toEqual(['pet.veterinary']);
    expect(categoriesForNiche('nail salon')).toEqual(['service.beauty', 'commercial.health_and_beauty']);
  });

  it('returns null for niches Geoapify has no category for', () => {
    expect(categoriesForNiche('plumbers')).toBeNull();
    expect(categoriesForNiche('roofing contractors')).toBeNull();
  });

  it('searches chiropractors and physios by name, not as generic clinics', () => {
    expect(categoriesForNiche('chiropractors')).toBeNull();
    expect(categoriesForNiche('chiropractic clinic')).toBeNull();
    expect(categoriesForNiche('physical therapy')).toBeNull();
    expect(categoriesForNiche('medical clinic')).toEqual(['healthcare.clinic_or_praxis']);
  });
});

describe('nicheNameStem', () => {
  it('reduces the first meaningful word to a stem that matches business names', () => {
    expect(nicheNameStem('plumbers')).toBe('plumb');
    expect(nicheNameStem('roofing contractors')).toBe('roof');
    expect(nicheNameStem('best hvac companies')).toBe('hvac');
  });

  it('uses a hand-picked name match for chiropractors and physios', () => {
    expect(nicheNameStem('chiropractors')).toBe('chiropract');
    expect(nicheNameStem('physiotherapists')).toBe('physio|physical therap');
  });

  it('strips characters that could break the Overpass query', () => {
    expect(nicheNameStem('pest") control')).toBe('pest');
  });
});
