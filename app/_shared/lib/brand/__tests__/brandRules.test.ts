import { describe, it, expect, vi, afterEach } from 'vitest';
import { logoFromDataUrl, resolveBrand, type Profile } from '@/app/_shared/lib/brand/brandRules';

// Paid plans are closed while NEXT_PUBLIC_BETA_MODE isn't 'false': the beta
const afterTheBeta = () => vi.stubEnv('NEXT_PUBLIC_BETA_MODE', 'false');
const inTheBeta = () => vi.stubEnv('NEXT_PUBLIC_BETA_MODE', 'true');
afterEach(() => vi.unstubAllEnvs());

const contact = { name: 'Numan', phone: null, email: 'contact@devartventures.com', bookingUrl: 'https://calendly.com/devart-ventures/30min' };
const blank: Profile = {
  email: 'a@x.com',
  display_name: null,
  company: null,
  website: null,
  logo_data_url: null,
  contact_email: null,
  contact_phone: null,
  booking_url: null,
};
const png = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]).toString('base64')}`;

describe('resolveBrand', () => {
  it('gives the owner with a blank profile exactly today’s DevArtVentures details', () => {
    const b = resolveBrand({ profile: blank, isOwner: true, plan: 'owner' }, contact);
    expect(b).toMatchObject({
      kind: 'owner',
      name: 'DevArtVentures',
      website: 'https://devartventures.com',
      tagline: 'Web engineering for growing businesses',
      logo: null,
      contact,
      call: 'a free 30-minute call',
      writer: { about: 'DevArtVentures, a web agency', signOff: 'Numan, DevArtVentures' },
    });
    expect(b.stripe).toEqual(['#2fbf7d', '#3e9feb', '#ec6a45', '#f9cf6e']);
    expect(resolveBrand({ profile: blank, isOwner: true, plan: 'owner' }, { ...contact, name: null }).writer.signOff).toBe(
      'The DevArtVentures team'
    );
  });

  it('lets the owner’s profile replace a default field by field', () => {
    const b = resolveBrand({ profile: { ...blank, display_name: 'Sam', contact_phone: '+1 555 0100' }, isOwner: true, plan: 'owner' }, contact);
    expect(b.contact).toEqual({ ...contact, name: 'Sam', phone: '+1 555 0100' });
    expect(b.writer.signOff).toBe('Sam, DevArtVentures');
    const renamed = resolveBrand({ profile: { ...blank, company: 'Acme' }, isOwner: true, plan: 'owner' }, contact);
    expect([renamed.name, renamed.tagline, renamed.stripe, renamed.writer.about]).toEqual(['Acme', null, null, 'Acme']);
    expect(renamed.writer.signOff).toBe('Numan, Acme');
  });

  it('brands a paid account with its own details', () => {
    const p = { ...blank, display_name: 'Sam Lee', company: 'Acme Studio', website: 'https://acme.studio' };
    const b = resolveBrand({ profile: p, isOwner: false, plan: 'pro' }, contact);
    expect(b).toMatchObject({
      kind: 'account',
      name: 'Acme Studio',
      website: 'https://acme.studio',
      tagline: null,
      stripe: null,
      call: 'a free call',
      contact: { name: 'Sam Lee', phone: null, email: 'a@x.com', bookingUrl: null },
      writer: { about: 'Acme Studio', signOff: 'Sam Lee, Acme Studio' },
    });
    expect(resolveBrand({ profile: { ...blank, company: 'Acme' }, isOwner: false, plan: 'agency' }, contact).writer.signOff).toBe('The Acme team');
    expect(resolveBrand({ profile: { ...blank, display_name: 'Sam' }, isOwner: false, plan: 'pro' }, contact).writer).toEqual({
      about: 'Sam, a web consultant',
      signOff: 'Sam',
    });
  });

  it('puts a paid account’s logo and contact on its brand', () => {
    const p = { ...blank, company: 'Acme', logo_data_url: png, contact_email: 'hi@acme.studio', booking_url: 'https://cal.com/acme' };
    const b = resolveBrand({ profile: p, isOwner: false, plan: 'pro' }, contact);
    expect(b.logo).toEqual({ contentType: 'image/png', dataUrl: png });
    expect(b.contact).toEqual({ name: null, phone: null, email: 'hi@acme.studio', bookingUrl: 'https://cal.com/acme' });
  });

  it('gives Free, a blank paid profile and no profile the Auditely brand, with nothing of DevArtVentures', () => {
    afterTheBeta();
    const inputs = [
      { profile: { ...blank, company: 'Acme', logo_data_url: png }, isOwner: false, plan: 'free' as const },
      { profile: blank, isOwner: false, plan: 'pro' as const },
      { profile: null, isOwner: false, plan: 'free' as const },
    ];
    for (const input of inputs) {
      const b = resolveBrand(input, contact);
      expect(b).toMatchObject({
        kind: 'auditely',
        name: 'Auditely',
        website: 'https://auditely.vercel.app',
        contact: null,
        logo: null,
        call: 'a free call',
        writer: { about: 'a web consultant', signOff: '[Your name]' },
      });
      expect(JSON.stringify(b).toLowerCase()).not.toContain('devart');
    }
  });
});

describe('branding in the beta', () => {
  const p = { ...blank, display_name: 'Numan Khalil', company: 'My Tool', logo_data_url: png, contact_phone: '+92 300 1234567' };

  it('gives a Free account the Auditely brand while paid plans are closed too, whatever its profile says', () => {
    inTheBeta();
    expect(resolveBrand({ profile: p, isOwner: false, plan: 'free' }, contact)).toMatchObject({
      kind: 'auditely',
      logo: null,
      contact: null,
      writer: { signOff: '[Your name]' },
    });
  });

  it('still gives Pro and Agency accounts their own brand', () => {
    inTheBeta();
    for (const plan of ['pro', 'agency'] as const) {
      expect(resolveBrand({ profile: p, isOwner: false, plan }, contact)).toMatchObject({ kind: 'account', name: 'My Tool' });
    }
  });
});

describe('logoFromDataUrl', () => {
  it('reads the type of a stored logo', () => {
    expect(logoFromDataUrl(png)).toEqual({ contentType: 'image/png', dataUrl: png });
    expect(logoFromDataUrl('data:image/jpeg;base64,/9j/4A==')?.contentType).toBe('image/jpeg');
    expect(logoFromDataUrl(null)).toBeNull();
    expect(logoFromDataUrl('https://example.com/logo.png')).toBeNull();
  });
});
