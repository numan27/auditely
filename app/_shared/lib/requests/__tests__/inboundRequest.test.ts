import { describe, it, expect } from 'vitest';
import { hasInboundSecret, inboundSecret, parseInboundRequest } from '@/app/_shared/lib/requests/inboundRequest';

const SECRET = 'x'.repeat(40);
const body = (over: Record<string, unknown> = {}) => ({
  id: 'req_123-abc',
  name: '  Sarah Jones ',
  email: 'Sarah@SmileDental.com',
  website: 'www.smiledental.com',
  businessType: 'Healthcare',
  mainConcern: 'Slow website',
  requestedAt: '2026-10-27T09:14:00.000Z',
  ...over,
});

describe('inboundSecret', () => {
  it('trusts only a secret as long as AUTH_SECRET', () => {
    expect(inboundSecret({ AUDITELY_INBOUND_SECRET: SECRET })).toBe(SECRET);
    expect(inboundSecret({ AUDITELY_INBOUND_SECRET: ` ${SECRET} ` })).toBe(SECRET);
    expect(inboundSecret({ AUDITELY_INBOUND_SECRET: 'short' })).toBeNull();
    expect(inboundSecret({})).toBeNull();
  });
});

describe('hasInboundSecret', () => {
  it('accepts the secret as a bearer token and nothing else', () => {
    expect(hasInboundSecret(`Bearer ${SECRET}`, SECRET)).toBe(true);
    expect(hasInboundSecret(`bearer ${SECRET}`, SECRET)).toBe(true);
    expect(hasInboundSecret(`Bearer ${SECRET}x`, SECRET)).toBe(false);
    expect(hasInboundSecret(SECRET, SECRET)).toBe(false);
    expect(hasInboundSecret(null, SECRET)).toBe(false);
  });
});

describe('parseInboundRequest', () => {
  it('normalises the site, the email and the request details', () => {
    expect(parseInboundRequest(body())).toEqual({
      ok: true,
      value: {
        website: 'https://www.smiledental.com',
        host: 'smiledental.com',
        email: 'sarah@smiledental.com',
        request: {
          source_id: 'req_123-abc',
          name: 'Sarah Jones',
          business_type: 'Healthcare',
          main_concern: 'Slow website',
          requested_at: '2026-10-27T09:14:00.000Z',
        },
      },
    });
  });

  // An optional detail that came out wrong mustn't lose the request
  it('stores an empty, missing or non-text choice as unknown', () => {
    const parsed = parseInboundRequest(body({ businessType: '', mainConcern: undefined }));
    expect(parsed.ok && parsed.value.request).toMatchObject({ business_type: null, main_concern: null });
    const odd = parseInboundRequest(body({ businessType: 3 }));
    expect(odd.ok && odd.value.request.business_type).toBeNull();
  });

  it('refuses an address the server must not fetch', () => {
    const parsed = parseInboundRequest(body({ website: 'http://169.254.169.254/latest' }));
    expect(parsed.ok).toBe(false);
  });

  it.each([
    ['no id', { id: '' }],
    ['an id with other characters', { id: 'a b' }],
    ['no name', { name: '   ' }],
    ['a very long name', { name: 'n'.repeat(121) }],
    ['two email addresses', { email: 'a@b.com, c@d.com' }],
    ['no email', { email: undefined }],
    ['a long choice', { mainConcern: 'c'.repeat(121) }],
    ['no date', { requestedAt: 'yesterday' }],
  ])('refuses %s', (_label, over) => {
    expect(parseInboundRequest(body(over)).ok).toBe(false);
  });

  it('refuses a body that is not an object', () => {
    expect(parseInboundRequest(null).ok).toBe(false);
    expect(parseInboundRequest('hi').ok).toBe(false);
  });
});
