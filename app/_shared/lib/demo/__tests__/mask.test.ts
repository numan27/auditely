import { describe, it, expect } from 'vitest';
import { findUnmasked, maskDeep, maskEmail, maskPhone, maskText } from '@/app/_shared/lib/demo/mask';

describe('maskEmail', () => {
  it('keeps the first character and the domain', () => {
    expect(maskEmail('jane.doe@brightsmile.com')).toBe('j•••@brightsmile.com');
  });

  it('leaves a masked address and a non-address alone', () => {
    expect(maskEmail('j•••@brightsmile.com')).toBe('j•••@brightsmile.com');
    expect(maskEmail('not an email')).toBe('not an email');
  });
});

describe('maskPhone', () => {
  it('keeps the last two digits and the punctuation', () => {
    expect(maskPhone('(713) 555-0142')).toBe('(•••) •••-••42');
    expect(maskPhone('+1 713-555-0142')).toBe('+• •••-•••-••42');
    expect(maskPhone('(•••) •••-••42')).toBe('(•••) •••-••42');
  });
});

describe('maskText', () => {
  it('masks emails and phone numbers inside a sentence, in every usual format', () => {
    expect(maskText('Call (713) 555-0142 or write to office@smile.com today')).toBe(
      'Call (•••) •••-••42 or write to o•••@smile.com today'
    );
    expect(maskText('7135550142')).toBe('••••••••42');
    expect(maskText('713.555.0142')).toBe('•••.•••.••42');
    expect(maskText('Site shows: (713) 555-0142, (713) 555-0199')).toBe('Site shows: (•••) •••-••42, (•••) •••-••99');
  });

  it('leaves dates, scores, sizes and addresses alone', () => {
    for (const text of [
      '2026-09-28T10:22:33.123456+00:00',
      'Largest Contentful Paint 12.8 s',
      '3,450 KiB',
      '1200 Binz St #1090, Houston, TX 77004, USA',
      'Houston, TX 77002-1234',
      'Open 2019-2024, Mon-Fri 800-1700',
      'demo-b12',
    ]) {
      expect(maskText(text)).toBe(text);
    }
  });

  it('masks an email inside a link but leaves the digits of a link alone', () => {
    expect(maskText('https://x.com/?to=bob@x.com')).toBe('https://x.com/?to=b•••@x.com');
    expect(maskText('https://facebook.com/profile.php?id=1000636284')).toBe('https://facebook.com/profile.php?id=1000636284');
  });

  it('gives the same result when run twice', () => {
    const once = maskText('Call (713) 555-0142 or office@smile.com');
    expect(maskText(once)).toBe(once);
  });
});

describe('maskDeep and findUnmasked', () => {
  const value = { email: 'bob@x.com', list: ['7135550142', { note: 'j•••@x.com', score: 72 }], when: '2026-09-28T10:22:33Z', none: null };

  it('finds every readable email and phone number, and says where it is', () => {
    expect(findUnmasked(value)).toEqual([
      { path: 'email', text: 'bob@x.com' },
      { path: 'list[0]', text: '7135550142' },
    ]);
  });

  it('masks every text in a value and nothing else', () => {
    const masked = maskDeep(value);
    expect(masked).toEqual({ email: 'b•••@x.com', list: ['••••••••42', { note: 'j•••@x.com', score: 72 }], when: '2026-09-28T10:22:33Z', none: null });
    expect(findUnmasked(masked)).toEqual([]);
    expect(value.email).toBe('bob@x.com');
  });
});

// The guard on the captured file. It has to see what the masking misses, so it
// is looser than the masking: anything that could be a contact detail.
describe('findUnmasked, beyond what the masking recognises', () => {
  const flagged = (value: unknown) => findUnmasked({ x: value }).map((hit) => hit.path);

  it('flags phone numbers in formats the masking does not know', () => {
    for (const text of [
      'Call us.713-555-0142',
      'Tel.713.555.0142',
      '713–555–0142',
      '713‑555‑0142',
      '713 - 555 - 0142',
      '713/555/0142',
      '+44 20 7946 0958',
      '020 7946 0958',
      '+61 2 9374 4000',
      '555-0142',
      'http://smile.com Call (713) 555-0142',
      '(•••) •••-••42 or 7135550142',
    ]) {
      expect(flagged(text), text).toEqual(['x']);
    }
  });

  it('flags phone numbers inside links', () => {
    for (const text of ['https://wa.me/17135550142', 'https://smile.com/contact?call=713-555-0142', 'tel:+17135550142', 'https://api.whatsapp.com/send?phone=1']) {
      expect(flagged(text), text).toEqual(['x']);
    }
  });

  it('flags email addresses in forms the masking does not know', () => {
    for (const text of ['info%40smile.com', 'info [at] smile.com', 'info(at)smile.com', 'jörg@smile.de', 'mailto:someone', '@drsmile']) {
      expect(flagged(text), text).toEqual(['x']);
    }
  });

  it('flags a phone number stored as a number, or used as a key', () => {
    expect(flagged(7135550142)).toEqual(['x']);
    expect(findUnmasked({ a: { 'bob@x.com': true } }).map((hit) => hit.path)).toEqual(['a["bob@x.com"]']);
  });

  it('accepts what the capture is full of: masked contacts, dates, scores, sizes, addresses, ids', () => {
    for (const value of [
      'j•••@brightsmile.com',
      '(•••) •••-••42',
      '+• •••-•••-••42',
      '••••••••42',
      'Site shows: (•••) •••-••03, (•••) •••-••77',
      '2026-09-28T10:22:33.123456+00:00',
      'Audited on 2026-09-28',
      'Largest Contentful Paint 12.8 s',
      '3,450 KiB',
      '1200 Binz St #1090, Houston, TX 77004, USA',
      'demo-b12',
      'https://www.houstondental.com/?utm_source=google&utm_medium=organic',
      'https://smile.com/blog/2024/05/12/whitening',
      72,
      4.9,
      1250,
      null,
      true,
    ]) {
      expect(flagged(value), String(value)).toEqual([]);
    }
  });

  it("accepts the long id in a social profile link, but not a chat link's phone number", () => {
    const profile = { socials: { facebook: 'https://www.facebook.com/Cosmetic-Smiles-159859634053105' } };
    expect(findUnmasked(profile)).toEqual([]);
    expect(findUnmasked({ socials: { facebook: 'https://wa.me/17135550142' } }).map((hit) => hit.path)).toEqual(['socials.facebook']);
    expect(flagged('https://www.facebook.com/Cosmetic-Smiles-159859634053105')).toEqual(['x']);
  });
});
