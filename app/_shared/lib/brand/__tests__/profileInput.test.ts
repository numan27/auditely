import { describe, it, expect } from 'vitest';
import { logoProblem, parseProfileInput } from '@/app/_shared/lib/brand/profileInput';

const png = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]).toString('base64')}`;

describe('parseProfileInput', () => {
  it('trims, nulls blanks and adds https:// to a bare website', () => {
    expect(parseProfileInput({ display_name: '  Sam ', company: '', website: 'acme.studio', booking_url: ' ' })).toEqual({
      ok: true,
      profile: {
        display_name: 'Sam',
        company: null,
        website: 'https://acme.studio/',
        logo_data_url: null,
        contact_email: null,
        contact_phone: null,
        booking_url: null,
      },
    });
  });

  it('keeps every valid field', () => {
    const result = parseProfileInput({
      display_name: 'Sam Lee',
      company: 'Acme Studio',
      website: 'https://acme.studio',
      logo_data_url: png,
      contact_email: 'hi@acme.studio',
      contact_phone: '+1 (555) 010-0100',
      booking_url: 'http://cal.com/acme',
    });
    expect(result).toEqual({
      ok: true,
      profile: {
        display_name: 'Sam Lee',
        company: 'Acme Studio',
        website: 'https://acme.studio/',
        logo_data_url: png,
        contact_email: 'hi@acme.studio',
        contact_phone: '+1 (555) 010-0100',
        booking_url: 'http://cal.com/acme',
      },
    });
  });

  it('names the field that is wrong', () => {
    expect(parseProfileInput({ company: 'x'.repeat(81) })).toEqual({ ok: false, field: 'company', error: 'Company can be at most 80 characters.' });
    expect(parseProfileInput({ display_name: 'Sam\nLee' })).toEqual({
      ok: false,
      field: 'display_name',
      error: 'Your name can be at most 80 characters.',
    });
    expect(parseProfileInput({ website: 'javascript:alert(1)' })).toMatchObject({
      field: 'website',
      error: 'Website must be a web address, like https://example.com.',
    });
    expect(parseProfileInput({ booking_url: 'ftp://cal.com' })).toMatchObject({
      field: 'booking_url',
      error: 'Booking link must be a web address, like https://example.com.',
    });
    expect(parseProfileInput({ contact_email: 'sam@' })).toMatchObject({
      field: 'contact_email',
      error: 'Contact email must be an email address, like you@example.com.',
    });
    expect(parseProfileInput({ contact_phone: '555<script>' })).toMatchObject({
      field: 'contact_phone',
      error: 'Phone can only have digits, spaces and + ( ) - .',
    });
    expect(parseProfileInput({ logo_data_url: 'data:image/gif;base64,R0lG' })).toMatchObject({ field: 'logo_data_url' });
  });

  it('reads anything that isn’t an object as an empty profile', () => {
    expect(parseProfileInput(null)).toMatchObject({ ok: true, profile: { display_name: null, company: null } });
    expect(parseProfileInput({ company: 42 })).toMatchObject({ ok: true, profile: { company: null } });
  });
});

describe('logoProblem', () => {
  it('takes a small PNG or JPEG logo and refuses anything else', () => {
    expect(logoProblem(png)).toBeNull();
    expect(logoProblem(`data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0]).toString('base64')}`)).toBeNull();
    const refused = 'The logo must be a PNG or JPEG under 256 KB.';
    expect(logoProblem('data:image/svg+xml;base64,PHN2Zz4=')).toBe(refused);
    // The bytes say PNG
    expect(logoProblem(png.replace('image/png', 'image/jpeg'))).toBe(refused);
    const big = Buffer.concat([Buffer.from(png.split(',')[1], 'base64'), Buffer.alloc(256 * 1024)]).toString('base64');
    expect(logoProblem(`data:image/png;base64,${big}`)).toBe(refused);
    expect(logoProblem('data:image/png;base64,not base64!')).toBe(refused);
  });
});
