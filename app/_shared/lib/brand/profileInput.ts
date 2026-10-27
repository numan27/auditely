// app/_shared/lib/brand/profileInput.ts

// The Settings page's profile form, checked the same way in the browser and on
// the server. Blank fields are saved as null. The logo is a small PNG or JPEG
// kept as a data URL: no SVG, which could carry a script into an email or PDF.
// Client-safe.

import type { Profile } from '@/app/_shared/lib/brand/brandRules';

export type ProfileFields = Omit<Profile, 'email'>;

export type ProfileInputResult =
  | { ok: true; profile: ProfileFields }
  | { ok: false; field: keyof ProfileFields; error: string };

export const LOGO_MAX_BYTES = 256 * 1024;

const TEXT_MAX = 80;
const URL_MAX = 200;
const EMAIL_MAX = 120;
const PHONE_MAX = 40;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9+().\- ]+$/;
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const DATA_URL = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/;
const SIGNATURES: Record<string, number[]> = {
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  jpeg: [0xff, 0xd8, 0xff],
};

const LABELS = { display_name: 'Your name', company: 'Company', website: 'Website', booking_url: 'Booking link' } as const;

const LOGO_REFUSED = 'The logo must be a PNG or JPEG under 256 KB.';

/** Why a logo can't be saved, or null when it can */
export function logoProblem(dataUrl: string): string | null {
  const match = dataUrl.match(DATA_URL);
  if (!match) return LOGO_REFUSED;
  // atob is in browsers and Node alike
  const bytes = atob(match[2]);
  if (bytes.length > LOGO_MAX_BYTES) return LOGO_REFUSED;
  // The bytes must be the type the address claims
  const signature = SIGNATURES[match[1]];
  return signature.every((byte, i) => bytes.charCodeAt(i) === byte) ? null : LOGO_REFUSED;
}

/** A web address with https:// added when it has no scheme; null when it isn't one */
function webAddress(value: string): string | null {
  try {
    const url = new URL(SCHEME.test(value) ? value : `https://${value}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const href = url.toString();
    return href.length <= URL_MAX ? href : null;
  } catch {
    return null;
  }
}

export function parseProfileInput(body: unknown): ProfileInputResult {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const read = (key: keyof ProfileFields) => {
    const value = input[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  };
  const refuse = (field: keyof ProfileFields, error: string): ProfileInputResult => ({ ok: false, field, error });

  const profile: ProfileFields = {
    display_name: read('display_name'),
    company: read('company'),
    website: read('website'),
    logo_data_url: read('logo_data_url'),
    contact_email: read('contact_email'),
    contact_phone: read('contact_phone'),
    booking_url: read('booking_url'),
  };

  for (const field of ['display_name', 'company'] as const) {
    const value = profile[field];
    if (value && (value.length > TEXT_MAX || /[\r\n]/.test(value))) return refuse(field, `${LABELS[field]} can be at most 80 characters.`);
  }
  for (const field of ['website', 'booking_url'] as const) {
    const value = profile[field];
    if (!value) continue;
    const href = webAddress(value);
    if (!href) return refuse(field, `${LABELS[field]} must be a web address, like https://example.com.`);
    profile[field] = href;
  }
  if (profile.logo_data_url) {
    const problem = logoProblem(profile.logo_data_url);
    if (problem) return refuse('logo_data_url', problem);
  }
  const email = profile.contact_email;
  if (email && (email.length > EMAIL_MAX || !EMAIL.test(email))) {
    return refuse('contact_email', 'Contact email must be an email address, like you@example.com.');
  }
  const phone = profile.contact_phone;
  if (phone && (phone.length > PHONE_MAX || !PHONE.test(phone))) {
    return refuse('contact_phone', 'Phone can only have digits, spaces and + ( ) - .');
  }
  return { ok: true, profile };
}
