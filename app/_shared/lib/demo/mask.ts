// app/_shared/lib/demo/mask.ts

// Hides the contact details of the businesses shown in the public demo. Used by
// the capture script and by the test that guards the captured file. No imports,
// so the script can load it with plain `node`.

const DOT = '•';
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
// 10 digits in the usual groupings, with an optional country code: (713) 555-0142,
// 713.555.0142, +1 713 555 0142, 7135550142. Not part of a longer number or word.
const PHONE = /(?<![\w.])(?:\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)/g;

// Long digit runs in links are ids, not phone numbers
const isLink = (text: string) => /^https?:\/\//i.test(text);

/** jane.doe@brightsmile.com → j•••@brightsmile.com */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  return at < 1 ? email : `${email[0]}${DOT.repeat(3)}${email.slice(at)}`;
}

/** (713) 555-0142 → (•••) •••-••42 */
export function maskPhone(phone: string): string {
  const total = phone.replace(/\D/g, '').length;
  let seen = 0;
  return phone.replace(/\d/g, (digit) => (++seen > total - 2 ? digit : DOT));
}

/** Masks every email and phone number inside a text */
export function maskText(text: string): string {
  const masked = text.replace(EMAIL, maskEmail);
  return isLink(text) ? masked : masked.replace(PHONE, maskPhone);
}

/** A copy of a JSON value with every text in it masked */
export function maskDeep<T>(value: T): T {
  if (typeof value === 'string') return maskText(value) as T;
  if (Array.isArray(value)) return value.map(maskDeep) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, maskDeep(item)])) as T;
  }
  return value;
}

// ── The guard ────────────────────────────────────────────────────────────────
// Looser than the masking above, and sharing none of its patterns, so it sees
// what the masking missed: it flags anything that could be a contact detail and
// leaves the judgement to whoever runs the capture.

/** Something in a value that still looks like a contact detail */
export interface Unmasked {
  /** Where it is, like leads[3].audit.checks.seo.title */
  path: string;
  text: string;
}

const MASKED_EMAIL = /[^\s@]•{3}@[A-Za-z0-9.-]+/g;
const MASKED_PHONE = /[+(]?•[•\s().+-]*\d{0,2}(?!\d)/g;
const DATE = /\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?/g;
// info@…, info%40…, info [at] …, and a handle like @drsmile
const EMAIL_LIKE = /@|%40|[[(]\s*at\s*[\])]|mailto:/i;
const CALL_LINK = /tel:|wa\.me\/|whatsapp\.com\/|whatsapp:\/\//i;
// 7 or more digits, however they are grouped
const DIGITS = /\d(?:[\s .()+/·–—‑-]*\d){6,}/;
// Inside a link shorter numbers are dates and page ids: 10 or more digits there
const DIGITS_IN_LINK = /\d(?:[.-]?\d){9,}/;
const isWholeLink = (text: string) => /^https?:\/\/\S+$/i.test(text);
// Social profile links carry long ids (facebook.com/Name-159859634053105)
const isSocialLink = (path: string) => /(^|\.)socials\./.test(path);

function looksLikeContact(text: string, path: string): boolean {
  const rest = text.replace(MASKED_EMAIL, ' ').replace(MASKED_PHONE, ' ').replace(DATE, ' ');
  if (EMAIL_LIKE.test(rest) || CALL_LINK.test(rest)) return true;
  if (!isWholeLink(text)) return DIGITS.test(rest);
  return !isSocialLink(path) && DIGITS_IN_LINK.test(rest);
}

// A phone number saved as a number: a whole number of 10 to 15 digits
const looksLikePhoneNumber = (value: number) => Number.isInteger(value) && Math.abs(value) >= 1e9 && Math.abs(value) < 1e15;

const keyPath = (path: string, key: string) =>
  /^[A-Za-z_$][\w$]*$/.test(key) ? (path ? `${path}.${key}` : key) : `${path}[${JSON.stringify(key)}]`;

/** Everything in a JSON value that could still be a contact detail, with where it is */
export function findUnmasked(value: unknown, path = ''): Unmasked[] {
  if (typeof value === 'string') return looksLikeContact(value, path) ? [{ path, text: value }] : [];
  if (typeof value === 'number') return looksLikePhoneNumber(value) ? [{ path, text: String(value) }] : [];
  if (Array.isArray(value)) return value.flatMap((item, i) => findUnmasked(item, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => {
      const at = keyPath(path, key);
      return [...(looksLikeContact(key, at) ? [{ path: at, text: key }] : []), ...findUnmasked(item, at)];
    });
  }
  return [];
}
