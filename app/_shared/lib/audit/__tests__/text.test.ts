import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';
import {
  addressParts,
  containsWord,
  formatPhone,
  nameSimilarity,
  normalizeAddress,
  phoneDigits,
  visibleText,
} from '@/app/_shared/lib/audit/analyzers/text';

describe('nameSimilarity', () => {
  it('ignores punctuation, legal suffixes and extra title words', () => {
    expect(nameSimilarity('Smile Dental, P.C.', 'Home | Smile Dental')).toBe(1);
    expect(nameSimilarity('Bright Smiles D.D.S.', 'Bright Smiles')).toBe(1);
  });

  it('scores unrelated names 0', () => {
    expect(nameSimilarity('Bright Smiles Family Dentistry', 'Downtown Dental Care')).toBe(0);
    expect(nameSimilarity('Acme LLC', 'LLC')).toBe(0);
  });
});

describe('phoneDigits', () => {
  it('reduces US formats to the last 10 digits', () => {
    expect(phoneDigits('(555) 123-4567')).toBe('5551234567');
    expect(phoneDigits('+1 555.123.4567')).toBe('5551234567');
    expect(phoneDigits('%2B15551234567')).toBe('5551234567');
  });

  it('drops extensions before taking the last 10 digits', () => {
    expect(phoneDigits('+1 (555) 123-4567 ext. 2')).toBe('5551234567');
    expect(phoneDigits('555-123-4567 x12')).toBe('5551234567');
  });

  it('drops RFC 3966 extensions and pause/dial suffixes', () => {
    expect(phoneDigits('tel:+1-555-123-4567;ext=22')).toBe('5551234567');
    expect(phoneDigits('555-123-4567,,2')).toBe('5551234567');
  });

  it('returns null for numbers that are too short', () => {
    expect(phoneDigits('123-4567')).toBeNull();
  });

  it('formats 10 digits for display', () => {
    expect(formatPhone('5559990000')).toBe('(555) 999-0000');
  });
});

describe('addressParts', () => {
  it('extracts street number and ZIP', () => {
    expect(addressParts('123 Main Street, Suite 4, Springfield, IL 62701-1234, USA')).toEqual({
      streetNumber: '123',
      zip: '62701',
    });
  });

  it('does not mistake a 5-digit street number for the ZIP', () => {
    expect(addressParts('12345 Ocean Blvd, Miami, FL')).toEqual({ streetNumber: '12345', zip: null });
  });

  it('returns nulls for city-only addresses', () => {
    expect(addressParts('Springfield, IL, USA')).toEqual({ streetNumber: null, zip: null });
  });

  it('normalises common abbreviations', () => {
    expect(normalizeAddress('500 North Avenue, Ste. 2')).toBe('500 n ave ste 2');
  });

  it('matches whole words only', () => {
    expect(containsWord('123 main st 62701', '123')).toBe(true);
    expect(containsWord('1234 main st', '123')).toBe(false);
  });
});

describe('visibleText', () => {
  it('joins text across elements and skips scripts and styles', () => {
    const $ = cheerio.load('<body><h1>Hi</h1><script>var a = 1</script><p>there <b>friend</b></p><style>p{}</style></body>');
    expect(visibleText($)).toBe('Hi there friend');
  });

  it('handles deeply nested markup without overflowing the stack', () => {
    const depth = 5000;
    const $ = cheerio.load(`<body>${'<div>'.repeat(depth)}deep <b>text</b>${'</div>'.repeat(depth)}</body>`);
    expect(visibleText($)).toBe('deep text');
  });
});
